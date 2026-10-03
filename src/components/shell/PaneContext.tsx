"use client";

import { createContext, useContext } from "react";
import type { Role } from "@/domain/types";

export interface PaneInfo {
  role: Role;
  screen: string;
  primary: boolean;
  /** Go to another screen of this role (or another role) inside this pane. */
  go: (screen: string, role?: Role) => void;
  href: (screen: string, role?: Role) => string;
  /** Element that sheets and dialogs of this pane render into. */
  overlay: HTMLElement | null;
  scrollToTop: () => void;
}

export const PaneContext = createContext<PaneInfo | null>(null);

export function usePane(): PaneInfo {
  const ctx = useContext(PaneContext);
  if (!ctx) throw new Error("usePane must be used inside a role pane");
  return ctx;
}

export function useOptionalPane(): PaneInfo | null {
  return useContext(PaneContext);
}
