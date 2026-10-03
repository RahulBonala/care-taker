"use client";

import { CalendarClock, CreditCard, FileText, Phone, PhoneCall, PhoneOff, Stethoscope, UserRound } from "lucide-react";
import { useState } from "react";
import { DoseStrip } from "@/components/shared/DoseStatus";
import { DualTime } from "@/components/shared/DualTime";
import { usePane } from "@/components/shell/PaneContext";
import { Avatar, Banner, Button, Card, EmptyState, Screen, Section, Sheet } from "@/components/ui";
import { dayNo, priceOf, renewalDue } from "@/domain/packages";
import { noCallsReason } from "@/domain/schedule";
import type { Flag } from "@/domain/types";
import { useSpot } from "@/hooks/useSpot";
import type { Translator } from "@/i18n/translator";
import { useT } from "@/i18n/useT";
import { atLocal, localDate } from "@/lib/time";
import { requestCallback } from "@/store/roleActions";
import { useDemo } from "@/store/store";
import { cap, useFamily } from "./useFamily";

/** Plain words for what the nurse is doing about the patient, newest first. */
export function flagWords(flags: Flag[], tr: Translator, kin: string, familyId: string, now: number): Array<{ text: string; tone: "danger" | "warn" | "info" | "ok" }> {
  const out: Array<{ text: string; tone: "danger" | "warn" | "info" | "ok" }> = [];
  const today = localDate(now);
  for (const f of [...flags].sort((a, b) => b.openedAt - a.openedAt)) {
    if (f.urgency === "admin") continue;
    if (f.type === "familyCallback") {
      if (f.familyId !== familyId) continue;
      if (f.status === "open") out.push({ text: tr.t("family.flagWords.callbackOpen", { time: { $time: f.openedAt } }), tone: "info" });
      else if (f.status === "calling") out.push({ text: tr.t("family.flagWords.callbackCalling"), tone: "info" });
      else if (f.closedAt && localDate(f.closedAt) === today) out.push({ text: tr.t("family.flagWords.callbackDone", { time: { $time: f.closedAt } }), tone: "ok" });
      continue;
    }
    if (f.status === "closed") {
      if (f.spokeToPatient && f.closedAt && localDate(f.closedAt) === today) out.push({ text: cap(tr.t("family.flagWords.spoke", { kin, time: { $time: f.closedAt } })), tone: "ok" });
      continue;
    }
    if (f.type === "unwell" || f.type === "caregiverUnwell") {
      out.push({ text: cap(tr.t(f.status === "calling" ? "family.flagWords.unwellCalling" : "family.flagWords.unwellOpen", { kin })), tone: "danger" });
    } else if (f.type === "personRequested") {
      out.push({ text: cap(tr.t(f.status === "calling" ? "family.flagWords.unwellCalling" : "family.flagWords.personOpen", { kin })), tone: "danger" });
    } else if (f.type === "noAnswer") {
      out.push({ text: cap(tr.t("family.flagWords.noAnswer", { kin })), tone: "warn" });
    } else if (f.type === "caregiverNoShow") {
      out.push({ text: tr.t("family.flagWords.visitMissed"), tone: "warn" });
    } else {
      out.push({ text: f.status === "calling" ? cap(tr.t("family.flagWords.unwellCalling", { kin })) : tr.t("family.flagWords.other", { flag: tr.t(`flag.type.${f.type}`) }), tone: "warn" });
    }
  }
  return out;
}

