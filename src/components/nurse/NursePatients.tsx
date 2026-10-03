"use client";

import { ChevronRight, Search } from "lucide-react";
import { useState } from "react";
import { PatientChips, patientSignals } from "@/components/shared/PatientStatus";
import { usePane } from "@/components/shell/PaneContext";
import { Avatar, Card, EmptyState, Input, Screen, ScreenTitle, Segmented } from "@/components/ui";
import { useRepos } from "@/data/useRepos";
import { dayNo } from "@/domain/packages";
import { useSpot } from "@/hooks/useSpot";
import { useT } from "@/i18n/useT";
import { localDate } from "@/lib/time";
import { setUi, useDemo } from "@/store/store";

type Filter = "all" | "verify" | "flags" | "visits";

export function NursePatients() {
  const { t, patient, text, person } = useT();
  const pane = usePane();
  const repos = useRepos();
  const now = useDemo((s) => s.now);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const lakshmiSpot = useSpot<HTMLButtonElement>("nurse.patient.p_lakshmi");

  const list = repos.patients.search(query).filter((p) => {
    const s = patientSignals(repos, p, now);
    if (filter === "verify") return s.reason === "notVerified";
    if (filter === "flags") return s.open.length > 0;
    if (filter === "visits") return Boolean(s.visitToday);
    return true;
  });

  const open = (id: string) => {
    setUi((ui) => ({ selection: { ...ui.selection, nursePatientId: id } }));
    pane.go("patient");
  };

  const empty = query
    ? t("nurse.list.emptySearch", { query })
    : filter === "verify"
      ? t("nurse.list.emptyVerification")
      : filter === "flags"
        ? t("nurse.list.emptyFlags")
        : filter === "visits"
          ? t("nurse.list.emptyVisits")
          : t("nurse.list.emptyAll");

  return (
    <Screen wide>
      <ScreenTitle title={t("nurse.list.title")} />
      <div className="space-y-3">
        <label className="relative block">
          <span className="sr-only">{t("nurse.list.search")}</span>
          <Search aria-hidden size={20} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("nurse.list.search")} className="pl-10" type="search" />
        </label>
        <Segmented<Filter>
          label={t("nurse.list.filters")}
          value={filter}
          onChange={setFilter}
          size="sm"
          options={[
            { value: "all", label: t("nurse.list.all") },
            { value: "verify", label: t("nurse.list.needsVerification") },
            { value: "flags", label: t("nurse.list.openFlags") },
            { value: "visits", label: t("nurse.list.visitsToday") },
          ]}
        />
      </div>
      {list.length === 0 ? (
        <EmptyState title={empty} />
      ) : (
        <ul className="grid gap-3 @desk:grid-cols-2">
          {list.map((p) => (
            <li key={p.id}>
              <Card className="p-0">
                <button
                  ref={p.id === "p_lakshmi" ? lakshmiSpot.ref : undefined}
                  type="button"
                  onClick={() => open(p.id)}
                  className={`flex w-full items-start gap-3 rounded-2xl p-4 text-left hover:bg-surface-2 ${p.id === "p_lakshmi" ? (lakshmiSpot.className ?? "") : ""}`}
                >
                  <Avatar hue={p.hue} size={48} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-bold">{patient(p)}</p>
                    <p className="text-sm text-muted">
                      {text(p.condition)} · {t(`lang.${p.language}`)} · {p.phoneType === "keypad" ? t("patient.keypadPhone") : t("patient.smartphone")}
                    </p>
                    <p className="text-sm text-muted">
                      {t(`pkg.name.${p.pkg.kind}`)} · {t("nurse.list.dayOf", { day: Math.max(1, dayNo(p, localDate(now))), total: p.pkg.lengthDays })}
                      {p.sharesPhoneWith ? ` · ${t("nurse.list.sharesPhone", { person: person(p.sharesPhoneWith) })}` : ""}
                    </p>
                    <PatientChips repos={repos} p={p} now={now} />
                  </div>
                  <ChevronRight aria-hidden size={20} className="mt-1 shrink-0 text-muted" />
                </button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}
