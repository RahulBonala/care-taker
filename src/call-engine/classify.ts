/**
 * Understands a free-text reply (what the speech recogniser would hand over)
 * in English, Hindi or Telugu, including common romanised spellings. Anything
 * it is not sure about is "unclear"; the state machine then asks again or
 * falls back to the keypad menu. It never guesses "taken".
 */
import type { ReplyIntent } from "@/domain/types";

interface Rule {
  intent: ReplyIntent;
  words: string[];
}

// Order matters: specific phrases (negations, unwell, refusals) come before
// short words like "yes" or "taken".
const RULES: Rule[] = [
  {
    intent: "unwell",
    words: [
      "not feeling well", "not well", "unwell", "feel sick", "feeling sick", "i am sick", "dizzy", "fever", "vomit", "pain", "breathless", "can't breathe",
      "तबीयत ठीक नहीं", "तबियत ठीक नहीं", "तबीयत खराब", "ठीक नहीं लग", "चक्कर", "बुखार", "दर्द", "उल्टी", "सांस",
      "tabiyat theek nahi", "tabiyat kharab", "theek nahi lag", "chakkar", "bukhar", "dard",
      "బాగాలేదు", "బాగా లేదు", "ఒంట్లో బాలేదు", "నలతగా", "కళ్ళు తిరుగు", "జ్వరం", "నొప్పి", "వాంతి", "ఆయాసం",
      "bagaledu", "bagaaledu", "ontlo baledu", "jvaram", "noppi",
    ],
  },
  {
    intent: "wantPerson",
    words: [
      "talk to a person", "speak to a person", "real person", "human", "talk to someone", "speak to someone", "nurse", "doctor", "talk to nurse",
      "किसी से बात", "इंसान से बात", "नर्स", "डॉक्टर", "nurse se baat", "kisi se baat",
      "మనిషితో మాట్లాడ", "ఎవరితోనైనా మాట్లాడ", "నర్స్", "డాక్టర్", "nurse tho", "manishi tho",
    ],
  },
  {
    intent: "someoneElse",
    words: [
      "wrong number", "not here", "she is not", "he is not", "this is her", "this is his", "someone else", "not her", "not him", "i am her", "i am his",
      "गलत नंबर", "घर पर नहीं", "वो नहीं हैं", "वह नहीं हैं", "मैं उनका", "मैं उनकी", "galat number", "ghar par nahi",
      "రాంగ్ నంబర్", "ఇంట్లో లేరు", "వారు లేరు", "నేను వారి", "నేను ఆమె", "నేను అతని", "intlo leru",
    ],
  },
  {
    intent: "refuse",
    words: [
      "won't take", "will not take", "don't want", "do not want", "refuse", "not taking", "stop the tablets",
      "नहीं लूंगी", "नहीं लूँगी", "नहीं लूंगा", "नहीं लूँगा", "नहीं लेना", "नहीं खाऊंगी", "नहीं खाऊंगा", "nahi lunga", "nahi lungi", "nahi lena",
      "వేసుకోను", "వద్దు", "తీసుకోను", "vesukonu", "vaddu",
    ],
  },
  {
    intent: "notEaten",
    words: [
      "not eaten", "haven't eaten", "have not eaten", "not yet eaten", "didn't eat", "no food yet", "not had food",
      "खाना नहीं खाया", "नहीं खाया", "अभी खाना नहीं", "khana nahi khaya", "nahi khaya",
      "తినలేదు", "ఇంకా తినలేదు", "భోజనం చేయలేదు", "tinaledu", "inka tinaledu",
    ],
  },
  {
    intent: "later",
    words: [
      "later", "call back", "call me back", "call again", "after some time", "in a while", "minutes", "minute",
      "बाद में", "थोड़ी देर", "फिर से फोन", "मिनट", "baad mein", "baad me", "thodi der",
      "తర్వాత", "తరువాత", "కాసేపు", "నిమిషాల", "నిమిషాలు", "tarvata", "taruvata", "kasepu",
    ],
  },
  {
    intent: "taken",
    words: [
      "taken", "took", "i have taken", "had it", "had them", "done", "already took",
      "ले ली", "ले लिया", "ले लीं", "खा ली", "खा लिया", "ली है", "le li", "le liya", "kha li", "li hai",
      "వేసుకున్నా", "వేసుకున్నాను", "తీసుకున్నా", "తీసుకున్నాను", "vesukunna", "vesukunnanu", "teesukunna",
    ],
  },
  {
    intent: "no",
    words: ["no", "nope", "wrong", "not right", "नहीं", "गलत", "nahi", "nahin", "కాదు", "లేదు", "kaadu", "ledu"],
  },
  {
    intent: "yes",
    words: ["yes", "yeah", "yep", "right", "correct", "ok", "okay", "हाँ", "हां", "जी", "सही", "haan", "han", "ji", "అవును", "సరే", "అవునండి", "avunu", "sare"],
  },
];

const WORD_NUMBERS: Record<string, number> = {
  ten: 10, fifteen: 15, twenty: 20, thirty: 30, forty: 40, "forty five": 45, fifty: 50, sixty: 60, ninety: 90, "half an hour": 30, "an hour": 60, "one hour": 60,
  "दस": 10, "पंद्रह": 15, "बीस": 20, "तीस": 30, "आधा घंटा": 30, "आधे घंटे": 30, "एक घंटे": 60, "घंटे भर": 60, "das": 10, "bees": 20, "tees": 30, "aadha ghanta": 30, "ek ghante": 60,
  "పది": 10, "పదిహేను": 15, "ఇరవై": 20, "ముప్పై": 30, "అరగంట": 30, "గంట": 60, "padi": 10, "muppai": 30, "aragamta": 30, "ganta": 60,
};

function normalise(text: string): string {
  return ` ${text.toLowerCase().replace(/[.,!?;:"'’]/g, " ").replace(/\s+/g, " ").trim()} `;
}

function contains(haystack: string, word: string): boolean {
  const w = normalise(word).trim();
  // Latin words must match whole words; Indic phrases can match inside a word.
  if (/^[a-z ]+$/.test(w)) return haystack.includes(` ${w} `);
  return haystack.includes(w);
}

/** Minutes mentioned in the reply, if any (digits or number words). */
export function minutesIn(text: string): number | undefined {
  const t = normalise(text);
  const digits = t.match(/(\d{1,3})/);
  if (digits) {
    const n = Number(digits[1]);
    if (/(hour|hr|घंट|గంట)/.test(t) && n <= 3) return n * 60;
    return n;
  }
  let best: number | undefined;
  let bestLen = 0;
  for (const [word, n] of Object.entries(WORD_NUMBERS)) {
    if (t.includes(word) && word.length > bestLen) {
      best = n;
      bestLen = word.length;
    }
  }
  return best;
}

export interface Classified {
  intent: ReplyIntent;
  minutes?: number;
}

export function classifyReply(text: string): Classified {
  const t = normalise(text);
  if (t.trim().length === 0) return { intent: "unclear" };
  for (const rule of RULES) {
    if (rule.words.some((w) => contains(t, w))) {
      const minutes = rule.intent === "later" || rule.intent === "notEaten" ? minutesIn(text) : undefined;
      return minutes != null ? { intent: rule.intent, minutes } : { intent: rule.intent };
    }
  }
  // A bare number ("30") means "call me in 30 minutes".
  const minutes = minutesIn(text);
  if (minutes != null) return { intent: "later", minutes };
  return { intent: "unclear" };
}
