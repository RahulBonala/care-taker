"use client";

import { ArrowRight, Play } from "lucide-react";
import { useState } from "react";
import { usePane } from "@/components/shell/PaneContext";
import { Banner, Button, Card, Screen, ScreenTitle, Section, Segmented, Toggle } from "@/components/ui";
import { useT } from "@/i18n/useT";
import { setSimSetting } from "@/store/roleActions";
import { runScenario, SCENARIOS, type ScenarioId, type ScenarioResult } from "@/store/scenarios";
import { setUi, useDemo } from "@/store/store";

export function AdminDemo() {
  const { t, tx, person } = useT();
  const pane = usePane();
  const focus = useDemo((s) => s.ui.focusPatientId);
  const settings = useDemo((s) => s.data?.settings);
  const demo = useDemo((s) => s.ui.demo);
  const [result, setResult] = useState<(ScenarioResult & { id: ScenarioId }) | null>(null);
  if (!settings) return null;
  return (
    <Screen wide>
      <ScreenTitle title={t("admin.demo.title")} subtitle={t("admin.demo.intro", { patient: person(focus) })} />
      {result && (
        <Banner
          tone={result.ok ? "ok" : "warn"}
          title={t(`admin.demo.scenario.${result.id}`)}
          action={
            result.look ? (
              <Button size="sm" variant="primary" iconRight={ArrowRight} onClick={() => pane.go(result.look!.screen, result.look!.role)}>
                {t("admin.demo.look")}
              </Button>
            ) : undefined
          }
        >
          {tx(result.key, result.params)}
        </Banner>
      )}
      <Section title={t("admin.demo.edgeCases")}>
        <ul className="grid gap-2 @md:grid-cols-2 @desk:grid-cols-3">
          {SCENARIOS.map((id) => (
            <li key={id}>
              <Card className="flex h-full flex-col justify-between gap-3">
                <p className="font-semibold">{t(`admin.demo.scenario.${id}`)}</p>
                <Button size="sm" variant="secondary" icon={Play} onClick={() => setResult({ ...runScenario(id), id })} data-spot={`admin.scenario.${id}`}>
                  {t("admin.demo.run")}
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      </Section>
      <Section title={t("admin.demo.settings")}>
        <Card className="space-y-3">
          <div className="space-y-1.5">
            <p className="font-semibold">{t("admin.demo.skipped")}</p>
            <Segmented
              size="sm"
              label={t("admin.demo.skipped")}
              value={settings.skippedFocusCalls}
              onChange={(v) => setSimSetting("skippedFocusCalls", v)}
              options={[
                { value: "taken", label: t("admin.demo.skippedTaken") },
                { value: "unanswered", label: t("admin.demo.skippedUnanswered") },
              ]}
            />
          </div>
          <Toggle checked={settings.autoVisits} onChange={(v) => setSimSetting("autoVisits", v)} label={t("admin.demo.autoVisits")} />
          <Toggle checked={settings.paymentOutcome === "fail"} onChange={(v) => setSimSetting("paymentOutcome", v ? "fail" : "success")} label={t("admin.demo.paymentFails")} />
          <Toggle checked={settings.uploadFails} onChange={(v) => setSimSetting("uploadFails", v)} label={t("admin.demo.uploadFails")} />
          <Toggle checked={demo.slowNetwork} onChange={(v) => setUi((ui) => ({ demo: { ...ui.demo, slowNetwork: v } }))} label={t("admin.demo.slow")} />
          <Toggle checked={demo.forceErrors} onChange={(v) => setUi((ui) => ({ demo: { ...ui.demo, forceErrors: v } }))} label={t("admin.demo.errors")} />
          <Toggle checked={demo.offline} onChange={(v) => setUi((ui) => ({ demo: { ...ui.demo, offline: v } }))} label={t("admin.demo.offline")} />
        </Card>
      </Section>
    </Screen>
  );
}
