/** Chef cooking history: recorded meals; tap one to see the ingredients used, wasted and returned. */
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useAsync } from '../../../lib/hooks';
import { cx } from '../../../lib/cx';
import { fmtDate, label, num } from '../../../lib/format';
import { useBuilding } from '../../access/useBuilding';
import { Async, Empty } from '../../../components/ui';
import { listKitchenReportLines, listKitchenReports } from '../api';
import type { KitchenReport, KitchenReportLine } from '../types';
import { KitchenTopBar } from './ui/KitchenHeaders';

const LINE_VERB: Record<string, string> = { consumption: 'Used', wastage: 'Wasted' };

export function KitchenHistory() {
  const { buildingId } = useBuilding();
  const st = useAsync(() => (!buildingId ? Promise.resolve([] as KitchenReport[]) : listKitchenReports(buildingId)), [buildingId]);
  const [open, setOpen] = useState<string | null>(null);
  const lines = useAsync(() => (open ? listKitchenReportLines(open) : Promise.resolve([] as KitchenReportLine[])), [open]);
  return (
    <>
      <KitchenTopBar title="Cooking History" />
      <Async state={st}>
        {(rows) =>
          rows.length === 0 ? (
            <Empty title="No meals recorded yet" />
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={r.id} className="bg-white border border-line rounded-2xl">
                  <button
                    onClick={() => setOpen(open === r.id ? null : r.id)}
                    aria-expanded={open === r.id}
                    className="w-full p-4 flex items-center gap-3 text-left cursor-pointer"
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium">
                        {label(r.meal_type)} · {fmtDate(r.report_date)}
                      </span>
                      <span className="text-[12.5px] text-muted">
                        Expected {r.expected_meal_count ?? '—'} · Served {r.actual_meal_count ?? '—'}
                        {r.summary ? ` · ${r.summary}` : ''}
                      </span>
                    </span>
                    <ChevronDown className={cx('size-5 text-ink-2 transition-transform', open === r.id && 'rotate-180')} aria-hidden />
                  </button>
                  {open === r.id && (
                    <div className="border-t border-line px-4 py-2">
                      <Async state={lines}>
                        {(ls) => (
                          <ul className="divide-y divide-line text-[13px]">
                            {ls.map((l) => (
                              <li key={l.id} className="flex justify-between py-2">
                                <span>
                                  {l.inventory_items.name}
                                  {l.notes ? <span className="text-muted"> · {l.notes}</span> : ''}
                                </span>
                                <span className="tabular">
                                  {LINE_VERB[l.transaction_type] ?? 'Returned'} {num(l.quantity, 3)} {l.inventory_items.base_unit}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </Async>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )
        }
      </Async>
    </>
  );
}
