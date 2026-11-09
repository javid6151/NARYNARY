/**
 * Resident payments: total outstanding with Pay Now, and tabs
 *   Overview       next rent, rent cycle, security deposit, advance balance, recent and upcoming payments
 *   Rent           rent charges
 *   Other Charges  every non-rent charge (deposit, setup fee, utilities, late fees…)
 *   History        every payment with its receipt; tap for details
 * The filter limits lists to a period.
 */
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, ListFilter, RotateCcw } from 'lucide-react';
import { useAsync } from '../../../lib/hooks';
import { addDays, fmtDate, inr, isoDate, label } from '../../../lib/format';
import { cx } from '../../../lib/cx';
import { Async, Badge, Button, Drawer, Empty } from '../../../components/ui';
import { listMyCharges, listMyPayments } from '../api';
import { advanceBalance, nextRentDue, openCharges, paymentTitle } from '../money';
import type { MyCharge, MyPayment, ResidentProfile } from '../types';
import { TopBar } from '../ui/Headers';
import { PaySheet } from './PaySheet';

type Tab = 'overview' | 'rent' | 'other' | 'history';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'rent', label: 'Rent' },
  { id: 'other', label: 'Other Charges' },
  { id: 'history', label: 'History' },
];
const PERIODS = [
  { id: 'all', label: 'All time', days: null },
  { id: '90', label: 'Last 3 months', days: 90 },
  { id: '365', label: 'Last 12 months', days: 365 },
] as const;

