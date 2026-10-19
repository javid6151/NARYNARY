/** Residents (PG members) page: current or checked-out residents with room, bed, dues and portal status. */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BedDouble, Download, MessageSquareWarning, Plus, Search, Users, Wallet } from 'lucide-react';
import { useAsync } from '../../lib/hooks';
import { downloadCsv, fmtDate, inr } from '../../lib/format';
import { useBuilding } from '../access/useBuilding';
import { Async, Avatar, Badge, Button, Card, Empty, Input, PageHeader, StatCard, Table, Tabs, Td, Toast } from '../../components/ui';
import { BuildingPicker } from '../../components/BuildingPicker';
import { listActiveResidents, listOpenComplaintIds, listPastResidents } from './api';
import { ResidentDrawer } from './components/ResidentDrawer';
import type { ResidentRow } from './types';

export default function Residents() {
  const { buildingId } = useBuilding();
  const nav = useNavigate();
  const [status, setStatus] = useState<'active' | 'checked_out'>('active');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const st = useAsync(async () => {
    if (!buildingId) return [] as ResidentRow[];
    return status === 'active' ? listActiveResidents(buildingId) : listPastResidents(buildingId);
  }, [buildingId, status]);
  const complaints = useAsync(() => listOpenComplaintIds(buildingId), [buildingId]);

  const rows = useMemo(() => st.data ?? [], [st.data]);
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) => !search || `${r.full_name} ${r.phone} ${r.room_number} ${r.bed_label}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [rows, search],
  );
  const dues = rows.filter((r) => Number(r.outstanding) > 0);
  const open = rows.find((r) => r.id === openId) ?? null;

  const exportCsv = () =>
    downloadCsv('residents.csv', rows.map((r) => ({
      name: r.full_name,
      phone: r.phone,
      email: r.email ?? '',
      room: r.room_number ?? '',
      bed: r.bed_label ?? '',
      admission_date: r.admission_date ?? '',
      rent: r.monthly_rent ?? '',
      outstanding: r.outstanding,
      status: r.status,
    })));

  return (
    <>
      <PageHeader
        title="PG Members / Residents"
        subtitle="Everyone currently staying, with room, bed and dues."
        actions={
          <>
            <BuildingPicker />
            <Button variant="secondary" disabled={!rows.length} onClick={exportCsv}>
              <Download className="size-4" />
              Export
            </Button>
            <Button onClick={() => nav('/app/admissions/new')}>
              <Plus className="size-4" />
              Add resident
            </Button>
          </>
        }
      />
      {status === 'active' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <StatCard icon={<Users className="size-5" />} label="Active residents" value={rows.length} />
          <StatCard
            icon={<BedDouble className="size-5" />}
            tone="info"
            label="Portal activated"
            value={`${rows.filter((r) => r.has_login).length} / ${rows.length}`}
          />
          <StatCard
            icon={<Wallet className="size-5" />}
            tone="bad"
            label="Residents with dues"
            value={dues.length}
            hint={inr(dues.reduce((s, r) => s + Number(r.outstanding), 0))}
          />
          <StatCard
            icon={<MessageSquareWarning className="size-5" />}
            tone="warn"
            label="Open complaints"
            value={(complaints.data ?? []).length}
            onClick={() => nav('/app/complaints')}
          />
        </div>
      )}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={status}
            onChange={setStatus}
            tabs={[
              { id: 'active', label: 'Current residents' },
              { id: 'checked_out', label: 'Checked out' },
            ]}
          />
          <label className="relative mb-4">
            <span className="sr-only">Search residents</span>
            <Search className="size-4 text-muted absolute left-3 top-3" aria-hidden />
            <Input
              placeholder="Search name, phone, room…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-64"
            />
          </label>
        </div>
        <Async state={st}>
          {() =>
            filtered.length === 0 ? (
              <Empty title="No residents found" />
            ) : (
              <Table head={['Resident', 'Room / Bed', 'Phone', 'Check-in', 'Rent', 'Outstanding', 'Portal', '']}>
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-subtle/60">
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={r.full_name} size={32} />
                        <span className="font-medium">{r.full_name}</span>
                      </div>
                    </Td>
                    <Td>
                      {r.room_number ? (
                        <>
                          Room {r.room_number}
                          <p className="text-[12px] text-muted">Bed {r.bed_label}</p>
                        </>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td className="tabular">{r.phone}</Td>
                    <Td>{fmtDate(r.admission_date)}</Td>
                    <Td className="tabular">{r.monthly_rent ? inr(r.monthly_rent) : '—'}</Td>
                    <Td className="tabular">
                      {Number(r.outstanding) > 0 ? (
                        <span className="text-bad font-medium">{inr(r.outstanding)}</span>
                      ) : (
                        <Badge status="paid">Clear</Badge>
                      )}
                    </Td>
                    <Td>{r.has_login ? <Badge status="active">Active</Badge> : <Badge status="invited">Not activated</Badge>}</Td>
                    <Td><Button variant="ghost" size="sm" onClick={() => setOpenId(r.id)}>View</Button></Td>
                  </tr>
                ))}
              </Table>
            )
          }
        </Async>
      </Card>
      {open && (
        <ResidentDrawer
          r={open}
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
