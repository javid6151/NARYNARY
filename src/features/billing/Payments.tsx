/**
 * Payments page: pending dues grouped by resident, payment history, and the actions
 * record payment / add charge / generate monthly rent / reverse (owner) / view receipt.
 */
import { useMemo, useState } from 'react';
import { AlertCircle, CalendarPlus, Download, Plus, Receipt as ReceiptIcon, Search, Wallet } from 'lucide-react';
import { useAsync } from '../../lib/hooks';
import { downloadCsv, inr, isoDate } from '../../lib/format';
import { useAuth } from '../access/useAuth';
import { useBuilding } from '../access/useBuilding';
import { Async, Button, Card, Empty, Input, StatCard, Tabs, Toast } from '../../components/ui';
import { BuildingPicker } from '../../components/BuildingPicker';
import { SectionPromoBanner } from '../../components/SectionPromoBanner';
import { listOpenCharges, listPayments } from './api';
import { groupDuesByResident, type ResidentDues } from './dues';
import { receiptNo } from './receipt';
import type { OpenCharge, Payment } from './types';
import { AddChargeDrawer } from './components/AddChargeDrawer';
import { DuesTable } from './components/DuesTable';
import { GenerateDialog } from './components/GenerateDialog';
import { PaymentHistoryTable } from './components/PaymentHistoryTable';
import { PaymentReminderModal } from './components/PaymentReminderModal';
import { ReceiptView } from './components/ReceiptView';
import { RecordPaymentDrawer } from './components/RecordPaymentDrawer';
import { ReverseDialog } from './components/ReverseDialog';