export function ResPayments({ p }: { p: ResidentProfile }) {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'overview') as Tab;
  const setTab = (t: Tab) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true });
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['id']>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [pay, setPay] = useState(false);
  const [receipt, setReceipt] = useState<MyPayment | null>(null);
  const dues = useAsync(() => listMyCharges(), []);
  const pays = useAsync(() => listMyPayments(), []);

  const since = PERIODS.find((x) => x.id === period)!.days;
  const from = since ? addDays(isoDate(), -since) : '';
  const charges = useMemo(() => (dues.data ?? []).filter((c) => !from || c.due_date >= from), [dues.data, from]);
  const payments = useMemo(() => (pays.data ?? []).filter((x) => !from || x.paid_at.slice(0, 10) >= from), [pays.data, from]);
  const allCharges = dues.data ?? [];
  const total = openCharges(allCharges).reduce((s, c) => s + Number(c.balance), 0);
  const next = nextRentDue(allCharges, p.monthly_rent);
  const advance = advanceBalance(pays.data ?? []);
  const upcoming = openCharges(allCharges).sort((a, b) => a.due_date.localeCompare(b.due_date));

  const filterButton = (
    <div className="relative">
      <button
        onClick={() => setFilterOpen(!filterOpen)}
        aria-label="Filter by period"
        aria-expanded={filterOpen}
        className={cx('p-2 rounded-lg hover:bg-white cursor-pointer', period !== 'all' && 'text-brand-600')}
      >
        <ListFilter className="size-5" />
      </button>
      {filterOpen && (
        <ul className="absolute right-0 mt-1 w-44 bg-white border border-line rounded-xl shadow-lg z-30 p-1 text-[13px]">
          {PERIODS.map((x) => (
            <li key={x.id}>
              <button
                onClick={() => {
                  setPeriod(x.id);
                  setFilterOpen(false);
                }}
                className={cx(
                  'w-full text-left px-3 py-2 rounded-lg cursor-pointer',
                  period === x.id ? 'bg-brand-50 text-brand-700 font-medium' : 'hover:bg-subtle',
                )}
              >
                {x.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <>
      <TopBar title="Payments" action={filterButton} />

      <section className="resident-payments-hero -mt-4 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pt-6 pb-8 mb-4">
        <div className="relative z-10">
          <p className="resident-hero-eyebrow">Payments & receipts</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <p className="text-[13.5px] text-[#5C554B]">Total outstanding</p>
              <p className="text-[30px] font-bold text-[#30271F] tabular tracking-tight">{inr(total, true)}</p>
            </div>
            <Button className="resident-primary-button" onClick={() => setPay(true)}>Pay now</Button>
          </div>
          <p className="mt-2 text-[12.5px] text-[#77736B]">A clear record of every charge, payment and receipt.</p>
        </div>
      </section>

      <div role="tablist" className="resident-tablist flex overflow-x-auto border-b border-[var(--resident-line)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cx(
              'resident-tab flex-1 px-2 py-2.5 text-[13px] whitespace-nowrap border-b-2 -mb-px cursor-pointer',
              tab === t.id ? 'resident-tab--active font-medium' : '',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {period !== 'all' && (
        <p className="text-[12px] text-muted -mt-2">
          Showing {PERIODS.find((x) => x.id === period)!.label.toLowerCase()} ·{' '}
                  <button className="resident-link cursor-pointer" onClick={() => setPeriod('all')}>Clear</button>
        </p>
      )}

      {tab === 'overview' && (
        <Async state={pays} rows={4}>
          {() => (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Tile title="Next Rent Due" value={inr(next.amount)} hint={fmtDate(next.dueDate)} />
                <Tile title="Rent Cycle" value="Monthly" hint="Billed on the 1st, due by the 5th" />
                <Tile title="Security Deposit" value={inr(p.security_deposit)} hint="Refundable" />
                <Tile title="Advance Balance" value={inr(advance)} hint={advance > 0 ? 'Applied to your next dues' : 'No advance'} />
              </div>
              <section className="resident-card rounded-2xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-[15px] font-semibold">Recent Payments</h2>
                  <button onClick={() => setTab('history')} className="resident-link text-[13px] font-medium cursor-pointer">
                    View all
                  </button>
                </div>
                {payments.length === 0 ? (
                  <p className="text-[13px] text-muted py-2">No payments yet.</p>
                ) : (
                  <PaymentList rows={payments.slice(0, 4)} onOpen={setReceipt} />
                )}
              </section>
              <section className="resident-card rounded-2xl p-4">
                <h2 className="text-[15px] font-semibold mb-1">Upcoming Payments</h2>
                {upcoming.length === 0 ? (
                  <p className="text-[13px] text-muted py-2">Nothing due right now.</p>
                ) : (
                  <ChargeList rows={upcoming} />
                )}
              </section>
            </>
          )}
        </Async>
      )}

      {(tab === 'rent' || tab === 'other') && (
        <Async state={dues}>
          {() => {
            const rows = charges.filter((c) => (tab === 'rent' ? c.charge_type === 'rent' : c.charge_type !== 'rent'));
            return rows.length === 0 ? (
              <Empty title={tab === 'rent' ? 'No rent charges' : 'No other charges'} />
            ) : (
              <section className="resident-card rounded-2xl px-4">
                <ChargeList rows={rows} showType={tab === 'other'} />
              </section>
            );
          }}
        </Async>
      )}

      {tab === 'history' && (
        <Async state={pays}>
          {() =>
            payments.length === 0 ? (
              <Empty title="No payments yet" />
            ) : (
              <section className="resident-card rounded-2xl px-4">
                <PaymentList rows={payments} onOpen={setReceipt} />
              </section>
            )
          }
        </Async>
      )}

      {pay && <PaySheet p={p} onClose={() => setPay(false)} />}
      {receipt && <ReceiptSheet payment={receipt} business={p.business_name} onClose={() => setReceipt(null)} />}
    </>
  );
}

function Tile({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <div className="resident-payment-tile p-4">
      <p className="text-[12.5px] text-ink-2">{title}</p>
      <p className="text-[20px] font-bold text-brand-600 tabular mt-1">{value}</p>
      <p className="text-[12px] text-muted mt-0.5">{hint}</p>
    </div>
  );
}

function PaymentList({ rows, onOpen }: { rows: MyPayment[]; onOpen: (p: MyPayment) => void }) {
  return (
    <ul className="divide-y divide-line">
      {rows.map((x) => {
        const ok = x.status === 'confirmed';
        return (
          <li key={x.id}>
            <button onClick={() => onOpen(x)} className="w-full flex items-center gap-3 py-3 text-left cursor-pointer">
              {ok ? (
                <CheckCircle2 className="size-6 text-white fill-ok shrink-0" aria-hidden />
              ) : (
                <RotateCcw className="size-6 text-muted shrink-0" aria-hidden />
              )}
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] font-medium truncate">{paymentTitle(x)}</span>
                <span className="text-[12px] text-muted">{fmtDate(x.paid_at)}</span>
              </span>
              <span className="tabular text-[14px] font-medium">{inr(x.amount, true)}</span>
              <Badge status={ok ? 'paid' : x.status}>{ok ? 'Paid' : undefined}</Badge>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ChargeList({ rows, showType }: { rows: MyCharge[]; showType?: boolean }) {
  const today = isoDate();
  return (
    <ul className="divide-y divide-line">
      {rows.map((c) => {
        const overdue = c.status !== 'paid' && c.status !== 'waived' && c.due_date < today;
        return (
          <li key={c.id} className="flex items-center gap-3 py-3">
            <span className="size-9 rounded-xl bg-bad-bg text-bad grid place-items-center shrink-0">
              <Clock className="size-4" aria-hidden />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-medium truncate">{c.description}</span>
              <span className="text-[12px] text-muted">
                {showType ? `${label(c.charge_type)} · ` : ''}Due on {fmtDate(c.due_date)}
                {Number(c.paid_amount) > 0 && Number(c.balance) > 0 ? ` · ${inr(c.balance)} left` : ''}
              </span>
            </span>
            <span className="text-right">
              <span className="block tabular text-[14px] font-medium">{inr(c.amount)}</span>
              {c.status === 'paid' || c.status === 'waived' ? (
                <Badge status={c.status} />
              ) : (
                <span className="text-[12px] font-medium text-bad">{overdue ? 'Overdue' : 'Due'}</span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function ReceiptSheet({ payment: x, business, onClose }: { payment: MyPayment; business: string; onClose: () => void }) {
  const applied = x.payment_allocations.reduce((s, a) => s + Number(a.allocated_amount), 0);
  return (
    <Drawer open onClose={onClose} title="Payment receipt">
      <div className="rounded-xl border border-line p-4 text-[13px] space-y-3">
        <div className="flex justify-between">
          <span className="font-semibold">{business}</span>
          <span className="tabular">{x.receipts[0]?.receipt_number ?? '—'}</span>
        </div>
        <dl className="grid grid-cols-2 gap-y-2">
          <dt className="text-muted">Amount</dt>
          <dd className="text-right font-semibold tabular">{inr(x.amount, true)}</dd>
          <dt className="text-muted">Paid on</dt>
          <dd className="text-right">{fmtDate(x.paid_at)}</dd>
          <dt className="text-muted">Method</dt>
          <dd className="text-right">{label(x.payment_method)}</dd>
          <dt className="text-muted">Reference</dt>
          <dd className="text-right">{x.transaction_reference ?? '—'}</dd>
          <dt className="text-muted">Status</dt>
          <dd className="text-right">{x.status === 'confirmed' ? 'Paid' : label(x.status)}</dd>
        </dl>
        <div>
          <p className="text-muted mb-1">Applied to</p>
          <ul className="space-y-1">
            {x.payment_allocations.map((a, i) => (
              <li key={i} className="flex justify-between">
                <span>{a.rent_charges?.description ?? 'Charge'}</span>
                <span className="tabular">{inr(a.allocated_amount, true)}</span>
              </li>
            ))}
            {Number(x.amount) - applied > 0 && (
              <li className="flex justify-between">
                <span>Kept as advance</span>
                <span className="tabular">{inr(Number(x.amount) - applied, true)}</span>
              </li>
            )}
          </ul>
        </div>
      </div>
    </Drawer>
  );
}
