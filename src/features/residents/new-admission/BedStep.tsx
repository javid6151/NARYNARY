/** Step 1: choose floor → room → free bed. Beds that are occupied or held by a pending admission are hidden. */
import { useMemo } from 'react';
import { inr } from '../../../lib/format';
import { Field, Select } from '../../../components/ui';
import type { LayoutFloor } from '../../property/types';

export function BedStep({ floors, floorId, roomId, bedId, error, buildingName, onFloor, onRoom, onBed }: {
  floors: LayoutFloor[];
  floorId: string;
  roomId: string;
  bedId: string;
  error?: string;
  buildingName?: string;
  onFloor: (floorId: string) => void;
  /** `rent` is the selected room's standard rent (undefined when cleared). */
  onRoom: (roomId: string, rent: number | undefined) => void;
  onBed: (bedId: string) => void;
}) {
  const floor = floors.find((f) => f.floor_id === floorId);
  const room = floor?.rooms.find((r) => r.room_id === roomId);
  const bed = room?.beds.find((b) => b.bed_id === bedId);
  const freeBeds = useMemo(() => room?.beds.filter((b) => !b.resident_id && !b.pending_admission) ?? [], [room]);

  return (
    <>
      <div className="grid sm:grid-cols-3 gap-4">
        <Field label="Floor" required>
          {(id) => (
            <Select id={id} value={floorId} onChange={(e) => onFloor(e.target.value)}>
              <option value="">Select floor</option>
              {floors.map((f) => <option key={f.floor_id} value={f.floor_id}>{f.floor_name}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Room" required>
          {(id) => (
            <Select
              id={id}
              value={roomId}
              disabled={!floor}
              onChange={(e) => onRoom(e.target.value, floor?.rooms.find((x) => x.room_id === e.target.value)?.rent)}
            >
              <option value="">Select room</option>
              {floor?.rooms.map((r) => {
                const free = r.beds.filter((b) => !b.resident_id && !b.pending_admission).length;
                return (
                  <option key={r.room_id} value={r.room_id} disabled={!free}>
                    Room {r.room_number} ({r.capacity} sharing) — {free} free
                  </option>
                );
              })}
            </Select>
          )}
        </Field>
        <Field label="Bed" required error={error}>
          {(id) => (
            <Select id={id} value={bedId} disabled={!room} onChange={(e) => onBed(e.target.value)}>
              <option value="">Select bed</option>
              {freeBeds.map((b) => <option key={b.bed_id} value={b.bed_id}>Bed {b.label} (Available)</option>)}
            </Select>
          )}
        </Field>
      </div>
      {bed && room && floor && (
        <div className="rounded-lg bg-subtle p-4 text-[13px] grid grid-cols-2 gap-2">
          <span className="text-muted">Selected</span>
          <span className="text-right font-medium">
            {buildingName} · {floor.floor_name} · Room {room.room_number} · Bed {bed.label}
          </span>
          <span className="text-muted">Standard rent</span>
          <span className="text-right font-medium">{inr(room.rent)} / month</span>
        </div>
      )}
    </>
  );
}
