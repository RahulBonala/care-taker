"use client";

/**
 * Actions taken from role screens (family, nurse, caregiver, doctor, desk,
 * admin). Each goes through `mutate`, so every pane updates at once.
 */
import type { DemoData } from "@/domain/data";
import { findPatient, nextId } from "@/domain/data";
import { endDateFor, MONTH_DAYS, priceOf } from "@/domain/packages";
import { currentPrescription } from "@/domain/schedule";
import { defaultPattern, planVisits } from "@/domain/visits";
import type { CarePlan, FamilyMember, Lang, LocalText, Medicine, PackageKind, PackageLength, Patient, Slot } from "@/domain/types";
import type { HHMM } from "@/lib/time";
import { addDays, localDate } from "@/lib/time";
import { cancelCalls, ensureDayCalls } from "@/sim/day";
import { audit, emit, messageFamily, openFlag } from "@/sim/emit";
import { checkIn, completeVisit, missVisit, type VisitRecordInput } from "@/sim/visits";
import { closeFlag, startFlagCall, type CloseFlagInput } from "@/sim/nurse";
import { mutate } from "./actions";
import { setUi, useDemo } from "./store";

const who = (id: string) => ({ $person: id });

function requeueToday(data: DemoData, p: Patient, now: number) {
  const today = localDate(now);
  data.queue = data.queue.filter((q) => !(q.patientId === p.id && q.date === today && q.reason === "scheduled" && q.at > now));
  ensureDayCalls(data, p, today, now);
}

/* ------------------------------------------------------------------ family */

export function familySignIn(familyId: string) {
  setUi((ui) => ({ familySignedIn: { ...ui.familySignedIn, [familyId]: true } }));
  mutate((data, now) => {
    const f = data.family.find((x) => x.id === familyId);
    audit(data, now, familyId, "family", "signedIn", familyId, "audit.signedIn", {}, f?.patientId);
  });
}

export function familySignOut(familyId: string) {
  setUi((ui) => ({ familySignedIn: { ...ui.familySignedIn, [familyId]: false } }));
}

export function saveTimes(patientId: string, byId: string, byRole: "family" | "nurse", meals: Record<Slot, HHMM>, calls: Partial<Record<Slot, HHMM>>) {
  mutate((data, now) => {
    const p = findPatient(data, patientId);
    if (!p) return;
    p.mealTimes = meals;
    p.callTimes = calls;
    requeueToday(data, p, now);
    emit(data, now, "event.timesChanged", { patient: who(p.id) }, ["patient", "family", "nurse", "admin"], "info", p.id);
    audit(data, now, byId, byRole, "changed", p.id, "audit.settingsChanged", { patient: who(p.id) }, p.id);
  });
}

export function updateFamilyMember(familyId: string, patch: Partial<Pick<FamilyMember, "timeZone" | "reportLanguage">>) {
  mutate((data, now) => {
    const f = data.family.find((x) => x.id === familyId);
    if (!f) return;
    Object.assign(f, patch);
    audit(data, now, familyId, "family", "changed", familyId, "audit.settingsChanged", { patient: who(f.patientId) }, f.patientId);
  });
}

export function addFamilyMember(byId: string, member: Omit<FamilyMember, "id" | "primary">) {
  mutate((data, now) => {
    const id = nextId(data, "f_");
    data.family.push({ ...member, id, primary: false });
    emit(data, now, "event.familyAdded", { person: who(id), patient: who(member.patientId) }, ["family", "nurse", "admin"], "info", member.patientId);
    audit(data, now, byId, "family", "created", id, "audit.familyAdded", { patient: who(member.patientId) }, member.patientId);
    data.messages.push({ id: nextId(data, "m"), familyId: id, patientId: member.patientId, at: now, kind: "welcome", params: { patient: who(member.patientId) } });
  });
}

export function requestCallback(familyId: string) {
  mutate((data, now) => {
    const f = data.family.find((x) => x.id === familyId);
    if (!f) return;
    const flag = openFlag(data, now, f.patientId, "familyCallback", { familyId });
    data.callbacks.push({ id: nextId(data, "cb"), familyId, patientId: f.patientId, at: now, flagId: flag.id });
    emit(data, now, "event.callbackRequested", { patient: who(f.patientId) }, ["family", "nurse", "admin"], "info", f.patientId);
    audit(data, now, familyId, "family", "created", flag.id, "audit.callbackRequested", { patient: who(f.patientId) }, f.patientId);
  });
}

export type PaymentPurpose = "new" | "renewal" | "monthly" | "extension";

