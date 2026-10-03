"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { useOptionalPane } from "../shell/PaneContext";

/**
 * A bottom sheet on narrow panes and a centred dialog on wide ones. Renders
 * inside the pane it was opened from, so it stays inside a device frame.
 */
export function Sheet({ open, onClose, title, children, footer, wide, target }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean; target?: HTMLElement | null }) {
  const pane = useOptionalPane();
  const { t } = useT();
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  const host = target ?? pane?.overlay ?? (typeof document !== "undefined" ? document.body : null);
  if (!host) return null;
  const inPane = host !== document.body;

  return createPortal(
    <div className={cn("pointer-events-auto z-50 flex items-end justify-center @tab:items-center", inPane ? "absolute inset-0" : "fixed inset-0")}>
      <button type="button" aria-label={t("common.close")} className="absolute inset-0 bg-black/45" onClick={onClose} tabIndex={-1} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[92%] w-full flex-col overflow-hidden rounded-t-3xl bg-surface shadow-2xl outline-none @tab:rounded-3xl",
          wide ? "@tab:max-w-2xl" : "@tab:max-w-lg",
          !inPane && "max-h-[92dvh] sm:max-w-lg sm:rounded-3xl",
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
          <h2 id={id} className="min-w-0 text-lg font-bold">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl hover:bg-surface-2">
            <X aria-hidden size={22} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3">{footer}</div>}
      </div>
    </div>,
    host,
  );
}
