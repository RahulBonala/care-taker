"use client";

import { ArrowLeft, ArrowRight, CircleCheck, FileUp, Printer, Sparkles, Timer, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { PrintPortal } from "@/components/shared/PrintPortal";
import { Banner, Button, Card, Checkbox, Chip, Field, Input, Screen, ScreenTitle, Segmented, Select } from "@/components/ui";
import { useActingAs, useRepos } from "@/data/useRepos";
import { MONTH_DAYS, PACKAGE_LENGTHS } from "@/domain/packages";
import { DEFAULT_MEAL_TIMES } from "@/domain/schedule";
import { SLOTS, type Lang, type PackageKind, type Relation } from "@/domain/types";
import { useSpot } from "@/hooks/useSpot";
import { LANG_CODES, LANGUAGES } from "@/i18n";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { enrolPatient, printedHandout, setUploadFails, type EnrolForm } from "@/store/roleActions";
import { useDemo } from "@/store/store";
import { Handout } from "./Handout";

const RELATIONS: Relation[] = ["son", "daughter", "husband", "wife", "brother", "sister", "grandson", "granddaughter", "daughterInLaw", "sonInLaw", "nephew", "niece"];
const KINDS: PackageKind[] = ["call", "callVisit", "full", "monthly"];

const EMPTY: EnrolForm = {
  name: "",
  honorific: "mrs",
  gender: "f",
  age: 65,
  phone: "",
  language: "te",
  phoneType: "keypad",
  meals: { ...DEFAULT_MEAL_TIMES },
  address: "",
  condition: "",
  doctorId: "d_anjali",
  familyName: "",
  familyPhone: "",
  relation: "son",
  kind: "callVisit",
  lengthDays: 14,
  payAtDesk: false,
  consent: { calls: false, shareFamily: false, shareDoctor: false },
};

/** The demo's sample discharge: Mrs Lakshmi Devi. */
const LAKSHMI_FORM: EnrolForm = {
  ...EMPTY,
  sample: "p_lakshmi",
  name: "Lakshmi Devi",
  honorific: "mrs",
  gender: "f",
  age: 67,
  phone: "+91 90000 00101",
  language: "te",
  phoneType: "keypad",
  meals: { ...DEFAULT_MEAL_TIMES, breakfast: "08:00", lunch: "13:00", dinner: "19:00" },
  address: "12-3-45, Street 4, Malkajgiri, Hyderabad",
  condition: "After knee replacement",
  doctorId: "d_anjali",
  familyName: "Ravi Kumar",
  familyPhone: "+1 201 555 0142",
  relation: "son",
  kind: "callVisit",
  lengthDays: 14,
};

type Step = 0 | 1 | 2 | 3;

export function DeskEnrol() {
  const { t, money, person } = useT();
  const repos = useRepos();
  const deskId = useActingAs();
  const now = useDemo((s) => s.now);
  const uploadFails = useDemo((s) => s.data?.settings.uploadFails ?? false);
  const lakshmiEnrolled = useDemo((s) => Boolean(s.data?.patients.some((p) => p.id === "p_lakshmi")));
  const [form, setForm] = useState<EnrolForm>(EMPTY);
  const [step, setStep] = useState<Step>(0);
  const [error, setError] = useState("");
  const [upload, setUpload] = useState<"none" | "busy" | "done" | "failed">("none");
  const [started, setStarted] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [doneId, setDoneId] = useState<string | null>(null);
  const [took, setTook] = useState(0);
  const fillSpot = useSpot<HTMLButtonElement>("desk.fill");
  const nextSpot = useSpot<HTMLButtonElement>("desk.next");
  const consentSpot = useSpot<HTMLDivElement>("desk.consent");
  const finishSpot = useSpot<HTMLButtonElement>("desk.finish");
  const doctors = repos.staff.list("doctor");
  const packages = repos.packages;

  useEffect(() => {
    if (started == null || doneId) return;
    const id = window.setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [started, doneId]);

  const set = (patch: Partial<EnrolForm>) => {
    if (started == null) setStarted(Date.now());
    setError("");
    setForm((f) => ({ ...f, ...patch }));
  };
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const priceFor = (kind: PackageKind, len: number) => packages.price(kind, kind === "monthly" ? MONTH_DAYS : len);

  const validStep = (s: Step): boolean => {
    if (s === 0) return form.name.trim().length > 1 && form.phone.replace(/\D/g, "").length >= 10;
    if (s === 1) return form.familyName.trim().length > 1 && form.familyPhone.replace(/\D/g, "").length >= 8;
    if (s === 2) return form.consent.calls;
    return true;
  };
  const next = () => {
    if (!validStep(step)) {
      setError(step === 2 ? t("desk.enrol.consentRequired") : t("desk.enrol.missing"));
      return;
    }
    setStep((s) => Math.min(3, s + 1) as Step);
  };
  const doUpload = (name: string) => {
    setUpload("busy");
    window.setTimeout(() => {
      if (uploadFails) setUpload("failed");
      else {
        setUpload("done");
        set({ fileName: name });
      }
    }, 900);
  };
  const finish = () => {
    if (!validStep(0) || !validStep(1)) return setError(t("desk.enrol.missing"));
    if (!form.consent.calls) return setError(t("desk.enrol.consentRequired"));
    const id = enrolPatient(form, deskId);
    setTook(started ? Math.round((Date.now() - started) / 1000) : 0);
    setDoneId(id);
  };

  if (doneId) {
    const p = repos.patients.get(doneId);
    return (
      <Screen>
        <Banner tone="ok" icon={CircleCheck} title={t("desk.enrol.done", { patient: person(doneId) })}>
          {t("desk.enrol.doneIn", { time: mmss(took) })} {t("desk.enrol.nextSteps")}
        </Banner>
        {p && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold">{t("desk.enrol.handout")}</h2>
              <Button icon={Printer} onClick={() => { printedHandout(p.id, deskId); window.print(); }}>
                {t("desk.enrol.printHandout")}
              </Button>
            </div>
            <Handout p={p} />
            <PrintPortal>
              <Handout p={p} />
            </PrintPortal>
          </>
        )}
        <Button variant="primary" icon={UserPlus} onClick={() => { setForm(EMPTY); setStep(0); setDoneId(null); setStarted(null); setElapsed(0); setUpload("none"); }}>
          {t("desk.enrol.enrolAnother")}
        </Button>
      </Screen>
    );
  }

  const steps = [t("desk.enrol.stepPatient"), t("desk.enrol.stepCare"), t("desk.enrol.stepConsent"), t("desk.enrol.stepUpload")];

  return (
    <Screen>
      <ScreenTitle
        title={t("desk.enrol.title")}
        subtitle={t("desk.enrol.intro")}
        action={
          started != null ? (
            <Chip tone="info" icon={Timer}>
              {t("desk.enrol.timer", { time: mmss(elapsed) })}
            </Chip>
          ) : undefined
        }
      />
      {!lakshmiEnrolled && (
        <Button ref={fillSpot.ref} className={fillSpot.className} variant="soft" icon={Sparkles} onClick={() => { set(LAKSHMI_FORM); }}>
          {t("desk.enrol.fillSample")}
        </Button>
      )}

      <ol className="grid grid-cols-4 gap-1.5" aria-label={t("desk.enrol.title")}>
        {steps.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className={cn("rounded-xl px-2 py-2 text-center text-[13px] leading-tight font-semibold", i === step ? "bg-brand text-brand-ink" : i < step ? "bg-brand-soft text-brand" : "bg-surface-2 text-muted")}>
            <span className="block text-base">{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>

      <Card className="space-y-4">
        {step === 0 && (
          <>
            <div className="grid gap-3 @md:grid-cols-[8rem_1fr]">
              <Field label={t("desk.enrol.honorific")} htmlFor="hon">
                <Select id="hon" value={form.honorific} onChange={(e) => set({ honorific: e.target.value as EnrolForm["honorific"], gender: e.target.value === "mr" ? "m" : "f" })}>
                  {(["mrs", "mr", "ms"] as const).map((h) => (
                    <option key={h} value={h}>
                      {t(`honorific.${h}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("desk.enrol.name")} htmlFor="name">
                <Input id="name" value={form.name} onChange={(e) => set({ name: e.target.value })} autoComplete="off" />
              </Field>
            </div>
            <div className="grid gap-3 @md:grid-cols-2">
              <Field label={t("desk.enrol.phone")} htmlFor="phone">
                <Input id="phone" type="tel" inputMode="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
              </Field>
              <Field label={t("desk.enrol.age")} htmlFor="age">
                <Input id="age" type="number" min={18} max={110} value={form.age} onChange={(e) => set({ age: Number(e.target.value) || 0 })} />
              </Field>
              <Field label={t("desk.enrol.language")} htmlFor="lang">
                <Select id="lang" value={form.language} onChange={(e) => set({ language: e.target.value as Lang })}>
                  {LANG_CODES.map((l) => (
                    <option key={l} value={l}>
                      {LANGUAGES[l].nativeName} · {t(`lang.${l}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="space-y-1.5">
                <p className="font-semibold">{t("desk.enrol.phoneType")}</p>
                <Segmented label={t("desk.enrol.phoneType")} value={form.phoneType} onChange={(v) => set({ phoneType: v })} options={[{ value: "keypad", label: t("patient.keypadPhone") }, { value: "smartphone", label: t("patient.smartphone") }]} />
              </div>
            </div>
            <Field label={t("desk.enrol.condition")} htmlFor="cond">
              <Input id="cond" value={form.condition} onChange={(e) => set({ condition: e.target.value })} />
            </Field>
            <Field label={t("desk.enrol.address")} htmlFor="addr">
              <Input id="addr" value={form.address} onChange={(e) => set({ address: e.target.value })} autoComplete="street-address" />
            </Field>
            <fieldset>
              <legend className="mb-2 font-semibold">{t("desk.enrol.meals")}</legend>
              <div className="grid grid-cols-2 gap-3 @md:grid-cols-5">
                {SLOTS.map((s) => (
                  <Field key={s} label={t(`slot.${s}`)} htmlFor={`meal-${s}`}>
                    <Input id={`meal-${s}`} type="time" value={form.meals[s]} onChange={(e) => set({ meals: { ...form.meals, [s]: e.target.value } })} />
                  </Field>
                ))}
              </div>
            </fieldset>
          </>
        )}

        {step === 1 && (
          <>
            <Field label={t("desk.enrol.doctor")} htmlFor="doc">
              <Select id="doc" value={form.doctorId} onChange={(e) => set({ doctorId: e.target.value })}>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {person(d.id)}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-3 @md:grid-cols-3">
              <Field label={t("desk.enrol.familyName")} htmlFor="fam">
                <Input id="fam" value={form.familyName} onChange={(e) => set({ familyName: e.target.value })} />
              </Field>
              <Field label={t("desk.enrol.familyPhone")} htmlFor="famphone">
                <Input id="famphone" type="tel" inputMode="tel" value={form.familyPhone} onChange={(e) => set({ familyPhone: e.target.value })} />
              </Field>
              <Field label={t("desk.enrol.relation")} htmlFor="rel">
                <Select id="rel" value={form.relation} onChange={(e) => set({ relation: e.target.value as Relation })}>
                  {RELATIONS.map((r) => (
                    <option key={r} value={r}>
                      {t(`relation.${r}`)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <fieldset className="space-y-2">
              <legend className="mb-1 font-semibold">{t("desk.enrol.package")}</legend>
              <div className="grid gap-2 @md:grid-cols-2">
                {KINDS.map((k) => {
                  const on = form.kind === k;
                  return (
                    <label key={k} className={cn("flex cursor-pointer items-start gap-3 rounded-2xl border p-3", on ? "border-brand bg-brand-soft" : "border-line")}>
                      <input type="radio" name="pkg" className="mt-1 h-5 w-5 accent-[var(--brand)]" checked={on} onChange={() => set({ kind: k, lengthDays: k === "monthly" ? MONTH_DAYS : form.lengthDays === MONTH_DAYS && form.kind === "monthly" ? 14 : form.lengthDays })} />
                      <span className="min-w-0">
                        <span className="block font-bold">{t(`pkg.name.${k}`)}</span>
                        <span className="block text-sm text-muted">{t(`pkg.desc.${k}`)}</span>
                        <span className="block font-semibold tabular-nums">{k === "monthly" ? t("pkg.perMonth", { price: money(priceFor(k, MONTH_DAYS)) }) : t("pkg.forDays", { price: money(priceFor(k, form.lengthDays)), days: form.lengthDays })}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {form.kind !== "monthly" && (
                <Segmented<string> label={t("desk.enrol.package")} value={String(form.lengthDays)} onChange={(v) => set({ lengthDays: Number(v) })} options={PACKAGE_LENGTHS.map((d) => ({ value: String(d), label: `${t("pkg.length", { days: d })} · ${money(priceFor(form.kind, d))}` }))} />
              )}
            </fieldset>
            <div className="space-y-1.5">
              <p className="font-semibold">{t("desk.enrol.payment")}</p>
              <Segmented<string> label={t("desk.enrol.payment")} value={form.payAtDesk ? "desk" : "family"} onChange={(v) => set({ payAtDesk: v === "desk" })} options={[{ value: "family", label: t("desk.enrol.payFamily") }, { value: "desk", label: t("desk.enrol.payDesk") }]} />
            </div>
          </>
        )}

        {step === 2 && (
          <div ref={consentSpot.ref} className={cn("space-y-1", consentSpot.className)}>
            <p className="text-muted">{t("desk.enrol.consentIntro")}</p>
            <Checkbox checked={form.consent.calls} onChange={(v) => set({ consent: { ...form.consent, calls: v } })} label={t("desk.enrol.consentCalls")} />
            <Checkbox checked={form.consent.shareFamily} onChange={(v) => set({ consent: { ...form.consent, shareFamily: v } })} label={t("desk.enrol.consentFamily")} hint={form.familyName ? `${form.familyName} · ${t(`relation.${form.relation}`)}` : undefined} />
            <Checkbox checked={form.consent.shareDoctor} onChange={(v) => set({ consent: { ...form.consent, shareDoctor: v } })} label={t("desk.enrol.consentDoctor")} hint={person(form.doctorId)} />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-muted">{t("desk.enrol.uploadOptional")}</p>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface px-4 font-semibold hover:bg-surface-2">
                <FileUp aria-hidden size={20} />
                {t("desk.enrol.upload")}
                <input type="file" accept="application/pdf,image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && doUpload(e.target.files[0].name)} />
              </label>
              <Button variant="soft" icon={Sparkles} onClick={() => doUpload(`discharge-summary-${(form.name || "patient").toLowerCase().replace(/\s+/g, "-")}.pdf`)}>
                {t("desk.enrol.useSample")}
              </Button>
            </div>
            {upload === "busy" && <Banner tone="info">{t("desk.enrol.uploading", { name: "…" })}</Banner>}
            {upload === "done" && form.fileName && <Banner tone="ok" icon={CircleCheck}>{t("desk.enrol.uploaded", { name: form.fileName })}</Banner>}
            {upload === "failed" && (
              <Banner tone="danger" action={<Button size="sm" onClick={() => { setUploadFails(false); doUpload("discharge-summary.pdf"); }}>{t("common.retry")}</Button>}>
                {t("desk.enrol.uploadFailed")}
              </Banner>
            )}
          </div>
        )}

        {error && <Banner tone="danger">{error}</Banner>}

        <div className="flex flex-wrap justify-between gap-2 border-t border-line pt-4">
          <Button icon={ArrowLeft} disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1) as Step)}>
            {t("desk.enrol.back")}
          </Button>
          {step < 3 ? (
            <Button ref={nextSpot.ref} className={nextSpot.className} variant="primary" iconRight={ArrowRight} onClick={next}>
              {t("desk.enrol.next")}
            </Button>
          ) : (
            <Button ref={finishSpot.ref} className={finishSpot.className} variant="primary" icon={UserPlus} onClick={finish} disabled={upload === "busy"}>
              {t("desk.enrol.finish")}
            </Button>
          )}
        </div>
      </Card>
      <p className="text-sm text-muted">{now ? t("desk.today.noClinical") : null}</p>
    </Screen>
  );
}
