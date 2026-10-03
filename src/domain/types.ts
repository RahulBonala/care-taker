import type { HHMM, LocalDate } from "@/lib/time";

export type Lang = "en" | "hi" | "te";
export type Role = "patient" | "family" | "nurse" | "caregiver" | "doctor" | "desk" | "admin";
export type StaffRole = "doctor" | "nurse" | "caregiver" | "desk" | "admin";
export const ROLES: Role[] = ["patient", "family", "nurse", "caregiver", "doctor", "desk", "admin"];

export type Slot = "breakfast" | "lunch" | "snack" | "dinner" | "bedtime";
export const SLOTS: Slot[] = ["breakfast", "lunch", "snack", "dinner", "bedtime"];

/**
 * Text kept in each script. Missing scripts fall back to `en` (data, not UI
 * strings). Notes typed by staff are stored as written, in `en`.
 */
export interface LocalText {
  en: string;
  hi?: string;
  te?: string;
}

export type Honorific = "mrs" | "mr" | "ms" | "dr" | "none";
export type PhoneType = "keypad" | "smartphone";

export interface Hospital {
  id: string;
  name: LocalText;
  city: LocalText;
  phone: string;
}

export interface StaffUser {
  id: string;
  role: StaffRole;
  name: LocalText;
  honorific: Honorific;
  phone: string;
  hospitalId: string;
  speciality?: LocalText;
  caregiver?: {
    verified: boolean;
    trainings: TrainingKey[];
    area: LocalText;
    visitsThisMonth: number;
    earningsThisMonth: number;
  };
}

export type TrainingKey = "vitals" | "pillCount" | "woundCare" | "mobility" | "privacy" | "emergency";

export interface Medicine {
  id: string;
  name: string;
  /** Strength as written on the discharge summary, for example "650 mg". */
  dose: string;
  /** Tablets per dose. */
  perDose: number;
  slots: Slot[];
  food: "before" | "after";
  startDate: LocalDate;
  endDate: LocalDate;
  /** Tablets handed over at discharge, used for pill counts. */
  dispensed: number;
}

export interface PrescriptionVersion {
  id: string;
  medicines: Medicine[];
  status: "draft" | "entered" | "verified";
  enteredBy?: string;
  enteredAt?: number;
  verifiedBy?: string;
  verifiedAt?: number;
  /** Earlier version this one replaces (records are never edited in place). */
  replaces?: string;
}

export interface Consent {
  calls: boolean;
  shareFamily: boolean;
  shareDoctor: boolean;
  recordedAt: number;
  recordedBy: string;
  withdrawnAt?: number;
  withdrawnBy?: string;
}

export type PackageKind = "call" | "callVisit" | "full" | "monthly";
export type PackageLength = 7 | 14 | 30;

export interface PackageDef {
  id: PackageKind;
  includesVisits: boolean;
  includesNurseVisits: boolean;
  /** Price in rupees for each length; the monthly plan uses `month`. */
  prices: Partial<Record<PackageLength, number>> & { month?: number };
}

export interface PatientPackage {
  kind: PackageKind;
  lengthDays: number;
  startDate: LocalDate;
  endDate: LocalDate;
  status: "active" | "expired";
  paid: boolean;
  /** Which month of a monthly plan this is (1 = first). */
  monthNo?: number;
  renewalOfferedAt?: number;
}

export type Relation =
  | "son"
  | "daughter"
  | "husband"
  | "wife"
  | "brother"
  | "sister"
  | "grandson"
  | "granddaughter"
  | "daughterInLaw"
  | "sonInLaw"
  | "nephew"
  | "niece";

/** How a family member refers to the patient ("your mother"). */
export type Kin =
  | "mother"
  | "father"
  | "wife"
  | "husband"
  | "grandmother"
  | "grandfather"
  | "sister"
  | "brother"
  | "motherInLaw"
  | "fatherInLaw"
  | "aunt"
  | "uncle";

export interface Patient {
  id: string;
  name: LocalText;
  honorific: Honorific;
  gender: "f" | "m";
  age: number;
  phone: string;
  /** Another patient who answers the same phone. */
  sharesPhoneWith?: string;
  language: Lang;
  phoneType: PhoneType;
  condition: LocalText;
  hospitalId: string;
  doctorId: string;
  nurseId: string;
  address: LocalText;
  distanceKm: number;
  mealTimes: Record<Slot, HHMM>;
  callTimes: Partial<Record<Slot, HHMM>>;
  enrolledAt: number;
  enrolledBy: string;
  consent: Consent;
  dischargeSummary?: { fileName: string; uploadedAt: number };
  prescriptions: PrescriptionVersion[];
  /** From when calls may go out (set when the prescription is verified). */
  callsFrom?: number;
  pkg: PatientPackage;
  carePlan: CarePlan;
  nextReviewDate?: LocalDate;
  packageRequest?: { lengthDays: PackageLength; by: string; at: number };
  /** Simple hue for the photo placeholder. */
  hue: number;
  /** Baseline used to generate sample vitals. */
  baseline: Vitals;
}

