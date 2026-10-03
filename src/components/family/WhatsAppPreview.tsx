"use client";

import { BadgeCheck, CheckCheck } from "lucide-react";
import { useMemo } from "react";
import { LINE_ICON, lineTextFor } from "@/components/shared/ReportView";
import type { FamilyMember, Message, Patient } from "@/domain/types";
import { makeTranslator, type Translator } from "@/i18n/translator";
import { useT } from "@/i18n/useT";
import { PATIENT_TZ } from "@/lib/time";
import { useDemo } from "@/store/store";

function messageText(m: Message, tr: Translator, data: NonNullable<ReturnType<typeof useDemo.getState>["data"]>, f: FamilyMember): string[] {
  if (m.kind === "dailyReport") {
    const r = data.reports.find((x) => x.id === m.reportId);
    if (!r) return [];
    const head = [`*${tr.t("whatsapp.header")}*`, tr.t("whatsapp.subheader", { patient: { $person: r.patientId }, date: tr.date(r.date) }) + (f.timeZone !== PATIENT_TZ ? ` · ${tr.t("time.india")}` : ""), ""];
    const body = r.lines.map((l) => `${LINE_ICON[l.icon].emoji} ${lineTextFor(l, tr)}`);
    return [...head, ...body, "", `_${tr.t("whatsapp.footer")}_`];
  }
  return [tr.tx(`whatsapp.${m.kind}`, { ...m.params, slot: m.params.slot ?? "" })];
}

/** The WhatsApp chat exactly as this family member receives it, in their report language. */
export function WhatsAppPreview({ f, p, limit = 6 }: { f: FamilyMember; p: Patient; limit?: number }) {
  const ui = useT();
  const data = useDemo((s) => s.data)!;
  const tr = useMemo(() => makeTranslator(f.reportLanguage, data), [f.reportLanguage, data]);
  const messages = data.messages.filter((m) => m.familyId === f.id).slice(-limit);
  return (
    <div className="overflow-hidden rounded-3xl border border-line shadow-sm" aria-label={ui.t("family.report.whatsapp")}>
      <div className="flex items-center gap-3 bg-[#075e54] px-4 py-3 text-white">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/20 font-bold">{tr.app.slice(0, 1)}</span>
        <div className="min-w-0">
          <p className="flex items-center gap-1 truncate font-bold">
            {tr.t("whatsapp.chatName")}
            <BadgeCheck aria-hidden size={16} />
          </p>
          <p className="text-[13px] opacity-85">{tr.t("whatsapp.verified")}</p>
        </div>
      </div>
      <ol className="max-h-[560px] space-y-3 overflow-y-auto bg-[#e7ddd3] p-3 dark:bg-[#0b141a]" lang={f.reportLanguage}>
        {messages.length === 0 && <li className="rounded-lg bg-white/80 p-3 text-center text-sm text-[#3b4a54] dark:bg-[#202c33] dark:text-[#d1d7db]">{ui.t("family.report.noMessages")}</li>}
        {messages.map((m) => {
          const lines = messageText(m, tr, data, f);
          return (
            <li key={m.id} className="max-w-[92%] rounded-xl rounded-tl-sm bg-white px-3 py-2 text-[15px] text-[#111b21] shadow-sm dark:bg-[#202c33] dark:text-[#e9edef]">
              {lines.map((line, i) => (
                <p key={i} className={line.startsWith("*") ? "font-bold" : line.startsWith("_") ? "text-[13px] italic opacity-75" : line === "" ? "h-2" : undefined}>
                  {line.replace(/^\*(.*)\*$/, "$1").replace(/^_(.*)_$/, "$1")}
                </p>
              ))}
              <p className="mt-1 flex items-center justify-end gap-1 text-[12px] opacity-70">
                {tr.time(m.at, f.timeZone)}
                <CheckCheck aria-hidden size={14} className="text-[#53bdeb]" />
              </p>
            </li>
          );
        })}
      </ol>
      <p className="bg-surface px-4 py-2 text-sm text-muted">{ui.t("family.report.whatsappLang", { language: ui.t(`lang.${f.reportLanguage}`) })} · {p ? ui.patient(p) : ""}</p>
    </div>
  );
}
