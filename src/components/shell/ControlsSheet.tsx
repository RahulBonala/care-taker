"use client";

import { Phone, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import type { Role } from "@/domain/types";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { useDemo } from "@/store/store";
import { Segmented } from "@/components/ui";
import { ActivityFeed } from "./ActivityFeed";
import { ClockButtons, ClockReadout, HowItWorksLink, LanguageSwitcher, PersonPicker, ResetButton, RingingChip, RoleSwitcher, StoryToggle } from "./controls";

/** Phone: one floating button. Tablet: the "Demo controls" button in the bar. Both open this sheet. */
export function ControlsSheet({ role }: { role: Role | null }) {
  const { t } = useT();
  const open = useDemo((s) => s.controlsOpen);
  const ringing = useDemo((s) => Boolean(s.data?.phone.ringingCallId));
  const storyActive = useDemo((s) => s.story.active);
  const [tab, setTab] = useState<"controls" | "feed">("controls");
  const close = () => useDemo.setState({ controlsOpen: false });

  return (
    <>
      <button
        type="button"
        onClick={() => useDemo.setState({ controlsOpen: true })}
        aria-label={t("shell.demoControls")}
        className={cn(
          "fixed right-3 z-30 inline-flex h-12 items-center gap-2 rounded-full px-4 font-bold shadow-xl sm:hidden",
          ringing ? "bg-ok text-white dark:text-[#06200f]" : "bg-brand text-brand-ink",
          role ? "bottom-[calc(env(safe-area-inset-bottom)+80px)]" : "bottom-[calc(env(safe-area-inset-bottom)+16px)]",
          storyActive && "ring-4 ring-warn",
        )}
      >
        {ringing ? <Phone aria-hidden size={22} className="ring-shake" /> : <SlidersHorizontal aria-hidden size={22} />}
        <span>{t("shell.demo")}</span>
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-end justify-center lg:hidden">
            <button type="button" aria-label={t("common.close")} tabIndex={-1} className="absolute inset-0 bg-black/45" onClick={close} />
            <div role="dialog" aria-modal="true" aria-label={t("shell.demoControls")} className="relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-surface shadow-2xl sm:max-w-xl sm:rounded-3xl sm:mb-6">
              <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
                <Segmented
                  label={t("shell.demoControls")}
                  value={tab}
                  onChange={setTab}
                  options={[
                    { value: "controls", label: t("shell.demoControls") },
                    { value: "feed", label: t("shell.feed") },
                  ]}
                />
                <button type="button" onClick={close} aria-label={t("common.close")} className="inline-flex h-12 w-12 items-center justify-center rounded-xl hover:bg-surface-2">
                  <X aria-hidden size={22} />
                </button>
              </div>
              {tab === "controls" ? (
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
                  <section className="space-y-2">
                    <h3 className="font-bold">{t("shell.clock")}</h3>
                    <ClockReadout stacked />
                    <RingingChip visible={role === "patient"} />
                    <div onClick={close}>
                      <ClockButtons wrap />
                    </div>
                  </section>
                  <section className="space-y-2">
                    <h3 className="font-bold">{t("shell.role")}</h3>
                    <RoleSwitcher current={role} layout="grid" onPicked={close} />
                  </section>
                  {role && (
                    <section className="space-y-2">
                      <PersonPicker role={role} />
                    </section>
                  )}
                  <section className="space-y-2">
                    <h3 className="font-bold">{t("shell.language")}</h3>
                    <LanguageSwitcher />
                  </section>
                  <section className="grid gap-2" onClick={close}>
                    <StoryToggle full />
                    <HowItWorksLink />
                    <ResetButton full />
                  </section>
                </div>
              ) : (
                <ActivityFeed className="min-h-[50dvh] flex-1" />
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
