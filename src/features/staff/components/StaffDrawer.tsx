/** Add/edit a staff member. Salary fields are shown to owners only. */
import { useState } from 'react';
import { useMutation } from '../../../lib/hooks';
import { isoDate, label } from '../../../lib/format';
import { Button, Drawer, ErrorBanner, Field, Input, Select } from '../../../components/ui';
import { upsertStaffMember } from '../api';
import { STAFF_ROLES, type StaffMember } from '../types';

export function StaffDrawer({ m: s, buildingId, isOwner, onClose, onSaved }: {
  /** Existing member, or `{}` to add one. */
  m: Partial<StaffMember>;
  buildingId: string;
  isOwner: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    full_name: s.full_name ?? '',
    role: s.role ?? 'cleaning',
    phone: s.phone ?? '',
    joining_date: s.joining_date ?? isoDate(),
    monthly_salary: String(s.monthly_salary ?? ''),
    pay_day: String(s.pay_day ?? 5),
    status: s.status ?? 'active',
  });
  const m = useMutation(() =>
    upsertStaffMember({
      id: s.id ?? null,
      buildingId,
      fullName: f.full_name,
      role: f.role,
      phone: f.phone || null,
      joiningDate: f.joining_date || null,
      // Managers don't see the salary field; keep the existing salary.
      monthlySalary: Number(f.monthly_salary || s.monthly_salary || 0),
      payDay: Number(f.pay_day) || null,
      status: f.status,
    }),
  );
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button
        busy={m.busy}
        disabled={f.full_name.trim().length < 2}
        onClick={async () => {
          if (await m.run()) onSaved();
        }}
      >
        Save
      </Button>
    </>
  );

  return (
    <Drawer open onClose={onClose} title={s.id ? 'Edit staff' : 'Add staff'} footer={footer}>
      <ErrorBanner error={m.error} />
      <Field label="Full name" required>{(id) => <Input id={id} value={f.full_name} onChange={set('full_name')} />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Role">
          {(id) => (
            <Select id={id} value={f.role} onChange={set('role')}>
              {STAFF_ROLES.map((r) => <option key={r} value={r}>{label(r)}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Phone">{(id) => <Input id={id} value={f.phone} onChange={set('phone')} inputMode="tel" />}</Field>
        <Field label="Joining date">{(id) => <Input id={id} type="date" value={f.joining_date} onChange={set('joining_date')} />}</Field>
        <Field label="Status">
          {(id) => (
            <Select id={id} value={f.status} onChange={set('status')}>
              <option value="active">Active</option>
              <option value="on_leave">On leave</option>
              <option value="inactive">Inactive</option>
            </Select>
          )}
        </Field>
        {isOwner && (
          <Field label="Monthly salary (₹)">
            {(id) => <Input id={id} type="number" min={0} value={f.monthly_salary} onChange={set('monthly_salary')} />}
          </Field>
        )}
        {isOwner && (
          <Field label="Pay day (1–28)">
            {(id) => <Input id={id} type="number" min={1} max={28} value={f.pay_day} onChange={set('pay_day')} />}
          </Field>
        )}
      </div>
      <p className="text-[12px] text-muted">To give a manager or chef a login, invite them from Settings → Team.</p>
    </Drawer>
  );
}
