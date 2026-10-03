"use client";

import { ArrowRight, CalendarClock, ClipboardCheck, Flag as FlagIcon, Info } from "lucide-react";
import type { CallRecord, Flag, LogEntry, QueuedCall } from "@/domain/types";
import { useT } from "@/i18n/useT";
import { setUi, useDemo } from "@/store/store";
import { useOptionalPane } from "@/components/shell/PaneContext";
import { Button, Card, Chip } from "@/components/ui";

/** After a call: what was logged, what was scheduled, or which flag was opened. */
export function CallResult({ call, compact }: { call: CallRecord; compact?: boolean }) {
  const { t, time } = useT();
  const pane = useOptionalPane();
  const data = useDemo((s) => s.data)!;
  const entry = data.log.find((e) => e.kind === "doseTaken" && e.callId === call.id) as Extract<LogEntry, { kind: "doseTaken" }> | undefined;
  const flag: Flag | undefined = data.flags.find((f) => f.callId === call.id);
  const next: QueuedCall | undefined = data.queue
    .filter((q) => q.patientId === call.patientId && q.date === call.date && q.slot === call.slot && q.at > call.ctx.startedAt)
    .sort((a, b) => a.at - b.at)[0];
  const slot = t(`slot.${call.slot}`);
  const outcome = call.outcome ?? "noAnswerRetry";
  const text = t(`outcome.${outcome}`, { slot: t(`slotWord.${call.slot}`), time: { $time: outcome === "takenLogged" ? call.ctx.startedAt : next?.at ?? call.ctx.startedAt } });

  const openFlag = () => {
    if (!flag || !pane) return;
    setUi((ui) => ({ selection: { ...ui.selection, flagId: flag.id } }));
    pane.go("flag", "nurse");
  };

  return (
    <Card className="space-y-3" aria-live="polite">
      {!compact && <h3 className="text-lg font-bold">{t("patient.result")}</h3>}
      <p className="flex items-start gap-2">
        <Info aria-hidden size={20} className="mt-0.5 shrink-0 text-info" />
        <span>{text}</span>
      </p>
      {entry && (
        <div className="flex items-start gap-2 rounded-xl bg-ok-soft p-3 text-ok">
          <ClipboardCheck aria-hidden size={20} className="mt-0.5 shrink-0" />
          <div className="min-w-0 text-ink">
            <p className="font-bold text-ok">{t("patient.written")}</p>
            <p>
              {t("report.entry.doseTaken")} · {slot} · {time(entry.takenAt)}
            </p>
            <p className="text-sm text-muted">
              {t(`source.${entry.source}`)} · {t(`confirmation.${entry.confirmation}`)}
            </p>
          </div>
        </div>
      )}
      {!entry && outcome !== "takenLogged" && <p className="text-sm text-muted">{t("outcome.nothingLogged")}</p>}
      {next && (
        <div className="flex items-start gap-2 rounded-xl bg-info-soft p-3">
          <CalendarClock aria-hidden size={20} className="mt-0.5 shrink-0 text-info" />
          <div className="min-w-0">
            <p className="font-bold text-info">{t("patient.scheduled")}</p>
            <p>
              {slot} · {time(next.at)}
            </p>
          </div>
        </div>
      )}
      {flag && (
        <div className="flex flex-wrap items-start gap-2 rounded-xl bg-warn-soft p-3">
          <FlagIcon aria-hidden size={20} className="mt-0.5 shrink-0 text-warn" />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-warn">{t("patient.flagOpened")}</p>
            <p className="flex flex-wrap items-center gap-2">
              {t(`flag.type.${flag.type}`)}
              <Chip size="sm" tone={flag.urgency === "urgent" ? "danger" : "warn"}>
                {t(`flag.urgency.${flag.urgency}`)}
              </Chip>
            </p>
          </div>
          {pane && (
            <Button size="sm" variant="secondary" iconRight={ArrowRight} onClick={openFlag}>
              {t("patient.seeInNurse")}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
