import { atLocal, type LocalDate } from "@/lib/time";
import type { DemoData } from "./data";
import { callTimeFor, plannedSlots } from "./schedule";
import type { CallRecord, DoseStatus, LogEntry, Patient, Slot } from "./types";

type DoseEntry = Extract<LogEntry, { kind: "doseTaken" | "doseConfirmed" | "doseMissed" }>;

export const isDoseEntry = (e: LogEntry): e is DoseEntry => e.kind === "doseTaken" || e.kind === "doseConfirmed" || e.kind === "doseMissed";

const key = (patientId: string, date: LocalDate, slot: Slot) => `${patientId}|${date}|${slot}`;

/** Ids of entries that a later entry replaced. */
export function replacedIds(log: LogEntry[]): Set<string> {
  const out = new Set<string>();
  for (const e of log) if (e.replaces) out.add(e.replaces);
  return out;
}

/** The entry currently in force for each dose (later corrections win; replaced entries are ignored). */
export function effectiveDoseIndex(log: LogEntry[]): Map<string, DoseEntry> {
  const replaced = replacedIds(log);
  const idx = new Map<string, DoseEntry>();
  for (const e of log) {
    if (!isDoseEntry(e) || replaced.has(e.id)) continue;
    const k = key(e.patientId, e.date, e.slot);
    const prev = idx.get(k);
    if (!prev || prev.at <= e.at) idx.set(k, e);
  }
  return idx;
}

export function statusFromEntry(e: DoseEntry | undefined): DoseStatus | undefined {
  if (!e) return undefined;
  if (e.kind === "doseConfirmed") return "takenCaregiver";
  if (e.kind === "doseMissed") return "missed";
  return e.source === "caregiver" ? "takenCaregiver" : "takenSelf";
}

export interface DoseView {
  date: LocalDate;
  slot: Slot;
  callAt: number;
  status: DoseStatus;
  upcoming: boolean;
  entry?: DoseEntry;
  /** The entry that the current one replaced (for "self-reported, then confirmed"). */
  replacedEntry?: LogEntry;
  lastCall?: CallRecord;
  nextCallAt?: number;
  refused?: boolean;
  flagged?: boolean;
}

/** Shared lookups for one render pass. */
export class DoseBook {
  private idx: Map<string, DoseEntry>;
  private byId: Map<string, LogEntry>;
  private callsByKey = new Map<string, CallRecord[]>();
  private queueByKey = new Map<string, number>();
  private flagged = new Set<string>();

  constructor(private data: DemoData) {
    this.idx = effectiveDoseIndex(data.log);
    this.byId = new Map(data.log.map((e) => [e.id, e]));
    for (const c of data.calls) {
      const k = key(c.patientId, c.date, c.slot);
      const arr = this.callsByKey.get(k);
      if (arr) arr.push(c);
      else this.callsByKey.set(k, [c]);
    }
    for (const q of data.queue) {
      const k = key(q.patientId, q.date, q.slot);
      const prev = this.queueByKey.get(k);
      if (prev == null || q.at < prev) this.queueByKey.set(k, q.at);
    }
    for (const f of data.flags) if (f.date && f.slot && f.status !== "closed") this.flagged.add(key(f.patientId, f.date, f.slot));
  }

  entry(id: string | undefined) {
    return id ? this.byId.get(id) : undefined;
  }

  dose(p: Patient, date: LocalDate, slot: Slot, now: number): DoseView {
    const k = key(p.id, date, slot);
    const entry = this.idx.get(k);
    const calls = this.callsByKey.get(k) ?? [];
    const lastCall = calls[calls.length - 1];
    const callAt = atLocal(date, callTimeFor(p, slot));
    const nextCallAt = this.queueByKey.get(k);
    let status = statusFromEntry(entry);
    if (!status) {
      const postponedOutcome = lastCall && ["postponed", "postponeLimit", "callbackOtherPerson"].includes(lastCall.outcome ?? "");
      status = nextCallAt != null && nextCallAt > callAt ? "postponed" : postponedOutcome ? "postponed" : "due";
    }
    return {
      date,
      slot,
      callAt,
      status,
      upcoming: status === "due" && callAt > now && !lastCall,
      entry,
      replacedEntry: entry?.replaces ? this.byId.get(entry.replaces) : undefined,
      lastCall,
      nextCallAt,
      refused: calls.some((c) => c.note === "refused"),
      flagged: this.flagged.has(k),
    };
  }

  day(p: Patient, date: LocalDate, now: number): DoseView[] {
    return plannedSlots(p, date).map((s) => this.dose(p, date, s, now));
  }
}

export interface Adherence {
  due: number;
  confirmed: number;
  caregiverConfirmed: number;
  missed: number;
  percent: number | null;
}

/** Doses whose call time has passed, and how many of them are in the log as taken. */
export function adherence(book: DoseBook, p: Patient, dates: LocalDate[], now: number): Adherence {
  let due = 0;
  let confirmed = 0;
  let caregiverConfirmed = 0;
  let missed = 0;
  for (const d of dates) {
    for (const v of book.day(p, d, now)) {
      if (v.callAt > now) continue;
      due += 1;
      if (v.status === "takenSelf" || v.status === "takenCaregiver") confirmed += 1;
      if (v.status === "takenCaregiver") caregiverConfirmed += 1;
      if (v.status === "missed") missed += 1;
    }
  }
  return { due, confirmed, caregiverConfirmed, missed, percent: due ? Math.round((confirmed / due) * 100) : null };
}
