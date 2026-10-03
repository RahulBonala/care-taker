"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * A printable copy of a document, outside the demo shell and device frames.
 * Hidden on screen; it is the only thing on the page when printing.
 */
export function PrintPortal({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const el = document.createElement("div");
    el.className = "print-root";
    document.body.appendChild(el);
    setHost(el);
    return () => el.remove();
  }, []);
  return host ? createPortal(children, host) : null;
}
