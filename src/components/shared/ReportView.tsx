"use client";

import { ChevronDown, CircleAlert, CircleCheck, CircleX, ClipboardList, Hourglass, Info, House, Link2, type LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import type { LogEntry, ReportLine } from "@/domain/types";
import type { Translator } from "@/i18n/translator";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { useDemo } from "@/store/store";
import { useSpot } from "@/hooks/useSpot";

const NO_ENTRIES: LogEntry[] = [];

export const LINE_ICON: Record<ReportLine["icon"], { icon: LucideIcon; cls: string; emoji: string }> = {
  ok: { icon: CircleCheck, cls: "text-ok", emoji: "✅" },
  pending: { icon: Hourglass, cls: "text-muted", emoji: "⏳" },
  missed: { icon: CircleX, cls: "text-danger", emoji: "❌" },
  info: { icon: Info, cls: "text-info", emoji: "ℹ️" },
  alert: { icon: CircleAlert, cls: "text-warn", emoji: "⚠️" },
  visit: { icon: House, cls: "text-brand", emoji: "🏠" },
};

export function lineTextFor(line: ReportLine, tr: Translator): string {
  return tr.tx(line.key, line.params);
}

/** A report, one tappable line at a time. Tapping a line shows the log entries behind it. */
export function ReportLines({ lines }: { lines: ReportLine[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const firstDose = lines.find((l) => l.kind === "dose" && l.sources.length)?.id;
  return (
    <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      {lines.map((line) => (
        <LineItem key={line.id} line={line} open={open === line.id} onToggle={() => setOpen(open === line.id ? null : line.id)} spot={line.id === firstDose} />
      ))}
    </ol>
  );
}

function LineItem({ line, open, onToggle, spot }: { line: ReportLine; open: boolean; onToggle: () => void; spot: boolean }) {
  const tr = useT();
  const s = useSpot<HTMLButtonElement>(spot ? "family.report.line" : `report.line.${line.id}`);
  const style = LINE_ICON[line.icon];
  const Icon = style.icon;
  return (
    <li>
      <button
        ref={s.ref}
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={cn("flex min-h-14 w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2", line.kind === "summary" && "bg-surface-2 font-semibold", s.className)}
      >
        <Icon aria-hidden size={22} className={cn("mt-0.5 shrink-0", style.cls)} />
        <span className="min-w-0 flex-1">{lineTextFor(line, tr)}</span>
        <ChevronDown aria-hidden size={20} className={cn("mt-0.5 shrink-0 text-muted transition", open && "rotate-180")} />
      </button>
      {open && <SourcePanel ids={line.sources} />}
    </li>
  );
}

function SourcePanel({ ids }: { ids: string[] }) {
  const { t } = useT();
  const log = useDemo((s) => s.data?.log) ?? NO_ENTRIES;
  const entries = ids.map((id) => log.find((e) => e.id === id)).filter(Boolean) as LogEntry[];
  return (
    <div className="space-y-2 border-t border-line bg-bg px-4 py-3">
      <p className="flex items-center gap-2 text-sm font-bold text-muted">
        <Link2 aria-hidden size={16} />
        {t("report.sources")}
      </p>
      {entries.length === 0 ? <p className="text-sm text-muted">{t("report.noSource")}</p> : entries.map((e) => <SourceEntry key={e.id} e={e} />)}
    </div>
  );
}

export function SourceEntry({ e }: { e: LogEntry }) {
  const { t, time, dayMonth, person, text } = useT();
  const log = useDemo((s) => s.data?.log);
  const patient = useDemo((s) => s.data?.patients.find((p) => p.id === e.patientId));
  const replacedIds = useMemo(() => new Set((log ?? []).filter((x) => x.replaces).map((x) => x.replaces)), [log]);
  const meds = useMemo(() => patient?.prescriptions.flatMap((r) => r.medicines) ?? [], [patient]);
  const rows: string[] = [];
  if (e.kind === "doseTaken") rows.push(`${t(`slot.${e.slot}`)} · ${t("common.at", { time: time(e.takenAt) })}`, t(`confirmation.${e.confirmation}`));
  if (e.kind === "doseConfirmed" || e.kind === "doseMissed") rows.push(`${t(`slot.${e.slot}`)} · ${dayMonth(e.date)}`, t(`confirmation.${e.confirmation}`));
  if (e.kind === "vitals") {
    const v = e.vitals;
    if (v.bpSys != null) rows.push(`${t("vitals.bp")}: ${v.bpSys}/${v.bpDia} ${t("vitals.unitBp")}`);
    if (v.pulse != null) rows.push(`${t("vitals.pulse")}: ${v.pulse} ${t("vitals.unitPulse")}`);
    if (v.spo2 != null) rows.push(`${t("vitals.spo2")}: ${v.spo2}${t("vitals.unitSpo2")}`);
    if (v.tempC != null) rows.push(`${t("vitals.tempC")}: ${v.tempC} ${t("vitals.unitTemp")}`);
    if (v.sugar != null) rows.push(`${t("vitals.sugar")}: ${v.sugar} ${t("vitals.unitSugar")}`);
  }
  if (e.kind === "pillCount") {
    for (const c of e.counts) {
      const m = meds.find((x) => x.id === c.medicineId);
      rows.push(`${m ? `${m.name} ${m.dose}` : c.medicineId}: ${c.counted} / ${c.expected}`);
    }
  }
  if (e.kind === "nurseNote" || e.kind === "visitNote") rows.push(text(e.text));
  return (
    <div className="rounded-xl border border-line bg-surface p-3 text-sm">
      <p className="flex flex-wrap items-center gap-x-2 font-bold">
        <ClipboardList aria-hidden size={16} className="text-muted" />
        {t(`report.entry.${e.kind}`)}
        <span className="font-normal text-muted">
          · {t(`source.${e.source}`)}
          {e.by ? ` · ${person(e.by)}` : ""}
        </span>
      </p>
      <p className="text-muted">{t("report.loggedAt", { time: `${dayMonth(e.at)}, ${time(e.at)}` })}</p>
      {rows.map((r, i) => (
        <p key={i}>{r}</p>
      ))}
      {e.replaces && <p className="mt-1 text-info">{t("report.replaces")}</p>}
      {replacedIds.has(e.id) && <p className="mt-1 text-warn">{t("report.replacedBy")}</p>}
    </div>
  );
}
