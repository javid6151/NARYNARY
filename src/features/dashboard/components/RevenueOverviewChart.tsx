/**
 * Revenue Overview chart component for the ZIPNARY Owner Dashboard.
 * Clean, rounded bar chart with Collections & Expenses, interactive tooltip,
 * and period selector ("This Month" / "Recent Trend").
 */
import { useState } from 'react';
import { inr } from '../../../lib/format';

interface DailyData {
  day: string;
  collected: number;
  spent: number;
}

export function RevenueOverviewChart({
  dailyCollection,
  periodStart,
}: {
  dailyCollection: DailyData[];
  periodStart?: string;
}) {
  const [period, setPeriod] = useState<'daily' | 'summary'>('daily');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const data = dailyCollection.length > 0 ? dailyCollection : [];
  const W = 640;
  const H = 210;
  const pl = 44;
  const pr = 12;
  const pt = 14;
  const pb = 28;

  const maxVal = Math.max(
    1000,
    ...data.flatMap((d) => [Number(d.collected || 0), Number(d.spent || 0)]),
  );
  const nice = niceMax(maxVal);

  const slot = Math.max(1, (W - pl - pr) / Math.max(1, data.length));
  const bw = Math.max(3, Math.min(10, (slot - 6) / 2));
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / nice);
  const ticks = [0, nice / 2, nice];

  const activeItem = hoverIndex !== null && data[hoverIndex] ? data[hoverIndex] : null;

  const totalCollected = data.reduce((s, d) => s + Number(d.collected || 0), 0);
  const totalSpent = data.reduce((s, d) => s + Number(d.spent || 0), 0);

  return (
    <div className="bg-[#FFFEFC] border border-[#DED6CB] rounded-2xl p-5 flex flex-col justify-between shadow-xs">
      {/* Header with Title and Period Filter */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#ECE5DA]">
        <div>
          <h3 className="font-bold text-[15px] text-[#30271F]">Revenue Overview</h3>
          <p className="text-[12px] text-[#77736B]">
            {periodStart
              ? `Collections vs. expenses for ${new Date(periodStart + 'T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`
              : 'Collections vs. operational expenses'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-3 text-[12px]">
            <span className="inline-flex items-center gap-1.5 font-medium text-[#30271F]">
              <span className="size-2.5 rounded-sm bg-[#343B2B] inline-block" />
              Collections
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium text-[#77736B]">
              <span className="size-2.5 rounded-sm bg-[#A6B49A] inline-block" />
              Expenses
            </span>
          </div>

          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as 'daily' | 'summary')}
            className="text-xs font-semibold bg-[#F5F0E8] border border-[#DED6CB] rounded-xl px-2.5 py-1 text-[#30271F] cursor-pointer focus:outline-none"
            aria-label="Filter period"
          >
            <option value="daily">This Month (Daily)</option>
            <option value="summary">Summary Totals</option>
          </select>
        </div>
      </div>

      {/* Chart visualization */}
      {data.length === 0 || (!totalCollected && !totalSpent) ? (
        <div className="h-48 flex flex-col items-center justify-center text-center p-4">
          <p className="text-sm font-semibold text-[#30271F]">No revenue activity recorded this month</p>
          <p className="text-xs text-[#77736B] mt-1">Payments and expenses will show here as they occur.</p>
        </div>
      ) : period === 'summary' ? (
        <div className="h-48 flex items-center justify-around p-4">
          <div className="text-center p-4 rounded-2xl bg-[#EBF0E6] border border-[#CAD7BF] flex-1 max-w-xs">
            <span className="text-xs font-semibold text-[#343B2B] uppercase tracking-wide">Total Collected</span>
            <p className="text-2xl font-bold text-[#30271F] tabular mt-1">{inr(totalCollected)}</p>
          </div>
          <div className="text-center p-4 rounded-2xl bg-[#FDF1EC] border border-[#B9674B]/20 flex-1 max-w-xs">
            <span className="text-xs font-semibold text-[#B9674B] uppercase tracking-wide">Total Expenses</span>
            <p className="text-2xl font-bold text-[#30271F] tabular mt-1">{inr(totalSpent)}</p>
          </div>
        </div>
      ) : (
        <div className="relative pt-2">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto"
            role="img"
            aria-label="Daily revenue overview"
            onMouseLeave={() => setHoverIndex(null)}
          >
            {/* Grid lines & Y-axis labels */}
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={pl}
                  x2={W - pr}
                  y1={y(t)}
                  y2={y(t)}
                  stroke="#ECE5DA"
                  strokeWidth={1}
                  strokeDasharray={t === 0 ? 'none' : '3 3'}
                />
                <text
                  x={pl - 8}
                  y={y(t) + 3}
                  textAnchor="end"
                  fontSize={10}
                  fill="#77736B"
                  className="font-mono tabular"
                >
                  {compactInr(t)}
                </text>
              </g>
            ))}

            {/* Bars */}
            {data.map((d, i) => {
              const x0 = pl + i * slot + (slot - (bw * 2 + 3)) / 2;
              const va = Number(d.collected || 0);
              const vb = Number(d.spent || 0);
              const isHovered = hoverIndex === i;

              return (
                <g key={d.day} onMouseEnter={() => setHoverIndex(i)} className="cursor-pointer">
                  {/* Hover background track */}
                  <rect
                    x={pl + i * slot}
                    y={pt}
                    width={slot}
                    height={H - pt - pb}
                    fill={isHovered ? 'rgba(236, 229, 218, 0.4)' : 'transparent'}
                    rx={4}
                  />

                  {/* Collections Bar (Deep Olive) */}
                  {va > 0 && (
                    <rect
                      x={x0}
                      y={y(va)}
                      width={bw}
                      height={Math.max(2, y(0) - y(va))}
                      rx={Math.min(3, bw / 2)}
                      fill="#343B2B"
                    />
                  )}

                  {/* Expenses Bar (Muted Sage) */}
                  {vb > 0 && (
                    <rect
                      x={x0 + bw + 3}
                      y={y(vb)}
                      width={bw}
                      height={Math.max(2, y(0) - y(vb))}
                      rx={Math.min(3, bw / 2)}
                      fill="#A6B49A"
                    />
                  )}

                  {/* X Axis Day number */}
                  {i % Math.ceil(data.length / 10) === 0 && (
                    <text
                      x={pl + i * slot + slot / 2}
                      y={H - 8}
                      textAnchor="middle"
                      fontSize={10}
                      fill="#77736B"
                      className="font-medium"
                    >
                      {new Date(d.day + 'T00:00:00').getDate()}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Interactive Floating Tooltip */}
          {activeItem && hoverIndex !== null && (
            <div
              className="absolute top-2 pointer-events-none bg-[#30271F] text-white rounded-xl shadow-xl px-3 py-2 text-[12px] tabular z-10 animate-in fade-in duration-100"
              style={{
                left: `min(calc(${((pl + hoverIndex * slot + slot / 2) / W) * 100}% + 8px), calc(100% - 150px))`,
              }}
            >
              <p className="font-semibold border-b border-white/10 pb-1 mb-1 text-[11px] text-[#DED6CB]">
                {new Date(activeItem.day + 'T00:00:00').toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                })}
              </p>
              <p className="flex items-center justify-between gap-3 text-white">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-400 inline-block" />
                  Collected:
                </span>
                <span className="font-bold">{inr(activeItem.collected)}</span>
              </p>
              <p className="flex items-center justify-between gap-3 text-[#DED6CB] mt-0.5">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-[#A6B49A] inline-block" />
                  Expenses:
                </span>
                <span>{inr(activeItem.spent)}</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function niceMax(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v || 1)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function compactInr(v: number) {
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(v % 1e5 ? 1 : 0)}L`;
  if (v >= 1e3) return `₹${(v / 1e3).toFixed(0)}k`;
  return `₹${v}`;
}
