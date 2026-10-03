"use client";

import { CircleCheck, Smartphone } from "lucide-react";
import { useState } from "react";
import { DoseChip } from "@/components/shared/DoseStatus";
import { Banner, Button, Card, EmptyState, Screen, ScreenTitle, Sheet } from "@/components/ui";
import { useActingAs, useRepos } from "@/data/useRepos";
import { medicinesFor, verifiedPrescription } from "@/domain/schedule";
import type { Slot } from "@/domain/types";
import { useSpot } from "@/hooks/useSpot";
import { useT } from "@/i18n/useT";
import { localDate } from "@/lib/time";
import { confirmTakenInApp } from "@/store/actions";
import { useDemo } from "@/store/store";

/** Large-button screen for patients who do use a smartphone. */
export function PatientToday() {
  const { t, time, patient } = useT();
  const repos = useRepos();
  const p = repos.patients.get(useActingAs());
  const now = useDemo((s) => s.now);
  const [confirm, setConfirm] = useState<Slot | null>(null);
  const spot = useSpot<HTMLButtonElement>("patient.today.taken");
  if (!p) return <Screen><EmptyState title={t("common.notAllowed")} /></Screen>;
  const date = localDate(now);
  const views = repos.doses.day(p, date, now);
  const rx = verifiedPrescription(p);

  return (
    <Screen>
      <ScreenTitle title={t("nav.patient.today")} subtitle={t("patient.todayIntro")} />
      {p.phoneType === "keypad" && <Banner tone="info" icon={Smartphone}>{t("patient.smartphoneOnly", { patient: patient(p) })}</Banner>}
      {views.length === 0 ? (
        <EmptyState title={t("patient.noDosesToday")} />
      ) : (
        <ol className="space-y-4">
          {views.map((v, i) => {
            const meds = rx ? medicinesFor(rx.medicines, date, v.slot) : [];
            const open = v.status === "due" || v.status === "postponed";
            const reached = v.callAt - 60 * 60_000 <= now;
            return (
              <li key={v.slot}>
                <Card className="space-y-4 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-2xl font-bold">
                      {t(`slot.${v.slot}`)} <span className="font-normal text-muted">· {time(v.callAt)}</span>
                    </h2>
                    <DoseChip view={v} />
                  </div>
                  <ul className="space-y-2 text-lg">
                    {meds.map((m) => (
                      <li key={m.id} className="flex flex-wrap justify-between gap-x-3 border-b border-line pb-2 last:border-0">
                        <span className="font-semibold">
                          {m.name} {m.dose}
                        </span>
                        <span className="text-muted">
                          {t("common.tablets", { count: m.perDose })} · {t(`food.${m.food}`)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {open && (
                    <Button
                      ref={i === views.findIndex((x) => x.status === "due" || x.status === "postponed") ? spot.ref : undefined}
                      size="xl"
                      variant={reached ? "ok" : "secondary"}
                      full
                      icon={CircleCheck}
                      disabled={!reached}
                      onClick={() => setConfirm(v.slot)}
                      className={i === views.findIndex((x) => x.status === "due" || x.status === "postponed") ? spot.className : undefined}
                    >
                      {reached ? t("patient.takenButton", { slot: t(`slot.${v.slot}`) }) : t("patient.notYetTime")}
                    </Button>
                  )}
                </Card>
              </li>
            );
          })}
        </ol>
      )}
      <Sheet
        open={confirm != null}
        onClose={() => setConfirm(null)}
        title={t("patient.confirmTitle")}
        footer={
          <>
            <Button size="lg" onClick={() => setConfirm(null)}>
              {t("patient.confirmNo")}
            </Button>
            <Button
              size="lg"
              variant="ok"
              icon={CircleCheck}
              onClick={() => {
                if (confirm) confirmTakenInApp(p.id, date, confirm);
                setConfirm(null);
              }}
            >
              {t("patient.confirmYes")}
            </Button>
          </>
        }
      >
        {confirm && <p className="text-xl">{t("patient.confirmBody", { slotTablets: t(`call.slotTablets.${confirm}`), time: { $time: now } })}</p>}
      </Sheet>
    </Screen>
  );
}
