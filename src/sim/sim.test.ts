import { describe, expect, it } from "vitest";
import { DoseBook } from "@/domain/doses";
import { buildSeed, EXPLORE_START, LAKSHMI_ID, STORY_START } from "./seed";
import { advanceClock } from "./advance";
import { checkReport } from "@/domain/reports";
import { atLocal, localDate } from "@/lib/time";

describe("sample data", () => {
  const { data, now } = buildSeed();

  it("starts on day 3 for Mrs Lakshmi Devi with a lunch call still to come", () => {
    expect(now).toBe(EXPLORE_START);
    const p = data.patients.find((x) => x.id === LAKSHMI_ID)!;
    const book = new DoseBook(data);
    const today = book.day(p, localDate(now), now);
    expect(today.map((d) => d.slot)).toEqual(["breakfast", "lunch", "dinner"]);
    expect(today[0].status).toBe("takenSelf");
    expect(today[1].status).toBe("due");
    expect(data.queue.some((q) => q.patientId === LAKSHMI_ID && q.slot === "lunch")).toBe(true);
  });

  it("has history in every list a screen shows", () => {
    expect(data.reports.length).toBeGreaterThan(20);
    expect(data.reports.some((r) => r.status === "blocked")).toBe(true);
    expect(data.visits.filter((v) => v.status === "completed").length).toBeGreaterThan(10);
    expect(data.visits.some((v) => v.status === "missed")).toBe(true);
    expect(data.flags.filter((f) => f.status === "closed").length).toBeGreaterThan(5);
    expect(data.audit.length).toBeGreaterThan(20);
    expect(data.payments.some((p) => p.status === "refunded")).toBe(true);
  });

  it("has a few open flags for the nurse on first load", () => {
    const open = data.flags.filter((f) => f.status !== "closed").map((f) => f.type).sort();
    expect(open).toEqual(["personRequested", "pillMismatch", "unclear"]);
  });

  it("every sent report passes its check against the log", () => {
    for (const r of data.reports.filter((x) => x.status === "sent")) {
      const p = data.patients.find((x) => x.id === r.patientId)!;
      expect(checkReport(data, p, r.date, r.lines, r.generatedAt).passed).toBe(true);
    }
  });

  it("story baseline has no Lakshmi yet", () => {
    const story = buildSeed({ withoutLakshmi: true, until: STORY_START });
    expect(story.data.patients.some((p) => p.id === LAKSHMI_ID)).toBe(false);
    expect(story.now).toBe(STORY_START);
  });

  it("jumping to day 14 runs without errors and offers renewal", () => {
    const copy = structuredClone(data);
    const to = atLocal("2026-10-16", "07:00");
    advanceClock(copy, now, to, { focusPatientId: LAKSHMI_ID, ringAtTarget: true, quietBackground: true });
    const p = copy.patients.find((x) => x.id === LAKSHMI_ID)!;
    expect(p.pkg.renewalOfferedAt).toBeDefined();
    expect(copy.messages.some((m) => m.kind === "renewal" && m.patientId === LAKSHMI_ID)).toBe(true);
  });

  it("the clock rings the on-screen patient's phone exactly at the next call", () => {
    const copy = structuredClone(data);
    const q = copy.queue.filter((x) => x.patientId === LAKSHMI_ID).sort((a, b) => a.at - b.at)[0];
    const r = advanceClock(copy, now, q.at, { focusPatientId: LAKSHMI_ID, ringAtTarget: true, quietBackground: false });
    expect(r.rangCallId).toBeDefined();
    expect(copy.phone.ringingCallId).toBe(r.rangCallId);
  });
});
