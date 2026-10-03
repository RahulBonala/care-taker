"use client";

import { CircleCheck, Phone, PhoneCall, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { CallTranscript } from "@/components/shared/CallTranscript";
import { flagStyle } from "@/components/shared/flagStyle";
import { VisitCard } from "@/components/shared/VisitCard";
import { usePane } from "@/components/shell/PaneContext";
import { Banner, Button, Card, Checkbox, Chip, EmptyState, Field, KV, Screen, Section, Textarea } from "@/components/ui";
import { useActingAs, useRepos } from "@/data/useRepos";
import { useSpot } from "@/hooks/useSpot";
import { useT } from "@/i18n/useT";
import { nurseCloseFlag, nurseStartCall, viewed } from "@/store/roleActions";
import { useDemo } from "@/store/store";

export function NurseFlag() {
  const tr = useT();
  const { t, person, time, dayMonth, text } = tr;
  const pane = usePane();
  const repos = useRepos();
  const nurseId = useActingAs();
  const flagId = useDemo((s) => s.ui.selection.flagId);
  const f = repos.flags.get(flagId);
  const p = repos.patients.get(f?.patientId);
  const [outcome, setOutcome] = useState("");
  const [spoke, setSpoke] = useState(true);
  const [doseTaken, setDoseTaken] = useState(false);
  const [error, setError] = useState("");
  const callSpot = useSpot<HTMLButtonElement>("nurse.flag.call");
  const closeSpot = useSpot<HTMLButtonElement>("nurse.flag.close");
  const noteSpot = useSpot<HTMLTextAreaElement>("nurse.flag.note");

  useEffect(() => {
    if (f) viewed(nurseId, "nurse", f.id, "audit.viewedFlag", f.patientId, { flag: { $t: `flag.type.${f.type}` } });
  }, [f?.id, nurseId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!f || !p) {
    return (
      <Screen>
        <EmptyState title={flagId ? t("nurse.flag.notFound") : t("common.selectFirst")} action={<Button onClick={() => pane.go("flags")}>{t("common.goToList")}</Button>} />
      </Screen>
    );
  }
  const call = repos.calls.get(f.callId);
  const visit = repos.visits.get(f.visitId);
  const report = repos.reports.get(f.reportId);
  const fam = repos.family.get(f.familyId);
  const style = flagStyle(f);
  const isFamily = f.type === "familyCallback";
  const phone = isFamily ? fam?.phone : p.phone;

  const close = () => {
    if (!outcome.trim()) {
      setError(t("nurse.flag.needOutcome"));
      return;
    }
    setError("");
    nurseCloseFlag(f.id, nurseId, { outcome: { en: outcome.trim() }, spoke, doseTaken });
  };

  return (
    <Screen>
      <Card className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={style.tone} icon={style.icon}>{t(`flag.urgency.${f.urgency}`)}</Chip>
          <Chip tone={f.status === "closed" ? "ok" : f.status === "calling" ? "info" : "neutral"}>{t(`flag.status.${f.status}`)}</Chip>
        </div>
        <h1 className="text-2xl font-bold">{t(`flag.type.${f.type}`)}</h1>
        <KV
          rows={[
            [t("nav.nurse.patient"), person(p.id)],
            [t("nurse.flag.patientPhone"), `${p.phone} · ${t(`lang.${p.language}`)}`],
            [t("nurse.flag.openedLabel"), `${dayMonth(f.openedAt)}, ${time(f.openedAt)}`],
            ...(f.slot ? ([[t("nurse.rx.slots"), t(`slot.${f.slot}`)]] as Array<[string, string]>) : []),
          ]}
        />
      </Card>

      <Section title={t("nurse.flag.context")}>
        {call ? (
          <Card className="space-y-2">
            <h3 className="font-bold">{t("nurse.flag.transcript")}</h3>
            <CallTranscript call={call} patient={p} callLang={call.lang} />
          </Card>
        ) : visit ? (
          <VisitCard v={visit} />
        ) : report ? (
          <Banner tone="danger" icon={ShieldAlert} title={t("report.checkFailed")}>
            <ul className="list-disc pl-5">
              {report.check.problems.map((pr, i) => (
                <li key={i}>{tr.tx(pr.key, pr.params)}</li>
              ))}
            </ul>
          </Banner>
        ) : isFamily && fam ? (
          <Card>{t("nurse.flag.familyAsked", { person: text(fam.name) })} · {fam.phone}</Card>
        ) : (
          <p className="text-muted">{t("nurse.flag.noCall")}</p>
        )}
      </Section>

      {f.status === "closed" ? (
        <Banner tone="ok" icon={CircleCheck} title={t("nurse.flag.closed", { person: person(f.closedBy), time: f.closedAt ? time(f.closedAt) : "" })}>
          {text(f.outcome)}
        </Banner>
      ) : (
        <Card className="space-y-4">
          {f.status === "open" ? (
            <Button ref={callSpot.ref} className={callSpot.className} variant="primary" size="lg" icon={Phone} onClick={() => nurseStartCall(f.id, nurseId)}>
              {isFamily ? t("nurse.flag.callFamily") : t("nurse.flag.callPatient")}
            </Button>
          ) : (
            <Banner tone="info" icon={PhoneCall} title={t("nurse.flag.callingNow", { person: isFamily && fam ? text(fam.name) : person(p.id), phone: phone ?? "" })}>
              {t("nurse.flag.callingHint")}
            </Banner>
          )}
          <Field label={t("nurse.flag.outcome")} htmlFor="outcome" error={error}>
            <Textarea ref={noteSpot.ref} id="outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder={t("nurse.flag.outcomePlaceholder")} className={noteSpot.className} />
          </Field>
          <Checkbox checked={spoke} onChange={setSpoke} label={isFamily ? t("nurse.flag.spokeFamily") : t("nurse.flag.spoke")} />
          {f.slot && !isFamily && <Checkbox checked={doseTaken} onChange={setDoseTaken} label={t("nurse.flag.doseOnCall", { slot: t(`slotWord.${f.slot}`) })} />}
          <Button ref={closeSpot.ref} className={closeSpot.className} variant="ok" size="lg" icon={CircleCheck} onClick={close}>
            {t("nurse.flag.close")}
          </Button>
        </Card>
      )}
    </Screen>
  );
}
