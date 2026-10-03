"use client";

import { CircleAlert, Inbox, RefreshCw, WifiOff, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { Button } from "./Button";

export function EmptyState({ icon: Icon = Inbox, title, body, action, className }: { icon?: LucideIcon; title: ReactNode; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-10 text-center", className)}>
      <span className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-muted">
        <Icon aria-hidden size={28} />
      </span>
      <p className="text-lg font-bold">{title}</p>
      {body && <p className="mt-1 max-w-sm text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ onRetry, forced }: { onRetry: () => void; forced?: boolean }) {
  const { t } = useT();
  return (
    <div role="alert" className="flex flex-col items-center rounded-2xl border border-danger/40 bg-danger-soft px-6 py-10 text-center">
      <span className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-surface text-danger">
        <CircleAlert aria-hidden size={28} />
      </span>
      <p className="text-lg font-bold text-danger">{t("common.errorTitle")}</p>
      <p className="mt-1 max-w-sm text-ink">{t("common.errorBody")}</p>
      {forced && <p className="mt-2 max-w-sm text-sm text-muted">{t("common.errorForced")}</p>}
      <Button className="mt-4" variant="secondary" icon={RefreshCw} onClick={onRetry}>
        {t("common.retry")}
      </Button>
    </div>
  );
}

export function OfflineNotice() {
  const { t } = useT();
  return (
    <div role="status" className="flex items-start gap-3 border-b border-warn/40 bg-warn-soft px-4 py-3 text-warn">
      <WifiOff aria-hidden size={22} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="font-bold">{t("common.offlineTitle")}</p>
        <p className="text-ink">{t("common.offlineBody")}</p>
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton", className)} />;
}

export function ScreenSkeleton() {
  const { t } = useT();
  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 pt-6" role="status" aria-label={t("common.loading")}>
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-5 w-1/2" />
      <div className="grid gap-3 @tab:grid-cols-2">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-40" />
      <Skeleton className="h-24" />
      <span className="sr-only">{t("common.loading")}</span>
    </div>
  );
}
