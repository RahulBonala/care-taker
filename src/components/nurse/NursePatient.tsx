"use client";

import { ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { PatientChips } from "@/components/shared/PatientStatus";
import { Avatar, Banner, Card, EmptyState, KV, Screen, Segmented } from "@/components/ui";
import { useActingAs, useRepos } from "@/data/useRepos";
import { dayNo } from "@/domain/packages";
import { awaitingVerification, currentPrescription } from "@/domain/schedule";
import { useT } from "@/i18n/useT";
import { localDate } from "@/lib/time";
import { viewed } from "@/store/roleActions";
import { useDemo } from "@/store/store";
import { usePane } from "@/components/shell/PaneContext";
import { CarePanel, ConsentPanel, LogPanel, SchedulePanel } from "./PatientPanels";
import { RxPanel } from "./RxPanel";

type Tab = "prescription" | "schedule" | "care" | "log" | "consent";

export function NursePatient() {
  const { t, patient, text, person } = useT();
  const pane = usePane();
  const repos = useRepos();
  const nurseId = useActingAs();
  const now = useDemo((s) => s.now);
  const selected = useDemo((s) => s.ui.selection.nursePatientId);
  const p = repos.patients.get(selected);
  const [tab, setTab] = useState<Tab>("prescription");

  useEffect(() => {
    if (p) viewed(nurseId, "nurse", p.id, "audit.viewedPatient", p.id);
  }, [p?.id, nurseId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!p) {
    return (
      <Screen>
        <EmptyState title={t("common.selectFirst")} action={<button type="button" className="font-semibold text-brand underline" onClick={() => pane.go("")}>{t("common.goToList")}</button>} />
      </Screen>
    );
  }
  const family = repos.family.forPatient(p.id);
  const rx = currentPrescription(p);

  return (
    <Screen wide>
      <Card className="flex flex-wrap items-start gap-4">
        <Avatar hue={p.hue} size={56} />
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-2xl font-bold">{patient(p)}</h1>
          <p className="text-muted">
            {t("nurse.patient.age", { age: p.age })} · {text(p.condition)} · {t(`lang.${p.language}`)} · {p.phoneType === "keypad" ? t("patient.keypadPhone") : t("patient.smartphone")}
          </p>
          <PatientChips repos={repos} p={p} now={now} />
        </div>
      </Card>

      {awaitingVerification(p) && <Banner tone="warn" icon={ShieldAlert}>{t("nurse.patient.notVerifiedBanner")}</Banner>}

      <details className="rounded-2xl border border-line bg-surface p-4">
        <summary className="cursor-pointer font-bold">{t("nurse.patient.details")}</summary>
        <KV
          className="mt-2"
          rows={[
            [t("common.phone"), `${p.phone}${p.sharesPhoneWith ? ` · ${t("nurse.list.sharesPhone", { person: person(p.sharesPhoneWith) })}` : ""}`],
            [t("common.address"), text(p.address)],
            [t("nurse.patient.doctor"), person(p.doctorId)],
            [t("nurse.patient.family"), family.map((f) => `${text(f.name)} (${t(`relation.${f.relation}`)}) ${f.phone}`).join(", ") || "–"],
            [t("nurse.patient.package"), `${t(`pkg.name.${p.pkg.kind}`)} · ${t("nurse.list.dayOf", { day: Math.max(1, dayNo(p, localDate(now))), total: p.pkg.lengthDays })}`],
          ]}
        />
      </details>

      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <Segmented<Tab>
          label={t("nurse.patient.details")}
          value={tab}
          onChange={setTab}
          className="flex-nowrap"
          options={(["prescription", "schedule", "care", "log", "consent"] as Tab[]).map((v) => ({ value: v, label: t(`nurse.patient.tabs.${v}`) }))}
        />
      </div>

      {tab === "prescription" && <RxPanel key={rx?.id ?? "none"} p={p} nurseId={nurseId} />}
      {tab === "schedule" && <SchedulePanel p={p} nurseId={nurseId} />}
      {tab === "care" && <CarePanel key={JSON.stringify(p.carePlan)} p={p} repos={repos} nurseId={nurseId} />}
      {tab === "log" && <LogPanel p={p} repos={repos} nurseId={nurseId} />}
      {tab === "consent" && <ConsentPanel p={p} nurseId={nurseId} />}
    </Screen>
  );
}
