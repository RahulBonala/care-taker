"use client";

import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { useMemo } from "react";
import { ROLE_ICONS } from "@/components/roles/registry";
import { EmptyState, Segmented } from "@/components/ui";
import type { ActivityEvent } from "@/domain/types";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { setUi, useDemo } from "@/store/store";

const TONE = {
  info: { icon: Info, cls: "text-info" },
  ok: { icon: CircleCheck, cls: "text-ok" },
  warn: { icon: TriangleAlert, cls: "text-warn" },
  danger: { icon: CircleAlert, cls: "text-danger" },
} as const;

export function ActivityFeed({ className }: { className?: string }) {
  const { t } = useT();
  const events = useDemo((s) => s.data?.events ?? []);
  const scope = useDemo((s) => s.ui.feedScope);
  const focus = useDemo((s) => s.ui.focusPatientId);
  const list = useMemo(() => {
    const filtered = scope === "focus" ? events.filter((e) => !e.patientId || e.patientId === focus) : events;
    return filtered.slice(-150).reverse();
  }, [events, scope, focus]);

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <h2 className="text-base font-bold">{t("shell.feed")}</h2>
        <Segmented
          size="sm"
          label={t("shell.feed")}
          value={scope}
          onChange={(v) => setUi({ feedScope: v })}
          options={[
            { value: "all", label: t("shell.feedAll") },
            { value: "focus", label: t("shell.feedFocus") },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {list.length === 0 ? (
          <EmptyState title={t("shell.feed")} body={t("shell.feedEmpty")} />
        ) : (
          <ol className="space-y-1" aria-live="polite">
            {list.map((e) => (
              <FeedItem key={e.id} e={e} />
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function FeedItem({ e }: { e: ActivityEvent }) {
  const { t, tx, time } = useT();
  const tone = TONE[e.tone];
  const Icon = tone.icon;
  return (
    <li className="line-in rounded-xl border border-line bg-surface px-3 py-2">
      <div className="flex items-start gap-2">
        <Icon aria-hidden size={18} className={cn("mt-0.5 shrink-0", tone.cls)} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-snug">{tx(e.key, e.params)}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
            <span className="tabular-nums">{time(e.at)}</span>
            <span aria-hidden>·</span>
            <span>{t("shell.seenBy")}</span>
            {e.visibleTo.map((r) => {
              const RIcon = ROLE_ICONS[r];
              return (
                <span key={r} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-1.5 py-0.5">
                  <RIcon aria-hidden size={12} />
                  {t(`roles.${r}.short`)}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </li>
  );
}
