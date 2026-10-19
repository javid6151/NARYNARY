/**
 * Edit a resident's contact details. Adding or fixing the email lets a resident who hasn't
 * activated their portal sign up with it.
 */
import { useState } from 'react';
import { ApiError } from '../../../lib/api';
import { useMutation } from '../../../lib/hooks';
import { label } from '../../../lib/format';
import { Button, Drawer, ErrorBanner, Field, Input } from '../../../components/ui';
import { updateResident } from '../api';
import type { ResidentDetails } from '../types';
import { EMAIL_RE, PHONE_RE } from '../../../lib/validation';

const FIELDS = ['full_name', 'phone', 'email', 'occupation', 'emergency_contact_name', 'emergency_contact_phone'] as const;
type FieldName = (typeof FIELDS)[number];

export function EditResident({ data, onClose, onSaved }: { data: ResidentDetails; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Record<FieldName, string>>(
    Object.fromEntries(FIELDS.map((k) => [k, data[k] ?? ''])) as Record<FieldName, string>,
  );
  const m = useMutation(async () => {
    if (f.email && !EMAIL_RE.test(f.email)) throw new ApiError('VALIDATION_ERROR', 'Enter a valid email');
    if (f.full_name.trim().length < 2 || !PHONE_RE.test(f.phone.trim())) {
      throw new ApiError('VALIDATION_ERROR', 'Name and a valid phone number are required');
    }
    // Empty optional fields are stored as NULL; email is normalized to lower case.
    return updateResident(data.id, {
      full_name: f.full_name.trim(),
      phone: f.phone.trim(),
      email: f.email.trim().toLowerCase() || null,
      occupation: f.occupation.trim() || null,
      emergency_contact_name: f.emergency_contact_name.trim() || null,
      emergency_contact_phone: f.emergency_contact_phone.trim() || null,
    });
  });

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button
        busy={m.busy}
        onClick={async () => {
          if (await m.run()) onSaved();
        }}
      >
        Save
      </Button>
    </>
  );

  return (
    <Drawer open onClose={onClose} title="Edit resident" footer={footer}>
      <ErrorBanner error={m.error} />
      {FIELDS.map((k) => (
        <Field key={k} label={label(k)} required={k === 'full_name' || k === 'phone'}>
          {(id) => <Input id={id} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />}
        </Field>
      ))}
      <p className="text-[12px] text-muted">
        If the resident hasn’t activated their portal, adding or correcting the email lets them sign up with it.
      </p>
    </Drawer>
  );
}
