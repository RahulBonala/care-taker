import type { Repos } from "@/data/repos";
import { adherence } from "@/domain/doses";
import { noCallsReason } from "@/domain/schedule";
import type { Patient } from "@/domain/types";
import { addDays, dateRange, localDate } from "@/lib/time";

export function patientDates(p: Patient, now: number, lastDays?: number): string[] {
  const today = localDate(now);
  const from = lastDays ? (addDays(today, -(lastDays - 1)) > p.pkg.startDate ? addDays(today, -(lastDays - 1)) : p.pkg.startDate) : p.pkg.startDate;
  return from <= today ? dateRange(from, today) : [];
}

export type DoctorStatus = "notVerified" | "ended" | "attention" | "reviewDue" | "onTrack";

export function doctorStatus(repos: Repos, p: Patient, now: number): DoctorStatus {
  const reason = noCallsReason(p, now);
  if (reason === "notVerified") return "notVerified";
  if (reason === "packageEnded") return "ended";
  const open = repos.flags.forPatient(p.id).filter((f) => f.status !== "closed" && f.urgency !== "admin");
  const week = adherence(repos.doses, p, patientDates(p, now, 7), now);
  if (open.length || (week.percent != null && week.percent < 80)) return "attention";
  if (p.nextReviewDate && p.nextReviewDate <= localDate(now)) return "reviewDue";
  return "onTrack";
}

export function vitalsSeries(repos: Repos, p: Patient, from?: string) {
  const visits = repos.visits
    .forPatient(p.id)
    .filter((v) => v.status === "completed" && v.vitals && (!from || v.date >= from))
    .sort((a, b) => a.date.localeCompare(b.date));
  return visits;
}

export function mealsMentioned(repos: Repos, p: Patient, from?: string) {
  const calls = repos.calls.forPatient(p.id).filter((c) => !from || c.date >= from);
  const bySlot = new Map<string, number>();
  let count = 0;
  for (const c of calls) {
    for (const i of c.inputs) {
      if (i.type === "reply" && i.intent === "notEaten") {
        count += 1;
        bySlot.set(c.slot, (bySlot.get(c.slot) ?? 0) + 1);
      }
    }
  }
  return { count, bySlot };
}
