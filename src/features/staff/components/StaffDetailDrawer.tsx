/**
 * Staff profile drawer: tabs for Overview (KYC & Aadhaar), Salary & Payments
 * (issued status and schedule every month starting date), Attendance history,
 * and Daily reports — matching the resident profile experience.
 */
import { useMemo, useState } from 'react';
import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  IndianRupee,
  Pencil,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { useAsync, useMutation } from '../../../lib/hooks';
import { fmtDate, inr, isoDate, label } from '../../../lib/format';
import {
  Async,
  Avatar,
  Badge,
  Button,
  Card,
  Confirm,
  Drawer,
  Empty,
  ErrorBanner,
  Field,
  Input,
  Select,
  StatCard,
  Table,
  Tabs,
  Td,
} from '../../../components/ui';
import {
  listStaffMemberAttendance,
  listStaffMemberReports,
  listStaffMemberSalaries,
  markSingleStaffAttendance,
  payStaffSalary,
  type StaffSalaryPayment,
} from '../api';
import { ATTENDANCE_STATUSES, type StaffMember } from '../types';

type StaffTab = 'overview' | 'salary' | 'attendance' | 'reports';

export function StaffDetailDrawer({
  staff: s,
  buildingId,
  isOwner,
  onClose,
  onEdit,
  onChanged,
}: {
  staff: StaffMember;
  buildingId: string;
  isOwner: boolean;
  onClose: () => void;
  onEdit: (s: StaffMember) => void;
  onChanged: (msg: string) => void;
}) {
  const [tab, setTab] = useState<StaffTab>('overview');
  const [payMonth, setPayMonth] = useState<string | null>(null);
  const [method, setMethod] = useState('bank_transfer');
  const [reference, setReference] = useState('');

  // Today's ISO date (YYYY-MM-DD) and current month (YYYY-MM)
  const today = isoDate();
  const currentMonth = today.slice(0, 7);

  // Quick attendance mark form state for this staff member
  const [markDate, setMarkDate] = useState(today);
  const [markStatus, setMarkStatus] = useState('present');
  const [markNotes, setMarkNotes] = useState('');

  const salaries = useAsync(() => listStaffMemberSalaries(s.id), [s.id]);
  const attendance = useAsync(() => listStaffMemberAttendance(s.id), [s.id]);
  const reports = useAsync(() => listStaffMemberReports(s.id), [s.id]);

  const reloadAll = () => {
    salaries.reload();
    attendance.reload();
    reports.reload();
  };

  // Pay salary mutation
  const payMutation = useMutation(async () => {
    if (!payMonth) return;
    return payStaffSalary({
      staffId: s.id,
      monthFirstDay: `${payMonth}-01`,
      amount: Number(s.monthly_salary),
      method,
      reference: reference.trim() || null,
    });
  });

  // Mark attendance mutation
  const markMutation = useMutation(async () => {
    return markSingleStaffAttendance(buildingId, s.id, markDate, markStatus, markNotes.trim());
  });

  // Build the list of months to track salary for this staff member.
  // Salary is given on the starting date of every month (1st).
  const monthSchedule = useMemo(() => {
    const list: { key: string; name: string; dueDate: string }[] = [];
    const joinMonth = s.joining_date ? s.joining_date.slice(0, 7) : currentMonth;
    // Go from current month down to join month (or at least past 6 months)
    const curYear = parseInt(currentMonth.slice(0, 4), 10);
    const curMon = parseInt(currentMonth.slice(5, 7), 10);

    const joinYear = parseInt(joinMonth.slice(0, 4), 10);
    const joinMon = parseInt(joinMonth.slice(5, 7), 10);

    let y = curYear;
    let m = curMon;

    while (y > joinYear || (y === joinYear && m >= joinMon) || list.length < 3) {
      const key = `${y}-${String(m).padStart(2, '0')}`;
      const d = new Date(y, m - 1, 1);
      const name = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      list.push({ key, name, dueDate: `${key}-01` });

      m--;
      if (m < 1) {
        m = 12;
        y--;
      }
      if (list.length >= 12) break; // Maximum past 12 months
    }
    return list;
  }, [s.joining_date, currentMonth]);

  const paidMap = useMemo(() => {
    const map = new Map<string, StaffSalaryPayment>();
    for (const exp of salaries.data ?? []) {
      // Find month from description ("Salary month YYYY-MM") or expense_date
      const match = exp.description?.match(/Salary month (\d{4}-\d{2})/);
      const mKey = match ? match[1] : exp.expense_date?.slice(0, 7);
      if (mKey && !map.has(mKey)) {
        map.set(mKey, exp);
      }
    }
    return map;
  }, [salaries.data]);

  const currentMonthPaid = paidMap.get(currentMonth);

  // Attendance statistics
  const attList = attendance.data ?? [];
  const presentCount = attList.filter((a) => a.status === 'present').length;
  const lateHalfCount = attList.filter((a) => a.status === 'late' || a.status === 'half_day').length;
  const leaveAbsentCount = attList.filter((a) => a.status === 'leave' || a.status === 'absent').length;

  return (
    <>
      <Drawer open onClose={onClose} title="Staff profile" wide>
        {/* Header with Avatar, Details and Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-line">
          <div className="flex items-center gap-3.5 min-w-0">
            <Avatar name={s.full_name} size={52} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-ink truncate">{s.full_name}</h2>
                <Badge status={s.status} />
              </div>
              <p className="text-[13px] text-muted">
                <span className="font-semibold text-ink">{label(s.role)}</span> · Phone:{' '}
                <span className="font-mono text-ink">{s.phone || '—'}</span> · Joined {fmtDate(s.joining_date)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isOwner && Number(s.monthly_salary) > 0 && !currentMonthPaid && (
              <Button size="sm" onClick={() => setPayMonth(currentMonth)}>
                <IndianRupee className="size-4" />
                Pay current salary
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => onEdit(s)}>
              <Pencil className="size-4" />
              Edit
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'overview', label: 'Overview' },
            { id: 'salary', label: 'Salary & Payments' },
            { id: 'attendance', label: 'Attendance' },
            { id: 'reports', label: 'Daily reports' },
          ]}
        />

        {/* TAB 1: OVERVIEW */}
        {tab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card title="Staff & Salary Details">
                <dl className="grid grid-cols-2 gap-3 text-[13px]">
                  <div>
                    <dt className="text-muted text-[11px]">Role / Designation</dt>
                    <dd className="font-medium text-ink capitalize">{label(s.role)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted text-[11px]">Contact Phone</dt>
                    <dd className="font-mono text-ink">{s.phone || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted text-[11px]">Joining Date</dt>
                    <dd className="text-ink">{fmtDate(s.joining_date)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted text-[11px]">Roster Status</dt>
                    <dd>
                      <Badge status={s.status} />
                    </dd>
                  </div>
                  {isOwner && (
                    <>
                      <div>
                        <dt className="text-muted text-[11px]">Monthly Salary</dt>
                        <dd className="font-bold text-ink tabular text-[15px]">{inr(s.monthly_salary)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted text-[11px]">Salary Issue Date</dt>
                        <dd className="font-medium text-brand-700">1st of every month (starting date)</dd>
                      </div>
                    </>
                  )}
                </dl>
              </Card>

              <Card title="Identity & Aadhaar KYC">
                <div className="space-y-3 text-[13px]">
                  <div>
                    <span className="text-muted text-[11px] block">Aadhaar UID Number</span>
                    {s.aadhar_number ? (
                      <span className="font-mono font-semibold text-ink text-[14px] tracking-wider">
                        {s.aadhar_number}
                      </span>
                    ) : (
                      <span className="text-muted italic">Not provided</span>
                    )}
                  </div>

                  <div>
                    <span className="text-muted text-[11px] block mb-1">Aadhaar Card Document</span>
                    {s.aadhar_image_url ? (
                      <div className="flex items-center justify-between p-2.5 bg-subtle/70 rounded-lg border border-line">
                        <div className="flex items-center gap-2">
                          <FileText className="size-4 text-ok" />
                          <span className="font-medium text-ink">Aadhaar Card Photo/Doc</span>
                        </div>
                        <a
                          href={s.aadhar_image_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline"
                        >
                          View / Download
                          <ExternalLink className="size-3" />
                        </a>
                      </div>
                    ) : (
                      <span className="text-muted italic">No Aadhaar document uploaded</span>
                    )}
                  </div>
                </div>
              </Card>
            </div>

            {/* Current Month Salary Status Card */}
            {isOwner && (
              <Card
                title={`Current Month Salary (${new Date().toLocaleDateString('en-IN', {
                  month: 'long',
                  year: 'numeric',
                })})`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-subtle/60 rounded-xl border border-line">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-ink">
                        {currentMonthPaid ? 'Salary Issued' : 'Salary Not Issued'}
                      </span>
                      {currentMonthPaid ? <Badge status="paid">Issued</Badge> : <Badge status="unpaid">Pending</Badge>}
                    </div>
                    <p className="text-xs text-muted">
                      {currentMonthPaid
                        ? `Issued on ${fmtDate(currentMonthPaid.expense_date)} via ${
                            currentMonthPaid.expense_payments?.[0]?.payment_method
                              ? label(currentMonthPaid.expense_payments[0].payment_method)
                              : 'Bank Transfer'
                          }${
                            currentMonthPaid.expense_payments?.[0]?.transaction_reference
                              ? ` (Ref: ${currentMonthPaid.expense_payments[0].transaction_reference})`
                              : ''
                          }`
                        : `Scheduled on 1st of this month · Amount: ${inr(s.monthly_salary)}`}
                    </p>
                  </div>

                  {!currentMonthPaid && Number(s.monthly_salary) > 0 && (
                    <Button size="sm" onClick={() => setPayMonth(currentMonth)}>
                      <IndianRupee className="size-4" />
                      Issue current salary
                    </Button>
                  )}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* TAB 2: SALARY & PAYMENTS */}
        {tab === 'salary' && (
          <div className="space-y-4">
            <div className="p-3 bg-brand-50/50 border border-brand-200 rounded-xl flex items-center justify-between text-xs">
              <div>
                <p className="font-semibold text-brand-900">
                  Salary Schedule: Issued on every month's starting date (1st of month)
                </p>
                <p className="text-brand-700 text-[11px]">
                  Fixed monthly salary: <span className="font-semibold">{inr(s.monthly_salary)}</span>
                </p>
              </div>
            </div>

            <Card title="Monthly Salary Payment Records">
              <Async state={salaries}>
                {() => (
                  <Table head={['Salary Month', 'Starting / Due Date', 'Amount', 'Status', 'Payment Details', '']}>
                    {monthSchedule.map((m) => {
                      const paid = paidMap.get(m.key);
                      const pmt = paid?.expense_payments?.[0];
                      return (
                        <tr key={m.key} className="hover:bg-subtle/60">
                          <Td className="font-semibold">{m.name}</Td>
                          <Td>{fmtDate(m.dueDate)}</Td>
                          <Td className="tabular font-medium">{inr(s.monthly_salary)}</Td>
                          <Td>
                            {paid ? (
                              <Badge status="paid">Issued · {fmtDate(paid.expense_date)}</Badge>
                            ) : (
                              <Badge status="unpaid">Not Issued</Badge>
                            )}
                          </Td>
                          <Td className="text-xs">
                            {paid ? (
                              <span>
                                {pmt?.payment_method ? label(pmt.payment_method) : 'Paid'}
                                {pmt?.transaction_reference ? ` · Ref: ${pmt.transaction_reference}` : ''}
                              </span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </Td>
                          <Td>
                            {!paid && isOwner && Number(s.monthly_salary) > 0 && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setPayMonth(m.key)}
                                className="text-xs font-medium"
                              >
                                Issue Salary
                              </Button>
                            )}
                            {paid && (
                              <span className="text-ok text-xs font-semibold inline-flex items-center gap-1">
                                <CheckCircle2 className="size-3.5" />
                                Paid
                              </span>
                            )}
                          </Td>
                        </tr>
                      );
                    })}
                  </Table>
                )}
              </Async>
            </Card>
          </div>
        )}

        {/* TAB 3: ATTENDANCE */}
        {tab === 'attendance' && (
          <div className="space-y-4">
            {/* Attendance Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                icon={<UserCheck className="size-4" />}
                tone="ok"
                label="Present days"
                value={presentCount}
              />
              <StatCard
                icon={<Clock className="size-4" />}
                tone="warn"
                label="Late / Half day"
                value={lateHalfCount}
              />
              <StatCard
                icon={<XCircle className="size-4" />}
                tone="bad"
                label="Leaves / Absent"
                value={leaveAbsentCount}
              />
              <StatCard
                icon={<CalendarCheck className="size-4" />}
                label="Total marks"
                value={attList.length}
              />
            </div>

            {/* Quick Mark Attendance for this staff member */}
            <Card title="Mark Attendance">
              <ErrorBanner error={markMutation.error} />
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <Field label="Date">
                  {(id) => (
                    <Input
                      id={id}
                      type="date"
                      max={today}
                      value={markDate}
                      onChange={(e) => setMarkDate(e.target.value)}
                    />
                  )}
                </Field>
                <Field label="Status">
                  {(id) => (
                    <Select
                      id={id}
                      value={markStatus}
                      onChange={(e) => setMarkStatus(e.target.value)}
                    >
                      {ATTENDANCE_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {label(st)}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Notes (optional)">
                  {(id) => (
                    <Input
                      id={id}
                      placeholder="e.g. On duty, overtime"
                      value={markNotes}
                      onChange={(e) => setMarkNotes(e.target.value)}
                    />
                  )}
                </Field>
                <div>
                  <Button
                    className="w-full"
                    busy={markMutation.busy}
                    onClick={async () => {
                      const res = await markMutation.run();
                      if (res !== undefined) {
                        attendance.reload();
                        onChanged(`Attendance saved for ${s.full_name}`);
                      }
                    }}
                  >
                    Save Mark
                  </Button>
                </div>
              </div>
            </Card>

            {/* Attendance History */}
            <Card title="Attendance History">
              <Async state={attendance}>
                {(records) =>
                  records.length === 0 ? (
                    <Empty title="No attendance recorded yet" />
                  ) : (
                    <Table head={['Date', 'Status', 'Notes', 'Marked At']}>
                      {records.map((a) => (
                        <tr key={a.id} className="hover:bg-subtle/60">
                          <Td className="font-medium">{fmtDate(a.attendance_date)}</Td>
                          <Td>
                            <Badge status={a.status} />
                          </Td>
                          <Td className="text-muted text-xs">{a.notes || '—'}</Td>
                          <Td className="text-muted text-xs tabular">{fmtDate(a.marked_at)}</Td>
                        </tr>
                      ))}
                    </Table>
                  )
                }
              </Async>
            </Card>
          </div>
        )}

        {/* TAB 4: DAILY REPORTS */}
        {tab === 'reports' && (
          <Card title="Daily Work Reports">
            <Async state={reports}>
              {(reps) =>
                reps.length === 0 ? (
                  <Empty title="No work reports submitted yet" />
                ) : (
                  <Table head={['Report Date', 'Work Summary', 'Status']}>
                    {reps.map((r) => (
                      <tr key={r.id}>
                        <Td className="font-semibold">{fmtDate(r.report_date)}</Td>
                        <Td className="text-xs max-w-md">{r.work_summary}</Td>
                        <Td>
                          <Badge status={r.status || 'submitted'} />
                        </Td>
                      </tr>
                    ))}
                  </Table>
                )
              }
            </Async>
          </Card>
        )}
      </Drawer>

      {/* Pay Salary Confirm Dialog */}
      <Confirm
        open={!!payMonth}
        title={`Issue Salary — ${s.full_name}`}
        confirmLabel={`Confirm & Issue ${inr(s.monthly_salary)}`}
        busy={payMutation.busy}
        onClose={() => setPayMonth(null)}
        body={
          payMonth
            ? `Salary for ${new Date(payMonth + '-01T00:00:00').toLocaleDateString('en-IN', {
                month: 'long',
                year: 'numeric',
              })} (Due on ${fmtDate(payMonth + '-01')}).`
            : ''
        }
        onConfirm={async () => {
          if (await payMutation.run()) {
            const mName = payMonth
              ? new Date(payMonth + '-01T00:00:00').toLocaleDateString('en-IN', {
                  month: 'long',
                  year: 'numeric',
                })
              : '';
            setPayMonth(null);
            setReference('');
            reloadAll();
            onChanged(`Salary for ${mName} recorded as issued`);
          }
        }}
      >
        <ErrorBanner error={payMutation.error} />
        <Field label="Payment Method">
          {(id) => (
            <Select id={id} value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="bank_transfer">Bank Transfer (NEFT/IMPS)</option>
              <option value="upi">UPI / GPay / PhonePe</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
            </Select>
          )}
        </Field>
        <Field label="Transaction Reference / UTR (optional)">
          {(id) => (
            <Input
              id={id}
              placeholder="e.g. UTR number, receipt or cheque number"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          )}
        </Field>
      </Confirm>
    </>
  );
}
