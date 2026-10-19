import { useState } from 'react';
import { inr } from '../lib/format';

/**
 * Two-series daily bar chart (same unit, one axis). Legend always shown, hover tooltip per day,
 * thin bars with 2px gap, recessive grid. Values in text ink, series color only on marks.
 */
export function DailyBars({ data, a, b }: {
  data: { day: string; [k: string]: number | string }[];
  a: { key: string; label: string }; b: { key: string; label: string };
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 200, pl = 48, pr = 8, pt = 8, pb = 22;
  const max = Math.max(1, ...data.flatMap((d) => [Number(d[a.key]), Number(d[b.key])]));
  const nice = niceMax(max);
  const slot = (W - pl - pr) / Math.max(1, data.length);
  const bw = Math.max(2, Math.min(10, (slot - 6) / 2));
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / nice);
  const ticks = [0, nice / 2, nice];
  const h = hover !== null ? data[hover] : null;

  return (
    <div>
      <div className="flex gap-4 text-[12px] text-ink-2 mb-2" aria-hidden>
        <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-chart-a inline-block" />{a.label}</span>
        <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-chart-b inline-block" />{b.label}</span>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
          aria-label={`${a.label} and ${b.label} per day`} onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} />
              <text x={pl - 6} y={y(t) + 4} textAnchor="end" fontSize={10} fill="var(--color-muted)">{compactInr(t)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const x0 = pl + i * slot + (slot - (bw * 2 + 2)) / 2;
            const va = Number(d[a.key]), vb = Number(d[b.key]);
            return (
              <g key={d.day} onMouseEnter={() => setHover(i)}>
                <rect x={pl + i * slot} y={pt} width={slot} height={H - pt - pb} fill={hover === i ? 'var(--color-subtle)' : 'transparent'} />
                {va > 0 && <rect x={x0} y={y(va)} width={bw} height={y(0) - y(va)} rx={Math.min(2, bw / 2)} fill="var(--color-chart-a)" />}
                {vb > 0 && <rect x={x0 + bw + 2} y={y(vb)} width={bw} height={y(0) - y(vb)} rx={Math.min(2, bw / 2)} fill="var(--color-chart-b)" />}
                {(i % Math.ceil(data.length / 8) === 0) && (
                  <text x={pl + i * slot + slot / 2} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--color-muted)">
                    {new Date(d.day + 'T00:00:00').getDate()}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {h && hover !== null && (
          <div className="absolute top-0 pointer-events-none bg-white border border-line rounded-lg shadow-md px-3 py-2 text-[12px] tabular"
            style={{ left: `min(calc(${((pl + hover * slot + slot / 2) / W) * 100}% + 8px), calc(100% - 160px))` }}>
            <p className="font-medium mb-1">{new Date(h.day + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
            <p><i className="inline-block size-2 rounded-sm bg-chart-a mr-1.5" />{a.label}: {inr(h[a.key])}</p>
            <p><i className="inline-block size-2 rounded-sm bg-chart-b mr-1.5" />{b.label}: {inr(h[b.key])}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Horizontal magnitude bars (single hue), labels in text ink. */
export function HBars({ rows, format = inr }: { rows: { name: string; value: number }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.name} title={`${r.name}: ${format(r.value)}`}>
          <div className="flex justify-between text-[13px] mb-1">
            <span className="text-ink-2 truncate pr-2">{r.name}</span>
            <span className="tabular text-ink font-medium">{format(r.value)}
              <span className="text-muted font-normal ml-1.5">{total ? Math.round((r.value / total) * 100) : 0}%</span></span>
          </div>
          <div className="h-2 rounded-full bg-subtle overflow-hidden">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Part-of-whole meter (occupancy). */
export function Meter({ value, total, label }: { value: number; total: number; label: string }) {
  const pct = total ? Math.round((value / total) * 1000) / 10 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-3xl font-semibold tabular">{pct}%</span>
        <span className="text-[13px] text-muted tabular">{value} / {total} {label}</span>
      </div>
      <div
        className="h-2.5 rounded-full bg-subtle mt-3 overflow-hidden"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={value}
        aria-label={label}
      >
        <div className="h-full bg-brand-600 rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function niceMax(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
function compactInr(v: number) {
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(v % 1e5 ? 1 : 0)}L`;
  if (v >= 1e3) return `₹${(v / 1e3).toFixed(0)}k`;
  return `₹${v}`;
}
