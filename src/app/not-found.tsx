"use client";

import { MapPinOff } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { useT } from "@/i18n/useT";

export default function NotFound() {
  const { t } = useT();
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-16">
      <EmptyState
        icon={MapPinOff}
        title={t("common.notFound")}
        action={
          <Link href="/" className="inline-flex min-h-12 items-center rounded-xl bg-brand px-5 font-semibold text-brand-ink">
            {t("common.goToStart")}
          </Link>
        }
      />
    </div>
  );
}
