"use client";

import { Megaphone } from "lucide-react";
import { VisitCard } from "@/components/shared/VisitCard";
import { Button, EmptyState, Screen, ScreenTitle, Section } from "@/components/ui";
import { useT } from "@/i18n/useT";
import { atLocal, localDate } from "@/lib/time";
import { reportNoShow } from "@/store/roleActions";
import { useFamily } from "./useFamily";

export function FamilyVisits() {
  const { t } = useT();
  const { repos, f, p, now } = useFamily();
  if (!f || !p) return <Screen><EmptyState title={t("common.notAllowed")} /></Screen>;
  const visits = repos.visits.forPatient(p.id);
  const today = localDate(now);
  const upcoming = visits.filter((v) => v.status === "scheduled" || v.status === "checkedIn");
  const past = visits.filter((v) => v.status === "completed" || v.status === "missed").reverse();
  return (
    <Screen>
      <ScreenTitle title={t("family.visits.title")} />
      {visits.length === 0 ? (
        <EmptyState title={p.carePlan.pattern === "none" ? t("family.visits.noVisits") : t("family.visits.none")} />
      ) : (
        <>
          <Section title={t("family.visits.upcoming")}>
            {upcoming.length === 0 ? (
              <p className="text-muted">{t("family.home.noMoreVisits")}</p>
            ) : (
              <div className="space-y-3">
                {upcoming.map((v) => {
                  const late = v.status === "scheduled" && v.date <= today && atLocal(v.date, v.windowEnd) < now;
                  return (
                    <VisitCard
                      key={v.id}
                      v={v}
                      action={
                        late ? (
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-warn-soft p-3">
                            <span className="font-semibold text-warn">{t("family.visits.noOneCame")}</span>
                            <Button size="sm" variant="secondary" icon={Megaphone} onClick={() => reportNoShow(v.id)}>
                              {t("family.visits.reportNoShow")}
                            </Button>
                          </div>
                        ) : undefined
                      }
                    />
                  );
                })}
              </div>
            )}
          </Section>
          <Section title={t("family.visits.past")}>
            {past.length === 0 ? <p className="text-muted">{t("family.visits.none")}</p> : <div className="space-y-3">{past.map((v) => <VisitCard key={v.id} v={v} />)}</div>}
          </Section>
        </>
      )}
    </Screen>
  );
}
