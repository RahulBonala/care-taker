"use client";

import { ArrowLeft, MoreHorizontal, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FamilySignIn } from "@/components/family/FamilySignIn";
import { findScreen, ROLE_ICONS, ROLE_SCREENS, screenPath, type ScreenDef } from "@/components/roles/registry";
import { ErrorState, OfflineNotice, ScreenSkeleton, Select, Sheet } from "@/components/ui";
import type { Role } from "@/domain/types";
import { ROLES } from "@/domain/types";
import { useOnline } from "@/hooks/useMedia";
import { useSpot } from "@/hooks/useSpot";
import { useT } from "@/i18n/useT";
import { setUi, useDemo } from "@/store/store";
import { PaneContext, usePane, type PaneInfo } from "./PaneContext";

/** One role, rendered at the width it is given. Owns its navigation and its overlays. */
export function Pane({ role, screen, primary, children }: { role: Role; screen: string; primary: boolean; children: ReactNode }) {
  const router = useRouter();
  const [overlay, setOverlay] = useState<HTMLElement | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const href = useCallback((s: string, r?: Role) => screenPath(r ?? role, s), [role]);
  const go = useCallback(
    (s: string, r?: Role) => {
      if (primary) router.push(screenPath(r ?? role, s));
      else setUi((ui) => ({ split: { ...ui.split, right: { role: r ?? role, screen: s } } }));
    },
    [primary, role, router],
  );
  const scrollToTop = useCallback(() => scroller.current?.scrollTo({ top: 0 }), []);

  useEffect(() => {
    scrollToTop();
  }, [role, screen, scrollToTop]);

  const info = useMemo<PaneInfo>(() => ({ role, screen, primary, go, href, overlay, scrollToTop }), [role, screen, primary, go, href, overlay, scrollToTop]);

  return (
    <PaneContext.Provider value={info}>
      <div className="pane relative h-full w-full overflow-hidden bg-bg text-ink" data-role={role}>
        <RoleLayout scroller={scroller}>{children}</RoleLayout>
        <div ref={setOverlay} className="pointer-events-none absolute inset-0 z-40 [&>*]:pointer-events-auto" />
      </div>
    </PaneContext.Provider>
  );
}

function RoleLayout({ children, scroller }: { children: ReactNode; scroller: React.RefObject<HTMLDivElement | null> }) {
  const { role } = usePane();
  const items = ROLE_SCREENS[role].filter((s) => s.inNav);
  return (
    <div className="flex h-full min-h-0 flex-col @tab:flex-row">
      <SideNav items={items} variant="rail" />
      <SideNav items={items} variant="sidebar" />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <PaneHeader />
        <div ref={scroller} id="pane-scroll" className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
          <PaneGate>{children}</PaneGate>
        </div>
        <BottomNav items={items} />
      </div>
    </div>
  );
}

function NavLink({ item, className, children, onClick }: { item: ScreenDef; className: string; children: ReactNode; onClick?: () => void }) {
  const { primary, href, go, role, screen } = usePane();
  const { ref: spotRef, className: spotCls } = useSpot<HTMLElement>(`nav.${role}.${item.id || "home"}`);
  const current = findScreen(role, screen);
  const active = item.id === screen || current.parent === item.id;
  const cls = spotCls ? `${className} ${spotCls}` : className;
  if (primary) {
    return (
      <Link ref={spotRef} href={href(item.id)} onClick={onClick} aria-current={active ? "page" : undefined} className={cls} data-active={active}>
        {children}
      </Link>
    );
  }
  return (
    <button
      ref={spotRef}
      type="button"
      onClick={() => {
        go(item.id);
        onClick?.();
      }}
      aria-current={active ? "page" : undefined}
      className={cls}
      data-active={active}
    >
      {children}
    </button>
  );
}

