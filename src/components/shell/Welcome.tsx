"use client";

import { ArrowRight, BookOpen, CircleCheck, CircleQuestionMark } from "lucide-react";
import Link from "next/link";
import { ROLE_ICONS, screenPath } from "@/components/roles/registry";
import { Button } from "@/components/ui";
import { ROLES } from "@/domain/types";
import { brandTagline } from "@/i18n";
import { useT } from "@/i18n/useT";
import { startStory } from "@/store/story";
import { useRoleNav } from "./useRoleNav";
import { BrandMark } from "./BrandMark";

export function Welcome() {
  const { t, list, lang } = useT();
  const navigate = useRoleNav();
  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 px-4 py-8 sm:px-8 sm:py-12">
      <header className="space-y-4">
        <BrandMark className="text-2xl" />
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{brandTagline(lang)}</h1>
        <p className="max-w-2xl text-lg text-muted">{t("welcome.intro")}</p>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" size="lg" icon={BookOpen} onClick={() => startStory(navigate)}>
            {t("welcome.startStory")}
          </Button>
          <Link href="/how-it-works/" className="inline-flex min-h-14 items-center gap-2 rounded-2xl border border-line bg-surface px-5 text-lg font-semibold hover:bg-surface-2">
            <CircleQuestionMark aria-hidden size={22} />
            {t("welcome.howItWorks")}
          </Link>
        </div>
        <p className="text-muted">{t("welcome.storyHint")}</p>
      </header>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">{t("welcome.explore")}</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((r) => {
            const Icon = ROLE_ICONS[r];
            return (
              <li key={r}>
                <Link href={screenPath(r, "")} className="group flex h-full items-start gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-brand">
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    <Icon aria-hidden size={24} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 text-lg font-bold">
                      {t(`roles.${r}.name`)}
                      <ArrowRight aria-hidden size={18} className="opacity-0 transition group-hover:opacity-100" />
                    </span>
                    <span className="block text-muted">{t(`roles.${r}.desc`)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-bold">{t("welcome.whatItDoes")}</h2>
        <ul className="space-y-2">
          {list("welcome.points").map((p) => (
            <li key={p} className="flex items-start gap-3">
              <CircleCheck aria-hidden size={22} className="mt-0.5 shrink-0 text-ok" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <p className="text-muted">{t("welcome.note")}</p>
      </section>
    </div>
  );
}
