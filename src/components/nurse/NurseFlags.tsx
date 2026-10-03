"use client";

import { ChevronRight, PhoneCall } from "lucide-react";
import { useState } from "react";
import { flagStyle, sortFlags } from "@/components/shared/flagStyle";
import { usePane } from "@/components/shell/PaneContext";
import { Card, Chip, EmptyState, Screen, ScreenTitle, Segmented } from "@/components/ui";
import { useRepos } from "@/data/useRepos";
import type { Flag } from "@/domain/types";
import { useSpot } from "@/hooks/useSpot";
import { useT } from "@/i18n/useT";
import { localDate } from "@/lib/time";
import { setUi, useDemo } from "@/store/store";

type Scope = "open" | "closed" | "all";

export function NurseFlags() {
  const { t } = useT();
  const pane = usePane();
  const repos = useRepos();
  const now = useDemo((s) => s.now);
  const [scope, setScope] = useState<Scope>("open");
  const today = localDate(now);
  const all = repos.flags.all().filter((f) => f.type !== "paymentFailed");
  const list =
    scope === "open"
      ? sortFlags(all.filter((f) => f.status !== "closed"))
      : scope === "closed"
        ? all.filter((f) => f.status === "closed" && f.closedAt && localDate(f.closedAt) === today).reverse()
        : [...all].reverse().slice(0, 80);
  const firstUrgent = list.find((f) => f.urgency === "urgent")?.id;
  const open = (f: Flag) => {
    setUi((ui) => ({ selection: { ...ui.selection, flagId: f.id } }));
    pane.go("flag");
  };
  return (
    <Screen>
      <ScreenTitle title={t("nurse.flags.title")} />
      <Segmented<Scope>
        size="sm"
        label={t("nurse.flags.title")}
        value={scope}
        onChange={setScope}
        options={[
          { value: "open", label: `${t("nurse.flags.open")} (${all.filter((f) => f.status !== "closed").length})` },
          { value: "closed", label: t("nurse.flags.closedToday") },
          { value: "all", label: t("nurse.flags.all") },
        ]}
      />
      {list.length === 0 ? (
        <EmptyState title={scope === "closed" ? t("nurse.flags.emptyClosed") : t("nurse.flags.empty")} />
      ) : (
        <ul className="space-y-2">
          {list.map((f) => (
            <FlagRow key={f.id} f={f} onOpen={() => open(f)} spot={f.id === firstUrgent} />
          ))}
        </ul>
      )}
    </Screen>
  );
}

function FlagRow({ f, onOpen, spot }: { f: Flag; onOpen: () => void; spot: boolean }) {
  const { t, person, time, dayMonth } = useT();
  const s = useSpot<HTMLButtonElement>(spot ? "nurse.flag.urgent" : `nurse.flag.${f.id}`);
  const style = flagStyle(f);
  return (
    <li>
      <Card className="p-0">
        <button ref={s.ref} type="button" onClick={onOpen} className={`flex w-full items-start gap-3 rounded-2xl p-4 text-left hover:bg-surface-2 ${s.className ?? ""}`}>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Chip size="sm" tone={style.tone} icon={style.icon}>
                {t(`flag.urgency.${f.urgency}`)}
              </Chip>
              {f.status === "calling" && (
                <Chip size="sm" tone="info" icon={PhoneCall}>
                  {t("nurse.flags.calling")}
                </Chip>
              )}
              {f.status === "closed" && <Chip size="sm" tone="ok">{t("flag.status.closed")}</Chip>}
            </div>
            <p className="text-lg font-bold">{t(`flag.type.${f.type}`)}</p>
            <p className="text-muted">
              {person(f.patientId)}
              {f.slot ? ` · ${t("nurse.flags.slot", { slot: t(`slot.${f.slot}`) })}` : ""}
            </p>
            <p className="text-sm text-muted">{t("nurse.flags.opened", { time: `${dayMonth(f.openedAt)}, ${time(f.openedAt)}` })}</p>
          </div>
          <ChevronRight aria-hidden size={20} className="mt-1 shrink-0 text-muted" />
        </button>
      </Card>
    </li>
  );
}
