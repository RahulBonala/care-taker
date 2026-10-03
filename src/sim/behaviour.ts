/**
 * How sample patients answer calls that the clock jumps past. Deterministic:
 * the same patient, day and dose always behave the same way, so a demo can be
 * repeated exactly after "Reset demo".
 */
import type { DemoData } from "@/domain/data";
import type { CallInput, Patient, QueuedCall } from "@/domain/types";
import { chance } from "@/lib/hash";

const ANSWER: CallInput = { type: "answer" };
const voice = (intent: Extract<CallInput, { type: "reply" }>["intent"], minutes?: number): CallInput =>
  minutes != null ? { type: "reply", intent, via: "voice", minutes } : { type: "reply", intent, via: "voice" };
const key = (k: "1" | "2" | "3"): CallInput => ({ type: "reply", intent: "unclear", via: "key", key: k });

export function takenScript(p: Patient, k: string): CallInput[] {
  if (p.phoneType === "keypad" && chance(`key|${k}`) < 0.5) return [ANSWER, key("1"), key("1")];
  return [ANSWER, voice("taken"), voice("yes")];
}

export const SCRIPTS = {
  taken: (p: Patient, k = "x") => takenScript(p, k),
  noAnswer: (): CallInput[] => [{ type: "noAnswer" }],
  later: (minutes = 30): CallInput[] => [ANSWER, voice("later", minutes)],
  notEaten: (minutes = 30): CallInput[] => [ANSWER, voice("notEaten", minutes)],
  unwell: (): CallInput[] => [ANSWER, voice("unwell")],
  wantPerson: (): CallInput[] => [ANSWER, voice("wantPerson")],
  refuse: (): CallInput[] => [ANSWER, voice("refuse")],
  someoneElse: (minutes = 30): CallInput[] => [ANSWER, voice("someoneElse"), voice("later", minutes)],
  someoneElseAgain: (): CallInput[] => [ANSWER, voice("someoneElse")],
  unclearThenKeypad: (): CallInput[] => [ANSWER, voice("unclear"), voice("unclear"), key("1"), key("1")],
  unclearAll: (): CallInput[] => [ANSWER, voice("unclear"), voice("unclear"), voice("unclear")],
};

export function callSeq(data: DemoData, q: QueuedCall): number {
  return data.calls.filter((c) => c.patientId === q.patientId && c.date === q.date && c.slot === q.slot).length + 1;
}

export function backgroundScript(data: DemoData, p: Patient, q: QueuedCall): CallInput[] {
  const seq = callSeq(data, q);
  const k = `${p.id}|${q.date}|${q.slot}|${seq}`;
  if (q.reason !== "scheduled") return takenScript(p, k);
  const c = chance(k);
  if (c < 0.04) return SCRIPTS.noAnswer();
  if (c < 0.1) return SCRIPTS.later(30);
  if (p.sharesPhoneWith && c < 0.16) return SCRIPTS.someoneElse(30);
  if (p.phoneType === "keypad" && p.language !== "en" && c < 0.22) return SCRIPTS.unclearThenKeypad();
  return takenScript(p, k);
}
