/**
 * Visitor passes: the resident requests a pass for a guest; the PG office approves it and a pass code is
 * issued to show at the gate. Pending or approved passes can be cancelled by the resident.
 */
import { useState } from 'react';
import { Plus, Ticket } from 'lucide-react';
import { useAsync, useMutation } from '../../../lib/hooks';
import { addDays, fmtDate, fmtDateTime, isoDate } from '../../../lib/format';
import { PHONE_RE } from '../../../lib/validation';
import { Async, Badge, Button, Drawer, Empty, ErrorBanner, Field, Input, Toast } from '../../../components/ui';
import { cancelVisitorPass, listVisitorPasses, requestVisitorPass } from '../../community/api';
import { TopBar } from '../ui/Headers';

const STATUS_TEXT: Record<string, string> = {
  pending: 'Waiting for approval',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  checked_in: 'Checked in',
  checked_out: 'Visit completed',
};

export function VisitorPasses() {
  const st = useAsync(() => listVisitorPasses(), []);
  const [create, setCreate] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const cancel = useMutation((id: string) => cancelVisitorPass(id));

  const newButton = (
    <button onClick={() => setCreate(true)} aria-label="New visitor pass" className="p-2 rounded-lg hover:bg-white cursor-pointer">
      <Plus className="size-6" />
    </button>
  );

  return (
    <>
      <TopBar title="Visitor Passes" action={newButton} />
      <ErrorBanner error={cancel.error} />
      <Async state={st}>
        {(rows) =>
          rows.length === 0 ? (
            <Empty title="No visitor passes" action={<Button onClick={() => setCreate(true)}>Request a pass</Button>}>
              Request a pass before your guest arrives; show the code at the gate.
            </Empty>
          ) : (
            <ul className="space-y-3">
              {rows.map((v) => (
                <li key={v.id} className="bg-white border border-line rounded-2xl p-4 text-[13.5px]">
                  <div className="flex items-start gap-3">
                    <span className="size-10 rounded-xl bg-info-bg text-info grid place-items-center shrink-0">
                      <Ticket className="size-5" aria-hidden />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold">{v.visitor_name}</p>
                        <Badge status={v.status === 'pending' ? 'pending' : v.status}>{STATUS_TEXT[v.status]}</Badge>
                      </div>
                      <p className="text-[12.5px] text-muted">
                        {fmtDate(v.visit_date)}
                        {v.purpose ? ` · ${v.purpose}` : ''}
                      </p>
                      {v.pass_code && ['approved', 'checked_in'].includes(v.status) && (
                        <p className="mt-2 inline-block rounded-lg bg-brand-50 px-3 py-1.5 text-brand-700">
                          Pass code <b className="tabular tracking-widest">{v.pass_code}</b>
                        </p>
                      )}
                      {v.decision_note && <p className="text-[12.5px] text-ink-2 mt-1">Office: {v.decision_note}</p>}
                      {v.checked_in_at && <p className="text-[12px] text-muted mt-1">Arrived {fmtDateTime(v.checked_in_at)}</p>}
                      {['pending', 'approved'].includes(v.status) && (
                        <Button
                          size="sm"
                          variant="danger"
                          className="mt-3"
                          busy={cancel.busy}
                          onClick={async () => {
                            if ((await cancel.run(v.id)) !== undefined) {
                              setToast('Pass cancelled');
                              st.reload();
                            }
                          }}
                        >
                          Cancel pass
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )
        }
      </Async>
      {create && (
        <NewPassSheet
          onClose={() => setCreate(false)}
          onDone={() => {
            setCreate(false);
            setToast('Pass requested — the office will review it');
            st.reload();
          }}
        />
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}

function NewPassSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: '', phone: '', date: isoDate(), purpose: '' });
  const [err, setErr] = useState<string | null>(null);
  const m = useMutation(() =>
    requestVisitorPass({ name: f.name, phone: f.phone.trim() || null, date: f.date, purpose: f.purpose || null }),
  );
  const submit = async () => {
    if (f.phone.trim() && !PHONE_RE.test(f.phone.trim())) {
      setErr('Enter a valid phone number');
      return;
    }
    setErr(null);
    if (await m.run()) onDone();
  };
  const footer = (
    <Button busy={m.busy} disabled={f.name.trim().length < 2 || !f.date} onClick={submit}>
      Request pass
    </Button>
  );
  return (
    <Drawer open onClose={onClose} title="Request visitor pass" footer={footer}>
      <ErrorBanner error={m.error} />
      <Field label="Visitor name" required>
        {(id) => <Input id={id} maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}
      </Field>
      <Field label="Visitor phone" error={err}>
        {(id) => <Input id={id} inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />}
      </Field>
      <Field label="Visit date" required hint="Within the next 30 days">
        {(id) => (
          <Input
            id={id}
            type="date"
            min={isoDate()}
            max={addDays(isoDate(), 30)}
            value={f.date}
            onChange={(e) => setF({ ...f, date: e.target.value })}
          />
        )}
      </Field>
      <Field label="Purpose">
        {(id) => (
          <Input
            id={id}
            maxLength={200}
            value={f.purpose}
            onChange={(e) => setF({ ...f, purpose: e.target.value })}
            placeholder="e.g. Parent visiting"
          />
        )}
      </Field>
    </Drawer>
  );
}
