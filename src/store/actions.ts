"use client";

/**
 * Everything the demo can do, as plain functions. Each one copies the data,
 * applies a rule from the pure modules (call engine, domain, sim) and writes
 * the result back, so every role sees the change at once.
 */
import type { DemoData } from "@/domain/data";
import { findPatient, nextId } from "@/domain/data";
import { callTimeFor, noCallsReason, plannedSlots } from "@/domain/schedule";
import type { CallInput, Patient, Slot } from "@/domain/types";
import { addDays, atLocal, endOfLocalDay, HOUR, localDate, MIN } from "@/lib/time";
import { advanceClock } from "@/sim/advance";
import { applyInput } from "@/sim/calls";
import { emit } from "@/sim/emit";
import { buildSeed, STORY_START } from "@/sim/seed";
import { DEFAULT_UI, setUi, useDemo, type UiState } from "./store";

export function getData(): DemoData {
  return useDemo.getState().data!;
}

export function getNow(): number {
  return useDemo.getState().now;
}

/** Copy the data, change the copy, publish it. */
export function mutate(recipe: (data: DemoData, now: number) => void) {
  const s = useDemo.getState();
  if (!s.data) return;
  const data = structuredClone(s.data);
  recipe(data, s.now);
  useDemo.setState({ data });
}

/* ------------------------------------------------------------------ reset */

const keepPrefs = (ui: UiState): Partial<UiState> => ({
  language: ui.language,
  device: ui.device,
  landscape: ui.landscape,
  feedOpen: ui.feedOpen,
  speak: ui.speak,
});

export function resetDemo() {
  const { data, now } = buildSeed();
  const ui = useDemo.getState().ui;
  useDemo.setState({ data, now, mode: "explore", story: { active: false, step: 0 }, ui: { ...DEFAULT_UI, ...keepPrefs(ui) } });
}

export function loadStoryBaseline() {
  const { data, now } = buildSeed({ withoutLakshmi: true, until: STORY_START });
  const ui = useDemo.getState().ui;
  useDemo.setState({
    data,
    now,
    mode: "story",
    ui: { ...DEFAULT_UI, ...keepPrefs(ui), focusPatientId: "p_lakshmi", feedOpen: true },
  });
}

/* ------------------------------------------------------------------ clock */

export function focusPatient(): Patient | undefined {
  const s = useDemo.getState();
  return s.data ? findPatient(s.data, s.ui.focusPatientId) : undefined;
}

export function callInProgress(): boolean {
  return Boolean(useDemo.getState().data?.phone.activeCallId);
}

export function advanceTo(target: number, kind: "step" | "jump") {
  const s = useDemo.getState();
  if (!s.data || target <= s.now || s.data.phone.activeCallId) return;
  const data = structuredClone(s.data);
  advanceClock(data, s.now, target, {
    focusPatientId: s.ui.focusPatientId,
    ringAtTarget: kind === "step",
    quietBackground: kind === "jump" || target - s.now > 6 * HOUR,
  });
  useDemo.setState({ data, now: target });
}

/** The next moment a call goes out to the patient on screen (today or a later day). */
export function nextCallTimeFor(data: DemoData, p: Patient, now: number): number | undefined {
  const ringing = data.calls.find((c) => c.id === data.phone.ringingCallId && c.patientId === p.id);
  if (ringing && ringing.ctx.attempt < 3) return ringing.ctx.startedAt + 10 * MIN;
  const queued = data.queue.filter((q) => q.patientId === p.id && q.at > now).sort((a, b) => a.at - b.at)[0];
  if (queued) return queued.at;
  if (noCallsReason(p, now) && noCallsReason(p, now) !== "notStarted") return undefined;
  for (let i = 1; i <= 3; i++) {
    const date = addDays(localDate(now), i);
    const slots = plannedSlots(p, date);
    if (slots.length) return atLocal(date, callTimeFor(p, slots[0]));
  }
  return undefined;
}

