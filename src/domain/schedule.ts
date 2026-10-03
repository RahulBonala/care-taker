import { addMinutesToHhmm, atLocal, type HHMM, type LocalDate, dateRange, localDate, addDays } from "@/lib/time";
import type { Medicine, Patient, PrescriptionVersion, Slot } from "./types";
import { SLOTS } from "./types";

export const CALL_AFTER_MEAL_MINUTES = 30;

export const DEFAULT_MEAL_TIMES: Record<Slot, HHMM> = {
  breakfast: "08:00",
  lunch: "13:00",
  snack: "17:00",
  dinner: "20:00",
  bedtime: "22:00",
};

export function currentPrescription(p: Patient): PrescriptionVersion | undefined {
  return p.prescriptions[p.prescriptions.length - 1];
}

/** The latest version a nurse has verified (an edit in progress does not hide it). */
export function verifiedPrescription(p: Patient): PrescriptionVersion | undefined {
  for (let i = p.prescriptions.length - 1; i >= 0; i--) if (p.prescriptions[i].status === "verified") return p.prescriptions[i];
  return undefined;
}

/** The newest version is still waiting for a nurse to verify it: no calls go out. */
export function awaitingVerification(p: Patient): boolean {
  return currentPrescription(p)?.status !== "verified";
}

/** Call time for a slot: the override if set, else 30 minutes after the meal (bedtime: at bedtime). */
export function callTimeFor(p: Pick<Patient, "mealTimes" | "callTimes">, slot: Slot): HHMM {
  const override = p.callTimes[slot];
  if (override) return override;
  if (slot === "bedtime") return p.mealTimes.bedtime;
  return addMinutesToHhmm(p.mealTimes[slot], CALL_AFTER_MEAL_MINUTES);
}

export function medicinesFor(meds: Medicine[], date: LocalDate, slot?: Slot): Medicine[] {
  return meds.filter((m) => m.startDate <= date && date <= m.endDate && (!slot || m.slots.includes(slot)));
}

/** Slots with at least one medicine on that date, in the order of the day. */
export function slotsWithMedicines(meds: Medicine[], date: LocalDate): Slot[] {
  const active = medicinesFor(meds, date);
  return SLOTS.filter((s) => active.some((m) => m.slots.includes(s)));
}

export type NoCallsReason = "notVerified" | "noConsent" | "packageEnded" | "notStarted" | null;

/** Why no calls are going out for this patient right now (null when calls are on). */
export function noCallsReason(p: Patient, now: number): NoCallsReason {
  if (!p.consent.calls || p.consent.withdrawnAt) return "noConsent";
  if (awaitingVerification(p)) return "notVerified";
  if (p.pkg.status !== "active") return "packageEnded";
  if (localDate(now) < p.pkg.startDate) return "notStarted";
  return null;
}

/**
 * The dose slots that belong to a patient's plan on a date. Slots before calls
 * started (the verification time on the first day) are not part of the plan.
 */
export function plannedSlots(p: Patient, date: LocalDate): Slot[] {
  const rx = verifiedPrescription(p);
  if (!rx || !p.callsFrom) return [];
  if (date < p.pkg.startDate || date > p.pkg.endDate) return [];
  return slotsWithMedicines(rx.medicines, date).filter((s) => atLocal(date, callTimeFor(p, s)) >= p.callsFrom!);
}

export interface PlannedCall {
  date: LocalDate;
  slot: Slot;
  at: number;
  medicines: Medicine[];
}

/** Call times for the next few days (nurse preview). Uses the current version even before verification. */
export function previewSchedule(p: Patient, fromDate: LocalDate, days: number): PlannedCall[] {
  const rx = currentPrescription(p);
  if (!rx) return [];
  const out: PlannedCall[] = [];
  for (const date of dateRange(fromDate, addDays(fromDate, days - 1))) {
    if (date > p.pkg.endDate) break;
    for (const slot of slotsWithMedicines(rx.medicines, date)) {
      out.push({ date, slot, at: atLocal(date, callTimeFor(p, slot)), medicines: medicinesFor(rx.medicines, date, slot) });
    }
  }
  return out;
}
