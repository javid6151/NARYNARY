/** Resident meal reviews since a date: average, rating per meal, distribution and the full list. */
import { useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { useAsync } from '../../../lib/hooks';
import { addDays, fmtDate, isoDate } from '../../../lib/format';
import { Async, Card, Empty, Input, StatCard, Table, Td } from '../../../components/ui';
import { HBars } from '../../../components/Charts';
import { listMealReviews } from '../api';
import { MEALS } from '../meals';

export function MealReviews({ buildingId }: { buildingId: string }) {
  const [from, setFrom] = useState(addDays(isoDate(), -30));
  const st = useAsync(() => listMealReviews(buildingId, from), [buildingId, from]);
  const rows = useMemo(() => st.data ?? [], [st.data]);
  const avg = rows.length ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : 0;
  const byMeal = useMemo(
    () =>
      MEALS.map((m) => {
        const rs = rows.filter((r) => r.meal_menus.meal_type === m.id);
        return { name: m.label, value: rs.length ? Math.round((rs.reduce((s, r) => s + r.rating, 0) / rs.length) * 10) / 10 : 0 };
      }),
    [rows],
  );
  const dist = [5, 4, 3, 2, 1].map((n) => ({ name: `${n} ★`, value: rows.filter((r) => r.rating === n).length }));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-[13px]">
        <span className="text-muted">Since</span>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" aria-label="From date" />
      </div>
      <Async state={st}>
        {() => (
          <>
            <div className="grid md:grid-cols-3 gap-3">
              <StatCard
                icon={<Star className="size-5" />}
                tone="warn"
                label="Average rating"
                value={rows.length ? `${avg.toFixed(1)} / 5` : '—'}
                hint={`${rows.length} reviews`}
              />
              <Card title="Rating by meal">
                <HBars rows={byMeal} format={(n) => (n ? `${n} ★` : '—')} />
              </Card>
              <Card title="Distribution">
                <HBars rows={dist} format={(n) => String(n)} />
              </Card>
            </div>
            <Card title="All reviews">
              {rows.length === 0 ? (
                <Empty title="No reviews in this period" />
              ) : (
                <Table head={['Date', 'Resident', 'Meal', 'Rating', 'Comment']}>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <Td>{fmtDate(r.meal_menus.meal_date)}</Td>
                      <Td>{r.residents.full_name}</Td>
                      <Td>
                        <span className="capitalize">{r.meal_menus.meal_type}</span>
                        <p className="text-[12px] text-muted max-w-56 truncate">{r.meal_menus.items}</p>
                      </Td>
                      <Td>
                        <span className="tabular font-medium" aria-label={`${r.rating} out of 5`}>
                          {'★'.repeat(r.rating)}
                          <span className="text-line">{'★'.repeat(5 - r.rating)}</span>
                        </span>
                      </Td>
                      <Td className="max-w-72">{r.comment ?? <span className="text-muted">—</span>}</Td>
                    </tr>
                  ))}
                </Table>
              )}
            </Card>
          </>
        )}
      </Async>
    </div>
  );
}
