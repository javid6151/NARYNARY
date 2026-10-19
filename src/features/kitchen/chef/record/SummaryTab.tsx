/**
 * Summary tab: residents served, totals for used / returned / wasted, the ingredient list,
 * and Save as Draft / Submit Meal Record. Submission is blocked when a line exceeds kitchen stock.
 */
import { CheckCircle2, Clock, Pencil } from 'lucide-react';
import type { ApiError } from '../../../../lib/api';
import { num } from '../../../../lib/format';
import { Button, ErrorBanner, Input } from '../../../../components/ui';
import type { KitchenReportLineInput, StockRow } from '../../types';
import { formatTotals } from '../../units';

export function SummaryTab(p: {
  mealLabel: string;
  items: StockRow[];
  lines: KitchenReportLineInput[];
  over: StockRow[];
  expected: number;
  actual: string;
  setActual: (v: string) => void;
  summary: string;
  setSummary: (v: string) => void;
  error: ApiError | null;
  busy: boolean;
  alreadyRecorded: boolean;
  onEdit: () => void;
  onDraft: () => void;
  onSubmit: () => void;
}) {
  const itemOf = (id: string) => p.items.find((i) => i.item_id === id);
  const of = (kind: KitchenReportLineInput['kind']) => p.lines.filter((l) => l.kind === kind);
  const totals = (ls: KitchenReportLineInput[]) => formatTotals(ls.map((l) => ({ qty: l.quantity, baseUnit: itemOf(l.item_id)?.base_unit ?? '' })));
  const used = of('consumption');
  const returned = of('return');
  const wasted = of('wastage');
  const count = (ls: KitchenReportLineInput[]) => `${new Set(ls.map((l) => l.item_id)).size} item${ls.length === 1 ? '' : 's'}`;
  const ok = p.lines.length > 0 && p.over.length === 0;

  return (
    <>
      <section className={ok ? 'rounded-2xl bg-kitchen-50 p-4 flex items-center gap-3' : 'rounded-2xl bg-warn-bg p-4 flex items-center gap-3'}>
        <CheckCircle2 className={ok ? 'size-10 text-white fill-kitchen shrink-0' : 'size-10 text-warn shrink-0'} aria-hidden />
        <div>
          <p className="font-semibold text-[16px]">Meal Summary</p>
          <p className="text-[13px] text-ink-2">
            {ok ? `${p.mealLabel} ready to submit` : p.lines.length === 0 ? 'Add at least one ingredient quantity' : 'Some quantities exceed kitchen stock'}
          </p>
          <p className="text-[12px] text-muted">Please review the details before submitting.</p>
        </div>
      </section>

      <section className="bg-white border border-line rounded-2xl divide-y divide-line text-[13.5px]">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <label htmlFor="served">Total Residents Served</label>
          <div className="w-24 shrink-0">
            <Input
              id="served"
              type="number"
              min={0}
              value={p.actual}
              placeholder={String(p.expected)}
              onChange={(e) => p.setActual(e.target.value)}
              className="h-9 text-right"
            />
          </div>
        </div>
        {(
          [
            ['Ingredients Used', used],
            ['Returned to Store', returned],
            ['Wastage / Spoilage', wasted],
          ] as [string, KitchenReportLineInput[]][]
        ).map(([label, ls]) => (
          <div key={label} className="flex items-start justify-between gap-3 px-4 py-3">
            <span className="flex items-center gap-2">
              <Clock className="size-4 text-kitchen" aria-hidden />
              {label}
            </span>
            <span className="text-right">
              <span className="block font-medium">{count(ls)}</span>
              <span className="text-muted">{totals(ls)}</span>
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between px-4 py-3">
          <span>Net Consumption (used + wasted)</span>
          <span className="font-medium">{totals([...used, ...wasted])}</span>
        </div>
        <div className="px-4 py-3">
          <label htmlFor="notes" className="block mb-1">Notes</label>
          <Input id="notes" value={p.summary} onChange={(e) => p.setSummary(e.target.value)} placeholder="e.g. Served on time" />
        </div>
      </section>

      <section className="bg-white border border-line rounded-2xl">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <h2 className="font-semibold text-[15px]">Ingredients Used</h2>
          <button onClick={p.onEdit} className="text-[13px] text-kitchen flex items-center gap-1 cursor-pointer">
            <Pencil className="size-3.5" aria-hidden />
            Edit
          </button>
        </div>
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="bg-subtle text-muted text-left">
              <th className="px-4 py-2 font-medium">Item</th>
              <th className="px-4 py-2 font-medium text-right">Quantity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {used.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-3 text-muted">No ingredients entered.</td>
              </tr>
            )}
            {used.map((l, i) => {
              const it = itemOf(l.item_id);
              const isOver = p.over.some((o) => o.item_id === l.item_id);
              return (
                <tr key={i} className={isOver ? 'bg-bad-bg' : ''}>
                  <td className="px-4 py-2">{it?.name}</td>
                  <td className="px-4 py-2 text-right tabular">
                    {num(l.quantity, 3)} {it?.base_unit}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {p.over.length > 0 && (
        <ErrorBanner
          error={`More than available in kitchen stock: ${p.over.map((o) => `${o.name} (${num(o.kitchen_qty, 3)} ${o.base_unit})`).join(', ')}`}
        />
      )}
      <ErrorBanner error={p.error} />
      <Button variant="secondary" className="w-full h-12 border-kitchen text-kitchen" onClick={p.onDraft}>Save as Draft</Button>
      <Button variant="kitchen" className="w-full h-12 text-[16px]" busy={p.busy} disabled={!ok || p.alreadyRecorded} onClick={p.onSubmit}>
        Submit Meal Record
      </Button>
      <p className="text-[12px] text-muted text-center">
        Submitting posts usage, returns and wastage to the stock ledger in one step. It can’t be submitted twice.
      </p>
    </>
  );
}
