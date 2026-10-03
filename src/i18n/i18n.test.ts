import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import en from "./en";
import { LANG_CODES, LANGUAGES, lookup, templateFor, type LangCode } from "./index";

type Tree = { [k: string]: string | string[] | Tree | Array<{ title: string; body: string }> };

/** Every leaf as "a.b.c" → value; arrays of objects become "a.b.0.title". */
function flatten(node: unknown, prefix = "", out = new Map<string, string>()): Map<string, string> {
  if (typeof node === "string") out.set(prefix, node);
  else if (Array.isArray(node)) node.forEach((v, i) => flatten(v, `${prefix}.${i}`, out));
  else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}

const placeholders = (s: string) => new Set(Array.from(s.matchAll(/\{(\w+)\}/g), (m) => m[1]));

const enFlat = flatten(en as unknown as Tree);
const others = LANG_CODES.filter((c): c is Exclude<LangCode, "en"> => c !== "en");

/** Latin-script words allowed inside Hindi and Telugu text: units and sample values a person types. */
const ALLOWED_LATIN = new Set(["mmHg", "mg", "dL", "SpO", "kg", "cm"]);
/** Keys whose value is sample data in a fixed format, not prose. */
const SAMPLE_KEYS = new Set(["family.plan.upiSample", "family.plan.cardSample"]);
/** Values the code passes beyond what the English text happens to use. */
const EXTRA_PARAMS: Array<[prefix: string, names: string[]]> = [
  ["time.pattern", ["period", "ampm", "h", "hh", "mm"]],
  ["call.", ["patientName", "patient", "app", "time", "minutes", "slotTablets"]],
];
const extraFor = (key: string) => EXTRA_PARAMS.filter(([p]) => key.startsWith(p)).flatMap(([, n]) => n);
/** Latin words left once placeholders and allowed units are removed. */
const latinWords = (v: string) => (v.replace(/\{\w+\}/g, " ").match(/[A-Za-z]{2,}/g) ?? []).filter((w) => !ALLOWED_LATIN.has(w));

describe.each(others)("%s translation", (code) => {
  const flat = flatten(LANGUAGES[code].messages as unknown as Tree);

  it("has exactly the English keys", () => {
    const missing = [...enFlat.keys()].filter((k) => !flat.has(k));
    const extra = [...flat.keys()].filter((k) => !enFlat.has(k));
    expect(missing).toEqual([]);
    expect(extra).toEqual([]);
  });

  it("only uses placeholders the English text receives", () => {
    const wrong: string[] = [];
    for (const [k, v] of flat) {
      const allowed = new Set([...placeholders(enFlat.get(k) ?? ""), ...extraFor(k)]);
      for (const p of placeholders(v)) if (!allowed.has(p)) wrong.push(`${k}: {${p}}`);
    }
    expect(wrong).toEqual([]);
  });

  it("does not fall back to English words", () => {
    const leaks: string[] = [];
    for (const [k, v] of flat) {
      if (SAMPLE_KEYS.has(k) || !v) continue;
      const bad = latinWords(v);
      if (bad.length) leaks.push(`${k}: ${bad.join(", ")}`);
    }
    expect(leaks).toEqual([]);
  });

  it("is not a copy of the English text", () => {
    // Strings made only of placeholders, numbers and units are the same in every language.
    const same = [...flat].filter(([k, v]) => latinWords(v).length > 0 && v === enFlat.get(k) && !SAMPLE_KEYS.has(k)).map(([k]) => k);
    expect(same).toEqual([]);
  });
});

/** Keys stored in data (feed events, audit lines, report lines) are plain strings, so check them here. */
describe("keys written into demo data", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name) && !name.endsWith(".test.ts")) files.push(p);
    }
  };
  walk(join(__dirname, ".."));

  // Namespaces whose keys are stored as plain strings (feed, audit, reports, flags, scenarios).
  const NAMESPACES = ["event", "audit", "report", "whatsapp", "flag", "outcome", "noCalls", "admin\\.demo"].join("|");
  const literal = new RegExp(`["'\`]((?:${NAMESPACES})\\.[A-Za-z0-9_.]+)["'\`]`, "g");

  it("every literal key exists in English", () => {
    const missing = new Set<string>();
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(literal)) {
        const key = m[1];
        if (key.endsWith(".")) continue;
        if (lookup(en, key) === undefined && templateFor(en, key, 2) === undefined) missing.add(`${key} (${file.split("src/")[1]})`);
      }
    }
    expect([...missing]).toEqual([]);
  });

  it("every flag type and scenario has a label", () => {
    const flagTypes = readFileSync(join(__dirname, "../domain/types.ts"), "utf8").match(/export type FlagType =([^;]+);/);
    expect(flagTypes).not.toBeNull();
    for (const t of flagTypes![1].match(/"(\w+)"/g)!.map((s) => s.slice(1, -1))) {
      expect(lookup(en, `flag.type.${t}`), t).toBeTypeOf("string");
    }
  });
});
