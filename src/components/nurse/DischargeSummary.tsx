"use client";

import type { Patient } from "@/domain/types";
import { useT } from "@/i18n/useT";
import { sampleMedicinesFor } from "@/sim/seed";
import { useDemo } from "@/store/store";

/** A drawn placeholder of the uploaded discharge summary, so the nurse has something to type from. */
export function DischargeSummary({ p }: { p: Patient }) {
  const { t, patient, text, date, person } = useT();
  const meds = sampleMedicinesFor(p.id, p.pkg.startDate);
  const hospital = useHospitalName();
  return (
    <figure className="space-y-2">
      <svg viewBox="0 0 340 440" role="img" aria-label={t("nurse.rx.summaryAlt")} className="w-full rounded-xl border border-line bg-white shadow-sm">
        <rect width="340" height="440" fill="#fffef9" />
        <rect x="20" y="20" width="300" height="36" rx="4" fill="#e6efee" />
        <text x="32" y="43" fontSize="14" fontWeight="700" fill="#0d4f49">{hospital}</text>
        <text x="20" y="80" fontSize="15" fontWeight="700" fill="#222">{t("nurse.rx.summary")}</text>
        <text x="20" y="102" fontSize="12" fill="#333">{patient(p)} · {p.age} · {date(p.pkg.startDate)}</text>
        <text x="20" y="120" fontSize="12" fill="#333">{text(p.condition)}</text>
        <text x="20" y="140" fontSize="12" fill="#555">{person(p.doctorId)}</text>
        <line x1="20" y1="152" x2="320" y2="152" stroke="#ccc" />
        <text x="20" y="174" fontSize="13" fontWeight="700" fill="#222">{t("nurse.rx.medicines")}</text>
        {meds.map((m, i) => (
          <g key={m.id}>
            <text x="28" y={198 + i * 40} fontSize="13" fontWeight="600" fill="#1a1a1a" fontFamily="'Segoe Print', 'Comic Sans MS', cursive">
              {i + 1}. {m.name} {m.dose}
            </text>
            <text x="44" y={215 + i * 40} fontSize="11.5" fill="#444" fontFamily="'Segoe Print', 'Comic Sans MS', cursive">
              {m.slots.map((s) => t(`slot.${s}`)).join(" · ")} · {t(`food.${m.food}`)} · {t("common.days", { count: Math.round((Date.parse(m.endDate) - Date.parse(m.startDate)) / 86_400_000) + 1 })}
            </text>
          </g>
        ))}
        <line x1="200" y1="410" x2="310" y2="410" stroke="#999" />
        <text x="200" y="426" fontSize="10" fill="#777">{person(p.doctorId)}</text>
      </svg>
      <figcaption className="text-sm text-muted">{p.dischargeSummary ? t("nurse.rx.uploadedAt", { time: { $time: p.dischargeSummary.uploadedAt } }) : t("nurse.rx.noSummary")}</figcaption>
    </figure>
  );
}

function useHospitalName() {
  const { text } = useT();
  const h = useDemo((s) => s.data?.hospitals[0]);
  return h ? text(h.name) : "";
}
