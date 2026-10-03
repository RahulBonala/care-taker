"use client";

import { CalendarClock, ChevronRight, CircleCheck, CircleX, Search, ShieldAlert, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { usePane } from "@/components/shell/PaneContext";
import { Avatar, Card, Chip, EmptyState, Input, Screen, ScreenTitle, type Tone } from "@/components/ui";
import { useRepos } from "@/data/useRepos";
import { adherence } from "@/domain/doses";
import { useSpot } from "@/hooks/useSpot";
import { useT } from "@/i18n/useT";
import { setUi, useDemo } from "@/store/store";
import { doctorStatus, patientDates, type DoctorStatus } from "./doctorData";

const STATUS: Record<DoctorStatus, { tone: Tone; icon: typeof CircleCheck; key: "doctor.list.onTrack" | "doctor.list.attention" | "doctor.list.reviewDue" | "nurse.list.notVerified" | "shell.packageEnded" }> = {
  onTrack: { tone: "ok", icon: CircleCheck, key: "doctor.list.onTrack" },
  attention: { tone: "danger", icon: TriangleAlert, key: "doctor.list.attention" },
  reviewDue: { tone: "info", icon: CalendarClock, key: "doctor.list.reviewDue" },
  notVerified: { tone: "warn", icon: ShieldAlert, key: "nurse.list.notVerified" },
  ended: { tone: "neutral", icon: CircleX, key: "shell.packageEnded" },
};

export function DoctorPatients() {
  const { t, patient, text } = useT();
  const pane = usePane();
  const repos = useRepos();
  const now = useDemo((s) => s.now);
  const [query, setQuery] = useState("");
  const { ref: searchSpotRef, className: searchSpotCls } = useSpot<HTMLInputElement>("doctor.search");
  const list = repos.patients.search(query);
  const open = (id: string) => {
    setUi((ui) => ({ selection: { ...ui.selection, doctorPatientId: id } }));
    pane.go("patient");
  };
  return (
    <Screen>
      <ScreenTitle title={t("doctor.list.title")} />
      <label className="relative block">
        <span className="sr-only">{t("doctor.list.search")}</span>
        <Search aria-hidden size={20} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
        <Input ref={searchSpotRef} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("doctor.list.search")} className={`pl-10 ${searchSpotCls ?? ""}`} />
      </label>
      {list.length === 0 ? (
        <EmptyState title={query ? t("doctor.list.noMatch", { query }) : t("doctor.list.empty")} />
      ) : (
        <ul className="space-y-2">
          {list.map((p) => {
            const st = STATUS[doctorStatus(repos, p, now)];
            const a = adherence(repos.doses, p, patientDates(p, now), now);
            return (
              <li key={p.id}>
                <Card className="p-0">
                  <button type="button" onClick={() => open(p.id)} className="flex w-full items-center gap-3 rounded-2xl p-4 text-left hover:bg-surface-2">
                    <Avatar hue={p.hue} size={48} />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-bold">{patient(p)}</p>
                      <p className="text-sm text-muted">
                        {text(p.condition)}
                        {a.percent != null ? ` · ${t("doctor.list.adherence", { value: a.percent })}` : ""}
                      </p>
                      <Chip size="sm" tone={st.tone} icon={st.icon}>
                        {t(st.key)}
                      </Chip>
                    </div>
                    <ChevronRight aria-hidden size={20} className="shrink-0 text-muted" />
                  </button>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </Screen>
  );
}
