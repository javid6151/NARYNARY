/** Edit a room's sharing (bed count) and rent. Capacity can't go below occupied beds. */
import { useEffect, useState } from 'react';
import { useMutation } from '../../../lib/hooks';
import { Button, Drawer, ErrorBanner, Field, Input } from '../../../components/ui';
import { updateRoomCapacity } from '../api';
import type { LayoutRoom } from '../types';

export function EditRoomDrawer({ open, room, onClose, onSaved }: {
  open: boolean;
  room: LayoutRoom;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [cap, setCap] = useState(String(room.capacity));
  const [rent, setRent] = useState(String(room.rent));

  useEffect(() => {
    if (open) {
      setCap(String(room.capacity));
      setRent(String(room.rent));
    }
  }, [room.room_id, room.capacity, room.rent, open]);

  const m = useMutation(() => updateRoomCapacity(room.room_id, Number(cap), Number(rent)));
  const occ = room.beds.filter((b) => b.resident_id).length;

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button
        busy={m.busy}
        onClick={async () => {
          if ((await m.run()) !== undefined) onSaved();
        }}
      >
        Save
      </Button>
    </>
  );

  return (
    <Drawer open={open} onClose={onClose} title={`Edit room ${room.room_number}`} footer={footer}>
      <ErrorBanner error={m.error} />
      <Field
        label="Sharing (beds)"
        hint={`${occ} bed(s) occupied — capacity can’t go below that. Removed beds are deactivated, never deleted.`}
      >
        {(id) => (
          <Input id={id} type="number" min={Math.max(1, occ)} max={12} value={cap} onChange={(e) => setCap(e.target.value)} />
        )}
      </Field>
      <Field label="Monthly rent per bed (₹)" hint="Applies to new admissions; existing residents keep their agreed rent.">
        {(id) => <Input id={id} type="number" min={0} value={rent} onChange={(e) => setRent(e.target.value)} />}
      </Field>
    </Drawer>
  );
}
