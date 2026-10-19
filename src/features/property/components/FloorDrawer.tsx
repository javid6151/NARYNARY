/** Add a floor to the selected building. */
import { useState } from 'react';
import { useMutation } from '../../../lib/hooks';
import { Button, Drawer, ErrorBanner, Field, Input } from '../../../components/ui';
import { createFloor } from '../api';

export function FloorDrawer({ open, onClose, buildingId, nextNumber, onSaved }: {
  open: boolean;
  onClose: () => void;
  buildingId: string;
  /** Suggested floor number (one above the highest existing floor). */
  nextNumber: number;
  onSaved: () => void;
}) {
  const [n, setN] = useState(String(nextNumber));
  const [name, setName] = useState('');
  const m = useMutation(() => createFloor(buildingId, Number(n), name || null));

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button
        busy={m.busy}
        onClick={async () => {
          if ((await m.run()) !== undefined) {
            setName('');
            onSaved();
          }
        }}
      >
        Add floor
      </Button>
    </>
  );

  return (
    <Drawer open={open} onClose={onClose} title="Add floor" footer={footer}>
      <ErrorBanner error={m.error} />
      <Field label="Floor number" required hint="0 for ground floor">
        {(id) => <Input id={id} type="number" min={0} value={n} onChange={(e) => setN(e.target.value)} />}
      </Field>
      <Field label="Display name">
        {(id) => <Input id={id} placeholder={`Floor ${n}`} value={name} onChange={(e) => setName(e.target.value)} />}
      </Field>
    </Drawer>
  );
}
