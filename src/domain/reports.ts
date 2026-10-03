/**
 * Daily report: built only from the clinical log, line by line, each line
 * citing the log entries it came from. Before sending, every claim is checked
 * again against the log; if anything does not match, the report is blocked.
 */
import { atLocal, localDate as localDateOf, type LocalDate } from "@/lib/time";
import type { DemoData } from "./data";
import { effectiveDoseIndex, statusFromEntry } from "./doses";
import { callTimeFor, plannedSlots } from "./schedule";
import type { Claim, LogEntry, Param, Patient, Report, ReportLine, Vitals } from "./types";

type Problem = Report["check"]["problems"][number];

const slotParam = (slot: string): Param => ({ $t: `slot.${slot}` });

function logUpTo(data: DemoData, at: number): LogEntry[] {
  return data.log.filter((e) => e.at <= at);
}

export function buildReportLines(data: DemoData, p: Patient, date: LocalDate, at: number, opts: { inject?: boolean } = {}): ReportLine[] {
  const log = logUpTo(data, at);
  const idx = effectiveDoseIndex(log);
  const byId = new Map(log.map((e) => [e.id, e]));
  const lines: Omit<ReportLine, "id">[] = [];
  let confirmed = 0;
  let total = 0;
  const confirmedSources: string[] = [];

  for (const slot of plannedSlots(p, date)) {
    const callAt = atLocal(date, callTimeFor(p, slot));
    const entry = idx.get(`${p.id}|${date}|${slot}`);
    const status = statusFromEntry(entry);
    if (callAt <= at) total += 1;
    if (entry && (status === "takenSelf" || status === "takenCaregiver")) {
      confirmed += 1;
      const original = entry.replaces ? byId.get(entry.replaces) : undefined;
      const takenAt = entry.kind === "doseTaken" ? entry.takenAt : original && original.kind === "doseTaken" ? original.takenAt : entry.at;
      const sources = original ? [entry.id, original.id] : [entry.id];
      confirmedSources.push(...sources);
      lines.push({
        kind: "dose",
        key: status === "takenCaregiver" ? "report.line.takenCaregiver" : "report.line.takenSelf",
        params: { slot: slotParam(slot), time: { $time: takenAt } },
        icon: "ok",
        sources,
        claims: [{ type: "doseStatus", date, slot, status }],
      });
    } else if (entry && status === "missed") {
      lines.push({
        kind: "dose",
        key: "report.line.missed",
        params: { slot: slotParam(slot) },
        icon: "missed",
        sources: [entry.id],
        claims: [{ type: "doseStatus", date, slot, status: "missed" }],
      });
    } else if (callAt <= at) {
      lines.push({
        kind: "dose",
        key: "report.line.notConfirmed",
        params: { slot: slotParam(slot) },
        icon: "pending",
        sources: [],
        claims: [{ type: "doseNotLogged", date, slot }],
      });
    } else {
      lines.push({
        kind: "dose",
        key: "report.line.upcoming",
        params: { slot: slotParam(slot), time: { $time: callAt } },
        icon: "pending",
        sources: [],
        claims: [{ type: "doseNotLogged", date, slot }],
      });
    }
  }

  const said = opts.inject ? confirmed + 1 : confirmed;
  lines.unshift({
    kind: "summary",
    key: "report.line.summary",
    params: { confirmed: said, total },
    icon: "info",
    sources: confirmedSources,
    claims: [{ type: "doseCount", date, confirmed: said, total }],
  });

  // Visit, vitals and pill count recorded that day.
  const visit = data.visits.find((v) => v.patientId === p.id && v.date === date && v.status === "completed" && (v.checkOutAt ?? 0) <= at);
  if (visit) {
    const visitEntries = log.filter((e) => "visitId" in e && e.visitId === visit.id && e.kind !== "doseConfirmed");
    lines.push({
      kind: "visit",
      key: "report.line.visit",
      params: { person: { $person: visit.caregiverId ?? "" }, time: { $time: visit.checkInAt ?? 0 } },
      icon: "visit",
      sources: visitEntries.map((e) => e.id),
      claims: visitEntries.map((e) => ({ type: "entryExists", entryId: e.id }) as Claim),
    });
    const vitalsEntry = visitEntries.find((e): e is Extract<LogEntry, { kind: "vitals" }> => e.kind === "vitals");
    if (vitalsEntry) {
      const v = vitalsEntry.vitals;
      const add = (key: string, params: Record<string, Param>, fields: Array<keyof Vitals>) =>
        lines.push({
          kind: "vitals",
          key,
          params,
          icon: "info",
          sources: [vitalsEntry.id],
          claims: fields.map((f) => ({ type: "vitalsValue", entryId: vitalsEntry.id, field: f, value: v[f] as number })),
        });
      if (v.bpSys != null && v.bpDia != null) add("report.line.bp", { sys: v.bpSys, dia: v.bpDia }, ["bpSys", "bpDia"]);
      if (v.pulse != null) add("report.line.pulse", { value: v.pulse }, ["pulse"]);
      if (v.spo2 != null) add("report.line.spo2", { value: v.spo2 }, ["spo2"]);
      if (v.tempC != null) add("report.line.temp", { value: v.tempC }, ["tempC"]);
      if (v.sugar != null) add("report.line.sugar", { value: v.sugar }, ["sugar"]);
    }
    const pc = visitEntries.find((e): e is Extract<LogEntry, { kind: "pillCount" }> => e.kind === "pillCount");
    if (pc) {
      lines.push({
        kind: "pillCount",
        key: pc.matched ? "report.line.pillMatched" : "report.line.pillMismatch",
        params: {},
        icon: pc.matched ? "ok" : "alert",
        sources: [pc.id],
        claims: [{ type: "entryExists", entryId: pc.id }],
      });
    }
  }

  // Nurse conversations recorded that day.
  for (const e of log) {
    if (e.kind !== "nurseNote" || e.patientId !== p.id || !e.spokeToPatient) continue;
    if (localDateOf(e.at) !== date) continue;
    lines.push({
      kind: "nurse",
      key: "report.line.nurseSpoke",
      params: { person: { $person: e.by ?? "" }, time: { $time: e.at } },
      icon: "info",
      sources: [e.id],
      claims: [{ type: "entryExists", entryId: e.id }],
    });
  }

  return lines.map((l, i) => ({ ...l, id: `L${i + 1}` }));
}

