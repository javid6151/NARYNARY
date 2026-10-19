/** Add a room; its beds are created automatically from the sharing number. */
import { useState } from 'react';
import { useMutation } from '../../../lib/hooks';
import { Button, Drawer, ErrorBanner, Field, Input } from '../../../components/ui';
import { createRoomWithBeds } from '../api';
import type { LayoutFloor } from '../types';

export function RoomDrawer({ open, onClose, floors, defaultFloor, onSaved }: {
  open: boolean;
  onClose: () => void;
  floors: LayoutFloor[];
  defaultFloor: string;
  onSaved: () => void;
}) {
  const [floorId, setFloorId] = useState(defaultFloor);
  const [num, setNum] = useState('');
  const [cap, setCap] = useState('3');
  const [rent, setRent] = useState('');
  const m = useMutation(() => createRoomWithBeds(floorId || defaultFloor, num, Number(cap), Number(rent || 0)));

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button
        busy={m.busy}
        disabled={!num || !rent}
        onClick={async () => {
          if ((await m.run()) !== undefined) {
            setNum('');
            onSaved();
          }
        }}
      >
        Create room
      </Button>
    </>
  );

  return (
    <Drawer open={open} onClose={onClose} title="Add room" footer={footer}>
      <ErrorBanner error={m.error} />
      <Field label="Floor" required>
        {(id) => (
          <select id={id} value={floorId} onChange={(e) => setFloorId(e.target.value)} className="h-10 rounded-lg border border-line px-3">
            {floors.map((f) => <option key={f.floor_id} value={f.floor_id}>{f.floor_name}</option>)}
          </select>
        )}
      </Field>
      <Field label="Room number" required>
        {(id) => <Input id={id} value={num} onChange={(e) => setNum(e.target.value)} placeholder="e.g. 107" />}
      </Field>
      <Field label="Sharing (beds)" required hint="Beds are created automatically: 1 = single, 2 = double …">
        {(id) => <Input id={id} type="number" min={1} max={12} value={cap} onChange={(e) => setCap(e.target.value)} />}
      </Field>
      <Field label="Monthly rent per bed (₹)" required>
        {(id) => <Input id={id} type="number" min={0} value={rent} onChange={(e) => setRent(e.target.value)} />}
      </Field>
    </Drawer>
  );
}
