/**
 * Record a resident payment. Shows the resident's open charges and previews how the amount
 * will be applied (oldest due first, same rule as the server); any excess is kept as an advance.
 * The idempotency key is reused until the save succeeds, so a retried click records once.
 */
import { useState } from 'react';
import { Tag } from 'lucide-react';
import { newKey } from '../../../lib/api';
import { useAsync, useMutation } from '../../../lib/hooks';
import { fmtDate, inr, isoDate } from '../../../lib/format';
import { Button, Drawer, ErrorBanner, Field, Input, Select, Textarea } from '../../../components/ui';
import { listResidentOpenCharges, recordPayment } from '../api';
import { applyDiscount } from '../../residents/api';
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

  // Discount / Concession state (not added to income/profit)
  const [giveDiscount, setGiveDiscount] = useState(false);
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountReason, setDiscountReason] = useState('Payment discount / concession');

  const charges = useAsync(
    () => (target ? listResidentOpenCharges(target.id) : Promise.resolve([] as ChargeBalance[])),
    [target?.id, open],
  );
  const cs = charges.data ?? [];
  const due = cs.reduce((s, c) => s + Number(c.balance), 0);

  const isFullDiscountMode = method === 'discount';
  const discNum = isFullDiscountMode ? Number(discountAmount || amount || 0) : Number(discountAmount || 0);
  const netDueAfterDiscount = Math.max(0, due - (giveDiscount ? discNum : 0));

  const m = useMutation(async () => {
    // 1. If discount is given, apply it first directly to charges
    if ((giveDiscount || isFullDiscountMode) && discNum > 0) {
      await applyDiscount({
        residentId: target!.id,
        discountAmount: discNum,
        reason: (isFullDiscountMode ? notes : discountReason) || 'Payment concession granted',
      });
    }

    // 2. If it is purely a discount waiver mode (₹0 cash received), return early
    if (isFullDiscountMode) {
      return { isDiscountOnly: true, discountAmount: discNum };
    }

    // 3. If cash/UPI payment is collected, record the actual collected amount
    if (Number(amount) > 0) {
      const p = await recordPayment({
        residentId: target!.id,
        amount: Number(amount),
        method,
        reference: ref || null,
        paidAt: new Date(date + 'T' + new Date().toTimeString().slice(0, 8)).toISOString(),
        notes: notes ? `${notes}${discNum > 0 ? ` (₹${discNum} discount granted)` : ''}` : discNum > 0 ? `₹${discNum} discount granted` : null,
        idempotencyKey: key,
      });
      return { ...p, discountAmount: discNum };
    }

    return null;
  });

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
    setDiscountAmount('');
    setGiveDiscount(false);
    setRid(null);
  };
  const close = () => {
    reset();
    m.setError(null);
    onClose();
  };
  const save = async () => {
    const r: any = await m.run();
    if (r) {
      setKey(newKey());
      reset();
      if (r.isDiscountOnly) {
        onDone(`₹${r.discountAmount} discount applied. Dues settled without adding to profit/income.`);
      } else {
        const advance = Number(r.unallocated) > 0 ? ` · ${inr(r.unallocated)} kept as advance` : '';
        const discText = r.discountAmount > 0 ? ` (₹${r.discountAmount} discount applied)` : '';
        onDone(`Payment saved · Receipt ${r.receipt_number}${advance}${discText}`);
      }
    }
  };

  const isSaveDisabled =
    !target ||
    (isFullDiscountMode
      ? discNum <= 0
      : !(Number(amount) > 0) && (!giveDiscount || discNum <= 0));

  const footer = (
    <>
      <Button variant="secondary" onClick={close}>Cancel</Button>
      <Button busy={m.busy} disabled={isSaveDisabled} onClick={save}>
        {isFullDiscountMode ? 'Apply Full Discount' : giveDiscount && discNum > 0 ? `Save Payment & Discount` : 'Save payment'}
      </Button>
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
            <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-line/60">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAmount(String(giveDiscount && discNum > 0 ? netDueAfterDiscount : due))}
              >
                Pay {giveDiscount && discNum > 0 ? `net ${inr(netDueAfterDiscount, true)}` : `full ${inr(due, true)}`}
              </Button>

              {!giveDiscount && !isFullDiscountMode && due > 0 && (
                <button
                  type="button"
                  onClick={() => setGiveDiscount(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline cursor-pointer"
                >
                  <Tag className="size-3" />
                  <span>+ Give discount</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Discount / Concession Section */}
      {(giveDiscount || isFullDiscountMode) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 space-y-3 text-xs text-amber-950">
          <div className="flex items-center justify-between">
            <span className="font-bold flex items-center gap-1.5 text-amber-900">
              <Tag className="size-3.5" />
              <span>Discount / Waiver (Non-Revenue)</span>
            </span>
            {!isFullDiscountMode && (
              <button
                type="button"
                onClick={() => {
                  setGiveDiscount(false);
                  setDiscountAmount('');
                }}
                className="text-[11px] text-muted hover:text-ink cursor-pointer underline"
              >
                Remove
              </button>
            )}
          </div>
          <p className="text-[11.5px] text-amber-800 leading-relaxed">
            ℹ️ Discounts reduce the resident's dues directly. They are <b>excluded from profit, income, and cash collection totals</b>.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 pt-1">
            <Field label="Discount Amount (₹)" required hint={`Max ₹${due}`}>
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min="1"
                  max={due}
                  placeholder="e.g. 200"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                />
              )}
            </Field>
            <Field label="Discount Reason">
              {(id) => (
                <Input
                  id={id}
                  placeholder="e.g. Concession / goodwill"
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                />
              )}
            </Field>
          </div>
          {due > 0 && Number(discountAmount) > 0 && (
            <div className="flex justify-between items-center pt-2 border-t border-amber-200/80 font-medium">
              <span>Remaining payable dues:</span>
              <span className="font-bold tabular text-amber-950">{inr(netDueAfterDiscount, true)}</span>
            </div>
          )}
        </div>
      )}

      {!isFullDiscountMode && (
        <Field
          label="Amount Collected (₹)"
          required
          hint={giveDiscount && discNum > 0 ? `Net cash/UPI collected after ₹${discNum} discount` : 'Applied to the oldest dues first'}
        >
          {(id) => <Input id={id} type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />}
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Method" required>
          {(id) => (
            <Select id={id} value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="card">Card</option>
              <option value="other">Other</option>
              <option value="discount">🏷️ Discount / Full Waiver (₹0 collected)</option>
            </Select>
          )}
        </Field>
        <Field label="Paid on" required>
          {(id) => <Input id={id} type="date" max={isoDate()} value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
      </div>

      {!isFullDiscountMode && (
        <Field label="Transaction reference" hint="UPI / UTR / cheque number">
          {(id) => <Input id={id} value={ref} onChange={(e) => setRef(e.target.value)} />}
        </Field>
      )}

      <Field label="Notes">{(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
    </Drawer>
  );
}
