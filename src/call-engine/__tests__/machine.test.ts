import { describe, expect, it } from "vitest";
import type { CallContext, CallInput, ReplyIntent } from "@/domain/types";
import { clampPostpone, replay, startCall, step } from "../machine";

const T0 = Date.UTC(2026, 9, 5, 8, 10); // 1:40 pm IST
const ctx = (over: Partial<CallContext> = {}): CallContext => ({
  slot: "lunch",
  attempt: 1,
  postponesSoFar: 0,
  otherPersonSoFar: 0,
  startedAt: T0,
  ...over,
});
const say = (intent: ReplyIntent, minutes?: number): CallInput => ({ type: "reply", intent, via: "voice", minutes });
const key = (k: "1" | "2" | "3"): CallInput => ({ type: "reply", intent: "unclear", via: "key", key: k });
const ANSWER: CallInput = { type: "answer" };
const systemKeys = (r: ReturnType<typeof replay>) =>
  r.lines.filter((l) => l.speaker === "system").map((l) => (l.speaker === "system" ? l.key : ""));

describe("1. dial and no answer", () => {
  it("first and second unanswered attempts retry after 10 minutes", () => {
    for (const attempt of [1, 2]) {
      const r = replay([{ type: "noAnswer" }], ctx({ attempt }));
      expect(r.state.outcome).toBe("noAnswerRetry");
      expect(r.effects).toEqual([{ type: "scheduleCall", afterMinutes: 10, reason: "noAnswer" }]);
    }
  });
  it("third unanswered attempt notifies family and opens a no-answer flag", () => {
    const r = replay([{ type: "noAnswer" }], ctx({ attempt: 3 }));
    expect(r.state.outcome).toBe("noAnswerFlagged");
    expect(r.effects).toEqual([
      { type: "notifyFamily", reason: "noAnswer" },
      { type: "openFlag", flag: "noAnswer", urgency: "normal" },
    ]);
  });
  it("hanging up mid-call counts as an unanswered attempt and logs nothing", () => {
    const r = replay([ANSWER, say("taken"), { type: "hangUp" }], ctx());
    expect(r.state.outcome).toBe("noAnswerRetry");
    expect(r.effects.some((e) => e.type === "logDose")).toBe(false);
  });
});

describe("2-3. greeting and question", () => {
  it("answering plays the greeting then asks about the slot", () => {
    const r = replay([ANSWER], ctx());
    expect(systemKeys(r)).toEqual(["greeting", "ask"]);
    expect(r.state.phase).toBe("awaitingReply");
    expect(r.effects).toEqual([]);
  });
});

describe("4. taken, read back, confirm", () => {
  it("taken is read back and logged only after yes", () => {
    const afterTaken = replay([ANSWER, say("taken")], ctx());
    expect(afterTaken.state.phase).toBe("confirmTaken");
    expect(afterTaken.effects).toEqual([]);
    const readBack = afterTaken.lines.find((l) => l.speaker === "system" && l.key === "readBack");
    expect(readBack && readBack.speaker === "system" && readBack.params).toEqual({ slot: "lunch", time: T0 });

    const r = replay([ANSWER, say("taken"), say("yes")], ctx());
    expect(r.state.outcome).toBe("takenLogged");
    expect(r.effects).toEqual([{ type: "logDose", confirmation: "voiceYes", takenAt: T0 }]);
  });
  it("key 1 at read-back confirms with the keypad", () => {
    const r = replay([ANSWER, key("1"), key("1")], ctx());
    expect(r.effects).toEqual([{ type: "logDose", confirmation: "keyOne", takenAt: T0 }]);
  });
  it("no at read-back asks once more; taken + yes then logs", () => {
    const r = replay([ANSWER, say("taken"), say("no"), say("taken"), say("yes")], ctx());
    expect(systemKeys(r)).toEqual(["greeting", "ask", "readBack", "askAgain", "ask", "readBack", "logged"]);
    expect(r.state.readBackNo).toBe(1);
    expect(r.effects.filter((e) => e.type === "logDose")).toHaveLength(1);
  });
  it("a second no is treated as unclear, and unclear again leads to the keypad menu", () => {
    const r1 = replay([ANSWER, say("taken"), say("no"), say("taken"), say("no")], ctx());
    expect(r1.state.unclearCount).toBe(1);
    expect(r1.state.phase).toBe("awaitingReply");
    expect(r1.effects).toEqual([]);
    const r2 = replay([ANSWER, say("taken"), say("no"), say("taken"), say("no"), say("unclear")], ctx());
    expect(r2.state.phase).toBe("keypadMenu");
  });
  it("unclear at read-back repeats the read-back", () => {
    const r = replay([ANSWER, say("taken"), say("unclear")], ctx());
    expect(systemKeys(r).slice(-2)).toEqual(["notUnderstood", "readBack"]);
    expect(r.state.phase).toBe("confirmTaken");
  });
  it("nothing is ever logged without a confirmation", () => {
    const r = replay([ANSWER, say("taken")], ctx());
    expect(r.effects.some((e) => e.type === "logDose")).toBe(false);
  });
});

