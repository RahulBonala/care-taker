"use client";

/**
 * Story mode: the 10-step demo script (prompt section 6). Each step names the
 * role, switches to it, moves the clock if the script says so, and points at
 * the control to press. "Do it for me" performs the step, so the story never
 * dead-ends; Back restores the state from before the previous step.
 */
import { replay } from "@/call-engine/machine";
import type { DemoData } from "@/domain/data";
import { effectiveDoseIndex } from "@/domain/doses";
import { currentPrescription } from "@/domain/schedule";
import type { Role } from "@/domain/types";
import { expectedPillCounts } from "@/domain/visits";
import { addDays, atLocal, localDate } from "@/lib/time";
import { SAMPLE_OUTCOMES } from "@/sim/nurse";
import { sampleMedicinesFor } from "@/sim/seed";
import { advanceTo, answerCall, loadStoryBaseline, nextDoseTime, sendReply, setFocusPatient } from "./actions";
import { LAKSHMI_ENROL } from "./enrolForms";
import {
  caregiverCheckIn,
  caregiverCheckOut,
  enrolPatient,
  nurseCloseFlag,
  nurseStartCall,
  pay,
  saveMedicines,
  setReviewDate,
  setSimSetting,
  verifyPrescription,
} from "./roleActions";
import { setUi, useDemo, type DemoState, type UiState } from "./store";

const L = "p_lakshmi";
export type Navigate = (role: Role, screen?: string) => void;
export interface Where {
  role: Role | null;
  screen: string;
}

interface Step {
  role: Role;
  screen: string;
  split: { role: Role; screen: string } | null;
  enter?: () => void;
  /** Do the step. May return where to look next. */
  ensure: () => { role: Role; screen: string } | void;
  done: (s: DemoState) => boolean;
  spot: (s: DemoState, where: Where) => string | undefined;
}

const data = () => useDemo.getState().data as DemoData;
const lakshmi = (d: DemoData = data()) => d.patients.find((p) => p.id === L);
const today = () => localDate(useDemo.getState().now);

function liveCall(s: DemoState) {
  const d = s.data;
  if (!d) return { ringing: false, phase: undefined as string | undefined };
  const ringing = d.calls.some((c) => c.id === d.phone.ringingCallId && c.patientId === L);
  const active = d.calls.find((c) => c.id === d.phone.activeCallId && c.patientId === L);
  return { ringing, phase: active ? replay(active.inputs, active.ctx).state.phase : undefined };
}

function doseStatus(d: DemoData, date: string, slot: string) {
  return effectiveDoseIndex(d.log).get(`${L}|${date}|${slot}`);
}

/** Answer the ringing call and say these things, in order, for whichever phase the call is in. */
function playCall(replies: Array<"later30" | "taken" | "yes" | "unwell">) {
  const s = useDemo.getState();
  if (!s.data) return;
  if (s.data.phone.ringingCallId) answerCall();
  for (const r of replies) {
    const st = useDemo.getState();
    const active = st.data?.calls.find((c) => c.id === st.data?.phone.activeCallId);
    if (!active) return;
    const phase = replay(active.inputs, active.ctx).state.phase;
    if (r === "yes" && phase !== "confirmTaken") continue;
    if (r !== "yes" && phase !== "awaitingReply") continue;
    sendReply(r === "later30" ? { type: "reply", intent: "later", via: "voice", minutes: 30 } : { type: "reply", intent: r, via: "voice" });
  }
}

const callSpot = (s: DemoState, reply: string) => {
  const c = liveCall(s);
  if (c.ringing) return "patient.answer";
  if (c.phase === "awaitingReply") return reply;
  if (c.phase === "confirmTaken") return "patient.reply.yes";
  return undefined;
};

