/**
 * Complaint drawer: details, status update with a note to the resident, and
 * "Create maintenance request" when work is needed. Closed/rejected complaints are read-only.
 */
import { useState } from 'react';
import { Wrench } from 'lucide-react';
import { useMutation } from '../../../lib/hooks';
import { fmtDateTime, label } from '../../../lib/format';
import { Badge, Button, Drawer, ErrorBanner, Field, Select, Textarea } from '../../../components/ui';
import { updateComplaintStatus } from '../api';
import type { Complaint } from '../types';
import { CreateRequestDrawer } from './CreateRequestDrawer';

const STATUSES = ['open', 'in_progress', 'awaiting_resident', 'resolved', 'closed', 'rejected'];

export function ComplaintDrawer({ c, onClose, onChanged }: { c: Complaint; onClose: () => void; onChanged: (m: string) => void }) {
  const [status, setStatus] = useState(c.status);
  const [notes, setNotes] = useState('');
  const [mk, setMk] = useState(false);
  const m = useMutation(() => updateComplaintStatus(c.id, status, notes || null));
  const closed = ['closed', 'rejected'].includes(c.status);

  const footer = !closed ? (
    <Button
      busy={m.busy}
      disabled={status === c.status && !notes}
      onClick={async () => {
        if ((await m.run()) !== undefined) {
          onChanged('Complaint updated; resident notified');
          onClose();
        }
      }}
    >
      Save update
    </Button>
  ) : undefined;

  return (
    <Drawer open onClose={onClose} title="Complaint" footer={footer}>
      <div>
        <p className="text-lg font-semibold">{c.title}</p>
        <p className="text-[13px] text-muted">
          {c.residents.full_name}
          {c.rooms ? ` · Room ${c.rooms.room_number}` : ''} · {fmtDateTime(c.submitted_at)}
        </p>
        <div className="flex gap-2 mt-2">
          <Badge status={c.priority} />
          <Badge status={c.status} />
          <Badge tone="neutral">{label(c.category)}</Badge>
        </div>
      </div>
      <p className="text-[13px] whitespace-pre-wrap rounded-lg bg-subtle p-3">{c.description}</p>
      {c.resolution_notes && (
        <p className="text-[13px]">
          <span className="text-muted">Notes:</span> {c.resolution_notes}
        </p>
      )}
      {c.maintenance_requests.length > 0 ? (
        <p className="text-[13px] rounded-lg bg-info-bg text-info px-3 py-2">
          Linked maintenance request: {label(c.maintenance_requests[0].status)}. Completing it resolves this complaint.
        </p>
      ) : (
        !closed && (
          <Button variant="secondary" onClick={() => setMk(true)}>
            <Wrench className="size-4" />
            Create maintenance request
          </Button>
        )
      )}
      {!closed && (
        <>
          <ErrorBanner error={m.error} />
          <Field label="Status">
            {(id) => (
              <Select id={id} value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Note to resident">{(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
        </>
      )}
      <CreateRequestDrawer
        open={mk}
        complaint={{ id: c.id, title: c.title, description: c.description, room_id: c.room_id }}
        onClose={() => setMk(false)}
        onDone={() => {
          setMk(false);
          onChanged('Maintenance request created');
          onClose();
        }}
      />
    </Drawer>
  );
}
