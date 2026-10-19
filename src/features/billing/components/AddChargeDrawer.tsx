/** Add a one-off charge (utility, late fee, meal, other) to a resident. */
import { useState } from 'react';
import { useMutation } from '../../../lib/hooks';
import { isoDate, label } from '../../../lib/format';
import { Button, Drawer, ErrorBanner, Field, Input, Select } from '../../../components/ui';
import { addCharge } from '../api';
import { ResidentSelect } from './ResidentSelect';

export function AddChargeDrawer({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (m: string) => void }) {
  const [rid, setRid] = useState('');
  const [type, setType] = useState('utility');
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [due, setDue] = useState(isoDate());
  const m = useMutation(() =>
    addCharge({ residentId: rid, type, description: desc || label(type), amount: Number(amount), due }),
  );

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button
        busy={m.busy}
        disabled={!rid || !(Number(amount) > 0)}
        onClick={async () => {
          if ((await m.run()) !== undefined) {
            setAmount('');
            setDesc('');
            onDone('Charge added');
          }
        }}
      >
        Add charge
      </Button>
    </>
  );

  return (
    <Drawer open={open} onClose={onClose} title="Add a charge" footer={footer}>
      <ErrorBanner error={m.error} />
      <ResidentSelect value={rid} onChange={(id) => setRid(id)} />
      <Field label="Type">
        {(id) => (
          <Select id={id} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="utility">Electricity / utility</option>
            <option value="late_fee">Late fee</option>
            <option value="meal">Meal / mess</option>
            <option value="other">Other</option>
          </Select>
        )}
      </Field>
      <Field label="Description">
        {(id) => (
          <Input id={id} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Electricity Sept (room meter)" />
        )}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (₹)" required>
          {(id) => <Input id={id} type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />}
        </Field>
        <Field label="Due date">{(id) => <Input id={id} type="date" value={due} onChange={(e) => setDue(e.target.value)} />}</Field>
      </div>
    </Drawer>
  );
}
