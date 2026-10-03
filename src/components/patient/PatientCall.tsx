"use client";

import { PhoneIncoming, PhoneOff, Speech } from "lucide-react";
import { useCallback, useState } from "react";
import { replay } from "@/call-engine/machine";
import { CallResult } from "@/components/shared/CallResult";
import { CallTranscript, findVoice, useVoicesReady } from "@/components/shared/CallTranscript";
import { DoseStrip } from "@/components/shared/DoseStatus";
import { Banner, Button, Card, EmptyState, Screen, Section, Segmented, Toggle } from "@/components/ui";
import { useActingAs, useRepos } from "@/data/useRepos";
import { noCallsReason } from "@/domain/schedule";
import type { CallInput } from "@/domain/types";
import { LANGUAGES, type LangCode } from "@/i18n";
import { useT } from "@/i18n/useT";
import { localDate } from "@/lib/time";
import { answerCall, declineCall, hangUp, nextCallTimeFor, nextDoseTime, sendReply, setFocusPatient } from "@/store/actions";
import { setUi, useDemo, type PhoneStyle } from "@/store/store";
import { Handset, type HandsetState } from "./Handset";
import { ReplyPanel } from "./ReplyPanel";

export function PatientCall() {
  const tr = useT();
  const { t, time, person } = tr;
  const repos = useRepos();
  const patientId = useActingAs();
  const p = repos.patients.get(patientId);
  const now = useDemo((s) => s.now);
  const data = useDemo((s) => s.data)!;
  const styleOverride = useDemo((s) => s.ui.phoneStyle[patientId]);
  const speak = useDemo((s) => s.ui.speak);
  const callLanguage = useDemo((s) => s.ui.callLanguage);
  const [revealedAll, setRevealedAll] = useState(true);
  const onRevealed = useCallback((all: boolean) => setRevealedAll(all), []);
  useVoicesReady();

  if (!p) return <Screen><EmptyState title={t("common.notAllowed")} /></Screen>;

  const ringingAny = data.calls.find((c) => c.id === data.phone.ringingCallId);
  const activeAny = data.calls.find((c) => c.id === data.phone.activeCallId);
  const live = [activeAny, ringingAny].find((c) => c?.patientId === p.id);
  const other = [activeAny, ringingAny].find((c) => c && c.patientId !== p.id);
  const lastEnded = repos.calls.forPatient(p.id).filter((c) => c.status === "ended").at(-1);
  const shown = live ?? lastEnded;
  const state: HandsetState = live ? (live.status === "ringing" ? "ringing" : "active") : lastEnded && now - (lastEnded.endedAt ?? 0) < 30 * 60_000 ? "ended" : "idle";
  const phase = live && live.status === "inProgress" ? replay(live.inputs, live.ctx).state.phase : undefined;
  const style: PhoneStyle = styleOverride ?? p.phoneType;
  const callLang: LangCode = callLanguage === "ui" ? tr.lang : (shown?.lang ?? p.language);
  const reason = noCallsReason(p, now);
  const nextAt = nextCallTimeFor(data, p, now);
  const nextQueued = repos.calls.queued(p.id)[0];
  const today = repos.doses.day(p, localDate(now), now);
  const voiceMissing = speak && !findVoice(callLang);
  const canReply = Boolean(phase) && revealedAll;

  const onKey = (k: "1" | "2" | "3") => {
    if (!phase || !revealedAll) return;
    sendReply({ type: "reply", intent: "unclear", via: "key", key: k });
  };
  const onReply = (input: CallInput) => sendReply(input);

  return (
    <Screen wide>
      {reason && reason !== "notStarted" && <Banner tone="warn" icon={PhoneOff} title={t(`noCalls.${reason}`, { date: { $date: p.pkg.startDate } })} />}
      {other && (
        <Banner
          tone="info"
          icon={PhoneIncoming}
          title={t("patient.otherRinging", { patient: person(other.patientId) })}
          action={
            <Button size="sm" variant="secondary" onClick={() => setFocusPatient(other.patientId)}>
              {t("patient.switchTo")}
            </Button>
          }
        />
      )}

      <div className="grid gap-6 @desk:grid-cols-[minmax(260px,320px)_1fr]">
        <div className="space-y-4">
          <Handset style={style} state={state} keysEnabled={canReply} clock={time(now)} onAnswer={answerCall} onDecline={declineCall} onHangUp={hangUp} onKey={onKey} />
          {state === "idle" && (
            <Card className="space-y-3 text-center">
              <p className="font-bold">{t("patient.idleTitle")}</p>
              <p className="text-muted">{nextQueued ? t("patient.nextCallAt", { slot: { $t: `slot.${nextQueued.slot}` }, time: { $time: nextQueued.at } }) : t("patient.noMoreToday")}</p>
              {nextAt != null && (
                <Button variant="primary" full icon={PhoneIncoming} onClick={() => nextDoseTime()}>
                  {t("patient.ringNow")}
                </Button>
              )}
              <p className="text-sm text-muted">{t("patient.ringHint")}</p>
            </Card>
          )}
          <Card className="space-y-3">
            <Segmented<PhoneStyle>
              label={t("patient.handset")}
              value={style}
              onChange={(v) => setUi((ui) => ({ phoneStyle: { ...ui.phoneStyle, [p.id]: v } }))}
              options={[
                { value: "keypad", label: t("patient.keypadPhone") },
                { value: "smartphone", label: t("patient.smartphone") },
              ]}
              className="w-full [&>button]:flex-1"
            />
            <Toggle checked={speak} onChange={(v) => setUi({ speak: v })} label={t("patient.speak")} />
            {voiceMissing && (
              <p className="flex items-start gap-2 text-sm text-muted">
                <Speech aria-hidden size={16} className="mt-0.5 shrink-0" />
                {t("patient.noVoice", { language: t(`lang.${callLang}`) })}
              </p>
            )}
            {p.language !== tr.lang && (
              <div className="space-y-1.5">
                <p className="font-semibold">{t("patient.callLanguage")}</p>
                <Segmented
                  label={t("patient.callLanguage")}
                  value={callLanguage}
                  onChange={(v) => setUi({ callLanguage: v })}
                  options={[
                    { value: "patient", label: t("patient.patientLanguage", { language: LANGUAGES[p.language].nativeName }) },
                    { value: "ui", label: t("patient.demoLanguage", { language: LANGUAGES[tr.lang].nativeName }) },
                  ]}
                  size="sm"
                />
              </div>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold">{t("patient.transcript")}</h2>
              {shown && !live && shown.endedAt && <span className="text-sm text-muted">{t("patient.lastCall", { time: { $time: shown.ctx.startedAt } })}</span>}
            </div>
            {shown && shown.inputs.length > 0 ? (
              <CallTranscript key={shown.id} call={shown} patient={p} callLang={callLang} animate={Boolean(live)} speak={speak && Boolean(live)} onRevealedAll={onRevealed} className="max-h-[420px] overflow-y-auto pr-1" />
            ) : (
              <p className="text-muted">{t("patient.transcriptEmpty")}</p>
            )}
          </Card>

          {phase && (
            <Card className="space-y-3">
              <div>
                <h2 className="text-lg font-bold">{t("patient.replies")}</h2>
                <p className="text-sm text-muted">{revealedAll ? t("patient.repliesHint") : t("patient.waitForLine")}</p>
              </div>
              <ReplyPanel phase={phase} disabled={!canReply} onReply={onReply} />
            </Card>
          )}

          {!live && lastEnded && <CallResult call={lastEnded} />}
        </div>
      </div>

      <Section title={t("patient.todayStrip")}>
        <DoseStrip views={today} />
      </Section>
    </Screen>
  );
}