export default function Payments() {
  const { staff } = useAuth();
  const { buildingId, building } = useBuilding();
  const [tab, setTab] = useState<'dues' | 'history'>('dues');
  const [search, setSearch] = useState('');
  /** 'pick' = open the drawer with a resident picker. */
  const [record, setRecord] = useState<{ id: string; full_name: string } | null | 'pick'>(null);
  const [remindTarget, setRemindTarget] = useState<ResidentDues | null>(null);
  const [gen, setGen] = useState(false);
  const [charge, setCharge] = useState(false);
  const [reverse, setReverse] = useState<Payment | null>(null);
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const today = isoDate();

  const dues = useAsync(() => (!buildingId ? Promise.resolve([] as OpenCharge[]) : listOpenCharges(buildingId)), [buildingId]);
  const history = useAsync(() => (!buildingId ? Promise.resolve([] as Payment[]) : listPayments(buildingId)), [buildingId]);
  const reload = () => {
    dues.reload();
    history.reload();
  };

  const byResident = useMemo(() => groupDuesByResident(dues.data ?? [], today, search), [dues.data, search, today]);
  const totalDue = byResident.reduce((s, r) => s + r.total, 0);
  const totalOverdue = byResident.reduce((s, r) => s + r.overdue, 0);
  const monthStart = today.slice(0, 8) + '01';
  const confirmed = (history.data ?? []).filter((p) => p.status === 'confirmed');
  const collected = confirmed.filter((p) => p.paid_at.slice(0, 10) >= monthStart).reduce((s, p) => s + Number(p.amount), 0);
  const hist = (history.data ?? []).filter((p) => !search || p.residents.full_name.toLowerCase().includes(search.toLowerCase()));
  const done = (m: string) => {
    setToast(m);
    reload();
  };

  const exportCsv = () =>
    downloadCsv(`payments-${building?.name}.csv`, hist.map((p) => ({
      date: p.paid_at.slice(0, 10),
      resident: p.residents.full_name,
      amount: p.amount,
      method: p.payment_method,
      reference: p.transaction_reference ?? '',
      receipt: receiptNo(p.receipts),
      status: p.status,
    })));

  return (
    <>
      <SectionPromoBanner
        fromTop
        eyebrow="FINANCIAL HEALTH"
        title="Authoritative Collections, Transparent Cashflow."
        subtitle={
          building
            ? `${building.name} · Track rent dues, generate automated monthly charges, and record instant receipts.`
            : 'Track rent dues, generate automated monthly charges, and record instant verified receipts.'
        }
        imageSrc="/owner-assets/payments-hero.jpg"
        controls={<BuildingPicker />}
        statsBadge={`${inr(collected)} Collected`}
        primaryAction={{
          label: 'Record Payment',
          onClick: () => setRecord('pick'),
          icon: Wallet,
        }}
        secondaryAction={{
          label: 'Generate Rent',
          onClick: () => setGen(true),
          icon: CalendarPlus,
        }}
        extraActions={
          <button
            onClick={() => setCharge(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 sm:py-3 rounded-2xl bg-[#FFFEFC] hover:bg-[#ECE5DA] text-[#30271F] text-xs sm:text-[13.5px] font-semibold border border-[#DED6CB] transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
          >
            <Plus className="size-4 text-[#343B2B]" />
            <span>Add Charge</span>
          </button>
        }
      />
      <div className="bg-[#FFFEFC] border border-[#DED6CB] rounded-2xl p-4 sm:p-5 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#77736B]">Total Collection</span>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="text-2xl sm:text-3xl font-bold text-[#30271F] tabular">{inr(collected)}</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EAF3E4] text-[#2F6B27] border border-[#CAD7BF]">
              ↑ {confirmed.length} Receipts
            </span>
          </div>
        </div>
        <div className="text-xs text-[#77736B] self-start sm:self-auto flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-[#F5F0E8] border border-[#DED6CB] font-semibold text-[#30271F]">
            {new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard icon={<Wallet className="size-5" />} tone="ok" label="Collected this month" value={inr(collected)} />
        <StatCard
          icon={<AlertCircle className="size-5" />}
          tone="warn"
          label="Total outstanding"
          value={inr(totalDue)}
          hint={`${byResident.length} residents`}
        />
        <StatCard
          icon={<AlertCircle className="size-5" />}
          tone="bad"
          label="Overdue"
          value={inr(totalOverdue)}
          hint={`${byResident.filter((r) => r.overdue > 0).length} residents`}
        />
        <StatCard icon={<ReceiptIcon className="size-5" />} tone="info" label="Payments recorded" value={confirmed.length} />
      </div>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'dues', label: 'Due Payments' },
              { id: 'history', label: 'Receipts & History' },
            ]}
          />
          <div className="flex gap-2 mb-4">
            <label className="relative">
              <span className="sr-only">Search</span>
              <Search className="size-4 text-muted absolute left-3 top-3" aria-hidden />
              <Input placeholder="Search resident…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-56" />
            </label>
            {tab === 'history' && (
              <Button variant="secondary" disabled={!hist.length} onClick={exportCsv}>
                <Download className="size-4" />
                CSV
              </Button>
            )}
          </div>
        </div>
        {tab === 'dues' ? (
          <Async state={dues}>
            {() =>
              byResident.length === 0 ? (
                <Empty title="No pending dues">Everyone is paid up.</Empty>
              ) : (
                <DuesTable
                  rows={byResident}
                  onCollect={(r) => setRecord({ id: r.id, full_name: r.name })}
                  onRemind={(r) => setRemindTarget(r)}
                />
              )
            }
          </Async>
        ) : (
          <Async state={history}>
            {() =>
              hist.length === 0 ? (
                <Empty title="No payments recorded" />
              ) : (
                <PaymentHistoryTable rows={hist} canReverse={staff?.role === 'owner'} onReceipt={setReceipt} onReverse={setReverse} />
              )
            }
          </Async>
        )}
      </Card>

      <RecordPaymentDrawer
        open={record !== null}
        resident={record === 'pick' ? null : record}
        onClose={() => setRecord(null)}
        onDone={(m) => {
          setRecord(null);
          done(m);
        }}
      />
      {buildingId && (
        <GenerateDialog
          open={gen}
          buildingId={buildingId}
          onClose={() => setGen(false)}
          onDone={(m) => {
            setGen(false);
            done(m);
          }}
        />
      )}
      <AddChargeDrawer
        open={charge}
        onClose={() => setCharge(false)}
        onDone={(m) => {
          setCharge(false);
          done(m);
        }}
      />
      <ReverseDialog
        payment={reverse}
        onClose={() => setReverse(null)}
        onDone={() => {
          setReverse(null);
          done('Payment reversed');
        }}
      />
      {receipt && (
        <ReceiptView p={receipt} building={building?.name ?? ''} tenant={staff?.tenant_name ?? ''} onClose={() => setReceipt(null)} />
      )}
      {remindTarget && (
        <PaymentReminderModal
          target={{
            name: remindTarget.name,
            phone: remindTarget.phone,
            totalDue: remindTarget.total,
            overdue: remindTarget.overdue,
            oldestDue: remindTarget.oldest,
          }}
          buildingName={building?.name}
          onClose={() => setRemindTarget(null)}
          onSent={(m) => setToast(m)}
        />
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
