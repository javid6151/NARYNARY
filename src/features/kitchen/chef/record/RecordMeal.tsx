/**
 * Record a cooked meal (`/kitchen/record/:date/:meal`) in three tabs:
 *   Ingredients     actual quantities used (pre-filled with everything issued to the kitchen)
 *   Wastage/Return  unused quantities returned to the store, and wastage with a reason
 *   Summary         residents served, totals, then "Submit Meal Record"
 * Quantities may be entered in kg/g or litre/ml; they are converted to each item's base unit.
 * "Save Usage" / "Save as Draft" keep a draft in this browser. Submitting posts every line to the stock
 * ledger in one transaction; the idempotency key is fixed for the page so the meal can't be recorded twice.
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
import { WastageTab } from './WastageTab';

type Tab = 'ingredients' | 'wastage' | 'summary';

export function RecordMeal() {
  const { date = isoDate(), meal = 'lunch' } = useParams();
  const { buildingId } = useBuilding();
  const nav = useNavigate();
  const meta = MEALS.find((m) => m.id === meal) ?? MEALS[1];
  const sum = useAsync(
    () => (buildingId ? getMealCounts(buildingId, date) : Promise.resolve(null as MealCount | null)),
    [buildingId, date],
  );
  const menus = useAsync(() => (buildingId ? listMenus(buildingId, date, date) : Promise.resolve([] as Menu[])), [buildingId, date]);
  const stock = useStock(buildingId);
  const [tab, setTab] = useState<Tab>('ingredients');
  const [used, setUsed] = useState<IngredientLine[]>([]);
  const [returns, setReturns] = useState<IngredientLine[]>([]);
  const [waste, setWaste] = useState<IngredientLine[]>([]);
  const [actual, setActual] = useState('');
  const [summary, setSummary] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [key] = useState(newKey);
  const items = useMemo(() => stock.data ?? [], [stock.data]);
  const info = sum.data?.meals.find((m) => m.meal_type === meal);
  const menu = (menus.data ?? []).find((m) => m.meal_type === meal);
  const expected = sum.data ? sum.data.total_residents - (info?.not_eating ?? 0) : 0;

  // Start from the saved draft if there is one, otherwise from everything issued to the kitchen.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (seeded || !stock.data || stock.loading || !buildingId) return;
    const d = loadDraft(buildingId, date, meal);
    if (d) {
      setUsed(d.used);
      setReturns(d.returns);
      setWaste(d.waste);
      setActual(d.actual);
      setSummary(d.summary);
    } else {
      // The building's stock may not have arrived yet (the list briefly reads empty); wait for real items.
      const issued = items.filter((i) => Number(i.kitchen_qty) > 0);
      if (!issued.length) return;
      setUsed(issued.map((i) => ({ item_id: i.item_id, quantity: '' })));
    }
    setSeeded(true);
  }, [seeded, stock.data, stock.loading, items, buildingId, date, meal]);

  const baseOf = (l: IngredientLine) => {
    const it = items.find((i) => i.item_id === l.item_id);
    return it ? toBase(Number(l.quantity), l.unit ?? it.base_unit, it.base_unit) : 0;
  };
  const lines: KitchenReportLineInput[] = [
    ...used.filter((l) => l.item_id && Number(l.quantity) > 0).map((l) => ({ item_id: l.item_id, kind: 'consumption' as const, quantity: baseOf(l) })),
    ...returns.filter((l) => l.item_id && Number(l.quantity) > 0).map((l) => ({ item_id: l.item_id, kind: 'return' as const, quantity: baseOf(l) })),
    ...waste
      .filter((l) => l.item_id && Number(l.quantity) > 0)
      .map((l) => ({ item_id: l.item_id, kind: 'wastage' as const, quantity: baseOf(l), reason: l.reason })),
  ];
  // Per item, used + returned + wasted must not exceed kitchen stock (the server checks again).
  const over = items.filter(
    (i) => lines.filter((l) => l.item_id === i.item_id).reduce((s, l) => s + l.quantity, 0) > Number(i.kitchen_qty) + 1e-9,
  );
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
    return saveDraft(buildingId, date, meal, { used, returns, waste, actual, summary });
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
        <section className="bg-white border border-line rounded-2xl p-4">
          <div className="flex items-center gap-4">
            <span className="size-[72px] rounded-xl bg-kitchen-50 text-kitchen grid place-items-center shrink-0">
              <meta.icon className="size-8" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-[15px]">{info?.menu?.items ?? 'No menu set'}</p>
              <p className="text-[13px] text-ink-2 flex items-center gap-1.5 mt-1">
                <Users className="size-4" aria-hidden />
                Expected for {expected} residents
              </p>
            </div>
          </div>
          {tab === 'ingredients' && <p className="text-[12.5px] text-muted mt-3">Enter the actual quantities used for cooking</p>}
        </section>
      )}

      <div role="tablist" className="grid grid-cols-3 border-b border-line">
        {(
          [
            ['ingredients', 'Ingredients'],
            ['wastage', 'Wastage/Return'],
            ['summary', 'Summary'],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cx(
              'py-3 text-[14px] border-b-2 -mb-px cursor-pointer',
              tab === id ? 'border-kitchen text-kitchen font-semibold' : 'border-transparent text-ink-2',
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
                This meal was already recorded ({info.report.actual} served). It can’t be submitted again.
              </p>
            )}
            {tab === 'ingredients' && (
              <IngredientsTab
                items={items}
                used={used}
                setUsed={setUsed}
                onSave={() => {
                  setToast(save() ? 'Usage saved' : 'Could not save a draft on this device');
                  setTab('wastage');
                }}
                onIssue={() => nav('/kitchen/stock')}
              />
            )}
            {tab === 'wastage' && (
              <WastageTab items={items} returns={returns} setReturns={setReturns} waste={waste} setWaste={setWaste} onNext={() => setTab('summary')} />
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
                onDraft={() => setToast(save() ? 'Draft saved on this device' : 'Could not save a draft on this device')}
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
