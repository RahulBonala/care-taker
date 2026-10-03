"use client";

import { Download, Printer } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { PrintPortal } from "@/components/shared/PrintPortal";
import { usePane } from "@/components/shell/PaneContext";
import { Button, Card, EmptyState, Screen, ScreenTitle } from "@/components/ui";
import type { Repos } from "@/data/repos";
import { useActingAs, useRepos } from "@/data/useRepos";
import { adherence } from "@/domain/doses";
import type { Patient } from "@/domain/types";
import { useT } from "@/i18n/useT";
import { addDays, localDate } from "@/lib/time";
import { viewed } from "@/store/roleActions";
import { useDemo } from "@/store/store";
import { mealsMentioned, patientDates } from "./doctorData";

export function DoctorWeekly() {
  const { t } = useT();
  const pane = usePane();
  const repos = useRepos();
  const doctorId = useActingAs();
  const now = useDemo((s) => s.now);
  const selected = useDemo((s) => s.ui.selection.doctorPatientId);
  const p = repos.patients.get(selected);
  useEffect(() => {
    if (p) viewed(doctorId, "doctor", `${p.id}-weekly`, "audit.viewedReport", p.id);
  }, [p?.id, doctorId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!p) return <Screen><EmptyState title={t("common.selectFirst")} action={<Button onClick={() => pane.go("")}>{t("common.goToList")}</Button>} /></Screen>;
  return (
    <Screen>
      <ScreenTitle
        title={t("doctor.weekly.title")}
        action={
          <div className="flex flex-wrap gap-2">
            <Button icon={Printer} onClick={() => window.print()}>
              {t("common.print")}
            </Button>
            <Button variant="primary" icon={Download} onClick={() => window.print()}>
              {t("common.downloadPdf")}
            </Button>
          </div>
        }
      />
      <p className="text-sm text-muted">{t("doctor.weekly.printHint")}</p>
      <Card className="p-5">
        <WeeklyDoc p={p} repos={repos} now={now} doctorId={doctorId} />
      </Card>
      <PrintPortal>
        <WeeklyDoc p={p} repos={repos} now={now} doctorId={doctorId} />
      </PrintPortal>
    </Screen>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5 break-inside-avoid">
      <h3 className="mb-2 border-b border-line pb-1 text-lg font-bold">{title}</h3>
      {children}
    </section>
  );
}

function WeeklyDoc({ p, repos, now, doctorId }: { p: Patient; repos: Repos; now: number; doctorId: string }) {
  const { t, patient, text, date, dayMonth, weekday, time, person } = useT();
  const hospital = useDemo((s) => s.data?.hospitals[0]);
  const days = patientDates(p, now, 7);
  const from = days[0] ?? localDate(now);
  const week = adherence(repos.doses, p, days, now);
  const flags = repos.flags.forPatient(p.id).filter((f) => f.urgency !== "admin" && localDate(f.openedAt) >= from);
  const visits = repos.visits.forPatient(p.id).filter((v) => v.status === "completed" && v.date >= from && v.vitals);
  const notes = repos.log.forPatient(p.id).filter((e) => e.kind === "nurseNote" && localDate(e.at) >= from);
  const meals = mealsMentioned(repos, p, from);
  return (
    <article className="text-ink">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b-2 border-ink pb-2">
        <div>
          <p className="text-sm font-semibold">{hospital ? text(hospital.name) : ""}</p>
          <h2 className="text-xl font-bold">
            {t("doctor.weekly.title")} · {patient(p)}
          </h2>
          <p className="text-sm">
            {t("nurse.patient.age", { age: p.age })} · {text(p.condition)} · {person(doctorId)}
          </p>
        </div>
        <p className="text-sm font-semibold">{t("doctor.weekly.period", { from: date(from), to: date(addDays(from, Math.max(0, days.length - 1))) })}</p>
      </header>

      <Block title={`${t("doctor.summary.adherence")}: ${week.percent == null ? "–" : `${week.percent}%`} (${week.confirmed}/${week.due})`}>
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="py-1 pr-2">{t("doctor.weekly.day")}</th>
              <th className="py-1 pr-2">{t("doctor.weekly.confirmed")}</th>
              <th className="py-1 pr-2">{t("doctor.weekly.missed")}</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const a = adherence(repos.doses, p, [d], now);
              return (
                <tr key={d} className="border-b border-line">
                  <td className="py-1 pr-2">
                    {weekday(d)} {dayMonth(d)}
                  </td>
                  <td className="py-1 pr-2 tabular-nums">
                    {a.confirmed}/{a.due}
                  </td>
                  <td className="py-1 pr-2 tabular-nums">{a.missed}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Block>

      <Block title={t("doctor.weekly.vitals")}>
        {visits.length === 0 ? (
          <p className="text-sm">{t("doctor.weekly.none")}</p>
        ) : (
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="py-1 pr-2">{t("common.date")}</th>
                <th className="py-1 pr-2">{t("vitals.bp")}</th>
                <th className="py-1 pr-2">{t("vitals.pulse")}</th>
                <th className="py-1 pr-2">{t("vitals.spo2")}</th>
                <th className="py-1 pr-2">{t("vitals.tempC")}</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => (
                <tr key={v.id} className="border-b border-line tabular-nums">
                  <td className="py-1 pr-2">{dayMonth(v.date)}</td>
                  <td className="py-1 pr-2">{v.vitals?.bpSys != null ? `${v.vitals.bpSys}/${v.vitals.bpDia}` : "–"}</td>
                  <td className="py-1 pr-2">{v.vitals?.pulse ?? "–"}</td>
                  <td className="py-1 pr-2">{v.vitals?.spo2 ?? "–"}</td>
                  <td className="py-1 pr-2">{v.vitals?.tempC ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Block>

      <Block title={t("doctor.weekly.flags")}>
        {flags.length === 0 ? (
          <p className="text-sm">{t("doctor.weekly.none")}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {flags.map((f) => (
              <li key={f.id}>
                <span className="font-semibold">
                  {dayMonth(f.openedAt)} {time(f.openedAt)} · {t(`flag.type.${f.type}`)}:
                </span>{" "}
                {f.status === "closed" ? text(f.outcome) : t("doctor.summary.stillOpen")}
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block title={t("doctor.summary.meals")}>
        <p className="text-sm">{meals.count ? t("doctor.summary.mealsLine", { count: meals.count, slots: [...meals.bySlot.entries()].map(([s, n]) => `${t(`slot.${s as "lunch"}`)} ${n}`).join(", ") }) : t("doctor.summary.mealsNone")}</p>
      </Block>

      <Block title={t("doctor.weekly.notes")}>
        {notes.length === 0 ? (
          <p className="text-sm">{t("doctor.weekly.none")}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {notes.map((n) => (
              <li key={n.id}>
                <span className="font-semibold">
                  {dayMonth(n.at)} {time(n.at)} · {person(n.by)}:
                </span>{" "}
                {n.kind === "nurseNote" ? text(n.text) : ""}
              </li>
            ))}
          </ul>
        )}
      </Block>
      <p className="mt-6 text-[12px]">{t("doctor.weekly.generated", { time: `${date(now)} ${time(now)}` })}</p>
    </article>
  );
}