/** Mock payment. Succeeds or fails according to Admin → Demo. Returns the outcome. */
export function pay(patientId: string, familyId: string, kind: PackageKind, lengthDays: number, purpose: PaymentPurpose, method: "upi" | "card"): "success" | "failed" {
  const outcome = useDemo.getState().data?.settings.paymentOutcome === "fail" ? "failed" : "success";
  mutate((data, now) => {
    const p = findPatient(data, patientId);
    if (!p) return;
    const amount = priceOf(data.packages, kind, lengthDays);
    data.payments.push({ id: nextId(data, "pay"), patientId, familyId, kind, lengthDays, amount, at: now, status: outcome, method, purpose });
    if (outcome === "failed") {
      openFlag(data, now, patientId, "paymentFailed", { familyId });
      emit(data, now, "event.paymentFailed", { amount: { $money: amount }, patient: who(patientId) }, ["family", "admin"], "danger", patientId);
      audit(data, now, familyId, "family", "paid", patientId, "audit.paymentFailed", { patient: who(patientId) }, patientId);
      return;
    }
    const today = localDate(now);
    if (purpose === "new") {
      p.pkg.paid = true;
    } else if (purpose === "monthly") {
      p.pkg = { kind: "monthly", lengthDays: MONTH_DAYS, startDate: today, endDate: endDateFor(today, MONTH_DAYS), status: "active", paid: true, monthNo: 1 };
      p.carePlan = { ...p.carePlan, pattern: "none" };
      data.visits = data.visits.filter((v) => !(v.patientId === p.id && v.status === "scheduled"));
      emit(data, now, "event.movedMonthly", { patient: who(p.id) }, ["family", "nurse", "doctor", "admin"], "ok", p.id);
    } else if (p.pkg.status === "expired") {
      p.pkg = { kind, lengthDays, startDate: today, endDate: endDateFor(today, lengthDays), status: "active", paid: true };
      p.carePlan = { ...p.carePlan, pattern: defaultPattern(kind) };
      if (p.carePlan.pattern !== "none") planVisits(data, p);
      emit(data, now, "event.renewed", { patient: who(p.id) }, ["family", "nurse", "doctor", "admin"], "ok", p.id);
    } else {
      // Renewal or extension of an active package: the same plan continues for more days.
      p.pkg = { ...p.pkg, kind, lengthDays: p.pkg.lengthDays + lengthDays, endDate: addDays(p.pkg.endDate, lengthDays), paid: true, renewalOfferedAt: undefined };
      if (purpose === "extension") p.packageRequest = undefined;
      emit(data, now, "event.renewed", { patient: who(p.id) }, ["family", "nurse", "doctor", "admin"], "ok", p.id);
    }
    requeueToday(data, p, now);
    messageFamily(data, now, p.id, "paymentReceipt", { patient: who(p.id), amount: { $money: amount } });
    emit(data, now, "event.paymentOk", { amount: { $money: amount }, patient: who(p.id) }, ["family", "admin"], "ok", p.id);
    audit(data, now, familyId, "family", "paid", p.id, "audit.paid", { amount: { $money: amount }, patient: who(p.id) }, p.id);
  });
  return outcome;
}

export function setPaymentOutcome(v: "success" | "fail") {
  mutate((data) => {
    data.settings.paymentOutcome = v;
  });
}

/* ------------------------------------------------------------------ shared */

export function setReportLanguage(familyId: string, lang: Lang) {
  updateFamilyMember(familyId, { reportLanguage: lang });
}

export function textAsWritten(text: string): LocalText {
  return { en: text };
}

export function currentRx(p: Patient) {
  return currentPrescription(p);
}

export function cancelPatientCalls(data: DemoData, patientId: string) {
  cancelCalls(data, patientId);
}

export type { PackageLength };

/** Family tells the nurse the caregiver did not come. */
export function reportNoShow(visitId: string) {
  mutate((data, now) => {
    const v = data.visits.find((x) => x.id === visitId);
    if (v && v.status === "scheduled") missVisit(data, v, now);
  });
}

/* ------------------------------------------------------------------ nurse */

export function viewed(byId: string, role: "nurse" | "doctor" | "admin" | "caregiver", target: string, key: "audit.viewedPatient" | "audit.viewedFlag" | "audit.viewedReport", patientId: string, params: Record<string, import("@/domain/types").Param> = {}) {
  mutate((data, now) => {
    const last = data.audit[data.audit.length - 1];
    if (last && last.actorId === byId && last.target === target && last.key === key && now - last.at < 60 * 60_000) return;
    audit(data, now, byId, role, "viewed", target, key, { patient: who(patientId), ...params }, patientId);
  });
}

