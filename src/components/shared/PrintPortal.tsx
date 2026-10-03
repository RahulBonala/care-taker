"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * A printable copy of a document, outside the demo shell and device frames.
 * Hidden on screen; it is the only thing on the page when printing.
 */
export function PrintPortal({ children }: { children: ReactNode }) {
  // The app renders only in the browser (after the saved demo loads), so document is there.
  if (typeof document === "undefined") return null;
  return createPortal(<div className="print-root">{children}</div>, document.body);
}
