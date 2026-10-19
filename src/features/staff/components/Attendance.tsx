/**
 * Daily attendance sheet. Unmarked staff default to present (or leave when their status is on_leave);
 * saving writes one mark per staff member for the date.
 */
import { useEffect, useState } from 'react';
import { useAsync, useMutation } from '../../../lib/hooks';
import { isoDate, label } from '../../../lib/format';
import { Badge, Button, Card, Empty, ErrorBanner, Input, Select, Table, Td } from '../../../components/ui';
import { listAttendance, markAttendance } from '../api';
import { ATTENDANCE_STATUSES, type StaffMember } from '../types';

type Marks = Record<string, { status: string; notes: string }>;

export function Attendance({ buildingId, staff, onSaved }: { buildingId: string; staff: StaffMember[]; onSaved: (m: string) => void }) {
  const [date, setDate] = useState(isoDate());
  const st = useAsync(() => listAttendance(buildingId, date), [buildingId, date]);
  const [marks, setMarks] = useState<Marks>({});
  // Start from saved marks, falling back to the default for each staff member.
  useEffect(() => {
    const existing = Object.fromEntries((st.data ?? []).map((a) => [a.staff_member_id, { status: a.status, notes: a.notes ?? '' }]));
    setMarks(
      Object.fromEntries(staff.map((s) => [s.id, existing[s.id] ?? { status: s.status === 'on_leave' ? 'leave' : 'present', notes: '' }])),
    );
  }, [st.data, staff]);
  const marked = (st.data ?? []).length > 0;
  const m = useMutation(() =>
    markAttendance(
      buildingId,
      date,
      staff.map((s) => ({ staff_member_id: s.id, status: marks[s.id]?.status ?? 'present', notes: marks[s.id]?.notes ?? '' })),
    ),
  );
  const update = (id: string, patch: Partial<Marks[string]>) => setMarks({ ...marks, [id]: { ...marks[id], ...patch } });

  const header = (
    <div className="flex items-center gap-2">
      <Input type="date" max={isoDate()} value={date} onChange={(e) => setDate(e.target.value)} className="w-44" aria-label="Attendance date" />
      {marked ? <Badge status="completed">Marked</Badge> : <Badge status="pending">Not marked</Badge>}
    </div>
  );

  return (
    <Card title="Daily attendance" action={header}>
      <ErrorBanner error={m.error} />
      {staff.length === 0 ? (
        <Empty title="No active staff" />
      ) : (
        <>
          <Table head={['Staff', 'Role', 'Status', 'Notes']}>
            {staff.map((s) => (
              <tr key={s.id}>
                <Td className="font-medium">{s.full_name}</Td>
                <Td>{label(s.role)}</Td>
                <Td>
                  <Select
                    aria-label={`Attendance for ${s.full_name}`}
                    value={marks[s.id]?.status ?? 'present'}
                    className="w-36 h-9"
                    onChange={(e) => update(s.id, { status: e.target.value })}
                  >
                    {ATTENDANCE_STATUSES.map((a) => <option key={a} value={a}>{label(a)}</option>)}
                  </Select>
                </Td>
                <Td>
                  <Input
                    aria-label={`Notes for ${s.full_name}`}
                    className="h-9"
                    value={marks[s.id]?.notes ?? ''}
                    onChange={(e) => update(s.id, { notes: e.target.value })}
                  />
                </Td>
              </tr>
            ))}
          </Table>
          <div className="flex justify-between items-center mt-4">
            <p className="text-[12px] text-muted">{marked ? 'Changes to marked attendance are recorded in the audit log.' : ''}</p>
            <Button
              busy={m.busy}
              onClick={async () => {
                const n = await m.run();
                if (n !== undefined) {
                  st.reload();
                  onSaved(`Attendance saved for ${n} staff`);
                }
              }}
            >
              Save attendance
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
