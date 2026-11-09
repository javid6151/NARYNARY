/**
 * Today's cooking: per meal the expected headcount, who is not eating, and "Record usage"
 * (a meal can be recorded once, and not for a future date).
 * Redesigned with the ZIPNARY Enterprise design system (Warm Ivory, Porcelain White, Deep Olive).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarDays } from 'lucide-react';
import { useAsync } from '../../../lib/hooks';
import { addDays, isoDate } from '../../../lib/format';
import { useBuilding } from '../../access/useBuilding';
import { Async, Badge, Button, Empty, Input } from '../../../components/ui';
import { SectionPromoBanner } from '../../../components/SectionPromoBanner';
import { getMealCounts } from '../api';
import { MEALS } from '../meals';
import type { MealCount } from '../types';
import { KitchenTopBar } from './ui/KitchenHeaders';
import { useKitchenBase } from './useKitchenBase';

export function KitchenCooking() {
  const { buildingId } = useBuilding();
  const nav = useNavigate();
  const base = useKitchenBase();
  const [date, setDate] = useState(isoDate());
  const sum = useAsync(
    () => (buildingId ? getMealCounts(buildingId, date) : Promise.resolve(null as MealCount | null)),
    [buildingId, date],
  );

  return (
    <>
      <KitchenTopBar title="Today’s Cooking & Headcount" />

      <SectionPromoBanner
        fromTop
        className="!-mt-4 sm:!-mt-4 lg:!-mt-4"
        eyebrow="DAILY MEAL PRODUCTION"
        title="Live Headcounts, Zero Waste."
        subtitle="Review resident responses, track meal counts, and record ingredient usage."
        imageSrc="/owner-assets/food-hero.jpg"
        statsBadge={sum.data?.total_residents ? `${sum.data.total_residents} Residents` : undefined}
        primaryAction={{
          label: 'Weekly Menu Planner',
          onClick: () => nav(`${base}/menu`),
          icon: CalendarDays,
        }}
      />

      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => setDate(addDays(date, -1))}>
          ← Previous
        </Button>
        <Input
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          aria-label="Date"
          className="flex-1 rounded-xl bg-[#FFFEFC] border-[#DED6CB]"
        />
        <Button variant="secondary" size="sm" onClick={() => setDate(addDays(date, 1))}>
          Next →
        </Button>
      </div>

      <Async state={sum}>
        {(s) =>
          !s ? (
            <Empty title="No building assigned" />
          ) : (
            <ul className="space-y-4">
              {s.meals.map((m) => {
                const meta = MEALS.find((x) => x.id === m.meal_type)!;
                const expected = s.total_residents - m.not_eating;
                const pct = s.total_residents ? Math.round((expected / s.total_residents) * 100) : 0;
                return (
                  <li key={m.meal_type} className="bg-[#FFFEFC] border border-[#DED6CB] rounded-2xl p-5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2.5 font-bold text-base text-[#30271F]">
                        <meta.icon className="size-5 text-[#B45309]" aria-hidden />
                        {meta.label}
                      </span>
                      {m.report ? <Badge status="completed">Recorded · {m.report.actual ?? '—'} served</Badge> : <Badge status="pending" />}
                    </div>
                    <p className="text-[14px] text-[#30271F] font-medium mt-2">
                      {m.menu?.items ?? <span className="text-[#77736B] italic font-normal">No menu set</span>}
                    </p>
                    <div className="flex items-end justify-between mt-3">
                      <div>
                        <p className="text-[32px] font-bold text-[#30271F] tabular leading-none">{expected}</p>
                        <p className="text-[12px] text-[#77736B] mt-0.5">expected of {s.total_residents} residents</p>
                      </div>
                      <span className="text-[12.5px] text-[#B9674B] font-semibold px-2.5 py-1 rounded-lg bg-[#FDF1EC]">
                        {m.not_eating} not eating
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[#EBF0E6] mt-3 overflow-hidden" aria-hidden>
                      <div className="h-full bg-[#343B2B] transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    {m.unavailable.length > 0 && (
                      <details className="mt-3 text-[13px] text-[#77736B]">
                        <summary className="cursor-pointer font-medium hover:text-[#30271F]">
                          Who’s not eating ({m.unavailable.length})
                        </summary>
                        <ul className="mt-2 space-y-1 pl-2 border-l-2 border-[#DED6CB]">
                          {m.unavailable.map((u, i) => (
                            <li key={i} className="flex justify-between text-xs py-0.5">
                              <span className="font-medium text-[#30271F]">{u.name}</span>
                              <span className="text-[#77736B]">{u.room} / {u.bed}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    {!m.report && date <= isoDate() && (
                      <button
                        onClick={() => nav(`${base}/record/${date}/${m.meal_type}`)}
                        className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#343B2B] hover:bg-[#2A3022] text-white font-semibold text-sm transition-all hover:shadow-md cursor-pointer"
                      >
                        <span>Record Ingredient Usage</span>
                        <ArrowRight className="size-4" />
                      </button>
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
