"use client";

import type { Role } from "@/domain/types";
import { findScreen } from "./registry";

/** Renders one role screen. Used by the route pages and by the right-hand split pane. */
export function RoleScreen({ role, screen }: { role: Role; screen: string }) {
  const { Component } = findScreen(role, screen);
  return <Component />;
}
