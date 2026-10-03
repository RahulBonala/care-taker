import { addDays, addMinutesToHhmm, type HHMM } from "@/lib/time";
import type { DemoData } from "./data";
import { nextId } from "./data";
import { effectiveDoseIndex, replacedIds } from "./doses";
import { verifiedPrescription } from "./schedule";
import type { PackageKind, Patient, PillCount, Visit, VisitPattern, VisitTask } from "./types";

/** Visit days for each pattern. "standard": daily for 3 days, alternate days to day 10, then day 14. */
export function visitDays(pattern: VisitPattern, lengthDays: number): number[] {
  if (pattern === "none") return [];
  const days = pattern === "daily" ? Array.from({ length: lengthDays }, (_, i) => i + 1) : [1, 2, 3, 5, 7, 9, 14];
  return days.filter((d) => d <= lengthDays);
}

export function defaultPattern(kind: PackageKind): VisitPattern {
  if (kind === "callVisit") return "standard";
  if (kind === "full") return "daily";
  return "none";
}

export const DEFAULT_TASKS: VisitTask[] = ["vitals", "pillCount", "mobility"];

export function visitWindow(p: Patient, dayNo: number): { start: HHMM; end: HHMM } {
  const start = dayNo === 1 ? "17:00" : p.carePlan.visitStart;
  return { start, end: addMinutesToHhmm(start, 60) };
}

/** (Re)build the scheduled visits of a package. Completed and missed visits are kept as they are. */
export function planVisits(data: DemoData, p: Patient) {
  const caregiverId = p.carePlan.caregiverId;
  const keep = data.visits.filter((v) => v.patientId !== p.id || v.status !== "scheduled");
  const done = new Set(keep.filter((v) => v.patientId === p.id).map((v) => v.date));
  const days = visitDays(p.carePlan.pattern, p.pkg.lengthDays);
  const fresh: Visit[] = [];
  const prev = data.visits.filter((v) => v.patientId === p.id && v.status === "scheduled");
  for (const dayNo of days) {
    const date = addDays(p.pkg.startDate, dayNo - 1);
    if (done.has(date)) continue;
    const w = visitWindow(p, dayNo);
    const before = prev.find((v) => v.date === date);
    fresh.push({
      id: before?.id ?? nextId(data, "v"),
      patientId: p.id,
      date,
      dayNo,
      windowStart: before?.windowStart ?? w.start,
      windowEnd: before?.windowEnd ?? w.end,
      caregiverId: before?.caregiverId ?? caregiverId,
      status: "scheduled",
      tasks: [...p.carePlan.tasks],
      tasksDone: [],
      noShow: before?.noShow,
    });
  }
  data.visits = [...keep, ...fresh].sort((a, b) => (a.date + a.windowStart).localeCompare(b.date + b.windowStart));
}

/**
 * Tablets that should be left for each medicine: the last count (or the
 * number handed over at discharge) minus the doses the log says were taken
 * since then.
 */
export function expectedPillCounts(data: DemoData, p: Patient, at: number): PillCount[] {
  const rx = verifiedPrescription(p);
  if (!rx) return [];
  const idx = effectiveDoseIndex(data.log);
  const counts = data.log
    .filter((e): e is Extract<typeof e, { kind: "pillCount" }> => e.kind === "pillCount" && e.patientId === p.id && e.at <= at)
    .sort((a, b) => a.at - b.at);
  const replaced = replacedIds(data.log);
  return rx.medicines.map((m) => {
    let baseline = m.dispensed;
    let baselineAt = p.callsFrom ?? p.enrolledAt;
    for (const c of counts) {
      if (replaced.has(c.id)) continue;
      const row = c.counts.find((r) => r.medicineId === m.id);
      if (row) {
        baseline = row.counted;
        baselineAt = c.at;
      }
    }
    let taken = 0;
    for (const e of idx.values()) {
      if (e.patientId !== p.id || e.kind === "doseMissed") continue;
      if (!m.slots.includes(e.slot) || e.date < m.startDate || e.date > m.endDate) continue;
      const takenAt = e.kind === "doseTaken" ? e.takenAt : (data.log.find((x) => x.id === e.replaces) as { takenAt?: number } | undefined)?.takenAt ?? e.at;
      if (takenAt > baselineAt && takenAt <= at) taken += m.perDose;
    }
    return { medicineId: m.id, expected: Math.max(0, baseline - taken), counted: NaN };
  });
}

/** Plausible ranges for typing vitals in (data entry checks, not clinical advice). */
export const VITAL_RANGES = {
  bpSys: [70, 250],
  bpDia: [40, 150],
  pulse: [30, 200],
  tempC: [34, 42],
  spo2: [70, 100],
  sugar: [40, 600],
} as const;
