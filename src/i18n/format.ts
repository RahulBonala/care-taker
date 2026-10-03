/**
 * Dates, times and money, written the same way in every browser:
 * 12-hour times, dates like 5 Oct 2026, rupees with Indian digit grouping.
 * Month names and am/pm words come from the language file.
 */
import { istParts, PATIENT_TZ, type WallParts, zonedParts } from "@/lib/time";
import type { Messages } from "./types";

export function groupIndian(n: number): string {
  const neg = n < 0;
  const [int, frac] = Math.abs(n).toString().split(".");
  let out: string;
  if (int.length <= 3) out = int;
  else {
    const last3 = int.slice(-3);
    const rest = int.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    out = `${rest},${last3}`;
  }
  return (neg ? "-" : "") + out + (frac ? `.${frac}` : "");
}

export function formatMoney(rupees: number): string {
  return `₹${groupIndian(Math.round(rupees))}`;
}

function fill(pattern: string, parts: Record<string, string>): string {
  return pattern.replace(/\{(\w+)\}/g, (_, k: string) => parts[k] ?? "");
}

export function periodFor(hh: number): "periodMorning" | "periodAfternoon" | "periodEvening" | "periodNight" {
  if (hh >= 4 && hh < 12) return "periodMorning";
  if (hh >= 12 && hh < 16) return "periodAfternoon";
  if (hh >= 16 && hh < 20) return "periodEvening";
  return "periodNight";
}

export function formatWallTime(p: WallParts, m: Messages): string {
  const h12 = p.hh % 12 === 0 ? 12 : p.hh % 12;
  return fill(m.time.pattern, {
    h: String(h12),
    mm: String(p.mm).padStart(2, "0"),
    ampm: p.hh < 12 ? m.time.am : m.time.pm,
    period: m.time[periodFor(p.hh)],
  });
}

export function formatTime(ms: number, m: Messages, timeZone: string = PATIENT_TZ): string {
  return formatWallTime(timeZone === PATIENT_TZ ? istParts(ms) : zonedParts(ms, timeZone), m);
}

function partsOfDate(value: number | string, timeZone: string): WallParts {
  if (typeof value === "string") {
    const [y, mo, d] = value.split("-").map(Number);
    return { y, m: mo, d, hh: 0, mm: 0, dow: new Date(Date.UTC(y, mo - 1, d)).getUTCDay() };
  }
  return timeZone === PATIENT_TZ ? istParts(value) : zonedParts(value, timeZone);
}

/** 5 Oct 2026. Accepts a timestamp or a YYYY-MM-DD date. */
export function formatDate(value: number | string, m: Messages, timeZone: string = PATIENT_TZ): string {
  const p = partsOfDate(value, timeZone);
  return fill(m.time.datePattern, { d: String(p.d), mon: m.time.months[p.m - 1], y: String(p.y) });
}

export function formatDayMonth(value: number | string, m: Messages, timeZone: string = PATIENT_TZ): string {
  const p = partsOfDate(value, timeZone);
  return fill(m.time.dayMonthPattern, { d: String(p.d), mon: m.time.months[p.m - 1] });
}

export function formatWeekdayDate(value: number | string, m: Messages, timeZone: string = PATIENT_TZ): string {
  const p = partsOfDate(value, timeZone);
  return fill(m.time.weekdayDatePattern, { wd: m.time.weekdays[p.dow], d: String(p.d), mon: m.time.months[p.m - 1] });
}

export function formatWeekday(value: number | string, m: Messages, timeZone: string = PATIENT_TZ): string {
  return m.time.weekdays[partsOfDate(value, timeZone).dow];
}

export function formatNumber(n: number): string {
  return groupIndian(n);
}
