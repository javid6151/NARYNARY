/**
 * New maintenance request form. When opened from a complaint, title/description/room are pre-filled
 * and the request is linked so completing it resolves the complaint.
 */
import { useState } from 'react';
import { useAsync, useMutation } from '../../../lib/hooks';
import { useBuilding } from '../../access/useBuilding';
import { Button, Drawer, ErrorBanner, Field, Input, Select, Textarea } from '../../../components/ui';
import { listActiveVendors } from '../../expenses/api';
import { listFloors, listRooms } from '../../property/api';
import { createMaintenanceRequest, listMaintenanceCategories } from '../api';
import type { ComplaintSource } from '../types';

export function CreateRequestDrawer({ open, onClose, onDone, complaint }: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  complaint?: ComplaintSource;
}) {
  const { buildingId } = useBuilding();
  const cats = useAsync(() => listMaintenanceCategories(), []);
  const floors = useAsync(() => listFloors(buildingId), [buildingId]);
  const rooms = useAsync(() => listRooms(buildingId), [buildingId]);
  const vendors = useAsync(() => listActiveVendors(), [open]);
  const roomRows = rooms.data ?? [];
  const cRoom = complaint?.room_id ? roomRows.find((r) => r.id === complaint.room_id) : undefined;
  const [f, setF] = useState({
    title: complaint?.title ?? '',
    description: complaint?.description ?? '',
    category: '',
    floor: '',
    room: '',
    priority: 'medium',
    due: '',
    assigned: '',
    vendor: '',
  });
  // Until the user picks a location, default to the complaint's room (once rooms have loaded).
  const floor = f.floor || cRoom?.floor_id || '';
  const room = f.room || cRoom?.id || '';
  const m = useMutation(() =>
    createMaintenanceRequest({
      buildingId,
      floorId: floor || null,
      roomId: room || null,
      categoryId: f.category,
      title: f.title,
      description: f.description,
      priority: f.priority,
      dueAt: f.due ? new Date(f.due + 'T18:00:00').toISOString() : null,
      assignedTo: f.assigned || null,
      vendorId: f.vendor || null,
      complaintId: complaint?.id ?? null,
    }),
  );
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button
        busy={m.busy}
        disabled={f.title.length < 3 || f.description.length < 3 || !f.category}
        onClick={async () => {
          if (await m.run()) {
            setF({ ...f, title: '', description: '', due: '', assigned: '' });
            onDone();
          }
        }}
      >
        Create request
      </Button>
    </>
  );

  return (
    <Drawer open={open} onClose={onClose} title={complaint ? 'Create request from complaint' : 'New maintenance request'} footer={footer}>
      <ErrorBanner error={m.error} />
      <Field label="Title" required>{(id) => <Input id={id} value={f.title} onChange={set('title')} />}</Field>
      <Field label="Description" required>{(id) => <Textarea id={id} value={f.description} onChange={set('description')} />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category" required>
          {(id) => (
            <Select id={id} value={f.category} onChange={set('category')}>
              <option value="">Select</option>
              {(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Priority">
          {(id) => (
            <Select id={id} value={f.priority} onChange={set('priority')}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </Select>
          )}
        </Field>
        <Field label="Floor">
          {(id) => (
            <Select id={id} value={floor} onChange={(e) => setF({ ...f, floor: e.target.value, room: '' })}>
              <option value="">Whole building</option>
              {(floors.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Room">
          {(id) => (
            <Select id={id} value={room} disabled={!floor} onChange={set('room')}>
              <option value="">—</option>
              {roomRows.filter((r) => r.floor_id === floor).map((r) => (
                <option key={r.id} value={r.id}>Room {r.room_number}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Due date">{(id) => <Input id={id} type="date" value={f.due} onChange={set('due')} />}</Field>
        <Field label="Vendor">
          {(id) => (
            <Select id={id} value={f.vendor} onChange={set('vendor')}>
              <option value="">None</option>
              {(vendors.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </Select>
          )}
        </Field>
      </div>
      <Field label="Assign to (staff)" hint="e.g. Suresh (Warden)">
        {(id) => <Input id={id} value={f.assigned} onChange={set('assigned')} />}
      </Field>
    </Drawer>
  );
}
