/**
 * Staff management page: roster, daily attendance, end-of-day reports and (owner only) salaries.
 * These are building staff records, not app logins; manager/chef logins are invited from Settings → Team.
 */
import { useState } from 'react';
import { CalendarCheck, IndianRupee, Pencil, Plus, UserCheck, Users } from 'lucide-react';
import { useAsync } from '../../lib/hooks';
import { fmtDate, inr, isoDate, label } from '../../lib/format';
import { useAuth } from '../access/useAuth';
import { useBuilding } from '../access/useBuilding';
import { Async, Badge, Button, Card, Empty, PageHeader, StatCard, Table, Tabs, Td, Toast } from '../../components/ui';
import { BuildingPicker } from '../../components/BuildingPicker';
import { listAttendance, listStaff } from './api';
import type { AttendanceMark, StaffMember } from './types';
import { Attendance } from './components/Attendance';
import { DailyReports } from './components/DailyReports';
import { Salaries } from './components/Salaries';
import { StaffDrawer } from './components/StaffDrawer';

type Tab = 'roster' | 'attendance' | 'reports' | 'salary';

export default function Staff() {
  const { staff } = useAuth();
  const { buildingId } = useBuilding();
  const isOwner = staff?.role === 'owner';
  const [tab, setTab] = useState<Tab>('roster');
  const [edit, setEdit] = useState<Partial<StaffMember> | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const st = useAsync(() => (!buildingId ? Promise.resolve([] as StaffMember[]) : listStaff(buildingId)), [buildingId]);
  // Today's marks, for the "On duty today" tile (reloaded when switching tabs).
  const today = useAsync(
    () => (!buildingId ? Promise.resolve([] as AttendanceMark[]) : listAttendance(buildingId, isoDate())),
    [buildingId, tab],
  );
  const rows = st.data ?? [];
  const active = rows.filter((r) => r.status !== 'inactive');
  const present = (today.data ?? []).filter((a) => ['present', 'late', 'half_day'].includes(a.status)).length;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'roster', label: 'Staff list' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'reports', label: 'Daily reports' },
    ...(isOwner ? [{ id: 'salary' as const, label: 'Salary payments' }] : []),
  ];

  return (
    <>
      <PageHeader
        title="Staff management"
        subtitle="Roster, daily attendance, end-of-day work reports and salaries."
        actions={
          <>
            <BuildingPicker />
            <Button onClick={() => setEdit({})}>
              <Plus className="size-4" />
              Add staff
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard icon={<Users className="size-5" />} label="Total staff" value={active.length} />
        <StatCard
          icon={<UserCheck className="size-5" />}
          tone="ok"
          label="On duty today"
          value={present}
          hint={today.data?.length ? `${today.data.length} marked` : 'Attendance not marked yet'}
          onClick={() => setTab('attendance')}
        />
        <StatCard
          icon={<CalendarCheck className="size-5" />}
          tone="warn"
          label="On leave"
          value={rows.filter((r) => r.status === 'on_leave').length}
        />
        {isOwner && (
          <StatCard
            icon={<IndianRupee className="size-5" />}
            tone="info"
            label="Monthly salary bill"
            value={inr(active.reduce((s, r) => s + Number(r.monthly_salary), 0))}
          />
        )}
      </div>
      <Tabs value={tab} onChange={setTab} tabs={tabs} />
      {tab === 'roster' && (
        <Card>
          <Async state={st}>
            {() =>
              rows.length === 0 ? (
                <Empty title="No staff yet" action={<Button onClick={() => setEdit({})}>Add staff</Button>} />
              ) : (
                <Table head={['Name', 'Role', 'Phone', 'Joined', ...(isOwner ? ['Monthly salary'] : []), 'Status', '']}>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <Td className="font-medium">{r.full_name}</Td>
                      <Td>{label(r.role)}</Td>
                      <Td className="tabular">{r.phone ?? '—'}</Td>
                      <Td>{fmtDate(r.joining_date)}</Td>
                      {isOwner && <Td className="tabular">{inr(r.monthly_salary)}</Td>}
                      <Td><Badge status={r.status} /></Td>
                      <Td>
                        <Button variant="ghost" size="sm" onClick={() => setEdit(r)}>
                          <Pencil className="size-4" />
                          Edit
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </Table>
              )
            }
          </Async>
        </Card>
      )}
      {tab === 'attendance' && buildingId && (
        <Attendance
          buildingId={buildingId}
          staff={active}
          onSaved={(m) => {
            setToast(m);
            today.reload();
          }}
        />
      )}
      {tab === 'reports' && buildingId && <DailyReports buildingId={buildingId} staff={active} />}
      {tab === 'salary' && isOwner && <Salaries staff={active} onPaid={(m) => setToast(m)} />}
      {edit && buildingId && (
        <StaffDrawer
          m={edit}
          buildingId={buildingId}
          isOwner={isOwner}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            setToast('Staff saved');
            st.reload();
          }}
        />
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
