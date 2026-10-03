"use client";

import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

export type NodeKind = "step" | "say" | "log" | "flag" | "urgent" | "reply";

export interface DiagramNode {
  id: string;
  label: string;
  kind: NodeKind;
  onOpen: () => void;
}

/** A row is a chain of nodes joined by arrows. Rows after the first hang off a trunk on the left. */
export interface DiagramRow {
  nodes: DiagramNode[];
}

const FONT = "600 14px ui-sans-serif, system-ui, sans-serif";
const LINE = 18;
const PAD_X = 12;
const PAD_Y = 10;
const GAP = 34;
const ROW_GAP = 22;

const STYLE: Record<NodeKind, { fill: string; stroke: string; text: string; radius: number }> = {
  step: { fill: "var(--surface)", stroke: "var(--line)", text: "var(--ink)", radius: 12 },
  say: { fill: "var(--info-soft)", stroke: "var(--info)", text: "var(--ink)", radius: 12 },
  log: { fill: "var(--ok-soft)", stroke: "var(--ok)", text: "var(--ink)", radius: 12 },
  flag: { fill: "var(--warn-soft)", stroke: "var(--warn)", text: "var(--ink)", radius: 12 },
  urgent: { fill: "var(--danger-soft)", stroke: "var(--danger)", text: "var(--ink)", radius: 12 },
  reply: { fill: "var(--surface-2)", stroke: "var(--surface-2)", text: "var(--ink)", radius: 22 },
};

let ctx: CanvasRenderingContext2D | null = null;
function measure(text: string): number {
  if (typeof document === "undefined") return text.length * 7.5;
  if (!ctx) ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return text.length * 7.5;
  ctx.font = FONT;
  return ctx.measureText(text).width;
}

function wrap(text: string, max: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (measure(next) <= max || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

interface Placed {
  node: DiagramNode;
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
}

function layout(rows: DiagramRow[], width: number) {
  const placed: Placed[] = [];
  const paths: string[] = [];
  const trunk: Array<{ y: number }> = [];
  const nodeW = Math.min(200, Math.max(140, (width - 32 - 3 * GAP) / 4));
  let y = 4;
  rows.forEach((row, ri) => {
    const indent = ri === 0 ? 4 : 28;
    const avail = width - indent - 4;
    const cols = Math.max(1, Math.min(row.nodes.length, Math.floor((avail + GAP) / (nodeW + GAP))));
    const w = cols === 1 ? Math.min(avail, 320) : nodeW;
    const sized = row.nodes.map((n) => {
      const lines = wrap(n.label, w - PAD_X * 2);
      return { n, lines, h: lines.length * LINE + PAD_Y * 2 };
    });
    let i = 0;
    let firstY = y;
    let prev: Placed | null = null;
    while (i < sized.length) {
      const line = sized.slice(i, i + cols);
      const lineH = Math.max(...line.map((s) => s.h));
      line.forEach((s, j) => {
        const p: Placed = { node: s.n, x: indent + j * (w + GAP), y: y + (lineH - s.h) / 2, w, h: s.h, lines: s.lines };
        if (prev) {
          if (j === 0) {
            // Wrap to the next line: down from the previous node, back to the left, into this one.
            const fromX = prev.x + prev.w / 2;
            const midY = y - ROW_GAP / 2 - 2;
            paths.push(`M${fromX},${prev.y + prev.h} V${midY} H${p.x + p.w / 2} V${p.y - 2}`);
          } else {
            paths.push(`M${prev.x + prev.w},${prev.y + prev.h / 2} H${p.x - 2}`);
          }
        }
        placed.push(p);
        prev = p;
      });
      if (i === 0) firstY = y + lineH / 2;
      y += lineH + ROW_GAP;
      i += cols;
    }
    if (ri > 0) trunk.push({ y: firstY });
    y += 6;
  });
  const trunkPaths = trunk.length ? [`M12,${placed[0] ? placed[0].y + placed[0].h : 0} V${trunk[trunk.length - 1].y}`, ...trunk.map((t) => `M12,${t.y} H26`)] : [];
  return { placed, paths, trunkPaths, height: y };
}

/** Clickable flow diagram in plain SVG; lays itself out for the width it has. */
export function Diagram({ rows, label, openLabel }: { rows: DiagramRow[]; label: string; openLabel: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const l = useMemo(() => (w ? layout(rows, w) : null), [rows, w]);
  const onKey = (e: KeyboardEvent, open: () => void) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  };
  return (
    <div ref={box} className="w-full">
      {l && (
        <svg width={w} height={l.height} role="group" aria-label={label} className="block overflow-visible">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="var(--muted)" />
            </marker>
          </defs>
          {l.trunkPaths.map((d, i) => (
            <path key={`t${i}`} d={d} fill="none" stroke="var(--muted)" strokeWidth="1.5" markerEnd={i > 0 ? "url(#arrow)" : undefined} />
          ))}
          {l.paths.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="var(--muted)" strokeWidth="1.5" markerEnd="url(#arrow)" />
          ))}
          {l.placed.map((p) => {
            const st = STYLE[p.node.kind];
            return (
              <g
                key={p.node.id}
                role="button"
                tabIndex={0}
                aria-label={`${p.node.label}. ${openLabel}`}
                onClick={p.node.onOpen}
                onKeyDown={(e) => onKey(e, p.node.onOpen)}
                className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-[var(--info)] [&:focus-visible>rect]:[stroke-width:3] [&:hover>rect]:[stroke-width:2.5]"
              >
                <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={st.radius} fill={st.fill} stroke={st.stroke} strokeWidth="1.5" />
                <text x={p.x + PAD_X} y={p.y + PAD_Y + 13} fontSize="14" fontWeight={p.node.kind === "reply" ? 700 : 600} fill={st.text}>
                  {p.lines.map((line, i) => (
                    <tspan key={i} x={p.x + PAD_X} dy={i === 0 ? 0 : LINE}>
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
