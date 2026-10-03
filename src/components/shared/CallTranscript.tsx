"use client";

import { Bot, Phone, PhoneOff, User } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { replay, type Line } from "@/call-engine/machine";
import type { CallRecord, Patient } from "@/domain/types";
import { brandName, LANGUAGES, type LangCode } from "@/i18n";
import { makeTranslator, type Translator } from "@/i18n/translator";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { useDemo } from "@/store/store";

/** Text of one transcript line in a given language. Spoken lines come only from templates. */
export function lineText(line: Line, call: CallRecord, patient: Patient | undefined, tr: Translator): string {
  if (line.speaker === "event") return tr.t(`call.event.${line.key}`);
  if (line.speaker === "patient") {
    const i = line.input;
    if (i.via === "text" && i.text) return i.text;
    if (i.via === "key") return tr.t(`reply.key${i.key ?? "1"}` as "reply.key1");
    if ((i.intent === "later" || i.intent === "notEaten") && i.minutes) return i.intent === "later" ? tr.t("reply.laterMinutes", { minutes: i.minutes }) : tr.t("reply.notEaten");
    return tr.t(`reply.${i.intent}`);
  }
  const p = line.params ?? {};
  return tr.tx(`call.${line.key}`, {
    app: brandName(tr.lang),
    patient: tr.patient(patient),
    patientName: tr.patient(patient, { honorific: false }),
    slotTablets: p.slot ? tr.t(`call.slotTablets.${p.slot}`) : "",
    time: p.time ? { $time: p.time } : "",
    minutes: p.minutes ?? 0,
  });
}

export function useCallLines(call: CallRecord | undefined) {
  return useMemo(() => (call ? replay(call.inputs, call.ctx) : undefined), [call]);
}

/**
 * The call, line by line. Shown in the language the call is in, with the
 * demo language underneath when they differ.
 */
export function CallTranscript({
  call,
  patient,
  callLang,
  animate,
  speak,
  onRevealedAll,
  className,
}: {
  call: CallRecord;
  patient: Patient | undefined;
  callLang: LangCode;
  animate?: boolean;
  speak?: boolean;
  onRevealedAll?: (all: boolean) => void;
  className?: string;
}) {
  const ui = useT();
  const data = useDemo((s) => s.data);
  const callTr = useMemo(() => makeTranslator(callLang, data), [callLang, data]);
  const result = useCallLines(call);
  const lines = useMemo(() => result?.lines ?? [], [result]);
  const [shown, setShown] = useState(animate ? 0 : lines.length);
  const spokenUpTo = useRef(animate ? 0 : lines.length);
  const listRef = useRef<HTMLOListElement>(null);

  // Reveal new lines one at a time.
  useEffect(() => {
    if (!animate) {
      setShown(lines.length);
      return;
    }
    if (shown >= lines.length) return;
    const id = window.setTimeout(() => setShown((n) => Math.min(lines.length, n + 1)), shown === 0 ? 150 : 650);
    return () => window.clearTimeout(id);
  }, [animate, shown, lines.length]);

  useEffect(() => {
    onRevealedAll?.(shown >= lines.length);
  }, [shown, lines.length, onRevealedAll]);

  // Speak system lines as they appear, if a voice for the language exists.
  useEffect(() => {
    if (!speak || typeof window === "undefined" || !("speechSynthesis" in window)) {
      spokenUpTo.current = shown;
      return;
    }
    const voice = findVoice(callLang);
    for (let i = spokenUpTo.current; i < shown; i++) {
      const line = lines[i];
      if (line?.speaker !== "system" || !voice) continue;
      const u = new SpeechSynthesisUtterance(lineText(line, call, patient, callTr));
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    }
    spokenUpTo.current = shown;
  }, [shown, speak, lines, call, patient, callTr, callLang]);

  useEffect(() => {
    listRef.current?.lastElementChild?.scrollIntoView({ block: "nearest" });
  }, [shown]);

  const showTranslation = callLang !== ui.lang;

  return (
    <ol ref={listRef} className={cn("space-y-2", className)} aria-live="polite">
      {lines.slice(0, shown).map((line, i) => {
        if (line.speaker === "event") {
          const Icon = line.key === "answered" ? Phone : PhoneOff;
          return (
            <li key={i} className="line-in flex items-center justify-center gap-2 py-1 text-sm font-semibold text-muted">
              <Icon aria-hidden size={14} />
              {ui.t(`call.event.${line.key}`)}
            </li>
          );
        }
        const system = line.speaker === "system";
        const text = lineText(line, call, patient, callTr);
        const sub = showTranslation ? lineText(line, call, patient, ui) : null;
        const understood =
          line.speaker === "patient" && line.input.via === "text" ? ui.t("replyBtn.understoodAs", { reply: ui.t(`intent.${line.input.intent}`) }) : null;
        return (
          <li key={i} className={cn("line-in flex gap-2", system ? "justify-start" : "justify-end")}>
            {system && (
              <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand" aria-hidden>
                <Bot size={18} />
              </span>
            )}
            <div className={cn("max-w-[85%] rounded-2xl px-3 py-2", system ? "rounded-tl-sm bg-surface-2" : "rounded-tr-sm bg-brand text-brand-ink")}>
              <p lang={callLang} className="text-[17px] leading-snug">
                {text}
              </p>
              {sub && sub !== text && (
                <p className={cn("mt-1 text-sm", system ? "text-muted" : "opacity-85")} lang={ui.lang}>
                  {sub}
                </p>
              )}
              {understood && <p className={cn("mt-1 text-sm font-semibold", system ? "text-muted" : "opacity-90")}>{understood}</p>}
            </div>
            {!system && (
              <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted" aria-hidden>
                <User size={18} />
              </span>
            )}
          </li>
        );
      })}
      {animate && shown < lines.length && (
        <li className="flex items-center gap-2 text-sm text-muted">
          <span className="inline-flex gap-1" aria-hidden>
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted [animation-delay:-0.2s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted [animation-delay:-0.1s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted" />
          </span>
          <button type="button" className="underline" onClick={() => setShown(lines.length)}>
            {ui.t("patient.showAll")}
          </button>
        </li>
      )}
    </ol>
  );
}

export function findVoice(lang: LangCode): SpeechSynthesisVoice | undefined {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return undefined;
  const tag = LANGUAGES[lang].speechLang.toLowerCase();
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang.toLowerCase() === tag) ?? voices.find((v) => v.lang.toLowerCase().startsWith(`${lang}-`) || v.lang.toLowerCase() === lang);
}

/** Re-render when the browser finishes loading its voices. */
export function useVoicesReady(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const on = () => setN((x) => x + 1);
    window.speechSynthesis.addEventListener("voiceschanged", on);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", on);
  }, []);
  return n;
}
