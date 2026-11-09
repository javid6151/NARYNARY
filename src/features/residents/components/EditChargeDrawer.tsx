/**
 * Drawer to edit an existing charge or grant a discount / concession on it.
 * Note: discounts reduce the balance without recording income/profit.
 */
import { useState } from 'react';
import { Button, Drawer, ErrorBanner, Field, Input } from '../../../components/ui';
import { inr } from '../../../lib/format';
import { applyDiscount, updateCharge, waiveCharge } from '../api';
import type { ResidentCharge } from '../types';

export function EditChargeDrawer({
  charge,
  residentId,
  onClose,
  onSaved,
}: {
  charge: ResidentCharge | null;
  residentId: string;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  if (!charge) return null;

  const [mode, setMode] = useState<'edit' | 'discount'>('edit');
  const [amount, setAmount] = useState(String(charge.amount));
  const [description, setDescription] = useState(charge.description || '');
  const [dueDate, setDueDate] = useState(charge.due_date);
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountReason, setDiscountReason] = useState('Owner discount / concession');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paid = Number(charge.paid_amount || 0);
  const balance = Number((charge as any).balance ?? (Number(charge.amount) - paid));

  const handleSaveEdit = async () => {
    try {
      setBusy(true);
      setError(null);
      const newAmt = Number(amount);
      if (isNaN(newAmt) || newAmt <= 0) {
        setError('Amount must be greater than zero');
        return;
      }
      if (newAmt < paid) {
        setError(`Amount cannot be less than already paid (₹${paid})`);
        return;
      }
      await updateCharge({
        chargeId: charge.id,
        amount: newAmt,
        description: description.trim() || undefined,
        dueDate,
      });
      onSaved('Charge updated successfully');
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to update charge');
    } finally {
      setBusy(false);
    }
  };

  const handleApplyDiscount = async () => {
    try {
      setBusy(true);
      setError(null);
      const disc = Number(discountAmount);
      if (isNaN(disc) || disc <= 0) {
        setError('Enter a valid discount amount');
        return;
      }
      if (disc > balance) {
        setError(`Discount cannot exceed remaining balance (₹${balance})`);
        return;
      }
      await applyDiscount({
        residentId,
        chargeId: charge.id,
        discountAmount: disc,
        reason: discountReason.trim() || undefined,
      });
      onSaved(`₹${disc} discount applied (not added to income/profit)`);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to apply discount');
    } finally {
      setBusy(false);
    }
  };

  const handleFullWaive = async () => {
    if (!window.confirm(`Are you sure you want to completely waive the remaining balance of ₹${balance}?`)) {
      return;
    }
    try {
      setBusy(true);
      setError(null);
      if (paid === 0) {
        await waiveCharge(charge.id, discountReason.trim() || 'Full waiver');
      } else {
        await applyDiscount({
          residentId,
          chargeId: charge.id,
          discountAmount: balance,
          reason: discountReason.trim() || 'Full balance waiver',
        });
      }
      onSaved(`Charge waived (₹${balance} discount granted)`);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to waive charge');
    } finally {
      setBusy(false);
    }
  };

  const footer = (
    <div className="flex items-center justify-between w-full">
      {mode === 'discount' && paid === 0 ? (
        <Button variant="danger" size="sm" disabled={busy} onClick={handleFullWaive}>
          Waive Entire ₹{balance}
        </Button>
      ) : <span />}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          busy={busy}
          onClick={mode === 'edit' ? handleSaveEdit : handleApplyDiscount}
        >
          {mode === 'edit' ? 'Save Changes' : 'Apply Discount'}
        </Button>
      </div>
    </div>
  );

  return (
    <Drawer open onClose={onClose} title="Manage Resident Charge" footer={footer}>
      <ErrorBanner error={error} />

      <div className="rounded-xl border border-line bg-subtle/50 p-3.5 space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-muted">Charge Description</span>
          <span className="font-semibold text-ink">{charge.description}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Total Billed</span>
          <span className="font-bold tabular text-ink">{inr(charge.amount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Paid So Far</span>
          <span className="font-semibold tabular text-ok">{inr(paid)}</span>
        </div>
        <div className="flex justify-between pt-1 border-t border-line font-bold">
          <span className="text-muted">Current Balance Due</span>
          <span className="tabular text-brand-700">{inr(balance)}</span>
        </div>
      </div>

      {/* Tabs: Edit Charge Details vs Apply Discount */}
      <div className="flex rounded-xl bg-subtle p-1 gap-1">
        <button
          type="button"
          onClick={() => setMode('edit')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            mode === 'edit' ? 'bg-white shadow-xs text-ink' : 'text-muted hover:text-ink'
          }`}
        >
          ✏️ Edit Details
        </button>
        <button
          type="button"
          onClick={() => setMode('discount')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            mode === 'discount' ? 'bg-white shadow-xs text-brand-700' : 'text-muted hover:text-ink'
          }`}
        >
          🏷️ Give Discount
        </button>
      </div>

      {mode === 'edit' ? (
        <div className="space-y-4 pt-1">
          <Field label="Description" required>
            {(id) => <Input id={id} value={description} onChange={(e) => setDescription(e.target.value)} />}
          </Field>
          <Field label="Total Amount (₹)" required hint={paid > 0 ? `Minimum ₹${paid} (already paid)` : 'Billed charge amount'}>
            {(id) => (
              <Input
                id={id}
                type="number"
                min={paid}
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            )}
          </Field>
          <Field label="Due Date" required>
            {(id) => <Input id={id} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />}
          </Field>
        </div>
      ) : (
        <div className="space-y-4 pt-1">
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900 leading-relaxed">
            💡 <b>Non-revenue discount:</b> Applying a discount reduces the resident's dues directly. It is <u>not</u> added to revenue, cash collection, or income statements.
          </div>

          <Field label="Discount Amount (₹)" required hint={`Max ₹${balance} (remaining balance)`}>
            {(id) => (
              <Input
                id={id}
                type="number"
                min="1"
                max={balance}
                placeholder={`e.g. ${Math.min(500, balance)}`}
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
              />
            )}
          </Field>

          <Field label="Reason / Notes for Concession">
            {(id) => (
              <Input
                id={id}
                placeholder="e.g. Room shift goodwill, festival discount, late fee waiver"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
              />
            )}
          </Field>
        </div>
      )}
    </Drawer>
  );
}
