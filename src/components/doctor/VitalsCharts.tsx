"use client";

import { LineChart } from "@/components/charts/LineChart";
import { EmptyState } from "@/components/ui";
import type { Visit } from "@/domain/types";
import { useT } from "@/i18n/useT";

/** Small multiples: one chart per measure, each with its own single y-axis. */
export function VitalsCharts({ visits }: { visits: Visit[] }) {
  const { t, dayMonth } = useT();
  if (!visits.length) return <EmptyState title={t("doctor.summary.noVitals")} />;
  const labels = visits.map((v) => dayMonth(v.date));
  const pick = (k: "bpSys" | "bpDia" | "pulse" | "spo2" | "tempC" | "sugar") => visits.map((v) => v.vitals?.[k] ?? null);
  const has = (k: "pulse" | "spo2" | "tempC" | "sugar") => pick(k).some((x) => x != null);
  return (
    <div className="grid gap-6 @desk:grid-cols-2">
      <LineChart
        title={t("vitals.bp")}
        unit={t("vitals.unitBp")}
        labels={labels}
        series={[
          { name: t("vitals.bpSys"), color: "var(--series-1)", values: pick("bpSys") },
          { name: t("vitals.bpDia"), color: "var(--series-2)", values: pick("bpDia") },
        ]}
      />
      {has("pulse") && <LineChart title={t("vitals.pulse")} unit={t("vitals.unitPulse")} labels={labels} series={[{ name: t("vitals.pulse"), color: "var(--series-1)", values: pick("pulse") }]} />}
      {has("spo2") && <LineChart title={t("vitals.spo2")} unit={t("vitals.unitSpo2")} labels={labels} series={[{ name: t("vitals.spo2"), color: "var(--series-1)", values: pick("spo2") }]} />}
      {has("tempC") && <LineChart title={t("vitals.tempC")} unit={t("vitals.unitTemp")} labels={labels} series={[{ name: t("vitals.tempC"), color: "var(--series-1)", values: pick("tempC") }]} />}
      {has("sugar") && <LineChart title={t("vitals.sugar")} unit={t("vitals.unitSugar")} labels={labels} series={[{ name: t("vitals.sugar"), color: "var(--series-1)", values: pick("sugar") }]} />}
    </div>
  );
}
