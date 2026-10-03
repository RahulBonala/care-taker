/**
 * Simulated time. The clock is a plain millisecond timestamp. Patient-side
 * wall time is India Standard Time, which has a fixed offset and no daylight
 * saving, so it is computed directly and behaves the same in every browser.
 */
export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;
export const IST_OFFSET = 330 * MIN;
export const PATIENT_TZ = "Asia/Kolkata";

/** A calendar date in the patient's time zone, written YYYY-MM-DD. */
export type LocalDate = string;
/** A wall-clock time, written HH:MM in 24-hour form. */
export type HHMM = string;

export interface WallParts {
  y: number;
  m: number; // 1-12
  d: number;
  hh: number;
  mm: number;
  dow: number; // 0 = Sunday
}

export function istParts(ms: number): WallParts {
  const t = new Date(ms + IST_OFFSET);
  return {
    y: t.getUTCFullYear(),
    m: t.getUTCMonth() + 1,
    d: t.getUTCDate(),
    hh: t.getUTCHours(),
    mm: t.getUTCMinutes(),
    dow: t.getUTCDay(),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function localDate(ms: number): LocalDate {
  const p = istParts(ms);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

export function localTime(ms: number): HHMM {
  const p = istParts(ms);
  return `${pad(p.hh)}:${pad(p.mm)}`;
}

export function hhmmToMinutes(hhmm: HHMM): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToHhmm(total: number): HHMM {
  const t = ((total % 1440) + 1440) % 1440;
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
}

export function addMinutesToHhmm(hhmm: HHMM, minutes: number): HHMM {
  return minutesToHhmm(hhmmToMinutes(hhmm) + minutes);
}

/** Milliseconds for a wall-clock time on a patient-side date. */
export function atLocal(date: LocalDate, hhmm: HHMM): number {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  return Date.UTC(y, m - 1, d, hh, mm) - IST_OFFSET;
}

export function startOfLocalDay(date: LocalDate): number {
  return atLocal(date, "00:00");
}

/** The moment the day is closed: 11:59 pm. */
export function endOfLocalDay(date: LocalDate): number {
  return atLocal(date, "23:59");
}

export function addDays(date: LocalDate, n: number): LocalDate {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Whole days from a to b (b - a). */
export function dayDiff(a: LocalDate, b: LocalDate): number {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY);
}

export function dateRange(from: LocalDate, to: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function weekdayOf(date: LocalDate): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Wall-clock parts in any IANA time zone (used for family members abroad). */
export function zonedParts(ms: number, timeZone: string): WallParts {
  if (timeZone === PATIENT_TZ) return istParts(ms);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    y: Number(get("year")),
    m: Number(get("month")),
    d: Number(get("day")),
    hh: Number(get("hour")) % 24,
    mm: Number(get("minute")),
    dow: days.indexOf(get("weekday")),
  };
}

export function zonedDate(ms: number, timeZone: string): LocalDate {
  const p = zonedParts(ms, timeZone);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}
