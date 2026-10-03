"use client";

import { useT } from "@/i18n/useT";
import { PATIENT_TZ } from "@/lib/time";

/** A time in India, and in the viewer's own time zone when that is different. */
export function DualTime({ at, tz, withDate }: { at: number; tz?: string; withDate?: boolean }) {
  const { t, time, dayMonth } = useT();
  const here = `${withDate ? `${dayMonth(at)}, ` : ""}${time(at)}`;
  if (!tz || tz === PATIENT_TZ) return <span>{here}</span>;
  const there = `${withDate ? `${dayMonth(at, tz)}, ` : ""}${time(at, tz)}`;
  return (
    <span>
      {t("family.home.bothTimes", { here, herePlace: t("time.india"), there, therePlace: t(`tz.${tz}` as "tz.Asia/Kolkata") })}
    </span>
  );
}
