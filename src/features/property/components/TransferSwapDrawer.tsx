/**
 * Drawer allowing PG staff to move a resident to a vacant bed
 * OR swap beds between two active residents.
 */
import { useEffect, useState } from 'react';
import { ArrowLeftRight, BedDouble } from 'lucide-react';
import { Button, Drawer, ErrorBanner, Field, Input, Select } from '../../../components/ui';
import { inr } from '../../../lib/format';
import { getBuildingLayout } from '../api';
import { listActiveResidents, swapResidentBeds, transferResidentBed } from '../../residents/api';
import type { LayoutBed, LayoutFloor, LayoutRoom } from '../types';
import type { ResidentRow } from '../../residents/types';

interface VacantBedOption {
  bed: LayoutBed;
  room: LayoutRoom;
  floor: LayoutFloor;
}

export function TransferSwapDrawer({
  resident,
  buildingId,
  onClose,
  onDone,
}: {
  resident: { id: string; full_name: string; room_number?: string | null; bed_label?: string | null; monthly_rent?: number | null };
  buildingId: string;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [mode, setMode] = useState<'vacant' | 'swap'>('vacant');
  const [layout, setLayout] = useState<LayoutFloor[]>([]);
  const [residents, setResidents] = useState<ResidentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Transfer state
  const [selectedBedId, setSelectedBedId] = useState('');
  const [updateRent, setUpdateRent] = useState(true);
  const [customRent, setCustomRent] = useState('');

  // Swap state
  const [swapTargetId, setSwapTargetId] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        setLoading(true);
        const [l, r] = await Promise.all([
          getBuildingLayout(buildingId),
          listActiveResidents(buildingId),
        ]);
        if (!active) return;
        setLayout(l || []);
        setResidents(r || []);
      } catch (err: any) {
        if (active) setError(err.message || 'Failed to load building data');
      } finally {
        if (active) setLoading(false);
      }
    }
    loadData();
    return () => {
      active = false;
    };
  }, [buildingId]);

  // Extract vacant beds
  const vacantBeds: VacantBedOption[] = [];
  for (const f of layout) {
    for (const rm of f.rooms) {
      for (const b of rm.beds) {
        if (!b.resident_id && !b.pending_admission && b.status === 'active') {
          vacantBeds.push({ bed: b, room: rm, floor: f });
        }
      }
    }
  }

  // Filter other residents for swap
  const swapCandidates = residents.filter((r) => r.id !== resident.id && r.bed_label);

  const selectedOption = vacantBeds.find((v) => v.bed.bed_id === selectedBedId);
  const swapTarget = residents.find((r) => r.id === swapTargetId);

  useEffect(() => {
    if (selectedOption) {
      setCustomRent(String(selectedOption.room.rent || resident.monthly_rent || 0));
    }
  }, [selectedOption, resident.monthly_rent]);

  const handleTransfer = async () => {
    if (!selectedBedId) {
      setError('Please select a vacant bed to move into');
      return;
    }
    try {
      setBusy(true);
      setError(null);
      await transferResidentBed({
        residentId: resident.id,
        newBedId: selectedBedId,
        newRent: updateRent ? Number(customRent) : undefined,
        notes: notes.trim() || undefined,
      });
      onDone(`${resident.full_name} moved to Room ${selectedOption?.room.room_number} (Bed ${selectedOption?.bed.label})`);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to transfer resident');
    } finally {
      setBusy(false);
    }
  };

  const handleSwap = async () => {
    if (!swapTargetId) {
      setError('Please select another resident to swap beds with');
      return;
    }
    try {
      setBusy(true);
      setError(null);
      await swapResidentBeds({
        residentIdA: resident.id,
        residentIdB: swapTargetId,
        notes: notes.trim() || undefined,
      });
      onDone(`Beds swapped between ${resident.full_name} and ${swapTarget?.full_name}`);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to swap beds');
    } finally {
      setBusy(false);
    }
  };

  const footer = (
    <div className="flex justify-end gap-2">
      <Button variant="secondary" onClick={onClose} disabled={busy}>
        Cancel
      </Button>
      <Button
        busy={busy}
        disabled={loading || (mode === 'vacant' ? !selectedBedId : !swapTargetId)}
        onClick={mode === 'vacant' ? handleTransfer : handleSwap}
      >
        {mode === 'vacant' ? 'Confirm Room Move' : 'Confirm Bed Swap'}
      </Button>
    </div>
  );

  return (
    <Drawer open onClose={onClose} title="Room Transfer & Bed Swap" footer={footer} wide>
      <ErrorBanner error={error} />

      {/* Current Assignment Card */}
      <div className="rounded-xl border border-line bg-subtle/50 p-4 space-y-2">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider">Current Room & Bed</p>
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-base text-ink">{resident.full_name}</h4>
            <p className="text-xs text-muted mt-0.5">
              Room {resident.room_number || '—'} · Bed {resident.bed_label || '—'}
            </p>
          </div>
          {resident.monthly_rent ? (
            <span className="text-xs font-semibold text-[#343B2B] bg-[#EBF0E6] px-2.5 py-1 rounded-full border border-[#CAD7BF]">
              {inr(resident.monthly_rent)} / mo
            </span>
          ) : null}
        </div>
      </div>

      {/* Mode Selection Tabs */}
      <div className="flex rounded-xl bg-subtle p-1 gap-1">
        <button
          type="button"
          onClick={() => setMode('vacant')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            mode === 'vacant' ? 'bg-white shadow-xs text-ink' : 'text-muted hover:text-ink'
          }`}
        >
          <BedDouble className="size-4 text-brand-600" />
          <span>Move to Vacant Bed ({vacantBeds.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('swap')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            mode === 'swap' ? 'bg-white shadow-xs text-ink' : 'text-muted hover:text-ink'
          }`}
        >
          <ArrowLeftRight className="size-4 text-amber-600" />
          <span>Swap With Resident ({swapCandidates.length})</span>
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-muted animate-pulse">Loading rooms and beds...</div>
      ) : mode === 'vacant' ? (
        <div className="space-y-4 pt-1">
          {vacantBeds.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line p-6 text-center text-muted text-xs">
              No vacant beds available in this building currently. You can use the "Swap With Resident" option instead.
            </div>
          ) : (
            <>
              <Field label="Choose Available Vacant Bed" required hint="Select from vacant rooms across floors">
                {(id) => (
                  <Select id={id} value={selectedBedId} onChange={(e) => setSelectedBedId(e.target.value)}>
                    <option value="">— Select an available bed —</option>
                    {vacantBeds.map((v) => (
                      <option key={v.bed.bed_id} value={v.bed.bed_id}>
                        {v.floor.floor_name || `Floor ${v.floor.floor_number}`} · Room {v.room.room_number} (Bed {v.bed.label}) — {v.room.capacity} Sharing — {inr(v.room.rent)}/mo
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              {selectedOption && (
                <div className="rounded-xl border border-line bg-surface-subtle p-3.5 space-y-3 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-ink">New Room Rate:</span>
                    <span className="font-bold tabular text-brand-700">{inr(selectedOption.room.rent)} / month</span>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer pt-1 border-t border-line">
                    <input
                      type="checkbox"
                      checked={updateRent}
                      onChange={(e) => setUpdateRent(e.target.checked)}
                      className="size-4 rounded accent-brand-600"
                    />
                    <span className="text-ink">Update resident's recurring rent to match new room rate</span>
                  </label>

                  {updateRent && (
                    <div className="pt-1">
                      <Field label="New Monthly Rent (₹)">
                        {(id) => (
                          <Input
                            id={id}
                            type="number"
                            min="0"
                            value={customRent}
                            onChange={(e) => setCustomRent(e.target.value)}
                          />
                        )}
                      </Field>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <Field label="Reason / Transfer Notes">
            {(id) => (
              <Input
                id={id}
                placeholder="e.g. Resident requested quiet single-sharing room"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            )}
          </Field>
        </div>
      ) : (
        <div className="space-y-4 pt-1">
          {swapCandidates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line p-6 text-center text-muted text-xs">
              No other active residents found in this building to swap with.
            </div>
          ) : (
            <>
              <Field label="Select Resident to Swap With" required hint="The two residents will trade beds instantly">
                {(id) => (
                  <Select id={id} value={swapTargetId} onChange={(e) => setSwapTargetId(e.target.value)}>
                    <option value="">— Select a resident to swap with —</option>
                    {swapCandidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name} (Room {c.room_number || '—'} · Bed {c.bed_label || '—'})
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              {swapTarget && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-3 text-xs text-amber-950">
                  <p className="font-semibold text-amber-900">Exchange Preview:</p>
                  <div className="grid sm:grid-cols-2 gap-3 pt-1">
                    <div className="bg-white rounded-lg p-3 border border-amber-200 shadow-2xs">
                      <p className="font-bold text-ink">{resident.full_name}</p>
                      <p className="text-muted text-[11px] mt-0.5">
                        Moves to: <b>Room {swapTarget.room_number} · Bed {swapTarget.bed_label}</b>
                      </p>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-amber-200 shadow-2xs">
                      <p className="font-bold text-ink">{swapTarget.full_name}</p>
                      <p className="text-muted text-[11px] mt-0.5">
                        Moves to: <b>Room {resident.room_number} · Bed {resident.bed_label}</b>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Field label="Reason / Notes for Swap">
                {(id) => (
                  <Input
                    id={id}
                    placeholder="e.g. Mutual room exchange agreed between both residents"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                )}
              </Field>
            </>
          )}
        </div>
      )}
    </Drawer>
  );
}
