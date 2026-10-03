"use client";

import { useSyncExternalStore } from "react";

export function useMedia(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

/** Large screen with a mouse: show the device preview frames. */
export const usePreviewCapable = () => useMedia("(min-width: 1024px) and (pointer: fine)");
/** Room for two roles side by side (desktop, tablet landscape). */
export const useSplitCapable = () => useMedia("(min-width: 1000px)");
export const useIsPhone = () => useMedia("(max-width: 639.98px)");
export const useIsDesktop = () => useMedia("(min-width: 1024px)");
export const useOnline = () =>
  useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => navigator.onLine,
    () => true,
  );
