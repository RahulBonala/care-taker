import { addDays, dayDiff, type LocalDate } from "@/lib/time";
import type { PackageDef, PackageKind, PackageLength, Patient } from "./types";

export const PACKAGE_LENGTHS: PackageLength[] = [7, 14, 30];
export const MONTH_DAYS = 30;

/** Sample prices (rupees). Editable in Admin; screens always read them from data. */
export const DEFAULT_PACKAGES: PackageDef[] = [
  { id: "call", includesVisits: false, includesNurseVisits: false, prices: { 7: 899, 14: 1499, 30: 2799 } },
  { id: "callVisit", includesVisits: true, includesNurseVisits: false, prices: { 7: 3999, 14: 6999, 30: 13499 } },
  { id: "full", includesVisits: true, includesNurseVisits: true, prices: { 7: 9999, 14: 18200, 30: 35999 } },
  { id: "monthly", includesVisits: false, includesNurseVisits: false, prices: { month: 799 } },
];

export function priceOf(packages: PackageDef[], kind: PackageKind, length: number): number {
  const def = packages.find((p) => p.id === kind);
  if (!def) return 0;
  if (kind === "monthly") return def.prices.month ?? 0;
  return def.prices[length as PackageLength] ?? 0;
}

export function endDateFor(start: LocalDate, lengthDays: number): LocalDate {
  return addDays(start, lengthDays - 1);
}

/** Day number within the current package period (1-based). */
export function dayNo(p: Patient, date: LocalDate): number {
  return dayDiff(p.pkg.startDate, date) + 1;
}

export function daysLeft(p: Patient, date: LocalDate): number {
  return Math.max(0, dayDiff(date, p.pkg.endDate) + 1);
}

/** Renewal is offered on the last day of a fixed package and after it ends. */
export function renewalDue(p: Patient, date: LocalDate): boolean {
  if (p.pkg.kind === "monthly") return false;
  return p.pkg.status === "expired" || date >= p.pkg.endDate;
}
