/**
 * Vacant Rooms & Beds Modal:
 * Displays all rooms and beds with current vacancies across floors,
 * with filters, search, sharing info, and 1-click admission booking.
 */
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BedDouble, CheckCircle2, DoorOpen, Search, UserPlus, X } from 'lucide-react';
import { inr } from '../../../lib/format';
import { Badge, Button } from '../../../components/ui';
import { useBuilding } from '../../access/useBuilding';
import { getBuildingLayout } from '../api';
import type { LayoutBed, LayoutFloor, LayoutRoom } from '../types';

interface VacantRoomsModalProps {
  open: boolean;
  onClose: () => void;
  defaultBuildingId?: string | null;
}

export function VacantRoomsModal({ open, onClose, defaultBuildingId }: VacantRoomsModalProps) {
  const nav = useNavigate();
  const location = useLocation();
  const { buildings, buildingId: contextBuildingId } = useBuilding();

  const [selectedBid, setSelectedBid] = useState<string>(() => {
    return defaultBuildingId || contextBuildingId || buildings[0]?.id || '';
  });

  const [floors, setFloors] = useState<LayoutFloor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [selectedFloor, setSelectedFloor] = useState<string>('all');
  const [onlyVacantBeds, setOnlyVacantBeds] = useState(false);

  // Sync selected building when opened or props change
  useEffect(() => {
    if (open) {
      const bid = defaultBuildingId || contextBuildingId || buildings[0]?.id || '';
      if (bid) setSelectedBid(bid);
    }
  }, [open, defaultBuildingId, contextBuildingId, buildings]);

  // Load layout for selected building
  useEffect(() => {
    if (!open || !selectedBid) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    getBuildingLayout(selectedBid)
      .then((data) => {
        if (!cancelled) {
          setFloors(data || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || 'Failed to load building layout');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, selectedBid]);

  // Handle escape key
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const activeBuilding = buildings.find((b) => b.id === selectedBid) || buildings[0];

  const isBedVacant = (b: LayoutBed) => !b.resident_id && !b.pending_admission && b.status === 'active';

  // Extract all rooms with vacancy info
  const allRoomsWithVacancy = useMemo(() => {
    const list: Array<{
      floor: LayoutFloor;
      room: LayoutRoom;
      vacantBeds: LayoutBed[];
      totalBeds: number;
    }> = [];

    for (const f of floors) {
      for (const r of f.rooms) {
        const vacantBeds = r.beds.filter(isBedVacant);
        if (vacantBeds.length > 0) {
          list.push({
            floor: f,
            room: r,
            vacantBeds,
            totalBeds: r.beds.length,
          });
        }
      }
    }
    return list;
  }, [floors]);

  // Totals
  const totalVacantBeds = useMemo(() => {
    return allRoomsWithVacancy.reduce((acc, curr) => acc + curr.vacantBeds.length, 0);
  }, [allRoomsWithVacancy]);

  const totalVacantRooms = allRoomsWithVacancy.length;

  // Filtered rooms based on floor and search
  const filteredRooms = useMemo(() => {
    return allRoomsWithVacancy.filter((item) => {
      if (selectedFloor !== 'all' && item.floor.floor_id !== selectedFloor) {
        return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchRoom = item.room.room_number.toLowerCase().includes(q);
        const matchFloor = item.floor.floor_name.toLowerCase().includes(q);
        const matchSharing = `${item.room.capacity} sharing`.toLowerCase().includes(q);
        return matchRoom || matchFloor || matchSharing;
      }
      return true;
    });
  }, [allRoomsWithVacancy, selectedFloor, search]);

  // Book bed handler
  const handleBookBed = (bedId: string) => {
    onClose();
    const path = location.pathname.replace(/\/+$/, '');
    if (path.endsWith('/buildings') || path.endsWith('/residents')) {
      nav(`../residents/new?bed=${bedId}`);
    } else {
      nav(`residents/new?bed=${bedId}`);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-ink/40 backdrop-blur-sm animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Vacant Rooms and Beds"
        className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[88vh] flex flex-col border border-line overflow-hidden"
      >
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-line bg-subtle/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              <DoorOpen className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-ink">Vacant Rooms & Beds</h2>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
                  {totalVacantBeds} {totalVacantBeds === 1 ? 'bed' : 'beds'} vacant
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                {activeBuilding?.name || 'Building'} · {totalVacantRooms} {totalVacantRooms === 1 ? 'room' : 'rooms'} with available beds
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-xl text-muted hover:text-ink hover:bg-subtle transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </header>

        {/* Building Selector tabs (if multiple) */}
        {buildings.length > 1 && (
          <div className="px-6 pt-3 pb-2 border-b border-line/60 bg-subtle/10 flex items-center gap-2 overflow-x-auto shrink-0">
            <span className="text-xs font-medium text-muted shrink-0">Building:</span>
            {buildings.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setSelectedBid(b.id);
                  setSelectedFloor('all');
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0 ${
                  b.id === selectedBid
                    ? 'bg-ink text-white shadow-sm'
                    : 'bg-white text-muted hover:text-ink border border-line'
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>
        )}

        {/* Filters bar */}
        <div className="px-6 py-3 border-b border-line flex flex-wrap items-center justify-between gap-3 shrink-0 bg-white">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <div className="relative w-full max-w-xs">
              <Search className="size-4 text-muted absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search room number, sharing…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-line focus:outline-none focus:border-brand-600"
              />
            </div>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="text-xs text-muted hover:text-ink p-1 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Floor filter */}
            <div className="inline-flex rounded-lg border border-line bg-subtle/40 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setSelectedFloor('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  selectedFloor === 'all' ? 'bg-white text-ink shadow-xs' : 'text-muted hover:text-ink'
                }`}
              >
                All floors
              </button>
              {floors.map((f) => {
                const count = allRoomsWithVacancy
                  .filter((item) => item.floor.floor_id === f.floor_id)
                  .reduce((s, curr) => s + curr.vacantBeds.length, 0);
                return (
                  <button
                    key={f.floor_id}
                    type="button"
                    onClick={() => setSelectedFloor(f.floor_id)}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                      selectedFloor === f.floor_id ? 'bg-white text-ink shadow-xs' : 'text-muted hover:text-ink'
                    }`}
                  >
                    {f.floor_name} {count > 0 ? `(${count})` : ''}
                  </button>
                );
              })}
            </div>

            {/* Toggle show only vacant beds */}
            <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer select-none ml-1">
              <input
                type="checkbox"
                checked={onlyVacantBeds}
                onChange={(e) => setOnlyVacantBeds(e.target.checked)}
                className="rounded border-line text-brand-600 focus:ring-0"
              />
              <span>Only vacant beds</span>
            </label>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="py-16 text-center">
              <div className="inline-block size-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-muted mt-3">Loading vacant rooms and beds…</p>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-bad text-sm">
              <p>{error}</p>
              <Button size="sm" variant="secondary" className="mt-3" onClick={() => setSelectedBid(selectedBid)}>
                Retry
              </Button>
            </div>
          ) : allRoomsWithVacancy.length === 0 ? (
            <div className="py-16 text-center max-w-sm mx-auto">
              <div className="size-12 rounded-full bg-emerald-50 text-emerald-600 grid place-items-center mx-auto mb-3">
                <CheckCircle2 className="size-6" />
              </div>
              <h3 className="font-semibold text-base text-ink">100% Occupancy!</h3>
              <p className="text-xs text-muted mt-1">
                There are currently no vacant rooms or beds in <strong>{activeBuilding?.name}</strong>. All beds are occupied.
              </p>
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="py-12 text-center text-muted text-xs">
              <p>No vacant rooms match your filter criteria.</p>
              <Button size="sm" variant="secondary" className="mt-2" onClick={() => { setSearch(''); setSelectedFloor('all'); }}>
                Reset filters
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredRooms.map(({ floor, room, vacantBeds, totalBeds }) => {
                const displayedBeds = onlyVacantBeds ? vacantBeds : room.beds;
                return (
                  <div
                    key={room.room_id}
                    className="rounded-xl border border-line bg-white hover:border-brand-200 transition-colors p-4 shadow-2xs"
                  >
                    {/* Room Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-line/60">
                      <div className="flex items-center gap-3">
                        <span className="text-base font-bold text-ink">Room {room.room_number}</span>
                        <span className="text-xs text-muted bg-subtle px-2.5 py-0.5 rounded-md font-medium">
                          {floor.floor_name}
                        </span>
                        <span className="text-xs text-muted">
                          {room.capacity}-Sharing
                        </span>
                        <span className="text-xs font-semibold text-ink tabular">
                          {inr(room.rent)}/mo
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone="ok">
                          {vacantBeds.length} of {totalBeds} {vacantBeds.length === 1 ? 'bed' : 'beds'} vacant
                        </Badge>
                      </div>
                    </div>

                    {/* Beds Grid */}
                    <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-3">
                      {displayedBeds.map((bed) => {
                        const isVacant = isBedVacant(bed);
                        return (
                          <div
                            key={bed.bed_id}
                            className={`rounded-lg p-3 transition-all flex flex-col justify-between ${
                              isVacant
                                ? 'border border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50'
                                : 'border border-line/60 bg-subtle/30 opacity-70'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1 mb-2">
                              <div className="flex items-center gap-1.5">
                                <BedDouble className={`size-4 ${isVacant ? 'text-emerald-700' : 'text-muted'}`} />
                                <span className={`text-xs font-semibold ${isVacant ? 'text-emerald-950' : 'text-muted'}`}>
                                  Bed {bed.label}
                                </span>
                              </div>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  isVacant
                                    ? 'bg-emerald-200 text-emerald-900'
                                    : 'bg-gray-200 text-gray-700'
                                }`}
                              >
                                {isVacant ? 'Available' : 'Occupied'}
                              </span>
                            </div>

                            {isVacant ? (
                              <button
                                type="button"
                                onClick={() => handleBookBed(bed.bed_id)}
                                className="w-full mt-2 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white transition-colors cursor-pointer shadow-xs"
                              >
                                <UserPlus className="size-3.5" />
                                Admit resident
                              </button>
                            ) : (
                              <div className="mt-2 text-[11px] text-muted truncate">
                                <span>Occupied by </span>
                                <strong className="text-ink font-medium">{bed.resident_name || 'Resident'}</strong>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="px-6 py-3.5 border-t border-line bg-subtle/30 flex items-center justify-between shrink-0">
          <div className="text-xs text-muted">
            Click <strong>Admit resident</strong> on any vacant bed to start direct admission.
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </footer>
      </div>
    </div>
  );
}
