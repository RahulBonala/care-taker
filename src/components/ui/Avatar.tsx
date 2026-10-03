import { User } from "lucide-react";
import { cn } from "@/lib/cn";

/** Photo placeholder: a soft coloured circle with a person outline. */
export function Avatar({ hue = 200, size = 48, label, className }: { hue?: number; size?: number; label?: string; className?: string }) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full", className)}
      style={{ width: size, height: size, background: `hsl(${hue} 55% 88%)`, color: `hsl(${hue} 45% 28%)` }}
    >
      <User aria-hidden size={Math.round(size * 0.55)} />
    </span>
  );
}
