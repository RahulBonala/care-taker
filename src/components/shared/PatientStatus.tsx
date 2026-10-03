"use client";

import { CalendarCheck, CircleX, Flag, PhoneOff, ShieldAlert } from "lucide-react";
import type { Repos } from "@/data/repos";
import { noCallsReason } from "@/domain/schedule";
import type { Patient } from "@/domain/types";
import { useT } from "@/i18n/useT";
import { atLocal, localDate } from "@/lib/time";
import { Chip } from "@/components/ui";

export function patientSignals(repos: Repos, p: Patient, now: number) {
  const today = localDate(now);
  const open = repos.flags.forPatient(p.id).filter((f) => f.status !== "closed" && f.urgency !== "admin");
  const urgent = open.some((f) => f.urgency === "urgent");
  const visitToday = repos.visits.forPatient(p.id).find((v) => v.date === today && v.status !== "missed");
  const reason = noCallsReason(p, now);
  return { open, urgent, visitToday, reason };
}

/** Status chips for a patient in a list: words and icons, never colour alone. */
export function PatientChips({ repos, p, now }: { repos: Repos; p: Patient; now: number }) {
  const { t, time } = useT();
  const s = patientSignals(repos, p, now);
  return (
    <div className="flex flex-wrap gap-1.5">
      {s.reason === "notVerified" && <Chip tone="warn" icon={ShieldAlert} size="sm">{t("nurse.list.notVerified")}</Chip>}
      {s.reason === "noConsent" && <Chip tone="danger" icon={PhoneOff} size="sm">{t("nurse.list.noConsent")}</Chip>}
      {s.reason === "packageEnded" && <Chip tone="neutral" icon={CircleX} size="sm">{t("shell.packageEnded")}</Chip>}
      {s.open.length > 0 && <Chip tone={s.urgent ? "danger" : "warn"} icon={Flag} size="sm">{t("nurse.list.flagsOpen", { count: s.open.length })}</Chip>}
      {s.visitToday && <Chip tone="info" icon={CalendarCheck} size="sm">{t("nurse.list.visitToday", { time: time(atLocal(s.visitToday.date, s.visitToday.windowStart)) })}</Chip>}
    </div>
  );
}
