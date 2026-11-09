/**
 * Enhanced Floor tabs plus room cards with occupancy indicators,
 * resident avatars, and Available/Occupied status badges matching the reference design.
 */
import { useState, useMemo } from 'react';
import { Button, Card, Empty, Avatar } from '../../../components/ui';
import { cx } from '../../../lib/cx';
import { inr } from '../../../lib/format';
import type { LayoutFloor } from '../types';

export function FloorLayout({
  floors,
  floorIdx,
  roomId,
  onFloor,
  onRoom,
  onAddRoom,
}: {
  floors: LayoutFloor[];
  floorIdx: number;
  roomId: string | null;
  onFloor: (index: number) => void;
  onRoom: (roomId: string | null) => void;
  onAddRoom: () => void;
}) {
  const [filter, setFilter] = useState<'all' | 'available' | 'occupied'>('all');
  const floor = floors[Math.min(floorIdx, Math.max(0, floors.length - 1))];

  const rooms = useMemo(() => {
    if (!floor?.rooms) return [];
    if (filter === 'all') return floor.rooms;
    return floor.rooms.filter((r) => {
      const occupied = r.beds.filter((b) => b.resident_id).length;
      if (filter === 'available') return occupied < r.beds.length;
      return occupied === r.beds.length;
    });
  }, [floor, filter]);

  const totalRooms = floor?.rooms.length ?? 0;
  const availableCount = floor?.rooms.filter((r) => r.beds.filter((b) => b.resident_id).length < r.beds.length).length ?? 0;
  const occupiedCount = totalRooms - availableCount;

  const floorTabs =
    floors.length > 1 ? (
      <div role="tablist" className="flex gap-1.5 bg-[#F5F0E8] border border-[#DED6CB] rounded-xl p-1 overflow-x-auto">
        {floors.map((f, i) => {
          const rawName = f.floor_name?.trim();
          const label = rawName
            ? rawName.charAt(0).toUpperCase() + rawName.slice(1)
            : typeof f.floor_number === 'number'
              ? f.floor_number === 0
                ? 'Ground Floor'
                : `Floor ${f.floor_number}`
              : `Floor ${i + 1}`;
          const active = i === floorIdx;
          return (
            <button
              key={f.floor_id}
              role="tab"
              aria-selected={active}
              onClick={() => onFloor(i)}
              style={{
                color: active ? '#FFFFFF' : '#30271F',
                backgroundColor: active ? '#343B2B' : 'transparent',
              }}
              className={cx(
                'px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
                active
                  ? 'bg-[#343B2B] text-white shadow-xs !text-white'
                  : 'text-[#30271F] hover:bg-[#ECE5DA]',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <Card title="Interactive Floor & Room Layout" action={floorTabs}>
      <div className="flex flex-wrap items-center justify-between gap-3 -mt-1 mb-4 pb-3 border-b border-[#ECE5DA]">
        <p className="text-xs text-[#77736B]">
          Select a room to view details, allocate beds, or review resident checkouts.
        </p>

        {/* Status filter chips from reference image */}
        <div className="flex items-center gap-1.5 text-xs">
          <button
            onClick={() => setFilter('all')}
            className={cx(
              'px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer',
              filter === 'all'
                ? 'bg-[#343B2B] text-white'
                : 'bg-[#F5F0E8] text-[#77736B] hover:bg-[#ECE5DA]',
            )}
          >
            All ({totalRooms})
          </button>
          <button
            onClick={() => setFilter('available')}
            className={cx(
              'px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer',
              filter === 'available'
                ? 'bg-[#EAF3E4] text-[#2F6B27] font-semibold border border-[#CAD7BF]'
                : 'bg-[#F5F0E8] text-[#77736B] hover:bg-[#ECE5DA]',
            )}
          >
            Available ({availableCount})
          </button>
          <button
            onClick={() => setFilter('occupied')}
            className={cx(
              'px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer',
              filter === 'occupied'
                ? 'bg-[#FDF1EC] text-[#B9674B] font-semibold border border-[#B9674B]/20'
                : 'bg-[#F5F0E8] text-[#77736B] hover:bg-[#ECE5DA]',
            )}
          >
            Occupied ({occupiedCount})
          </button>
        </div>
      </div>

      {!rooms.length ? (
        <Empty
          title={filter === 'all' ? 'No rooms on this floor' : 'No rooms match filter'}
          action={
            <Button size="sm" onClick={onAddRoom}>
              Add room
            </Button>
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {rooms.map((r) => {
            const occ = r.beds.filter((b) => b.resident_id).length;
            const isFull = occ === r.beds.length;
            const selected = r.room_id === roomId;
            const occupants = r.beds.filter((b) => b.resident_name);

            return (
              <button
                key={r.room_id}
                onClick={() => onRoom(selected ? null : r.room_id)}
                aria-pressed={selected}
                className={cx(
                  'text-left rounded-2xl border p-4 transition-all cursor-pointer relative group',
                  selected
                    ? 'border-[#343B2B] bg-[#EBF0E6]/50 ring-2 ring-[#CAD7BF] shadow-xs'
                    : 'border-[#DED6CB] bg-[#FFFEFC] hover:border-[#CAD7BF] hover:shadow-xs',
                )}
              >
                {/* Header: Room Number + Status Badge */}
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-[15px] text-[#30271F] group-hover:text-[#343B2B]">
                      Room {r.room_number}
                    </span>
                    <span className="text-xs text-[#77736B] block mt-0.5">
                      {r.capacity === 1 ? 'Single Sharing' : `${r.capacity} Sharing`} · {inr(r.rent)}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={cx(
                      'px-2 py-0.5 rounded-full text-[11px] font-bold border',
                      isFull
                        ? 'bg-[#FDF1EC] text-[#B9674B] border-[#B9674B]/20'
                        : 'bg-[#EBF0E6] text-[#242D1F] border-[#CAD7BF]',
                    )}
                  >
                    {isFull ? 'Occupied' : 'Available'}
                  </span>
                </div>

                {/* Bed Progress Segments */}
                <div className="flex gap-1.5 my-3" aria-hidden>
                  {r.beds.map((b) => (
                    <span
                      key={b.bed_id}
                      className={cx(
                        'h-2 flex-1 rounded-full',
                        b.resident_id
                          ? 'bg-[#343B2B]'
                          : b.pending_admission
                          ? 'bg-[#FDF4E3]'
                          : 'bg-[#ECE5DA]',
                      )}
                    />
                  ))}
                </div>

                {/* Footer: Occupants / Avatar preview & Occupancy count */}
                <div className="flex items-center justify-between text-xs pt-2 border-t border-[#ECE5DA]">
                  <div className="flex items-center -space-x-1.5">
                    {occupants.slice(0, 3).map((b) => (
                      <span key={b.bed_id} title={b.resident_name ?? ''}>
                        <Avatar name={b.resident_name ?? 'Resident'} size={22} />
                      </span>
                    ))}
                    {occupants.length > 3 && (
                      <span className="size-5 rounded-full bg-[#ECE5DA] text-[10px] font-bold text-[#77736B] flex items-center justify-center">
                        +{occupants.length - 3}
                      </span>
                    )}
                    {occupants.length === 0 && (
                      <span className="text-[11px] text-[#77736B] italic">Vacant</span>
                    )}
                  </div>

                  <span className={cx('font-bold tabular', isFull ? 'text-[#30271F]' : 'text-[#343B2B]')}>
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