export function FamilyHome() {
  const tr = useT();
  const { t, time, date, person, patient } = tr;
  const pane = usePane();
  const { repos, f, p, now, familyId } = useFamily();
  const data = useDemo((s) => s.data)!;
  const [callback, setCallback] = useState(false);
  const [sent, setSent] = useState(false);
  const cbSpot = useSpot<HTMLButtonElement>("family.callback");
  const reportSpot = useSpot<HTMLButtonElement>("family.openReport");
  if (!f || !p) return <Screen><EmptyState title={t("common.notAllowed")} /></Screen>;

  const today = localDate(now);
  const kin = t(`kin.${f.kin}`);
  const words = flagWords(repos.flags.forPatient(p.id), tr, kin, familyId, now);
  const doses = repos.doses.day(p, today, now);
  const calls = repos.calls.forPatient(p.id, today).filter((c) => c.status === "ended");
  const last = calls.at(-1);
  const live = data.calls.find((c) => (c.id === data.phone.activeCallId || c.id === data.phone.ringingCallId) && c.patientId === p.id);
  const nextVisit = repos.visits.forPatient(p.id).find((v) => v.status === "scheduled" && v.date >= today);
  const reason = noCallsReason(p, now);
  const day = Math.max(1, dayNo(p, today));
  const renew = renewalDue(p, today);

  const lastResult = last
    ? last.outcome === "takenLogged"
      ? t("status.takenSelf")
      : last.outcome === "postponed" || last.outcome === "callbackOtherPerson"
        ? t("status.postponed")
        : last.outcome?.startsWith("noAnswer")
          ? t("call.event.noAnswer")
          : t("status.flagged")
    : "";

  return (
    <Screen>
      <Card className="flex items-center gap-4">
        <Avatar hue={p.hue} size={64} label={patient(p)} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold">{patient(p)}</h1>
          <p className="text-muted">{tr.text(p.condition)}</p>
          <p className="text-sm font-semibold text-brand">
            {p.pkg.kind === "monthly" ? t("family.home.monthDay", { month: p.pkg.monthNo ?? 1 }) : t("family.home.dayOf", { day, total: p.pkg.lengthDays })} · {t(`pkg.name.${p.pkg.kind}`)}
          </p>
        </div>
      </Card>

      {live && (
        <Banner tone="ok" icon={PhoneCall}>
          {cap(t(live.status === "ringing" ? "family.home.ringingNow" : "family.home.callNow", { kin }))}
        </Banner>
      )}
      {words.map((w, i) => (
        <Banner key={i} tone={w.tone} icon={w.tone === "ok" ? Phone : Stethoscope}>
          {w.text}
        </Banner>
      ))}
      {reason && reason !== "notStarted" && <Banner tone="warn" icon={PhoneOff}>{t(`noCalls.${reason}`, { date: { $date: p.pkg.startDate } })}</Banner>}
      {p.pkg.status === "expired" ? (
        <Banner tone="warn" icon={CreditCard} title={t("family.home.endedTitle")} action={<Button size="sm" variant="primary" onClick={() => pane.go("package")}>{t("family.home.renewAction")}</Button>}>
          {t("family.home.endedBody")}
        </Banner>
      ) : renew ? (
        <Banner tone="brand" icon={CreditCard} title={t("family.home.renewTitle", { when: t("common.today").toLowerCase() })} action={<Button size="sm" variant="primary" onClick={() => pane.go("package")}>{t("family.home.renewAction")}</Button>}>
          {t("family.home.renewBody")}
        </Banner>
      ) : null}
      {!p.pkg.paid && (
        <Banner tone="info" icon={CreditCard} title={t("family.home.unpaidTitle")} action={<Button size="sm" variant="primary" onClick={() => pane.go("package")}>{t("family.home.payNow")}</Button>}>
          {t("family.home.unpaidBody", { amount: { $money: priceOf(data.packages, p.pkg.kind, p.pkg.lengthDays) }, package: t(`pkg.name.${p.pkg.kind}`) })}
        </Banner>
      )}
      {p.packageRequest && (
        <Banner tone="info" icon={Stethoscope} action={<Button size="sm" variant="secondary" onClick={() => pane.go("package")}>{t("family.home.renewAction")}</Button>}>
          {t("family.home.doctorAsked", { doctor: person(p.packageRequest.by), days: p.packageRequest.lengthDays })}
        </Banner>
      )}

      <Section title={t("family.home.today")} icon={CalendarClock} action={<span className="text-sm text-muted"><DualTime at={now} tz={f.timeZone} /></span>}>
        <DoseStrip views={doses} />
      </Section>

      <div className="grid gap-3 @tab:grid-cols-3">
        <Card>
          <p className="flex items-center gap-2 text-sm font-semibold text-muted">
            <Phone aria-hidden size={16} />
            {t("family.home.lastCall")}
          </p>
          {last ? (
            <>
              <p className="mt-1 font-bold">{t(`slot.${last.slot}`)} · {lastResult}</p>
              <p className="text-sm text-muted"><DualTime at={last.ctx.startedAt} tz={f.timeZone} /></p>
            </>
          ) : (
            <p className="mt-1 text-muted">{t("family.home.noCallsYet")}</p>
          )}
        </Card>
        <Card>
          <p className="flex items-center gap-2 text-sm font-semibold text-muted">
            <UserRound aria-hidden size={16} />
            {t("family.home.nextVisit")}
          </p>
          {nextVisit ? (
            <>
              <p className="mt-1 font-bold">{date(nextVisit.date)} · {time(atLocal(nextVisit.date, nextVisit.windowStart))}</p>
              <p className="text-sm text-muted">{nextVisit.caregiverId ? person(nextVisit.caregiverId) : t("family.visits.notAssigned")}</p>
            </>
          ) : (
            <p className="mt-1 text-muted">{p.carePlan.pattern === "none" ? t("family.home.noVisit") : t("family.home.noMoreVisits")}</p>
          )}
        </Card>
        <Card>
          <p className="flex items-center gap-2 text-sm font-semibold text-muted">
            <Stethoscope aria-hidden size={16} />
            {t("family.home.nextReview")}
          </p>
          <p className="mt-1 font-bold">{p.nextReviewDate ? date(p.nextReviewDate) : t("family.home.noReview")}</p>
          <p className="text-sm text-muted">{person(p.doctorId)}</p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button ref={reportSpot.ref} variant="primary" size="lg" icon={FileText} onClick={() => pane.go("report")} className={reportSpot.className}>
          {t("family.home.openReport")}
        </Button>
        <Button ref={cbSpot.ref} size="lg" icon={PhoneCall} onClick={() => { setSent(false); setCallback(true); }} className={cbSpot.className}>
          {t("family.home.requestCallback")}
        </Button>
      </div>

      <Sheet
        open={callback}
        onClose={() => setCallback(false)}
        title={t("family.home.requestCallback")}
        footer={
          sent ? (
            <Button variant="primary" onClick={() => setCallback(false)}>{t("common.done")}</Button>
          ) : (
            <>
              <Button onClick={() => setCallback(false)}>{t("common.cancel")}</Button>
              <Button variant="primary" icon={PhoneCall} onClick={() => { requestCallback(familyId); setSent(true); }}>
                {t("family.home.callbackSend")}
              </Button>
            </>
          )
        }
      >
        <p>{sent ? t("family.home.callbackSent") : t("family.home.callbackIntro", { phone: f.phone })}</p>
      </Sheet>
    </Screen>
  );
}