export const STEPS: Step[] = [
  // 1. Hospital desk enrols Mrs Lakshmi Devi and records consent.
  {
    role: "desk",
    screen: "",
    split: null,
    enter: () => setUi((ui) => ({ actingAs: { ...ui.actingAs, desk: "k_neha" } })),
    ensure: () => {
      if (!lakshmi()) enrolPatient({ ...LAKSHMI_ENROL, consent: { calls: true, shareFamily: true, shareDoctor: true }, fileName: "discharge-summary-lakshmi-devi.pdf" }, "k_neha");
      setFocusPatient(L);
    },
    done: (s) => Boolean(s.data && lakshmi(s.data)),
    spot: (s) => (s.data && lakshmi(s.data) ? undefined : "desk.fill,desk.consent,desk.finish"),
  },
  // 2. Nurse types the prescription and verifies it. The schedule appears.
  {
    role: "nurse",
    screen: "patient",
    split: null,
    enter: () => {
      setFocusPatient(L);
      setUi((ui) => ({ actingAs: { ...ui.actingAs, nurse: "n_mary" }, selection: { ...ui.selection, nursePatientId: L } }));
    },
    ensure: () => {
      const p = lakshmi();
      if (!p) return;
      if (!currentPrescription(p)) saveMedicines(L, "n_mary", sampleMedicinesFor(L, p.pkg.startDate));
      verifyPrescription(L, "n_kavitha");
    },
    done: (s) => currentPrescription(lakshmi(s.data!)!)?.status === "verified",
    spot: (s) => {
      const rx = s.data && lakshmi(s.data) ? currentPrescription(lakshmi(s.data)!) : undefined;
      if (!rx) return "nurse.rx.fill,nurse.rx.save";
      if (rx.status === "entered") return "nurse.rx.verify";
      return undefined;
    },
  },
  // 3. Lunch dose: the keypad phone rings; the patient says "Later, 30 minutes".
  {
    role: "patient",
    screen: "",
    split: { role: "family", screen: "" },
    enter: () => {
      setFocusPatient(L);
      setUi((ui) => ({ familySignedIn: { ...ui.familySignedIn, f_ravi: true }, actingAs: { ...ui.actingAs, family: "f_ravi" } }));
      if (!data().phone.ringingCallId) nextDoseTime();
    },
    ensure: () => playCall(["later30"]),
    done: (s) => Boolean(s.data?.calls.some((c) => c.patientId === L && c.date === localDate(s.now) && c.slot === "lunch" && c.outcome === "postponed")),
    spot: (s) => callSpot(s, "patient.reply.later30"),
  },
  // 4. Thirty minutes later the phone rings again: "Taken", read back, confirmed, logged.
  {
    role: "patient",
    screen: "",
    split: { role: "family", screen: "" },
    enter: () => {
      if (!data().phone.ringingCallId && !doseStatus(data(), today(), "lunch")) nextDoseTime();
    },
    ensure: () => playCall(["taken", "yes"]),
    done: (s) => Boolean(s.data && doseStatus(s.data, localDate(s.now), "lunch")?.kind === "doseTaken"),
    spot: (s) => callSpot(s, "patient.reply.taken"),
  },
  // 5. Family: the son abroad sees the update in his own time zone, opens the 8 pm report, taps a line.
  {
    role: "family",
    screen: "",
    split: null,
    enter: () => {
      setUi((ui) => ({ actingAs: { ...ui.actingAs, family: "f_ravi" }, familySignedIn: { ...ui.familySignedIn, f_ravi: true }, selection: { ...ui.selection, reportId: undefined } }));
      const target = atLocal(today(), "20:05");
      if (useDemo.getState().now < target) advanceTo(target, "jump");
    },
    ensure: () => ({ role: "family", screen: "report" }),
    done: () => true,
    spot: (_s, where) => (where.role === "family" && where.screen === "report" ? "family.report.line" : "family.openReport"),
  },
  // 6. Next morning the patient says "Not feeling well". The nurse calls and records the outcome.
  {
    role: "patient",
    screen: "",
    split: { role: "nurse", screen: "flags" },
    enter: () => {
      setUi((ui) => ({ actingAs: { ...ui.actingAs, nurse: "n_mary" } }));
      if (!data().phone.ringingCallId) nextDoseTime();
    },
    ensure: () => {
      playCall(["unwell"]);
      const f = data().flags.find((x) => x.patientId === L && x.type === "unwell" && x.status !== "closed");
      if (f) {
        if (f.status === "open") nurseStartCall(f.id, "n_mary");
        nurseCloseFlag(f.id, "n_mary", { outcome: SAMPLE_OUTCOMES.unwell!, spoke: true });
      }
      setUi({ split: { on: true, right: { role: "family", screen: "" } } });
    },
    done: (s) => Boolean(s.data?.flags.some((f) => f.patientId === L && f.type === "unwell" && f.status === "closed")),
    spot: (s) => {
      const c = callSpot(s, "patient.reply.unwell");
      if (c) return c;
      const f = s.data?.flags.find((x) => x.patientId === L && x.type === "unwell" && x.status !== "closed");
      if (!f) return undefined;
      const right = s.ui.split.right;
      if (right.role === "nurse" && right.screen === "flag") return f.status === "open" ? "nurse.flag.call" : "nurse.flag.note,nurse.flag.close";
      return "nurse.flag.urgent";
    },
  },
  // 7. Caregiver visit: check in, vitals, pill count matches, doses become caregiver-confirmed.
  {
    role: "caregiver",
    screen: "visit",
    split: null,
    enter: () => {
      const d = data();
      const v = d.visits.find((x) => x.patientId === L && x.date === today() && x.status !== "missed");
      if (!v) return;
      setUi((ui) => ({ actingAs: { ...ui.actingAs, caregiver: v.caregiverId ?? "c_suresh" }, selection: { ...ui.selection, visitId: v.id } }));
      const target = atLocal(v.date, v.windowStart);
      if (useDemo.getState().now < target) advanceTo(target, "jump");
    },
    ensure: () => {
      const vid = useDemo.getState().ui.selection.visitId;
      const v = data().visits.find((x) => x.id === vid);
      if (!v) return;
      if (v.status === "scheduled") caregiverCheckIn(v.id);
      const d = data();
      const p = lakshmi(d)!;
      const counts = expectedPillCounts(d, p, useDemo.getState().now).map((c) => ({ ...c, counted: c.expected }));
      caregiverCheckOut(v.id, { vitals: { bpSys: 132, bpDia: 84, pulse: 78, tempC: 36.8, spo2: 97 }, counts, tasksDone: [...v.tasks] });
    },
    done: (s) => Boolean(s.data?.visits.some((v) => v.id === s.ui.selection.visitId && v.status === "completed")),
    spot: (s) => {
      const v = s.data?.visits.find((x) => x.id === s.ui.selection.visitId);
      if (!v) return undefined;
      if (v.status === "scheduled") return "caregiver.checkIn";
      if (v.status === "checkedIn") return "caregiver.fillCounts,caregiver.checkOut";
      return undefined;
    },
  },
  // 8. Doctor searches the patient, sees adherence and vitals, sets the review date.
  {
    role: "doctor",
    screen: "",
    split: null,
    enter: () => setUi((ui) => ({ actingAs: { ...ui.actingAs, doctor: "d_anjali" } })),
    ensure: () => {
      setUi((ui) => ({ selection: { ...ui.selection, doctorPatientId: L } }));
      setReviewDate(L, "d_anjali", addDays(today(), 7));
      return { role: "doctor", screen: "patient" };
    },
    done: (s) => Boolean(s.data && lakshmi(s.data)?.nextReviewDate),
    spot: (_s, where) => (where.screen === "patient" ? "doctor.review" : "doctor.search"),
  },
  // 9. Day 14: the family is offered renewal or the monthly plan, and pays (mock).
  {
    role: "family",
    screen: "package",
    split: null,
    enter: () => {
      setFocusPatient(L);
      setSimSetting("paymentOutcome", "success");
      const p = lakshmi();
      if (!p) return;
      const target = atLocal(p.pkg.endDate, "09:00");
      if (useDemo.getState().now < target) advanceTo(target, "jump");
    },
    ensure: () => {
      pay(L, "f_ravi", "callVisit", 14, "renewal", "upi");
    },
    done: (s) => Boolean(s.data?.payments.some((x) => x.patientId === L && x.status === "success" && (x.purpose === "renewal" || x.purpose === "monthly"))),
    spot: () => "family.renew,family.monthly,family.pay",
  },
  // 10. Admin: overview numbers and the audit trail for everything just shown.
  {
    role: "admin",
    screen: "",
    split: null,
    ensure: () => ({ role: "admin", screen: "audit" }),
    done: () => true,
    spot: (_s, where) => (where.screen === "audit" ? undefined : "nav.admin.audit"),
  },
];

