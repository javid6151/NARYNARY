/**
 * Chef home: greeting, date, residents on the mess plan, today's three meals (tap to record usage),
 * and what is currently issued to the kitchen.
 * Redesigned with the ZIPNARY Enterprise design system (Warm Ivory, Porcelain White, Deep Olive).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronDown, ChevronRight, Users, UtensilsCrossed } from 'lucide-react';
import { useAsync } from '../../../lib/hooks';
import { cx } from '../../../lib/cx';
import { fmtTime, isoDate, num } from '../../../lib/format';
import { useBuilding } from '../../access/useBuilding';
import { Async, Badge, Empty } from '../../../components/ui';
import { BuildingPicker } from '../../../components/BuildingPicker';
import { SectionPromoBanner } from '../../../components/SectionPromoBanner';
import { getMealCounts, listMenus } from '../api';
import { MEALS } from '../meals';
import type { MealCount, Menu } from '../types';
import { useStock } from '../useStock';
import { ItemAvatar } from './ui/ItemAvatar';
import { KitchenBrandHeader } from './ui/KitchenHeaders';
import { KitchenSideMenu } from './ui/KitchenSideMenu';
import { useKitchenBase } from './useKitchenBase';

const MEAL_TONE: Record<string, string> = {
  breakfast: 'bg-[#FEF6E9] text-[#B45309] border border-[#FDE68A]',
  lunch: 'bg-[#FDF1EC] text-[#B9674B] border border-[#F3D7CC]',
  dinner: 'bg-[#EBF0E6] text-[#343B2B] border border-[#CAD7BF]',
};

/** "Mon, 06 May 2026" */
const longDate = (d: string) => {
  const x = new Date(d + 'T00:00:00');
  return `${x.toLocaleDateString('en-IN', { weekday: 'short' })}, ${x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
};

export function KitchenHome({ name }: { name: string }) {
  const { buildingId, building } = useBuilding();
  const nav = useNavigate();
  const base = useKitchenBase();
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

      {/* Hero Photographic Banner with signature pill button */}
      <SectionPromoBanner
        eyebrow="CULINARY & MESS OPERATIONS"
        title="Wholesome Meals, Delighted Residents."
        subtitle={
          building
            ? `${greet}! Live meal headcounts, daily cooking plans, and inventory tracking for ${building.name}.`
            : `${greet}! Live meal headcounts, daily cooking plans, and kitchen inventory tracking.`
        }
        imageSrc="/owner-assets/food-hero.jpg"
        statsBadge={sum.data?.total_residents ? `${sum.data.total_residents} Residents on Mess` : undefined}
        primaryAction={{
          label: "Today's Cooking",
          onClick: () => nav(`${base}/cooking`),
          icon: UtensilsCrossed,
        }}
        secondaryAction={{
          label: 'Weekly Menu',
          onClick: () => nav(`${base}/menu`),
          icon: CalendarDays,
        }}
      />

      <div className="flex flex-col sm:flex-row gap-2.5">
        <label className="relative flex-1 flex items-center gap-3 bg-[#FFFEFC] border border-[#DED6CB] rounded-2xl h-12 px-4 cursor-pointer shadow-2xs hover:border-[#343B2B]/40 transition-colors">
          <CalendarDays className="size-4.5 text-[#77736B]" aria-hidden />
          <span className="flex-1 text-[14.5px] font-semibold text-[#30271F]">{longDate(date)}</span>
          <ChevronDown className="size-4 text-[#77736B]" aria-hidden />
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
              {/* Total Residents Mess Overview */}
              <section className="rounded-2xl bg-[#FFFEFC] border border-[#DED6CB] p-4 sm:p-5 flex items-center gap-4 shadow-2xs">
                <div className="size-12 rounded-xl bg-[#EBF0E6] text-[#343B2B] flex items-center justify-center shrink-0">
                  <Users className="size-6 text-[#343B2B]" aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold uppercase tracking-wider text-[#77736B]">Total Residents</p>
                  <p className="text-[28px] font-bold text-[#30271F] tabular leading-tight">{s.total_residents}</p>
                </div>
                <p className="text-[11.5px] text-[#77736B] text-right max-w-36 leading-tight">
                  Active on mess plan. Counts dynamically exclude opted-out residents.
                </p>
              </section>

              {/* Today's Menu list */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-[17px] font-bold text-[#30271F]">Today’s Menu</h2>
                    <p className="text-[12px] text-[#77736B]">Tap a meal to record consumed quantities</p>
                  </div>
                  <button
                    onClick={() => nav(`${base}/menu`)}
                    className="text-[13px] font-semibold text-[#343B2B] hover:underline cursor-pointer"
                  >
                    View Week →
                  </button>
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
                          onClick={() => nav(recorded ? `${base}/history` : canRecord ? `${base}/record/${date}/${m.meal_type}` : `${base}/menu`)}
                          className="w-full text-left bg-[#FFFEFC] border border-[#DED6CB] hover:border-[#343B2B]/40 rounded-2xl p-4 flex items-center gap-3.5 cursor-pointer shadow-2xs transition-all hover:translate-y-[-1px] group"
                        >
                          <span className={cx('size-[64px] rounded-xl grid place-items-center shrink-0 shadow-2xs', MEAL_TONE[m.meal_type])}>
                            <meta.icon className="size-7" aria-hidden />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="flex items-center justify-between gap-2">
                              <span className="font-bold text-[15.5px] text-[#30271F]">{meta.label}</span>
                              {recorded ? <Badge status="completed">Recorded</Badge> : <Badge status="pending" />}
                            </span>
                            <span className="block text-[12px] text-[#77736B] mt-0.5">
                              {fmtTime(menu?.serving_start ?? meta.start)} – {fmtTime(menu?.serving_end ?? meta.end)} · <strong className="text-[#30271F]">{s.total_residents - m.not_eating}</strong> expected
                            </span>
                            <span className="block text-[13.5px] text-[#30271F] font-medium mt-1 truncate">
                              {m.menu?.items ?? <span className="text-[#77736B] italic font-normal">No menu set for today</span>}
                            </span>
                          </span>
                          <ChevronRight className="size-5 text-[#77736B] group-hover:text-[#343B2B] group-hover:translate-x-0.5 transition-all shrink-0" aria-hidden />
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

      {/* Kitchen Stock */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-[17px] font-bold text-[#30271F]">Kitchen Stock</h2>
            <p className="text-[12px] text-[#77736B]">Available pantry ingredients</p>
          </div>
          <button
            onClick={() => nav(`${base}/stock`)}
            className="text-[13px] font-semibold text-[#343B2B] hover:underline cursor-pointer"
          >
            View All →
          </button>
        </div>
        <Async state={stock}>
          {() =>
            kitchenStock.length === 0 ? (
              <div className="bg-[#FFFEFC] border border-[#DED6CB] rounded-2xl p-6 text-center shadow-2xs">
                <p className="text-[13px] text-[#77736B]">No ingredients currently issued to the kitchen pantry.</p>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto -mx-4 px-4 pb-1">
                {kitchenStock.map((s) => (
                  <div key={s.item_id} className="w-[104px] shrink-0 bg-[#FFFEFC] border border-[#DED6CB] rounded-2xl p-3 shadow-2xs flex flex-col items-center text-center">
                    <ItemAvatar name={s.name} category={s.category} size={44} />
                    <p className="text-[12px] font-semibold text-[#30271F] mt-2 truncate w-full">{s.name}</p>
                    <p className="text-[11.5px] font-bold text-[#343B2B] tabular mt-0.5">
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
