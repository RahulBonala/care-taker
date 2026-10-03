import { isAfterDayEnd } from "@/call-engine/day";
import { intentFor, replay, step, type CallPhase, type Effect, type StepResult } from "@/call-engine/machine";
import type { DemoData } from "@/domain/data";
import { findPatient, nextId } from "@/domain/data";
import type { CallContext, CallInput, CallRecord, Lang, Patient, QueuedCall } from "@/domain/types";
import { MIN } from "@/lib/time";
import { emit, messageFamily, openFlag } from "./emit";

export interface CallRunOptions {
  /** Write per-step events to the activity feed (off for quiet background calls). */
  verbose: boolean;
  /** Language the call is spoken in (the patient's own unless the demo overrides it). */
  lang?: Lang;
}

function previousCalls(data: DemoData, q: Pick<QueuedCall, "patientId" | "date" | "slot">) {
  return data.calls.filter((c) => c.patientId === q.patientId && c.date === q.date && c.slot === q.slot && c.status === "ended");
}

export function contextFor(data: DemoData, q: QueuedCall, at: number): CallContext {
  const prev = previousCalls(data, q);
  return {
    slot: q.slot,
    attempt: q.attempt,
    postponesSoFar: prev.filter((c) => c.outcome === "postponed").length,
    otherPersonSoFar: prev.filter((c) => c.outcome === "callbackOtherPerson" || c.outcome === "otherPersonFlagged").length,
    startedAt: at,
  };
}

/** Take a queued call off the queue and start it ringing. */
export function placeCall(data: DemoData, q: QueuedCall, at: number, opts: CallRunOptions & { simulated: boolean }): CallRecord {
  const p = findPatient(data, q.patientId)!;
  data.queue = data.queue.filter((x) => x.id !== q.id);
  const call: CallRecord = {
    id: nextId(data, "c"),
    patientId: p.id,
    date: q.date,
    slot: q.slot,
    reason: q.reason,
    ctx: contextFor(data, q, at),
    inputs: [],
    status: "ringing",
    simulated: opts.simulated,
    lang: opts.lang ?? p.language,
    phoneType: p.phoneType,
  };
  data.calls.push(call);
  if (opts.verbose) {
    emit(
      data,
      at,
      q.reason === "scheduled" ? "event.callPlaced" : "event.callPlacedAgain",
      { patient: { $person: p.id }, slot: { $t: `slotWord.${q.slot}` }, attempt: q.attempt },
      ["patient", "nurse", "admin"],
      "info",
      p.id,
    );
  }
  return call;
}

export function callState(call: CallRecord) {
  return replay(call.inputs, call.ctx).state;
}

/** Feed one input (answer, reply, decline...) into a live or simulated call. */
export function applyInput(data: DemoData, call: CallRecord, input: CallInput, at: number, opts: CallRunOptions): StepResult {
  const before = callState(call);
  const r = step(before, input, call.ctx);
  call.inputs.push(input);
  if (r.state.phase === "ended") {
    call.status = "ended";
    call.outcome = r.state.outcome;
    call.endedAt = at;
    if (data.phone.activeCallId === call.id) data.phone.activeCallId = undefined;
    if (data.phone.ringingCallId === call.id) data.phone.ringingCallId = undefined;
  } else if (r.state.phase !== "ringing") {
    call.status = "inProgress";
    if (data.phone.ringingCallId === call.id) data.phone.ringingCallId = undefined;
  }

  if (opts.verbose) describeStep(data, call, input, r, before.phase, at);
  applyEffects(data, call, r.effects, at, opts);
  return r;
}

