"use client";

import { brandName } from "@/i18n";
import { cn } from "@/lib/cn";
import { useDemo } from "@/store/store";

/** Neutral mark: the name as text beside a plain rounded square. No logo design. */
export function BrandMark({ compact, className }: { compact?: boolean; className?: string }) {
  const lang = useDemo((s) => s.ui.language);
  return (
    <span className={cn("inline-flex items-center gap-2 font-bold", className)}>
      <svg aria-hidden width="28" height="28" viewBox="0 0 28 28" className="shrink-0">
        <rect x="1" y="1" width="26" height="26" rx="8" fill="var(--brand)" />
        <circle cx="14" cy="14" r="5" fill="none" stroke="var(--brand-ink)" strokeWidth="2.5" />
      </svg>
      {!compact && <span className="truncate text-lg">{brandName(lang)}</span>}
    </span>
  );
}
