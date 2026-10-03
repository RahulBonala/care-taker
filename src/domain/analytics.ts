import type { DemoData } from "@/domain/data";
import { DoseBook } from "@/domain/doses";
import { noCallsReason } from "@/domain/schedule";
import { addDays, localDate, type LocalDate } from "@/lib/time";

export function dayStats(data: DemoData, date: LocalDate, now: number) {
  const calls = data.calls.filter((c) => c.date === date && c.status === "ended");
  const answered = calls.filter((c) => c.inputs[0]?.type === "answer").length;
  const book = new DoseBook(data);
  let confirmed = 0;
  let open = 0;
  for (const p of data.patients) {
    for (const v of book.day(p, date, now)) {
      if (v.status === "takenSelf" || v.status === "takenCaregiver") confirmed += 1;
      else if (v.status === "due" || v.status === "postponed") open += 1;
    }
  }
  const reports = data.reports.filter((r) => r.date === date);
  return {
    placed: calls.length,
    answered,
    confirmed,
    open,
    flags: data.flags.filter((f) => localDate(f.openedAt) === date).length,
    sent: reports.filter((r) => r.status === "sent").length,
    blocked: reports.filter((r) => r.status === "blocked").length,
  };
}

export function overview(data: DemoData, now: number) {
  const today = localDate(now);
  const active = data.patients.filter((p) => p.pkg.status === "active");
  return {
    active: active.length,
    noCalls: active.filter((p) => noCallsReason(p, now) && noCallsReason(p, now) !== "notStarted").length,
    today: dayStats(data, today, now),
    week: Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((d) => ({ date: d, ...dayStats(data, d, now) })),
    openFlags: data.flags.filter((f) => f.status !== "closed"),
    reportsSent: data.reports.filter((r) => r.status === "sent").length,
    reportsBlocked: data.reports.filter((r) => r.status === "blocked").length,
  };
}

export function accuracy(data: DemoData) {
  const byIntent: Record<string, number> = {};
  let replies = 0;
  let unclear = 0;
  let corrections = 0;
  let keypad = 0;
  const byLang: Record<string, { calls: number; answered: number; replies: number; unclear: number }> = {};
  const byPhone: Record<string, { calls: number; answered: number; replies: number; unclear: number }> = {};
  for (const c of data.calls) {
    if (c.status !== "ended") continue;
    const L = (byLang[c.lang] ??= { calls: 0, answered: 0, replies: 0, unclear: 0 });
    const P = (byPhone[c.phoneType] ??= { calls: 0, answered: 0, replies: 0, unclear: 0 });
    L.calls += 1;
    P.calls += 1;
    if (c.inputs[0]?.type === "answer") {
      L.answered += 1;
      P.answered += 1;
    }
    let unclearInCall = 0;
    let afterTaken = false;
    for (const i of c.inputs) {
      if (i.type !== "reply") continue;
      replies += 1;
      L.replies += 1;
      P.replies += 1;
      const intent = i.via === "key" ? `key${i.key}` : i.intent;
      byIntent[intent] = (byIntent[intent] ?? 0) + 1;
      if (i.via !== "key" && i.intent === "unclear") {
        unclear += 1;
        unclearInCall += 1;
        L.unclear += 1;
        P.unclear += 1;
      }
      if (afterTaken && i.via !== "key" && i.intent === "no") corrections += 1;
      afterTaken = i.intent === "taken" || (i.via === "key" && i.key === "1");
    }
    if (unclearInCall >= 2) keypad += 1;
  }
  return { byIntent, replies, unclear, corrections, keypad, byLang, byPhone };
}
