/**
 * Buildings & Rooms page: floor tabs, room cards with occupancy, and per-room bed allocation
 * (admit, review pending admission, checkout). Owners also see and submit building requests.
 */
import { useState } from 'react';
import { BedDouble, Building2, Plus } from 'lucide-react';
import { useAsync } from '../../lib/hooks';
import { useAuth } from '../access/useAuth';
import { useBuilding } from '../access/useBuilding';
import { Async, Button, Card, Empty, Toast } from '../../components/ui';
import { BuildingPicker } from '../../components/BuildingPicker';
import { SectionPromoBanner } from '../../components/SectionPromoBanner';
import { CheckoutDialog } from '../residents/components/CheckoutDialog';
import { ResidentDrawer } from '../residents/components/ResidentDrawer';
import { getResidentRow } from '../residents/api';
import type { ResidentRow } from '../residents/types';
import { getBuildingLayout } from './api';
import type { LayoutBed, LayoutFloor } from './types';
import { BuildingRequestDrawer } from './components/BuildingRequestDrawer';
import { EditRoomDrawer } from './components/EditRoomDrawer';
import { FloorDrawer } from './components/FloorDrawer';
import { FloorLayout } from './components/FloorLayout';
import { PendingBuildings } from './components/PendingBuildings';
import { RoomBeds } from './components/RoomBeds';
import { RoomDrawer } from './components/RoomDrawer';
import { TransferSwapDrawer } from './components/TransferSwapDrawer';

export default function Buildings() {
  const { staff, isOwner: authIsOwner, access } = useAuth();
  const { buildingId, building, reload: reloadBuildings } = useBuilding();
  const layout = useAsync(
    () => (buildingId ? getBuildingLayout(buildingId) : Promise.resolve([] as LayoutFloor[])),
    [buildingId],
  );
  const [floorIdx, setFloorIdx] = useState(0);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<null | 'floor' | 'room' | 'edit' | 'building'>(null);
  const [checkout, setCheckout] = useState<LayoutBed | null>(null);
  const [transferBed, setTransferBed] = useState<LayoutBed | null>(null);
  const [selectedResident, setSelectedResident] = useState<ResidentRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const openResident = async (residentId: string) => {
    try {
      const row = await getResidentRow(residentId);
      if (row) {
        setSelectedResident(row);
      } else {
        setToast('Resident record not found');
      }
    } catch {
      setToast('Failed to load resident details');
    }
  };

  const floors = layout.data ?? [];
  // Keep the selected floor index in range when floors change.
  const floor = floors[Math.min(floorIdx, Math.max(0, floors.length - 1))];
  const room = floor?.rooms.find((r) => r.room_id === roomId) ?? null;
  const allBeds = floors.flatMap((f) => f.rooms.flatMap((r) => r.beds));
  const occupied = allBeds.filter((b) => b.resident_id).length;
  const occupancyPct = allBeds.length > 0 ? Math.round((occupied / allBeds.length) * 100) : 0;
  const isOwner = authIsOwner || staff?.role === 'owner' || Boolean(access?.is_platform_admin) || Boolean(access?.owned_tenant);
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
      <SectionPromoBanner
        fromTop
        eyebrow="PROPERTY GROWTH"
        title="Better Managed Spaces, Happier Residents."
        subtitle={
          building
            ? `Managing ${building.name}${building.address ? ' · ' + building.address : ''}`
            : 'Live floor-by-floor occupancy and room allocation across your PG hostels.'
        }
        imageSrc="/owner-assets/buildings-hero.jpg"
        controls={<BuildingPicker />}
        primaryAction={{
          label: 'Add Room',
          onClick: () => setDrawer('room'),
          icon: BedDouble,
        }}
        secondaryAction={{
          label: 'Add Floor',
          onClick: () => setDrawer('floor'),
          icon: Plus,
        }}
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
              {building && (
                <div className="bg-[#FFFEFC] border border-[#DED6CB] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                  <div className="flex items-center gap-3.5">
                    <div className="size-12 rounded-2xl bg-[#EBF0E6] text-[#343B2B] flex items-center justify-center shrink-0">
                      <Building2 className="size-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-[#30271F]">{building.name}</h3>
                      <p className="text-xs text-[#77736B]">{building.address || 'Active hostel facility'}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EBF0E6] border border-[#CAD7BF] text-[#242D1F] shadow-2xs">
                      <span className="relative flex size-2 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4A5D3E] opacity-60" />
                        <span className="relative inline-flex rounded-full size-2 bg-[#343B2B]" />
                      </span>
                      <span className="text-xs font-medium text-[#56634C] flex items-baseline gap-1">
                        <strong className="text-[13px] font-bold tabular text-[#242D1F]">{occupancyPct}%</strong>
                        <span>Occupancy</span>
                      </span>
                    </div>
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F5F0E8] border border-[#DED6CB] text-[#30271F] shadow-2xs">
                      <BedDouble className="size-3.5 text-[#77736B] shrink-0" />
                      <span className="text-xs font-medium text-[#77736B] flex items-baseline gap-1">
                        <strong className="text-[13px] font-bold tabular text-[#30271F]">{occupied}</strong>
                        <span>/ {allBeds.length} Beds</span>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[13px]">
                {stats.map(([k, v]) => (
                  <div key={k} className="bg-[#FFFEFC] border border-[#DED6CB] rounded-2xl px-4 py-3.5 shadow-2xs">
                    <p className="text-xs font-medium text-[#77736B]">{k}</p>
                    <p className="text-xl font-bold tabular text-[#30271F] mt-0.5">{v}</p>
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
                onSelectResident={openResident}
              />
              {room && (
                <RoomBeds
                  room={room}
                  onEdit={() => setDrawer('edit')}
                  onClose={() => setRoomId(null)}
                  onCheckout={setCheckout}
                  onSelectResident={openResident}
                  onTransfer={setTransferBed}
                />
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
      {selectedResident && (
        <ResidentDrawer
          r={selectedResident}
          onClose={() => setSelectedResident(null)}
          onChanged={(msg) => {
            setToast(msg);
            layout.reload();
            getResidentRow(selectedResident.id).then((updated) => {
              if (updated && updated.status === 'active') {
                setSelectedResident(updated);
              } else {
                setSelectedResident(null);
              }
            });
          }}
        />
      )}
      {transferBed && buildingId && (
        <TransferSwapDrawer
          resident={{
            id: transferBed.resident_id!,
            full_name: transferBed.resident_name || 'Resident',
            room_number: room?.room_number,
            bed_label: transferBed.label,
          }}
          buildingId={buildingId}
          onClose={() => setTransferBed(null)}
          onDone={(msg) => {
            setTransferBed(null);
            setToast(msg);
            layout.reload();
          }}
        />
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
