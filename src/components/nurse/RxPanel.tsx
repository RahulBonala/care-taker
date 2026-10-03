"use client";

import { CircleCheck, ClipboardPen, Plus, Save, ShieldCheck, Sparkles, Trash } from "lucide-react";
import { useState } from "react";
import { Banner, Button, Card, Checkbox, Chip, Field, Input, Section, Segmented } from "@/components/ui";
import { currentPrescription } from "@/domain/schedule";
import { SLOTS, type Medicine, type Patient } from "@/domain/types";
import { useSpot } from "@/hooks/useSpot";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { addDays } from "@/lib/time";
import { editVerifiedPrescription, saveMedicines, verifyPrescription } from "@/store/roleActions";
import { sampleMedicinesFor } from "@/sim/seed";
import { DischargeSummary } from "./DischargeSummary";

function blankMedicine(p: Patient, n: number): Medicine {
  return { id: `${p.id}_new${Date.now().toString(36)}${n}`, name: "", dose: "", perDose: 1, slots: [], food: "after", startDate: p.pkg.startDate, endDate: addDays(p.pkg.startDate, p.pkg.lengthDays - 1), dispensed: 14 };
}

export function RxPanel({ p, nurseId }: { p: Patient; nurseId: string }) {
  const { t, person, time } = useT();
  const cur = currentPrescription(p);
  const editable = !cur || cur.status !== "verified";
  const [meds, setMeds] = useState<Medicine[]>(() => structuredClone(cur?.medicines ?? []));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const { ref: fillSpotRef, className: fillSpotCls } = useSpot<HTMLButtonElement>("nurse.rx.fill");
  const { ref: saveSpotRef, className: saveSpotCls } = useSpot<HTMLButtonElement>("nurse.rx.save");
  const { ref: verifySpotRef, className: verifySpotCls } = useSpot<HTMLButtonElement>("nurse.rx.verify");
  const versionNo = p.prescriptions.length;

  const update = (i: number, patch: Partial<Medicine>) => {
    setSaved(false);
    setMeds((list) => list.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  };
  const save = () => {
    if (!meds.length || meds.some((m) => !m.name.trim() || !m.dose.trim() || !m.slots.length)) {
      setError(t("nurse.rx.needName"));
      return;
    }
    setError("");
    saveMedicines(p.id, nurseId, meds.map((m) => ({ ...m, name: m.name.trim(), dose: m.dose.trim() })));
    setSaved(true);
  };

  return (
    <div className="grid gap-6 @desk:grid-cols-[minmax(240px,340px)_1fr]">
      <Section title={t("nurse.rx.summary")}>
        <DischargeSummary p={p} />
      </Section>

      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold">{t("nurse.rx.medicines")}</h2>
          <Chip size="sm" tone="neutral">{t("nurse.patient.version", { n: versionNo || 1 })}</Chip>
          {cur && (
            <Chip size="sm" tone={cur.status === "verified" ? "ok" : "warn"} icon={cur.status === "verified" ? ShieldCheck : ClipboardPen}>
              {t(`nurse.patient.${cur.status}`)}
            </Chip>
          )}
        </div>
        {cur?.replaces && <p className="text-sm text-muted">{t("nurse.patient.replacesVersion", { n: versionNo - 1 })}</p>}
        {cur?.enteredBy && cur.enteredAt && <p className="text-sm text-muted">{t("nurse.patient.enteredBy", { person: person(cur.enteredBy), time: time(cur.enteredAt) })}</p>}
        {cur?.verifiedBy && cur.verifiedAt && <p className="text-sm text-muted">{t("nurse.patient.verifiedBy", { person: person(cur.verifiedBy), time: time(cur.verifiedAt) })}</p>}

        {!editable ? (
          <>
            <MedicineTable meds={cur!.medicines} />
            <Card className="space-y-2">
              <p className="text-sm text-muted">{t("nurse.rx.editHelp")}</p>
              <Button icon={ClipboardPen} onClick={() => editVerifiedPrescription(p.id, nurseId)}>
                {t("nurse.rx.edit")}
              </Button>
            </Card>
          </>
        ) : (
          <>
            {meds.length === 0 && <p className="text-muted">{t("nurse.rx.noMedicines")}</p>}
            <ol className="space-y-3">
              {meds.map((m, i) => (
                <li key={m.id}>
                  <Card className="space-y-3">
                    <div className="grid gap-3 @md:grid-cols-[2fr_1fr_1fr]">
                      <Field label={t("nurse.rx.name")} htmlFor={`m-name-${i}`}>
                        <Input id={`m-name-${i}`} value={m.name} placeholder={t("nurse.rx.namePlaceholder")} onChange={(e) => update(i, { name: e.target.value })} />
                      </Field>
                      <Field label={t("nurse.rx.dose")} htmlFor={`m-dose-${i}`}>
                        <Input id={`m-dose-${i}`} value={m.dose} placeholder={t("nurse.rx.dosePlaceholder")} onChange={(e) => update(i, { dose: e.target.value })} />
                      </Field>
                      <Field label={t("nurse.rx.perDose")} htmlFor={`m-per-${i}`}>
                        <Input id={`m-per-${i}`} type="number" min={1} max={4} value={m.perDose} onChange={(e) => update(i, { perDose: Math.max(1, Number(e.target.value) || 1) })} />
                      </Field>
                    </div>
                    <fieldset>
                      <legend className="mb-1.5 font-semibold">{t("nurse.rx.slots")}</legend>
                      <div className="flex flex-wrap gap-2">
                        {SLOTS.map((s) => {
                          const on = m.slots.includes(s);
                          return (
                            <button
                              key={s}
                              type="button"
                              aria-pressed={on}
                              onClick={() => update(i, { slots: on ? m.slots.filter((x) => x !== s) : SLOTS.filter((x) => x === s || m.slots.includes(x)) })}
                              className={cn("inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 font-semibold", on ? "border-brand bg-brand-soft text-brand" : "border-line text-muted")}
                            >
                              {on && <CircleCheck aria-hidden size={16} />}
                              {t(`slot.${s}`)}
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                    <div className="grid gap-3 @md:grid-cols-2 @desk:grid-cols-4">
                      <div className="space-y-1.5">
                        <p className="font-semibold">{t("nurse.rx.food")}</p>
                        <Segmented size="sm" label={t("nurse.rx.food")} value={m.food} onChange={(v) => update(i, { food: v })} options={[{ value: "before", label: t("food.before") }, { value: "after", label: t("food.after") }]} />
                      </div>
                      <Field label={t("nurse.rx.start")} htmlFor={`m-start-${i}`}>
                        <Input id={`m-start-${i}`} type="date" value={m.startDate} onChange={(e) => update(i, { startDate: e.target.value })} />
                      </Field>
                      <Field label={t("nurse.rx.end")} htmlFor={`m-end-${i}`}>
                        <Input id={`m-end-${i}`} type="date" value={m.endDate} min={m.startDate} onChange={(e) => update(i, { endDate: e.target.value })} />
                      </Field>
                      <Field label={t("nurse.rx.dispensed")} htmlFor={`m-disp-${i}`}>
                        <Input id={`m-disp-${i}`} type="number" min={0} value={m.dispensed} onChange={(e) => update(i, { dispensed: Math.max(0, Number(e.target.value) || 0) })} />
                      </Field>
                    </div>
                    <Button size="sm" variant="ghost" icon={Trash} onClick={() => setMeds((list) => list.filter((_, j) => j !== i))}>
                      {t("nurse.rx.remove")}
                    </Button>
                  </Card>
                </li>
              ))}
            </ol>
            {error && <Banner tone="danger">{error}</Banner>}
            {saved && cur?.status === "entered" && <Banner tone="ok">{t("nurse.rx.saved")}</Banner>}
            <div className="flex flex-wrap gap-2">
              <Button icon={Plus} onClick={() => setMeds((list) => [...list, blankMedicine(p, list.length)])}>
                {t("nurse.rx.add")}
              </Button>
              <Button ref={fillSpotRef} className={fillSpotCls} variant="soft" icon={Sparkles} onClick={() => { setSaved(false); setMeds(sampleMedicinesFor(p.id, p.pkg.startDate)); }}>
                {t("nurse.rx.fillSample")}
              </Button>
              <Button ref={saveSpotRef} className={saveSpotCls} variant="primary" icon={Save} onClick={save}>
                {t("nurse.rx.save")}
              </Button>
            </div>

            {cur?.status === "entered" && (
              <Card className="space-y-3 border-warn">
                <h3 className="flex items-center gap-2 text-lg font-bold">
                  <ShieldCheck aria-hidden size={20} />
                  {t("nurse.rx.verifyTitle")}
                </h3>
                <p className="text-muted">{t("nurse.rx.verifyHelp")}</p>
                {cur.medicines.map((m) => (
                  <Checkbox key={m.id} checked={Boolean(checked[m.id])} onChange={(v) => setChecked({ ...checked, [m.id]: v })} label={t("nurse.rx.matches", { medicine: `${m.name} ${m.dose}` })} hint={`${m.slots.map((s) => t(`slot.${s}`)).join(" · ")} · ${t(`food.${m.food}`)}`} />
                ))}
                <Button
                  ref={verifySpotRef}
                  className={verifySpotCls}
                  variant="primary"
                  size="lg"
                  icon={ShieldCheck}
                  disabled={!cur.medicines.every((m) => checked[m.id])}
                  onClick={() => verifyPrescription(p.id, nurseId)}
                >
                  {t("nurse.rx.verify")}
                </Button>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function MedicineTable({ meds }: { meds: Medicine[] }) {
  const { t, dayMonth } = useT();
  return (
    <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
      {meds.map((m) => (
        <li key={m.id} className="space-y-0.5 px-4 py-3">
          <p className="font-bold">
            {m.name} {m.dose} <span className="font-normal text-muted">· {t("common.tablets", { count: m.perDose })}</span>
          </p>
          <p className="text-[15px]">
            {m.slots.map((s) => t(`slot.${s}`)).join(" · ")} · {t(`food.${m.food}`)}
          </p>
          <p className="text-sm text-muted">
            {dayMonth(m.startDate)} – {dayMonth(m.endDate)} · {t("nurse.rx.dispensed")}: {m.dispensed}
          </p>
        </li>
      ))}
    </ul>
  );
}
