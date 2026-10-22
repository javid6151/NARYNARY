/** Create a manager or chef account directly with password and assign buildings. */
import { useState } from 'react';
import { useAuth } from '../../access/useAuth';
import { useBuilding } from '../../access/useBuilding';
import { Button, Drawer, ErrorBanner, Field, Input, Select } from '../../../components/ui';
import { createTeamMember } from '../api';

const EMPTY = { name: '', identifier: '', role: 'manager', password: '', b: [] as string[] };

export function InviteDrawer({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { staff, owner, access } = useAuth();
  const { buildings, tenantId: buildingTenantId } = useBuilding();
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const tenantId =
      staff?.tenant_id ||
      owner?.tenant_id ||
      buildingTenantId ||
      access?.owned_tenant?.tenant_id ||
      buildings.find((b) => f.b.includes(b.id))?.tenant_id ||
      buildings[0]?.tenant_id;

    if (!tenantId) return setError('Tenant not found. Please select an assigned building or refresh.');
    if (!f.name.trim()) return setError('Name is required');
    if (!f.identifier.trim()) return setError('Email or mobile number is required');
    if (!f.password || f.password.length < 6) return setError('Password must be at least 6 characters');
    if (!f.b.length) return setError('Assign at least one building');

    setBusy(true);
    setError(null);
    try {
      const isEmail = f.identifier.includes('@');
      await createTeamMember({
        tenantId,
        name: f.name.trim(),
        email: isEmail ? f.identifier.trim() : undefined,
        phone: !isEmail ? f.identifier.trim() : undefined,
        role: f.role,
        password: f.password,
        buildingIds: f.b,
      });
      setF(EMPTY);
      onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create team member');
    } finally {
      setBusy(false);
    }
  };

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
      <Button
        busy={busy}
        disabled={!f.name || !f.identifier || !f.password || !f.b.length}
        onClick={handleSubmit}
      >
        Create & Save Account
      </Button>
    </>
  );

  return (
    <Drawer open={open} onClose={onClose} title="Add Team Member (Manager / Chef)" footer={footer}>
      <ErrorBanner error={error} />
      <Field label="Full Name" required>
        {(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Ramesh (Chef) or Suresh (Manager)" required />}
      </Field>
      <Field label="Email or Mobile Number (Login ID)" required hint="The staff member will use this to sign in">
        {(id) => (
          <Input
            id={id}
            type="text"
            value={f.identifier}
            onChange={(e) => setF({ ...f, identifier: e.target.value })}
            placeholder="e.g. 9876543210 or manager@example.com"
            required
          />
        )}
      </Field>
      <Field label="Password" required hint="At least 6 characters">
        {(id) => (
          <Input
            id={id}
            type="text"
            value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })}
            placeholder="Enter password for staff login"
            required
          />
        )}
      </Field>
      <Field label="Role" required>
        {(id) => (
          <Select id={id} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="manager">Manager — residents, admissions, payments, operations</option>
            <option value="chef">Chef / Kitchen — menus, meal counts, kitchen stock</option>
          </Select>
        )}
      </Field>
      <fieldset>
        <legend className="text-[13px] font-medium text-ink-2 mb-2">
          Assigned Buildings <span className="text-bad">*</span>
        </legend>
        <div className="space-y-2">
          {buildings.map((b) => (
            <label key={b.id} className="flex items-center gap-2 text-[13px] cursor-pointer">
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
