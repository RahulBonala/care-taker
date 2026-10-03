"use client";

import { useEffect, useRef } from "react";
import { useDemo } from "@/store/store";

/**
 * Story mode points at a control by id. Spread the result onto the element:
 * <Button {...useSpot("desk.enrol.submit")} />
 */
export function useSpot<T extends HTMLElement = HTMLElement>(id: string) {
  const on = useDemo((s) => s.ui.highlight === id);
  const ref = useRef<T | null>(null);
  useEffect(() => {
    if (on && ref.current) ref.current.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [on]);
  return { ref, "data-spot": id, className: on ? "spot-on" : undefined } as const;
}

export function spotClass(on: boolean, extra?: string) {
  return [on ? "spot-on" : "", extra ?? ""].join(" ").trim();
}
