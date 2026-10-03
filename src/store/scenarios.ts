"use client";

/**
 * Edge cases (prompt section 7), each one button in Admin → Demo. Every
 * scenario uses the same rules as normal use: it scripts the patient's
 * answers or the caregiver's behaviour and moves the clock, and the engine
 * does the rest.
 */
import type { DemoData } from "@/domain/data";
import { findPatient } from "@/domain/data";
import { callTimeFor, plannedSlots } from "@/domain/schedule";
import type { CallInput, Param, QueuedCall, Role } from "@/domain/types";
import { addDays, atLocal, endOfLocalDay, localDate, MIN } from "@/lib/time";
import { advanceClock } from "@/sim/advance";
import { SCRIPTS } from "@/sim/behaviour";
import { emit } from "@/sim/emit";
import { editVerifiedPrescription, pay, setConsent } from "./roleActions";
import { DEFAULT_UI, setUi, useDemo } from "./store";

export type ScenarioId =
  | "noAnswer3"
  | "postponed3"
  | "unclearKeypad"
  | "wrongPerson"
  | "refuse"
  | "missedEndOfDay"
  | "notVerified"
  | "consentWithdrawn"
  | "reportCheckFails"
  | "pillMismatch"
  | "caregiverNoShow"
  | "paymentFails"
  | "packageExpires"
  | "familyAbroad"
  | "languageSwitch"
  | "offline";

export const SCENARIOS: ScenarioId[] = [
  "noAnswer3",
  "postponed3",
  "unclearKeypad",
  "wrongPerson",
  "refuse",
  "missedEndOfDay",
  "notVerified",
  "consentWithdrawn",
  "reportCheckFails",
  "pillMismatch",
  "caregiverNoShow",
  "paymentFails",
  "packageExpires",
  "familyAbroad",
  "languageSwitch",
  "offline",
];

export interface ScenarioResult {
  ok: boolean;
  key: string;
  params: Record<string, Param>;
  look?: { role: Role; screen: string };
}

const who = (id: string) => ({ $person: id });
const fail = (key: string, params: Record<string, Param> = {}): ScenarioResult => ({ ok: false, key, params });

/** The next call that will go to this patient (queued today, or the first planned slot of a later day). */
function nextCall(data: DemoData, patientId: string, now: number): QueuedCall | undefined {
  const q = data.queue.filter((x) => x.patientId === patientId && x.at > now).sort((a, b) => a.at - b.at)[0];
  if (q) return q;
  const p = findPatient(data, patientId);
  if (!p) return undefined;
  for (let i = 1; i <= 3; i++) {
    const date = addDays(localDate(now), i);
    const slot = plannedSlots(p, date)[0];
    if (slot) return { id: "future", patientId, date, slot, at: atLocal(date, callTimeFor(p, slot)), reason: "scheduled", attempt: 1 };
  }
  return undefined;
}

function seqAt(data: DemoData, q: Pick<QueuedCall, "patientId" | "date" | "slot">): number {
  return data.calls.filter((c) => c.patientId === q.patientId && c.date === q.date && c.slot === q.slot).length + 1;
}

/** Move the clock with scripted answers for one dose. */
function runScripted(name: ScenarioId, patientId: string, scripts: CallInput[][], untilAfterMinutes: number, opts: { untilOverride?: number; mismatch?: Set<string> } = {}): QueuedCall | undefined {
  const s = useDemo.getState();
  if (!s.data || s.data.phone.activeCallId) return undefined;
  const data = structuredClone(s.data);
  const q = nextCall(data, patientId, s.now);
  if (!q) return undefined;
  // Scripts are keyed by the n-th call for this dose; if the clock first has to cross
  // a day boundary the dose is scheduled at that day's start, so keys still match.
  const first = q.id === "future" ? 1 : seqAt(data, q);
  const forced: Record<string, CallInput[]> = {};
  scripts.forEach((sc, i) => (forced[`${q.patientId}|${q.date}|${q.slot}|${first + i}`] = sc));
  const to = opts.untilOverride ?? q.at + untilAfterMinutes * MIN;
  advanceClock(data, s.now, to, { focusPatientId: s.ui.focusPatientId, ringAtTarget: false, quietBackground: true, forced, forcedMismatch: opts.mismatch });
  emit(data, to, "event.scenario", { name: { $t: `admin.demo.scenario.${name}` } }, ["admin"], "info", patientId);
  useDemo.setState({ data, now: to });
  return q;
}