function describeStep(data: DemoData, call: CallRecord, input: CallInput, r: StepResult, phaseBefore: string, at: number) {
  const pid = call.patientId;
  const who = { $person: pid };
  if (input.type === "answer" && phaseBefore === "ringing") {
    emit(data, at, "event.answered", { patient: who }, ["patient", "nurse", "admin"], "info", pid);
  }
  if (input.type === "reply" && phaseBefore !== "ringing") {
    const intent = intentFor(phaseBefore as CallPhase, input);
    emit(
      data,
      at,
      input.via === "key" ? "event.keyPressed" : "event.replyUnderstood",
      { patient: who, key: input.key ?? "", reply: { $t: `intent.${intent}` } },
      ["nurse", "admin"],
      intent === "unclear" ? "warn" : "info",
      pid,
    );
  }
  for (const line of r.lines) {
    if (line.speaker !== "system") continue;
    if (line.key === "readBack") emit(data, at, "event.readBack", { patient: who, slot: { $t: `slotWord.${call.slot}` } }, ["patient", "nurse", "admin"], "info", pid);
    if (line.key === "keypadMenu") emit(data, at, "event.keypadMenu", { patient: who }, ["nurse", "admin"], "warn", pid);
  }
  if (input.type === "noAnswer" || (input.type === "hangUp" && r.state.outcome?.startsWith("noAnswer"))) {
    emit(data, at, input.type === "noAnswer" ? "event.noAnswer" : "event.hungUp", { patient: who, attempt: call.ctx.attempt }, ["nurse", "admin"], "warn", pid);
  }
}

function applyEffects(data: DemoData, call: CallRecord, effects: Effect[], at: number, opts: CallRunOptions) {
  const p = findPatient(data, call.patientId)!;
  const who = { $person: p.id };
  const slot = { $t: `slotWord.${call.slot}` };
  for (const e of effects) {
    switch (e.type) {
      case "logDose": {
        data.log.push({
          id: nextId(data, "l"),
          kind: "doseTaken",
          patientId: p.id,
          at,
          source: "call",
          date: call.date,
          slot: call.slot,
          takenAt: e.takenAt,
          confirmation: e.confirmation,
          callId: call.id,
        });
        if (opts.verbose) {
          emit(data, at, "event.confirmed", { patient: who, how: { $t: `confirmation.${e.confirmation}` } }, ["nurse", "admin"], "ok", p.id);
          emit(data, at, "event.logWritten", { patient: who, slot }, ["family", "nurse", "doctor", "admin"], "ok", p.id);
        }
        break;
      }
      case "scheduleCall": {
        const callAt = call.ctx.startedAt + e.afterMinutes * MIN;
        if (isAfterDayEnd(callAt, call.date)) {
          if (opts.verbose) emit(data, at, "event.notCalledAgainDayEnds", { patient: who, slot }, ["nurse", "admin"], "warn", p.id);
          break;
        }
        data.queue.push({
          id: nextId(data, "q"),
          patientId: p.id,
          date: call.date,
          slot: call.slot,
          at: callAt,
          reason: e.reason,
          attempt: e.reason === "noAnswer" ? call.ctx.attempt + 1 : 1,
        });
        if (opts.verbose) {
          emit(
            data,
            at,
            e.reason === "noAnswer" ? "event.retryScheduled" : "event.rescheduled",
            { patient: who, minutes: e.afterMinutes, time: { $time: callAt } },
            ["patient", "family", "nurse", "admin"],
            "info",
            p.id,
          );
        }
        break;
      }
      case "openFlag":
        openFlag(data, at, p.id, e.flag, { callId: call.id, date: call.date, slot: call.slot });
        break;
      case "notifyFamily": {
        const n = messageFamily(data, at, p.id, "noAnswer", { patient: who, slot });
        if (n) emit(data, at, "event.familyToldNoAnswer", { patient: who, count: n }, ["family", "nurse", "admin"], "warn", p.id);
        break;
      }
      case "note":
        call.note = "refused";
        emit(data, at, "event.refusalNoted", { patient: who, slot }, ["nurse", "admin"], "warn", p.id);
        break;
    }
  }
}

/** Run a whole call from a script of inputs (background or skipped calls). */
export function runScriptedCall(data: DemoData, q: QueuedCall, at: number, script: CallInput[], verbose: boolean): CallRecord {
  const call = placeCall(data, q, at, { simulated: true, verbose });
  for (const input of script) {
    if (call.status === "ended") break;
    applyInput(data, call, input, at, { verbose });
  }
  if (call.status !== "ended") applyInput(data, call, { type: "hangUp" }, at, { verbose });
  return call;
}

export function patientLanguage(p: Patient): Lang {
  return p.language;
}
