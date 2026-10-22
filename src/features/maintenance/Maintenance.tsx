/**
 * Maintenance page: repair/service requests and their costs.
 * Costs are rows in the shared expense ledger (source_type 'maintenance' or a maintenance category),
 * so nothing is duplicated between this page and Expenses.
 */
import { useMemo, useState } from 'react';
import { AlarmClock, AlertCircle, Loader, Plus, Receipt, Search, Wrench } from 'lucide-react';
import { useAsync } from '../../lib/hooks';
import { fmtDate, inr, isoDate, label } from '../../lib/format';
import { useBuilding } from '../access/useBuilding';
import { Async, Badge, Button, Card, Empty, Input, PageHeader, StatCard, Table, Tabs, Td, Toast } from '../../components/ui';
import { BuildingPicker } from '../../components/BuildingPicker';
import { useExpenses } from '../expenses/useExpenses';
import { AddExpenseDrawer } from '../expenses/components/AddExpenseDrawer';
import { ExpenseDetail } from '../expenses/components/ExpenseDetail';
import { listMaintenanceExpenseCategoryIds, listMaintenanceRequests } from './api';
import { ACTIVE_STATUSES, isOverdue, PRIORITY_ORDER } from './status';
import { CreateRequestDrawer } from './components/CreateRequestDrawer';
import { MaintenanceExpenses } from './components/MaintenanceExpenses';
import { RequestDetail } from './components/RequestDetail';
import { SectionPromoBanner } from '../../components/SectionPromoBanner';
import type { MaintenanceRequest } from './types';

type Tab = 'all' | 'open' | 'assigned' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
const TABS: Tab[] = ['all', 'open', 'assigned', 'in_progress', 'on_hold', 'completed', 'cancelled'];

