/**
 * Checkout confirmation: releases the bed immediately, records any deposit refund and shows
 * the remaining dues. Payment and admission history are kept; the resident loses portal access.
 */
import { useState } from 'react';
import { useMutation } from '../../../lib/hooks';
import { inr, isoDate } from '../../../lib/format';
import { Confirm, ErrorBanner, Field, Input } from '../../../components/ui';
import { checkoutResident } from '../api';

export function CheckoutDialog({ bed, onClose, onDone }: {
  /** The occupied bed to release; null hides the dialog. */
  bed: { admission_id: string | null; resident_name: string | null } | null;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [date, setDate] = useState(isoDate());
  const [reason, setReason] = useState('');
  const [refund, setRefund] = useState('0');
  const m = useMutation(() =>
    checkoutResident({ admissionId: bed!.admission_id, date, reason: reason || null, depositRefund: Number(refund || 0) }),
  );
  return (
    <Confirm
      open={!!bed}
      title={`Check out ${bed?.resident_name ?? ''}?`}
      danger
      confirmLabel="Complete checkout"
      busy={m.busy}
      body="The bed is released immediately. Payment and admission history are kept; the resident loses portal access."
      onClose={onClose}
      onConfirm={async () => {
        const r = await m.run();
        if (r) onDone(`Checked out. Outstanding dues: ${inr(r.outstanding)}`);
      }}
    >
      <ErrorBanner error={m.error} />
      <Field label="Checkout date" required>
        {(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
      </Field>
      <Field label="Deposit refund (₹)" hint="Cannot exceed the deposit actually paid">
        {(id) => <Input id={id} type="number" min={0} value={refund} onChange={(e) => setRefund(e.target.value)} />}
      </Field>
      <Field label="Reason">{(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
    </Confirm>
  );
}
