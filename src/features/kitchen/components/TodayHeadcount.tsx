/** Per-meal expected headcount for a date and the list of residents not eating the selected meal. */
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAsync } from '../../../lib/hooks';
import { addDays, isoDate } from '../../../lib/format';
import { cx } from '../../../lib/cx';
import { Async, Button, Card, Empty, Input, Table, Td } from '../../../components/ui';
import { getMealCounts } from '../api';
import { MEALS } from '../meals';
import type { MealType } from '../types';

export function TodayHeadcount({ buildingId }: { buildingId: string }) {
  const [date, setDate] = useState(isoDate());
  const st = useAsync(() => getMealCounts(buildingId, date), [buildingId, date]);
  const [meal, setMeal] = useState<MealType>('lunch');
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
          <ChevronLeft className="size-4" />
        </Button>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" aria-label="Date" />
        <Button variant="secondary" size="sm" onClick={() => setDate(addDays(date, 1))} aria-label="Next day">
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <Async state={st}>
        {(s) => {
          const sel = s.meals.find((m) => m.meal_type === meal)!;
          return (
            <>
              <div className="grid md:grid-cols-3 gap-3">
                {s.meals.map((m) => {
                  const meta = MEALS.find((x) => x.id === m.meal_type)!;
                  const expected = s.total_residents - m.not_eating;
                  return (
                    <button
                      key={m.meal_type}
                      onClick={() => setMeal(m.meal_type)}
                      aria-pressed={meal === m.meal_type}
                      className={cx(
                        'text-left rounded-xl border bg-white p-4 cursor-pointer',
                        meal === m.meal_type ? 'border-brand-500 ring-2 ring-brand-100' : 'border-line',
                      )}
                    >
                      <div className="flex items-center gap-2 text-[13px] text-muted">
                        <meta.icon className="size-4" aria-hidden />
                        {meta.label}
                      </div>
                      <p className="text-3xl font-semibold tabular mt-2">{expected}</p>
                      <p className="text-[12px] text-muted">
                        expected of {s.total_residents} · <span className="text-bad">{m.not_eating} not eating</span>
                      </p>
                      <p className="text-[13px] mt-2 truncate">{m.menu?.items ?? <span className="text-muted">No menu set</span>}</p>
                      {m.report && <p className="text-[12px] text-ok mt-1">Kitchen recorded {m.report.actual ?? '—'} served</p>}
                    </button>
                  );
                })}
              </div>
              <Card title={`Not eating — ${MEALS.find((x) => x.id === meal)!.label} (${sel.unavailable.length})`}>
                {sel.unavailable.length === 0 ? (
                  <Empty title="Everyone is eating">Residents only respond when they will skip a meal.</Empty>
                ) : (
                  <Table head={['#', 'Name', 'Room / Bed', 'Marked at']}>
                    {sel.unavailable.map((u, i) => (
                      <tr key={u.name + i}>
                        <Td>{i + 1}</Td>
                        <Td className="font-medium">{u.name}</Td>
                        <Td>{u.room} / {u.bed}</Td>
                        <Td className="text-muted">
                          {new Date(u.marked_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' })}
                        </Td>
                      </tr>
                    ))}
                  </Table>
                )}
              </Card>
            </>
          );
        }}
      </Async>
    </div>
  );
}
