"use client";

import { ChevronRight, Columns2, Monitor, Phone, PhoneIncoming, RotateCw, RotateCcw, Smartphone, SkipForward, Sunrise, Moon, Tablet, BookOpen, X, CircleQuestionMark } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Role } from "@/domain/types";
import { ROLES } from "@/domain/types";
import { dayNo } from "@/domain/packages";
import { findPatient } from "@/domain/data";
import { useSpot } from "@/hooks/useSpot";
import { LANG_CODES, LANGUAGES, type LangCode } from "@/i18n";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { localDate } from "@/lib/time";
import { dayTarget, endOfDay, jumpToDay, nextDay, nextDoseTime, resetDemo, setActingAs } from "@/store/actions";
import { setUi, useDemo } from "@/store/store";
import { exitStory, startStory } from "@/store/story";
import { ROLE_ICONS } from "@/components/roles/registry";
import { Button, IconButton, Select, Sheet } from "@/components/ui";
import { useRoleNav } from "./useRoleNav";

export function RoleSwitcher({ current, layout = "row", onPicked }: { current: Role | null; layout?: "row" | "grid"; onPicked?: () => void }) {
  const { t } = useT();
  const go = useRoleNav();
  return (
    <nav aria-label={t("shell.role")} className={cn(layout === "grid" ? "grid grid-cols-2 gap-2" : "flex flex-wrap gap-1")}>
      {ROLES.map((r) => {
        const Icon = ROLE_ICONS[r];
        const on = r === current;
        return (
          <RoleButton key={r} role={r} on={on} layout={layout} label={layout === "grid" ? t(`roles.${r}.name`) : t(`roles.${r}.short`)} Icon={Icon} onClick={() => { go(r); onPicked?.(); }} />
        );
      })}
    </nav>
  );
}

function RoleButton({ role, on, label, Icon, onClick, layout }: { role: Role; on: boolean; label: string; Icon: (typeof ROLE_ICONS)[Role]; onClick: () => void; layout: "row" | "grid" }) {
  const spot = useSpot<HTMLButtonElement>(`role.${role}`);
  return (
    <button
      ref={spot.ref}
      data-spot={spot["data-spot"]}
      type="button"
      onClick={onClick}
      aria-current={on ? "page" : undefined}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2.5 text-[15px] font-semibold transition",
        layout === "grid" && "min-h-14 justify-start border border-line",
        on ? "bg-brand text-brand-ink" : "text-ink hover:bg-surface-2",
        spot.className,
      )}
    >
      <Icon aria-hidden size={18} className="shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

