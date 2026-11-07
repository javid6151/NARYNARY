/**
 * Chef menu view: seven days from a start date, one card per day; click a meal to add/edit it.
 * Redesigned with the ZIPNARY Enterprise design system (Warm Ivory, Porcelain White, Deep Olive).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UtensilsCrossed } from 'lucide-react';
import { useAsync } from '../../../lib/hooks';
import { addDays, isoDate } from '../../../lib/format';
import { useBuilding } from '../../access/useBuilding';
import { Async, Card, Input, Toast } from '../../../components/ui';
import { BuildingPicker } from '../../../components/BuildingPicker';
import { SectionPromoBanner } from '../../../components/SectionPromoBanner';
import { listMenus } from '../api';
import { MEALS } from '../meals';
import type { MealType, Menu } from '../types';
import { MenuDrawer } from '../components/MenuDrawer';
import { KitchenTopBar } from './ui/KitchenHeaders';
import { useKitchenBase } from './useKitchenBase';

export function KitchenMenu() {
  const { buildingId } = useBuilding();
  const nav = useNavigate();
  const base = useKitchenBase();
  const [start, setStart] = useState(isoDate());
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const st = useAsync(
    () => (!buildingId ? Promise.resolve([] as Menu[]) : listMenus(buildingId, days[0], days[6])),
    [buildingId, start],
  );
  const [edit, setEdit] = useState<{ date: string; meal: MealType; menu?: Menu } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <KitchenTopBar title="Weekly Menu Planner" />

      <SectionPromoBanner
        eyebrow="CULINARY CALENDAR"
        title="7-Day Weekly Menu Planner."
        subtitle="Schedule balanced breakfast, lunch, and dinner menus for all hostel residents."
        imageSrc="/owner-assets/food-hero.jpg"
        primaryAction={{
          label: "Today's Cooking",
          onClick: () => nav(`${base}/cooking`),
          icon: UtensilsCrossed,
        }}
      />

      <div className="flex flex-col sm:flex-row gap-2.5">
        <BuildingPicker />
        <Input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="flex-1 rounded-2xl bg-[#FFFEFC] border-[#DED6CB]"
          aria-label="Start date"
        />
      </div>

      <Async state={st}>
        {(menus) => (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {days.map((d) => (
              <Card
                key={d}
                title={new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'short',
                })}
                className="bg-[#FFFEFC] border-[#DED6CB] rounded-2xl shadow-2xs"
              >
                <ul className="space-y-2 text-[13px]">
                  {MEALS.map((m) => {
                    const menu = menus.find((x) => x.meal_date === d && x.meal_type === m.id);
                    return (
                      <li key={m.id}>
                        <button
                          onClick={() => setEdit({ date: d, meal: m.id, menu })}
                          className="w-full text-left rounded-xl border border-[#DED6CB] p-3 hover:border-[#343B2B]/40 hover:bg-[#EBF0E6]/50 cursor-pointer transition-colors shadow-2xs"
                        >
                          <span className="text-[11.5px] font-bold uppercase tracking-wider text-[#77736B] block mb-0.5">
                            {m.label}
                          </span>
                          <span className="block font-medium text-[#30271F] text-[13.5px]">
                            {menu?.items ?? <span className="text-[#B9674B] font-normal italic">+ Add menu items</span>}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </Async>

      {edit && buildingId && (
        <MenuDrawer
          buildingId={buildingId}
          date={edit.date}
          meal={edit.meal}
          menu={edit.menu}
          onClose={() => setEdit(null)}
          onSaved={(msg) => {
            setEdit(null);
            setToast(msg);
            st.reload();
          }}
        />
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
