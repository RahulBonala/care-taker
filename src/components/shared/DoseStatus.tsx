"use client";

import { CircleCheck, CircleX, Clock, Hourglass, ShieldCheck, type LucideIcon } from "lucide-react";
import type { DoseView } from "@/domain/doses";
import type { DoseStatus } from "@/domain/types";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { Chip, toneClass, type Tone } from "@/components/ui";

export const DOSE_STYLE: Record<DoseStatus, { icon: LucideIcon; tone: Tone }> = {
  due: { icon: Clock, tone: "info" },
  postponed: { icon: Hourglass, tone: "warn" },
  takenSelf: { icon: CircleCheck, tone: "ok" },
  takenCaregiver: { icon: ShieldCheck, tone: "ok" },
  missed: { icon: CircleX, tone: "danger" },
};

export function DoseChip({ view, size = "md" }: { view: DoseView; size?: "sm" | "md" }) {
  const { t, time } = useT();
  const style = DOSE_STYLE[view.status];
  const label = view.status === "due" && view.upcoming ? t("status.dueAt", { time: time(view.callAt) }) : t(`status.${view.status}`);
  return (
    <Chip tone={view.status === "due" && view.upcoming ? "neutral" : style.tone} icon={style.icon} size={size}>
      {label}
    </Chip>
  );
}

/** Today's dose slots: name, time and status in words and icons. */
export function DoseStrip({ views, large, className }: { views: DoseView[]; large?: boolean; className?: string }) {
  const { t, time } = useT();
  if (!views.length) return <p className="text-muted">{t("patient.noDosesToday")}</p>;
  return (
    <ol className={cn("grid gap-2", large ? "@md:grid-cols-2" : "grid-cols-[repeat(auto-fill,minmax(min(100%,190px),1fr))]", className)}>
      {views.map((v) => {
        const style = DOSE_STYLE[v.status];
        const Icon = style.icon;
        const tone = v.status === "due" && v.upcoming ? "neutral" : style.tone;
        return (
          <li key={v.slot} className={cn("flex min-w-0 items-start gap-3 rounded-2xl border border-line bg-surface p-3", large && "p-4")}>
            <span className={cn("mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full", toneClass(tone))}>
              <Icon aria-hidden size={20} />
            </span>
            <div className="min-w-0">
              <p className={cn("font-bold", large && "text-lg")}>
                {t(`slot.${v.slot}`)} <span className="font-normal text-muted">· {time(v.callAt)}</span>
              </p>
              <p className="text-[15px]">{v.status === "due" && v.upcoming ? t("status.upcoming") : t(`status.${v.status}`)}</p>
              {v.status === "postponed" && v.nextCallAt && <p className="text-sm text-muted">{t("status.nextCall", { time: time(v.nextCallAt) })}</p>}
              {v.flagged && v.status !== "takenSelf" && v.status !== "takenCaregiver" && <p className="text-sm text-warn">{t("status.flagged")}</p>}
              {v.refused && v.status !== "takenSelf" && v.status !== "takenCaregiver" && <p className="text-sm text-muted">{t("status.refused")}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