export type VisitPattern = "standard" | "daily" | "none";
export type VisitTask = "vitals" | "pillCount" | "wound" | "mobility" | "sugar";

export interface CarePlan {
  pattern: VisitPattern;
  tasks: VisitTask[];
  /** Start of the usual visit window (day 1 is always 5 pm, after discharge). */
  visitStart: HHMM;
  caregiverId?: string;
}

export interface FamilyMember {
  id: string;
  patientId: string;
  name: LocalText;
  relation: Relation;
  kin: Kin;
  phone: string;
  city: LocalText;
  timeZone: string;
  reportLanguage: Lang;
  primary: boolean;
}

export interface Vitals {
  bpSys?: number;
  bpDia?: number;
  pulse?: number;
  tempC?: number;
  spo2?: number;
  sugar?: number;
}

/* ---------------------------------------------------------------- calls */

export type ReplyIntent =
  | "taken"
  | "notEaten"
  | "later"
  | "unwell"
  | "refuse"
  | "someoneElse"
  | "wantPerson"
  | "unclear"
  | "yes"
  | "no";

export type CallInput =
  | { type: "answer" }
  | { type: "noAnswer" }
  | { type: "hangUp" }
  | {
      type: "reply";
      intent: ReplyIntent;
      via: "voice" | "key" | "text";
      key?: "1" | "2" | "3";
      minutes?: number;
      text?: string;
    };

export type CallReason = "scheduled" | "noAnswer" | "postponed" | "someoneElse";

export type CallOutcome =
  | "takenLogged"
  | "postponed"
  | "postponeLimit"
  | "nurseRequested"
  | "unwell"
  | "refused"
  | "callbackOtherPerson"
  | "otherPersonFlagged"
  | "unclearFlagged"
  | "noAnswerRetry"
  | "noAnswerFlagged"
  | "dayEnded";

export interface CallContext {
  slot: Slot;
  /** 1, 2 or 3 within a run of unanswered attempts. */
  attempt: number;
  postponesSoFar: number;
  otherPersonSoFar: number;
  startedAt: number;
}

export interface CallRecord {
  id: string;
  patientId: string;
  date: LocalDate;
  slot: Slot;
  reason: CallReason;
  ctx: CallContext;
  inputs: CallInput[];
  status: "ringing" | "inProgress" | "ended";
  outcome?: CallOutcome;
  endedAt?: number;
  /** Placed automatically by the clock (sample behaviour), not by you. */
  simulated: boolean;
  lang: Lang;
  phoneType: PhoneType;
  /** Set when the patient said no to the dose; kept on the call, not in the clinical log. */
  note?: "refused";
}

export interface QueuedCall {
  id: string;
  patientId: string;
  date: LocalDate;
  slot: Slot;
  at: number;
  reason: CallReason;
  attempt: number;
}

/* ---------------------------------------------------------------- log */

export type Confirmation = "voiceYes" | "keyOne" | "appTap" | "pillCount" | "nurseCall" | "systemEndOfDay";

export type LogEntry =
  | (LogBase & { kind: "doseTaken"; date: LocalDate; slot: Slot; takenAt: number; confirmation: Confirmation; callId?: string })
  | (LogBase & { kind: "doseConfirmed"; date: LocalDate; slot: Slot; visitId: string; confirmation: "pillCount" })
  | (LogBase & { kind: "doseMissed"; date: LocalDate; slot: Slot; confirmation: "systemEndOfDay" })
  | (LogBase & { kind: "vitals"; visitId: string; vitals: Vitals })
  | (LogBase & { kind: "pillCount"; visitId: string; counts: PillCount[]; matched: boolean })
  | (LogBase & { kind: "visitNote"; visitId: string; text: LocalText; voiceNoteSeconds?: number })
  | (LogBase & { kind: "nurseNote"; text: LocalText; flagId?: string; spokeToPatient?: boolean });

export interface LogBase {
  id: string;
  patientId: string;
  at: number;
  source: "call" | "caregiver" | "nurse" | "system" | "doctor";
  by?: string;
  /** Earlier entry this one replaces. The old entry stays in the log. */
  replaces?: string;
}

export interface PillCount {
  medicineId: string;
  expected: number;
  counted: number;
}

/* ---------------------------------------------------------------- flags */

