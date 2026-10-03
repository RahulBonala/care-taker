"use client";

import { ChevronRight, MapPin, ShieldAlert } from "lucide-react";
import { usePane } from "@/components/shell/PaneContext";
import { Banner, Card, Chip, EmptyState, Screen, ScreenTitle, Section } from "@/components/ui";
import { useActingAs, useRepos } from "@/data/useRepos";
import type { Visit } from "@/domain/types";
import { useSpot } from "@/hooks/useSpot";
import { useT } from "@/i18n/useT";
import { atLocal, localDate } from "@/lib/time";
import { setUi, useDemo } from "@/store/store";

export function CaregiverToday() {
  const { t } = useT();
  const pane = usePane();
  const repos = useRepos();
  const cgId = useActingAs();
  const me = repos.staff.get(cgId);
  const now = useDemo((s) => s.now);
  const today = localDate(now);
  const mine = repos.visits.forCaregiver(cgId);
  const todays = mine.filter((v) => v.date === today).sort((a, b) => a.windowStart.localeCompare(b.windowStart));
  const later = mine.filter((v) => v.date > today && v.status === "scheduled").slice(0, 6);
  const open = (v: Visit) => {
    setUi((ui) => ({ selection: { ...ui.selection, visitId: v.id } }));
    pane.go("visit");
  };
  return (
    <Screen>
      <ScreenTitle title={t("caregiver.today.title")} />
      {me?.caregiver && !me.caregiver.verified && <Banner tone="warn" icon={ShieldAlert}>{t("caregiver.today.notVerified")}</Banner>}
      {todays.length === 0 ? <EmptyState title={t("caregiver.today.empty")} /> : <ol className="space-y-3">{todays.map((v) => <VisitRow key={v.id} v={v} onOpen={() => open(v)} />)}</ol>}
      <Section title={t("caregiver.today.upcoming")}>{later.length === 0 ? <p className="text-muted">{t("caregiver.today.noUpcoming")}</p> : <ol className="space-y-3">{later.map((v) => <VisitRow key={v.id} v={v} onOpen={() => open(v)} />)}</ol>}</Section>
    </Screen>
  );
}

function VisitRow({ v, onOpen }: { v: Visit; onOpen: () => void }) {
  const { t, time, person, text, weekdayDate } = useT();
  const p = useDemo((s) => s.data?.patients.find((x) => x.id === v.patientId));
  const { ref: spotRef, className: spotCls } = useSpot<HTMLButtonElement>(`caregiver.visit.${v.patientId}`);
  const status = v.status === "completed" ? { tone: "ok" as const, label: t("caregiver.today.done") } : v.status === "missed" ? { tone: "danger" as const, label: t("caregiver.today.missed") } : v.status === "checkedIn" ? { tone: "info" as const, label: t("caregiver.today.inProgress") } : { tone: "neutral" as const, label: t("caregiver.today.due") };
  return (
    <li>
      <Card className="p-0">
        <button ref={spotRef} type="button" onClick={onOpen} className={`flex w-full items-start gap-3 rounded-2xl p-4 text-left hover:bg-surface-2 ${spotCls ?? ""}`}>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-semibold text-brand tabular-nums">
              {time(atLocal(v.date, v.windowStart))} · {weekdayDate(v.date)}
            </p>
            <p className="text-lg font-bold">{person(v.patientId)}</p>
            {p && (
              <p className="flex items-start gap-1.5 text-muted">
                <MapPin aria-hidden size={16} className="mt-1 shrink-0" />
                <span>
                  {text(p.address)} · {t("caregiver.today.distance", { km: p.distanceKm })}
                </span>
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              <Chip size="sm" tone={status.tone}>{status.label}</Chip>
              {v.tasks.map((k) => (
                <Chip key={k} size="sm">{t(`tasks.${k}`)}</Chip>
              ))}
            </div>
          </div>
          <ChevronRight aria-hidden size={20} className="mt-1 shrink-0 text-muted" />
        </button>
      </Card>
    </li>
  );
}
