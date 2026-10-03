"use client";

import { CircleCheck, Clock, ShieldAlert } from "lucide-react";
import { useMemo } from "react";
import { ReportLines } from "@/components/shared/ReportView";
import { Banner, Chip, EmptyState, Screen, ScreenTitle, Section } from "@/components/ui";
import { buildReportLines } from "@/domain/reports";
import { useT } from "@/i18n/useT";
import { addDays, dateRange, localDate } from "@/lib/time";
import { setUi, useDemo } from "@/store/store";
import { cn } from "@/lib/cn";
import { useFamily } from "./useFamily";
import { WhatsAppPreview } from "./WhatsAppPreview";

export function FamilyReport() {
  const { t, dayMonth, weekday } = useT();
  const { repos, f, p, now } = useFamily();
  const data = useDemo((s) => s.data)!;
  const selectedId = useDemo((s) => s.ui.selection.reportId);
  const today = localDate(now);
  const reports = p ? repos.reports.forPatient(p.id) : [];
  const selected = reports.find((r) => r.id === selectedId);
  const day = selected?.date ?? today;
  const report = selected ?? reports.filter((r) => r.date === today).at(-1);
  const live = useMemo(() => (p && !report && day === today ? buildReportLines(data, p, today, now) : null), [data, p, report, day, today, now]);

  if (!f || !p) return <Screen><EmptyState title={t("common.notAllowed")} /></Screen>;

  const first = p.pkg.startDate > addDays(today, -6) ? p.pkg.startDate : addDays(today, -6);
  const days = dateRange(first, today).reverse();
  const pick = (date: string) => {
    const r = reports.filter((x) => x.date === date).at(-1);
    setUi((ui) => ({ selection: { ...ui.selection, reportId: r?.id ?? (date === today ? undefined : `none:${date}`) } }));
  };
  const showingNone = selectedId?.startsWith("none:");
  const shownDay = showingNone ? selectedId!.slice(5) : day;

  return (
    <Screen wide>
      <ScreenTitle title={t("family.report.title")} subtitle={`${t("report.forPatient", { patient: { $person: p.id }, date: { $date: shownDay } })}`} />
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label={t("family.report.pickDay")}>
        {days.map((d) => {
          const on = d === shownDay;
          return (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => pick(d)}
              className={cn("flex min-h-14 shrink-0 flex-col items-center justify-center rounded-xl border px-3 text-sm font-semibold", on ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface text-muted hover:bg-surface-2")}
            >
              <span>{d === today ? t("common.today") : weekday(d)}</span>
              <span className="text-ink">{dayMonth(d)}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 @desk:grid-cols-[1fr_minmax(300px,380px)]">
        <div className="min-w-0 space-y-4">
          {showingNone ? (
            <EmptyState title={t("family.report.none")} />
          ) : report ? (
            report.status === "blocked" ? (
              <Banner tone="warn" icon={ShieldAlert}>{t("family.report.delayed")}</Banner>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone="ok" icon={CircleCheck}>{t("report.checkPassed")}</Chip>
                  <Chip tone="neutral" icon={Clock}>{t("family.report.sentAt", { time: { $time: report.generatedAt } })}</Chip>
                </div>
                <p className="text-sm text-muted">{t("report.tapHint")}</p>
                <ReportLines lines={report.lines} />
              </>
            )
          ) : live ? (
            <>
              <Banner tone="info" icon={Clock} title={t("family.report.liveView")}>
                {t("family.report.notYet")}
              </Banner>
              <p className="text-sm text-muted">{t("report.tapHint")}</p>
              <ReportLines lines={live} />
            </>
          ) : (
            <EmptyState title={t("family.report.none")} />
          )}
        </div>
        <Section title={t("family.report.whatsapp")}>
          <WhatsAppPreview f={f} p={p} />
        </Section>
      </div>
    </Screen>
  );
}
