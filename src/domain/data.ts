import type {
  ActivityEvent,
  AuditEntry,
  CallRecord,
  CallbackRequest,
  FamilyMember,
  Flag,
  Hospital,
  LogEntry,
  Message,
  PackageDef,
  Patient,
  Payment,
  QueuedCall,
  Report,
  StaffUser,
  Visit,
} from "./types";

/** Everything a real backend would own. Kept in one plain object for the mock. */
export interface DemoData {
  seq: number;
  hospitals: Hospital[];
  staff: StaffUser[];
  patients: Patient[];
  family: FamilyMember[];
  packages: PackageDef[];
  calls: CallRecord[];
  queue: QueuedCall[];
  log: LogEntry[];
  flags: Flag[];
  visits: Visit[];
  reports: Report[];
  messages: Message[];
  payments: Payment[];
  audit: AuditEntry[];
  events: ActivityEvent[];
  callbacks: CallbackRequest[];
  phone: { ringingCallId?: string; activeCallId?: string };
  /** Markers for once-a-day work already done, e.g. "report:2026-10-05". */
  done: Record<string, true>;
  settings: SimSettings;
}

/** Demo switches that change how the simulated world behaves. */
export interface SimSettings {
  /** What happens to a call for the patient on screen when the clock jumps past it. */
  skippedFocusCalls: "taken" | "unanswered";
  /** Caregivers turn up for visits the clock jumps past. */
  autoVisits: boolean;
  /** The next daily report for the patient on screen contains a number that is not in the log. */
  breakNextReport: boolean;
  paymentOutcome: "success" | "fail";
  uploadFails: boolean;
}

export function nextId(data: DemoData, prefix: string): string {
  data.seq += 1;
  return `${prefix}${data.seq}`;
}

export const findPatient = (data: DemoData, id: string | undefined) => data.patients.find((p) => p.id === id);
export const findStaff = (data: DemoData, id: string | undefined) => data.staff.find((s) => s.id === id);
export const findFamily = (data: DemoData, id: string | undefined) => data.family.find((f) => f.id === id);
