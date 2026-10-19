/**
 * Record a resident payment. Shows the resident's open charges and previews how the amount
 * will be applied (oldest due first, same rule as the server); any excess is kept as an advance.
 * The idempotency key is reused until the save succeeds, so a retried click records once.
 */
import { useState } from 'react';
import { newKey } from '../../../lib/api';
import { useAsync, useMutation } from '../../../lib/hooks';
import { fmtDate, inr, isoDate } from '../../../lib/format';
import { Button, Drawer, ErrorBanner, Field, Input, Select, Textarea } from '../../../components/ui';
import { listResidentOpenCharges, recordPayment } from '../api';
import type { ChargeBalance } from '../types';
import { ResidentSelect } from './ResidentSelect';

export function RecordPaymentDrawer({ open, resident, onClose, onDone }: {
  open: boolean;
  /** Pre-selected resident; null shows a resident picker. */
  resident: { id: string; full_name: string } | null;
  onClose: () => void;
  onDone: (m: string) => void;
}) {
  const [rid, setRid] = useState<{ id: string; full_name: string } | null>(resident);
  const target = resident ?? rid;
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('upi');
  const [ref, setRef] = useState('');
  const [date, setDate] = useState(isoDate());
  const [notes, setNotes] = useState('');
  const [key, setKey] = useState(newKey);
  const charges = useAsync(
    () => (target ? listResidentOpenCharges(target.id) : Promise.resolve([] as ChargeBalance[])),
    [target?.id, open],
  );
  const cs = charges.data ?? [];
  const due = cs.reduce((s, c) => s + Number(c.balance), 0);
  const m = useMutation(() =>
    recordPayment({
      residentId: target!.id,
      amount: Number(amount),
      method,
      reference: ref || null,
      // Chosen date at the current local time of day.
      paidAt: new Date(date + 'T' + new Date().toTimeString().slice(0, 8)).toISOString(),
      notes: notes || null,
      idempotencyKey: key,
    }),
  );

  // Preview of the oldest-first allocation.
  let left = Number(amount || 0);
  const preview = cs.map((c) => {
    const take = Math.min(left, Number(c.balance));
    left -= take;
    return { ...c, take };
  });

  const reset = () => {
    setAmount('');
    setRef('');
    setNotes('');
    setRid(null);
  };
  const close = () => {
    reset();
    m.setError(null);
    onClose();
  };
  const save = async () => {
    const r = await m.run();
    if (r) {
      setKey(newKey());
      reset();
      const advance = Number(r.unallocated) > 0 ? ` · ${inr(r.unallocated)} kept as advance` : '';
      onDone(`Payment saved · Receipt ${r.receipt_number}${advance}`);
    }
  };

  const footer = (
    <>
      <Button variant="secondary" onClick={close}>Cancel</Button>
      <Button busy={m.busy} disabled={!target || !(Number(amount) > 0)} onClick={save}>Save payment</Button>
    </>
  );

  return (
    <Drawer open={open} onClose={close} title="Record payment" footer={footer}>
      <ErrorBanner error={m.error} />
      {resident ? (
        <p className="font-medium">{resident.full_name}</p>
      ) : (
        <ResidentSelect value={rid?.id ?? ''} onChange={(id, name) => setRid(id ? { id, full_name: name } : null)} />
      )}
      {target && (
        <div className="rounded-lg bg-subtle p-3 text-[13px]">
          <div className="flex justify-between mb-2">
            <span className="text-muted">Outstanding</span>
            <b className="tabular">{inr(due, true)}</b>
          </div>
          {cs.length === 0 ? (
            <p className="text-muted">No pending charges — the payment will be kept as an advance.</p>
          ) : (
            <ul className="space-y-1">
              {preview.map((c) => (
                <li key={c.id} className="flex justify-between gap-2">
                  <span className="truncate">
                    {c.description} <span className="text-muted">· due {fmtDate(c.due_date)}</span>
                  </span>
                  <span className="tabular whitespace-nowrap">
                    {c.take > 0 ? <span className="text-ok">−{inr(c.take, true)}</span> : null}{' '}
                    <span className="text-muted">/ {inr(c.balance, true)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {cs.length > 0 && (
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setAmount(String(due))}>
              Pay full {inr(due, true)}
            </Button>
          )}
        </div>
      )}
      <Field label="Amount (₹)" required hint="Applied to the oldest dues first">
        {(id) => <Input id={id} type="number" min={1} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Method" required>
          {(id) => (
            <Select id={id} value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="upi">UPI</option>
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="card">Card</option>
              <option value="other">Other</option>
            </Select>
          )}
        </Field>
        <Field label="Paid on" required>
          {(id) => <Input id={id} type="date" max={isoDate()} value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
      </div>
      <Field label="Transaction reference" hint="UPI / UTR / cheque number">
        {(id) => <Input id={id} value={ref} onChange={(e) => setRef(e.target.value)} />}
      </Field>
      <Field label="Notes">{(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
    </Drawer>
  );
}
