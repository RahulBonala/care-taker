"use client";

import type { ReactNode } from "react";
import { RoleScreen } from "@/components/roles/RoleScreen";
import { screenPath } from "@/components/roles/registry";
import type { Role } from "@/domain/types";
import { usePreviewCapable, useSplitCapable } from "@/hooks/useMedia";
import { useDemo } from "@/store/store";
import { DeviceFrame } from "./DeviceFrame";
import { Pane } from "./Pane";

/** The role panes: one, or two side by side; framed as a device on a large screen. */
export function Stage({ role, screen, children }: { role: Role; screen: string; children: ReactNode }) {
  const preview = usePreviewCapable();
  const splitCapable = useSplitCapable();
  const split = useDemo((s) => s.ui.split);
  const device = useDemo((s) => s.ui.device);
  const landscape = useDemo((s) => s.ui.landscape);

  const panes: Array<{ key: string; role: Role; screen: string; node: ReactNode }> = [
    {
      key: "left",
      role,
      screen,
      node: (
        <Pane role={role} screen={screen} primary>
          {children}
        </Pane>
      ),
    },
  ];
  if (split.on && splitCapable) {
    panes.push({
      key: "right",
      role: split.right.role,
      screen: split.right.screen,
      node: (
        <Pane role={split.right.role} screen={split.right.screen} primary={false}>
          <RoleScreen role={split.right.role} screen={split.right.screen} />
        </Pane>
      ),
    });
  }

  if (!preview) {
    return (
      <div className="flex h-full min-h-0">
        {panes.map((p, i) => (
          <div key={p.key} className={i ? "h-full min-w-0 flex-1 border-l-4 border-stage" : "h-full min-w-0 flex-1"}>
            {p.node}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 gap-4 p-3">
      {panes.map((p) => (
        <div key={p.key} className="h-full min-w-0 flex-1">
          <DeviceFrame device={device} landscape={landscape} path={screenPath(p.role, p.screen)}>
            {p.node}
          </DeviceFrame>
        </div>
      ))}
    </div>
  );
}
