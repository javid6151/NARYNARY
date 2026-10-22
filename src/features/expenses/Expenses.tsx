/**
 * Expenses page: one ledger for bills, maintenance, salaries and purchases, plus the Vendors tab.
 * Paid/outstanding come from recorded expense payments, never from editable totals.
 */
import { useMemo, useState } from 'react';
import { AlertCircle, Download, Plus, Receipt, Search, Wallet } from 'lucide-react';
import { useAsync } from '../../lib/hooks';
import { downloadCsv, fmtDate, inr, isoDate, label } from '../../lib/format';
import { useBuilding } from '../access/useBuilding';
import { Async, Badge, Button, Card, Empty, Input, PageHeader, Select, StatCard, Table, Tabs, Td, Toast } from '../../components/ui';
import { BuildingPicker } from '../../components/BuildingPicker';
import { listExpenseCategories } from './api';
import { payStatus } from './payStatus';
import { useExpenses } from './useExpenses';
import { AddExpenseDrawer } from './components/AddExpenseDrawer';
import { ExpenseDetail } from './components/ExpenseDetail';
import { Vendors } from './components/Vendors';
import { SectionPromoBanner } from '../../components/SectionPromoBanner';
import type { ExpenseRow } from './types';

export default function Expenses() {
  const { buildingId, building } = useBuilding();
  const [tab, setTab] = useState<'expenses' | 'vendors'>('expenses');
  const [add, setAdd] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Filters
  const [cat, setCat] = useState('');
  const [ps, setPs] = useState('');
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState(isoDate().slice(0, 7));
  const st = useExpenses(buildingId);
  const cats = useAsync(() => listExpenseCategories(), []);

  const rows = useMemo(
    () =>
      (st.data ?? []).filter(
        (e) =>
          (!month || e.expense_date.startsWith(month)) &&
          (!cat || e.category_id === cat) &&
          (!ps || payStatus(e) === ps) &&
          (!search || `${e.title} ${e.vendors?.name ?? ''}`.toLowerCase().includes(search.toLowerCase())),
      ),
    [st.data, month, cat, ps, search],
  );
  const sum = (k: 'total_amount' | 'paid_amount' | 'outstanding_amount') => rows.reduce((s, e) => s + Number(e[k]), 0);
  const open = (st.data ?? []).find((e) => e.id === openId) ?? null;
  const monthLabel = month
    ? new Date(month + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : 'All time';

  const exportCsv = () =>
    downloadCsv(`expenses-${building?.name}-${month || 'all'}.csv`, rows.map((e: ExpenseRow) => ({
      date: e.expense_date,
      title: e.title,
      category: e.expense_categories.name,
      vendor: e.vendors?.name ?? '',
      recorded_by: e.recorded_by ? `${e.recorded_by.name}${e.recorded_by.role ? ` (${e.recorded_by.role})` : ''}` : '—',
      source: e.source_type,
      total: e.total_amount,
      paid: e.paid_amount,
      outstanding: e.outstanding_amount,
      status: payStatus(e),
    })));

  return (
    <>
      <PageHeader
        title="Expenses"
        subtitle="One ledger for bills, maintenance, salaries and purchases. Paid and outstanding are calculated from payments."
        actions={
          <>
            <BuildingPicker />
            <Button onClick={() => setAdd(true)}>
              <Plus className="size-4" />
              Add expense
            </Button>
          </>
        }
      />
      <SectionPromoBanner
        eyebrow="OPERATIONAL EXPENSES"
        title="Unified Ledgers, Zero Discrepancies."
        subtitle="Manage utility bills, maintenance charges, staff payroll, and vendor disbursements with automated audit tracking."
        imageSrc="/owner-assets/payments-hero.jpg"
        statsBadge={rows.length > 0 ? `${inr(sum('total_amount'))} Total Incurred` : undefined}
        primaryAction={{
          label: 'Add Expense',
          onClick: () => setAdd(true),
          icon: Plus,
        }}
        secondaryAction={{
          label: 'Export Ledger',
          onClick: exportCsv,
          icon: Download,
        }}
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'expenses', label: 'Expenses' },
          { id: 'vendors', label: 'Vendors' },
        ]}
      />
      {tab === 'vendors' ? (
        <Vendors />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            <StatCard icon={<Receipt className="size-5" />} label="Total incurred" value={inr(sum('total_amount'))} hint={monthLabel} />
            <StatCard icon={<Wallet className="size-5" />} tone="ok" label="Amount paid" value={inr(sum('paid_amount'))} />
            <StatCard
              icon={<AlertCircle className="size-5" />}
              tone="bad"
              label="Outstanding"
              value={inr(sum('outstanding_amount'))}
              onClick={() => setPs('unpaid')}
            />
          </div>
          <Card>
            <div className="flex flex-wrap gap-2 mb-4">
              <label className="relative">
                <span className="sr-only">Search</span>
                <Search className="size-4 text-muted absolute left-3 top-3" aria-hidden />
                <Input
                  placeholder="Search title or vendor…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-56"
                />
              </label>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" aria-label="Month" />
              <Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-48" aria-label="Category">
                <option value="">All categories</option>
                {(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Select value={ps} onChange={(e) => setPs(e.target.value)} className="w-40" aria-label="Payment status">
                <option value="">Any payment status</option>
                <option value="paid">Paid</option>
                <option value="partially_paid">Partially paid</option>
                <option value="unpaid">Unpaid</option>
                <option value="overdue">Overdue</option>
              </Select>
              <div className="flex-1" />
              <Button variant="secondary" disabled={!rows.length} onClick={exportCsv}>
                <Download className="size-4" />
                CSV
              </Button>
            </div>
            <Async state={st}>
              {() =>
                rows.length === 0 ? (
                  <Empty title="No expenses match" action={<Button onClick={() => setAdd(true)}>Add expense</Button>} />
                ) : (
                  <Table head={['Date', 'Expense', 'Category', 'Vendor', 'Recorded by', 'Total', 'Paid', 'Outstanding', 'Status', '']}>
                    {rows.map((e) => (
                      <tr key={e.id} className="hover:bg-subtle/60">
                        <Td>{fmtDate(e.expense_date)}</Td>
                        <Td>
                          <p className="font-medium">{e.title}</p>
                          {e.source_type !== 'general' && <p className="text-[12px] text-muted">{label(e.source_type)}</p>}
                        </Td>
                        <Td>{e.expense_categories.name}</Td>
                        <Td>{e.vendors?.name ?? '—'}</Td>
                        <Td>
                          {e.recorded_by ? (
                            <div>
                              <p className="font-medium text-ink leading-tight">{e.recorded_by.name}</p>
                              {e.recorded_by.role && (
                                <span className="inline-block mt-0.5 text-[11px] px-1.5 py-0.5 text-muted bg-surface-subtle border border-line rounded">
                                  {e.recorded_by.role}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </Td>
                        <Td className="tabular">{inr(e.total_amount)}</Td>
                        <Td className="tabular">{inr(e.paid_amount)}</Td>
                        <Td className="tabular">{Number(e.outstanding_amount) > 0 ? inr(e.outstanding_amount) : '—'}</Td>
                        <Td><Badge status={payStatus(e)} /></Td>
                        <Td><Button variant="ghost" size="sm" onClick={() => setOpenId(e.id)}>View</Button></Td>
                      </tr>
                    ))}
                  </Table>
                )
              }
            </Async>
          </Card>
        </>
      )}
      <AddExpenseDrawer
        open={add}
        onClose={() => setAdd(false)}
        onDone={(m) => {
          setAdd(false);
          setToast(m);
          st.reload();
        }}
      />
      {open && (
        <ExpenseDetail
          e={open}
          onClose={() => setOpenId(null)}
          onChanged={(m) => {
            setToast(m);
            st.reload();
          }}
        />
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
