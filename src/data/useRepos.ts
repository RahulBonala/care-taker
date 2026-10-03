"use client";

import { useMemo } from "react";
import type { Role } from "@/domain/types";
import { useDemo } from "@/store/store";
import { useOptionalPane } from "@/components/shell/PaneContext";
import { createRepos } from "./memory";
import type { Repos } from "./repos";

/** Repos for the person this pane acts as. */
export function useRepos(roleOverride?: Role): Repos {
  const pane = useOptionalPane();
  const role = roleOverride ?? pane?.role ?? "admin";
  const userId = useDemo((s) => s.ui.actingAs[role]);
  const data = useDemo((s) => s.data)!;
  return useMemo(() => createRepos(data, { role, userId }), [data, role, userId]);
}

export function useActingAs(role?: Role): string {
  const pane = useOptionalPane();
  const r = role ?? pane?.role ?? "admin";
  return useDemo((s) => s.ui.actingAs[r]);
}
