/** Admission requests page: list by status, with a drawer to review (owner approves/rejects). */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Eye, FileClock, Inbox, Plus, Search, XCircle } from 'lucide-react';
import { useAsync } from '../../lib/hooks';
import { fmtDate, fmtDateTime, inr } from '../../lib/format';
import { useAuth } from '../access/useAuth';
import { useBuilding } from '../access/useBuilding';
import { Async, Avatar, Badge, Button, Card, Empty, Input, PageHeader, StatCard, Table, Tabs, Td, Toast } from '../../components/ui';
import { BuildingPicker } from '../../components/BuildingPicker';
import { listAdmissions } from './api';
import { AdmissionDrawer } from './components/AdmissionDrawer';
import type { AdmissionRow } from './types';

type Tab = 'all' | 'pending_review' | 'approved' | 'rejected' | 'completed';

/** Badge text for statuses whose raw name reads badly. */
const statusText = (s: string) => (s === 'pending_review' ? 'Pending approval' : s === 'completed' ? 'Checked out' : undefined);

export default function Admissions() {
  const { staff } = useAuth();
  const { buildingId } = useBuilding();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const st = useAsync(() => (!buildingId ? Promise.resolve([] as AdmissionRow[]) : listAdmissions(buildingId)), [buildingId]);

  const rows = useMemo(() => st.data ?? [], [st.data]);
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (tab === 'all' || r.status === tab) &&
          (!search ||
            `${r.residents.full_name} ${r.residents.phone} ${r.rooms.room_number} ${r.beds.bed_label}`
              .toLowerCase()
              .includes(search.toLowerCase())),
      ),
    [rows, tab, search],
  );
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const open = rows.find((r) => r.id === openId) ?? null;

  return (
    <>
      <PageHeader
        title="Admission requests"
        subtitle="Review new residents, approve to allocate the bed and create first-month charges."
        actions={
          <>
            <BuildingPicker />
            <Button onClick={() => nav('/app/admissions/new')}>
              <Plus className="size-4" />
              New admission
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard icon={<Inbox className="size-5" />} label="Total requests" value={rows.length} />
        <StatCard
          icon={<FileClock className="size-5" />}
          tone="warn"
          label="Pending approval"
          value={count('pending_review')}
          onClick={() => setTab('pending_review')}
        />
        <StatCard
          icon={<CheckCircle2 className="size-5" />}
          tone="ok"
          label="Approved"
          value={count('approved')}
          onClick={() => setTab('approved')}
        />
        <StatCard
          icon={<XCircle className="size-5" />}
          tone="bad"
          label="Rejected"
          value={count('rejected')}
          onClick={() => setTab('rejected')}
        />
      </div>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'all', label: `All (${rows.length})` },
              { id: 'pending_review', label: `Pending (${count('pending_review')})` },
              { id: 'approved', label: `Approved (${count('approved')})` },
              { id: 'rejected', label: `Rejected (${count('rejected')})` },
              { id: 'completed', label: `Checked out (${count('completed')})` },
            ]}
          />
          <label className="relative mb-4">
            <span className="sr-only">Search</span>
            <Search className="size-4 text-muted absolute left-3 top-3" aria-hidden />
            <Input
              placeholder="Search name, mobile, room…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-64"
            />
          </label>
        </div>
        <Async state={st}>
          {() =>
            filtered.length === 0 ? (
              <Empty title="No admissions here" />
            ) : (
              <Table head={['Applicant', 'Room / Bed', 'Admission date', 'Rent', 'Requested', 'Status', 'Portal access', '']}>
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-subtle/60">
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={r.residents.full_name} size={32} />
                        <div>
                          <p className="font-medium">{r.residents.full_name}</p>
                          <p className="text-[12px] text-muted">{r.residents.phone}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      Room {r.rooms.room_number}
                      <p className="text-[12px] text-muted">Bed {r.beds.bed_label} · {r.floors.name}</p>
                    </Td>
                    <Td>{fmtDate(r.admission_date)}</Td>
                    <Td className="tabular">{inr(r.monthly_rent)}</Td>
                    <Td className="text-muted">{fmtDateTime(r.created_at)}</Td>
                    <Td><Badge status={r.status}>{statusText(r.status)}</Badge></Td>
                    <Td>
                      {r.status === 'approved' ? (
                        r.residents.user_id ? (
                          <Badge status="active">Access granted</Badge>
                        ) : (
                          <Badge status="invited">Not activated</Badge>
                        )
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </Td>
                    <Td>
                      <Button variant="ghost" size="sm" onClick={() => setOpenId(r.id)} aria-label={`View ${r.residents.full_name}`}>
                        <Eye className="size-4" />
                        View
                      </Button>
                    </Td>
                  </tr>
                ))}
              </Table>
            )
          }
        </Async>
      </Card>
      <AdmissionDrawer
        row={open}
        canApprove={staff?.role === 'owner'}
        onClose={() => setOpenId(null)}
        onDone={(msg) => {
          setToast(msg);
          st.reload();
        }}
      />
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
