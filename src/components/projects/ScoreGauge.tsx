/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ScoreGauge — CIBIL-style 300–900 semicircle, red → green in four levels,
 * with a needle at the current score.
 */
import React from "react";
import { SCORE_LEVELS, levelFor } from "../../services/projectsService";

const MIN = 300, MAX = 900;
const CX = 130, CY = 124, R = 100, SW = 20;

const angleFor = (score: number) => Math.PI * (1 - (Math.max(MIN, Math.min(MAX, score)) - MIN) / (MAX - MIN));
const pt = (a: number, r = R) => [CX + r * Math.cos(a), CY - r * Math.sin(a)];

function arc(from: number, to: number) {
  const [x1, y1] = pt(angleFor(from));
  const [x2, y2] = pt(angleFor(to));
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

export default function ScoreGauge({ score, size = 260, caption }: { score: number; size?: number; caption?: string }) {
  const level = levelFor(score);
  const bands = [...SCORE_LEVELS].reverse().map((l, i, arr) => ({ ...l, to: arr[i + 1]?.min ?? MAX }));
  const a = angleFor(score);
  const [nx, ny] = pt(a, R - SW / 2 - 12);

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <svg viewBox="0 0 260 150" width={size} height={size * 150 / 260} role="img" aria-label={`Score ${score}, ${level.label}`}>
        {bands.map((b, i) => (
          <path key={b.level} d={arc(b.min + (i ? 3 : 0), b.to - (i < bands.length - 1 ? 3 : 0))}
            fill="none" stroke={b.color} strokeWidth={SW} strokeLinecap={i === 0 || i === bands.length - 1 ? "round" : "butt"}
            opacity={b.level === level.level ? 1 : 0.28} />
        ))}
        {[300, 550, 650, 750, 900].map(v => {
          const [tx, ty] = pt(angleFor(v), R + SW / 2 + 10);
          return <text key={v} x={tx} y={ty + 3} textAnchor="middle" fontSize="9" fill="#94a3b8" fontWeight={600}>{v}</text>;
        })}
        <line x1={CX} y1={CY} x2={nx} y2={ny} stroke="#0f172a" strokeWidth={3} strokeLinecap="round"
          style={{ transition: "all 700ms cubic-bezier(.2,.8,.2,1)" }} />
        <circle cx={CX} cy={CY} r={7} fill="#0f172a" />
        <circle cx={CX} cy={CY} r={3} fill="#fff" />
      </svg>
      <div className="-mt-1 text-center">
        <div className="text-4xl font-bold tracking-tight text-slate-900 tabular-nums">{score}</div>
        <div className="mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
          style={{ background: `${level.color}1a`, color: level.color }}>
          Level {level.level} · {level.label}
        </div>
        {caption && <div className="mt-1 text-[11px] text-slate-500">{caption}</div>}
      </div>
    </div>
  );
}
