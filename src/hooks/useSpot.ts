"use client";

import { useEffect, useState } from "react";
import { useDemo } from "@/store/store";

/**
 * Story mode points at a control by id. Spread the result onto the element:
 * <Button {...useSpot("desk.enrol.submit")} />
 */
export function useSpot<T extends HTMLElement = HTMLElement>(id: string) {
  const on = useDemo((s) => Boolean(s.ui.highlight && s.ui.highlight.split(",").includes(id)));
  // A callback ref (the state setter) so the element is known without reading a ref during render.
  const [el, ref] = useState<T | null>(null);
  useEffect(() => {
    if (on && el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [on, el]);
  return { ref, "data-spot": id, className: on ? "spot-on" : undefined } as const;
}

export function spotClass(on: boolean, extra?: string) {
  return [on ? "spot-on" : "", extra ?? ""].join(" ").trim();
}