export default function Maintenance() {
  const { buildingId } = useBuilding();
  const [view, setView] = useState<'requests' | 'expenses'>('requests');
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [create, setCreate] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [expId, setExpId] = useState<string | null>(null);
  const [addExp, setAddExp] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const st = useAsync(
    () => (!buildingId ? Promise.resolve([] as MaintenanceRequest[]) : listMaintenanceRequests(buildingId)),
    [buildingId],
  );
  const exp = useExpenses(buildingId);
  const cats = useAsync(() => listMaintenanceExpenseCategoryIds(), []);
  const maintCatIds = new Set((cats.data ?? []).map((c) => c.id));
  // Maintenance costs = expenses created from a request + expenses filed under a maintenance category.
  const mExpenses = (exp.data ?? []).filter((e) => e.source_type === 'maintenance' || maintCatIds.has(e.category_id));
  const monthStart = isoDate().slice(0, 8) + '01';
  const now = new Date().toISOString();

  const rows = useMemo(() => st.data ?? [], [st.data]);
  const overdue = rows.filter((r) => isOverdue(r, now));
  // Active first, then by priority, then overdue first, then oldest first.
  const filtered = useMemo(
    () =>
      rows
        .filter(
          (r) =>
            (tab === 'all' || r.status === tab) &&
            (!search || `${r.title} ${r.rooms?.room_number ?? ''}`.toLowerCase().includes(search.toLowerCase())),
        )
        .sort(
          (a, b) =>
            (ACTIVE_STATUSES.includes(b.status) ? 1 : 0) - (ACTIVE_STATUSES.includes(a.status) ? 1 : 0) ||
            PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
            Number(!!(b.due_at && b.due_at < now)) - Number(!!(a.due_at && a.due_at < now)) ||
            a.reported_at.localeCompare(b.reported_at),
        ),
    [rows, tab, search, now],
  );
  const open = rows.find((r) => r.id === openId) ?? null;
  const openExpense = expId ? (exp.data ?? []).find((e) => e.id === expId) : undefined;
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const monthSpend = mExpenses.filter((e) => e.expense_date >= monthStart).reduce((s, e) => s + Number(e.total_amount), 0);
  const outstanding = mExpenses.reduce((s, e) => s + Number(e.outstanding_amount), 0);
  const showRequests = (t: Tab) => {
    setView('requests');
    setTab(t);
  };

  return (
    <>
      <PageHeader
        title="Maintenance"
        subtitle="Repairs, service requests and their costs."
        actions={
          <>
            <BuildingPicker />
            <Button onClick={() => setCreate(true)}>
              <Plus className="size-4" />
              New request
            </Button>
          </>
        }
      />
      <SectionPromoBanner
        eyebrow="FACILITY OPERATIONS"
        title="Flawless Spaces, Prompt Resolutions."
        subtitle="Coordinate repairs, assign technicians, track work orders, and maintain unified service expense ledgers."
        imageSrc="/owner-assets/lounge-promo.jpg"
        statsBadge={`${count('open') + count('assigned')} Active Requests`}
        primaryAction={{
          label: 'New Work Order',
          onClick: () => setCreate(true),
          icon: Wrench,
        }}
        secondaryAction={{
          label: 'Maintenance Spend',
          onClick: () => setView('expenses'),
          icon: Receipt,
        }}
      />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <StatCard
          icon={<Wrench className="size-5" />}
          tone="bad"
          label="Open requests"
          value={count('open') + count('assigned')}
          onClick={() => showRequests('open')}
        />
        <StatCard
          icon={<Loader className="size-5" />}
          tone="info"
          label="In progress"
          value={count('in_progress')}
          onClick={() => showRequests('in_progress')}
        />
        <StatCard icon={<AlarmClock className="size-5" />} tone="warn" label="Overdue tasks" value={overdue.length} />
        <StatCard
          icon={<Receipt className="size-5" />}
          label="Maintenance spend (month)"
          value={inr(monthSpend)}
          onClick={() => setView('expenses')}
        />
        <StatCard
          icon={<AlertCircle className="size-5" />}
          tone="bad"
          label="Outstanding payments"
          value={inr(outstanding)}
          onClick={() => setView('expenses')}
        />
      </div>
      <Tabs
        value={view}
        onChange={setView}
        tabs={[
          { id: 'requests', label: 'Repairs & requests' },
          { id: 'expenses', label: 'Maintenance expenses' },
        ]}
      />
      {view === 'requests' ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs<Tab>
              value={tab}
              onChange={setTab}
              tabs={TABS.map((t) => ({ id: t, label: t === 'all' ? `All (${rows.length})` : `${label(t)} (${count(t)})` }))}
            />
            <label className="relative mb-4">
              <span className="sr-only">Search</span>
              <Search className="size-4 text-muted absolute left-3 top-3" aria-hidden />
              <Input
                placeholder="Search title or room…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-56"
              />
            </label>
          </div>
          <Async state={st}>
            {() =>
              filtered.length === 0 ? (
                <Empty title="No requests" action={<Button onClick={() => setCreate(true)}>Create first request</Button>} />
              ) : (
                <Table head={['Request', 'Location', 'Priority', 'Reported', 'Due', 'Assigned to', 'Status', '']}>
                  {filtered.map((r) => {
                    const late = isOverdue(r, now);
                    return (
                      <tr key={r.id} className="hover:bg-subtle/60">
                        <Td>
                          <p className="font-medium">{r.title}</p>
                          <p className="text-[12px] text-muted">
                            {r.maintenance_categories.name}
                            {r.complaint_id ? ' · from complaint' : ''}
                          </p>
                        </Td>
                        <Td>{r.rooms ? `Room ${r.rooms.room_number}` : r.floors?.name ?? 'Building'}</Td>
                        <Td><Badge status={r.priority} /></Td>
                        <Td>{fmtDate(r.reported_at)}</Td>
                        <Td>
                          {r.due_at ? (
                            <span className={late ? 'text-bad font-medium' : ''}>
                              {fmtDate(r.due_at)}
                              {late ? ' · overdue' : ''}
                            </span>
                          ) : (
                            '—'
                          )}
                        </Td>
                        <Td>{r.vendors?.name ?? r.assigned_to ?? <span className="text-muted">Unassigned</span>}</Td>
                        <Td><Badge status={r.status} /></Td>
                        <Td><Button variant="ghost" size="sm" onClick={() => setOpenId(r.id)}>Open</Button></Td>
                      </tr>
                    );
                  })}
                </Table>
              )
            }
          </Async>
        </Card>
      ) : (
        <MaintenanceExpenses state={exp} rows={mExpenses} onAdd={() => setAddExp(true)} onView={setExpId} />
      )}
      <CreateRequestDrawer
        open={create}
        onClose={() => setCreate(false)}
        onDone={() => {
          setCreate(false);
          setToast('Request created');
          st.reload();
        }}
      />
      {open && (
        <RequestDetail
          r={open}
          expenses={(exp.data ?? []).filter((e) => e.source_id === open.id)}
          onClose={() => setOpenId(null)}
          onChanged={(m) => {
            setToast(m);
            st.reload();
            exp.reload();
          }}
        />
      )}
      {openExpense && (
        <ExpenseDetail
          e={openExpense}
          onClose={() => setExpId(null)}
          onChanged={(m) => {
            setToast(m);
            exp.reload();
          }}
        />
      )}
      <AddExpenseDrawer
        open={addExp}
        onClose={() => setAddExp(false)}
        onDone={(m) => {
          setAddExp(false);
          setToast(m);
          exp.reload();
        }}
      />
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
