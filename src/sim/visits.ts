import type { DemoData } from "@/domain/data";
import { findPatient, nextId } from "@/domain/data";
import { effectiveDoseIndex } from "@/domain/doses";
import { expectedPillCounts } from "@/domain/visits";
import type { LocalText, LogEntry, Patient, PillCount, Visit, VisitTask, Vitals } from "@/domain/types";
import { pick } from "@/lib/hash";
import { MIN } from "@/lib/time";
import { emit, messageFamily, openFlag } from "./emit";

export interface VisitRecordInput {
  vitals: Vitals;
  counts: PillCount[];
  note?: LocalText;
  voiceNoteSeconds?: number;
  tasksDone: VisitTask[];
}

export function checkIn(data: DemoData, v: Visit, at: number, verbose = true) {
  v.status = "checkedIn";
  v.checkInAt = at;
  v.verified = true;
  if (verbose) emit(data, at, "event.visitCheckedIn", { patient: { $person: v.patientId }, person: { $person: v.caregiverId ?? "" } }, ["caregiver", "nurse", "family", "admin"], "info", v.patientId);
}

/** After a matching pill count, self-reported doses since the last count become caregiver-confirmed. */
function confirmSelfReports(data: DemoData, p: Patient, v: Visit, since: number, at: number): number {
  const idx = effectiveDoseIndex(data.log);
  let n = 0;
  for (const e of idx.values()) {
    if (e.patientId !== p.id || e.kind !== "doseTaken" || e.source !== "call") continue;
    if (e.takenAt <= since || e.takenAt > at) continue;
    data.log.push({
      id: nextId(data, "l"),
      kind: "doseConfirmed",
      patientId: p.id,
      at,
      source: "caregiver",
      by: v.caregiverId,
      date: e.date,
      slot: e.slot,
      visitId: v.id,
      confirmation: "pillCount",
      replaces: e.id,
    });
    n += 1;
  }
  return n;
}

function lastCountAt(data: DemoData, p: Patient, before: number): number {
  let t = p.callsFrom ?? p.enrolledAt;
  for (const e of data.log) if (e.kind === "pillCount" && e.patientId === p.id && e.at < before && e.at > t) t = e.at;
  return t;
}

export function completeVisit(data: DemoData, v: Visit, at: number, input: VisitRecordInput, verbose = true) {
  const p = findPatient(data, v.patientId)!;
  const base = { patientId: p.id, at, source: "caregiver" as const, by: v.caregiverId, visitId: v.id };
  const since = lastCountAt(data, p, at);
  const hasVitals = Object.values(input.vitals).some((x) => x != null && !Number.isNaN(x));
  if (hasVitals) data.log.push({ id: nextId(data, "l"), kind: "vitals", vitals: input.vitals, ...base });
  let matched = true;
  if (input.counts.length) {
    matched = input.counts.every((c) => c.counted === c.expected);
    data.log.push({ id: nextId(data, "l"), kind: "pillCount", counts: input.counts, matched, ...base });
  }
  if (input.note || input.voiceNoteSeconds) {
    const entry: LogEntry = { id: nextId(data, "l"), kind: "visitNote", text: input.note ?? { en: "" }, voiceNoteSeconds: input.voiceNoteSeconds, ...base };
    data.log.push(entry);
  }
  v.status = "completed";
  v.checkOutAt = at;
  v.vitals = input.vitals;
  v.pillCounts = input.counts;
  v.note = input.note;
  v.voiceNoteSeconds = input.voiceNoteSeconds;
  v.tasksDone = input.tasksDone;
  if (verbose) emit(data, at, "event.visitCheckedOut", { patient: { $person: p.id }, person: { $person: v.caregiverId ?? "" } }, ["caregiver", "nurse", "family", "admin"], "ok", p.id);
  if (input.counts.length) {
    if (matched) {
      const n = confirmSelfReports(data, p, v, since, at);
      if (verbose && n) emit(data, at, "event.dosesConfirmed", { patient: { $person: p.id }, count: n }, ["family", "nurse", "doctor", "admin"], "ok", p.id);
    } else {
      openFlag(data, at, p.id, "pillMismatch", { visitId: v.id, date: v.date });
    }
  }
}

function jitter(key: string, base: number | undefined, spread: number, decimals = 0): number | undefined {
  if (base == null) return undefined;
  const r = (pick(key, 0, 1000) / 1000 - 0.5) * 2 * spread;
  const f = 10 ** decimals;
  return Math.round((base + r) * f) / f;
}

export function sampleVitals(p: Patient, v: Visit): Vitals {
  const k = `${v.id}|${v.date}`;
  const b = p.baseline;
  return {
    bpSys: jitter(`${k}|s`, b.bpSys, 8),
    bpDia: jitter(`${k}|d`, b.bpDia, 5),
    pulse: jitter(`${k}|p`, b.pulse, 6),
    tempC: jitter(`${k}|t`, b.tempC, 0.3, 1),
    spo2: b.spo2 != null ? Math.min(100, jitter(`${k}|o`, b.spo2, 1.4)!) : undefined,
    sugar: v.tasks.includes("sugar") ? jitter(`${k}|g`, b.sugar, 18) : undefined,
  };
}

/** A visit the clock jumps past: the caregiver turns up and records everything. */
export function autoVisit(data: DemoData, v: Visit, at: number, verbose: boolean, mismatch = false) {
  const p = findPatient(data, v.patientId)!;
  checkIn(data, v, at, verbose);
  v.simulated = true;
  const out = at + pick(`${v.id}|dur`, 30, 45) * MIN;
  const expected = v.tasks.includes("pillCount") ? expectedPillCounts(data, p, out) : [];
  const counts = expected.map((c, i) => ({ ...c, counted: mismatch && i === 0 ? Math.max(0, c.expected - 2) : c.expected }));
  completeVisit(data, v, out, { vitals: v.tasks.includes("vitals") ? sampleVitals(p, v) : {}, counts, tasksDone: [...v.tasks] }, verbose);
}

export function missVisit(data: DemoData, v: Visit, at: number) {
  v.status = "missed";
  const pid = v.patientId;
  emit(data, at, "event.visitMissed", { patient: { $person: pid }, person: { $person: v.caregiverId ?? "" } }, ["caregiver", "nurse", "family", "admin"], "danger", pid);
  openFlag(data, at, pid, "caregiverNoShow", { visitId: v.id, date: v.date });
  const n = messageFamily(data, at, pid, "visitMissed", { patient: { $person: pid } });
  if (n) emit(data, at, "event.familyToldVisitMissed", { patient: { $person: pid } }, ["family", "nurse", "admin"], "warn", pid);
}
