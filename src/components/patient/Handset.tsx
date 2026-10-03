"use client";

import { Phone, PhoneOff, User } from "lucide-react";
import { SAMPLE_CALLER_NUMBER } from "@/config/brand";
import { useSpot } from "@/hooks/useSpot";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import type { PhoneStyle } from "@/store/store";

export type HandsetState = "idle" | "ringing" | "active" | "ended";

interface Props {
  style: PhoneStyle;
  state: HandsetState;
  keysEnabled: boolean;
  onAnswer: () => void;
  onDecline: () => void;
  onHangUp: () => void;
  onKey: (k: "1" | "2" | "3") => void;
  clock: string;
}

/** A drawn handset: a keypad phone or a smartphone. Both receive the same call. */
export function Handset(props: Props) {
  return props.style === "keypad" ? <KeypadPhone {...props} /> : <SmartPhone {...props} />;
}

function KeypadPhone({ state, keysEnabled, onAnswer, onDecline, onHangUp, onKey, clock }: Props) {
  const { t, app } = useT();
  const answer = useSpot<HTMLButtonElement>("patient.answer");
  const decline = useSpot<HTMLButtonElement>("patient.decline");
  const k1 = useSpot<HTMLButtonElement>("patient.key1");
  const ringing = state === "ringing";
  const inCall = state === "active";
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
  return (
    <div className="mx-auto w-full max-w-[240px] rounded-[36px] border-4 border-[#30383e] bg-[#1d2327] px-4 pt-5 pb-6 shadow-xl" role="group" aria-label={t("patient.keypadPhone")}>
      <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-[#3b444a]" aria-hidden />
      <div className={cn("rounded-lg bg-[#c9d6c3] p-3 font-mono text-[#1d2a1a] shadow-inner", ringing && "animate-pulse")} aria-live="polite">
        <div className="flex items-center justify-between text-[13px]">
          <span>▮▮▮▯</span>
          <span>{clock}</span>
        </div>
        <div className="mt-2 min-h-[64px] text-center">
          {state === "idle" && <p className="pt-3 text-[15px] font-bold">{t("patient.noCall")}</p>}
          {ringing && (
            <>
              <p className="text-[13px] font-bold">{t("patient.incoming")}</p>
              <p className="truncate text-[17px] font-bold">{app}</p>
              <p className="text-[12px]">{SAMPLE_CALLER_NUMBER}</p>
            </>
          )}
          {inCall && (
            <>
              <p className="text-[13px] font-bold">{t("patient.onCall")}</p>
              <p className="truncate text-[17px] font-bold">{app}</p>
            </>
          )}
          {state === "ended" && <p className="pt-3 text-[15px] font-bold">{t("patient.callEnded")}</p>}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          ref={answer.ref}
          type="button"
          onClick={onAnswer}
          disabled={!ringing}
          aria-label={t("patient.answer")}
          className={cn("flex h-12 items-center justify-center rounded-2xl bg-[#1f8a4c] text-white disabled:opacity-35", ringing && "ring-shake", answer.className)}
        >
          <Phone aria-hidden size={22} />
        </button>
        <button
          ref={decline.ref}
          type="button"
          onClick={inCall ? onHangUp : onDecline}
          disabled={!ringing && !inCall}
          aria-label={inCall ? t("patient.hangUp") : t("patient.decline")}
          className={cn("flex h-12 items-center justify-center rounded-2xl bg-[#c0362c] text-white disabled:opacity-35", decline.className)}
        >
          <PhoneOff aria-hidden size={22} />
        </button>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {keys.map((k) => {
          const live = keysEnabled && (k === "1" || k === "2" || k === "3");
          return (
            <button
              key={k}
              ref={k === "1" ? k1.ref : undefined}
              type="button"
              disabled={!live}
              onClick={() => onKey(k as "1" | "2" | "3")}
              aria-label={`${t("patient.pressedKey", { key: k })}`}
              className={cn(
                "flex h-11 items-center justify-center rounded-xl text-lg font-bold text-[#e9eef1] disabled:cursor-default",
                live ? "bg-[#4a555c] hover:bg-[#5b676f]" : "bg-[#2b3237] text-[#8b979e]",
                k === "1" && k1.className,
              )}
            >
              {k}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SmartPhone({ state, keysEnabled, onAnswer, onDecline, onHangUp, onKey, clock }: Props) {
  const { t, app } = useT();
  const answer = useSpot<HTMLButtonElement>("patient.answer");
  const decline = useSpot<HTMLButtonElement>("patient.decline");
  const ringing = state === "ringing";
  const inCall = state === "active";
  return (
    <div className="mx-auto w-full max-w-[240px] rounded-[40px] border-[6px] border-[#1d2327] bg-[#1d2327] shadow-xl" role="group" aria-label={t("patient.smartphone")}>
      <div className="relative flex min-h-[440px] flex-col overflow-hidden rounded-[34px] bg-gradient-to-b from-[#20403c] to-[#0f2422] px-4 py-5 text-white">
        <div className="mx-auto h-5 w-20 rounded-full bg-black/60" aria-hidden />
        <p className="mt-2 text-center text-sm opacity-80">{clock}</p>
        <div className="mt-6 flex flex-1 flex-col items-center text-center" aria-live="polite">
          <span className={cn("inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/15", ringing && "animate-pulse")}>
            <User aria-hidden size={32} />
          </span>
          {state === "idle" && <p className="mt-4 text-lg font-semibold">{t("patient.noCall")}</p>}
          {state === "ended" && <p className="mt-4 text-lg font-semibold">{t("patient.callEnded")}</p>}
          {(ringing || inCall) && (
            <>
              <p className="mt-3 text-xl font-bold">{app}</p>
              <p className="text-sm opacity-80">{SAMPLE_CALLER_NUMBER}</p>
              <p className="mt-1 text-sm font-semibold">{ringing ? t("patient.incoming") : t("patient.onCall")}</p>
            </>
          )}
          {inCall && (
            <div className="mt-5 grid grid-cols-3 gap-2" role="group" aria-label={t("patient.keypadHint")}>
              {(["1", "2", "3"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  disabled={!keysEnabled}
                  onClick={() => onKey(k)}
                  aria-label={t("patient.pressedKey", { key: k })}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-lg font-bold hover:bg-white/25 disabled:opacity-40"
                >
                  {k}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="mt-6 flex items-end justify-around">
          {ringing && (
            <>
              <button ref={decline.ref} type="button" onClick={onDecline} className={cn("flex flex-col items-center gap-1 rounded-2xl", decline.className)}>
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#d23b30]">
                  <PhoneOff aria-hidden size={24} />
                </span>
                <span className="text-sm">{t("patient.decline")}</span>
              </button>
              <button ref={answer.ref} type="button" onClick={onAnswer} className={cn("flex flex-col items-center gap-1 rounded-2xl", answer.className)}>
                <span className="ring-shake flex h-14 w-14 items-center justify-center rounded-full bg-[#22a35a]">
                  <Phone aria-hidden size={24} />
                </span>
                <span className="text-sm">{t("patient.answer")}</span>
              </button>
            </>
          )}
          {inCall && (
            <button type="button" onClick={onHangUp} className="flex flex-col items-center gap-1">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#d23b30]">
                <PhoneOff aria-hidden size={24} />
              </span>
              <span className="text-sm">{t("patient.hangUp")}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
