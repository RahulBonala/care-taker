/**
 * Moving the demo clock. Everything that would happen between two moments is
 * processed in time order: calls become due, patients answer (scripted for
 * calls the clock jumps past), caregivers visit, the 8 pm report goes out, and
 * at 11:59 pm doses still due are marked missed.
 */
import type { DemoData } from "@/domain/data";
import { findPatient } from "@/domain/data";
import { noCallsReason } from "@/domain/schedule";
import type { CallInput, Flag } from "@/domain/types";
import { pick } from "@/lib/hash";
import { atLocal, dateRange, endOfLocalDay, localDate, MIN, startOfLocalDay } from "@/lib/time";
import { backgroundScript, SCRIPTS } from "./behaviour";
import { applyInput, placeCall, runScriptedCall } from "./calls";
import { closeDay, dayStart, eveningReports } from "./day";
import { emit } from "./emit";
import { autoVisit, missVisit } from "./visits";
import { nurseHandles } from "./nurse";

export interface AdvanceOptions {
  focusPatientId?: string;
  /** Ring the on-screen patient's call that falls exactly on the new time, and wait for you. */
  ringAtTarget: boolean;
  /** Only list background patients' calls in the feed for short moves. */
  quietBackground: boolean;
  /** Seed only: scripted answers for particular doses, keyed "patient|date|slot|n". */
  forced?: Record<string, CallInput[]>;
  /** Seed only: pill count mismatch on these visits. */
  forcedMismatch?: Set<string>;
  /** Seed only: flags opened before this moment are handled by the nurse 25 minutes later. */
  autoNurseBefore?: number;
}

export interface AdvanceResult {
  rangCallId?: string;
  backgroundCalls: number;
  backgroundLogged: number;
}

interface Candidate {
  t: number;
  order: number;
  run: () => void;
}

export function advanceClock(data: DemoData, from: number, to: number, opts: AdvanceOptions): AdvanceResult {
  const result: AdvanceResult = { backgroundCalls: 0, backgroundLogged: 0 };
  if (to <= from) return result;
  const focus = opts.focusPatientId;
  const verbose = (pid: string) => pid === focus || !opts.quietBackground;

  // A call left ringing while the clock moves on was not answered.
  if (data.phone.ringingCallId) {
    const call = data.calls.find((c) => c.id === data.phone.ringingCallId);
    data.phone.ringingCallId = undefined;
    if (call && call.status === "ringing") applyInput(data, call, { type: "noAnswer" }, call.ctx.startedAt, { verbose: true });
  }

  const dates = dateRange(localDate(from), localDate(to));
  let guard = 0;
  for (;;) {
    if (++guard > 50_000) throw new Error("advanceClock: too many steps");
    const cands: Candidate[] = [];

    for (const date of dates) {
      const ds = startOfLocalDay(date);
      if (!data.done[`day:${date}`] && ds <= to) cands.push({ t: ds, order: 0, run: () => dayStart(data, date, ds) });
      const rt = atLocal(date, "20:00");
      if (!data.done[`report:${date}`] && rt <= to) cands.push({ t: rt, order: 4, run: () => eveningReports(data, date, rt, focus, verbose) });
      const ct = endOfLocalDay(date);
      if (!data.done[`close:${date}`] && ct <= to) cands.push({ t: ct, order: 5, run: () => closeDay(data, date, ct, verbose) });
    }

    for (const v of data.visits) {
      if (v.status !== "scheduled" || v.date < dates[0] || v.date > dates[dates.length - 1]) continue;
      if (data.settings.autoVisits && !v.noShow) {
        const t = atLocal(v.date, v.windowStart) + pick(`${v.id}|in`, 5, 25) * MIN;
        if (t <= to) cands.push({ t, order: 1, run: () => autoVisit(data, v, t, verbose(v.patientId), opts.forcedMismatch?.has(`${v.patientId}|${v.date}`)) });
      } else {
        const t = atLocal(v.date, v.windowEnd) + 60 * MIN;
        if (t <= to) cands.push({ t, order: 1, run: () => missVisit(data, v, t) });
      }
    }

    let firstQueued: (typeof data.queue)[number] | undefined;
    for (const q of data.queue) if (q.at <= to && (!firstQueued || q.at < firstQueued.at)) firstQueued = q;
    if (firstQueued) {
      const q = firstQueued;
      cands.push({
        t: q.at,
        order: 3,
        run: () => {
          const p = findPatient(data, q.patientId);
          const reason = p ? noCallsReason(p, q.at) : "notVerified";
          if (!p || (reason && reason !== "notStarted")) {
            data.queue = data.queue.filter((x) => x.id !== q.id);
            return;
          }
          if (p.id === focus && opts.ringAtTarget && q.at === to && !data.phone.ringingCallId && !data.phone.activeCallId) {
            const call = placeCall(data, q, q.at, { simulated: false, verbose: true });
            data.phone.ringingCallId = call.id;
            result.rangCallId = call.id;
            return;
          }
          const seq = data.calls.filter((c) => c.patientId === q.patientId && c.date === q.date && c.slot === q.slot).length + 1;
          const forced = opts.forced?.[`${q.patientId}|${q.date}|${q.slot}|${seq}`];
          let script: CallInput[];
          if (forced) script = forced;
          else if (p.id === focus) script = data.settings.skippedFocusCalls === "unanswered" ? SCRIPTS.noAnswer() : SCRIPTS.taken(p, `${q.id}`);
          else script = backgroundScript(data, p, q);
          const loud = verbose(p.id);
          const logBefore = data.log.length;
          runScriptedCall(data, q, q.at, script, loud);
          if (!loud) {
            result.backgroundCalls += 1;
            result.backgroundLogged += data.log.slice(logBefore).filter((e) => e.kind === "doseTaken").length;
          }
        },
      });
    }

    if (opts.autoNurseBefore) {
      for (const f of data.flags) {
        if (f.status === "closed") continue;
        const t = f.openedAt + 25 * MIN;
        if (t <= to && t < opts.autoNurseBefore) cands.push({ t, order: 2, run: () => nurseHandles(data, f as Flag, t) });
      }
    }

    if (!cands.length) break;
    cands.sort((a, b) => a.t - b.t || a.order - b.order);
    cands[0].run();
  }

  if (opts.quietBackground && result.backgroundCalls > 0) {
    emit(data, to, "event.backgroundSummary", { calls: result.backgroundCalls, logged: result.backgroundLogged }, ["nurse", "admin"], "info");
  }
  return result;
}
