"use client";

import { CalendarCheck, CircleCheck, CircleX, Flag, PackagePlus, ScrollText, ShieldCheck, Utensils } from "lucide-react";
import { useEffect, useState } from "react";
import { AdherenceStrip } from "@/components/shared/AdherenceStrip";
import { flagStyle } from "@/components/shared/flagStyle";
import { usePane } from "@/components/shell/PaneContext";
import { Avatar, Banner, Button, Card, Chip, EmptyState, Field, Input, Screen, Section, Segmented, Stat } from "@/components/ui";
import { useActingAs, useRepos } from "@/data/useRepos";
import { adherence } from "@/domain/doses";
import { dayNo } from "@/domain/packages";
import type { PackageLength } from "@/domain/types";
import { useSpot } from "@/hooks/useSpot";
import { useT } from "@/i18n/useT";
import { localDate } from "@/lib/time";
import { requestLongerPackage, setReviewDate, viewed } from "@/store/roleActions";
import { useDemo } from "@/store/store";
import { mealsMentioned, patientDates, vitalsSeries } from "./doctorData";
import { VitalsCharts } from "./VitalsCharts";

export function DoctorPatient() {
  const { t, patient, text, date, time, dayMonth } = useT();
  const pane = usePane();
  const repos = useRepos();
  const doctorId = useActingAs();
  const now = useDemo((s) => s.now);
  const selected = useDemo((s) => s.ui.selection.doctorPatientId);
  const p = repos.patients.get(selected);
  const [review, setReview] = useState(p?.nextReviewDate ?? "");
  const [reviewSaved, setReviewSaved] = useState(false);
  const [length, setLength] = useState<PackageLength>(14);
  const reviewSpot = useSpot<HTMLButtonElement>("doctor.review");

  useEffect(() => {
    if (p) viewed(doctorId, "doctor", p.id, "audit.viewedPatient", p.id);
    setReview(p?.nextReviewDate ?? "");
    setReviewSaved(false);
  }, [p?.id, doctorId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!p) {
    return (
      <Screen>
        <EmptyState title={selected ? t("common.notAllowed") : t("common.selectFirst")} action={<Button onClick={() => pane.go("")}>{t("common.goToList")}</Button>} />
      </Screen>
    );
  }
  const today = localDate(now);
  const all = adherence(repos.doses, p, patientDates(p, now), now);
  const flags = repos.flags.forPatient(p.id).filter((f) => f.urgency !== "admin").sort((a, b) => b.openedAt - a.openedAt);
  const open = flags.filter((f) => f.status !== "closed");
  const meals = mealsMentioned(repos, p);
  const visits = vitalsSeries(repos, p);

  return (
    <Screen wide>
      <Card className="flex flex-wrap items-center gap-4">
        <Avatar hue={p.hue} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{patient(p)}</h1>
          <p className="text-muted">
            {t("nurse.patient.age", { age: p.age })} · {text(p.condition)} · {t(`pkg.name.${p.pkg.kind}`)} · {t("nurse.list.dayOf", { day: Math.max(1, dayNo(p, today)), total: p.pkg.lengthDays })}
          </p>
        </div>
        <Button icon={ScrollText} onClick={() => pane.go("weekly")}>
          {t("doctor.summary.weekly")}
        </Button>
      </Card>

      <div className="grid gap-3 @md:grid-cols-2 @desk:grid-cols-4">
        <Stat label={t("doctor.summary.adherence")} value={all.percent == null ? "–" : `${all.percent}%`} hint={t("doctor.summary.adherenceHint", { confirmed: all.confirmed, due: all.due })} icon={CircleCheck} tone={all.percent != null && all.percent < 80 ? "warn" : "ok"} />
        <Stat label={t("doctor.summary.missed")} value={all.missed} icon={CircleX} tone={all.missed ? "danger" : "neutral"} />
        <Stat label={t("doctor.summary.flags")} value={open.length} icon={Flag} tone={open.length ? "warn" : "neutral"} />
        <Stat label={t("doctor.summary.caregiverShare")} value={all.confirmed ? `${Math.round((all.caregiverConfirmed / all.confirmed) * 100)}%` : "–"} hint={t("doctor.summary.caregiverHint", { count: all.caregiverConfirmed })} icon={ShieldCheck} />
      </div>

      <Section title={t("doctor.summary.strip")}>
        <AdherenceStrip book={repos.doses} p={p} endDate={today} now={now} />
      </Section>

      <Section title={t("doctor.summary.vitals")}>
        <Card>
          <VitalsCharts visits={visits} />
        </Card>
      </Section>

      <div className="grid gap-6 @desk:grid-cols-2">
        <Section title={t("doctor.summary.flagsTitle")} icon={Flag}>
          {flags.length === 0 ? (
            <EmptyState title={t("doctor.summary.noFlags")} />
          ) : (
            <ul className="space-y-2">
              {flags.slice(0, 10).map((f) => {
                const st = flagStyle(f);
                return (
                  <li key={f.id}>
                    <Card className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Chip size="sm" tone={st.tone} icon={st.icon}>
                          {t(`flag.type.${f.type}`)}
                        </Chip>
                        <span className="text-sm text-muted">
                          {dayMonth(f.openedAt)}, {time(f.openedAt)}
                        </span>
                      </div>
                      <p className="text-[15px]">{f.status === "closed" ? text(f.outcome) : t("doctor.summary.stillOpen")}</p>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <div className="space-y-6">
          <Section title={t("doctor.summary.meals")} icon={Utensils}>
            <Card>
              {meals.count === 0 ? (
                <p className="text-muted">{t("doctor.summary.mealsNone")}</p>
              ) : (
                <p>
                  {t("doctor.summary.mealsLine", {
                    count: meals.count,
                    slots: [...meals.bySlot.entries()].map(([slot, n]) => `${t(`slot.${slot as "lunch"}`)} ${n}`).join(", "),
                  })}
                </p>
              )}
            </Card>
          </Section>

          <Section title={t("doctor.summary.review")} icon={CalendarCheck}>
            <Card className="space-y-3">
              <Field label={t("doctor.summary.review")} htmlFor="review" hint={p.nextReviewDate ? date(p.nextReviewDate) : undefined}>
                <Input id="review" type="date" min={today} value={review} onChange={(e) => { setReview(e.target.value); setReviewSaved(false); }} />
              </Field>
              {reviewSaved && <Banner tone="ok">{t("doctor.summary.reviewSaved")}</Banner>}
              <Button
                ref={reviewSpot.ref}
                className={reviewSpot.className}
                variant="primary"
                icon={CalendarCheck}
                disabled={!review}
                onClick={() => {
                  setReviewDate(p.id, doctorId, review);
                  setReviewSaved(true);
                }}
              >
                {t("doctor.summary.setReview")}
              </Button>
            </Card>
          </Section>

          <Section title={t("doctor.summary.longer")} icon={PackagePlus}>
            <Card className="space-y-3">
              <p className="text-muted">{t("doctor.summary.longerHelp")}</p>
              <Segmented<string> label={t("doctor.summary.longer")} value={String(length)} onChange={(v) => setLength(Number(v) as PackageLength)} options={[7, 14, 30].map((d) => ({ value: String(d), label: t("pkg.length", { days: d }) }))} />
              {p.packageRequest && <Banner tone="info">{t("doctor.summary.requested", { days: p.packageRequest.lengthDays, date: date(p.packageRequest.at) })}</Banner>}
              <Button icon={PackagePlus} onClick={() => requestLongerPackage(p.id, doctorId, length)}>
                {t("doctor.summary.send")}
              </Button>
            </Card>
          </Section>
        </div>
      </div>
    </Screen>
  );
}
