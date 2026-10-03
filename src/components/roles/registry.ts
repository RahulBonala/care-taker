import type { ComponentType } from "react";
import {
  CalendarCheck,
  ChartBar,
  ClipboardList,
  CreditCard,
  FileText,
  Flag,
  House,
  ListChecks,
  Phone,
  Pill,
  ScrollText,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Stethoscope,
  UserPlus,
  UserRound,
  Users,
  CalendarDays,
  HeartHandshake,
  Hospital,
  Activity,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/domain/types";
import type { MessageKey } from "@/i18n/types";
import { PatientCall } from "@/components/patient/PatientCall";
import { PatientToday } from "@/components/patient/PatientToday";
import { FamilyHome } from "@/components/family/FamilyHome";
import { FamilyReport } from "@/components/family/FamilyReport";
import { FamilyHistory } from "@/components/family/FamilyHistory";
import { FamilyVisits } from "@/components/family/FamilyVisits";
import { FamilyPackage } from "@/components/family/FamilyPackage";
import { FamilySettings } from "@/components/family/FamilySettings";
import { NursePatients } from "@/components/nurse/NursePatients";
import { NursePatient } from "@/components/nurse/NursePatient";
import { NurseFlags } from "@/components/nurse/NurseFlags";
import { NurseFlag } from "@/components/nurse/NurseFlag";
import { NurseVisits } from "@/components/nurse/NurseVisits";
import { CaregiverToday } from "@/components/caregiver/CaregiverToday";
import { CaregiverVisit } from "@/components/caregiver/CaregiverVisit";
import { CaregiverProfile } from "@/components/caregiver/CaregiverProfile";
import { DoctorPatients } from "@/components/doctor/DoctorPatients";
import { DoctorPatient } from "@/components/doctor/DoctorPatient";
import { DoctorWeekly } from "@/components/doctor/DoctorWeekly";
import { DeskEnrol } from "@/components/desk/DeskEnrol";
import { DeskToday } from "@/components/desk/DeskToday";
import { AdminOverview } from "@/components/admin/AdminOverview";
import { AdminAccuracy } from "@/components/admin/AdminAccuracy";
import { AdminSetup } from "@/components/admin/AdminSetup";
import { AdminAudit } from "@/components/admin/AdminAudit";
import { AdminDemo } from "@/components/admin/AdminDemo";

export interface ScreenDef {
  /** URL segment after the role ("" for the role's first screen). */
  id: string;
  label: MessageKey;
  icon: LucideIcon;
  Component: ComponentType;
  /** Shown in the role's navigation. Detail screens are not. */
  inNav: boolean;
  /** Navigation item to highlight for a detail screen. */
  parent?: string;
}

export const ROLE_ICONS: Record<Role, LucideIcon> = {
  patient: Phone,
  family: HeartHandshake,
  nurse: Stethoscope,
  caregiver: UserRound,
  doctor: Activity,
  desk: Hospital,
  admin: ShieldCheck,
};

export const ROLE_SCREENS: Record<Role, ScreenDef[]> = {
  patient: [
    { id: "", label: "nav.patient.call", icon: Phone, Component: PatientCall, inNav: true },
    { id: "today", label: "nav.patient.today", icon: Pill, Component: PatientToday, inNav: true },
  ],
  family: [
    { id: "", label: "nav.family.home", icon: House, Component: FamilyHome, inNav: true },
    { id: "report", label: "nav.family.report", icon: FileText, Component: FamilyReport, inNav: true },
    { id: "history", label: "nav.family.history", icon: CalendarDays, Component: FamilyHistory, inNav: true },
    { id: "visits", label: "nav.family.visits", icon: UserRound, Component: FamilyVisits, inNav: true },
    { id: "package", label: "nav.family.package", icon: CreditCard, Component: FamilyPackage, inNav: true },
    { id: "settings", label: "nav.family.settings", icon: Settings, Component: FamilySettings, inNav: true },
  ],
  nurse: [
    { id: "", label: "nav.nurse.patients", icon: Users, Component: NursePatients, inNav: true },
    { id: "flags", label: "nav.nurse.flags", icon: Flag, Component: NurseFlags, inNav: true },
    { id: "visits", label: "nav.nurse.visits", icon: CalendarCheck, Component: NurseVisits, inNav: true },
    { id: "patient", label: "nav.nurse.patient", icon: ClipboardList, Component: NursePatient, inNav: false, parent: "" },
    { id: "flag", label: "nav.nurse.flag", icon: Flag, Component: NurseFlag, inNav: false, parent: "flags" },
  ],
  caregiver: [
    { id: "", label: "nav.caregiver.today", icon: ListChecks, Component: CaregiverToday, inNav: true },
    { id: "profile", label: "nav.caregiver.profile", icon: UserRound, Component: CaregiverProfile, inNav: true },
    { id: "visit", label: "nav.caregiver.visit", icon: ClipboardList, Component: CaregiverVisit, inNav: false, parent: "" },
  ],
  doctor: [
    { id: "", label: "nav.doctor.patients", icon: Users, Component: DoctorPatients, inNav: true },
    { id: "patient", label: "nav.doctor.patient", icon: Stethoscope, Component: DoctorPatient, inNav: false, parent: "" },
    { id: "weekly", label: "nav.doctor.weekly", icon: ScrollText, Component: DoctorWeekly, inNav: false, parent: "" },
  ],
  desk: [
    { id: "", label: "nav.desk.enrol", icon: UserPlus, Component: DeskEnrol, inNav: true },
    { id: "today", label: "nav.desk.today", icon: ClipboardList, Component: DeskToday, inNav: true },
  ],
  admin: [
    { id: "", label: "nav.admin.overview", icon: ChartBar, Component: AdminOverview, inNav: true },
    { id: "accuracy", label: "nav.admin.accuracy", icon: Phone, Component: AdminAccuracy, inNav: true },
    { id: "setup", label: "nav.admin.setup", icon: Settings, Component: AdminSetup, inNav: true },
    { id: "audit", label: "nav.admin.audit", icon: ScrollText, Component: AdminAudit, inNav: true },
    { id: "demo", label: "nav.admin.demo", icon: SlidersHorizontal, Component: AdminDemo, inNav: true },
  ],
};

export function findScreen(role: Role, id: string): ScreenDef {
  return ROLE_SCREENS[role].find((s) => s.id === id) ?? ROLE_SCREENS[role][0];
}

/** Path for a role screen, e.g. ("family", "report") → "/family/report/". */
export function screenPath(role: Role, id: string): string {
  return id ? `/${role}/${id}/` : `/${role}/`;
}
