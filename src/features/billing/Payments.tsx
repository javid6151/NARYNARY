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
import { Async, Button, Card, Empty, Input, PageHeader, StatCard, Tabs, Toast } from '../../components/ui';
import { BuildingPicker } from '../../components/BuildingPicker';
import { listOpenCharges, listPayments } from './api';
import { groupDuesByResident } from './dues';
import { receiptNo } from './receipt';
import type { OpenCharge, Payment } from './types';
import { AddChargeDrawer } from './components/AddChargeDrawer';
import { DuesTable } from './components/DuesTable';
import { GenerateDialog } from './components/GenerateDialog';
import { PaymentHistoryTable } from './components/PaymentHistoryTable';
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
      <PageHeader
        title="Payments"
        subtitle="Rent dues, collections and receipts."
        actions={
          <>
            <BuildingPicker />
            <Button variant="secondary" onClick={() => setCharge(true)}>
              <Plus className="size-4" />
              Add charge
            </Button>
            <Button variant="secondary" onClick={() => setGen(true)}>
              <CalendarPlus className="size-4" />
              Generate monthly rent
            </Button>
            <Button onClick={() => setRecord('pick')}>
              <Wallet className="size-4" />
              Record payment
            </Button>
          </>
        }
      />
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
              { id: 'dues', label: 'Pending dues' },
              { id: 'history', label: 'Payment history' },
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
                <DuesTable rows={byResident} onCollect={(r) => setRecord({ id: r.id, full_name: r.name })} />
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
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
