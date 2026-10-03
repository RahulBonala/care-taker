"use client";

import { BadgeCheck, CalendarClock, CircleX, ClipboardCheck, Mic, TriangleAlert } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { Avatar, Card, Chip } from "@/components/ui";
import type { Visit } from "@/domain/types";
import { useT } from "@/i18n/useT";
import { atLocal } from "@/lib/time";
import { useDemo } from "@/store/store";

/** One home visit: when, who, whether it was verified, what was recorded. */
export function VisitCard({ v, action, showPatient }: { v: Visit; action?: ReactNode; showPatient?: boolean }) {
  const { t, time, date, person, text } = useT();
  const staff = useDemo((s) => s.data?.staff.find((x) => x.id === v.caregiverId));
  const patient = useDemo((s) => s.data?.patients.find((p) => p.id === v.patientId));
  const meds = useMemo(() => patient?.prescriptions.flatMap((r) => r.medicines) ?? [], [patient]);
  const matched = v.pillCounts?.length ? v.pillCounts.every((c) => c.counted === c.expected) : undefined;
  return (
    <Card className="space-y-3">
      <div className="flex items-start gap-3">
        <Avatar hue={staff ? (staff.id.length * 47) % 360 : 200} size={48} />
        <div className="min-w-0 flex-1">
          <p className="font-bold">{showPatient ? person(v.patientId) : v.caregiverId ? person(v.caregiverId) : t("family.visits.notAssigned")}</p>
          <p className="text-muted">
            {t("family.visits.dayN", { day: v.dayNo })} · {t("family.visits.window", { date: date(v.date), from: time(atLocal(v.date, v.windowStart)), to: time(atLocal(v.date, v.windowEnd)) })}
          </p>
          {showPatient && v.caregiverId && <p className="text-sm text-muted">{person(v.caregiverId)}</p>}
        </div>
        {v.status === "completed" && v.verified && (
          <Chip tone="ok" icon={BadgeCheck} size="sm">
            {t("family.visits.verified")}
          </Chip>
        )}
        {v.status === "missed" && (
          <Chip tone="danger" icon={CircleX} size="sm">
            {t("family.visits.missed")}
          </Chip>
        )}
        {v.status === "scheduled" && (
          <Chip tone="neutral" icon={CalendarClock} size="sm">
            {t("family.visits.upcoming")}
          </Chip>
        )}
        {v.status === "checkedIn" && (
          <Chip tone="info" icon={ClipboardCheck} size="sm">
            {t("caregiver.checkedIn")}
          </Chip>
        )}
      </div>
      {v.status === "completed" && (
        <div className="space-y-1.5 rounded-xl bg-surface-2 p-3 text-[15px]">
          {v.verified && <p className="text-sm text-muted">{t("family.visits.verifiedHow")}</p>}
          <p className="font-semibold">{t("family.visits.recorded")}</p>
          {v.vitals && (
            <p>
              {[
                v.vitals.bpSys != null ? `${t("vitals.bp")} ${v.vitals.bpSys}/${v.vitals.bpDia}` : null,
                v.vitals.pulse != null ? `${t("vitals.pulse")} ${v.vitals.pulse}` : null,
                v.vitals.spo2 != null ? `${t("vitals.spo2")} ${v.vitals.spo2}${t("vitals.unitSpo2")}` : null,
                v.vitals.tempC != null ? `${t("vitals.tempC")} ${v.vitals.tempC} ${t("vitals.unitTemp")}` : null,
                v.vitals.sugar != null ? `${t("vitals.sugar")} ${v.vitals.sugar}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {matched != null && (
            <p className={matched ? "flex items-center gap-1.5 text-ok" : "flex items-center gap-1.5 text-warn"}>
              {matched ? <ClipboardCheck aria-hidden size={16} /> : <TriangleAlert aria-hidden size={16} />}
              {matched ? t("family.visits.pillMatched") : t("family.visits.pillMismatch")}
            </p>
          )}
          {v.pillCounts && !matched && (
            <ul className="text-sm text-muted">
              {v.pillCounts.map((c) => {
                const m = meds.find((x) => x.id === c.medicineId);
                return (
                  <li key={c.medicineId}>
                    {m ? `${m.name} ${m.dose}` : c.medicineId}: {c.counted} / {c.expected}
                  </li>
                );
              })}
            </ul>
          )}
          {v.note && text(v.note) && <p className="text-muted">{text(v.note)}</p>}
          {v.voiceNoteSeconds ? (
            <p className="flex items-center gap-1.5 text-sm text-muted">
              <Mic aria-hidden size={14} />
              {t("caregiver.voiceNoteSaved", { seconds: v.voiceNoteSeconds })}
            </p>
          ) : null}
        </div>
      )}
      {action}
    </Card>
  );
}