export function nextDoseTime(): "rang" | "moved" | "none" {
  const s = useDemo.getState();
  if (!s.data) return "none";
  const p = focusPatient();
  let target = p ? nextCallTimeFor(s.data, p, s.now) : undefined;
  if (target == null) {
    const any = s.data.queue.filter((q) => q.at > s.now).sort((a, b) => a.at - b.at)[0];
    target = any?.at;
  }
  if (target == null) return "none";
  advanceTo(target, "step");
  return useDemo.getState().data?.phone.ringingCallId ? "rang" : "moved";
}

export function endOfDay() {
  const now = getNow();
  const today = localDate(now);
  const target = now >= endOfLocalDay(today) ? endOfLocalDay(addDays(today, 1)) : endOfLocalDay(today);
  advanceTo(target, "jump");
}

export function nextDay() {
  const now = getNow();
  advanceTo(atLocal(addDays(localDate(now), 1), "07:00"), "jump");
}

/** Morning of day N of the focus patient's package. */
export function dayTarget(n: number): number | undefined {
  const p = focusPatient();
  if (!p) return undefined;
  return atLocal(addDays(p.pkg.startDate, n - 1), "07:00");
}

export function jumpToDay(n: number) {
  const target = dayTarget(n);
  if (target != null) advanceTo(target, "jump");
}

/* ------------------------------------------------------------------ phone */

function liveCall(data: DemoData, which: "ringing" | "active") {
  const id = which === "ringing" ? data.phone.ringingCallId : data.phone.activeCallId;
  return data.calls.find((c) => c.id === id);
}

export function answerCall() {
  mutate((data, now) => {
    const call = liveCall(data, "ringing");
    if (!call) return;
    applyInput(data, call, { type: "answer" }, now, { verbose: true });
    data.phone.activeCallId = call.id;
  });
}

export function declineCall() {
  mutate((data, now) => {
    const call = liveCall(data, "ringing");
    if (call) applyInput(data, call, { type: "noAnswer" }, now, { verbose: true });
  });
}

export function sendReply(input: CallInput) {
  mutate((data, now) => {
    const call = liveCall(data, "active");
    if (call) applyInput(data, call, input, now, { verbose: true });
  });
}

export function hangUp() {
  mutate((data, now) => {
    const call = liveCall(data, "active");
    if (call) applyInput(data, call, { type: "hangUp" }, now, { verbose: true });
    data.phone.activeCallId = undefined;
  });
}

/* ------------------------------------------------------------------ ui helpers */

export function setFocusPatient(id: string) {
  const data = getData();
  setUi((ui) => {
    const fam = data.family.find((f) => f.id === ui.actingAs.family);
    const nextFamily = fam?.patientId === id ? ui.actingAs.family : data.family.find((f) => f.patientId === id && f.primary)?.id ?? ui.actingAs.family;
    const doctor = data.patients.find((p) => p.id === id)?.doctorId ?? ui.actingAs.doctor;
    return { focusPatientId: id, actingAs: { ...ui.actingAs, patient: id, family: nextFamily, doctor } };
  });
}

export function setActingAs(role: keyof UiState["actingAs"], id: string) {
  const data = getData();
  setUi((ui) => ({ actingAs: { ...ui.actingAs, [role]: id } }));
  if (role === "patient") setFocusPatient(id);
  if (role === "family") {
    const f = data.family.find((x) => x.id === id);
    if (f) setUi((ui) => ({ focusPatientId: f.patientId, actingAs: { ...ui.actingAs, patient: f.patientId } }));
  }
}

/** Smartphone app: the patient confirms a dose after a read-back style check. */
export function confirmTakenInApp(patientId: string, date: string, slot: Slot) {
  mutate((data, now) => {
    data.log.push({ id: nextId(data, "l"), kind: "doseTaken", patientId, at: now, source: "app", date, slot, takenAt: now, confirmation: "appTap" });
    data.queue = data.queue.filter((q) => !(q.patientId === patientId && q.date === date && q.slot === slot));
    emit(data, now, "event.appTaken", { patient: { $person: patientId }, slot: { $t: `slotWord.${slot}` } }, ["patient", "family", "nurse", "doctor", "admin"], "ok", patientId);
    emit(data, now, "event.logWritten", { patient: { $person: patientId }, slot: { $t: `slotWord.${slot}` } }, ["family", "nurse", "doctor", "admin"], "ok", patientId);
  });
}
