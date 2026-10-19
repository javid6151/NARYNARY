/** Add/edit vendor form. Vendors are never deleted; they are marked inactive to keep history. */
import { useState } from 'react';
import { useMutation } from '../../../lib/hooks';
import { Button, Drawer, ErrorBanner, Field, Input } from '../../../components/ui';
import { saveVendor } from '../api';
import type { Vendor } from '../types';

export function VendorDrawer({ v, tenantId, onClose, onSaved }: {
  /** Existing vendor, or `{}` to add a new one. */
  v: Partial<Vendor>;
  tenantId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    name: v.name ?? '',
    contact_person: v.contact_person ?? '',
    phone: v.phone ?? '',
    email: v.email ?? '',
    services: (v.service_categories ?? []).join(', '),
    is_active: v.is_active ?? true,
  });
  const m = useMutation(() =>
    saveVendor(
      {
        name: f.name.trim(),
        contact_person: f.contact_person || null,
        phone: f.phone || null,
        email: f.email || null,
        service_categories: f.services.split(',').map((s) => s.trim()).filter(Boolean),
      },
      { id: v.id, isActive: f.is_active, tenantId },
    ),
  );

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button
        busy={m.busy}
        disabled={f.name.trim().length < 2}
        onClick={async () => {
          if (await m.run()) onSaved();
        }}
      >
        Save
      </Button>
    </>
  );

  return (
    <Drawer open onClose={onClose} title={v.id ? 'Edit vendor' : 'Add vendor'} footer={footer}>
      <ErrorBanner error={m.error} />
      <Field label="Vendor / company name" required>
        {(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}
      </Field>
      <Field label="Contact person">
        {(id) => <Input id={id} value={f.contact_person} onChange={(e) => setF({ ...f, contact_person: e.target.value })} />}
      </Field>
      <Field label="Phone">{(id) => <Input id={id} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />}</Field>
      <Field label="Email">
        {(id) => <Input id={id} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}
      </Field>
      <Field label="Services" hint="Comma separated, e.g. Plumbing, Drainage">
        {(id) => <Input id={id} value={f.services} onChange={(e) => setF({ ...f, services: e.target.value })} />}
      </Field>
      {Boolean(v.id) && (
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} />
          Active (inactive vendors are kept for history)
        </label>
      )}
    </Drawer>
  );
}
