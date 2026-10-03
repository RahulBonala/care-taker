/**
 * The call state machine (prompt section 5). Pure functions only: given the
 * current state, one input and the call context, return the next state, the
 * lines the system speaks (as template keys, never free text) and the effects
 * the rest of the system must apply (log a dose, schedule a call, open a flag).
 */
import type { CallContext, CallInput, CallOutcome, FlagType, ReplyIntent, Slot } from "@/domain/types";

export const RETRY_MINUTES = 10;
export const MAX_ATTEMPTS = 3;
export const POSTPONE_MIN = 10;
export const POSTPONE_MAX = 90;
export const POSTPONE_DEFAULT = 30;
export const MAX_POSTPONES = 3;
export const UNCLEAR_LIMIT = 2;

export type CallPhase = "ringing" | "awaitingReply" | "confirmTaken" | "awaitingCallbackTime" | "keypadMenu" | "ended";

export interface CallState {
  phase: CallPhase;
  unclearCount: number;
  askedAgainAfterNo: boolean;
  readBackNo: number;
  outcome?: CallOutcome;
}

export type SystemLineKey =
  | "greeting"
  | "ask"
  | "readBack"
  | "logged"
  | "askAgain"
  | "notUnderstood"
  | "keypadMenu"
  | "willCallAgain"
  | "postponeLimit"
  | "nurseWillCall"
  | "refusedNoted"
  | "askCallbackTime"
  | "willCallBackPerson"
  | "otherPersonFlag"
  | "endUnclear";

export type EventLineKey = "answered" | "noAnswer" | "hungUp";

export interface LineParams {
  slot?: Slot;
  time?: number;
  minutes?: number;
}

export type Line =
  | { speaker: "system"; key: SystemLineKey; params?: LineParams }
  | { speaker: "patient"; input: Extract<CallInput, { type: "reply" }> }
  | { speaker: "event"; key: EventLineKey };

export type Effect =
  | { type: "logDose"; confirmation: "voiceYes" | "keyOne"; takenAt: number }
  | { type: "scheduleCall"; afterMinutes: number; reason: "noAnswer" | "postponed" | "someoneElse" }
  | { type: "openFlag"; flag: FlagType; urgency: "urgent" | "normal" }
  | { type: "notifyFamily"; reason: "noAnswer" }
  | { type: "note"; note: "refused" };

export interface StepResult {
  state: CallState;
  lines: Line[];
  effects: Effect[];
}

export function startCall(): CallState {
  return { phase: "ringing", unclearCount: 0, askedAgainAfterNo: false, readBackNo: 0 };
}

export function clampPostpone(minutes?: number): number {
  if (minutes == null || !Number.isFinite(minutes)) return POSTPONE_DEFAULT;
  return Math.min(POSTPONE_MAX, Math.max(POSTPONE_MIN, Math.round(minutes)));
}

/** Map key presses and yes/no to what they mean in the current phase. */
export function intentFor(phase: CallPhase, input: Extract<CallInput, { type: "reply" }>): ReplyIntent {
  if (input.via === "key" && input.key) {
    if (phase === "confirmTaken") return input.key === "1" ? "yes" : input.key === "2" ? "no" : "wantPerson";
    if (phase === "awaitingCallbackTime") return "later";
    return input.key === "1" ? "taken" : input.key === "2" ? "later" : "wantPerson";
  }
  const intent = input.intent;
  if (phase === "confirmTaken" && intent === "taken") return "yes";
  if (phase === "awaitingReply" || phase === "keypadMenu") {
    if (intent === "yes") return "taken";
    if (intent === "no") return "notEaten";
  }
  return intent;
}

const end = (state: CallState, outcome: CallOutcome): CallState => ({ ...state, phase: "ended", outcome });

