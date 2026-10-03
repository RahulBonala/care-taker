"use client";

import { FlaskConical } from "lucide-react";
import { useT } from "@/i18n/useT";

/** Always on screen. */
export function SampleBanner() {
  const { t } = useT();
  return (
    <div role="note" className="flex shrink-0 items-center justify-center gap-2 bg-warn-soft px-3 py-1 text-center text-sm font-semibold text-warn">
      <FlaskConical aria-hidden size={16} className="shrink-0" />
      <span>{t("common.sampleBanner")}</span>
    </div>
  );
}
