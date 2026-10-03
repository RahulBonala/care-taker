"use client";

import { PanelRightClose, PanelRightOpen, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import type { Role } from "@/domain/types";
import { usePreviewCapable, useSplitCapable } from "@/hooks/useMedia";
import { useT } from "@/i18n/useT";
import { setUi, useDemo } from "@/store/store";
import { BrandMark } from "./BrandMark";
import { ClockButtons, ClockReadout, DeviceControls, HowItWorksLink, LanguageSwitcher, PersonPicker, ResetButton, RingingChip, RoleSwitcher, SplitControls, StoryToggle } from "./controls";

/** Tablet and desktop. On phones the same controls live in a sheet behind one button. */
export function ControlBar({ role }: { role: Role | null }) {
  const { t } = useT();
  const preview = usePreviewCapable();
  const splitCapable = useSplitCapable();
  const feedOpen = useDemo((s) => s.ui.feedOpen);
  const split = useDemo((s) => s.ui.split);
  const patientVisible = role === "patient" || (split.on && splitCapable && split.right.role === "patient");

  return (
    <div className="hidden shrink-0 border-b border-line bg-surface sm:block">
      {/* Row 1: who you are */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 pt-2 pb-1">
        <Link href="/" className="shrink-0 rounded-lg px-1" aria-label={t("shell.home")}>
          <BrandMark />
        </Link>
        <div className="hidden lg:block">
          <RoleSwitcher current={role} />
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {role && (
            <div className="hidden lg:block">
              <PersonPicker role={role} />
            </div>
          )}
          <LanguageSwitcher compact />
        </div>
      </div>
      {/* Row 2: time and demo controls */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 pt-1 pb-2">
        <ClockReadout stacked />
        <div className="hidden lg:block">
          <ClockButtons />
        </div>
        <RingingChip visible={patientVisible} />
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {preview && role && <DeviceControls />}
          {splitCapable && role && <SplitControls />}
          <div className="hidden lg:flex lg:items-center lg:gap-1">
            <StoryToggle short />
            <HowItWorksLink iconOnly />
            <ResetButton iconOnly />
            <button
              type="button"
              onClick={() => setUi({ feedOpen: !feedOpen })}
              aria-pressed={feedOpen}
              aria-label={t("shell.feed")}
              title={t("shell.feed")}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink aria-pressed:text-brand"
            >
              {feedOpen ? <PanelRightClose aria-hidden size={18} /> : <PanelRightOpen aria-hidden size={18} />}
            </button>
          </div>
          <button
            type="button"
            onClick={() => useDemo.setState({ controlsOpen: true })}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-soft px-3 font-semibold text-brand lg:hidden"
          >
            <SlidersHorizontal aria-hidden size={18} />
            {t("shell.demoControls")}
          </button>
        </div>
      </div>
    </div>
  );
}
