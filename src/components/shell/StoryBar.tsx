"use client";

import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, CircleCheck, Flag, Wand2, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import type { Role } from "@/domain/types";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { setUi, useDemo } from "@/store/store";
import { exitStory, STEPS, storyBack, storyDoIt, storyNext, storySpot } from "@/store/story";
import { parseRolePath } from "./Shell";
import { useRoleNav } from "./useRoleNav";

/** The guided walkthrough: what is happening, what to press, and Back / Do it for me / Next. */
export function StoryBar({ role }: { role: Role | null }) {
  const { t, m } = useT();
  const navigate = useRoleNav();
  const pathname = usePathname();
  const story = useDemo((s) => s.story);
  const state = useDemo((s) => s);
  const [open, setOpen] = useState(true);

  // Keep the highlighted control in step with what is on screen.
  useEffect(() => {
    if (!state.story.active) return;
    const where = parseRolePath(pathname);
    const spot = storySpot(state, where);
    if (spot !== state.ui.highlight) setUi({ highlight: spot });
  }, [state, pathname]);

  // Step 6: once the nurse closes the flag, the right side switches to the family.
  useEffect(() => {
    if (!state.story.active || state.story.step !== 5) return;
    const closed = state.data?.flags.some((f) => f.patientId === "p_lakshmi" && f.type === "unwell" && f.status === "closed");
    if (closed && state.ui.split.right.role === "nurse") setUi({ split: { on: true, right: { role: "family", screen: "" } } });
  }, [state]);

  if (!story.active) return null;
  const step = STEPS[story.step];
  const text = m.story.steps[story.step];
  const done = step.done(state);
  const last = story.step === STEPS.length - 1;
  void role;

  return (
    <section aria-label={t("story.label")} className="shrink-0 border-b-2 border-warn bg-warn-soft">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-start gap-x-4 gap-y-2 px-3 py-2">
        <div className="min-w-0 flex-1 basis-72">
          <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-warn">
            <BookOpen aria-hidden size={16} />
            {t("story.label")} · {t("story.stepOf", { n: story.step + 1, total: STEPS.length })}
            {done && (
              <span className="inline-flex items-center gap-1 text-ok">
                <CircleCheck aria-hidden size={16} />
                {t("story.done")}
              </span>
            )}
          </p>
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-start gap-2 text-left">
            <span className="text-lg leading-snug font-bold text-ink">{text.title}</span>
            <ChevronDown aria-hidden size={20} className={cn("mt-1 shrink-0 text-muted transition sm:hidden", open && "rotate-180")} />
          </button>
          <p className={cn("text-[15px] text-ink", !open && "hidden sm:block")}>{text.body}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" icon={ArrowLeft} disabled={story.step === 0} onClick={() => storyBack(navigate)}>
            {t("story.back")}
          </Button>
          <Button size="sm" variant="secondary" icon={Wand2} disabled={done && story.step !== 4 && story.step !== 9} onClick={() => storyDoIt(navigate)}>
            {t("story.doIt")}
          </Button>
          <Button size="sm" variant="primary" iconRight={last ? Flag : ArrowRight} onClick={() => storyNext(navigate)} className={done ? "ring-2 ring-ok ring-offset-2 ring-offset-warn-soft" : undefined}>
            {last ? t("story.finish") : t("story.next")}
          </Button>
          <button type="button" onClick={exitStory} aria-label={t("story.exit")} title={t("story.exit")} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-surface">
            <X aria-hidden size={20} />
          </button>
        </div>
      </div>
    </section>
  );
}
