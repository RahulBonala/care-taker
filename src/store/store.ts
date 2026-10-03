"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { DemoData } from "@/domain/data";
import type { Lang, Role } from "@/domain/types";

export type Device = "phone" | "tablet" | "desktop";
export type PhoneStyle = "keypad" | "smartphone";

export interface PaneTarget {
  role: Role;
  screen: string;
}

export interface UiState {
  language: Lang;
  /** The sample person you are acting as, per role. */
  actingAs: Record<Role, string>;
  /** The patient whose phone the call simulator shows and whose day the clock counts. */
  focusPatientId: string;
  device: Device;
  landscape: boolean;
  split: { on: boolean; right: PaneTarget };
  feedOpen: boolean;
  feedScope: "all" | "focus";
  highlight?: string;
  selection: {
    nursePatientId?: string;
    flagId?: string;
    visitId?: string;
    doctorPatientId?: string;
    reportId?: string;
  };
  familySignedIn: Record<string, boolean>;
  /** Per-patient override of the simulated handset (defaults to the patient's phone type). */
  phoneStyle: Record<string, PhoneStyle>;
  speak: boolean;
  /** Play the call in the patient's language (default) or in the demo language. */
  callLanguage: "patient" | "ui";
  demo: { slowNetwork: boolean; forceErrors: boolean; offline: boolean };
}

export interface DemoState {
  data: DemoData | null;
  now: number;
  ui: UiState;
  mode: "explore" | "story";
  story: { active: boolean; step: number };
  /** Transient: not persisted. */
  controlsOpen: boolean;
}

export const STORE_VERSION = 7;

export const DEFAULT_UI: UiState = {
  language: "en",
  actingAs: {
    patient: "p_lakshmi",
    family: "f_ravi",
    nurse: "n_mary",
    caregiver: "c_suresh",
    doctor: "d_anjali",
    desk: "k_neha",
    admin: "a_deepak",
  },
  focusPatientId: "p_lakshmi",
  device: "phone",
  landscape: false,
  split: { on: false, right: { role: "family", screen: "" } },
  feedOpen: true,
  feedScope: "all",
  selection: {},
  familySignedIn: {},
  phoneStyle: {},
  speak: false,
  callLanguage: "patient",
  demo: { slowNetwork: false, forceErrors: false, offline: false },
};

export const useDemo = create<DemoState>()(
  persist(
    (): DemoState => ({
      data: null,
      now: 0,
      ui: DEFAULT_UI,
      mode: "explore",
      story: { active: false, step: 0 },
      controlsOpen: false,
    }),
    {
      name: "care-taker-demo",
      version: STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ data: s.data, now: s.now, ui: s.ui, mode: s.mode, story: s.story }),
      // Any older saved demo is discarded; the app then loads fresh sample data.
      migrate: () => ({ data: null, now: 0, ui: DEFAULT_UI, mode: "explore", story: { active: false, step: 0 } }) as unknown as DemoState,
      merge: (persisted, current): DemoState => {
        const p = (persisted ?? {}) as Partial<DemoState>;
        return { ...current, ...p, ui: { ...DEFAULT_UI, ...(p.ui ?? {}), demo: { ...DEFAULT_UI.demo, ...(p.ui?.demo ?? {}) } } };
      },
    },
  ),
);

/** Read the data after the app has loaded (the shell renders nothing before that). */
export function useData(): DemoData {
  return useDemo((s) => s.data)!;
}

export function useNow(): number {
  return useDemo((s) => s.now);
}

export function useUi<T>(pick: (ui: UiState) => T): T {
  return useDemo((s) => pick(s.ui));
}

export function setUi(patch: Partial<UiState> | ((ui: UiState) => Partial<UiState>)) {
  useDemo.setState((s) => ({ ui: { ...s.ui, ...(typeof patch === "function" ? patch(s.ui) : patch) } }));
}
