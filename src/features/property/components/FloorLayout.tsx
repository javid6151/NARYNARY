/** Floor tabs plus a grid of room cards with a bed occupancy strip. Clicking a room selects it. */
import { Button, Card, Empty } from '../../../components/ui';
import { cx } from '../../../lib/cx';
import { inr } from '../../../lib/format';
import type { LayoutFloor } from '../types';

export function FloorLayout({ floors, floorIdx, roomId, onFloor, onRoom, onAddRoom }: {
  floors: LayoutFloor[];
  floorIdx: number;
  roomId: string | null;
  onFloor: (index: number) => void;
  /** Called with null to deselect. */
  onRoom: (roomId: string | null) => void;
  onAddRoom: () => void;
}) {
  const floor = floors[Math.min(floorIdx, Math.max(0, floors.length - 1))];

  const floorTabs = (
    <div role="tablist" className="flex gap-1 bg-subtle rounded-lg p-1 overflow-x-auto">
      {floors.map((f, i) => (
        <button
          key={f.floor_id}
          role="tab"
          aria-selected={i === floorIdx}
          onClick={() => onFloor(i)}
          className={cx(
            'px-3 py-1.5 rounded-md text-[13px] font-medium whitespace-nowrap cursor-pointer',
            i === floorIdx ? 'bg-brand-600 text-white' : 'text-ink-2 hover:bg-white',
          )}
        >
          {f.floor_name}
        </button>
      ))}
    </div>
  );

  return (
    <Card title="Interactive floor layout" action={floorTabs}>
      <p className="text-[13px] text-muted -mt-1 mb-4">Select a room to allocate or release beds.</p>
      {!floor.rooms.length ? (
        <Empty title="No rooms on this floor" action={<Button size="sm" onClick={onAddRoom}>Add room</Button>} />
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {floor.rooms.map((r) => {
            const occ = r.beds.filter((b) => b.resident_id).length;
            const selected = r.room_id === roomId;
            return (
              <button
                key={r.room_id}
                onClick={() => onRoom(selected ? null : r.room_id)}
                aria-pressed={selected}
                className={cx(
                  'text-left rounded-xl border p-4 transition-colors cursor-pointer',
                  selected ? 'border-brand-500 bg-brand-50/50 ring-2 ring-brand-100' : 'border-line bg-white hover:border-brand-200',
                )}
              >
                <div className="flex justify-between items-baseline">
                  <span className="font-semibold">Room {r.room_number}</span>
                  <span className="text-[12px] text-muted">
                    {r.capacity === 1 ? 'Single' : `${r.capacity} sharing`} · {inr(r.rent)}
                  </span>
                </div>
                {/* One segment per bed: occupied, pending approval, or free. */}
                <div className="flex gap-1.5 my-3" aria-hidden>
                  {r.beds.map((b) => (
                    <span
                      key={b.bed_id}
                      className={cx(
                        'h-2 flex-1 rounded-full',
                        b.resident_id ? 'bg-brand-600' : b.pending_admission ? 'bg-warn/50' : 'bg-line',
                      )}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-muted uppercase tracking-wide">Occupancy</span>
                  <span className={cx('font-semibold', occ === r.beds.length ? 'text-ink-2' : 'text-ok')}>
                    {occ} / {r.beds.length} beds
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