function unanswered(state: CallState, ctx: CallContext, lines: Line[]): StepResult {
  if (ctx.attempt < MAX_ATTEMPTS) {
    return {
      state: end(state, "noAnswerRetry"),
      lines,
      effects: [{ type: "scheduleCall", afterMinutes: RETRY_MINUTES, reason: "noAnswer" }],
    };
  }
  return {
    state: end(state, "noAnswerFlagged"),
    lines,
    effects: [
      { type: "notifyFamily", reason: "noAnswer" },
      { type: "openFlag", flag: "noAnswer", urgency: "normal" },
    ],
  };
}

function postpone(state: CallState, ctx: CallContext, minutes: number | undefined, lines: Line[]): StepResult {
  const m = clampPostpone(minutes);
  if (ctx.postponesSoFar + 1 >= MAX_POSTPONES) {
    return {
      state: end(state, "postponeLimit"),
      lines: [...lines, { speaker: "system", key: "postponeLimit" }],
      effects: [{ type: "openFlag", flag: "postponed3", urgency: "normal" }],
    };
  }
  return {
    state: end(state, "postponed"),
    lines: [...lines, { speaker: "system", key: "willCallAgain", params: { time: ctx.startedAt + m * 60_000, minutes: m } }],
    effects: [{ type: "scheduleCall", afterMinutes: m, reason: "postponed" }],
  };
}

function unclear(state: CallState, ctx: CallContext, lines: Line[], repeat: "ask" | "readBack"): StepResult {
  const count = state.unclearCount + 1;
  if (count >= UNCLEAR_LIMIT) {
    return {
      state: { ...state, unclearCount: count, phase: "keypadMenu" },
      lines: [...lines, { speaker: "system", key: "keypadMenu" }],
      effects: [],
    };
  }
  const again: Line =
    repeat === "readBack"
      ? { speaker: "system", key: "readBack", params: { slot: ctx.slot, time: ctx.startedAt } }
      : { speaker: "system", key: "ask", params: { slot: ctx.slot } };
  return {
    state: { ...state, unclearCount: count, phase: repeat === "readBack" ? "confirmTaken" : "awaitingReply" },
    lines: [...lines, { speaker: "system", key: "notUnderstood" }, again],
    effects: [],
  };
}

function nurse(state: CallState, lines: Line[], flag: "unwell" | "personRequested"): StepResult {
  return {
    state: end(state, flag === "unwell" ? "unwell" : "nurseRequested"),
    // Only this one line is spoken. No other words, no advice.
    lines: [...lines, { speaker: "system", key: "nurseWillCall" }],
    effects: [{ type: "openFlag", flag, urgency: "urgent" }],
  };
}

function reply(state: CallState, ctx: CallContext, intent: ReplyIntent, input: Extract<CallInput, { type: "reply" }>, lines: Line[]): StepResult {
  switch (intent) {
    case "taken":
      return {
        state: { ...state, phase: "confirmTaken" },
        lines: [...lines, { speaker: "system", key: "readBack", params: { slot: ctx.slot, time: ctx.startedAt } }],
        effects: [],
      };
    case "notEaten":
    case "later":
      return postpone(state, ctx, input.minutes, lines);
    case "unwell":
      return nurse(state, lines, "unwell");
    case "wantPerson":
      return nurse(state, lines, "personRequested");
    case "refuse":
      return {
        state: end(state, "refused"),
        lines: [...lines, { speaker: "system", key: "refusedNoted" }],
        effects: [
          { type: "note", note: "refused" },
          { type: "openFlag", flag: "refused", urgency: "normal" },
        ],
      };
    case "someoneElse":
      if (ctx.otherPersonSoFar >= 1) {
        return {
          state: end(state, "otherPersonFlagged"),
          lines: [...lines, { speaker: "system", key: "otherPersonFlag" }],
          effects: [{ type: "openFlag", flag: "wrongPerson", urgency: "normal" }],
        };
      }
      return {
        state: { ...state, phase: "awaitingCallbackTime" },
        lines: [...lines, { speaker: "system", key: "askCallbackTime" }],
        effects: [],
      };
    default:
      if (state.phase === "keypadMenu") {
        return {
          state: end(state, "unclearFlagged"),
          lines: [...lines, { speaker: "system", key: "endUnclear" }],
          effects: [{ type: "openFlag", flag: "unclear", urgency: "normal" }],
        };
      }
      return unclear(state, ctx, lines, "ask");
  }
}

