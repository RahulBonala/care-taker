"use client";

import { useMemo } from "react";
import { useDemo } from "@/store/store";
import type { LangCode } from "./index";
import { makeTranslator, type Translator } from "./translator";

export function useLang(): LangCode {
  return useDemo((s) => s.ui.language);
}

export function useT(langOverride?: LangCode): Translator {
  const uiLang = useLang();
  const data = useDemo((s) => s.data);
  const lang = langOverride ?? uiLang;
  return useMemo(() => makeTranslator(lang, data), [lang, data]);
}
