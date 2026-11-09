/** Residents (PG members) page: current or checked-out residents with room, bed, dues and portal status. */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BedDouble, Bell, DoorOpen, Download, MessageSquareWarning, Plus, Search, Users, Wallet } from 'lucide-react';
import { useAsync } from '../../lib/hooks';
import { downloadCsv, fmtDate, inr } from '../../lib/format';
import { useBuilding } from '../access/useBuilding';
import { Async, Avatar, Badge, Button, Card, Empty, Input, StatCard, Table, Tabs, Td, Toast } from '../../components/ui';
import { BuildingPicker } from '../../components/BuildingPicker';
import { SectionPromoBanner } from '../../components/SectionPromoBanner';
import { listActiveResidents, listOpenComplaintIds, listPastResidents } from './api';
import { ResidentDrawer } from './components/ResidentDrawer';
import { VacantRoomsModal } from '../property/components/VacantRoomsModal';
import { PaymentReminderModal } from '../billing/components/PaymentReminderModal';
import type { ResidentRow } from './types';

export default function Residents() {
  const { buildingId, building } = useBuilding();
  const nav = useNavigate();
  const [status, setStatus] = useState<'active' | 'checked_out'>('active');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'due' | 'paid'>('all');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [remindResident, setRemindResident] = useState<ResidentRow | null>(null);
  const [vacantModalOpen, setVacantModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const st = useAsync(async () => {
    if (!buildingId) return [] as ResidentRow[];
    return status === 'active' ? listActiveResidents(buildingId) : listPastResidents(buildingId);
  }, [buildingId, status]);
  const complaints = useAsync(() => listOpenComplaintIds(buildingId), [buildingId]);

  const rows = useMemo(() => st.data ?? [], [st.data]);
  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const matchesSearch = !search || `${r.full_name} ${r.phone} ${r.room_number} ${r.bed_label}`.toLowerCase().includes(search.toLowerCase());
        if (!matchesSearch) return false;
        if (paymentFilter === 'due') return Number(r.outstanding) > 0;
        if (paymentFilter === 'paid') return Number(r.outstanding) <= 0;
        return true;
      }),
    [rows, search, paymentFilter],
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
      paid_status: Number(r.outstanding) > 0 ? 'Not Paid' : 'Paid',
      outstanding: r.outstanding,
      status: r.status,
    })));

  return (
    <>
      <SectionPromoBanner
        fromTop
        eyebrow="RESIDENT COMMUNITY"
        title="Effortless Check-ins, Connected Hostel Life."
        subtitle={
          building
            ? `${building.name} · Manage resident profiles, portal access credentials, and fee payments.`
            : 'Manage resident profiles, portal access credentials, and fee payments across all buildings.'
        }
        imageSrc="/owner-assets/residents-hero.jpg"
        controls={<BuildingPicker />}
        statsBadge={`${rows.length} Active Residents`}
        primaryAction={{
          label: 'Add Resident',
          onClick: () => nav('new'),
          icon: Plus,
        }}
        secondaryAction={{
          label: 'Vacant Rooms',
          onClick: () => setVacantModalOpen(true),
          icon: DoorOpen,
        }}
        extraActions={
          <button
            disabled={!rows.length}
            onClick={exportCsv}
            className="inline-flex items-center gap-2 px-5 py-2.5 sm:py-3 rounded-2xl bg-[#FFFEFC] hover:bg-[#ECE5DA] text-[#30271F] text-xs sm:text-[13.5px] font-semibold border border-[#DED6CB] transition-all cursor-pointer shadow-2xs active:scale-[0.98] disabled:opacity-50"
          >
            <Download className="size-4 text-[#343B2B]" />
            <span>Export CSV</span>
          </button>
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
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <Tabs
            value={status}
            onChange={setStatus}
            tabs={[
              { id: 'active', label: 'Current residents' },
              { id: 'checked_out', label: 'Checked out' },
            ]}
          />
          <div className="flex flex-wrap items-center gap-2.5 mb-4">
            {/* Quick status filter pills matching reference design */}
            <div className="flex items-center gap-1 bg-[#F5F0E8] p-1 rounded-xl border border-[#DED6CB] text-xs">
              <button
                type="button"
                onClick={() => setPaymentFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  paymentFilter === 'all'
                    ? 'bg-[#343B2B] text-white shadow-2xs'
                    : 'text-[#77736B] hover:text-[#30271F]'
                }`}
              >
                All ({rows.length})
              </button>
              <button
                type="button"
                onClick={() => setPaymentFilter('due')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  paymentFilter === 'due'
                    ? 'bg-[#FDF1EC] text-[#B9674B] font-semibold border border-[#B9674B]/20'
                    : 'text-[#77736B] hover:text-[#30271F]'
                }`}
              >
                Due Payment ({dues.length})
              </button>
              <button
                type="button"
                onClick={() => setPaymentFilter('paid')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  paymentFilter === 'paid'
                    ? 'bg-[#EAF3E4] text-[#2F6B27] font-semibold border border-[#CAD7BF]'
                    : 'text-[#77736B] hover:text-[#30271F]'
                }`}
              >
                Paid ({rows.length - dues.length})
              </button>
            </div>

            <label className="relative">
              <span className="sr-only">Search residents</span>
              <Search className="size-4 text-muted absolute left-3 top-3" aria-hidden />
              <Input
                placeholder="Search name, phone, room…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-56"
              />
            </label>
          </div>
        </div>
        <Async state={st}>
          {() =>
            filtered.length === 0 ? (
              <Empty title="No residents found" />
            ) : (
              <Table head={['Resident', 'Room / Bed', 'Phone', 'Check-in', 'Rent', 'Payment Status', 'Portal', '']}>
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-subtle/60">
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={r.full_name} size={32} />
                        <div>
                          <p className="font-semibold text-[#30271F]">{r.full_name}</p>
                          <p className="text-[11px] text-[#77736B] md:hidden">{r.phone}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      {r.room_number ? (
                        <>
                          <span className="font-medium text-[#30271F]">Room {r.room_number}</span>
                          <p className="text-[11.5px] text-[#77736B]">Bed {r.bed_label}</p>
                        </>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td className="tabular">{r.phone}</Td>
                    <Td>{fmtDate(r.admission_date)}</Td>
                    <Td className="tabular font-medium">{r.monthly_rent ? inr(r.monthly_rent) : '—'}</Td>
                    <Td>
                      {Number(r.outstanding) > 0 ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FDF1EC] text-[#B9674B] border border-[#B9674B]/20">
                            Due {inr(r.outstanding)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setRemindResident(r)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded cursor-pointer transition-colors"
                            title="Send fee payment reminder via WhatsApp"
                          >
                            <Bell className="size-3 text-amber-600" />
                            Remind
                          </button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EAF3E4] text-[#2F6B27] border border-[#CAD7BF]">
                          Paid
                        </span>
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
      {remindResident && (
        <PaymentReminderModal
          target={{
            name: remindResident.full_name,
            phone: remindResident.phone,
            totalDue: Number(remindResident.outstanding),
            overdue: Number(remindResident.outstanding),
            room: remindResident.room_number,
            bed: remindResident.bed_label,
          }}
          buildingName={building?.name}
          onClose={() => setRemindResident(null)}
          onSent={(msg) => setToast(msg)}
        />
      )}
      <VacantRoomsModal
        open={vacantModalOpen}
        onClose={() => setVacantModalOpen(false)}
        defaultBuildingId={buildingId}
      />
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
