/** Chef menu view: seven days from a start date, one card per day; click a meal to add/edit it. */
import { useState } from 'react';
import { useAsync } from '../../../lib/hooks';
import { addDays, isoDate } from '../../../lib/format';
import { useBuilding } from '../../access/useBuilding';
import { Async, Card, Input, Toast } from '../../../components/ui';
import { BuildingPicker } from '../../../components/BuildingPicker';
import { listMenus } from '../api';
import { MEALS } from '../meals';
import type { MealType, Menu } from '../types';
import { MenuDrawer } from '../components/MenuDrawer';
import { KitchenTopBar } from './ui/KitchenHeaders';

export function KitchenMenu() {
  const { buildingId } = useBuilding();
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
      <KitchenTopBar title="Menu — next 7 days" />
      <div className="flex gap-2">
        <BuildingPicker />
        <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="flex-1" aria-label="Start date" />
      </div>
      <Async state={st}>
        {(menus) => (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {days.map((d) => (
              <Card key={d} title={new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short' })}>
                <ul className="space-y-2 text-[13px]">
                  {MEALS.map((m) => {
                    const menu = menus.find((x) => x.meal_date === d && x.meal_type === m.id);
                    return (
                      <li key={m.id}>
                        <button
                          onClick={() => setEdit({ date: d, meal: m.id, menu })}
                          className="w-full text-left rounded-lg border border-line p-2.5 hover:border-kitchen/40 cursor-pointer"
                        >
                          <span className="text-[12px] text-muted">{m.label}</span>
                          <span className="block">{menu?.items ?? <span className="text-muted">+ Add menu</span>}</span>
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
