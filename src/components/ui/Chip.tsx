import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Tone = "ok" | "warn" | "danger" | "info" | "neutral" | "brand";

const TONES: Record<Tone, string> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  neutral: "bg-surface-2 text-muted",
  brand: "bg-brand-soft text-brand",
};

/** A status word with an icon. Colour is never the only signal. */
export function Chip({ tone = "neutral", icon: Icon, children, className, size = "md" }: { tone?: Tone; icon?: LucideIcon; children: ReactNode; className?: string; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full font-semibold",
        size === "sm" ? "px-2 py-0.5 text-[13px] leading-5" : "px-2.5 py-1 text-sm",
        TONES[tone],
        className,
      )}
    >
      {Icon && <Icon aria-hidden size={size === "sm" ? 14 : 16} className="shrink-0" />}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

export function toneClass(tone: Tone) {
  return TONES[tone];
}
