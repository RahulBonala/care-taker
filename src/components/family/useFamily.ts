"use client";

import { useActingAs, useRepos } from "@/data/useRepos";
import { useDemo } from "@/store/store";

/** The signed-in family member and their patient (the only patient they can see). */
export function useFamily() {
  const repos = useRepos("family");
  const familyId = useActingAs("family");
  const f = repos.family.get(familyId);
  const p = repos.patients.get(f?.patientId);
  const now = useDemo((s) => s.now);
  return { repos, f, p, now, familyId };
}

export function cap(s: string): string {
  return s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s;
}