function focusId(): string {
  return useDemo.getState().ui.focusPatientId;
}

export function runScenario(id: ScenarioId): ScenarioResult {
  const s = useDemo.getState();
  if (!s.data) return fail("admin.demo.result.noData");
  if (s.data.phone.activeCallId) return fail("shell.finishCallFirst");
  const pid = focusId();
  const p = findPatient(s.data, pid);

  switch (id) {
    case "noAnswer3": {
      const q = runScripted("noAnswer3", pid, [SCRIPTS.noAnswer(), SCRIPTS.noAnswer(), SCRIPTS.noAnswer()], 21);
      return q ? { ok: true, key: "admin.demo.result.noAnswer3", params: { patient: who(pid) }, look: { role: "nurse", screen: "flags" } } : fail("admin.demo.result.noCall", { patient: who(pid) });
    }
    case "postponed3": {
      const q = runScripted("postponed3", pid, [SCRIPTS.later(30), SCRIPTS.later(30), SCRIPTS.later(30)], 61);
      return q ? { ok: true, key: "admin.demo.result.postponed3", params: { patient: who(pid) }, look: { role: "nurse", screen: "flags" } } : fail("admin.demo.result.noCall", { patient: who(pid) });
    }
    case "unclearKeypad": {
      const q = runScripted("unclearKeypad", pid, [SCRIPTS.unclearAll()], 1);
      return q ? { ok: true, key: "admin.demo.result.unclearKeypad", params: { patient: who(pid) }, look: { role: "nurse", screen: "flags" } } : fail("admin.demo.result.noCall", { patient: who(pid) });
    }
    case "wrongPerson": {
      // Mr Abdul Kareem shares a phone with Mrs Fatima Begum; she answers his call twice.
      const target = "p_abdul";
      if (!findPatient(s.data, target)) return fail("admin.demo.result.noCall", { patient: who(target) });
      const q = runScripted("wrongPerson", target, [SCRIPTS.someoneElse(30), SCRIPTS.someoneElseAgain()], 31);
      return q ? { ok: true, key: "admin.demo.result.wrongPerson", params: { patient: who(target), other: who("p_fatima") }, look: { role: "nurse", screen: "flags" } } : fail("admin.demo.result.noCall", { patient: who(target) });
    }
    case "refuse": {
      const q = runScripted("refuse", pid, [SCRIPTS.refuse()], 1);
      return q ? { ok: true, key: "admin.demo.result.refuse", params: { patient: who(pid) }, look: { role: "nurse", screen: "flags" } } : fail("admin.demo.result.noCall", { patient: who(pid) });
    }
    case "missedEndOfDay": {
      const today = localDate(s.now);
      const end = endOfLocalDay(today);
      const q = runScripted("missedEndOfDay", pid, [SCRIPTS.later(30), SCRIPTS.later(30), SCRIPTS.later(30)], 0, { untilOverride: end });
      return q ? { ok: true, key: "admin.demo.result.missedEndOfDay", params: { patient: who(pid) }, look: { role: "family", screen: "" } } : fail("admin.demo.result.noCall", { patient: who(pid) });
    }
    case "notVerified": {
      if (!p) return fail("admin.demo.result.noPatient");
      editVerifiedPrescription(pid, p.nurseId);
      setUi((ui) => ({ selection: { ...ui.selection, nursePatientId: pid } }));
      return { ok: true, key: "admin.demo.result.notVerified", params: { patient: who(pid) }, look: { role: "nurse", screen: "patient" } };
    }
    case "consentWithdrawn": {
      if (!p) return fail("admin.demo.result.noPatient");
      setConsent(pid, p.nurseId, "nurse", false);
      setUi((ui) => ({ selection: { ...ui.selection, nursePatientId: pid } }));
      return { ok: true, key: "admin.demo.result.consentWithdrawn", params: { patient: who(pid) }, look: { role: "patient", screen: "" } };
    }
    case "reportCheckFails": {
      const data = structuredClone(s.data);
      data.settings.breakNextReport = true;
      const today = localDate(s.now);
      let to = atLocal(today, "20:00");
      if (to <= s.now || data.done[`report:${today}`]) to = atLocal(addDays(today, 1), "20:00");
      advanceClock(data, s.now, to, { focusPatientId: pid, ringAtTarget: false, quietBackground: true });
      useDemo.setState({ data, now: to });
      return { ok: true, key: "admin.demo.result.reportCheckFails", params: { patient: who(pid) }, look: { role: "admin", screen: "" } };
    }
    case "pillMismatch":
    case "caregiverNoShow": {
      const today = localDate(s.now);
      const visits = s.data.visits.filter((v) => v.status === "scheduled" && v.date >= today && atLocal(v.date, v.windowStart) > s.now).sort((a, b) => (a.date + a.windowStart).localeCompare(b.date + b.windowStart));
      const v = visits.find((x) => x.patientId === pid && (id === "caregiverNoShow" || x.tasks.includes("pillCount"))) ?? visits.find((x) => id === "caregiverNoShow" || x.tasks.includes("pillCount"));
      if (!v) return fail("admin.demo.result.noVisit");
      const data = structuredClone(s.data);
      const dv = data.visits.find((x) => x.id === v.id)!;
      let to: number;
      if (id === "caregiverNoShow") {
        dv.noShow = true;
        to = atLocal(v.date, v.windowEnd) + 61 * MIN;
      } else {
        to = atLocal(v.date, v.windowStart) + 70 * MIN;
      }
      advanceClock(data, s.now, to, { focusPatientId: pid, ringAtTarget: false, quietBackground: true, forcedMismatch: id === "pillMismatch" ? new Set([`${v.patientId}|${v.date}`]) : undefined });
      useDemo.setState({ data, now: to });
      return { ok: true, key: id === "pillMismatch" ? "admin.demo.result.pillMismatch" : "admin.demo.result.caregiverNoShow", params: { patient: who(v.patientId) }, look: id === "pillMismatch" ? { role: "nurse", screen: "flags" } : { role: "family", screen: "visits" } };
    }
    case "paymentFails": {
      if (!p) return fail("admin.demo.result.noPatient");
      const fam = s.data.family.find((f) => f.patientId === pid && f.primary);
      useDemo.setState((st) => ({ data: st.data ? { ...st.data, settings: { ...st.data.settings, paymentOutcome: "fail" } } : st.data }));
      pay(pid, fam?.id ?? "", p.pkg.kind === "monthly" ? "call" : p.pkg.kind, 14, "renewal", "upi");
      return { ok: true, key: "admin.demo.result.paymentFails", params: { patient: who(pid) }, look: { role: "family", screen: "package" } };
    }
    case "packageExpires": {
      if (!p) return fail("admin.demo.result.noPatient");
      const to = atLocal(addDays(p.pkg.endDate, 1), "08:00");
      if (to <= s.now) return fail("admin.demo.result.alreadyEnded", { patient: who(pid) });
      const data = structuredClone(s.data);
      advanceClock(data, s.now, to, { focusPatientId: pid, ringAtTarget: false, quietBackground: true });
      useDemo.setState({ data, now: to });
      return { ok: true, key: p.pkg.kind === "monthly" ? "admin.demo.result.monthlyRenews" : "admin.demo.result.packageExpires", params: { patient: who(pid) }, look: { role: "family", screen: "package" } };
    }
    case "familyAbroad": {
      setUi((ui) => ({ focusPatientId: "p_lakshmi", actingAs: { ...ui.actingAs, family: "f_ravi", patient: "p_lakshmi" }, familySignedIn: { ...ui.familySignedIn, f_ravi: true } }));
      return { ok: true, key: "admin.demo.result.familyAbroad", params: { person: who("f_ravi") }, look: { role: "family", screen: "" } };
    }
    case "languageSwitch": {
      const order = ["en", "hi", "te"] as const;
      const next = order[(order.indexOf(s.ui.language) + 1) % order.length];
      setUi({ language: next });
      return { ok: true, key: "admin.demo.result.languageSwitch", params: { language: { $t: `lang.${next}` } } };
    }
    case "offline": {
      const on = !s.ui.demo.offline;
      setUi((ui) => ({ demo: { ...ui.demo, offline: on } }));
      return { ok: true, key: on ? "admin.demo.result.offlineOn" : "admin.demo.result.offlineOff", params: {}, look: on ? { role: "caregiver", screen: "" } : undefined };
    }
  }
}

export function resetUiDemoToggles() {
  setUi({ demo: { ...DEFAULT_UI.demo } });
}
