/**
 * Resident meals: pick a day (yesterday … +3), see each meal's menu, mark "not eating" before the
 * cutoff, and rate meals that have been served. Residents who do nothing are counted as eating.
 */
import { useState } from 'react';
import { CheckCircle2, Clock, Star } from 'lucide-react';
import { useAsync, useMutation } from '../../../lib/hooks';
import { cx } from '../../../lib/cx';
import { addDays, fmtTime, isoDate } from '../../../lib/format';
import { Async, Button, ErrorBanner, Toast } from '../../../components/ui';
import { MEALS } from '../../kitchen/meals';
import type { MealType } from '../../kitchen/types';
import { listDayMenus, listMyMealAvailability, listMyMealReviews, setMealAvailability } from '../api';
import type { ResidentProfile } from '../types';
import { TopBar } from '../ui/Headers';
import { MealReviewDrawer } from './MealReviewDrawer';

export function ResMeals({ p }: { p: ResidentProfile }) {
  const [date, setDate] = useState(isoDate());
  const [toast, setToast] = useState<string | null>(null);
  const [review, setReview] = useState<{ id: string; meal: string; items: string } | null>(null);
  const menus = useAsync(() => listDayMenus(date), [date]);
  const avail = useAsync(() => listMyMealAvailability(date), [date]);
  // Reload my ratings after the review drawer closes.
  const reviews = useAsync(() => listMyMealReviews(), [review]);
  const m = useMutation((meal: MealType, off: boolean) => setMealAvailability(date, meal, off));
  const now = new Date();
  const days = Array.from({ length: 5 }, (_, i) => addDays(isoDate(), i - 1));

  return (
    <>
      <TopBar title="Today's menu" />
      <section className="resident-menu-showcase -mt-2 rounded-2xl p-4">
        <div>
          <p className="resident-hero-eyebrow">Prepared for you</p>
          <h2 className="text-[23px] font-semibold mt-1">A thoughtful table,<br />every day.</h2>
          <p className="text-[12px] text-white/75 mt-2">Check the day’s meals or let the kitchen know you won’t be joining.</p>
        </div>
      </section>
      <p className="text-[13px] text-muted -mt-1">
        Only mark a meal if you <b>won’t</b> be eating — everyone else is counted automatically.
      </p>
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
        {days.map((d) => (
          <button
            key={d}
            onClick={() => setDate(d)}
            className={cx(
              'shrink-0 rounded-xl border px-3 py-2 text-[12.5px] text-center cursor-pointer',
              d === date ? 'resident-menu-date--active font-medium' : 'resident-menu-date',
            )}
          >
            {d === isoDate() ? 'Today' : new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' })}
            <br />
            {new Date(d + 'T00:00:00').getDate()}
          </button>
        ))}
      </div>
      <ErrorBanner error={m.error} />
      <Async state={menus}>
        {(rows) => (
          <div className="space-y-3">
            {MEALS.map((meal) => {
              const menu = rows.find((r) => r.meal_type === meal.id);
              const off = (avail.data ?? []).find((a) => a.meal_type === meal.id)?.is_unavailable ?? false;
              const cutoff = p.cutoffs?.[meal.id] ?? meal.start;
              const closed = now >= new Date(`${date}T${cutoff}`);
              const served = new Date(`${date}T${menu?.serving_end ?? meal.end}`) < now;
              const myReview = (reviews.data ?? []).find((r) => r.meal_menu_id === menu?.id);
              return (
                <div key={meal.id} className="resident-meal-card p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-semibold">
                      <meal.icon className="size-5 text-warn" aria-hidden />
                      {meal.label}
                    </span>
                    {menu?.serving_start && (
                      <span className="text-[12px] text-muted">{fmtTime(menu.serving_start)} – {fmtTime(menu.serving_end)}</span>
                    )}
                  </div>
                  <p className="text-[13.5px] mt-2">{menu?.items ?? <span className="text-muted">Menu not published</span>}</p>
                  {menu?.change_reason && <p className="text-[12px] text-warn mt-1">Updated: {menu.change_reason}</p>}
                  {off ? (
                    <div className="mt-3 rounded-lg bg-ok-bg text-ok text-[13px] px-3 py-2 flex items-center gap-2">
                      <CheckCircle2 className="size-4" />
                      Marked as not having this meal
                    </div>
                  ) : null}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-[12px] text-muted flex items-center gap-1">
                      <Clock className="size-3.5" aria-hidden />
                      {closed ? 'Cutoff passed' : `Change before ${fmtTime(cutoff)}`}
                    </span>
                    {!closed && (
                      <Button
                        size="sm"
                        variant={off ? 'secondary' : 'danger'}
                        busy={m.busy}
                        onClick={async () => {
                          if ((await m.run(meal.id, !off)) !== undefined) {
                            avail.reload();
                            setToast(off ? 'Marked as having the meal' : 'Marked as not having the meal');
                          }
                        }}
                      >
                        {off ? 'Change to having' : 'Mark as unavailable'}
                      </Button>
                    )}
                    {served &&
                      menu &&
                      p.cutoffs?.allow_reviews !== false &&
                      (myReview ? (
                        <span className="text-[12px] text-ok">You rated {myReview.rating} ★</span>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => setReview({ id: menu.id, meal: meal.label, items: menu.items })}>
                          <Star className="size-4" />
                          Rate
                        </Button>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Async>
      {review && (
        <MealReviewDrawer
          menu={review}
          onClose={() => setReview(null)}
          onDone={() => {
            setReview(null);
            setToast('Thanks for your review!');
          }}
        />
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
