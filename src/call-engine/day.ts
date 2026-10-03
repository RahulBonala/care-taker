import type { DoseStatus, Slot } from "@/domain/types";
import { endOfLocalDay, type LocalDate } from "@/lib/time";

/** End of day (section 5, step 10): any dose still due or postponed becomes missed. */
export function slotsToMarkMissed(statuses: Array<{ slot: Slot; status: DoseStatus }>): Slot[] {
  return statuses.filter((s) => s.status === "due" || s.status === "postponed").map((s) => s.slot);
}

/** A call scheduled after the day has closed is not placed. */
export function isAfterDayEnd(callAt: number, date: LocalDate): boolean {
  return callAt > endOfLocalDay(date);
}
