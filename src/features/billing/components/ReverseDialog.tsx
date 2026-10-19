/** Owner-only confirmation to reverse a payment with a reason. History is kept, never deleted. */
import { useState } from 'react';
import { useMutation } from '../../../lib/hooks';
import { inr } from '../../../lib/format';
import { Confirm, ErrorBanner, Field, Input } from '../../../components/ui';
import { reversePayment } from '../api';
import type { Payment } from '../types';

export function ReverseDialog({ payment, onClose, onDone }: { payment: Payment | null; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const m = useMutation(() => reversePayment(payment!.id, reason));
  return (
    <Confirm
      open={!!payment}
      danger
      title="Reverse this payment?"
      confirmLabel="Reverse payment"
      busy={m.busy}
      onClose={onClose}
      body={
        `${inr(payment?.amount)} from ${payment?.residents.full_name}. ` +
        'The original record is kept and marked reversed; the dues it paid become outstanding again.'
      }
      onConfirm={async () => {
        if ((await m.run()) !== undefined) {
          setReason('');
          onDone();
        }
      }}
    >
      <ErrorBanner error={m.error} />
      <Field label="Reason" required>
        {(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Cheque bounced" />}
      </Field>
    </Confirm>
  );
}
