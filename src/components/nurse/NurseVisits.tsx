"use client";

import { CalendarX } from "lucide-react";
import { VisitCard } from "@/components/shared/VisitCard";
import { Button, EmptyState, Screen, ScreenTitle, Section, Select } from "@/components/ui";
import { useActingAs, useRepos } from "@/data/useRepos";
import { useT } from "@/i18n/useT";
import { addDays, atLocal, localDate } from "@/lib/time";
import { assignCaregiver, markVisitMissed } from "@/store/roleActions";
import { useDemo } from "@/store/store";

export function NurseVisits() {
  const { t, person } = useT();
  const repos = useRepos();
  const nurseId = useActingAs();
  const now = useDemo((s) => s.now);
  const today = localDate(now);
  const until = addDays(today, 3);
  const all = repos.visits.all().filter((v) => v.date >= today && v.date <= until);
  const caregivers = repos.staff.list("caregiver");
  const todays = all.filter((v) => v.date === today);
  const later = all.filter((v) => v.date > today && v.status === "scheduled");

  const row = (v: (typeof all)[number]) => {
    const late = v.status === "scheduled" && atLocal(v.date, v.windowEnd) < now;
    return (
      <VisitCard
        key={v.id}
        v={v}
        showPatient
        action={
          v.status === "scheduled" ? (
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex min-w-0 flex-1 items-center gap-2">
                <span className="shrink-0 font-semibold">{t("nurse.care.assign")}</span>
                <Select value={v.caregiverId ?? ""} onChange={(e) => e.target.value && assignCaregiver(v.id, e.target.value, nurseId)} className="min-h-11">
                  <option value="">{t("nurse.care.unassigned")}</option>
                  {caregivers.map((c) => (
                    <option key={c.id} value={c.id} disabled={!c.caregiver?.verified}>
                      {person(c.id)} {c.caregiver?.verified ? "" : `(${t("nurse.care.notVerified")})`}
                    </option>
                  ))}
                </Select>
              </label>
              {late && (
                <Button size="sm" variant="secondary" icon={CalendarX} onClick={() => markVisitMissed(v.id)}>
                  {t("nurse.visits.markMissed")}
                </Button>
              )}
            </div>
          ) : undefined
        }
      />
    );
  };

  return (
    <Screen>
      <ScreenTitle title={t("nurse.visits.title")} />
      <Section title={t("nurse.visits.today")}>{todays.length ? <div className="space-y-3">{todays.map(row)}</div> : <EmptyState title={t("nurse.list.emptyVisits")} />}</Section>
      <Section title={t("nurse.visits.upcoming")}>{later.length ? <div className="space-y-3">{later.map(row)}</div> : <EmptyState title={t("nurse.visits.empty")} />}</Section>
    </Screen>
  );
}
