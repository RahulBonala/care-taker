"use client";

import { useMemo } from "react";
import { SAMPLE_CALLER_NUMBER } from "@/config/brand";
import type { Patient } from "@/domain/types";
import { makeTranslator } from "@/i18n/translator";
import { useDemo } from "@/store/store";

/** One-page handout in the patient's own language: what the calls are and which keys to press. */
export function Handout({ p }: { p: Patient }) {
  const data = useDemo((s) => s.data)!;
  const tr = useMemo(() => makeTranslator(p.language, data), [p.language, data]);
  const fam = data.family.find((f) => f.patientId === p.id && f.primary);
  const hospital = data.hospitals[0];
  const keys = [tr.t("handout.key1"), tr.t("handout.key2"), tr.t("handout.key3")];
  return (
    <article lang={p.language} className="space-y-4 rounded-2xl border-2 border-ink bg-white p-6 text-[17px] leading-relaxed text-black">
      <header className="border-b-2 border-black pb-2">
        <p className="text-sm font-semibold">{tr.text(hospital.name)}</p>
        <h2 className="text-2xl font-bold">{tr.t("handout.title")}</h2>
      </header>
      <p className="text-xl font-semibold">{tr.t("handout.hello", { patient: tr.patient(p) })}</p>
      <p>{tr.t("handout.what", { days: p.pkg.lengthDays, phone: p.phone })}</p>
      <p>{tr.t("handout.when")}</p>
      <p className="font-semibold">{tr.t("handout.from", { number: SAMPLE_CALLER_NUMBER })}</p>
      <section className="rounded-xl border-2 border-black p-4">
        <h3 className="mb-2 text-xl font-bold">{tr.t("handout.keysTitle")}</h3>
        <ol className="space-y-2">
          {keys.map((k, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-black text-xl font-bold">{i + 1}</span>
              <span className="pt-1.5">{k}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3">{tr.t("handout.readBack")}</p>
      </section>
      {fam && <p>{tr.t("handout.family", { family: tr.text(fam.name) })}</p>}
      <p>{tr.t("handout.help", { phone: hospital.phone })}</p>
      <p className="text-sm">{tr.t("handout.sample")}</p>
    </article>
  );
}
