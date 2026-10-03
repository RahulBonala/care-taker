"use client";

import { BadgeCheck, CircleCheck, CircleDashed, Clock, IndianRupee, ListChecks } from "lucide-react";
import { Avatar, Card, Chip, EmptyState, Screen, ScreenTitle, Section, Stat } from "@/components/ui";
import { useActingAs, useRepos } from "@/data/useRepos";
import type { TrainingKey } from "@/domain/types";
import { useT } from "@/i18n/useT";

const ALL_TRAININGS: TrainingKey[] = ["vitals", "pillCount", "woundCare", "mobility", "privacy", "emergency"];

export function CaregiverProfile() {
  const { t, person, text, money } = useT();
  const repos = useRepos();
  const me = repos.staff.get(useActingAs());
  if (!me?.caregiver) return <Screen><EmptyState title={t("common.notAllowed")} /></Screen>;
  const c = me.caregiver;
  return (
    <Screen>
      <ScreenTitle title={t("caregiver.profile.title")} />
      <Card className="flex items-center gap-4">
        <Avatar hue={(me.id.length * 47) % 360} size={64} />
        <div className="min-w-0">
          <p className="text-xl font-bold">{person(me.id)}</p>
          <p className="text-muted">
            {t("caregiver.profile.area")}: {text(c.area)} · {me.phone}
          </p>
          <Chip tone={c.verified ? "ok" : "warn"} icon={c.verified ? BadgeCheck : Clock} size="sm">
            {t("caregiver.profile.verification")}: {c.verified ? t("caregiver.profile.verified") : t("caregiver.profile.pending")}
          </Chip>
        </div>
      </Card>
      <Section title={t("caregiver.profile.month")}>
        <div className="grid gap-3 @sm:grid-cols-2">
          <Stat label={t("caregiver.profile.visits")} value={c.visitsThisMonth} icon={ListChecks} />
          <Stat label={t("caregiver.profile.earnings")} value={money(c.earningsThisMonth)} icon={IndianRupee} />
        </div>
        <p className="text-sm text-muted">{t("caregiver.profile.sample")}</p>
      </Section>
      <Section title={t("caregiver.profile.trainings")}>
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {ALL_TRAININGS.map((k) => {
            const done = c.trainings.includes(k);
            return (
              <li key={k} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="font-medium">{t(`trainings.${k}`)}</span>
                <Chip size="sm" tone={done ? "ok" : "neutral"} icon={done ? CircleCheck : CircleDashed}>
                  {done ? t("caregiver.profile.done") : t("caregiver.profile.notDone")}
                </Chip>
              </li>
            );
          })}
        </ul>
      </Section>
    </Screen>
  );
}
