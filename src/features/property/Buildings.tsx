/**
 * Buildings & Rooms page: floor tabs, room cards with occupancy, and per-room bed allocation
 * (admit, review pending admission, checkout). Owners also see and submit building requests.
 */
import { useState } from 'react';
import { Building2, Plus } from 'lucide-react';
import { useAsync } from '../../lib/hooks';
import { useAuth } from '../access/useAuth';
import { useBuilding } from '../access/useBuilding';
import { Async, Button, Card, Empty, PageHeader, Toast } from '../../components/ui';
import { BuildingPicker } from '../../components/BuildingPicker';
import { CheckoutDialog } from '../residents/components/CheckoutDialog';
import { getBuildingLayout } from './api';
import type { LayoutBed, LayoutFloor } from './types';
import { BuildingRequestDrawer } from './components/BuildingRequestDrawer';
import { EditRoomDrawer } from './components/EditRoomDrawer';
import { FloorDrawer } from './components/FloorDrawer';
import { FloorLayout } from './components/FloorLayout';
import { PendingBuildings } from './components/PendingBuildings';
import { RoomBeds } from './components/RoomBeds';
import { RoomDrawer } from './components/RoomDrawer';

export default function Buildings() {
  const { staff } = useAuth();
  const { buildingId, building, reload: reloadBuildings } = useBuilding();
  const layout = useAsync(
    () => (buildingId ? getBuildingLayout(buildingId) : Promise.resolve([] as LayoutFloor[])),
    [buildingId],
  );
  const [floorIdx, setFloorIdx] = useState(0);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<null | 'floor' | 'room' | 'edit' | 'building'>(null);
  const [checkout, setCheckout] = useState<LayoutBed | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const floors = layout.data ?? [];
  // Keep the selected floor index in range when floors change.
  const floor = floors[Math.min(floorIdx, Math.max(0, floors.length - 1))];
  const room = floor?.rooms.find((r) => r.room_id === roomId) ?? null;
  const allBeds = floors.flatMap((f) => f.rooms.flatMap((r) => r.beds));
  const occupied = allBeds.filter((b) => b.resident_id).length;
  const isOwner = staff?.role === 'owner';
  const saved = (msg: string) => {
    setDrawer(null);
    setToast(msg);
    layout.reload();
  };

  const stats: [string, string | number][] = [
    ['Floors', floors.length],
    ['Rooms', floors.reduce((s, f) => s + f.rooms.length, 0)],
    ['Beds occupied', `${occupied} / ${allBeds.length}`],
    ['Vacant beds', allBeds.length - occupied],
  ];

  return (
    <>
      <PageHeader
        title="Buildings & Rooms"
        subtitle={building ? `${building.name}${building.address ? ' · ' + building.address : ''}` : undefined}
        actions={
          <>
            <BuildingPicker />
            {isOwner && (
              <Button variant="secondary" onClick={() => setDrawer('building')}>
                <Building2 className="size-4" />
                Request building
              </Button>
            )}
            <Button variant="secondary" onClick={() => setDrawer('floor')}>
              <Plus className="size-4" />
              Add floor
            </Button>
            <Button onClick={() => setDrawer('room')} disabled={!floors.length}>
              <Plus className="size-4" />
              Add room
            </Button>
          </>
        }
      />
      {isOwner && <PendingBuildings />}

      <Async state={layout}>
        {() =>
          !floors.length ? (
            <Card>
              <Empty
                title="No floors yet"
                action={
                  <Button onClick={() => setDrawer('floor')}>
                    <Plus className="size-4" />
                    Add first floor
                  </Button>
                }
              >
                Add floors, then rooms. Beds are created automatically from each room’s sharing type.
              </Empty>
            </Card>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[13px]">
                {stats.map(([k, v]) => (
                  <div key={k} className="bg-white border border-line rounded-xl px-4 py-3">
                    <p className="text-muted">{k}</p>
                    <p className="text-lg font-semibold tabular">{v}</p>
                  </div>
                ))}
              </div>
              <FloorLayout
                floors={floors}
                floorIdx={floorIdx}
                roomId={roomId}
                onFloor={(i) => {
                  setFloorIdx(i);
                  setRoomId(null);
                }}
                onRoom={setRoomId}
                onAddRoom={() => setDrawer('room')}
              />
              {room && (
                <RoomBeds room={room} onEdit={() => setDrawer('edit')} onClose={() => setRoomId(null)} onCheckout={setCheckout} />
              )}
            </div>
          )
        }
      </Async>

      {buildingId && (
        <FloorDrawer
          open={drawer === 'floor'}
          onClose={() => setDrawer(null)}
          buildingId={buildingId}
          nextNumber={floors.length ? Math.max(...floors.map((f) => f.floor_number)) + 1 : 1}
          onSaved={() => saved('Floor added')}
        />
      )}
      {floor && (
        <RoomDrawer
          open={drawer === 'room'}
          onClose={() => setDrawer(null)}
          floors={floors}
          defaultFloor={floor.floor_id}
          onSaved={() => saved('Room and beds created')}
        />
      )}
      {room && <EditRoomDrawer open={drawer === 'edit'} room={room} onClose={() => setDrawer(null)} onSaved={() => saved('Room updated')} />}
      <BuildingRequestDrawer
        open={drawer === 'building'}
        onClose={() => setDrawer(null)}
        onSaved={() => {
          setDrawer(null);
          setToast('Building submitted for ZIPCO approval');
          reloadBuildings();
        }}
      />
      <CheckoutDialog
        bed={checkout}
        onClose={() => setCheckout(null)}
        onDone={(msg) => {
          setCheckout(null);
          setToast(msg);
          layout.reload();
        }}
      />
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
