import type { DemoData } from "@/domain/data";
import { findPatient, nextId } from "@/domain/data";
import type { ActivityEvent, AuditEntry, Flag, FlagType, Message, Param, Role, Urgency } from "@/domain/types";

export const MAX_EVENTS = 400;
export const MAX_AUDIT = 600;

export function emit(
  data: DemoData,
  at: number,
  key: string,
  params: Record<string, Param>,
  visibleTo: Role[],
  tone: ActivityEvent["tone"] = "info",
  patientId?: string,
) {
  data.events.push({ id: nextId(data, "e"), at, key, params, visibleTo, tone, patientId });
  if (data.events.length > MAX_EVENTS) data.events.splice(0, data.events.length - MAX_EVENTS);
}

export function audit(
  data: DemoData,
  at: number,
  actorId: string,
  actorRole: AuditEntry["actorRole"],
  action: AuditEntry["action"],
  target: string,
  key: string,
  params: Record<string, Param> = {},
  patientId?: string,
) {
  data.audit.push({ id: nextId(data, "a"), at, actorId, actorRole, action, target, key, params, patientId });
  if (data.audit.length > MAX_AUDIT) data.audit.splice(0, data.audit.length - MAX_AUDIT);
}

/** WhatsApp message to every family member of the patient (only with consent to share). */
export function messageFamily(data: DemoData, at: number, patientId: string, kind: Message["kind"], params: Record<string, Param> = {}, reportId?: string): number {
  const p = findPatient(data, patientId);
  if (!p || !p.consent.shareFamily) return 0;
  const family = data.family.filter((f) => f.patientId === patientId);
  for (const f of family) {
    data.messages.push({ id: nextId(data, "m"), familyId: f.id, patientId, at, kind, params, reportId });
  }
  return family.length;
}

export const FLAG_URGENCY: Record<FlagType, Urgency> = {
  unwell: "urgent",
  personRequested: "urgent",
  caregiverUnwell: "urgent",
  noAnswer: "normal",
  postponed3: "normal",
  unclear: "normal",
  refused: "normal",
  wrongPerson: "normal",
  pillMismatch: "normal",
  caregiverNoShow: "normal",
  familyCallback: "normal",
  consentWithdrawn: "normal",
  paymentFailed: "admin",
  reportCheckFailed: "admin",
};

export function openFlag(data: DemoData, at: number, patientId: string, type: FlagType, extra: Partial<Flag> = {}): Flag {
  const flag: Flag = {
    id: nextId(data, "f"),
    patientId,
    type,
    urgency: FLAG_URGENCY[type],
    status: "open",
    openedAt: at,
    ...extra,
  };
  data.flags.push(flag);
  const urgent = flag.urgency === "urgent";
  const visibleTo: Role[] = flag.urgency === "admin" ? ["admin"] : urgent ? ["nurse", "family", "admin"] : ["nurse", "admin"];
  emit(data, at, urgent ? "event.flagUrgent" : "event.flagOpened", { flag: { $t: `flag.type.${type}` }, patient: { $person: patientId } }, visibleTo, urgent ? "danger" : "warn", patientId);
  return flag;
}
