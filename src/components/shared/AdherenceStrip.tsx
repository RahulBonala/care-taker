"use client";

import { CircleCheck, CircleMinus, CircleX, TriangleAlert } from "lucide-react";
import type { DoseBook } from "@/domain/doses";
import { adherence } from "@/domain/doses";
import type { Patient } from "@/domain/types";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { addDays, type LocalDate } from "@/lib/time";

/** One square per day: share of doses confirmed in the log, as a number and an icon. */
export function AdherenceStrip({ book, p, endDate, days = 14, now }: { book: DoseBook; p: Patient; endDate: LocalDate; days?: number; now: number }) {
  const { t, dayMonth, weekday } = useT();
  const dates = Array.from({ length: days }, (_, i) => addDays(endDate, i - days + 1));
  return (
    <ol className="grid grid-cols-7 gap-1.5" aria-label={t("family.history.strip")}>
      {dates.map((d) => {
        const a = adherence(book, p, [d], now);
        const pct = a.percent;
        const tone = pct == null ? "none" : pct === 100 ? "ok" : pct >= 60 ? "warn" : "danger";
        const Icon = tone === "none" ? CircleMinus : tone === "ok" ? CircleCheck : tone === "warn" ? TriangleAlert : CircleX;
        return (
          <li
            key={d}
            className={cn(
              "flex min-h-[72px] min-w-0 flex-col items-center justify-center rounded-xl px-0.5 py-1.5 text-center",
              tone === "none" && "bg-surface-2 text-muted",
              tone === "ok" && "bg-ok-soft text-ok",
              tone === "warn" && "bg-warn-soft text-warn",
              tone === "danger" && "bg-danger-soft text-danger",
            )}
            title={`${dayMonth(d)}: ${pct == null ? t("family.history.noDoses") : t("family.history.confirmedOf", { confirmed: a.confirmed, total: a.due })}`}
          >
            <span className="text-[12px] font-semibold text-ink/80">{weekday(d)}</span>
            <Icon aria-hidden size={16} />
            <span className="text-[13px] font-bold tabular-nums">{pct == null ? "–" : t("family.history.percent", { value: pct })}</span>
            <span className="sr-only">
              {dayMonth(d)}: {pct == null ? t("family.history.noDoses") : t("family.history.confirmedOf", { confirmed: a.confirmed, total: a.due })}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
