/**
 * Chef home: greeting, date, residents on the mess plan, today's three meals (tap to record usage),
 * and what is currently issued to the kitchen.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronDown, ChevronRight, Users } from 'lucide-react';
import { useAsync } from '../../../lib/hooks';
import { cx } from '../../../lib/cx';
import { fmtTime, isoDate, num } from '../../../lib/format';
import { useBuilding } from '../../access/useBuilding';
import { Async, Badge, Empty } from '../../../components/ui';
import { BuildingPicker } from '../../../components/BuildingPicker';
import { getMealCounts, listMenus } from '../api';
import { MEALS } from '../meals';
import type { MealCount, Menu } from '../types';
import { useStock } from '../useStock';
import { ItemAvatar } from './ui/ItemAvatar';
import { KitchenBrandHeader } from './ui/KitchenHeaders';
import { KitchenSideMenu } from './ui/KitchenSideMenu';

const MEAL_TONE: Record<string, string> = {
  breakfast: 'bg-[#fff4dc] text-[#c27c00]',
  lunch: 'bg-[#fff0e0] text-[#e0752f]',
  dinner: 'bg-[#eeeafe] text-brand-600',
};

/** "Mon, 06 May 2026" */
const longDate = (d: string) => {
  const x = new Date(d + 'T00:00:00');
  return `${x.toLocaleDateString('en-IN', { weekday: 'short' })}, ${x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
};

export function KitchenHome({ name }: { name: string }) {
  const { buildingId, building } = useBuilding();
  const nav = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [date, setDate] = useState(isoDate());
  const sum = useAsync(
    () => (buildingId ? getMealCounts(buildingId, date) : Promise.resolve(null as MealCount | null)),
    [buildingId, date],
  );
  const menus = useAsync(() => (buildingId ? listMenus(buildingId, date, date) : Promise.resolve([] as Menu[])), [buildingId, date]);
  const stock = useStock(buildingId);
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const kitchenStock = (stock.data ?? []).filter((s) => Number(s.kitchen_qty) > 0);

  return (
    <>
      <KitchenBrandHeader name={name} onMenu={() => setMenuOpen(true)} />
      <KitchenSideMenu name={name} open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div>
        <h1 className="text-[24px] font-bold">
          {greet}
          {name ? `, ${name.split(' ')[0]}` : ''} 👋
        </h1>
        <p className="text-[14px] text-ink-2">Here’s today’s cooking plan{building ? ` for ${building.name}` : ''}</p>
      </div>

      <div className="flex gap-2">
        <label className="relative flex-1 flex items-center gap-3 bg-white border border-line rounded-xl h-12 px-4 cursor-pointer">
          <CalendarDays className="size-5 text-ink-2" aria-hidden />
          <span className="flex-1 text-[15px]">{longDate(date)}</span>
          <ChevronDown className="size-4 text-ink-2" aria-hidden />
          <input
            type="date"
            aria-label="Date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
        <BuildingPicker />
      </div>

      <Async state={sum} rows={4}>
        {(s) =>
          !s ? (
            <Empty title="No building assigned" />
          ) : (
            <>
              <section className="rounded-2xl bg-kitchen-50 p-4 flex items-center gap-4">
                <Users className="size-9 text-kitchen" aria-hidden />
                <div className="flex-1">
                  <p className="text-[13px] text-ink-2">Total Residents</p>
                  <p className="text-[28px] font-bold tabular leading-tight">{s.total_residents}</p>
                </div>
                <p className="text-[12px] text-ink-2 text-right max-w-36">
                  On the mess plan. Each meal’s count excludes residents who marked “not eating”.
                </p>
              </section>

              <section>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-[17px] font-semibold">Today’s Menu</h2>
                  <button onClick={() => nav('/kitchen/menu')} className="text-[14px] text-brand-600 cursor-pointer">View Week</button>
                </div>
                <ul className="space-y-3">
                  {s.meals.map((m) => {
                    const meta = MEALS.find((x) => x.id === m.meal_type)!;
                    const menu = (menus.data ?? []).find((x) => x.meal_type === m.meal_type);
                    const recorded = !!m.report;
                    const canRecord = !recorded && date <= isoDate();
                    return (
                      <li key={m.meal_type}>
                        <button
                          onClick={() => nav(recorded ? '/kitchen/history' : canRecord ? `/kitchen/record/${date}/${m.meal_type}` : '/kitchen/menu')}
                          className="w-full text-left bg-white border border-line rounded-2xl p-3 flex items-center gap-3 cursor-pointer"
                        >
                          <span className={cx('size-[72px] rounded-xl grid place-items-center shrink-0', MEAL_TONE[m.meal_type])}>
                            <meta.icon className="size-8" aria-hidden />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-[15px]">{meta.label}</span>
                              {recorded ? <Badge status="completed">Recorded</Badge> : <Badge status="pending" />}
                            </span>
                            <span className="block text-[12.5px] text-muted">
                              {fmtTime(menu?.serving_start ?? meta.start)} – {fmtTime(menu?.serving_end ?? meta.end)} · {s.total_residents - m.not_eating}{' '}
                              expected
                            </span>
                            <span className="block text-[14px] mt-1 truncate">
                              {m.menu?.items ?? <span className="text-muted">No menu set</span>}
                            </span>
                          </span>
                          <ChevronRight className="size-5 text-ink-2 shrink-0" aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </>
          )
        }
      </Async>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[17px] font-semibold">Kitchen Stock</h2>
          <button onClick={() => nav('/kitchen/stock')} className="text-[14px] text-brand-600 cursor-pointer">View All</button>
        </div>
        <Async state={stock}>
          {() =>
            kitchenStock.length === 0 ? (
              <p className="text-[13px] text-muted">Nothing issued to the kitchen. Issue ingredients from the store before cooking.</p>
            ) : (
              <div className="flex gap-3 overflow-x-auto -mx-4 px-4 pb-1">
                {kitchenStock.map((s) => (
                  <div key={s.item_id} className="w-[92px] shrink-0 bg-white border border-line rounded-xl p-3">
                    <ItemAvatar name={s.name} category={s.category} size={44} />
                    <p className="text-[12.5px] mt-2 truncate">{s.name}</p>
                    <p className="font-semibold tabular">
                      {num(s.kitchen_qty, 3)} {s.base_unit}
                    </p>
                  </div>
                ))}
              </div>
            )
          }
        </Async>
      </section>
    </>
  );
}
