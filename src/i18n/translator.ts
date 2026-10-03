import type { DemoData } from "@/domain/data";
import type { LocalText, Param, Patient } from "@/domain/types";
import { PATIENT_TZ } from "@/lib/time";
import { formatDate, formatDayMonth, formatMoney, formatNumber, formatTime, formatWeekday, formatWeekdayDate } from "./format";
import { brandName, interpolate, type LangCode, lookup, messagesFor, templateFor } from "./index";
import type { MessageKey, Messages } from "./types";

export function pickText(text: LocalText | undefined, lang: LangCode): string {
  if (!text) return "";
  return (text as unknown as Record<string, string | undefined>)[lang] ?? text.en;
}

export function personName(data: DemoData | null, id: string, lang: LangCode, m: Messages, opts: { honorific?: boolean } = {}): string {
  if (!data || !id) return "";
  const withH = opts.honorific ?? true;
  const p = data.patients.find((x) => x.id === id);
  if (p) {
    const h = m.honorific[p.honorific];
    const n = pickText(p.name, lang);
    return withH && h ? `${h} ${n}` : n;
  }
  const s = data.staff.find((x) => x.id === id);
  if (s) {
    const n = pickText(s.name, lang);
    return s.role === "doctor" ? `${m.honorific.dr} ${n}` : n;
  }
  const f = data.family.find((x) => x.id === id);
  if (f) return pickText(f.name, lang);
  if (id === "system") return m.source.system;
  return "";
}

export interface Translator {
  lang: LangCode;
  m: Messages;
  t: (key: MessageKey, params?: Record<string, Param>) => string;
  /** For keys that come from data (events, report lines). */
  tx: (key: string, params?: Record<string, Param>) => string;
  list: (key: MessageKey) => string[];
  param: (p: Param) => string;
  time: (ms: number, timeZone?: string) => string;
  date: (v: number | string, timeZone?: string) => string;
  dayMonth: (v: number | string, timeZone?: string) => string;
  weekdayDate: (v: number | string, timeZone?: string) => string;
  weekday: (v: number | string, timeZone?: string) => string;
  money: (n: number) => string;
  num: (n: number) => string;
  text: (t: LocalText | undefined) => string;
  person: (id: string | undefined, opts?: { honorific?: boolean }) => string;
  patient: (p: Patient | undefined, opts?: { honorific?: boolean }) => string;
  app: string;
}

export function makeTranslator(lang: LangCode, data: DemoData | null): Translator {
  const m = messagesFor(lang);
  const app = brandName(lang);

  const param = (p: Param): string => {
    if (typeof p === "string") return p;
    if (typeof p === "number") return formatNumber(p);
    if ("$text" in p) return pickText(p.$text, lang);
    if ("$t" in p) return tx(p.$t, p.params);
    if ("$time" in p) return formatTime(p.$time, m);
    if ("$date" in p) return formatDate(p.$date, m);
    if ("$money" in p) return formatMoney(p.$money);
    if ("$person" in p) return personName(data, p.$person, lang, m);
    return "";
  };

  function tx(key: string, params?: Record<string, Param>): string {
    const count = typeof params?.count === "number" ? params.count : undefined;
    const tpl = templateFor(m, key, count);
    if (tpl == null) return key;
    const values: Record<string, string> = { app };
    if (params) for (const [k, v] of Object.entries(params)) values[k] = param(v);
    return interpolate(tpl, values);
  }

  return {
    lang,
    m,
    t: (key, params) => tx(key, params),
    tx,
    list: (key) => {
      const v = lookup(m, key);
      return Array.isArray(v) ? v : [];
    },
    param,
    time: (ms, tz = PATIENT_TZ) => formatTime(ms, m, tz),
    date: (v, tz = PATIENT_TZ) => formatDate(v, m, tz),
    dayMonth: (v, tz = PATIENT_TZ) => formatDayMonth(v, m, tz),
    weekdayDate: (v, tz = PATIENT_TZ) => formatWeekdayDate(v, m, tz),
    weekday: (v, tz = PATIENT_TZ) => formatWeekday(v, m, tz),
    money: formatMoney,
    num: formatNumber,
    text: (t) => pickText(t, lang),
    person: (id, opts) => personName(data, id ?? "", lang, m, opts),
    patient: (p, opts) => (p ? personName(data, p.id, lang, m, opts) : ""),
    app,
  };
}
