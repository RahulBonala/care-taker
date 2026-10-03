import { slotsToMarkMissed } from "@/call-engine/day";
import type { DemoData } from "@/domain/data";
import { nextId } from "@/domain/data";
import { DoseBook } from "@/domain/doses";
import { endDateFor, MONTH_DAYS, priceOf } from "@/domain/packages";
import { buildReportLines, checkReport } from "@/domain/reports";
import { callTimeFor, noCallsReason, plannedSlots } from "@/domain/schedule";
import type { Patient } from "@/domain/types";
import { addDays, atLocal, type LocalDate } from "@/lib/time";
import { audit, emit, messageFamily, openFlag } from "./emit";

/** Queue today's remaining calls for a patient (only what is not already called, queued or logged). */
export function ensureDayCalls(data: DemoData, p: Patient, date: LocalDate, now: number) {
  if (noCallsReason(p, now) && noCallsReason(p, now) !== "notStarted") return;
  const book = new DoseBook(data);
  for (const slot of plannedSlots(p, date)) {
    const at = atLocal(date, callTimeFor(p, slot));
    if (at < now) continue;
    const view = book.dose(p, date, slot, now);
    if (view.entry || view.lastCall || view.nextCallAt != null) continue;
    data.queue.push({ id: nextId(data, "q"), patientId: p.id, date, slot, at, reason: "scheduled", attempt: 1 });
  }
}

export function cancelCalls(data: DemoData, patientId: string) {
  data.queue = data.queue.filter((q) => q.patientId !== patientId);
}

export function dayStart(data: DemoData, date: LocalDate, at: number) {
  data.done[`day:${date}`] = true;
  for (const p of data.patients) {
    if (p.pkg.status === "active" && date === p.pkg.endDate && p.pkg.kind !== "monthly" && !p.pkg.renewalOfferedAt) {
      p.pkg.renewalOfferedAt = at;
      const n = messageFamily(data, at + 7 * 3_600_000, p.id, "renewal", { patient: { $person: p.id } });
      if (n) emit(data, at + 7 * 3_600_000, "event.renewalOffered", { patient: { $person: p.id } }, ["family", "admin"], "info", p.id);
    }
    ensureDayCalls(data, p, date, at);
  }
}

export function eveningReports(data: DemoData, date: LocalDate, at: number, focusPatientId: string | undefined, verbose: (pid: string) => boolean) {
  data.done[`report:${date}`] = true;
  for (const p of data.patients) {
    if (!plannedSlots(p, date).length) continue;
    const inject = data.settings.breakNextReport && (p.id === focusPatientId || !focusPatientId);
    if (inject) data.settings.breakNextReport = false;
    const lines = buildReportLines(data, p, date, at, { inject });
    const check = checkReport(data, p, date, lines, at);
    const report = { id: nextId(data, "r"), patientId: p.id, date, generatedAt: at, lines, check, status: check.passed ? ("sent" as const) : ("blocked" as const) };
    data.reports.push(report);
    const who = { $person: p.id };
    const loud = verbose(p.id);
    if (loud) emit(data, at, "event.reportGenerated", { patient: who }, ["admin"], "info", p.id);
    if (check.passed) {
      if (loud) emit(data, at, "event.reportCheckPassed", { patient: who }, ["admin"], "ok", p.id);
      const n = messageFamily(data, at, p.id, "dailyReport", { patient: who }, report.id);
      if (n && loud) emit(data, at, "event.whatsappSent", { patient: who, count: n }, ["family", "admin"], "ok", p.id);
      audit(data, at, "system", "system", "sent", report.id, "audit.reportSent", { patient: who }, p.id);
    } else {
      emit(data, at, "event.reportBlocked", { patient: who }, ["admin"], "danger", p.id);
      openFlag(data, at, p.id, "reportCheckFailed", { reportId: report.id, date });
      audit(data, at, "system", "system", "blocked", report.id, "audit.reportBlocked", { patient: who }, p.id);
    }
  }
}

export function closeDay(data: DemoData, date: LocalDate, at: number, verbose: (pid: string) => boolean) {
  data.done[`close:${date}`] = true;
  const book = new DoseBook(data);
  for (const p of data.patients) {
    const views = book.day(p, date, at);
    for (const slot of slotsToMarkMissed(views)) {
      data.log.push({ id: nextId(data, "l"), kind: "doseMissed", patientId: p.id, at, source: "system", date, slot, confirmation: "systemEndOfDay" });
      if (verbose(p.id)) emit(data, at, "event.markedMissed", { patient: { $person: p.id }, slot: { $t: `slot.${slot}` } }, ["family", "nurse", "doctor", "admin"], "danger", p.id);
    }
    const dropped = data.queue.filter((q) => q.patientId === p.id && q.date === date);
    if (dropped.length) data.queue = data.queue.filter((q) => !(q.patientId === p.id && q.date === date));

    if (p.pkg.status === "active" && date >= p.pkg.endDate) endPackage(data, p, at);
  }
}

function endPackage(data: DemoData, p: Patient, at: number) {
  const who = { $person: p.id };
  if (p.pkg.kind === "monthly") {
    const start = addDays(p.pkg.endDate, 1);
    p.pkg = { ...p.pkg, startDate: start, endDate: endDateFor(start, MONTH_DAYS), monthNo: (p.pkg.monthNo ?? 1) + 1, paid: true, renewalOfferedAt: undefined };
    const fam = data.family.find((f) => f.patientId === p.id && f.primary);
    const amount = priceOf(data.packages, "monthly", MONTH_DAYS);
    data.payments.push({ id: nextId(data, "pay"), patientId: p.id, familyId: fam?.id, kind: "monthly", lengthDays: MONTH_DAYS, amount, at, status: "success", method: "upi", purpose: "monthly" });
    messageFamily(data, at, p.id, "paymentReceipt", { patient: who, amount: { $money: amount } });
    emit(data, at, "event.monthlyRenewed", { patient: who, amount: { $money: amount } }, ["family", "admin"], "ok", p.id);
    return;
  }
  p.pkg = { ...p.pkg, status: "expired" };
  cancelCalls(data, p.id);
  messageFamily(data, at, p.id, "packageEnded", { patient: who });
  emit(data, at, "event.packageEnded", { patient: who }, ["family", "nurse", "doctor", "admin"], "warn", p.id);
}
