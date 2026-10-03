"use client";

import { CalendarClock, NotebookPen, PhoneOff, PhoneCall, Save, Undo2 } from "lucide-react";
import { useState } from "react";
import { SourceEntry } from "@/components/shared/ReportView";
import { TimesEditor } from "@/components/family/FamilySettings";
import { Banner, Button, Card, Checkbox, Chip, EmptyState, Field, Input, KV, Section, Select, Sheet, Textarea } from "@/components/ui";
import type { Repos } from "@/data/repos";
import { isDoseEntry } from "@/domain/doses";
import { awaitingVerification, previewSchedule } from "@/domain/schedule";
import type { CarePlan, LogEntry, Patient, VisitPattern, VisitTask } from "@/domain/types";
import { useT } from "@/i18n/useT";
import { localDate } from "@/lib/time";
import { addNurseNote, assignCaregiver, correctDose, saveCarePlan, saveTimes, setConsent } from "@/store/roleActions";
import { useDemo } from "@/store/store";

const TASKS: VisitTask[] = ["vitals", "pillCount", "wound", "mobility", "sugar"];

export function SchedulePanel({ p, nurseId }: { p: Patient; nurseId: string }) {
  const { t, time, weekdayDate } = useT();
  const now = useDemo((s) => s.now);
  const calls = previewSchedule(p, localDate(now), 3);
  const days = [...new Set(calls.map((c) => c.date))];
  return (
    <div className="space-y-6">
      <Section title={t("nurse.schedule.title")} icon={CalendarClock}>
        <p className="text-muted">{t("nurse.schedule.help")}</p>
        {awaitingVerification(p) && <Banner tone="warn">{t("nurse.schedule.preview")}</Banner>}
        {calls.length === 0 ? (
          <EmptyState title={t("nurse.schedule.empty")} />
        ) : (
          <div className="grid gap-3 @desk:grid-cols-3">
            {days.map((d) => (
              <Card key={d} className="space-y-2">
                <h3 className="font-bold">{weekdayDate(d)}</h3>
                <ul className="space-y-2">
                  {calls
                    .filter((c) => c.date === d)
                    .map((c) => (
                      <li key={c.slot} className="rounded-xl bg-surface-2 px-3 py-2">
                        <p className="font-semibold">
                          {time(c.at)} · {t(`slot.${c.slot}`)}
                        </p>
                        <p className="text-sm text-muted">{c.medicines.map((m) => `${m.name} ${m.dose}`).join(", ")}</p>
                      </li>
                    ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </Section>
      <Section title={t("nurse.schedule.changeTimes")}>
        <Card>
          <TimesEditor key={JSON.stringify(p.mealTimes) + JSON.stringify(p.callTimes)} meals={p.mealTimes} calls={p.callTimes} onSave={(m, c) => saveTimes(p.id, nurseId, "nurse", m, c)} saveLabel={t("family.settings.saveTimes")} />
        </Card>
      </Section>
    </div>
  );
}

export function CarePanel({ p, repos, nurseId }: { p: Patient; repos: Repos; nurseId: string }) {
  const { t, time, date, person } = useT();
  const [plan, setPlan] = useState<CarePlan>(p.carePlan);
  const [saved, setSaved] = useState(false);
  const caregivers = repos.staff.list("caregiver");
  const visits = repos.visits.forPatient(p.id);
  const set = (patch: Partial<CarePlan>) => {
    setSaved(false);
    setPlan({ ...plan, ...patch });
  };
  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <Field label={t("nurse.care.pattern")} htmlFor="pattern">
          <Select id="pattern" value={plan.pattern} onChange={(e) => set({ pattern: e.target.value as VisitPattern })}>
            {(["standard", "daily", "none"] as VisitPattern[]).map((v) => (
              <option key={v} value={v}>
                {t(`nurse.care.${v}`)}
              </option>
            ))}
          </Select>
        </Field>
        <fieldset>
          <legend className="mb-1 font-semibold">{t("nurse.care.tasks")}</legend>
          <div className="grid @md:grid-cols-2">
            {TASKS.map((k) => (
              <Checkbox key={k} checked={plan.tasks.includes(k)} onChange={(v) => set({ tasks: v ? TASKS.filter((x) => x === k || plan.tasks.includes(x)) : plan.tasks.filter((x) => x !== k) })} label={t(`tasks.${k}`)} />
            ))}
          </div>
        </fieldset>
        <div className="grid gap-3 @md:grid-cols-2">
          <Field label={t("nurse.care.visitTime")} htmlFor="vt">
            <Input id="vt" type="time" value={plan.visitStart} onChange={(e) => set({ visitStart: e.target.value })} />
          </Field>
          <Field label={t("nurse.care.caregiver")} htmlFor="cg">
            <Select id="cg" value={plan.caregiverId ?? ""} onChange={(e) => set({ caregiverId: e.target.value || undefined })}>
              <option value="">{t("nurse.care.unassigned")}</option>
              {caregivers.map((c) => (
                <option key={c.id} value={c.id} disabled={!c.caregiver?.verified}>
                  {person(c.id)} {c.caregiver?.verified ? "" : `(${t("nurse.care.notVerified")})`}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {saved && <Banner tone="ok">{t("nurse.care.saved")}</Banner>}
        <Button variant="primary" icon={Save} onClick={() => { saveCarePlan(p.id, nurseId, plan); setSaved(true); }}>
          {t("nurse.care.save")}
        </Button>
      </Card>

      <Section title={t("nurse.care.visits")}>
        {visits.length === 0 ? (
          <EmptyState title={t("nurse.care.noVisits")} />
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {visits.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {t("family.visits.dayN", { day: v.dayNo })} · {date(v.date)}
                  </p>
                  <p className="text-sm text-muted">
                    {v.windowStart}–{v.windowEnd} · {v.tasks.map((k) => t(`tasks.${k}`)).join(", ")}
                  </p>
                </div>
                {v.status === "scheduled" ? (
                  <label className="flex items-center gap-2">
                    <span className="sr-only">{t("nurse.care.assign")}</span>
                    <Select value={v.caregiverId ?? ""} onChange={(e) => e.target.value && assignCaregiver(v.id, e.target.value, nurseId)} className="min-h-11 w-auto">
                      <option value="">{t("nurse.care.unassigned")}</option>
                      {caregivers.map((c) => (
                        <option key={c.id} value={c.id} disabled={!c.caregiver?.verified}>
                          {person(c.id)}
                        </option>
                      ))}
                    </Select>
                  </label>
                ) : (
                  <Chip size="sm" tone={v.status === "completed" ? "ok" : v.status === "missed" ? "danger" : "info"}>
                    {v.status === "completed" ? t("family.visits.past") : v.status === "missed" ? t("family.visits.missed") : t("caregiver.checkedIn")}
                    {v.checkInAt ? ` · ${time(v.checkInAt)}` : ""}
                  </Chip>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

export function LogPanel({ p, repos, nurseId }: { p: Patient; repos: Repos; nurseId: string }) {
  const { t } = useT();
  const [note, setNote] = useState("");
  const [added, setAdded] = useState(false);
  const [correcting, setCorrecting] = useState<LogEntry | null>(null);
  const [to, setTo] = useState<"taken" | "missed">("taken");
  const [reason, setReason] = useState("");
  const replaced = repos.log.replaced();
  const entries = repos.log.forPatient(p.id).slice().sort((a, b) => b.at - a.at);
  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <Field label={t("nurse.log.addNote")} htmlFor="note">
          <Textarea id="note" value={note} onChange={(e) => { setAdded(false); setNote(e.target.value); }} placeholder={t("nurse.log.notePlaceholder")} />
        </Field>
        {added && <Banner tone="ok">{t("nurse.log.noteAdded")}</Banner>}
        <Button variant="primary" icon={NotebookPen} disabled={!note.trim()} onClick={() => { addNurseNote(p.id, nurseId, note.trim()); setNote(""); setAdded(true); }}>
          {t("nurse.log.saveNote")}
        </Button>
      </Card>
      <Section title={t("nurse.log.title")}>
        {entries.length === 0 ? (
          <EmptyState title={t("nurse.log.empty")} />
        ) : (
          <ul className="space-y-2">
            {entries.slice(0, 60).map((e) => (
              <li key={e.id} className="space-y-1">
                <SourceEntry e={e} />
                {isDoseEntry(e) && !replaced.has(e.id) && (
                  <Button size="sm" variant="ghost" icon={Undo2} onClick={() => { setCorrecting(e); setTo(e.kind === "doseMissed" ? "taken" : "missed"); setReason(""); }}>
                    {t("nurse.log.correct")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Sheet
        open={correcting != null}
        onClose={() => setCorrecting(null)}
        title={t("nurse.log.correctTitle")}
        footer={
          <>
            <Button onClick={() => setCorrecting(null)}>{t("common.cancel")}</Button>
            <Button variant="primary" icon={Save} onClick={() => { if (correcting) correctDose(correcting.id, nurseId, to, reason); setCorrecting(null); }}>
              {t("nurse.log.saveCorrection")}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-muted">{t("nurse.log.correctHelp")}</p>
          {correcting && <SourceEntry e={correcting} />}
          <Field label={t("common.status")} htmlFor="corr-to">
            <Select id="corr-to" value={to} onChange={(e) => setTo(e.target.value as "taken" | "missed")}>
              <option value="taken">{t("nurse.log.markTaken")}</option>
              <option value="missed">{t("nurse.log.markMissed")}</option>
            </Select>
          </Field>
          <Field label={t("nurse.log.correctNote")} htmlFor="corr-note">
            <Textarea id="corr-note" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
      </Sheet>
    </div>
  );
}

export function ConsentPanel({ p, nurseId }: { p: Patient; nurseId: string }) {
  const { t, person, date } = useT();
  const c = p.consent;
  const yes = (v: boolean) => (v ? t("nurse.consent.given") : t("nurse.consent.notGiven"));
  return (
    <div className="space-y-4">
      <Card>
        <KV
          rows={[
            [t("nurse.consent.calls"), c.withdrawnAt ? t("nurse.consent.withdrawn", { date: date(c.withdrawnAt) }) : yes(c.calls)],
            [t("nurse.consent.shareFamily"), yes(c.shareFamily)],
            [t("nurse.consent.shareDoctor"), yes(c.shareDoctor)],
            [t("common.note"), t("nurse.consent.recorded", { person: person(c.recordedBy), date: date(c.recordedAt) })],
          ]}
        />
      </Card>
      {c.calls && !c.withdrawnAt ? (
        <Card className="space-y-2">
          <p className="text-muted">{t("nurse.consent.withdrawHelp")}</p>
          <Button variant="danger" icon={PhoneOff} onClick={() => setConsent(p.id, nurseId, "nurse", false)}>
            {t("nurse.consent.withdraw")}
          </Button>
        </Card>
      ) : (
        <Button variant="primary" icon={PhoneCall} onClick={() => setConsent(p.id, nurseId, "nurse", true)}>
          {t("nurse.consent.regive")}
        </Button>
      )}
    </div>
  );
}
