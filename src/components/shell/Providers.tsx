"use client";

import { useEffect, useState, type ReactNode } from "react";
import { APP_NAME } from "@/config/brand";
import { LANGUAGES } from "@/i18n";
import { resetDemo } from "@/store/actions";
import { useDemo } from "@/store/store";
import { BrandMark } from "./BrandMark";

function isUsable(): boolean {
  const s = useDemo.getState();
  return Boolean(s.data && Array.isArray(s.data.patients) && s.data.patients.length && s.now > 0);
}

/** Loads the saved demo (or fresh sample data) before anything renders. */
export function Providers({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const lang = useDemo((s) => s.ui.language);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        await useDemo.persist.rehydrate();
      } catch {
        // A damaged saved demo is replaced with fresh sample data below.
      }
      if (!isUsable()) resetDemo();
      if (alive) setReady(true);
    };
    void load();
    const onStorage = (e: StorageEvent) => {
      if (e.key === useDemo.persist.getOptions().name) void useDemo.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      alive = false;
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = LANGUAGES[lang].code;
  }, [lang]);

  if (!ready) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-6 bg-bg" role="status" aria-label={APP_NAME}>
        <BrandMark />
        <div className="w-56 space-y-2">
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-3/4" />
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
