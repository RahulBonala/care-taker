import { CircleAlert, Flag, ShieldAlert, type LucideIcon } from "lucide-react";
import type { Flag as FlagT, FlagType } from "@/domain/types";
import type { Tone } from "@/components/ui";

/** Queue order: most urgent kinds first. */
export const FLAG_ORDER: FlagType[] = [
  "unwell",
  "personRequested",
  "caregiverUnwell",
  "noAnswer",
  "postponed3",
  "unclear",
  "refused",
  "wrongPerson",
  "pillMismatch",
  "caregiverNoShow",
  "familyCallback",
  "consentWithdrawn",
  "reportCheckFailed",
  "paymentFailed",
];

export function sortFlags(flags: FlagT[]): FlagT[] {
  return [...flags].sort((a, b) => FLAG_ORDER.indexOf(a.type) - FLAG_ORDER.indexOf(b.type) || a.openedAt - b.openedAt);
}

export function flagStyle(f: FlagT): { icon: LucideIcon; tone: Tone } {
  if (f.urgency === "urgent") return { icon: CircleAlert, tone: "danger" };
  if (f.urgency === "admin") return { icon: ShieldAlert, tone: "info" };
  return { icon: Flag, tone: "warn" };
}
