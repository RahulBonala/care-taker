/**
 * Data access for screens. Screens never touch the raw store; they ask these
 * interfaces. The mock implements them in memory (memory.ts). A real build
 * can swap in database-backed implementations without rewriting screens.
 *
 * Every repo is created for one viewer (role + person) and only returns what
 * that viewer is allowed to see.
 */
import type { accuracy, overview } from "@/domain/analytics";
import type { DoseBook } from "@/domain/doses";
import type {
  AuditEntry,
  CallRecord,
  FamilyMember,
  Flag,
  LogEntry,
  Message,
  PackageDef,
  PackageKind,
  Patient,
  Payment,
  Report,
  Role,
  StaffUser,
  Visit,
  ActivityEvent,
  QueuedCall,
} from "@/domain/types";

export interface Viewer {
  role: Role;
  userId: string;
}

export interface PatientsRepo {
  list(): Patient[];
  get(id: string | undefined): Patient | undefined;
  /** Search by name (any script) or phone number. */
  search(query: string): Patient[];
}

export interface FamilyRepo {
  forPatient(patientId: string): FamilyMember[];
  get(id: string | undefined): FamilyMember | undefined;
  all(): FamilyMember[];
}

export interface StaffRepo {
  list(role?: StaffUser["role"]): StaffUser[];
  get(id: string | undefined): StaffUser | undefined;
}

export interface CallsRepo {
  forPatient(patientId: string, date?: string): CallRecord[];
  get(id: string | undefined): CallRecord | undefined;
  queued(patientId: string): QueuedCall[];
  all(): CallRecord[];
  ringing(): CallRecord | undefined;
  active(): CallRecord | undefined;
}

export interface LogRepo {
  forPatient(patientId: string): LogEntry[];
  get(id: string): LogEntry | undefined;
  /** Ids of entries replaced by a later entry. */
  replaced(): Set<string>;
}

export interface FlagsRepo {
  open(): Flag[];
  all(): Flag[];
  forPatient(patientId: string): Flag[];
  get(id: string | undefined): Flag | undefined;
}

export interface VisitsRepo {
  forPatient(patientId: string): Visit[];
  forCaregiver(caregiverId: string): Visit[];
  all(): Visit[];
  get(id: string | undefined): Visit | undefined;
}

export interface ReportsRepo {
  forPatient(patientId: string): Report[];
  get(id: string | undefined): Report | undefined;
  all(): Report[];
}

export interface MessagesRepo {
  forFamily(familyId: string): Message[];
}

export interface PaymentsRepo {
  forPatient(patientId: string): Payment[];
  all(): Payment[];
}

export interface PackagesRepo {
  list(): PackageDef[];
  price(kind: PackageKind, lengthDays: number): number;
}

export interface AuditRepo {
  list(): AuditEntry[];
}

export interface EventsRepo {
  list(): ActivityEvent[];
}

/** Aggregate numbers for the admin overview and call accuracy (admin only). */
export interface AnalyticsRepo {
  overview(now: number): ReturnType<typeof overview> | null;
  accuracy(): ReturnType<typeof accuracy> | null;
}

export interface Repos {
  viewer: Viewer;
  /** What this viewer may see at all. Screens show "not available" when false. */
  can: { clinical: boolean; payments: boolean; familyContacts: boolean; audit: boolean };
  patients: PatientsRepo;
  family: FamilyRepo;
  staff: StaffRepo;
  calls: CallsRepo;
  log: LogRepo;
  flags: FlagsRepo;
  visits: VisitsRepo;
  reports: ReportsRepo;
  messages: MessagesRepo;
  payments: PaymentsRepo;
  packages: PackagesRepo;
  audit: AuditRepo;
  events: EventsRepo;
  analytics: AnalyticsRepo;
  doses: DoseBook;
}