/* ------------------------------------------------------------------ engine */

interface Snapshot {
  data: DemoData;
  now: number;
  ui: UiState;
}
const snapshots = new Map<number, Snapshot>();

function enterStep(i: number, navigate: Navigate) {
  const st = useDemo.getState();
  if (st.data) snapshots.set(i, { data: structuredClone(st.data), now: st.now, ui: structuredClone(st.ui) });
  const step = STEPS[i];
  useDemo.setState((s) => ({ story: { active: true, step: i }, ui: { ...s.ui, split: step.split ? { on: true, right: step.split } : { ...s.ui.split, on: false } } }));
  step.enter?.();
  navigate(step.role, step.screen);
}

export function startStory(navigate: Navigate) {
  snapshots.clear();
  loadStoryBaseline();
  enterStep(0, navigate);
}

export function exitStory() {
  useDemo.setState((s) => ({ story: { ...s.story, active: false }, ui: { ...s.ui, highlight: undefined } }));
}

export function storyNext(navigate: Navigate) {
  const { story } = useDemo.getState();
  const step = STEPS[story.step];
  if (!step.done(useDemo.getState())) step.ensure();
  if (story.step >= STEPS.length - 1) {
    exitStory();
    return;
  }
  enterStep(story.step + 1, navigate);
}

export function storyBack(navigate: Navigate) {
  const { story } = useDemo.getState();
  if (story.step === 0) return;
  const prev = story.step - 1;
  const snap = snapshots.get(prev);
  if (snap) useDemo.setState({ data: structuredClone(snap.data), now: snap.now, ui: structuredClone(snap.ui) });
  enterStep(prev, navigate);
}

export function storyDoIt(navigate: Navigate) {
  const { story } = useDemo.getState();
  const target = STEPS[story.step].ensure();
  if (target) navigate(target.role, target.screen);
}

/** Recompute which control to highlight; called whenever state or route changes. */
export function storySpot(s: DemoState, where: Where): string | undefined {
  if (!s.story.active) return undefined;
  return STEPS[s.story.step]?.spot(s, where);
}
