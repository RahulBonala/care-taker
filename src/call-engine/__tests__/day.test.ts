import { describe, expect, it } from "vitest";
import { isAfterDayEnd, slotsToMarkMissed } from "../day";
import { atLocal } from "@/lib/time";

describe("10. end of day", () => {
  it("marks due and postponed doses as missed, leaves the rest", () => {
    expect(
      slotsToMarkMissed([
        { slot: "breakfast", status: "takenSelf" },
        { slot: "lunch", status: "postponed" },
        { slot: "dinner", status: "due" },
        { slot: "bedtime", status: "takenCaregiver" },
      ]),
    ).toEqual(["lunch", "dinner"]);
  });
  it("does not place calls after 11:59 pm", () => {
    expect(isAfterDayEnd(atLocal("2026-10-05", "23:50"), "2026-10-05")).toBe(false);
    expect(isAfterDayEnd(atLocal("2026-10-06", "00:10"), "2026-10-05")).toBe(true);
  });
});
