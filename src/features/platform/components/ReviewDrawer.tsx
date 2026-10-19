/** Review one onboarding application: approve, reject, or request changes (notes required). */
import { useState } from 'react';
import { useMutation } from '../../../lib/hooks';
import { Badge, Button, Card, Drawer, ErrorBanner, Field, Table, Td, Textarea } from '../../../components/ui';
import { reviewOnboarding } from '../api';
import { PENDING_ONBOARDING, type PlatformOnboardingRequest } from '../types';

export function ReviewDrawer({ r, onClose, onDone }: { r: PlatformOnboardingRequest; onClose: () => void; onDone: (m: string) => void }) {
  const [notes, setNotes] = useState('');
  const m = useMutation((d: string) => reviewOnboarding(r.id, d, notes || null));
  const pending = PENDING_ONBOARDING.includes(r.status);
  const decide = async (d: string, msg: string) => {
    if ((await m.run(d)) !== undefined) onDone(msg);
  };

  const footer = pending ? (
    <>
      <Button variant="danger" busy={m.busy} onClick={() => decide('reject', 'Request rejected')}>Reject</Button>
      <Button variant="secondary" busy={m.busy} disabled={!notes} onClick={() => decide('changes_requested', 'Changes requested')}>
        Request changes
      </Button>
      <Button variant="success" busy={m.busy} onClick={() => decide('approve', 'Tenant approved and provisioned')}>Approve</Button>
    </>
  ) : undefined;

  return (
    <Drawer open onClose={onClose} title="Review onboarding" wide footer={footer}>
      <p className="text-lg font-semibold">{r.business_details.business_name}</p>
      <dl className="grid grid-cols-2 gap-y-2 text-[13px]">
        <dt className="text-muted">Email</dt>
        <dd>{r.contact_details.email}</dd>
        <dt className="text-muted">Phone</dt>
        <dd>{r.contact_details.phone}</dd>
        <dt className="text-muted">City</dt>
        <dd>{r.contact_details.city || '—'}</dd>
        <dt className="text-muted">Status</dt>
        <dd><Badge status={r.status} /></dd>
      </dl>
      {r.business_details.notes && <p className="text-[13px] rounded-lg bg-subtle p-3">{r.business_details.notes}</p>}
      <Card title="Requested buildings">
        <Table head={['Name', 'Address', 'City', 'Floors', 'Approx. beds']}>
          {r.business_details.buildings.map((b, i) => (
            <tr key={i}>
              <Td className="font-medium">{b.name}</Td>
              <Td>{b.address || '—'}</Td>
              <Td>{b.city || '—'}</Td>
              <Td>{b.floors ?? '—'}</Td>
              <Td>{b.approx_beds ?? '—'}</Td>
            </tr>
          ))}
        </Table>
      </Card>
      {pending ? (
        <>
          <ErrorBanner error={m.error} />
          <Field label="Review notes" hint="Required when requesting changes; shared with the owner.">
            {(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />}
          </Field>
          <p className="text-[12px] text-muted">
            Approving activates the tenant, creates the buildings, default categories and a trial subscription on the default plan.
            Every decision is audited.
          </p>
        </>
      ) : (
        r.review_notes && <p className="text-[13px]">Notes: {r.review_notes}</p>
      )}
    </Drawer>
  );
}
