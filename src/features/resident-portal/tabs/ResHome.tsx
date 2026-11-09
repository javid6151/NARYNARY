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
  { icon: Receipt, label: 'My Receipts', to: 'payments?tab=history', tone: 'bg-ok-bg text-ok' },
  { icon: MessageSquareWarning, label: 'Complaints', to: 'complaints', tone: 'bg-[#fff1e6] text-[#d4600f]' },
  { icon: Ticket, label: 'Visitor Pass', to: 'visitors', tone: 'bg-info-bg text-info' },
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
      <SideMenu p={p} open={menuOpen} onClose={() => setMenuOpen(false)} />

      <section className="resident-home-hero -mx-4 -mt-4 sm:-mx-6 lg:-mx-8">
        <BrandHeader subtitle="Resident portal" onMenu={() => setMenuOpen(true)} overlay />
        <div className="resident-home-hero__content px-4 sm:px-6 lg:px-8 pb-6">
          <p className="resident-hero-eyebrow">Your place, made simple</p>
          <h1 className="mt-1 text-[29px] leading-tight font-bold text-[#30271F]">Hello, {p.full_name.split(' ')[0]}.</h1>
          <div className="resident-hero-stay">
            <span className="rounded-full ring-2 ring-[#343B2B]/20 shrink-0"><Avatar name={p.full_name} size={42} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-[#30271F] truncate">Room {p.room_number} · Bed {p.bed_label}</span>
              <span className="block text-[12px] text-[#77736B] truncate">{p.building_name}</span>
            </span>
            <span className="text-[11px] font-semibold text-[#2F6B27] flex items-center gap-1.5 whitespace-nowrap"><span className="resident-status-dot" aria-hidden />Active</span>
          </div>
        </div>
      </section>

      <section className="resident-due-card rounded-2xl p-4">
        <Async state={dues} rows={2}>
          {() => (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="resident-section-eyebrow">Next payment</p>
                  <p className="text-[14px] font-medium mt-1">Rent due</p>
                  <p className="resident-amount text-[28px] font-bold tabular leading-tight mt-1">{inr(next.amount)}</p>
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
                <Button className="resident-primary-button min-w-32" onClick={() => setPay(true)}>Pay now</Button>
              </div>
            </>
          )}
        </Async>
      </section>

      <section>
        <div className="mb-3">
          <p className="resident-section-eyebrow">Shortcuts</p>
          <h2 className="text-[17px] font-semibold mt-0.5">What can we help with?</h2>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          {QUICK_ACTIONS.map(({ icon: Icon, label, to, tone }) => (
            <button
              key={label}
              onClick={() => (to === 'pay' ? setPay(true) : nav(to))}
              className="resident-action flex flex-col items-center justify-center gap-2 px-1 cursor-pointer"
            >
              <span className={cx('resident-action__icon size-10 grid place-items-center', tone)}>
                <Icon className="size-[22px]" aria-hidden />
              </span>
              <span className="text-[11px] leading-tight text-ink-2">{label}</span>
            </button>
          ))}
        </div>
      </section>

      <button
        onClick={() => nav('meals')}
        className="resident-menu-teaser w-full min-h-36 text-left rounded-2xl p-4 relative overflow-hidden cursor-pointer"
      >
        <UtensilsCrossed className="absolute right-3 top-4 size-7 text-white/75" aria-hidden />
        <div className="flex items-center justify-between gap-3 relative">
          <div className="min-w-0">
            <p className="resident-hero-eyebrow">At the table</p>
            <p className="text-[20px] font-semibold mt-1">Today’s menu</p>
            <p className="text-[13px] text-white/78 truncate mt-1">
              {mealMenu ? `${meal.label}: ${mealMenu.items}` : 'Click to view full menu'}
            </p>
          </div>
          <ChevronRight className="size-5 shrink-0" aria-hidden />
        </div>
      </button>

      <section className="resident-notice-preview rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="resident-section-eyebrow">From the desk</p>
            <h2 className="text-[16px] font-semibold mt-0.5">Important notices</h2>
          </div>
          <button onClick={() => nav('notices')} className="resident-link text-[13px] font-medium cursor-pointer">
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
                        n.category === 'important' ? 'bg-info-bg text-info' : 'resident-notice-preview-icon',
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
