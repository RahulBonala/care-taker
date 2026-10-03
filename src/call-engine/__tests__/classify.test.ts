import { describe, expect, it } from "vitest";
import { classifyReply, minutesIn } from "../classify";

describe("classifyReply", () => {
  it.each([
    ["Yes I have taken them", "taken"],
    ["took it", "taken"],
    ["मैंने दवा ले ली", "taken"],
    ["le li hai", "taken"],
    ["వేసుకున్నాను", "taken"],
    ["I haven't eaten yet", "notEaten"],
    ["अभी खाना नहीं खाया", "notEaten"],
    ["ఇంకా తినలేదు", "notEaten"],
    ["call me later", "later"],
    ["बाद में", "later"],
    ["తర్వాత చేయండి", "later"],
    ["I am not feeling well", "unwell"],
    ["तबीयत ठीक नहीं है", "unwell"],
    ["ఒంట్లో బాలేదు", "unwell"],
    ["I won't take it", "refuse"],
    ["नहीं लूंगी", "refuse"],
    ["వద్దు", "refuse"],
    ["She is not here, this is her son", "someoneElse"],
    ["वो घर पर नहीं हैं", "someoneElse"],
    ["I want to talk to a person", "wantPerson"],
    ["नर्स से बात करनी है", "wantPerson"],
    ["yes", "yes"],
    ["हाँ जी", "yes"],
    ["అవును", "yes"],
    ["no", "no"],
    ["mmm hmm", "unclear"],
    ["", "unclear"],
  ])("%s → %s", (text, intent) => {
    expect(classifyReply(text).intent).toBe(intent);
  });

  it("reads minutes", () => {
    expect(classifyReply("call me in 10 minutes")).toEqual({ intent: "later", minutes: 10 });
    expect(classifyReply("30")).toEqual({ intent: "later", minutes: 30 });
    expect(minutesIn("half an hour")).toBe(30);
    expect(minutesIn("one hour")).toBe(60);
    expect(minutesIn("అరగంట తర్వాత")).toBe(30);
  });
});
