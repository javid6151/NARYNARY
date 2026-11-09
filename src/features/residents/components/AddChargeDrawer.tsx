/**
 * Drawer to add a new charge to a resident (utility, meal, penalty, extra amenity).
 */
import { useState } from 'react';
import { Button, Drawer, ErrorBanner, Field, Input, Select } from '../../../components/ui';
import { isoDate } from '../../../lib/format';
import { addCharge } from '../api';

export function AddChargeDrawer({
  residentId,
  residentName,
  onClose,
  onSaved,
}: {
  residentId: string;
  residentName: string;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [type, setType] = useState('utility');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(isoDate());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      setBusy(true);
      setError(null);
      const amt = Number(amount);
      if (isNaN(amt) || amt <= 0) {
        setError('Amount must be greater than zero');
        return;
      }
      if (!description.trim()) {
        setError('Description is required');
        return;
      }
      await addCharge(residentId, type, description.trim(), amt, dueDate);
      onSaved(`Charge added for ${residentName}`);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to add charge');
    } finally {
      setBusy(false);
    }
  };

  const footer = (
    <div className="flex justify-end gap-2">
      <Button variant="secondary" onClick={onClose} disabled={busy}>
        Cancel
      </Button>
      <Button busy={busy} onClick={handleSave}>
        Add Charge
      </Button>
    </div>
  );

  return (
    <Drawer open onClose={onClose} title={`Add Charge — ${residentName}`} footer={footer}>
      <ErrorBanner error={error} />
      <div className="space-y-4">
        <Field label="Charge Category" required>
          {(id) => (
            <Select id={id} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="utility">Utility (Electricity / Water / WiFi)</option>
              <option value="meal">Meal / Extra Food / Guest Mess</option>
              <option value="late_fee">Late Fee / Fine</option>
              <option value="other">Other / Maintenance / Amenity</option>
            </Select>
          )}
        </Field>
        <Field label="Description" required hint="e.g. October AC electricity bill or Room painting charge">
          {(id) => (
            <Input
              id={id}
              placeholder="e.g. AC electricity reading: 45 units"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          )}
        </Field>
        <Field label="Amount (₹)" required>
          {(id) => (
            <Input
              id={id}
              type="number"
              min="1"
              step="1"
              placeholder="e.g. 1500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          )}
        </Field>
        <Field label="Due Date" required>
          {(id) => <Input id={id} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />}
        </Field>
      </div>
    </Drawer>
  );
}
