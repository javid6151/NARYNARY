/** Invite a manager or chef by email and assign their buildings. */
import { useState } from 'react';
import { useMutation } from '../../../lib/hooks';
import { useBuilding } from '../../access/useBuilding';
import { Button, Drawer, ErrorBanner, Field, Input, Select } from '../../../components/ui';
import { inviteStaffAccount } from '../api';

const EMPTY = { name: '', email: '', role: 'manager', b: [] as string[] };

export function InviteDrawer({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { buildings } = useBuilding();
  const [f, setF] = useState(EMPTY);
  const m = useMutation(() => inviteStaffAccount({ email: f.email, role: f.role, name: f.name || null, buildingIds: f.b }));

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button
        busy={m.busy}
        disabled={!f.email || !f.b.length}
        onClick={async () => {
          if (await m.run()) {
            setF(EMPTY);
            onDone();
          }
        }}
      >
        Send invitation
      </Button>
    </>
  );

  return (
    <Drawer open={open} onClose={onClose} title="Invite team member" footer={footer}>
      <ErrorBanner error={m.error} />
      <Field label="Name">{(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
      <Field label="Email" required>
        {(id) => <Input id={id} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}
      </Field>
      <Field label="Role">
        {(id) => (
          <Select id={id} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="manager">Manager — residents, admissions, payments, operations</option>
            <option value="chef">Chef — menus, meal counts, kitchen stock</option>
          </Select>
        )}
      </Field>
      <fieldset>
        <legend className="text-[13px] font-medium text-ink-2 mb-2">
          Buildings <span className="text-bad">*</span>
        </legend>
        <div className="space-y-2">
          {buildings.map((b) => (
            <label key={b.id} className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={f.b.includes(b.id)}
                onChange={(e) => setF({ ...f, b: e.target.checked ? [...f.b, b.id] : f.b.filter((x) => x !== b.id) })}
              />
              {b.name}
            </label>
          ))}
        </div>
      </fieldset>
    </Drawer>
  );
}
