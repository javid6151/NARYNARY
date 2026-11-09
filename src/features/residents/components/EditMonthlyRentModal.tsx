/**
 * Modal to edit a resident's agreed monthly rent for future billing cycles.
 */
import { useState } from 'react';
import { Confirm, ErrorBanner, Field, Input } from '../../../components/ui';
import { updateResidentMonthlyRent } from '../api';

export function EditMonthlyRentModal({
  residentId,
  currentRent,
  residentName,
  onClose,
  onSaved,
}: {
  residentId: string;
  currentRent: number;
  residentName: string;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [rent, setRent] = useState(String(currentRent || ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      setBusy(true);
      setError(null);
      const r = Number(rent);
      if (isNaN(r) || r < 0) {
        setError('Please enter a valid monthly rent amount');
        return;
      }
      await updateResidentMonthlyRent(residentId, r);
      onSaved(`Monthly rent updated to ₹${r.toLocaleString('en-IN')}`);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to update rent');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Confirm
      open
      title={`Update Monthly Rent — ${residentName}`}
      body="This sets the agreed monthly fee used when recurring rent charges are generated for this resident."
      confirmLabel="Update Rent"
      busy={busy}
      onConfirm={handleSave}
      onClose={onClose}
    >
      <ErrorBanner error={error} />
      <div className="pt-2">
        <Field label="Monthly Rent (₹)" required hint="New rate for future monthly billing cycles">
          {(id) => (
            <Input
              id={id}
              type="number"
              min="0"
              step="100"
              value={rent}
              onChange={(e) => setRent(e.target.value)}
            />
          )}
        </Field>
      </div>
    </Confirm>
  );
}
