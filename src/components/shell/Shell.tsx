"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { findScreen } from "@/components/roles/registry";
import type { Role } from "@/domain/types";
import { ROLES } from "@/domain/types";
import { useIsDesktop } from "@/hooks/useMedia";
import { brandName } from "@/i18n";
import { useT } from "@/i18n/useT";
import { useDemo } from "@/store/store";
import { ActivityFeed } from "./ActivityFeed";
import { ControlBar } from "./ControlBar";
import { ControlsSheet } from "./ControlsSheet";
import { SampleBanner } from "./SampleBanner";
import { Stage } from "./Stage";
import { StoryBar } from "./StoryBar";

export function parseRolePath(pathname: string): { role: Role | null; screen: string } {
  const [first, second] = pathname.split("/").filter(Boolean);
  if (first && (ROLES as string[]).includes(first)) return { role: first as Role, screen: second ?? "" };
  return { role: null, screen: "" };
}

export function Shell({ children }: { children: ReactNode }) {
  const { t, lang } = useT();
  const pathname = usePathname();
  const { role, screen } = parseRolePath(pathname);
  const desktop = useIsDesktop();
  const feedOpen = useDemo((s) => s.ui.feedOpen);

  // The tab title follows the demo language and the screen on show.
  const page = role ? `${t(findScreen(role, screen).label)} · ${t(`roles.${role}.name`)}` : pathname.startsWith("/how-it-works") ? t("flow.title") : "";
  const title = page ? `${page} · ${brandName(lang)}` : brandName(lang);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <title>{title}</title>
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        {t("shell.skipToContent")}
      </a>
      <SampleBanner />
      <ControlBar role={role} />
      <StoryBar role={role} />
      <div className="flex min-h-0 flex-1">
        <main id="content" className="relative min-w-0 flex-1 bg-stage">
          {role ? (
            <Stage role={role} screen={screen}>
              {children}
            </Stage>
          ) : (
            <div className="h-full overflow-y-auto bg-bg">{children}</div>
          )}
        </main>
        {desktop && feedOpen && (
          <aside className="flex w-[340px] shrink-0 flex-col border-l border-line bg-bg" aria-label={t("shell.feed")}>
            <ActivityFeed className="h-full" />
          </aside>
        )}
      </div>
      <ControlsSheet role={role} />
    </div>
  );
}
