"use client";

import { Hash, RotateCcw, Volume1 } from "lucide-react";
import { Card, EmptyState, Screen, ScreenTitle, Section, Stat } from "@/components/ui";
import { useRepos } from "@/data/useRepos";
import { LANGUAGES, type LangCode } from "@/i18n";
import { useT } from "@/i18n/useT";

type Row = { calls: number; answered: number; replies: number; unclear: number };

export function AdminAccuracy() {
  const { t } = useT();
  const repos = useRepos();
  const a = repos.analytics.accuracy();
  if (!a) return <Screen><EmptyState title={t("common.notAllowed")} /></Screen>;
  if (!a.replies) return <Screen><ScreenTitle title={t("admin.accuracy.title")} /><EmptyState title={t("admin.accuracy.none")} /></Screen>;
  const intents = Object.entries(a.byIntent).sort((x, y) => y[1] - x[1]);
  const max = Math.max(...intents.map(([, n]) => n));
  const label = (k: string) => (k.startsWith("key") ? t(`reply.${k}` as "reply.key1") : t(`intent.${k}` as "intent.taken"));
  const groupCards = (rows: Record<string, Row>, name: (k: string) => string) => (
    <div className="grid gap-3 @md:grid-cols-2 @desk:grid-cols-3">
      {Object.entries(rows).map(([k, r]) => (
        <Card key={k} className="space-y-1">
          <p className="text-lg font-bold">{name(k)}</p>
          <dl className="grid grid-cols-2 gap-x-3 text-[15px]">
            <dt className="text-muted">{t("admin.accuracy.calls")}</dt>
            <dd className="text-right tabular-nums">{r.calls}</dd>
            <dt className="text-muted">{t("admin.accuracy.answeredRate")}</dt>
            <dd className="text-right tabular-nums">{r.calls ? Math.round((r.answered / r.calls) * 100) : 0}%</dd>
            <dt className="text-muted">{t("admin.accuracy.replies")}</dt>
            <dd className="text-right tabular-nums">{r.replies}</dd>
            <dt className="text-muted">{t("admin.accuracy.unclear")}</dt>
            <dd className="text-right tabular-nums">{r.replies ? Math.round((r.unclear / r.replies) * 100) : 0}%</dd>
          </dl>
        </Card>
      ))}
    </div>
  );
  return (
    <Screen wide>
      <ScreenTitle title={t("admin.accuracy.title")} subtitle={t("admin.accuracy.intro")} />
      <div className="grid gap-3 @md:grid-cols-3">
        <Stat label={t("admin.accuracy.unclearRate")} value={`${Math.round((a.unclear / a.replies) * 100)}%`} hint={t("admin.accuracy.unclearHint", { count: a.unclear, total: a.replies })} icon={Volume1} />
        <Stat label={t("admin.accuracy.corrections")} value={a.corrections} hint={t("admin.accuracy.correctionsHint")} icon={RotateCcw} />
        <Stat label={t("admin.accuracy.keypad")} value={a.keypad} hint={t("admin.accuracy.keypadHint")} icon={Hash} />
      </div>
      <Section title={t("admin.accuracy.byReply")}>
        <Card>
          <ul className="space-y-2">
            {intents.map(([k, n]) => (
              <li key={k} className="grid grid-cols-[minmax(0,10rem)_1fr_3rem] items-center gap-3">
                <span className="truncate">{label(k)}</span>
                <span className="h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                  <span className="block h-full rounded-full" style={{ width: `${(n / max) * 100}%`, background: "var(--series-1)" }} />
                </span>
                <span className="text-right font-semibold tabular-nums">{n}</span>
              </li>
            ))}
          </ul>
        </Card>
      </Section>
      <Section title={t("admin.accuracy.byLanguage")}>{groupCards(a.byLang, (k) => `${LANGUAGES[k as LangCode]?.nativeName ?? k} · ${t(`lang.${k as LangCode}`)}`)}</Section>
      <Section title={t("admin.accuracy.byPhone")}>{groupCards(a.byPhone, (k) => (k === "keypad" ? t("patient.keypadPhone") : t("patient.smartphone")))}</Section>
    </Screen>
  );
}
