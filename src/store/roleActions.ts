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
import type { CarePlan, FamilyMember, Honorific, Kin, Lang, LocalText, Medicine, PackageKind, PackageLength, Patient, PhoneType, Relation, Slot } from "@/domain/types";
import type { HHMM } from "@/lib/time";
import { addDays, localDate } from "@/lib/time";
import { cancelCalls, ensureDayCalls } from "@/sim/day";
import { audit, emit, messageFamily, openFlag } from "@/sim/emit";
import { checkIn, completeVisit, missVisit, type VisitRecordInput } from "@/sim/visits";
import { closeFlag, startFlagCall, type CloseFlagInput } from "@/sim/nurse";
import { patientFromSample } from "@/sim/seed";
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

/* ------------------------------------------------------------------ doctor */

export function setReviewDate(patientId: string, doctorId: string, date: string) {
  mutate((data, now) => {
    const p = findPatient(data, patientId);
    if (!p) return;
    p.nextReviewDate = date;
    emit(data, now, "event.reviewSet", { patient: who(p.id), date: { $date: date } }, ["family", "nurse", "doctor", "admin"], "info", p.id);
    audit(data, now, doctorId, "doctor", "changed", p.id, "audit.reviewSet", { patient: who(p.id) }, p.id);
  });
}

export function requestLongerPackage(patientId: string, doctorId: string, lengthDays: PackageLength) {
  mutate((data, now) => {
    const p = findPatient(data, patientId);
    if (!p) return;
    p.packageRequest = { lengthDays, by: doctorId, at: now };
    messageFamily(data, now, p.id, "doctorRequest", { patient: who(p.id), person: who(doctorId), days: lengthDays });
    emit(data, now, "event.packageRequested", { person: who(doctorId), days: lengthDays, patient: who(p.id) }, ["family", "nurse", "doctor", "admin"], "info", p.id);
    audit(data, now, doctorId, "doctor", "created", p.id, "audit.packageRequested", { patient: who(p.id) }, p.id);
  });
}

/* ------------------------------------------------------------------ desk */

export interface EnrolForm {
  sample?: string;
  name: string;
  honorific: Honorific;
  gender: "f" | "m";
  age: number;
  phone: string;
  language: Lang;
  phoneType: PhoneType;
  meals: Record<Slot, HHMM>;
  address: string;
  condition: string;
  doctorId: string;
  familyName: string;
  familyPhone: string;
  relation: Relation;
  kind: PackageKind;
  lengthDays: number;
  payAtDesk: boolean;
  consent: { calls: boolean; shareFamily: boolean; shareDoctor: boolean };
  fileName?: string;
}

export function kinFor(relation: Relation, gender: "f" | "m"): Kin {
  const f = gender === "f";
  switch (relation) {
    case "son":
    case "daughter":
      return f ? "mother" : "father";
    case "sonInLaw":
    case "daughterInLaw":
      return f ? "motherInLaw" : "fatherInLaw";
    case "husband":
      return "wife";
    case "wife":
      return "husband";
    case "brother":
    case "sister":
      return f ? "sister" : "brother";
    case "grandson":
    case "granddaughter":
      return f ? "grandmother" : "grandfather";
    default:
      return f ? "aunt" : "uncle";
  }
}

export function zoneForPhone(phone: string): string {
  const p = phone.replace(/\s/g, "");
  if (p.startsWith("+1")) return "America/New_York";
  if (p.startsWith("+44")) return "Europe/London";
  if (p.startsWith("+971")) return "Asia/Dubai";
  if (p.startsWith("+65")) return "Asia/Singapore";
  if (p.startsWith("+61")) return "Australia/Sydney";
  return "Asia/Kolkata";
}