export function checkReport(data: DemoData, p: Patient, date: LocalDate, lines: ReportLine[], at: number): Report["check"] {
  const log = logUpTo(data, at);
  const byId = new Map(log.map((e) => [e.id, e]));
  const idx = effectiveDoseIndex(log);
  const problems: Problem[] = [];

  for (const line of lines) {
    for (const s of line.sources) {
      if (!byId.has(s)) problems.push({ key: "report.problem.missingSource", params: { line: line.id } });
    }
    for (const c of line.claims) {
      if (c.type === "doseStatus") {
        const actual = statusFromEntry(idx.get(`${p.id}|${c.date}|${c.slot}`));
        if (actual !== c.status) problems.push({ key: "report.problem.doseMismatch", params: { slot: slotParam(c.slot) } });
      } else if (c.type === "doseNotLogged") {
        if (idx.get(`${p.id}|${c.date}|${c.slot}`)) problems.push({ key: "report.problem.doseMismatch", params: { slot: slotParam(c.slot) } });
      } else if (c.type === "doseCount") {
        let n = 0;
        for (const slot of plannedSlots(p, c.date)) {
          const st = statusFromEntry(idx.get(`${p.id}|${c.date}|${slot}`));
          if (st === "takenSelf" || st === "takenCaregiver") n += 1;
        }
        if (n !== c.confirmed) problems.push({ key: "report.problem.countMismatch", params: { said: c.confirmed, log: n } });
      } else if (c.type === "vitalsValue") {
        const e = byId.get(c.entryId);
        if (!e || e.kind !== "vitals" || e.vitals[c.field] !== c.value) problems.push({ key: "report.problem.vitalsMismatch", params: {} });
      } else if (c.type === "entryExists") {
        if (!byId.has(c.entryId)) problems.push({ key: "report.problem.missingSource", params: { line: line.id } });
      }
    }
  }
  return { passed: problems.length === 0, problems };
}
