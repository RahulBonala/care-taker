"use client";

import { CircleCheck, CircleX, Printer, ShieldAlert, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { PrintPortal } from "@/components/shared/PrintPortal";
import { Avatar, Banner, Button, Card, Chip, EmptyState, Screen, ScreenTitle, Section, Sheet } from "@/components/ui";
import { useActingAs, useRepos } from "@/data/useRepos";
import { noCallsReason } from "@/domain/schedule";
import type { Patient } from "@/domain/types";
import { useT } from "@/i18n/useT";
import { addDays, localDate } from "@/lib/time";
import { printedHandout } from "@/store/roleActions";
import { useDemo } from "@/store/store";
import { Handout } from "./Handout";

export function DeskToday() {
  const { t } = useT();
  const repos = useRepos();
  const deskId = useActingAs();
  const now = useDemo((s) => s.now);
  const [handout, setHandout] = useState<Patient | null>(null);
  const today = localDate(now);
  const weekAgo = addDays(today, -7);
  const sorted = repos.patients.list().slice().sort((a, b) => b.enrolledAt - a.enrolledAt);
  const todays = sorted.filter((p) => localDate(p.enrolledAt) === today);
  const recent = sorted.filter((p) => localDate(p.enrolledAt) < today && localDate(p.enrolledAt) >= weekAgo);
  return (
    <Screen>
      <ScreenTitle title={t("desk.today.title")} />
      <Banner tone="info" icon={ShieldCheck}>{t("desk.today.noClinical")}</Banner>
      {todays.length === 0 ? <EmptyState title={t("desk.today.empty")} /> : <ul className="space-y-2">{todays.map((p) => <Row key={p.id} p={p} now={now} onHandout={() => setHandout(p)} />)}</ul>}
      {recent.length > 0 && (
        <Section title={t("desk.today.recent")}>
          <ul className="space-y-2">
            {recent.map((p) => (
              <Row key={p.id} p={p} now={now} onHandout={() => setHandout(p)} />
            ))}
          </ul>
        </Section>
      )}
      <Sheet
        open={handout != null}
        onClose={() => setHandout(null)}
        title={t("desk.enrol.handout")}
        wide
        footer={
          <Button variant="primary" icon={Printer} onClick={() => { if (handout) printedHandout(handout.id, deskId); window.print(); }}>
            {t("desk.enrol.printHandout")}
          </Button>
        }
      >
        {handout && (
          <>
            <Handout p={handout} />
            <PrintPortal>
              <Handout p={handout} />
            </PrintPortal>
          </>
        )}
      </Sheet>
    </Screen>
  );
}

function Row({ p, now, onHandout }: { p: Patient; now: number; onHandout: () => void }) {
  const { t, patient, time, dayMonth, person } = useT();
  const reason = noCallsReason(p, now);
  const status =
    reason === "notVerified"
      ? { tone: "warn" as const, icon: ShieldAlert, label: t("desk.today.awaiting") }
      : reason === "noConsent"
        ? { tone: "danger" as const, icon: CircleX, label: t("desk.today.noConsent") }
        : reason === "packageEnded"
          ? { tone: "neutral" as const, icon: CircleX, label: t("desk.today.ended") }
          : { tone: "ok" as const, icon: CircleCheck, label: t("desk.today.active") };
  return (
    <li>
      <Card className="flex flex-wrap items-center gap-3">
        <Avatar hue={p.hue} size={44} />
        <div className="min-w-0 flex-1">
          <p className="font-bold">{patient(p)}</p>
          <p className="text-sm text-muted">{t("desk.today.enrolledAt", { time: `${dayMonth(p.enrolledAt)}, ${time(p.enrolledAt)}`, person: person(p.enrolledBy) })}</p>
          <Chip size="sm" tone={status.tone} icon={status.icon}>
            {status.label}
          </Chip>
        </div>
        <Button size="sm" icon={Printer} onClick={onHandout}>
          {t("desk.enrol.handout")}
        </Button>
      </Card>
    </li>
  );
}
