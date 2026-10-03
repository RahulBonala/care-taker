/**
 * Languages. To add one: copy en.ts to a new file (e.g. ta.ts), translate
 * every string (the type checker lists anything missing), and add one line to
 * LANGUAGES below.
 */
import { APP_NAME, APP_TAGLINE, BRAND_IN_SCRIPT } from "@/config/brand";
import en from "./en";
import hi from "./hi";
import te from "./te";
import type { LanguagePack, MessageKey, Messages } from "./types";

export const LANGUAGES = {
  en: { code: "en", nativeName: "English", shortName: "EN", speechLang: "en-IN", messages: en },
  hi: { code: "hi", nativeName: "हिन्दी", shortName: "हिं", speechLang: "hi-IN", messages: hi },
  te: { code: "te", nativeName: "తెలుగు", shortName: "తె", speechLang: "te-IN", messages: te },
} satisfies Record<string, LanguagePack>;

export type LangCode = keyof typeof LANGUAGES;
export const LANG_CODES = Object.keys(LANGUAGES) as LangCode[];

export function messagesFor(lang: LangCode): Messages {
  return LANGUAGES[lang].messages;
}

/** The product name as written for this language (falls back to APP_NAME). */
export function brandName(lang: LangCode): string {
  const s = BRAND_IN_SCRIPT as unknown as Record<string, { name: string; tagline: string } | string>;
  const entry = s[lang];
  if (lang === "en" || BRAND_IN_SCRIPT.forName !== APP_NAME || !entry || typeof entry === "string") return APP_NAME;
  return entry.name;
}

export function brandTagline(lang: LangCode): string {
  const s = BRAND_IN_SCRIPT as unknown as Record<string, { name: string; tagline: string } | string>;
  const entry = s[lang];
  if (lang === "en" || BRAND_IN_SCRIPT.forTagline !== APP_TAGLINE || !entry || typeof entry === "string") return APP_TAGLINE;
  return entry.tagline;
}

export function lookup(messages: Messages, key: string): string | string[] | undefined {
  let node: unknown = messages;
  for (const part of key.split(".")) {
    if (node == null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" || Array.isArray(node) ? (node as string | string[]) : undefined;
}

export function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? `{${k}}`);
}

/** Find the template for a key, choosing `_one` / `_other` forms when a count is given. */
export function templateFor(messages: Messages, key: string, count?: number): string | undefined {
  if (count != null) {
    const plural = lookup(messages, `${key}_${count === 1 ? "one" : "other"}`);
    if (typeof plural === "string") return plural;
  }
  const t = lookup(messages, key);
  return typeof t === "string" ? t : undefined;
}

export type { LanguagePack, MessageKey, Messages };