/** Save the medicines typed in from the discharge summary (a draft until a nurse verifies it). */
export function saveMedicines(patientId: string, nurseId: string, medicines: Medicine[]) {
  mutate((data, now) => {
    const p = findPatient(data, patientId);
    if (!p) return;
    const cur = currentPrescription(p);
    if (cur && cur.status !== "verified") {
      cur.medicines = medicines;
      cur.status = "entered";
      cur.enteredBy = nurseId;
      cur.enteredAt = now;
    } else {
      p.prescriptions.push({ id: nextId(data, "rx"), medicines, status: "entered", enteredBy: nurseId, enteredAt: now, replaces: cur?.id });
      if (cur) {
        cancelCalls(data, p.id);
        emit(data, now, "event.rxChanged", { patient: who(p.id) }, ["nurse", "doctor", "admin", "family"], "warn", p.id);
      }
    }
    emit(data, now, "event.rxEntered", { patient: who(p.id), person: who(nurseId) }, ["nurse", "admin"], "info", p.id);
    audit(data, now, nurseId, "nurse", cur?.status === "verified" ? "changed" : "created", p.id, cur?.status === "verified" ? "audit.rxChanged" : "audit.rxEntered", { patient: who(p.id) }, p.id);
  });
}

/** Start a new version from the verified one (calls pause until it is verified again). */
export function editVerifiedPrescription(patientId: string, nurseId: string) {
  const p = useDemo.getState().data?.patients.find((x) => x.id === patientId);
  const cur = p ? currentPrescription(p) : undefined;
  if (cur) saveMedicines(patientId, nurseId, structuredClone(cur.medicines));
}

export function verifyPrescription(patientId: string, nurseId: string) {
  mutate((data, now) => {
    const p = findPatient(data, patientId);
    const cur = p && currentPrescription(p);
    if (!p || !cur || cur.status === "verified") return;
    cur.status = "verified";
    cur.verifiedBy = nurseId;
    cur.verifiedAt = now;
    // Calls start from the first verification; later versions keep the history as it was.
    p.callsFrom = p.callsFrom ?? now;
    const before = data.queue.length;
    ensureDayCalls(data, p, localDate(now), now);
    if (p.carePlan.pattern !== "none" && !data.visits.some((v) => v.patientId === p.id)) planVisits(data, p);
    emit(data, now, "event.rxVerified", { patient: who(p.id), person: who(nurseId) }, ["patient", "family", "nurse", "doctor", "desk", "admin"], "ok", p.id);
    emit(data, now, "event.callsScheduled", { patient: who(p.id), count: data.queue.length - before }, ["patient", "family", "nurse", "admin"], "info", p.id);
    audit(data, now, nurseId, "nurse", "verified", cur.id, "audit.rxVerified", { patient: who(p.id) }, p.id);
  });
}

export function saveCarePlan(patientId: string, nurseId: string, plan: CarePlan) {
  mutate((data, now) => {
    const p = findPatient(data, patientId);
    if (!p) return;
    p.carePlan = plan;
    if (plan.pattern === "none") data.visits = data.visits.filter((v) => !(v.patientId === p.id && v.status === "scheduled"));
    else {
      planVisits(data, p);
      for (const v of data.visits) if (v.patientId === p.id && v.status === "scheduled") v.tasks = [...plan.tasks];
    }
    emit(data, now, "event.carePlanSaved", { patient: who(p.id) }, ["nurse", "caregiver", "family", "admin"], "info", p.id);
    audit(data, now, nurseId, "nurse", "changed", p.id, "audit.carePlanChanged", { patient: who(p.id) }, p.id);
  });
}

export function assignCaregiver(visitId: string, caregiverId: string, nurseId: string) {
  mutate((data, now) => {
    const v = data.visits.find((x) => x.id === visitId);
    if (!v) return;
    v.caregiverId = caregiverId;
    emit(data, now, "event.caregiverAssigned", { person: who(caregiverId), patient: who(v.patientId), date: { $date: v.date } }, ["nurse", "caregiver", "family", "admin"], "info", v.patientId);
    audit(data, now, nurseId, "nurse", "changed", v.id, "audit.caregiverAssigned", { patient: who(v.patientId) }, v.patientId);
  });
}

export function addNurseNote(patientId: string, nurseId: string, text: string) {
  mutate((data, now) => {
    data.log.push({ id: nextId(data, "l"), kind: "nurseNote", patientId, at: now, source: "nurse", by: nurseId, text: { en: text } });
    emit(data, now, "event.noteAdded", { person: who(nurseId), patient: who(patientId) }, ["nurse", "doctor", "admin"], "info", patientId);
    audit(data, now, nurseId, "nurse", "created", patientId, "audit.noteAdded", { patient: who(patientId) }, patientId);
  });
}