export function PersonPicker({ role, id }: { role: Role; id?: string }) {
  const { t, text, person } = useT();
  const data = useDemo((s) => s.data)!;
  const value = useDemo((s) => s.ui.actingAs[role]);
  const options: Array<{ id: string; label: string }> =
    role === "patient"
      ? data.patients.map((p) => ({ id: p.id, label: `${person(p.id)} · ${t(`lang.${p.language}`)} · ${p.phoneType === "keypad" ? t("patient.keypadPhone") : t("patient.smartphone")}` }))
      : role === "family"
        ? data.family.map((f) => ({ id: f.id, label: `${text(f.name)} · ${t(`relation.${f.relation}`)} · ${person(f.patientId)}` }))
        : data.staff.filter((s) => s.role === role).map((s) => ({ id: s.id, label: person(s.id) }));
  return (
    <label className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-sm font-semibold text-muted">{t("shell.actingAs")}</span>
      <Select id={id} value={value} onChange={(e) => setActingAs(role, e.target.value)} className="min-h-11 min-w-0 max-w-[18rem] py-1 text-[15px]">
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

export function LanguageSwitcher({ compact }: { compact?: boolean }) {
  const { t } = useT();
  const lang = useDemo((s) => s.ui.language);
  return (
    <div role="radiogroup" aria-label={t("shell.language")} className="inline-flex shrink-0 rounded-xl bg-surface-2 p-1">
      {LANG_CODES.map((code: LangCode) => (
        <button
          key={code}
          type="button"
          role="radio"
          aria-checked={lang === code}
          lang={code}
          onClick={() => setUi({ language: code })}
          className={cn("min-h-10 rounded-lg px-2.5 text-[15px] font-semibold", lang === code ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink")}
        >
          {compact ? LANGUAGES[code].shortName : LANGUAGES[code].nativeName}
        </button>
      ))}
    </div>
  );
}

/** "Mon 5 Oct · 12:50 pm · Day 3 of 14" for the patient on screen. */
export function ClockReadout({ stacked }: { stacked?: boolean }) {
  const { t, time, weekdayDate, person } = useT();
  const now = useDemo((s) => s.now);
  const data = useDemo((s) => s.data)!;
  const focusId = useDemo((s) => s.ui.focusPatientId);
  const p = findPatient(data, focusId);
  let day: string;
  if (!p) day = t("shell.notEnrolled");
  else if (p.pkg.status === "expired") day = t("shell.packageEnded");
  else if (p.pkg.kind === "monthly") day = t("time.monthDayOf", { month: p.pkg.monthNo ?? 1, day: Math.max(1, dayNo(p, localDate(now))), total: p.pkg.lengthDays });
  else day = t("time.dayOf", { day: Math.max(1, dayNo(p, localDate(now))), total: p.pkg.lengthDays });
  return (
    <div className={cn("min-w-0", stacked ? "flex flex-col leading-tight" : "flex flex-wrap items-baseline gap-x-2")} aria-live="polite">
      <span className="font-bold whitespace-nowrap tabular-nums">
        {weekdayDate(now)} · {time(now)}
      </span>
      <span className="truncate text-sm text-muted">
        {day}
        {p ? ` · ${person(p.id)}` : ""}
      </span>
    </div>
  );
}

export function ClockButtons({ wrap }: { wrap?: boolean }) {
  const { t } = useT();
  const active = useDemo((s) => Boolean(s.data?.phone.activeCallId));
  const now = useDemo((s) => s.now);
  useDemo((s) => s.ui.focusPatientId);
  useDemo((s) => s.data);
  const title = active ? t("shell.finishCallFirst") : undefined;
  const day7 = dayTarget(7);
  const day14 = dayTarget(14);
  const s1 = useSpot<HTMLButtonElement>("clock.nextDose");
  const s2 = useSpot<HTMLButtonElement>("clock.endOfDay");
  const s3 = useSpot<HTMLButtonElement>("clock.nextDay");
  const s4 = useSpot<HTMLButtonElement>("clock.day7");
  const s5 = useSpot<HTMLButtonElement>("clock.day14");
  return (
    <div className={cn("flex gap-1.5", wrap ? "flex-wrap" : "flex-wrap")} title={title}>
      <Button ref={s1.ref} data-spot={s1["data-spot"]} className={s1.className} size="sm" variant="primary" icon={PhoneIncoming} disabled={active} onClick={() => nextDoseTime()}>
        {t("shell.nextDose")}
      </Button>
      <Button ref={s2.ref} data-spot={s2["data-spot"]} className={s2.className} size="sm" icon={Moon} disabled={active} onClick={endOfDay}>
        {t("shell.endOfDay")}
      </Button>
      <Button ref={s3.ref} data-spot={s3["data-spot"]} className={s3.className} size="sm" icon={Sunrise} disabled={active} onClick={nextDay}>
        {t("shell.nextDay")}
      </Button>
      <Button ref={s4.ref} data-spot={s4["data-spot"]} className={s4.className} size="sm" icon={SkipForward} disabled={active || day7 == null || day7 <= now} onClick={() => jumpToDay(7)}>
        {t("shell.jumpDay", { day: 7 })}
      </Button>
      <Button ref={s5.ref} data-spot={s5["data-spot"]} className={s5.className} size="sm" icon={SkipForward} disabled={active || day14 == null || day14 <= now} onClick={() => jumpToDay(14)}>
        {t("shell.jumpDay", { day: 14 })}
      </Button>
    </div>
  );
}

export function DeviceControls() {
  const { t } = useT();
  const device = useDemo((s) => s.ui.device);
  const landscape = useDemo((s) => s.ui.landscape);
  const opts = [
    { v: "phone" as const, icon: Smartphone, label: t("shell.phone") },
    { v: "tablet" as const, icon: Tablet, label: t("shell.tablet") },
    { v: "desktop" as const, icon: Monitor, label: t("shell.desktop") },
  ];
  return (
    <div className="flex items-center gap-1">
      <div role="radiogroup" aria-label={t("shell.device")} className="inline-flex rounded-xl bg-surface-2 p-1">
        {opts.map((o) => (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={device === o.v}
            title={o.label}
            onClick={() => setUi({ device: o.v })}
            className={cn("inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold", device === o.v ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink")}
          >
            <o.icon aria-hidden size={18} />
            <span className="hidden 2xl:inline">{o.label}</span>
            <span className="sr-only 2xl:hidden">{o.label}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setUi({ landscape: !landscape })}
        disabled={device === "desktop"}
        aria-pressed={landscape}
        title={t("shell.rotate")}
        aria-label={t("shell.rotate")}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-40"
      >
        {landscape ? <RotateCcw aria-hidden size={18} /> : <RotateCw aria-hidden size={18} />}
      </button>
    </div>
  );
}

export function SplitControls() {
  const { t } = useT();
  const split = useDemo((s) => s.ui.split);
  const spot = useSpot<HTMLButtonElement>("shell.split");
  return (
    <div className="flex items-center gap-1.5">
      <button
        ref={spot.ref}
        type="button"
        aria-pressed={split.on}
        onClick={() => setUi({ split: { ...split, on: !split.on } })}
        className={cn("inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold", split.on ? "bg-brand-soft text-brand" : "text-muted hover:bg-surface-2 hover:text-ink", spot.className)}
      >
        <Columns2 aria-hidden size={18} />
        <span className="hidden 2xl:inline">{t("shell.split")}</span>
        <span className="sr-only 2xl:hidden">{t("shell.split")}</span>
      </button>
      {split.on && (
        <Select aria-label={t("shell.splitRight")} value={split.right.role} onChange={(e) => setUi({ split: { on: true, right: { role: e.target.value as Role, screen: "" } } })} className="min-h-10 w-auto py-1 text-sm">
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {t("shell.splitRight")}: {t(`roles.${r}.short`)}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}

export function StoryToggle({ full, short }: { full?: boolean; short?: boolean }) {
  const { t } = useT();
  const navigate = useRoleNav();
  const active = useDemo((s) => s.story.active);
  return active ? (
    <Button size="sm" variant="secondary" icon={X} onClick={exitStory} className={full ? "w-full" : undefined}>
      {t("shell.exitStory")}
    </Button>
  ) : (
    <Button size="sm" variant="soft" icon={BookOpen} onClick={() => startStory(navigate)} className={full ? "w-full" : undefined} title={t("shell.startStory")}>
      {short ? t("shell.story") : t("shell.startStory")}
    </Button>
  );
}

export function ResetButton({ full, iconOnly }: { full?: boolean; iconOnly?: boolean }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      {iconOnly ? (
        <IconButton icon={RotateCcw} label={t("shell.reset")} size="sm" onClick={() => setOpen(true)} />
      ) : (
        <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setOpen(true)} className={full ? "w-full justify-start" : undefined}>
          {t("shell.reset")}
        </Button>
      )}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t("shell.reset")}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button
              variant="danger"
              icon={RotateCcw}
              onClick={() => {
                resetDemo();
                setOpen(false);
              }}
            >
              {t("shell.reset")}
            </Button>
          </>
        }
      >
        <p>{t("shell.resetConfirm")}</p>
      </Sheet>
    </>
  );
}

export function HowItWorksLink({ onClick, iconOnly }: { onClick?: () => void; iconOnly?: boolean }) {
  const { t } = useT();
  return (
    <Link
      href="/how-it-works/"
      onClick={onClick}
      title={t("shell.howItWorks")}
      aria-label={iconOnly ? t("shell.howItWorks") : undefined}
      className={cn("inline-flex min-h-10 items-center gap-1.5 rounded-lg text-sm font-semibold text-muted hover:bg-surface-2 hover:text-ink", iconOnly ? "w-10 justify-center" : "px-2.5")}
    >
      <CircleQuestionMark aria-hidden size={18} />
      {!iconOnly && t("shell.howItWorks")}
    </Link>
  );
}

/** Shown in the bar when the on-screen patient's phone rings and the call is not visible. */
export function RingingChip({ visible }: { visible: boolean }) {
  const { t, person } = useT();
  const go = useRoleNav();
  const ringing = useDemo((s) => (s.data?.phone.ringingCallId ? s.data.calls.find((c) => c.id === s.data!.phone.ringingCallId) : undefined));
  const active = useDemo((s) => (s.data?.phone.activeCallId ? s.data.calls.find((c) => c.id === s.data!.phone.activeCallId) : undefined));
  const call = ringing ?? active;
  if (!call || visible) return null;
  return (
    <button
      type="button"
      onClick={() => go("patient")}
      className="inline-flex min-h-10 items-center gap-2 rounded-full bg-ok px-3 text-sm font-bold text-white dark:text-[#06200f]"
    >
      <Phone aria-hidden size={16} className={ringing ? "ring-shake" : undefined} />
      <span className="truncate">{ringing ? t("shell.ringing", { patient: person(call.patientId) }) : t("shell.inCall", { patient: person(call.patientId) })}</span>
      <span className="inline-flex items-center gap-0.5 underline">
        {t("shell.goToCall")}
        <ChevronRight aria-hidden size={14} />
      </span>
    </button>
  );
}