export function step(state: CallState, input: CallInput, ctx: CallContext): StepResult {
  if (state.phase === "ended") return { state, lines: [], effects: [] };

  if (state.phase === "ringing") {
    if (input.type === "answer") {
      return {
        state: { ...state, phase: "awaitingReply" },
        lines: [
          { speaker: "event", key: "answered" },
          { speaker: "system", key: "greeting" },
          { speaker: "system", key: "ask", params: { slot: ctx.slot } },
        ],
        effects: [],
      };
    }
    if (input.type === "noAnswer" || input.type === "hangUp") {
      return unanswered(state, ctx, [{ speaker: "event", key: "noAnswer" }]);
    }
    return { state, lines: [], effects: [] };
  }

  if (input.type === "answer") return { state, lines: [], effects: [] };
  if (input.type === "noAnswer" || input.type === "hangUp") {
    return unanswered(state, ctx, [{ speaker: "event", key: "hungUp" }]);
  }

  const lines: Line[] = [{ speaker: "patient", input }];
  const intent = intentFor(state.phase, input);

  if (state.phase === "awaitingCallbackTime") {
    if (intent === "unwell" || intent === "wantPerson") return nurse(state, lines, intent === "unwell" ? "unwell" : "personRequested");
    const m = clampPostpone(intent === "later" || intent === "notEaten" ? input.minutes : undefined);
    return {
      state: end(state, "callbackOtherPerson"),
      lines: [...lines, { speaker: "system", key: "willCallBackPerson", params: { time: ctx.startedAt + m * 60_000, minutes: m } }],
      effects: [{ type: "scheduleCall", afterMinutes: m, reason: "someoneElse" }],
    };
  }

  if (state.phase === "confirmTaken") {
    if (intent === "yes") {
      return {
        state: end(state, "takenLogged"),
        lines: [...lines, { speaker: "system", key: "logged" }],
        effects: [{ type: "logDose", confirmation: input.via === "key" ? "keyOne" : "voiceYes", takenAt: ctx.startedAt }],
      };
    }
    if (intent === "no") {
      const s = { ...state, readBackNo: state.readBackNo + 1 };
      if (!state.askedAgainAfterNo) {
        return {
          state: { ...s, askedAgainAfterNo: true, phase: "awaitingReply" },
          lines: [...lines, { speaker: "system", key: "askAgain" }, { speaker: "system", key: "ask", params: { slot: ctx.slot } }],
          effects: [],
        };
      }
      // A second "no" after asking again is treated as unclear.
      return unclear({ ...s, phase: "awaitingReply" }, ctx, lines, "ask");
    }
    if (intent === "unclear") return unclear(state, ctx, lines, "readBack");
    return reply({ ...state, phase: "awaitingReply" }, ctx, intent, input, lines);
  }

  // awaitingReply and keypadMenu
  return reply(state, ctx, intent, input, lines);
}

/** Run a whole call from its inputs. Used to rebuild transcripts for any language. */
export function replay(inputs: CallInput[], ctx: CallContext): StepResult {
  let state = startCall();
  const lines: Line[] = [];
  const effects: Effect[] = [];
  for (const input of inputs) {
    const r = step(state, input, ctx);
    state = r.state;
    lines.push(...r.lines);
    effects.push(...r.effects);
  }
  return { state, lines, effects };
}

/** Replies that make sense in each phase, for the reply buttons. */
export function expectsTime(phase: CallPhase): boolean {
  return phase === "awaitingCallbackTime";
}