/** Enrol at discharge. Returns the new patient's id. */
export function enrolPatient(form: EnrolForm, deskId: string): string {
  let newId = "";
  mutate((data, now) => {
    const today = localDate(now);
    const fromSample = form.sample && !data.patients.some((p) => p.id === form.sample) ? patientFromSample(form.sample, today) : undefined;
    const id = fromSample?.patient.id ?? nextId(data, "p_");
    newId = id;
    const caregiver = data.staff.find((s) => s.role === "caregiver" && s.caregiver?.verified);
    const base: Patient = fromSample?.patient ?? {
      id,
      name: { en: form.name.trim() },
      honorific: form.honorific,
      gender: form.gender,
      age: form.age,
      phone: form.phone.trim(),
      language: form.language,
      phoneType: form.phoneType,
      condition: { en: form.condition.trim() },
      hospitalId: data.hospitals[0].id,
      doctorId: form.doctorId,
      nurseId: "n_mary",
      address: { en: form.address.trim() },
      distanceKm: 4.5,
      mealTimes: form.meals,
      callTimes: {},
      enrolledAt: now,
      enrolledBy: deskId,
      consent: { ...form.consent, recordedAt: now, recordedBy: deskId },
      prescriptions: [],
      pkg: { kind: form.kind, lengthDays: form.lengthDays, startDate: today, endDate: endDateFor(today, form.lengthDays), status: "active", paid: false },
      carePlan: { pattern: defaultPattern(form.kind), tasks: ["vitals", "pillCount", "mobility"], visitStart: "11:00", caregiverId: caregiver?.id },
      hue: 25 + (data.patients.length * 53) % 300,
      baseline: { bpSys: 130, bpDia: 82, pulse: 78, tempC: 36.8, spo2: 97 },
    };
    const p: Patient = {
      ...base,
      enrolledAt: now,
      enrolledBy: deskId,
      mealTimes: form.meals,
      doctorId: form.doctorId,
      consent: { ...form.consent, recordedAt: now, recordedBy: deskId },
      pkg: { kind: form.kind, lengthDays: form.kind === "monthly" ? MONTH_DAYS : form.lengthDays, startDate: today, endDate: endDateFor(today, form.kind === "monthly" ? MONTH_DAYS : form.lengthDays), status: "active", paid: form.payAtDesk, monthNo: form.kind === "monthly" ? 1 : undefined },
      carePlan: { ...base.carePlan, pattern: defaultPattern(form.kind) },
      dischargeSummary: form.fileName ? { fileName: form.fileName, uploadedAt: now } : undefined,
    };
    data.patients.push(p);
    const family = fromSample?.family ?? [];
    if (!family.length && form.familyName.trim()) {
      family.push({ id: nextId(data, "f_"), patientId: id, name: { en: form.familyName.trim() }, relation: form.relation, kin: kinFor(form.relation, form.gender), phone: form.familyPhone.trim(), city: { en: "" }, timeZone: zoneForPhone(form.familyPhone), reportLanguage: form.language, primary: true });
    }
    data.family.push(...family);
    const amount = priceOf(data.packages, p.pkg.kind, p.pkg.lengthDays);
    if (form.payAtDesk) data.payments.push({ id: nextId(data, "pay"), patientId: id, familyId: family[0]?.id, kind: p.pkg.kind, lengthDays: p.pkg.lengthDays, amount, at: now, status: "success", method: "desk", purpose: p.pkg.kind === "monthly" ? "monthly" : "new" });
    messageFamily(data, now, id, "welcome", { patient: who(id) });
    emit(data, now, "event.enrolled", { patient: who(id) }, ["desk", "nurse", "family", "admin"], "info", id);
    audit(data, now, deskId, "desk", "created", id, "audit.enrolled", { patient: who(id) }, id);
    audit(data, now, deskId, "desk", "created", id, "audit.consentRecorded", { patient: who(id) }, id);
    if (form.fileName) audit(data, now, deskId, "desk", "created", id, "audit.uploaded", { patient: who(id) }, id);
  });
  return newId;
}

export function setUploadFails(v: boolean) {
  mutate((data) => {
    data.settings.uploadFails = v;
  });
}

export function printedHandout(patientId: string, deskId: string) {
  mutate((data, now) => audit(data, now, deskId, "desk", "created", patientId, "audit.printedHandout", { patient: who(patientId) }, patientId));
}

/* ------------------------------------------------------------------ admin */

export function savePrices(adminId: string, prices: Record<PackageKind, Partial<Record<PackageLength | "month", number>>>) {
  mutate((data, now) => {
    for (const def of data.packages) {
      const next = prices[def.id];
      if (!next) continue;
      for (const [len, value] of Object.entries(next)) {
        const k = len === "month" ? "month" : (Number(len) as PackageLength);
        if (value == null || !Number.isFinite(value) || value <= 0) continue;
        if (def.prices[k] !== value) {
          def.prices[k] = Math.round(value);
          emit(data, now, "event.priceChanged", { package: { $t: `pkg.name.${def.id}` }, length: len === "month" ? { $t: "pkg.perMonth", params: { price: { $money: value } } } : { $t: "pkg.length", params: { days: Number(len) } } }, ["admin", "family"], "info");
          audit(data, now, adminId, "admin", "changed", def.id, "audit.priceChanged", { package: { $t: `pkg.name.${def.id}` } });
        }
      }
    }
  });
}

export function refundPayment(paymentId: string, adminId: string) {
  mutate((data, now) => {
    const pay = data.payments.find((x) => x.id === paymentId);
    if (!pay || pay.status !== "success") return;
    pay.status = "refunded";
    emit(data, now, "event.refunded", { amount: { $money: pay.amount }, patient: who(pay.patientId) }, ["family", "admin"], "info", pay.patientId);
    audit(data, now, adminId, "admin", "refunded", pay.id, "audit.refunded", { amount: { $money: pay.amount }, patient: who(pay.patientId) }, pay.patientId);
  });
}

export function closeAdminFlag(flagId: string, adminId: string, outcome: LocalText) {
  nurseCloseFlag(flagId, adminId, { outcome, spoke: false, role: "admin" });
}

export function setSimSetting<K extends keyof DemoData["settings"]>(key: K, value: DemoData["settings"][K]) {
  mutate((data) => {
    data.settings[key] = value;
  });
}
