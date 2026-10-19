/** Monday–Sunday menu grid; click a cell to add or edit that meal. Past menus are read-only. */
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { useAsync } from '../../../lib/hooks';
import { addDays, fmtDate, isoDate } from '../../../lib/format';
import { Async, Button, Card, Table, Td, Toast } from '../../../components/ui';
import { listMenus } from '../api';
import { MEALS, monday } from '../meals';
import type { MealType, Menu } from '../types';
import { MenuDrawer } from './MenuDrawer';

export function WeekPlanner({ buildingId }: { buildingId: string }) {
  const [start, setStart] = useState(monday(isoDate()));
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const st = useAsync(() => listMenus(buildingId, days[0], days[6]), [buildingId, start]);
  const [edit, setEdit] = useState<{ date: string; meal: MealType; menu?: Menu } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const find = (d: string, m: MealType) => (st.data ?? []).find((x) => x.meal_date === d && x.meal_type === m);
  const today = isoDate();

  const weekNav = (
    <div className="flex items-center gap-2">
      <Button variant="secondary" size="sm" onClick={() => setStart(addDays(start, -7))} aria-label="Previous week">
        <ChevronLeft className="size-4" />
      </Button>
      <span className="text-[13px] tabular">{fmtDate(days[0])} – {fmtDate(days[6])}</span>
      <Button variant="secondary" size="sm" onClick={() => setStart(addDays(start, 7))} aria-label="Next week">
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );

  return (
    <Card title="Weekly menu planner" action={weekNav}>
      <Async state={st}>
        {() => (
          <Table head={['Day', ...MEALS.map((m) => m.label)]}>
            {days.map((d) => (
              <tr key={d} className={d === today ? 'bg-brand-50/50' : ''}>
                <Td className="whitespace-nowrap font-medium">
                  {new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}
                </Td>
                {MEALS.map((m) => {
                  const menu = find(d, m.id);
                  const past = d < today;
                  return (
                    <Td key={m.id}>
                      <button
                        disabled={past && !!menu}
                        onClick={() => setEdit({ date: d, meal: m.id, menu })}
                        className={
                          'group w-full text-left flex items-start gap-2 rounded-md p-1 -m-1 hover:bg-subtle ' +
                          'disabled:hover:bg-transparent cursor-pointer disabled:cursor-default'
                        }
                      >
                        <span className="flex-1">
                          {menu ? menu.items : <span className="text-muted">Add menu</span>}
                          {menu?.change_reason && <span className="block text-[11px] text-warn">Changed: {menu.change_reason}</span>}
                        </span>
                        {!(past && menu) && <Pencil className="size-3.5 text-muted opacity-0 group-hover:opacity-100 mt-0.5" aria-hidden />}
                      </button>
                    </Td>
                  );
                })}
              </tr>
            ))}
          </Table>
        )}
      </Async>
      {edit && (
        <MenuDrawer
          buildingId={buildingId}
          date={edit.date}
          meal={edit.meal}
          menu={edit.menu}
          onClose={() => setEdit(null)}
          onSaved={(m) => {
            setEdit(null);
            setToast(m);
            st.reload();
          }}
        />
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </Card>
  );
}
