/** Expense drawer: totals, attachments, payment history and a form to record a further payment. */
import { useState } from 'react';
import { newKey } from '../../../lib/api';
import { useAsync, useMutation } from '../../../lib/hooks';
import { fmtDate, inr, isoDate, label } from '../../../lib/format';
import { Async, Button, Card, Drawer, ErrorBanner, Field, Input, Select } from '../../../components/ui';
import { RecordAttachments } from '../../files/components/RecordAttachments';
import { listExpensePayments, recordExpensePayment } from '../api';
import type { ExpenseRow } from '../types';

export function ExpenseDetail({ e, onClose, onChanged }: { e: ExpenseRow; onClose: () => void; onChanged: (m: string) => void }) {
  // Reload payments whenever the paid amount changes (after recording one).
  const pays = useAsync(() => listExpensePayments(e.id), [e.id, e.paid_amount]);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('upi');
  const [ref, setRef] = useState('');
  const [date, setDate] = useState(isoDate());
  const [key, setKey] = useState(newKey);
  const m = useMutation(() =>
    recordExpensePayment({
      expenseId: e.id,
      amount: Number(amount),
      method,
      reference: ref || null,
      paidAt: new Date(date + 'T12:00:00').toISOString(),
      idempotencyKey: key,
    }),
  );

  const record = async () => {
    if (await m.run()) {
      setKey(newKey());
      setAmount('');
      setRef('');
      onChanged('Expense payment recorded');
    }
  };

  const totals: [string, number][] = [
    ['Total', e.total_amount],
    ['Paid', e.paid_amount],
    ['Outstanding', e.outstanding_amount],
  ];

  return (
    <Drawer open onClose={onClose} title="Expense details">
      <div>
        <p className="text-lg font-semibold">{e.title}</p>
        <p className="text-[13px] text-muted">
          {e.expense_categories.name} · {fmtDate(e.expense_date)}
          {e.vendors ? ` · ${e.vendors.name}` : ''}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2 text-[13px]">
        {totals.map(([k, v]) => (
          <div key={k} className="rounded-lg border border-line p-3">
            <p className="text-muted text-[12px]">{k}</p>
            <p className="font-semibold tabular">{inr(v, true)}</p>
          </div>
        ))}
      </div>
      {e.description && <p className="text-[13px]">{e.description}</p>}
      <RecordAttachments kind="expense_invoice" recordId={e.id} title="Invoices & bills" />
      <Card title="Payment transactions" pad>
        <Async state={pays}>
          {(ps) =>
            ps.length === 0 ? (
              <p className="text-[13px] text-muted">No payments yet.</p>
            ) : (
              <ul className="divide-y divide-line text-[13px]">
                {ps.map((p) => (
                  <li key={p.id} className="flex justify-between py-2">
                    <span>
                      {fmtDate(p.paid_at)} · {label(p.payment_method)}
                      {p.transaction_reference ? ` · ${p.transaction_reference}` : ''}
                    </span>
                    <b className="tabular">{inr(p.amount, true)}</b>
                  </li>
                ))}
              </ul>
            )
          }
        </Async>
      </Card>
      {Number(e.outstanding_amount) > 0 && (
        <fieldset className="rounded-lg border border-line p-3 space-y-3">
          <legend className="text-[13px] font-medium px-1">Record payment</legend>
          <ErrorBanner error={m.error} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (₹)" hint={`Up to ${inr(e.outstanding_amount, true)}`}>
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min={1}
                  max={Number(e.outstanding_amount)}
                  value={amount}
                  onChange={(x) => setAmount(x.target.value)}
                />
              )}
            </Field>
            <Field label="Paid on">
              {(id) => <Input id={id} type="date" value={date} max={isoDate()} onChange={(x) => setDate(x.target.value)} />}
            </Field>
            <Field label="Method">
              {(id) => (
                <Select id={id} value={method} onChange={(x) => setMethod(x.target.value)}>
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="cheque">Cheque</option>
                </Select>
              )}
            </Field>
            <Field label="Reference">{(id) => <Input id={id} value={ref} onChange={(x) => setRef(x.target.value)} />}</Field>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setAmount(String(e.outstanding_amount))}>Full amount</Button>
            <Button size="sm" busy={m.busy} disabled={!(Number(amount) > 0)} onClick={record}>Record payment</Button>
          </div>
        </fieldset>
      )}
    </Drawer>
  );
}
