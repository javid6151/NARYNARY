/**
 * Today's cooking: per meal the expected headcount, who is not eating, and "Record usage"
 * (a meal can be recorded once, and not for a future date).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useAsync } from '../../../lib/hooks';
import { addDays, isoDate } from '../../../lib/format';
import { useBuilding } from '../../access/useBuilding';
import { Async, Badge, Button, Empty, Input } from '../../../components/ui';
import { getMealCounts } from '../api';
import { MEALS } from '../meals';
import type { MealCount } from '../types';
import { KitchenTopBar } from './ui/KitchenHeaders';

export function KitchenCooking() {
  const { buildingId } = useBuilding();
  const nav = useNavigate();
  const [date, setDate] = useState(isoDate());
  const sum = useAsync(
    () => (buildingId ? getMealCounts(buildingId, date) : Promise.resolve(null as MealCount | null)),
    [buildingId, date],
  );
  return (
    <>
      <KitchenTopBar title="Today’s Cooking" />
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => setDate(addDays(date, -1))}>Previous</Button>
        <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Date" className="flex-1" />
        <Button variant="secondary" size="sm" onClick={() => setDate(addDays(date, 1))}>Next</Button>
      </div>
      <Async state={sum}>
        {(s) =>
          !s ? (
            <Empty title="No building assigned" />
          ) : (
            <ul className="space-y-3">
              {s.meals.map((m) => {
                const meta = MEALS.find((x) => x.id === m.meal_type)!;
                const expected = s.total_residents - m.not_eating;
                const pct = s.total_residents ? Math.round((expected / s.total_residents) * 100) : 0;
                return (
                  <li key={m.meal_type} className="bg-white border border-line rounded-2xl p-4">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 font-semibold">
                        <meta.icon className="size-5 text-warn" aria-hidden />
                        {meta.label}
                      </span>
                      {m.report ? <Badge status="completed">Recorded · {m.report.actual ?? '—'} served</Badge> : <Badge status="pending" />}
                    </div>
                    <p className="text-[14px] mt-2">{m.menu?.items ?? <span className="text-muted">No menu set</span>}</p>
                    <div className="flex items-end justify-between mt-3">
                      <div>
                        <p className="text-[28px] font-bold tabular leading-none">{expected}</p>
                        <p className="text-[12px] text-muted">expected of {s.total_residents}</p>
                      </div>
                      <p className="text-[13px] text-bad font-medium">{m.not_eating} not eating</p>
                    </div>
                    <div className="h-1.5 rounded-full bg-subtle mt-2 overflow-hidden" aria-hidden>
                      <div className="h-full bg-kitchen" style={{ width: `${pct}%` }} />
                    </div>
                    {m.unavailable.length > 0 && (
                      <details className="mt-3 text-[13px]">
                        <summary className="cursor-pointer text-ink-2">Who’s not eating ({m.unavailable.length})</summary>
                        <ul className="mt-2 space-y-1">
                          {m.unavailable.map((u, i) => (
                            <li key={i} className="flex justify-between">
                              <span>{u.name}</span>
                              <span className="text-muted">{u.room} / {u.bed}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    {!m.report && date <= isoDate() && (
                      <Button variant="kitchen" className="w-full mt-4" onClick={() => nav(`/kitchen/record/${date}/${m.meal_type}`)}>
                        Record usage
                        <ChevronRight className="size-4" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )
        }
      </Async>
    </>
  );
}
