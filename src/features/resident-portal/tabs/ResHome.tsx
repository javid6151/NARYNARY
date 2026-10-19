/**
 * Resident home: greeting card, next rent due + outstanding with Pay Now, quick actions,
 * today's menu, and the latest notices.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, FileText, Megaphone, MessageSquareWarning, Receipt, Ticket, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import { useAsync } from '../../../lib/hooks';
import { fmtDate, fmtDateTime, inr, isoDate } from '../../../lib/format';
import { cx } from '../../../lib/cx';
import { Async, Avatar, Badge, Button } from '../../../components/ui';
import { MEALS } from '../../kitchen/meals';
import { listLatestNotices, listMenuSummary, listMyCharges } from '../api';
import { nextRentDue, openCharges } from '../money';
import type { ResidentProfile } from '../types';
import { BrandHeader } from '../ui/Headers';
import { SideMenu } from '../ui/SideMenu';
import { PaySheet } from './PaySheet';

const QUICK_ACTIONS: { icon: LucideIcon; label: string; to: string; tone: string }[] = [
  { icon: FileText, label: 'Pay Rent', to: 'pay', tone: 'bg-brand-50 text-brand-600' },
  { icon: Receipt, label: 'My Receipts', to: '/resident/payments?tab=history', tone: 'bg-ok-bg text-ok' },
  { icon: MessageSquareWarning, label: 'Complaints', to: '/resident/complaints', tone: 'bg-[#fff1e6] text-[#d4600f]' },
  { icon: Ticket, label: 'Visitor Pass', to: '/resident/visitors', tone: 'bg-info-bg text-info' },
];

/** Next meal still to be served today (or the first meal when all are done). */
function nextMealIndex() {
  const now = new Date().toTimeString().slice(0, 5);
  const i = MEALS.findIndex((m) => m.end > now);
  return i === -1 ? 0 : i;
}

export function ResHome({ p }: { p: ResidentProfile }) {
  const nav = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pay, setPay] = useState(false);
  const dues = useAsync(() => listMyCharges(), []);
  const today = isoDate();
  const menu = useAsync(() => listMenuSummary(today), [today]);
  const notices = useAsync(() => listLatestNotices(), []);
  const charges = dues.data ?? [];
  const outstanding = openCharges(charges).reduce((s, c) => s + Number(c.balance), 0);
  const next = nextRentDue(charges, p.monthly_rent);
  const meal = MEALS[nextMealIndex()];
  const mealMenu = (menu.data ?? []).find((m) => m.meal_type === meal.id);

  return (
    <>
      <BrandHeader subtitle="PG & Hostel" onMenu={() => setMenuOpen(true)} />
      <SideMenu p={p} open={menuOpen} onClose={() => setMenuOpen(false)} />

      <section className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white p-4 flex items-center gap-4 shadow-sm">
        <span className="rounded-full ring-4 ring-white/80">
          <Avatar name={p.full_name} size={60} />
        </span>
        <div className="min-w-0">
          <p className="text-[18px] font-semibold">Hello, {p.full_name.split(' ')[0]} 👋</p>
          <p className="text-[14px] text-brand-100">Room {p.room_number}, {p.building_name}</p>
          <p className="text-[13px] text-brand-100 flex items-center gap-1.5 mt-0.5">
            <span className="size-2 rounded-full bg-green-400" aria-hidden />
            Active Resident
          </p>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-line p-4">
        <Async state={dues} rows={2}>
          {() => (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[14px] font-medium">Next Rent Due</p>
                  <p className="text-[26px] font-bold text-brand-600 tabular leading-tight mt-1">{inr(next.amount)}</p>
                </div>
                <div className="text-right text-[13px]">
                  <p className="text-muted">{next.billed ? 'Due on' : 'Next bill due'}</p>
                  <p className="font-medium">{fmtDate(next.dueDate)}</p>
                </div>
              </div>
              <div className="flex items-end justify-between gap-3 mt-3">
                <div>
                  <p className="text-[13px] text-muted">Outstanding</p>
                  <p className={cx('text-[18px] font-semibold tabular', outstanding > 0 ? 'text-bad' : 'text-ok')}>
                    {outstanding > 0 ? inr(outstanding, true) : 'All paid'}
                  </p>
                </div>
                <Button className="min-w-32" onClick={() => setPay(true)}>Pay Now</Button>
              </div>
            </>
          )}
        </Async>
      </section>

      <section className="bg-white rounded-2xl border border-line p-4">
        <h2 className="text-[15px] font-semibold mb-3">Quick Actions</h2>
        <div className="grid grid-cols-4 gap-2 text-center">
          {QUICK_ACTIONS.map(({ icon: Icon, label, to, tone }) => (
            <button
              key={label}
              onClick={() => (to === 'pay' ? setPay(true) : nav(to))}
              className="flex flex-col items-center gap-2 cursor-pointer"
            >
              <span className={cx('size-12 rounded-xl grid place-items-center', tone)}>
                <Icon className="size-[22px]" aria-hidden />
              </span>
              <span className="text-[12px] text-ink-2">{label}</span>
            </button>
          ))}
        </div>
      </section>

      <button
        onClick={() => nav('/resident/meals')}
        className="w-full text-left rounded-2xl p-4 bg-gradient-to-r from-[#4a1c2b] to-[#7a3a2c] text-white relative overflow-hidden cursor-pointer"
      >
        <UtensilsCrossed className="absolute -right-3 -bottom-4 size-28 text-white/10" aria-hidden />
        <div className="flex items-center justify-between gap-3 relative">
          <div className="min-w-0">
            <p className="text-[18px] font-semibold">Today’s Menu</p>
            <p className="text-[13px] text-white/80 truncate">
              {mealMenu ? `${meal.label}: ${mealMenu.items}` : 'Click to view full menu'}
            </p>
          </div>
          <ChevronRight className="size-5 shrink-0" aria-hidden />
        </div>
      </button>

      <section className="bg-white rounded-2xl border border-line p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[15px] font-semibold">Important Notices</h2>
          <button onClick={() => nav('/resident/notices')} className="text-[13px] text-brand-600 font-medium cursor-pointer">
            View all
          </button>
        </div>
        <Async state={notices}>
          {(rows) =>
            rows.length === 0 ? (
              <p className="text-[13px] text-muted py-2">No notices.</p>
            ) : (
              <ul className="divide-y divide-line">
                {rows.map((n) => (
                  <li key={n.id} className="py-3 flex items-center gap-3">
                    <span
                      className={cx(
                        'size-10 rounded-xl grid place-items-center shrink-0',
                        n.category === 'important' ? 'bg-info-bg text-info' : 'bg-brand-50 text-brand-600',
                      )}
                    >
                      <Megaphone className="size-5" aria-hidden />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="text-[14px] font-medium truncate">{n.title}</span>
                        {n.category === 'important' && <Badge status="high">Important</Badge>}
                      </span>
                      <span className="block text-[12.5px] text-muted">{fmtDateTime(n.published_at)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )
          }
        </Async>
      </section>

      {pay && <PaySheet p={p} onClose={() => setPay(false)} />}
    </>
  );
}
