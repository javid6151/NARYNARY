/**
 * Record a cooked meal (`/kitchen/record/:date/:meal`):
 * Simplified 2-tab workflow for Chef Daily Usage:
 *   1. Ingredients Used (enter actual quantities used for cooking)
 *   2. Summary (headcount served, review, and Submit Meal Record)
 * Automatically deducts stock from building inventory upon submission.
 * Idempotent: once submitted, it cannot be submitted twice.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Users } from 'lucide-react';
import { newKey } from '../../../../lib/api';
import { useAsync, useMutation } from '../../../../lib/hooks';
import { cx } from '../../../../lib/cx';
import { fmtDate, fmtTime, isoDate } from '../../../../lib/format';
import { useBuilding } from '../../../access/useBuilding';
import { Async, Toast } from '../../../../components/ui';
import { getMealCounts, listMenus, submitKitchenReport } from '../../api';
import { MEALS } from '../../meals';
import type { IngredientLine, KitchenReportLineInput, MealCount, Menu } from '../../types';
import { toBase } from '../../units';
import { useStock } from '../../useStock';
import { KitchenTopBar } from '../ui/KitchenHeaders';
import { clearDraft, loadDraft, saveDraft } from './draft';
import { IngredientsTab } from './IngredientsTab';
import { SummaryTab } from './SummaryTab';

type Tab = 'ingredients' | 'summary';

export function RecordMeal() {
  const { date = isoDate(), meal = 'lunch' } = useParams();
  const { buildingId } = useBuilding();
  const nav = useNavigate();
  const meta = MEALS.find((m) => m.id === meal) ?? MEALS[1];

  const sum = useAsync(
    () => (buildingId ? getMealCounts(buildingId, date) : Promise.resolve(null as MealCount | null)),
    [buildingId, date],
  );
  const menus = useAsync(
    () => (buildingId ? listMenus(buildingId, date, date) : Promise.resolve([] as Menu[])),
    [buildingId, date],
  );
  const stock = useStock(buildingId);

  const [tab, setTab] = useState<Tab>('ingredients');
  const [used, setUsed] = useState<IngredientLine[]>([]);
  const [actual, setActual] = useState('');
  const [summary, setSummary] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [key] = useState(newKey);

  const items = useMemo(() => stock.data ?? [], [stock.data]);
  const info = sum.data?.meals.find((m) => m.meal_type === meal);
  const menu = (menus.data ?? []).find((m) => m.meal_type === meal);
  const expected = sum.data ? sum.data.total_residents - (info?.not_eating ?? 0) : 0;

  // Initialize from saved draft or start with empty/available list
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (seeded || !stock.data || stock.loading || !buildingId) return;
    const d = loadDraft(buildingId, date, meal);
    if (d) {
      setUsed(d.used);
      setActual(d.actual);
      setSummary(d.summary);
    } else {
      // Pre-populate with first few available ingredients for fast data entry
      const available = items.filter(
        (i) => Number(i.expected_qty ?? (Number(i.store_qty ?? 0) + Number(i.kitchen_qty ?? 0))) > 0,
      );
      if (available.length > 0) {
        setUsed(available.slice(0, 4).map((i) => ({ item_id: i.item_id, quantity: '' })));
      }
    }
    setSeeded(true);
  }, [seeded, stock.data, stock.loading, items, buildingId, date, meal]);

  const baseOf = (l: IngredientLine) => {
    const it = items.find((i) => i.item_id === l.item_id);
    return it ? toBase(Number(l.quantity), l.unit ?? it.base_unit, it.base_unit) : 0;
  };

  const lines: KitchenReportLineInput[] = used
    .filter((l) => l.item_id && Number(l.quantity) > 0)
    .map((l) => ({ item_id: l.item_id, kind: 'consumption' as const, quantity: baseOf(l) }));

  // Check if any quantity exceeds unified available stock
  const over = items.filter((i) => {
    const avail = Number(i.expected_qty ?? (Number(i.store_qty ?? 0) + Number(i.kitchen_qty ?? 0)));
    const totalUsed = lines
      .filter((l) => l.item_id === i.item_id)
      .reduce((s, l) => s + l.quantity, 0);
    return totalUsed > avail + 1e-9;
  });

  const m = useMutation(() =>
    submitKitchenReport({
      buildingId,
      date,
      mealType: meal,
      actualCount: actual ? Number(actual) : expected,
      summary: summary || null,
      lines,
      idempotencyKey: key,
    }),
  );

  const save = () => {
    if (!buildingId) return false;
    return saveDraft(buildingId, date, meal, { used, returns: [], waste: [], actual, summary });
  };

  const submit = async () => {
    if (await m.run()) {
      if (buildingId) clearDraft(buildingId, date, meal);
      nav('/kitchen', { replace: true });
    }
  };

  return (
    <>
      <KitchenTopBar
        title={`${meta.label} - ${fmtDate(date)}`}
        subtitle={`${fmtTime(menu?.serving_start ?? meta.start)} – ${fmtTime(menu?.serving_end ?? meta.end)}`}
        back="/kitchen"
      />

      {tab !== 'summary' && (
        <section className="bg-[#FFFEFC] border border-[#DED6CB] rounded-2xl p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center gap-4">
            <span className="size-[64px] rounded-2xl bg-[#EBF0E6] text-[#343B2B] grid place-items-center shrink-0 shadow-2xs">
              <meta.icon className="size-8" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-bold text-[15.5px] text-[#30271F]">{info?.menu?.items ?? 'No menu set'}</p>
              <p className="text-[13px] text-[#77736B] flex items-center gap-1.5 mt-1 font-medium">
                <Users className="size-4 text-[#343B2B]" aria-hidden />
                Expected for <strong className="text-[#30271F]">{expected}</strong> residents
              </p>
            </div>
          </div>
          <p className="text-[12px] text-[#77736B] mt-3 pt-2.5 border-t border-[#DED6CB]">
            Enter actual quantities of pantry ingredients used for cooking this meal.
          </p>
        </section>
      )}

      {/* 2-Tab Navigation */}
      <div role="tablist" className="grid grid-cols-2 border-b border-[#DED6CB]">
        {(
          [
            ['ingredients', '1. Ingredients Used'],
            ['summary', '2. Review & Submit'],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cx(
              'py-3 text-[14px] border-b-2 -mb-px cursor-pointer text-center font-medium transition-colors',
              tab === id ? 'border-[#343B2B] text-[#343B2B] font-bold' : 'border-transparent text-[#77736B] hover:text-[#30271F]',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <Async state={stock}>
        {() => (
          <>
            {info?.report && (
              <p className="rounded-lg bg-ok-bg text-ok text-[13px] px-3 py-2">
                This meal was already recorded ({info.report.actual} served). It cannot be submitted again.
              </p>
            )}
            {tab === 'ingredients' && (
              <IngredientsTab
                items={items}
                used={used}
                setUsed={setUsed}
                onSave={() => {
                  save();
                  setTab('summary');
                }}
              />
            )}
            {tab === 'summary' && (
              <SummaryTab
                mealLabel={meta.label}
                items={items}
                lines={lines}
                over={over}
                expected={expected}
                actual={actual}
                setActual={setActual}
                summary={summary}
                setSummary={setSummary}
                error={m.error}
                busy={m.busy}
                alreadyRecorded={!!info?.report}
                onEdit={() => setTab('ingredients')}
                onDraft={() => setToast(save() ? 'Draft saved on this device' : 'Could not save draft')}
                onSubmit={submit}
              />
            )}
          </>
        )}
      </Async>
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
