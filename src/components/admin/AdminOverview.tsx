"use client";

import { CircleCheck, FileText, Flag, Phone, PhoneIncoming, ShieldAlert, ShieldX, Users } from "lucide-react";
import { Banner, Button, Card, Chip, EmptyState, Screen, ScreenTitle, Section, Stat } from "@/components/ui";
import { useActingAs, useRepos } from "@/data/useRepos";
import { useT } from "@/i18n/useT";
import { closeAdminFlag } from "@/store/roleActions";
import { useDemo } from "@/store/store";

export function AdminOverview() {
  const { t, person, time, dayMonth, weekday, tx } = useT();
  const repos = useRepos();
  const adminId = useActingAs();
  const now = useDemo((s) => s.now);
  const o = repos.analytics.overview(now);
  if (!o) return <Screen><EmptyState title={t("common.notAllowed")} /></Screen>;
  const d = o.today;
  const urgent = o.openFlags.filter((f) => f.urgency === "urgent").length;
  const adminFlags = o.openFlags.filter((f) => f.urgency === "admin");
  return (
    <Screen wide>
      <ScreenTitle title={t("admin.overview.title")} subtitle={`${t("admin.overview.today")} · ${dayMonth(now)}`} />
      <div className="grid gap-3 @md:grid-cols-2 @desk:grid-cols-4">
        <Stat label={t("admin.overview.activePatients")} value={o.active} hint={o.noCalls ? t("admin.overview.noCalls", { count: o.noCalls }) : undefined} icon={Users} />
        <Stat label={t("admin.overview.callsToday")} value={d.placed} icon={Phone} />
        <Stat label={t("admin.overview.answered")} value={d.placed ? `${Math.round((d.answered / d.placed) * 100)}%` : "–"} hint={t("admin.overview.answeredHint", { answered: d.answered, placed: d.placed })} icon={PhoneIncoming} />
        <Stat label={t("admin.overview.confirmed")} value={d.confirmed} hint={t("admin.overview.confirmedHint", { count: d.open })} icon={CircleCheck} tone="ok" />
        <Stat label={t("admin.overview.openFlags")} value={o.openFlags.length} hint={t("admin.overview.urgentHint", { count: urgent })} icon={Flag} tone={urgent ? "danger" : o.openFlags.length ? "warn" : "neutral"} />
        <Stat label={t("admin.overview.reportsSent")} value={o.reportsSent} hint={t("admin.overview.reportsHint", { count: d.sent })} icon={FileText} />
        <Stat label={t("admin.overview.blocked")} value={o.reportsBlocked} hint={t("admin.overview.blockedHint")} icon={ShieldX} tone={o.reportsBlocked ? "warn" : "neutral"} />
      </div>

      <Section title={t("admin.overview.adminFlags")} icon={ShieldAlert}>
        {adminFlags.length === 0 ? (
          <p className="text-muted">{t("admin.overview.noAdminFlags")}</p>
        ) : (
          <ul className="space-y-2">
            {adminFlags.map((f) => {
              const r = repos.reports.get(f.reportId);
              return (
                <li key={f.id}>
                  <Card className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip size="sm" tone="info" icon={ShieldAlert}>{t(`flag.type.${f.type}`)}</Chip>
                      <span className="text-sm text-muted">{person(f.patientId)} · {dayMonth(f.openedAt)}, {time(f.openedAt)}</span>
                    </div>
                    {r && (
                      <Banner tone="danger">
                        <ul className="list-disc pl-5">
                          {r.check.problems.map((pr, i) => (
                            <li key={i}>{tx(pr.key, pr.params)}</li>
                          ))}
                        </ul>
                      </Banner>
                    )}
                    <Button size="sm" icon={CircleCheck} onClick={() => closeAdminFlag(f.id, adminId, { en: t("admin.overview.checked") })}>
                      {t("admin.overview.checkReport")}
                    </Button>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title={t("admin.overview.week")}>
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <table className="w-full border-collapse text-left text-[15px]">
            <thead className="bg-surface-2">
              <tr>
                <th className="px-3 py-2">{t("admin.overview.day")}</th>
                <th className="px-3 py-2 text-right">{t("admin.overview.calls")}</th>
                <th className="hidden px-3 py-2 text-right @md:table-cell">{t("admin.overview.answered")}</th>
                <th className="px-3 py-2 text-right">{t("admin.overview.doses")}</th>
                <th className="hidden px-3 py-2 text-right @md:table-cell">{t("admin.overview.flags")}</th>
                <th className="px-3 py-2 text-right">{t("admin.overview.reports")}</th>
              </tr>
            </thead>
            <tbody>
              {o.week.map((w) => (
                <tr key={w.date} className="border-t border-line tabular-nums">
                  <td className="px-3 py-2">{weekday(w.date)} {dayMonth(w.date)}</td>
                  <td className="px-3 py-2 text-right">{w.placed}</td>
                  <td className="hidden px-3 py-2 text-right @md:table-cell">{w.placed ? `${Math.round((w.answered / w.placed) * 100)}%` : "–"}</td>
                  <td className="px-3 py-2 text-right">{w.confirmed}</td>
                  <td className="hidden px-3 py-2 text-right @md:table-cell">{w.flags}</td>
                  <td className="px-3 py-2 text-right">{w.sent}{w.blocked ? ` (+${w.blocked})` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </Screen>
  );
}
