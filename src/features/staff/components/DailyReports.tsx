/** Record a staff member's end-of-day work summary and browse recent reports. */
import { useState } from 'react';
import { useAsync, useMutation } from '../../../lib/hooks';
import { addDays, fmtDate, isoDate, label } from '../../../lib/format';
import { Async, Button, Card, Empty, ErrorBanner, Field, Input, Select, Textarea } from '../../../components/ui';
import { listDailyReports, submitDailyReport } from '../api';
import type { StaffMember } from '../types';

export function DailyReports({ buildingId, staff }: { buildingId: string; staff: StaffMember[] }) {
  const [from, setFrom] = useState(addDays(isoDate(), -7));
  const st = useAsync(() => listDailyReports(buildingId, from), [buildingId, from]);
  const [sid, setSid] = useState('');
  const [date, setDate] = useState(isoDate());
  const [text, setText] = useState('');
  const m = useMutation(() => submitDailyReport(sid, date, text));
  return (
    <div className="grid lg:grid-cols-3 gap-5">
      <Card title="Record end-of-day report">
        <div className="space-y-3">
          <ErrorBanner error={m.error} />
          <Field label="Staff member" required>
            {(id) => (
              <Select id={id} value={sid} onChange={(e) => setSid(e.target.value)}>
                <option value="">Select</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name} — {label(s.role)}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Date">{(id) => <Input id={id} type="date" max={isoDate()} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
          <Field label="Work summary" required>
            {(id) => <Textarea id={id} value={text} onChange={(e) => setText(e.target.value)} placeholder="What was done today…" />}
          </Field>
          <Button
            busy={m.busy}
            disabled={!sid || text.trim().length < 3}
            onClick={async () => {
              if (await m.run()) {
                setText('');
                st.reload();
              }
            }}
          >
            Save report
          </Button>
        </div>
      </Card>
      <Card
        title="Recent reports"
        className="lg:col-span-2"
        action={<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40 h-8" aria-label="From date" />}
      >
        <Async state={st}>
          {(rows) =>
            rows.length === 0 ? (
              <Empty title="No reports in this period" />
            ) : (
              <ul className="divide-y divide-line">
                {rows.map((r) => (
                  <li key={r.id} className="py-3 text-[13px]">
                    <p className="font-medium">
                      {r.staff_members.full_name}{' '}
                      <span className="text-muted font-normal">· {label(r.staff_members.role)} · {fmtDate(r.report_date)}</span>
                    </p>
                    <p className="text-ink-2 mt-1 whitespace-pre-wrap">{r.work_summary}</p>
                  </li>
                ))}
              </ul>
            )
          }
        </Async>
      </Card>
    </div>
  );
}
