/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * StepGauge — CIBIL-style 0–100 semicircle split into one segment per step
 * (a divider between steps). Segments run red → green along the arc; the part
 * already covered is drawn solid, the rest faded, with a marker at the value.
 */
import React from "react";
import { progressColor } from "../../services/projectsService";

const CX = 130, CY = 132, R = 100, SW = 22;
const angleFor = (pct: number) => Math.PI * (1 - Math.max(0, Math.min(100, pct)) / 100);
const pt = (a: number, r = R) => [CX + r * Math.cos(a), CY - r * Math.sin(a)];

function arc(from: number, to: number) {
  const [x1, y1] = pt(angleFor(from));
  const [x2, y2] = pt(angleFor(to));
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

export default function StepGauge({ value, steps, size = 280, compact, caption }: {
  /** 0–100 */
  value: number;
  /** Number of steps — one arc segment each. */
  steps: number;
  size?: number;
  /** Small list-card version: no labels, no marker. */
  compact?: boolean;
  caption?: string;
}) {
  const n = Math.max(1, steps);
  const gap = n > 1 ? Math.min(1.2, 30 / n) : 0; // half-gap either side of a divider, in % units
  const segs = Array.from({ length: n }, (_, i) => {
    const from = (i / n) * 100, to = ((i + 1) / n) * 100;
    return { i, from: from + (i ? gap : 0), to: to - (i < n - 1 ? gap : 0), color: progressColor((from + to) / 2) };
  });
  const [mx, my] = pt(angleFor(value));
  const tone = progressColor(value);

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <svg viewBox="0 0 260 150" width={size} height={size * 150 / 260} role="img" aria-label={`${value}% complete`}>
        {segs.map(s => (
          <path key={`bg${s.i}`} d={arc(s.from, s.to)} fill="none" stroke={s.color} strokeOpacity={0.18} strokeWidth={SW}
            strokeLinecap={s.i === 0 || s.i === n - 1 ? "round" : "butt"} />
        ))}
        {segs.map(s => value > s.from && (
          <path key={`fg${s.i}`} d={arc(s.from, Math.min(s.to, value))} fill="none" stroke={s.color} strokeWidth={SW}
            strokeLinecap={s.i === 0 || s.i === n - 1 ? "round" : "butt"} style={{ transition: "all 600ms ease" }} />
        ))}
        {!compact && (
          <>
            {segs.map(s => {
              const [tx, ty] = pt(angleFor((s.from + s.to) / 2), R + SW / 2 + 9);
              return <text key={`l${s.i}`} x={tx} y={ty + 3} textAnchor="middle" fontSize="9" fontWeight={700} fill="#94a3b8">{s.i + 1}</text>;
            })}
            <text x={CX - R} y={CY + 16} textAnchor="middle" fontSize="9" fontWeight={600} fill="#94a3b8">0</text>
            <text x={CX + R} y={CY + 16} textAnchor="middle" fontSize="9" fontWeight={600} fill="#94a3b8">100</text>
            <circle cx={mx} cy={my} r={SW / 2 + 3} fill="#fff" stroke={tone} strokeWidth={4}
              style={{ transition: "all 700ms cubic-bezier(.2,.8,.2,1)" }} />
          </>
        )}
        <text x={CX} y={compact ? CY - 8 : CY - 12} textAnchor="middle" fontSize={compact ? 44 : 34} fontWeight={800} fill={tone}
          style={{ fontVariantNumeric: "tabular-nums" }}>
          {value}<tspan fontSize={compact ? 22 : 16} dx="2">%</tspan>
        </text>
      </svg>
      {caption && !compact && <div className="-mt-1 text-center text-xs font-semibold text-slate-500">{caption}</div>}
    </div>
  );
}
