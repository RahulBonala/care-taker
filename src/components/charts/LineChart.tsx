"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useT } from "@/i18n/useT";

export interface ChartSeries {
  name: string;
  color: string;
  values: Array<number | null>;
}

const H = 180;
const M = { top: 14, right: 48, bottom: 28, left: 40 };

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) return [min - 1, min, min + 1];
  const span = max - min;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? step0;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Number(v.toFixed(2)));
  return out;
}

/**
 * Small line chart in plain SVG: 2px lines, ringed markers, hairline grid,
 * end labels, crosshair tooltip, and a table view. One y-axis only.
 */
export function LineChart({ title, labels, series, unit }: { title: string; labels: string[]; series: ChartSeries[]; unit: string }) {
  const { t } = useT();
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const all = series.flatMap((s) => s.values).filter((v): v is number => v != null);
  const ticks = all.length ? niceTicks(Math.min(...all), Math.max(...all)) : [0, 1];
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const innerW = Math.max(10, w - M.left - M.right);
  const innerH = H - M.top - M.bottom;
  const n = labels.length;
  const x = (i: number) => M.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => M.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 70))));
  const slotW = Math.max(20, innerW / Math.max(1, n - 1));

  return (
    <figure className="space-y-2">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-bold">
          {title} <span className="font-normal text-muted">({unit})</span>
        </span>
        {series.length > 1 && (
          <span className="flex flex-wrap gap-3 text-sm text-muted">
            {series.map((s) => (
              <span key={s.name} className="inline-flex items-center gap-1.5">
                <svg aria-hidden width="18" height="8">
                  <line x1="1" y1="4" x2="17" y2="4" stroke={s.color} strokeWidth="2" strokeLinecap="round" />
                </svg>
                {s.name}
              </span>
            ))}
          </span>
        )}
      </figcaption>
      <div ref={box} className="relative w-full" style={{ height: H }}>
        {w > 0 && (
          <svg width={w} height={H} role="img" aria-label={title} className="block">
            {ticks.map((tv) => (
              <g key={tv}>
                <line x1={M.left} x2={M.left + innerW} y1={y(tv)} y2={y(tv)} stroke="var(--grid)" strokeWidth="1" />
                <text x={M.left - 6} y={y(tv)} textAnchor="end" dominantBaseline="middle" fontSize="12" fill="var(--muted)">
                  {tv}
                </text>
              </g>
            ))}
            {labels.map((l, i) =>
              i % every === 0 || i === n - 1 ? (
                <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="12" fill="var(--muted)">
                  {l}
                </text>
              ) : null,
            )}
            {hover != null && <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + innerH} stroke="var(--muted)" strokeWidth="1" />}
            {series.map((s) => {
              const pts = s.values.map((v, i) => (v == null ? null : ([x(i), y(v)] as const)));
              let d = "";
              pts.forEach((p, i) => {
                if (!p) return;
                d += `${d && pts[i - 1] ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`;
              });
              const lastIdx = s.values.map((v, i) => (v == null ? -1 : i)).filter((i) => i >= 0).at(-1);
              return (
                <g key={s.name}>
                  <path d={d} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                  {pts.map((p, i) => (p ? <circle key={i} cx={p[0]} cy={p[1]} r={hover === i || i === lastIdx ? 5 : 4} fill={s.color} stroke="var(--surface)" strokeWidth="2" /> : null))}
                  {lastIdx != null && (
                    <text x={x(lastIdx) + 10} y={y(s.values[lastIdx]!)} dominantBaseline="middle" fontSize="13" fontWeight="600" fill="var(--ink)">
                      {s.values[lastIdx]}
                    </text>
                  )}
                </g>
              );
            })}
            {labels.map((_, i) => (
              <rect
                key={i}
                x={x(i) - slotW / 2}
                y={M.top}
                width={slotW}
                height={innerH}
                fill="transparent"
                tabIndex={0}
                aria-label={`${labels[i]}: ${series.map((s) => `${s.name} ${s.values[i] ?? "–"}`).join(", ")}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
              />
            ))}
          </svg>
        )}
        {hover != null && w > 0 && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm shadow-lg"
            style={{ left: Math.min(Math.max(0, x(hover) - 70), Math.max(0, w - 150)), minWidth: 140 }}
          >
            <p className="font-semibold">{labels[hover]}</p>
            {series.map((s) => (
              <p key={s.name} className="flex items-center gap-1.5">
                <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
                {s.name}: <span className="font-semibold tabular-nums">{s.values[hover] ?? "–"}</span>
              </p>
            ))}
          </div>
        )}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer py-1 font-semibold text-muted">{t("doctor.showTable")}</summary>
        <table className="mt-1 w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              <th className="py-1 pr-2 font-semibold">{t("common.date")}</th>
              {series.map((s) => (
                <th key={s.name} className="py-1 pr-2 font-semibold">
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((l, i) => (
              <tr key={i} className="border-b border-line">
                <td className="py-1 pr-2">{l}</td>
                {series.map((s) => (
                  <td key={s.name} className="py-1 pr-2 tabular-nums">
                    {s.values[i] ?? "–"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
