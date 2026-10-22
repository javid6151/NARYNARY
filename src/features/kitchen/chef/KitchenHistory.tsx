/**
 * Chef cooking history: recorded meals; tap one to see the ingredients used, wasted and returned.
 * Redesigned with the ZIPNARY Enterprise design system (Warm Ivory, Porcelain White, Deep Olive).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, UtensilsCrossed } from 'lucide-react';
import { useAsync } from '../../../lib/hooks';
import { cx } from '../../../lib/cx';
import { fmtDate, label, num } from '../../../lib/format';
import { useBuilding } from '../../access/useBuilding';
import { Async, Empty } from '../../../components/ui';
import { SectionPromoBanner } from '../../../components/SectionPromoBanner';
import { listKitchenReportLines, listKitchenReports } from '../api';
import type { KitchenReport, KitchenReportLine } from '../types';
import { KitchenTopBar } from './ui/KitchenHeaders';

const LINE_VERB: Record<string, string> = { consumption: 'Used', wastage: 'Wasted' };

export function KitchenHistory() {
  const { buildingId } = useBuilding();
  const nav = useNavigate();
  const st = useAsync(() => (!buildingId ? Promise.resolve([] as KitchenReport[]) : listKitchenReports(buildingId)), [buildingId]);
  const [open, setOpen] = useState<string | null>(null);
  const lines = useAsync(() => (open ? listKitchenReportLines(open) : Promise.resolve([] as KitchenReportLine[])), [open]);

  return (
    <>
      <KitchenTopBar title="Cooking & Consumption History" />

      <SectionPromoBanner
        eyebrow="CULINARY AUDIT"
        title="Recorded Meals & Ingredient Ledger."
        subtitle="Permanent historical log of prepared meals, resident headcounts served, and consumed stock."
        imageSrc="/owner-assets/food-hero.jpg"
        statsBadge={st.data?.length ? `${st.data.length} Recorded Reports` : undefined}
        primaryAction={{
          label: "Today's Cooking",
          onClick: () => nav('/kitchen/cooking'),
          icon: UtensilsCrossed,
        }}
      />

      <Async state={st}>
        {(rows) =>
          rows.length === 0 ? (
            <Empty title="No meals recorded yet" />
          ) : (
            <ul className="space-y-3">
              {rows.map((r) => (
                <li key={r.id} className="bg-[#FFFEFC] border border-[#DED6CB] rounded-2xl shadow-2xs overflow-hidden">
                  <button
                    onClick={() => setOpen(open === r.id ? null : r.id)}
                    aria-expanded={open === r.id}
                    className="w-full p-4 sm:p-5 flex items-center gap-3 text-left cursor-pointer hover:bg-[#F5F0E8]/40 transition-colors"
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block font-bold text-[15.5px] text-[#30271F]">
                        {label(r.meal_type)} · {fmtDate(r.report_date)}
                      </span>
                      <span className="text-[12.5px] text-[#77736B] block mt-0.5">
                        Expected <strong className="text-[#30271F]">{r.expected_meal_count ?? '—'}</strong> · Served <strong className="text-[#343B2B]">{r.actual_meal_count ?? '—'}</strong>
                        {r.summary ? ` · ${r.summary}` : ''}
                      </span>
                    </span>
                    <ChevronDown className={cx('size-5 text-[#77736B] transition-transform', open === r.id && 'rotate-180')} aria-hidden />
                  </button>
                  {open === r.id && (
                    <div className="border-t border-[#DED6CB] bg-[#F8F4EE]/50 px-4 py-3">
                      <Async state={lines}>
                        {(ls) => (
                          <ul className="divide-y divide-[#DED6CB] text-[13px]">
                            {ls.map((l) => (
                              <li key={l.id} className="flex justify-between py-2 text-[#30271F]">
                                <span className="font-medium">
                                  {l.inventory_items.name}
                                  {l.notes ? <span className="text-[#77736B] font-normal"> · {l.notes}</span> : ''}
                                </span>
                                <span className="tabular font-semibold text-[#343B2B]">
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
