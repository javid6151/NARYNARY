/**
 * Manage a tenant: account status (approved tenants only; a reason is required and audited)
 * and subscription status, trial end, limits and price override.
 */
import { useState } from 'react';
import { useMutation } from '../../../lib/hooks';
import { inr, label } from '../../../lib/format';
import { Button, Card, Drawer, ErrorBanner, Field, Input, Select } from '../../../components/ui';
import { setTenantStatus, updateSubscription } from '../api';
import type { TenantAccount } from '../types';

const TENANT_STATUSES = ['active', 'suspended', 'banned', 'closed'];
const SUBSCRIPTION_STATUSES = ['trialing', 'active', 'past_due', 'grace_period', 'read_only', 'suspended', 'cancelled', 'expired'];

export function TenantDrawer({ t, onClose, onDone }: { t: TenantAccount; onClose: () => void; onDone: (m: string) => void }) {
  const s = t.subscriptions[0];
  const [status, setStatus] = useState(t.status);
  const [reason, setReason] = useState('');
  const [sub, setSub] = useState({
    status: s?.status ?? 'trialing',
    trial_end: s?.trial_end?.slice(0, 10) ?? '',
    resident_limit: String(s?.resident_limit ?? ''),
    manager_limit: String(s?.manager_limit ?? ''),
    chef_limit: String(s?.chef_limit ?? ''),
    price_override: s?.price_override != null ? String(s.price_override) : '',
  });
  const ms = useMutation(() => setTenantStatus(t.id, status, reason));
  const mu = useMutation(() =>
    updateSubscription(t.id, {
      status: sub.status,
      // Trial ends at the end of the chosen day (local time).
      trialEnd: sub.trial_end ? new Date(sub.trial_end + 'T23:59:59').toISOString() : null,
      residentLimit: Number(sub.resident_limit),
      managerLimit: Number(sub.manager_limit),
      chefLimit: Number(sub.chef_limit),
      priceOverride: sub.price_override ? Number(sub.price_override) : null,
    }),
  );
  // Unapproved tenants are handled through onboarding review instead.
  const approved = !['pending', 'changes_requested', 'rejected'].includes(t.status);
  const setS = (k: keyof typeof sub) => (e: { target: { value: string } }) => setSub({ ...sub, [k]: e.target.value });

  return (
    <Drawer open onClose={onClose} title={t.business_name} wide>
      {approved && (
        <Card title="Account status">
          <div className="space-y-3">
            <ErrorBanner error={ms.error} />
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Status">
                {(id) => (
                  <Select id={id} value={status} onChange={(e) => setStatus(e.target.value)}>
                    {TENANT_STATUSES.map((x) => <option key={x} value={x}>{label(x)}</option>)}
                  </Select>
                )}
              </Field>
              <Field label="Reason" required>{(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
            </div>
            <p className="text-[12px] text-muted">Suspending immediately blocks owner, staff and resident access for this tenant. Data is kept.</p>
            <Button
              variant={status === 'active' ? 'primary' : 'danger'}
              busy={ms.busy}
              disabled={status === t.status || reason.trim().length < 3}
              onClick={async () => {
                if ((await ms.run()) !== undefined) onDone('Tenant status updated');
              }}
            >
              Apply status
            </Button>
          </div>
        </Card>
      )}
      {s && (
        <Card title="Subscription">
          <div className="space-y-3">
            <ErrorBanner error={mu.error} />
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Status">
                {(id) => (
                  <Select id={id} value={sub.status} onChange={setS('status')}>
                    {SUBSCRIPTION_STATUSES.map((x) => <option key={x} value={x}>{label(x)}</option>)}
                  </Select>
                )}
              </Field>
              <Field label="Trial ends">{(id) => <Input id={id} type="date" value={sub.trial_end} onChange={setS('trial_end')} />}</Field>
              <Field label="Price override (₹/mo)" hint={`Plan: ${inr(s.subscription_plans.monthly_price)}`}>
                {(id) => <Input id={id} type="number" min={0} value={sub.price_override} onChange={setS('price_override')} />}
              </Field>
              <Field label="Resident limit">
                {(id) => <Input id={id} type="number" min={1} value={sub.resident_limit} onChange={setS('resident_limit')} />}
              </Field>
              <Field label="Manager limit">
                {(id) => <Input id={id} type="number" min={0} value={sub.manager_limit} onChange={setS('manager_limit')} />}
              </Field>
              <Field label="Chef limit">
                {(id) => <Input id={id} type="number" min={0} value={sub.chef_limit} onChange={setS('chef_limit')} />}
              </Field>
            </div>
            <Button
              busy={mu.busy}
              onClick={async () => {
                if ((await mu.run()) !== undefined) onDone('Subscription updated');
              }}
            >
              Save subscription
            </Button>
          </div>
        </Card>
      )}
    </Drawer>
  );
}