/** A correction is a new entry that replaces the old one; the old entry stays in the log. */
export function correctDose(entryId: string, nurseId: string, to: "taken" | "missed", note: string) {
  mutate((data, now) => {
    const old = data.log.find((e) => e.id === entryId);
    if (!old || !("slot" in old) || !("date" in old)) return;
    const base = { id: nextId(data, "l"), patientId: old.patientId, at: now, source: "nurse" as const, by: nurseId, date: old.date, slot: old.slot, replaces: old.id };
    if (to === "taken") data.log.push({ ...base, kind: "doseTaken", takenAt: now, confirmation: "nurseCall" });
    else data.log.push({ ...base, kind: "doseMissed", confirmation: "systemEndOfDay" });
    if (note.trim()) data.log.push({ id: nextId(data, "l"), kind: "nurseNote", patientId: old.patientId, at: now, source: "nurse", by: nurseId, text: { en: note.trim() } });
    emit(data, now, "event.noteAdded", { person: who(nurseId), patient: who(old.patientId) }, ["nurse", "doctor", "family", "admin"], "info", old.patientId);
    audit(data, now, nurseId, "nurse", "changed", old.id, "audit.rxChanged", { patient: who(old.patientId) }, old.patientId);
  });
}

export function nurseStartCall(flagId: string, nurseId: string) {
  mutate((data, now) => {
    const f = data.flags.find((x) => x.id === flagId);
    if (f && f.status === "open") startFlagCall(data, f, now, nurseId);
  });
}

export function nurseCloseFlag(flagId: string, byId: string, input: CloseFlagInput) {
  mutate((data, now) => {
    const f = data.flags.find((x) => x.id === flagId);
    if (f && f.status !== "closed") closeFlag(data, f, now, byId, input);
  });
}

export function setConsent(patientId: string, byId: string, byRole: "nurse" | "desk" | "admin", calls: boolean) {
  mutate((data, now) => {
    const p = findPatient(data, patientId);
    if (!p) return;
    if (!calls) {
      p.consent = { ...p.consent, calls: false, withdrawnAt: now, withdrawnBy: byId };
      cancelCalls(data, p.id);
      emit(data, now, "event.consentWithdrawn", { patient: who(p.id) }, ["patient", "family", "nurse", "doctor", "desk", "admin"], "danger", p.id);
      messageFamily(data, now, p.id, "consentWithdrawn", { patient: who(p.id) });
      audit(data, now, byId, byRole, "withdrawn", p.id, "audit.consentWithdrawn", { patient: who(p.id) }, p.id);
    } else {
      p.consent = { ...p.consent, calls: true, withdrawnAt: undefined, withdrawnBy: undefined, recordedAt: now, recordedBy: byId };
      ensureDayCalls(data, p, localDate(now), now);
      emit(data, now, "event.consentGiven", { patient: who(p.id) }, ["patient", "family", "nurse", "doctor", "desk", "admin"], "ok", p.id);
      audit(data, now, byId, byRole, "created", p.id, "audit.consentRecorded", { patient: who(p.id) }, p.id);
    }
  });
}

export function markVisitMissed(visitId: string) {
  reportNoShow(visitId);
}

/* ------------------------------------------------------------------ caregiver */

export function caregiverCheckIn(visitId: string) {
  mutate((data, now) => {
    const v = data.visits.find((x) => x.id === visitId);
    if (!v || v.status !== "scheduled") return;
    checkIn(data, v, now);
    audit(data, now, v.caregiverId ?? "", "caregiver", "changed", v.id, "audit.visitRecorded", { patient: who(v.patientId) }, v.patientId);
  });
}

export function caregiverCheckOut(visitId: string, input: VisitRecordInput) {
  mutate((data, now) => {
    const v = data.visits.find((x) => x.id === visitId);
    if (!v || v.status !== "checkedIn") return;
    completeVisit(data, v, now, input);
    audit(data, now, v.caregiverId ?? "", "caregiver", "created", v.id, "audit.vitalsRecorded", { patient: who(v.patientId) }, v.patientId);
  });
}

export function caregiverReportUnwell(patientId: string, caregiverId: string, visitId?: string) {
  mutate((data, now) => {
    openFlag(data, now, patientId, "caregiverUnwell", { visitId });
    emit(data, now, "event.caregiverUnwell", { patient: who(patientId) }, ["caregiver", "nurse", "family", "admin"], "danger", patientId);
    audit(data, now, caregiverId, "caregiver", "created", patientId, "audit.noteAdded", { patient: who(patientId) }, patientId);
  });
}
