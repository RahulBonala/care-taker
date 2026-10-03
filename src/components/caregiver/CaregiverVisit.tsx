"use client";

import { BadgeCheck, CircleAlert, CircleCheck, LogIn, LogOut, MapPin, Mic, Phone, Sparkles, Square, Trash, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { VisitCard } from "@/components/shared/VisitCard";
import { usePane } from "@/components/shell/PaneContext";
import { Banner, Button, Card, Checkbox, EmptyState, Field, Input, Screen, Section, Sheet, Textarea } from "@/components/ui";
import { useActingAs, useRepos } from "@/data/useRepos";
import { verifiedPrescription } from "@/domain/schedule";
import type { Vitals, VisitTask } from "@/domain/types";
import { expectedPillCounts, VITAL_RANGES } from "@/domain/visits";
import { useSpot } from "@/hooks/useSpot";
import { useT } from "@/i18n/useT";
import { atLocal, localDate } from "@/lib/time";
import { caregiverCheckIn, caregiverCheckOut, caregiverReportUnwell } from "@/store/roleActions";
import { useDemo } from "@/store/store";

type VitalKey = keyof typeof VITAL_RANGES;
const VITAL_FIELDS: Array<{ key: VitalKey; label: string; unit: string; step: string }> = [
  { key: "bpSys", label: "vitals.bpSys", unit: "vitals.unitBp", step: "1" },
  { key: "bpDia", label: "vitals.bpDia", unit: "vitals.unitBp", step: "1" },
  { key: "pulse", label: "vitals.pulse", unit: "vitals.unitPulse", step: "1" },
  { key: "tempC", label: "vitals.tempC", unit: "vitals.unitTemp", step: "0.1" },
  { key: "spo2", label: "vitals.spo2", unit: "vitals.unitSpo2", step: "1" },
  { key: "sugar", label: "vitals.sugar", unit: "vitals.unitSugar", step: "1" },
];

export function CaregiverVisit() {
  const tr = useT();
  const { t, time, person, text, date } = tr;
  const pane = usePane();
  const repos = useRepos();
  const cgId = useActingAs();
  const now = useDemo((s) => s.now);
  const data = useDemo((s) => s.data)!;
  const visitId = useDemo((s) => s.ui.selection.visitId);
  const v = repos.visits.get(visitId);
  const p = repos.patients.get(v?.patientId);
  const nurse = repos.staff.get(p?.nurseId);

  const [vitals, setVitals] = useState<Record<string, string>>({});
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [voice, setVoice] = useState(0);
  const [recording, setRecording] = useState(false);
  const [done, setDone] = useState<VisitTask[]>([]);
  const [error, setError] = useState("");
  const [unwell, setUnwell] = useState<"closed" | "confirm" | "sent">("closed");
  const [checking, setChecking] = useState(false);
  const checkInSpot = useSpot<HTMLButtonElement>("caregiver.checkIn");
  const fillSpot = useSpot<HTMLButtonElement>("caregiver.fillCounts");
  const checkOutSpot = useSpot<HTMLButtonElement>("caregiver.checkOut");
  const unwellSpot = useSpot<HTMLButtonElement>("caregiver.unwell");

  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => setVoice((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [recording]);

  if (!v || !p) {
    return (
      <Screen>
        <EmptyState title={t("caregiver.visit.notFound")} action={<Button onClick={() => pane.go("")}>{t("common.goToList")}</Button>} />
      </Screen>
    );
  }

  const rx = verifiedPrescription(p);
  const expected = v.tasks.includes("pillCount") ? expectedPillCounts(data, p, now) : [];
  const vitalFields = VITAL_FIELDS.filter((f) => (f.key === "sugar" ? v.tasks.includes("sugar") : v.tasks.includes("vitals")));
  const vitalError = (key: VitalKey) => {
    const raw = vitals[key];
    if (raw == null || raw === "") return "";
    const n = Number(raw);
    const [min, max] = VITAL_RANGES[key];
    return Number.isFinite(n) && n >= min && n <= max ? "" : t("vitals.range", { min, max });
  };
  const anyVitalError = vitalFields.some((f) => vitalError(f.key));
  const vitalsEntered = vitalFields.some((f) => vitals[f.key]);
  const countsEntered = expected.length > 0 && expected.every((c) => counts[c.medicineId] !== undefined && counts[c.medicineId] !== "");
  const autoDone: VisitTask[] = [...(vitalsEntered ? (["vitals"] as VisitTask[]) : []), ...(countsEntered ? (["pillCount"] as VisitTask[]) : []), ...(v.tasks.includes("sugar") && vitals.sugar ? (["sugar"] as VisitTask[]) : [])];
  const isDone = (k: VisitTask) => done.includes(k) || autoDone.includes(k);
  const isToday = v.date === localDate(now);

  const checkOut = () => {
    if (anyVitalError) return setError(t("caregiver.visit.fixErrors"));
    if (v.tasks.includes("pillCount") && !countsEntered) return setError(t("caregiver.visit.countAll"));
    setError("");
    const vit: Vitals = {};
    for (const f of vitalFields) if (vitals[f.key]) vit[f.key] = Number(vitals[f.key]);
    caregiverCheckOut(v.id, {
      vitals: vit,
      counts: expected.map((c) => ({ ...c, counted: Number(counts[c.medicineId]) })),
      note: note.trim() ? { en: note.trim() } : undefined,
      voiceNoteSeconds: voice || undefined,
      tasksDone: v.tasks.filter(isDone),
    });
  };

  const header = (
    <Card className="space-y-2">
      <p className="text-2xl font-bold">{person(p.id)}</p>
      <p className="flex items-start gap-1.5 text-muted">
        <MapPin aria-hidden size={16} className="mt-1 shrink-0" />
        {text(p.address)}
      </p>
      <p className="text-muted">
        {date(v.date)} · {time(atLocal(v.date, v.windowStart))}–{time(atLocal(v.date, v.windowEnd))} · {t("caregiver.visit.patientPhone")}: {p.phone}
      </p>
    </Card>
  );

  const unwellButton = (
    <>
      <Button ref={unwellSpot.ref} variant="danger" size="lg" full icon={CircleAlert} onClick={() => setUnwell("confirm")} className={unwellSpot.className}>
        {t("caregiver.visit.unwell")}
      </Button>
      <Sheet
        open={unwell !== "closed"}
        onClose={() => setUnwell("closed")}
        title={t("caregiver.visit.unwellTitle")}
        footer={
          unwell === "confirm" ? (
            <>
              <Button onClick={() => setUnwell("closed")}>{t("common.cancel")}</Button>
              <Button variant="danger" icon={CircleAlert} onClick={() => { caregiverReportUnwell(p.id, cgId, v.id); setUnwell("sent"); }}>
                {t("caregiver.visit.unwellConfirm")}
              </Button>
            </>
          ) : (
            <Button onClick={() => setUnwell("closed")}>{t("common.close")}</Button>
          )
        }
      >
        {unwell === "confirm" ? (
          <p>{t("caregiver.visit.unwellBody")}</p>
        ) : (
          <div className="space-y-3">
            <p>{t("caregiver.visit.unwellDone")}</p>
            {nurse && (
              <a href={`tel:${nurse.phone.replace(/\s/g, "")}`} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-danger px-4 text-lg font-bold text-white dark:text-[#2a0705]">
                <Phone aria-hidden size={22} />
                {t("caregiver.visit.callNurse", { person: person(nurse.id) })} · {nurse.phone}
              </a>
            )}
          </div>
        )}
      </Sheet>
    </>
  );

  if (v.status === "completed" || v.status === "missed") {
    const pc = v.pillCounts;
    const matched = pc?.every((c) => c.counted === c.expected);
    return (
      <Screen>
        {header}
        {v.status === "completed" && v.checkOutAt && <Banner tone="ok" icon={CircleCheck} title={t("caregiver.visit.completed", { time: time(v.checkOutAt) })}>{pc?.length ? (matched ? t("caregiver.visit.resultMatched") : t("caregiver.visit.resultMismatch")) : null}</Banner>}
        <VisitCard v={v} />
        {unwellButton}
      </Screen>
    );
  }

  return (
    <Screen>
      {header}
      {unwellButton}

      {v.status === "scheduled" ? (
        <Card className="space-y-3">
          {!isToday && <Banner tone="info">{t("caregiver.visit.notToday", { date: date(v.date) })}</Banner>}
          <p className="text-muted">{t("caregiver.visit.notStarted")}</p>
          <Button
            ref={checkInSpot.ref}
            className={checkInSpot.className}
            variant="primary"
            size="xl"
            full
            icon={LogIn}
            disabled={checking}
            onClick={() => {
              setChecking(true);
              window.setTimeout(() => {
                caregiverCheckIn(v.id);
                setChecking(false);
              }, 900);
            }}
          >
            {checking ? t("caregiver.visit.checkingIn") : t("caregiver.visit.checkIn")}
          </Button>
        </Card>
      ) : (
        <>
          <Banner tone="ok" icon={BadgeCheck} title={t("caregiver.visit.checkedInAt", { time: v.checkInAt ? time(v.checkInAt) : "" })}>
            {t("caregiver.visit.verified")}
          </Banner>

          <Section title={t("caregiver.visit.tasks")}>
            <p className="text-sm text-muted">{t("caregiver.visit.tasksHint")}</p>
            <Card className="py-1">
              {v.tasks.map((k) => (
                <Checkbox key={k} checked={isDone(k)} onChange={(on) => setDone(on ? [...done, k] : done.filter((x) => x !== k))} label={t(`tasks.${k}`)} />
              ))}
            </Card>
          </Section>

          {vitalFields.length > 0 && (
            <Section title={t("caregiver.visit.vitals")}>
              <Card className="grid gap-3 @sm:grid-cols-2">
                {vitalFields.map((f) => (
                  <Field key={f.key} label={`${tr.tx(f.label)} (${tr.tx(f.unit)})`} htmlFor={`v-${f.key}`} error={vitalError(f.key)}>
                    <Input
                      id={`v-${f.key}`}
                      type="number"
                      inputMode="decimal"
                      step={f.step}
                      value={vitals[f.key] ?? ""}
                      aria-invalid={Boolean(vitalError(f.key))}
                      onChange={(e) => setVitals({ ...vitals, [f.key]: e.target.value })}
                      className="text-lg"
                    />
                  </Field>
                ))}
              </Card>
            </Section>
          )}

          {expected.length > 0 && (
            <Section
              title={t("caregiver.visit.pillCount")}
              action={
                <Button ref={fillSpot.ref} className={fillSpot.className} size="sm" variant="soft" icon={Sparkles} onClick={() => setCounts(Object.fromEntries(expected.map((c) => [c.medicineId, String(c.expected)])))}>
                  {t("caregiver.visit.fillExpected")}
                </Button>
              }
            >
              <ul className="space-y-2">
                {expected.map((c) => {
                  const m = rx?.medicines.find((x) => x.id === c.medicineId);
                  const raw = counts[c.medicineId];
                  const entered = raw !== undefined && raw !== "";
                  const same = entered && Number(raw) === c.expected;
                  return (
                    <li key={c.medicineId}>
                      <Card className="grid items-end gap-3 @sm:grid-cols-[1fr_auto_8rem]">
                        <div className="min-w-0">
                          <p className="font-bold">{m ? `${m.name} ${m.dose}` : c.medicineId}</p>
                          <p className="text-muted">
                            {t("caregiver.visit.expected")}: <span className="font-bold text-ink tabular-nums">{c.expected}</span>
                          </p>
                        </div>
                        {entered ? (
                          <span className={`flex items-center gap-1 text-sm font-semibold ${same ? "text-ok" : "text-warn"}`}>
                            {same ? <CircleCheck aria-hidden size={16} /> : <TriangleAlert aria-hidden size={16} />}
                            {same ? t("caregiver.visit.matches") : t("caregiver.visit.differs")}
                          </span>
                        ) : (
                          <span />
                        )}
                        <Field label={t("caregiver.visit.counted")} htmlFor={`pc-${c.medicineId}`}>
                          <Input id={`pc-${c.medicineId}`} type="number" inputMode="numeric" min={0} value={raw ?? ""} onChange={(e) => setCounts({ ...counts, [c.medicineId]: e.target.value })} className="text-lg" />
                        </Field>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          <Section title={t("caregiver.visit.note")}>
            <Card className="space-y-3">
              <Textarea aria-label={t("caregiver.visit.note")} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("caregiver.visit.notePlaceholder")} />
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{t("caregiver.visit.voice")}</span>
                {recording ? (
                  <Button variant="danger" icon={Square} onClick={() => setRecording(false)}>
                    {t("caregiver.visit.stop")} · {t("caregiver.visit.recording", { seconds: voice })}
                  </Button>
                ) : (
                  <Button icon={Mic} onClick={() => { setVoice(0); setRecording(true); }}>
                    {t("caregiver.visit.record")}
                  </Button>
                )}
                {!recording && voice > 0 && (
                  <>
                    <span className="text-muted">{t("caregiver.voiceNoteSaved", { seconds: voice })}</span>
                    <Button size="sm" variant="ghost" icon={Trash} onClick={() => setVoice(0)} aria-label={t("caregiver.visit.deleteVoice")}>
                      <span className="sr-only">{t("caregiver.visit.deleteVoice")}</span>
                    </Button>
                  </>
                )}
              </div>
            </Card>
          </Section>

          {error && <Banner tone="danger">{error}</Banner>}
          <Button ref={checkOutSpot.ref} className={checkOutSpot.className} variant="ok" size="xl" full icon={LogOut} onClick={checkOut} disabled={recording}>
            {t("caregiver.visit.checkOut")}
          </Button>
          <p className="text-center text-sm text-muted">{t("caregiver.visit.checkOutHelp")}</p>
        </>
      )}
    </Screen>
  );
}
