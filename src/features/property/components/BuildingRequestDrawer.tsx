/** Owner requests an additional building; ZIPCO approves it before rooms and residents can be added. */
import { useState } from 'react';
import { useMutation } from '../../../lib/hooks';
import { Button, Drawer, ErrorBanner, Field, Input } from '../../../components/ui';
import { requestBuilding } from '../api';

const EMPTY = { name: '', address: '', city: '', floors: '' };

export function BuildingRequestDrawer({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState(EMPTY);
  const m = useMutation(() => requestBuilding({ name: f.name, address: f.address, city: f.city, floors: Number(f.floors) || null }));

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button
        busy={m.busy}
        disabled={f.name.length < 2}
        onClick={async () => {
          if ((await m.run()) !== undefined) {
            setF(EMPTY);
            onSaved();
          }
        }}
      >
        Submit request
      </Button>
    </>
  );

  return (
    <Drawer open={open} onClose={onClose} title="Request a new building" footer={footer}>
      <p className="text-[13px] text-muted">New buildings are verified by ZIPCO before you can add rooms and residents.</p>
      <ErrorBanner error={m.error} />
      <Field label="Building name" required>
        {(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}
      </Field>
      <Field label="Address">{(id) => <Input id={id} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />}</Field>
      <Field label="City">{(id) => <Input id={id} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />}</Field>
      <Field label="Floors">
        {(id) => <Input id={id} type="number" min={0} value={f.floors} onChange={(e) => setF({ ...f, floors: e.target.value })} />}
      </Field>
    </Drawer>
  );
}
