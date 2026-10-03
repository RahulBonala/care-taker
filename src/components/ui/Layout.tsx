import type { LucideIcon } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-2xl border border-line bg-surface p-4", className)} {...rest}>
      {children}
    </div>
  );
}

export function Section({ title, icon: Icon, action, children, className, id }: { title: ReactNode; icon?: LucideIcon; action?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={cn("space-y-3", className)} aria-labelledby={id}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="flex items-center gap-2 text-lg font-bold">
          {Icon && <Icon aria-hidden size={20} className="text-muted" />}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Page wrapper inside a role pane: comfortable padding, readable width. */
export function Screen({ children, wide, className }: { children: ReactNode; wide?: boolean; className?: string }) {
  return <div className={cn("mx-auto w-full space-y-6 px-4 pt-4 pb-10 @tab:px-6 @tab:pt-6", wide ? "max-w-6xl" : "max-w-3xl", className)}>{children}</div>;
}

export function ScreenTitle({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold leading-tight @tab:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function KV({ rows, className }: { rows: Array<[ReactNode, ReactNode]>; className?: string }) {
  return (
    <dl className={cn("divide-y divide-line", className)}>
      {rows.map(([k, v], i) => (
        <div key={i} className="flex flex-col gap-0.5 py-2.5 @md:flex-row @md:gap-4">
          <dt className="shrink-0 text-muted @md:w-44">{k}</dt>
          <dd className="min-w-0 font-medium break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Stat({ label, value, hint, icon: Icon, tone = "neutral" }: { label: ReactNode; value: ReactNode; hint?: ReactNode; icon?: LucideIcon; tone?: "neutral" | "ok" | "warn" | "danger" | "brand" }) {
  const toneText = { neutral: "text-ink", ok: "text-ok", warn: "text-warn", danger: "text-danger", brand: "text-brand" }[tone];
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted">
        {Icon && <Icon aria-hidden size={16} />}
        <span>{label}</span>
      </div>
      <div className={cn("mt-1 text-3xl font-bold tabular-nums", toneText)}>{value}</div>
      {hint && <div className="mt-0.5 text-sm text-muted">{hint}</div>}
    </div>
  );
}

export function Banner({ tone, icon: Icon, title, children, action, className }: { tone: "ok" | "warn" | "danger" | "info" | "brand"; icon?: LucideIcon; title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  const tones = {
    ok: "bg-ok-soft text-ok border-ok/30",
    warn: "bg-warn-soft text-warn border-warn/30",
    danger: "bg-danger-soft text-danger border-danger/30",
    info: "bg-info-soft text-info border-info/30",
    brand: "bg-brand-soft text-brand border-brand/30",
  }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex flex-wrap items-start gap-3 rounded-2xl border p-4", tones, className)}>
      {Icon && <Icon aria-hidden size={22} className="mt-0.5 shrink-0" />}
      <div className="min-w-0 flex-1 basis-48">
        {title && <div className="font-bold">{title}</div>}
        {children && <div className="text-ink">{children}</div>}
      </div>
      {action}
    </div>
  );
}
