/** Resident complaints: list with PG responses, and a drawer to raise a new one. */
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useAsync, useMutation } from '../../../lib/hooks';
import { fmtDateTime, label } from '../../../lib/format';
import { Async, Badge, Button, Drawer, Empty, ErrorBanner, Field, Input, Select, Textarea, Toast } from '../../../components/ui';
import { createComplaint, listMyComplaints } from '../api';
import { TopBar } from '../ui/Headers';

const CATEGORIES = ['electrical', 'plumbing', 'wifi', 'cleaning', 'furniture', 'food', 'security', 'other'];

export function ResComplaints() {
  const st = useAsync(() => listMyComplaints(), []);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ category: 'electrical', title: '', description: '', priority: 'medium' });
  const [toast, setToast] = useState<string | null>(null);
  const m = useMutation(() => createComplaint(f));

  const footer = (
    <Button
      busy={m.busy}
      disabled={f.title.trim().length < 3 || !f.description.trim()}
      onClick={async () => {
        if (await m.run()) {
          setOpen(false);
          setF({ ...f, title: '', description: '' });
          setToast('Complaint submitted');
          st.reload();
        }
      }}
    >
      Submit
    </Button>
  );

  return (
    <>
      <TopBar
        title="Complaints & Help Desk"
        action={
          <button onClick={() => setOpen(true)} aria-label="Raise complaint" className="p-2 rounded-lg hover:bg-white cursor-pointer">
            <Plus className="size-6" />
          </button>
        }
      />
      <Button className="w-full" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Raise complaint
      </Button>
      <Async state={st}>
        {(rows) =>
          rows.length === 0 ? (
            <Empty title="No complaints raised" />
          ) : (
            <ul className="space-y-2">
              {rows.map((c) => (
                <li key={c.id} className="bg-white border border-line rounded-xl p-3 text-[13px]">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{c.title}</p>
                    <Badge status={c.status} />
                  </div>
                  <p className="text-[12px] text-muted">{label(c.category)} · {fmtDateTime(c.submitted_at)}</p>
                  {c.resolution_notes && <p className="mt-1 text-ink-2">PG: {c.resolution_notes}</p>}
                </li>
              ))}
            </ul>
          )
        }
      </Async>
      <Drawer open={open} onClose={() => setOpen(false)} title="Raise a complaint" footer={footer}>
        <ErrorBanner error={m.error} />
        <Field label="Category">
          {(id) => (
            <Select id={id} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c === 'wifi' ? 'Wi-Fi' : label(c)}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Title" required>
          {(id) => (
            <Input
              id={id}
              maxLength={140}
              value={f.title}
              onChange={(e) => setF({ ...f, title: e.target.value })}
              placeholder="e.g. Fan not working"
            />
          )}
        </Field>
        <Field label="Details" required>
          {(id) => <Textarea id={id} maxLength={2000} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />}
        </Field>
        <Field label="Urgency">
          {(id) => (
            <Select id={id} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
          )}
        </Field>
      </Drawer>
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