export type FlagType =
  | "unwell"
  | "personRequested"
  | "noAnswer"
  | "postponed3"
  | "unclear"
  | "refused"
  | "wrongPerson"
  | "pillMismatch"
  | "reportCheckFailed"
  | "caregiverNoShow"
  | "caregiverUnwell"
  | "familyCallback"
  | "consentWithdrawn"
  | "paymentFailed";

export type Urgency = "urgent" | "normal" | "admin";

export interface Flag {
  id: string;
  patientId: string;
  type: FlagType;
  urgency: Urgency;
  status: "open" | "calling" | "closed";
  openedAt: number;
  date?: LocalDate;
  slot?: Slot;
  callId?: string;
  visitId?: string;
  reportId?: string;
  familyId?: string;
  calledAt?: number;
  calledBy?: string;
  closedAt?: number;
  closedBy?: string;
  outcome?: LocalText;
  spokeToPatient?: boolean;
}

/* ---------------------------------------------------------------- visits */

export interface Visit {
  id: string;
  patientId: string;
  date: LocalDate;
  dayNo: number;
  windowStart: HHMM;
  windowEnd: HHMM;
  caregiverId?: string;
  status: "scheduled" | "checkedIn" | "completed" | "missed";
  tasks: VisitTask[];
  tasksDone: VisitTask[];
  checkInAt?: number;
  checkOutAt?: number;
  verified?: boolean;
  vitals?: Vitals;
  pillCounts?: PillCount[];
  note?: LocalText;
  voiceNoteSeconds?: number;
  /** Demo switch: this caregiver will not turn up. */
  noShow?: boolean;
  simulated?: boolean;
}

/* ---------------------------------------------------------------- reports */

export type ReportLineKind = "dose" | "summary" | "visit" | "vitals" | "pillCount" | "nurse" | "flag";

export interface ReportLine {
  id: string;
  kind: ReportLineKind;
  /** Translation key and slots. Never free text. */
  key: string;
  params: Record<string, Param>;
  icon: "ok" | "pending" | "missed" | "info" | "alert" | "visit";
  sources: string[];
  /** Facts the line states, re-checked against the log before sending. */
  claims: Claim[];
}

export type Claim =
  | { type: "doseStatus"; date: LocalDate; slot: Slot; status: DoseStatus }
  | { type: "doseCount"; date: LocalDate; confirmed: number; total: number }
  | { type: "vitalsValue"; entryId: string; field: keyof Vitals; value: number }
  | { type: "doseNotLogged"; date: LocalDate; slot: Slot }
  | { type: "entryExists"; entryId: string };

export interface Report {
  id: string;
  patientId: string;
  date: LocalDate;
  generatedAt: number;
  lines: ReportLine[];
  check: { passed: boolean; problems: Array<{ key: string; params: Record<string, Param> }> };
  status: "sent" | "blocked";
}

export interface Message {
  id: string;
  familyId: string;
  patientId: string;
  at: number;
  kind: "dailyReport" | "noAnswer" | "visitMissed" | "renewal" | "packageEnded" | "nurseSpoke" | "paymentReceipt" | "welcome" | "consentWithdrawn" | "doctorRequest";
  reportId?: string;
  params: Record<string, Param>;
}

/* ---------------------------------------------------------------- money */

export interface Payment {
  id: string;
  patientId: string;
  familyId?: string;
  kind: PackageKind;
  lengthDays: number;
  amount: number;
  at: number;
  status: "success" | "failed" | "refunded";
  method: "upi" | "card" | "desk";
  purpose: "new" | "renewal" | "monthly" | "extension";
}

/* ---------------------------------------------------------------- audit & feed */

export interface AuditEntry {
  id: string;
  at: number;
  actorId: string;
  actorRole: Role | "system";
  action: "viewed" | "created" | "changed" | "verified" | "closed" | "sent" | "blocked" | "paid" | "refunded" | "withdrawn" | "signedIn";
  target: string;
  patientId?: string;
  key: string;
  params: Record<string, Param>;
}

export interface ActivityEvent {
  id: string;
  at: number;
  key: string;
  params: Record<string, Param>;
  visibleTo: Role[];
  patientId?: string;
  tone: "info" | "ok" | "warn" | "danger";
}

export interface CallbackRequest {
  id: string;
  familyId: string;
  patientId: string;
  at: number;
  flagId: string;
}

/** Values that fill translation slots. Resolved at render time in the viewer's language. */
export type Param =
  | string
  | number
  | { $text: LocalText }
  | { $t: string; params?: Record<string, Param> }
  | { $time: number }
  | { $date: string }
  | { $money: number }
  | { $person: string };

export type DoseStatus = "due" | "postponed" | "takenSelf" | "takenCaregiver" | "missed";
