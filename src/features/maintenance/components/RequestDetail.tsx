/** Maintenance request drawer: details, attachments, status transitions, linked costs and activity log. */
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useAsync, useMutation } from '../../../lib/hooks';
import { fmtDate, fmtDateTime, inr, label } from '../../../lib/format';
import { Async, Badge, Button, Card, Drawer, ErrorBanner, Field, Input, Textarea } from '../../../components/ui';
import { RecordAttachments } from '../../files/components/RecordAttachments';
import { AddExpenseDrawer } from '../../expenses/components/AddExpenseDrawer';
import { payStatus } from '../../expenses/payStatus';
import type { ExpenseRow } from '../../expenses/types';
import { listMaintenanceActivity, updateMaintenanceStatus } from '../api';
import { NEXT_STATUS } from '../status';
import type { MaintenanceRequest } from '../types';

export function RequestDetail({ r, expenses, onClose, onChanged }: {
  r: MaintenanceRequest;
  /** Expenses whose source is this request. */
  expenses: ExpenseRow[];
  onClose: () => void;
  onChanged: (m: string) => void;
}) {
  const act = useAsync(() => listMaintenanceActivity(r.id), [r.id, r.status]);
  const [note, setNote] = useState('');
  const [assignee, setAssignee] = useState(r.assigned_to ?? '');
  const [addExp, setAddExp] = useState(false);
  const m = useMutation((to: string) => updateMaintenanceStatus(r.id, to, note || null, assignee || null));
  const next = NEXT_STATUS[r.status];

  const facts: [string, string][] = [
    ['Reported', fmtDateTime(r.reported_at)],
    ['Due', r.due_at ? fmtDate(r.due_at) : '—'],
    ['Assigned to', r.vendors?.name ?? r.assigned_to ?? '—'],
    ['Completed', r.completed_at ? fmtDateTime(r.completed_at) : '—'],
    ['Linked complaint', r.complaint_id ? 'Yes — resident is notified on completion' : 'No'],
  ];

  const addCost = (
    <Button variant="ghost" size="sm" onClick={() => setAddExp(true)}>
      <Plus className="size-4" />
      Add cost
    </Button>
  );

  return (
    <Drawer open onClose={onClose} title="Maintenance request" wide>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">{r.title}</p>
          <p className="text-[13px] text-muted">
            {r.maintenance_categories.name} · {r.rooms ? `Room ${r.rooms.room_number}` : r.floors?.name ?? 'Whole building'}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge status={r.priority} />
          <Badge status={r.status} />
        </div>
      </div>
      <p className="text-[13px] whitespace-pre-wrap">{r.description}</p>
      <dl className="grid grid-cols-2 gap-y-2 text-[13px]">
        {facts.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right">{v}</dd>
          </div>
        ))}
      </dl>
      {r.completion_notes && (
        <p className="rounded-lg bg-ok-bg text-ok text-[13px] px-3 py-2">Completion notes: {r.completion_notes}</p>
      )}
      <RecordAttachments kind="maintenance_attachment" recordId={r.id} title="Photos & documents" />

      {next && (
        <Card title="Update status">
          <div className="space-y-3">
            <ErrorBanner error={m.error} />
            {r.status === 'open' && (
              <Field label="Assign to">
                {(id) => <Input id={id} value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Staff name" />}
              </Field>
            )}
            <Field label="Note">
              {(id) => (
                <Textarea
                  id={id}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Work notes, reason for hold, completion details…"
                />
              )}
            </Field>
            <div className="flex flex-wrap gap-2">
              {next.map((n) => (
                <Button
                  key={n.to}
                  variant={n.variant ?? 'primary'}
                  size="sm"
                  busy={m.busy}
                  onClick={async () => {
                    if ((await m.run(n.to)) !== undefined) {
                      setNote('');
                      onChanged(`Request ${label(n.to).toLowerCase()}`);
                      onClose();
                    }
                  }}
                >
                  {n.label}
                </Button>
              ))}
            </div>
          </div>
        </Card>
      )}

      <Card title="Linked expenses" action={addCost}>
        {expenses.length === 0 ? (
          <p className="text-[13px] text-muted">No costs recorded. Costs go into the shared expense ledger.</p>
        ) : (
          <ul className="divide-y divide-line text-[13px]">
            {expenses.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2">
                <span className="flex-1">{e.title}</span>
                <span className="tabular">{inr(e.total_amount)}</span>
                <Badge status={payStatus(e)} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Activity">
        <Async state={act}>
          {(rows) => (
            <ol className="relative border-l border-line ml-2 space-y-3">
              {rows.map((a) => (
                <li key={a.id} className="pl-4 text-[13px]">
                  <span className="absolute -left-1.5 size-3 rounded-full bg-brand-500 mt-1" aria-hidden />
                  <p>{a.from_status ? `${label(a.from_status)} → ${label(a.to_status)}` : 'Created'}</p>
                  {a.note && <p className="text-ink-2">{a.note}</p>}
                  <p className="text-[12px] text-muted">{fmtDateTime(a.created_at)}</p>
                </li>
              ))}
            </ol>
          )}
        </Async>
      </Card>

      <AddExpenseDrawer
        open={addExp}
        maintenance={{ id: r.id, title: r.title }}
        onClose={() => setAddExp(false)}
        onDone={(msg) => {
          setAddExp(false);
          onChanged(msg);
        }}
      />
    </Drawer>
  );
}
