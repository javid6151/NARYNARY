/**
 * Staff management page: roster, daily attendance, end-of-day reports and (owner only) salaries.
 * These are building staff records, not app logins; manager/chef logins are invited from Settings → Team.
 */
import { useState } from 'react';
import { CalendarCheck, FileText, IndianRupee, Pencil, Plus, UserCheck, Users } from 'lucide-react';
import { useAsync } from '../../lib/hooks';
import { fmtDate, inr, isoDate, label } from '../../lib/format';
import { useAuth } from '../access/useAuth';
import { useBuilding } from '../access/useBuilding';
import { Async, Badge, Button, Card, Empty, PageHeader, StatCard, Table, Tabs, Td, Toast } from '../../components/ui';
import { BuildingPicker } from '../../components/BuildingPicker';
import { listAttendance, listStaff } from './api';
import type { AttendanceMark, StaffMember } from './types';
import { useExpenses } from '../expenses/useExpenses';
import { Attendance } from './components/Attendance';
import { DailyReports } from './components/DailyReports';
import { Salaries } from './components/Salaries';
import { StaffDetailDrawer } from './components/StaffDetailDrawer';
import { StaffDrawer } from './components/StaffDrawer';
import { SectionPromoBanner } from '../../components/SectionPromoBanner';

type Tab = 'roster' | 'attendance' | 'reports' | 'salary';

export default function Staff() {
  const { staff } = useAuth();
  const { buildingId } = useBuilding();
  const isOwner = staff?.role === 'owner';
  const [tab, setTab] = useState<Tab>('roster');
  const [edit, setEdit] = useState<Partial<StaffMember> | null>(null);
  const [viewStaff, setViewStaff] = useState<StaffMember | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const st = useAsync(() => (!buildingId ? Promise.resolve([] as StaffMember[]) : listStaff(buildingId)), [buildingId]);
  const exp = useExpenses(buildingId, { source: 'salary' });
  // Today's marks, for the "On duty today" tile (reloaded when switching tabs).
  const today = useAsync(
    () => (!buildingId ? Promise.resolve([] as AttendanceMark[]) : listAttendance(buildingId, isoDate())),
    [buildingId, tab],
  );
  const rows = st.data ?? [];
  const active = rows.filter((r) => r.status !== 'inactive');
  const present = (today.data ?? []).filter((a) => ['present', 'late', 'half_day'].includes(a.status)).length;
  const currentMonth = isoDate().slice(0, 7);

  const isMonthPaid = (s: StaffMember) =>
    (exp.data ?? []).some(
      (e) =>
        e.source_id === s.id &&
        (e.description === `Salary month ${currentMonth}` || e.expense_date.startsWith(currentMonth)),
    );

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
      <SectionPromoBanner
        eyebrow="WORKFORCE & OPERATIONS"
        title="Dedicated Teams, Elevated Service."
        subtitle="Oversee building staff rosters, daily biometric attendance, end-of-day operational logs, and payroll disbursements."
        imageSrc="/owner-assets/residents-hero.jpg"
        statsBadge={`${active.length} On Roster · ${present} On Duty`}
        primaryAction={{
          label: 'Add Staff Member',
          onClick: () => setEdit({}),
          icon: Plus,
        }}
        secondaryAction={{
          label: 'Mark Attendance',
          onClick: () => setTab('attendance'),
          icon: CalendarCheck,
        }}
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
                <Table
                  head={[
                    'Name',
                    'Role',
                    'Phone',
                    'Joined',
                    ...(isOwner ? ['Monthly salary', 'Salary status'] : []),
                    'Status',
                    '',
                  ]}
                >
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-subtle/60 cursor-pointer"
                      onClick={() => setViewStaff(r)}
                    >
                      <Td className="font-semibold text-brand-700 hover:underline">{r.full_name}</Td>
                      <Td>{label(r.role)}</Td>
                      <Td className="tabular">
                        <p>{r.phone ?? '—'}</p>
                        {r.aadhar_number && (
                          <p className="text-[11px] text-muted font-mono" title="Aadhaar number">
                            UID: {r.aadhar_number}
                          </p>
                        )}
                      </Td>
                      <Td>{fmtDate(r.joining_date)}</Td>
                      {isOwner && (
                        <Td className="tabular">
                          <p className="font-semibold">{inr(r.monthly_salary)}</p>
                          <p className="text-[11px] text-muted">Due 1st of month</p>
                        </Td>
                      )}
                      {isOwner && (
                        <Td>
                          {isMonthPaid(r) ? (
                            <Badge status="paid">Issued</Badge>
                          ) : (
                            <Badge status="unpaid">Not Issued</Badge>
                          )}
                        </Td>
                      )}
                      <Td><Badge status={r.status} /></Td>
                      <Td>
                        <div className="flex items-center gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
                          {r.aadhar_image_url && (
                            <a
                              href={r.aadhar_image_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-600 hover:text-brand-700 hover:underline px-2 py-1 rounded bg-brand-50"
                              title="View uploaded Aadhaar card"
                            >
                              <FileText className="size-3.5" />
                              Aadhaar
                            </a>
                          )}
                          <Button size="sm" onClick={() => setViewStaff(r)}>
                            View
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setEdit(r)}>
                            <Pencil className="size-4" />
                            Edit
                          </Button>
                        </div>
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
      {viewStaff && buildingId && (
        <StaffDetailDrawer
          staff={viewStaff}
          buildingId={buildingId}
          isOwner={isOwner}
          onClose={() => setViewStaff(null)}
          onEdit={(s) => {
            setViewStaff(null);
            setEdit(s);
          }}
          onChanged={(m) => {
            setToast(m);
            st.reload();
            exp.reload();
            const updated = (st.data ?? []).find((x) => x.id === viewStaff.id);
            if (updated) setViewStaff(updated);
          }}
        />
      )}
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
