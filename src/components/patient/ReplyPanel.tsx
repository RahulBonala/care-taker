"use client";

import { CircleCheck, CircleX, Clock, Frown, HandHelping, Hourglass, MessageSquareText, Send, UserX, Utensils, Volume1 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { classifyReply } from "@/call-engine/classify";
import type { CallPhase } from "@/call-engine/machine";
import type { CallInput, ReplyIntent } from "@/domain/types";
import { useSpot } from "@/hooks/useSpot";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { Button, Input } from "@/components/ui";

const voice = (intent: ReplyIntent, minutes?: number): CallInput => (minutes != null ? { type: "reply", intent, via: "voice", minutes } : { type: "reply", intent, via: "voice" });

function SpotButton({ spot, ...props }: React.ComponentProps<typeof Button> & { spot: string }) {
  const s = useSpot<HTMLButtonElement>(spot);
  return <Button ref={s.ref} data-spot={spot} {...props} className={cn(props.className, s.className)} />;
}

/** What the patient says next. The choices depend on what the system just asked. */
export function ReplyPanel({ phase, disabled, onReply }: { phase: CallPhase; disabled: boolean; onReply: (input: CallInput) => void }) {
  const { t } = useT();
  const [text, setText] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    const c = classifyReply(value);
    onReply({ type: "reply", intent: c.intent, minutes: c.minutes, via: "text", text: value });
    setText("");
  };

  const laterGroup = (
    <div className="rounded-2xl border border-line p-2">
      <p className="flex items-center gap-2 px-1 pb-2 text-sm font-semibold text-muted">
        <Hourglass aria-hidden size={16} />
        {phase === "awaitingCallbackTime" ? t("patient.laterChoose") : `${t("replyBtn.later")} · ${t("patient.laterChoose")}`}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {[10, 30, 60].map((m) => (
          <SpotButton key={m} spot={`patient.reply.later${m}`} size="md" variant="secondary" disabled={disabled} onClick={() => onReply(voice("later", m))}>
            {t("common.minutes", { count: m })}
          </SpotButton>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {phase === "confirmTaken" ? (
        <div className="grid grid-cols-2 gap-2">
          <SpotButton spot="patient.reply.yes" size="lg" variant="ok" icon={CircleCheck} disabled={disabled} onClick={() => onReply(voice("yes"))}>
            {t("replyBtn.yes")}
          </SpotButton>
          <SpotButton spot="patient.reply.no" size="lg" variant="secondary" icon={CircleX} disabled={disabled} onClick={() => onReply(voice("no"))}>
            {t("replyBtn.no")}
          </SpotButton>
        </div>
      ) : phase === "awaitingCallbackTime" ? (
        laterGroup
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2 @sm:grid-cols-2">
            <SpotButton spot="patient.reply.taken" size="lg" variant="ok" icon={CircleCheck} disabled={disabled} onClick={() => onReply(voice("taken"))}>
              {t("replyBtn.taken")}
            </SpotButton>
            <SpotButton spot="patient.reply.notEaten" size="lg" icon={Utensils} disabled={disabled} onClick={() => onReply(voice("notEaten"))}>
              {t("replyBtn.notEaten")}
            </SpotButton>
          </div>
          {laterGroup}
          <div className="grid grid-cols-1 gap-2 @sm:grid-cols-2">
            <SpotButton spot="patient.reply.unwell" variant="danger" icon={Frown} disabled={disabled} onClick={() => onReply(voice("unwell"))}>
              {t("replyBtn.unwell")}
            </SpotButton>
            <SpotButton spot="patient.reply.wantPerson" icon={HandHelping} disabled={disabled} onClick={() => onReply(voice("wantPerson"))}>
              {t("replyBtn.wantPerson")}
            </SpotButton>
            <SpotButton spot="patient.reply.refuse" icon={CircleX} disabled={disabled} onClick={() => onReply(voice("refuse"))}>
              {t("replyBtn.refuse")}
            </SpotButton>
            <SpotButton spot="patient.reply.someoneElse" icon={UserX} disabled={disabled} onClick={() => onReply(voice("someoneElse"))}>
              {t("replyBtn.someoneElse")}
            </SpotButton>
          </div>
        </>
      )}
      <SpotButton spot="patient.reply.unclear" full variant="ghost" icon={Volume1} disabled={disabled} onClick={() => onReply(voice("unclear"))} className="border border-dashed border-line">
        {t("replyBtn.unclear")}
      </SpotButton>
      <form onSubmit={submit} className="space-y-1.5">
        <label htmlFor="free-reply" className="flex items-center gap-2 font-semibold">
          <MessageSquareText aria-hidden size={18} className="text-muted" />
          {t("replyBtn.freeText")}
        </label>
        <div className="flex gap-2">
          <Input id="free-reply" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("replyBtn.freeTextPlaceholder")} disabled={disabled} autoComplete="off" />
          <Button type="submit" variant="primary" icon={Send} disabled={disabled || !text.trim()} aria-label={t("common.send")}>
            <span className="sr-only @sm:not-sr-only">{t("common.send")}</span>
          </Button>
        </div>
      </form>
      <p className="flex items-center gap-2 text-sm text-muted">
        <Clock aria-hidden size={14} />
        {t("patient.keypadHint")}
      </p>
    </div>
  );
}
