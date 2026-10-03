"use client";

import { ChevronRight, ShieldAlert } from "lucide-react";
import { AdherenceStrip } from "@/components/shared/AdherenceStrip";
import { usePane } from "@/components/shell/PaneContext";
import { Card, Chip, EmptyState, Screen, ScreenTitle, Section } from "@/components/ui";
import { useT } from "@/i18n/useT";
import { localDate } from "@/lib/time";
import { setUi } from "@/store/store";
import { useFamily } from "./useFamily";

export function FamilyHistory() {
  const { t, weekdayDate } = useT();
  const pane = usePane();
  const { repos, f, p, now } = useFamily();
  if (!f || !p) return <Screen><EmptyState title={t("common.notAllowed")} /></Screen>;
  const reports = repos.reports.forPatient(p.id).slice().reverse();
  const open = (id: string) => {
    setUi((ui) => ({ selection: { ...ui.selection, reportId: id } }));
    pane.go("report");
  };
  return (
    <Screen>
      <ScreenTitle title={t("family.history.title")} />
      <Section title={t("family.history.strip")}>
        <p className="text-sm text-muted">{t("family.history.stripHelp")}</p>
        <AdherenceStrip book={repos.doses} p={p} endDate={localDate(now)} now={now} />
      </Section>
      <Section title={t("nav.family.history")}>
        {reports.length === 0 ? (
          <EmptyState title={t("family.history.empty")} />
        ) : (
          <ul className="space-y-2">
            {reports.map((r) => {
              const summary = r.lines.find((l) => l.kind === "summary");
              return (
                <li key={r.id}>
                  <Card className="p-0">
                    <button type="button" onClick={() => open(r.id)} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold">{weekdayDate(r.date)}</p>
                        {r.status === "blocked" ? (
                          <Chip tone="warn" icon={ShieldAlert} size="sm">{t("family.history.blocked")}</Chip>
                        ) : (
                          <p className="text-muted">{summary ? t("family.history.confirmedOf", { confirmed: Number(summary.params.confirmed), total: Number(summary.params.total) }) : ""}</p>
                        )}
                      </div>
                      <span className="sr-only">{t("family.history.open")}</span>
                      <ChevronRight aria-hidden size={20} className="shrink-0 text-muted" />
                    </button>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </Screen>
  );
}
