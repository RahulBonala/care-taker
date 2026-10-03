"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import type { Role } from "@/domain/types";
import { screenPath } from "@/components/roles/registry";

export function useRoleNav() {
  const router = useRouter();
  return useCallback((role: Role, screen = "") => router.push(screenPath(role, screen)), [router]);
}