describe("5. not yet eaten / later", () => {
  it("later defaults to 30 minutes and reschedules", () => {
    const r = replay([ANSWER, say("later")], ctx());
    expect(r.state.outcome).toBe("postponed");
    expect(r.effects).toEqual([{ type: "scheduleCall", afterMinutes: 30, reason: "postponed" }]);
  });
  it("not yet eaten reschedules the same way", () => {
    const r = replay([ANSWER, say("notEaten", 60)], ctx());
    expect(r.effects).toEqual([{ type: "scheduleCall", afterMinutes: 60, reason: "postponed" }]);
  });
  it("the stated time is limited to 10-90 minutes", () => {
    expect(clampPostpone(5)).toBe(10);
    expect(clampPostpone(120)).toBe(90);
    expect(clampPostpone(undefined)).toBe(30);
    expect(replay([ANSWER, say("later", 200)], ctx()).effects[0]).toMatchObject({ afterMinutes: 90 });
  });
  it("the call-again line carries the new time", () => {
    const r = replay([ANSWER, say("later", 10)], ctx());
    const line = r.lines.find((l) => l.speaker === "system" && l.key === "willCallAgain");
    expect(line && line.speaker === "system" && line.params?.time).toBe(T0 + 10 * 60_000);
  });
  it("the third postponement for one slot opens a flag and stops calling", () => {
    const r = replay([ANSWER, say("later", 30)], ctx({ postponesSoFar: 2 }));
    expect(r.state.outcome).toBe("postponeLimit");
    expect(r.effects).toEqual([{ type: "openFlag", flag: "postponed3", urgency: "normal" }]);
  });
  it("a bare no to the question means not yet", () => {
    const r = replay([ANSWER, say("no")], ctx());
    expect(r.state.outcome).toBe("postponed");
  });
});

describe("6. unwell or wants a person", () => {
  it("unwell: only the nurse line, urgent flag, end", () => {
    const r = replay([ANSWER, say("unwell")], ctx());
    expect(systemKeys(r)).toEqual(["greeting", "ask", "nurseWillCall"]);
    expect(r.effects).toEqual([{ type: "openFlag", flag: "unwell", urgency: "urgent" }]);
    expect(r.state.phase).toBe("ended");
  });
  it("wants a person: same line, urgent flag", () => {
    const r = replay([ANSWER, say("wantPerson")], ctx());
    expect(systemKeys(r).at(-1)).toBe("nurseWillCall");
    expect(r.effects).toEqual([{ type: "openFlag", flag: "personRequested", urgency: "urgent" }]);
  });
  it("key 3 asks for a nurse", () => {
    const r = replay([ANSWER, key("3")], ctx());
    expect(r.state.outcome).toBe("nurseRequested");
  });
});

describe("7. refuse", () => {
  it("records a note, opens a normal flag, ends", () => {
    const r = replay([ANSWER, say("refuse")], ctx());
    expect(r.state.outcome).toBe("refused");
    expect(r.effects).toEqual([
      { type: "note", note: "refused" },
      { type: "openFlag", flag: "refused", urgency: "normal" },
    ]);
  });
});

describe("8. someone else answered", () => {
  it("asks when to call back and reschedules once", () => {
    const r = replay([ANSWER, say("someoneElse"), say("later", 60)], ctx());
    expect(systemKeys(r)).toEqual(["greeting", "ask", "askCallbackTime", "willCallBackPerson"]);
    expect(r.effects).toEqual([{ type: "scheduleCall", afterMinutes: 60, reason: "someoneElse" }]);
  });
  it("an unclear callback time uses 30 minutes", () => {
    const r = replay([ANSWER, say("someoneElse"), say("unclear")], ctx());
    expect(r.effects).toEqual([{ type: "scheduleCall", afterMinutes: 30, reason: "someoneElse" }]);
  });
  it("the second time someone else answers, a flag opens instead", () => {
    const r = replay([ANSWER, say("someoneElse")], ctx({ otherPersonSoFar: 1 }));
    expect(r.state.outcome).toBe("otherPersonFlagged");
    expect(r.effects).toEqual([{ type: "openFlag", flag: "wrongPerson", urgency: "normal" }]);
  });
});

describe("9. unclear, keypad fallback", () => {
  it("first unclear asks again", () => {
    const r = replay([ANSWER, say("unclear")], ctx());
    expect(systemKeys(r).slice(-2)).toEqual(["notUnderstood", "ask"]);
  });
  it("second unclear plays the keypad menu", () => {
    const r = replay([ANSWER, say("unclear"), say("unclear")], ctx());
    expect(systemKeys(r).at(-1)).toBe("keypadMenu");
    expect(r.state.phase).toBe("keypadMenu");
  });
  it("menu 1 goes to read-back, then logs on confirmation", () => {
    const r = replay([ANSWER, say("unclear"), say("unclear"), key("1"), key("1")], ctx());
    expect(r.effects).toEqual([{ type: "logDose", confirmation: "keyOne", takenAt: T0 }]);
  });
  it("menu 2 reschedules", () => {
    const r = replay([ANSWER, say("unclear"), say("unclear"), key("2")], ctx());
    expect(r.effects).toEqual([{ type: "scheduleCall", afterMinutes: 30, reason: "postponed" }]);
  });
  it("menu 3 asks for a nurse", () => {
    const r = replay([ANSWER, say("unclear"), say("unclear"), key("3")], ctx());
    expect(r.effects).toEqual([{ type: "openFlag", flag: "personRequested", urgency: "urgent" }]);
  });
  it("still unclear after the menu opens a flag", () => {
    const r = replay([ANSWER, say("unclear"), say("unclear"), say("unclear")], ctx());
    expect(r.state.outcome).toBe("unclearFlagged");
    expect(r.effects).toEqual([{ type: "openFlag", flag: "unclear", urgency: "normal" }]);
  });
});

describe("state hygiene", () => {
  it("ignores input after the call ended", () => {
    const ended = replay([ANSWER, say("unwell")], ctx());
    const r = step(ended.state, say("taken"), ctx());
    expect(r.effects).toEqual([]);
    expect(r.lines).toEqual([]);
  });
  it("replies before answering do nothing", () => {
    const r = step(startCall(), say("taken"), ctx());
    expect(r.state.phase).toBe("ringing");
  });
});
