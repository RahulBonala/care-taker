"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { APP_NAME } from "@/config/brand";
import type { Device } from "@/store/store";

const SCREEN: Record<Device, [number, number]> = {
  phone: [390, 844],
  tablet: [820, 1180],
  desktop: [1440, 900],
};

/** Draws a phone, tablet or browser window at its real size, scaled down to fit. */
export function DeviceFrame({ device, landscape, path, children }: { device: Device; landscape: boolean; path: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  let [w, h] = SCREEN[device];
  if (landscape && device !== "desktop") [w, h] = [h, w];
  const isDesk = device === "desktop";
  const bezel = isDesk ? 1 : device === "phone" ? 12 : 16;
  const top = isDesk ? 38 : bezel;
  const outerW = w + bezel * 2;
  const outerH = h + top + bezel;
  const scale = size.w ? Math.min(1, (size.w - 8) / outerW, (size.h - 8) / outerH) : 0;

  return (
    <div ref={box} className="relative flex h-full w-full min-w-0 items-center justify-center overflow-hidden">
      {scale > 0 && (
        <div style={{ width: outerW * scale, height: outerH * scale }} className="relative shrink-0">
          <div
            style={{
              width: outerW,
              height: outerH,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              paddingTop: top,
              paddingLeft: bezel,
              paddingRight: bezel,
              paddingBottom: bezel,
              borderRadius: isDesk ? 12 : device === "phone" ? 42 : 30,
            }}
            className={isDesk ? "absolute top-0 left-0 border border-line bg-surface-2 shadow-2xl" : "absolute top-0 left-0 bg-frame shadow-2xl"}
            data-device={device}
          >
            {isDesk && (
              <div className="absolute top-0 right-0 left-0 flex h-[38px] items-center gap-2 px-3" aria-hidden>
                <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
                <span className="h-3 w-3 rounded-full bg-[#28c840]" />
                <span className="ml-3 truncate rounded-md bg-surface px-3 py-0.5 text-[13px] text-muted">
                  {APP_NAME} · {path}
                </span>
              </div>
            )}
            <div className="h-full w-full overflow-hidden bg-bg" style={{ borderRadius: isDesk ? "0 0 11px 11px" : device === "phone" ? 30 : 18 }}>
              {children}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