function SideNav({ items, variant }: { items: ScreenDef[]; variant: "rail" | "sidebar" }) {
  const { t, person } = useT();
  const { role } = usePane();
  const actingAs = useDemo((s) => s.ui.actingAs[role]);
  const RoleIcon = ROLE_ICONS[role];
  if (variant === "rail") {
    return (
      <nav aria-label={t(`roles.${role}.name`)} className="hidden w-[88px] shrink-0 flex-col gap-1 border-r border-line bg-surface px-2 py-3 @tab:flex @desk:hidden">
        {items.map((item) => (
          <NavLink key={item.id} item={item} className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl px-1 text-center text-[13px] leading-tight font-semibold text-muted hover:bg-surface-2 data-[active=true]:bg-brand-soft data-[active=true]:text-brand">
            <item.icon aria-hidden size={22} />
            <span className="line-clamp-2">{t(item.label)}</span>
          </NavLink>
        ))}
      </nav>
    );
  }
  return (
    <nav aria-label={t(`roles.${role}.name`)} className="hidden w-64 shrink-0 flex-col border-r border-line bg-surface @desk:flex">
      <div className="flex items-center gap-3 border-b border-line px-4 py-4">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <RoleIcon aria-hidden size={22} />
        </span>
        <div className="min-w-0">
          <p className="truncate font-bold">{t(`roles.${role}.name`)}</p>
          <p className="truncate text-sm text-muted">{person(actingAs)}</p>
        </div>
      </div>
      <div className="flex flex-col gap-1 p-3">
        {items.map((item) => (
          <NavLink key={item.id} item={item} className="flex min-h-12 items-center gap-3 rounded-xl px-3 font-semibold text-muted hover:bg-surface-2 data-[active=true]:bg-brand-soft data-[active=true]:text-brand">
            <item.icon aria-hidden size={20} />
            <span className="truncate">{t(item.label)}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function BottomNav({ items }: { items: ScreenDef[] }) {
  const { t } = useT();
  const { role, screen } = usePane();
  const [more, setMore] = useState(false);
  const overflow = items.length > 5;
  const shown = overflow ? items.slice(0, 4) : items;
  const rest = overflow ? items.slice(4) : [];
  const current = findScreen(role, screen);
  const restActive = rest.some((i) => i.id === screen || current.parent === i.id);
  const cls = "flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[13px] leading-tight font-semibold text-muted data-[active=true]:text-brand";
  return (
    <nav aria-label={t(`roles.${role}.name`)} className="flex shrink-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] @tab:hidden">
      {shown.map((item) => (
        <NavLink key={item.id} item={item} className={cls}>
          <item.icon aria-hidden size={22} />
          <span className="w-full truncate text-center">{t(item.label)}</span>
        </NavLink>
      ))}
      {overflow && (
        <>
          <button type="button" className={cls} data-active={restActive} onClick={() => setMore(true)} aria-haspopup="dialog">
            <MoreHorizontal aria-hidden size={22} />
            <span className="w-full truncate text-center">{t("common.more")}</span>
          </button>
          <Sheet open={more} onClose={() => setMore(false)} title={t("common.more")}>
            <div className="flex flex-col gap-1">
              {rest.map((item) => (
                <NavLink key={item.id} item={item} onClick={() => setMore(false)} className="flex min-h-14 items-center gap-3 rounded-xl px-3 text-lg font-semibold hover:bg-surface-2 data-[active=true]:bg-brand-soft data-[active=true]:text-brand">
                  <item.icon aria-hidden size={22} />
                  {t(item.label)}
                </NavLink>
              ))}
            </div>
          </Sheet>
        </>
      )}
    </nav>
  );
}

function PaneHeader() {
  const { t, person } = useT();
  const { role, screen, primary, go } = usePane();
  const def = findScreen(role, screen);
  const actingAs = useDemo((s) => s.ui.actingAs[role]);
  const RoleIcon: LucideIcon = ROLE_ICONS[role];
  return (
    <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-2 @desk:px-4">
      {def.parent != null ? (
        <button type="button" onClick={() => go(def.parent!)} aria-label={t("common.back")} className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl hover:bg-surface-2">
          <ArrowLeft aria-hidden size={22} />
        </button>
      ) : (
        <span className="ml-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand @desk:hidden">
          <RoleIcon aria-hidden size={20} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{t(def.label)}</p>
        <p className="truncate text-[13px] text-muted @desk:hidden">
          {t(`roles.${role}.short`)} · {person(actingAs)}
        </p>
      </div>
      {!primary && (
        <Select
          aria-label={t("shell.splitRight")}
          value={role}
          onChange={(e) => setUi((ui) => ({ split: { ...ui.split, right: { role: e.target.value as Role, screen: "" } } }))}
          className="min-h-10 w-auto max-w-40 py-1 text-sm"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`roles.${r}.short`)}
            </option>
          ))}
        </Select>
      )}
    </header>
  );
}

/** Offline, sign-in, loading and error states for every screen, in one place. */
function PaneGate({ children }: { children: ReactNode }) {
  const { role, screen } = usePane();
  const online = useOnline();
  const offline = useDemo((s) => s.ui.demo.offline) || !online;
  const slow = useDemo((s) => s.ui.demo.slowNetwork);
  const forceErrors = useDemo((s) => s.ui.demo.forceErrors);
  const familyId = useDemo((s) => s.ui.actingAs.family);
  const signedIn = useDemo((s) => s.ui.familySignedIn[familyId]);
  const key = `${role}/${screen}/${familyId}`;
  const [loadedKey, setLoadedKey] = useState("");
  const [retriedKey, setRetriedKey] = useState("");

  useEffect(() => {
    if (!slow) return;
    const id = window.setTimeout(() => setLoadedKey(key), 1200);
    return () => window.clearTimeout(id);
  }, [key, slow]);

  // Admin → Demo holds the switches themselves, so it is never blocked by them.
  const demoControls = role === "admin" && screen === "demo";
  if (role === "family" && !signedIn) return <FamilySignIn />;
  if (slow && loadedKey !== key && !demoControls) return <ScreenSkeleton />;
  if (forceErrors && retriedKey !== key && !demoControls) return <ErrorState forced onRetry={() => setRetriedKey(key)} />;
  if (offline && role !== "patient" && !demoControls) {
    return (
      <>
        <OfflineNotice />
        <fieldset disabled className="m-0 min-w-0 border-0 p-0">
          {children}
        </fieldset>
      </>
    );
  }
  return <div className="min-w-0">{children}</div>;
}
