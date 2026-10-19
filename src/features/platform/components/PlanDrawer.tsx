/** Create or edit a subscription plan. New plans default to 3 managers, 3 chefs and a 90-day trial. */
import { useState } from 'react';
import { useMutation } from '../../../lib/hooks';
import { Button, Drawer, ErrorBanner, Field, Input } from '../../../components/ui';
import { upsertPlan } from '../api';
import type { Plan } from '../types';

export function PlanDrawer({ p, onClose, onDone }: { p: Partial<Plan>; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({
    name: String(p.name ?? ''),
    monthly_price: String(p.monthly_price ?? ''),
    included_residents: String(p.included_residents ?? ''),
    max_managers: String(p.max_managers ?? 3),
    max_chefs: String(p.max_chefs ?? 3),
    trial_days: String(p.trial_days ?? 90),
    is_active: p.is_active ?? true,
  });
  const m = useMutation(() =>
    upsertPlan({
      id: p.id ?? null,
      name: f.name,
      monthlyPrice: Number(f.monthly_price),
      includedResidents: Number(f.included_residents),
      maxManagers: Number(f.max_managers),
      maxChefs: Number(f.max_chefs),
      trialDays: Number(f.trial_days),
      isActive: f.is_active,
    }),
  );
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button
        busy={m.busy}
        disabled={!f.name || !f.monthly_price || !f.included_residents}
        onClick={async () => {
          if (await m.run()) onDone();
        }}
      >
        Save
      </Button>
    </>
  );

  return (
    <Drawer open onClose={onClose} title={p.id ? 'Edit plan' : 'New plan'} footer={footer}>
      <ErrorBanner error={m.error} />
      <Field label="Name" required>{(id) => <Input id={id} value={f.name} onChange={set('name')} />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Monthly price (₹)" required>
          {(id) => <Input id={id} type="number" min={0} value={f.monthly_price} onChange={set('monthly_price')} />}
        </Field>
        <Field label="Included residents" required>
          {(id) => <Input id={id} type="number" min={1} value={f.included_residents} onChange={set('included_residents')} />}
        </Field>
        <Field label="Max managers">
          {(id) => <Input id={id} type="number" min={0} value={f.max_managers} onChange={set('max_managers')} />}
        </Field>
        <Field label="Max chefs">{(id) => <Input id={id} type="number" min={0} value={f.max_chefs} onChange={set('max_chefs')} />}</Field>
        <Field label="Trial days">{(id) => <Input id={id} type="number" min={0} value={f.trial_days} onChange={set('trial_days')} />}</Field>
      </div>
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} />
        Active
      </label>
    </Drawer>
  );
}
