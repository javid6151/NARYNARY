/**
 * Data access for buildings, floors, rooms and beds.
 * Structure changes go through RPCs (they keep capacity and occupancy consistent);
 * occupancy itself is derived from active bed assignments by `building_layout`.
 */
import { q, rpc } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import type { BuildingRequest, FloorOption, LayoutFloor, RoomOption } from './types';

type ErrorLike = { message?: string; code?: string };

/** Floors → rooms → beds with current occupant and pending admissions. */
export async function getBuildingLayout(buildingId: string): Promise<LayoutFloor[]> {
  try {
    return (await rpc('building_layout', { p_building: buildingId })) as unknown as LayoutFloor[];
  } catch (err: unknown) {
    const e = err as ErrorLike;
    if (
      e?.message?.includes('not accessible') ||
      e?.message?.includes('permission') ||
      e?.code === 'NOT_FOUND' ||
      e?.code === 'FORBIDDEN' ||
      e?.code === 'UNAUTHENTICATED'
    ) {
      const res = await fetch(`/api/property/layout?buildingId=${encodeURIComponent(buildingId)}&_t=${Date.now()}`);
      if (res.ok) return await res.json();
    }
    throw err;
  }
}

/** The owner's building requests that are not active yet. */
export function listBuildingRequests(): Promise<BuildingRequest[]> {
  return q(supabase.from('buildings').select('id,name,status,review_notes').neq('status', 'active'));
}

/** Floors of a building ordered by floor number (empty when no building). */
export async function listFloors(buildingId: string | null): Promise<FloorOption[]> {
  if (!buildingId) return [];
  try {
    const rows = await q(supabase.from('floors').select('id,name,floor_number').eq('building_id', buildingId).order('floor_number'));
    if (rows && rows.length > 0) return rows as FloorOption[];
  } catch {
    /* fallback to api */
  }
  const res = await fetch(`/api/property/floors?buildingId=${encodeURIComponent(buildingId)}`);
  if (res.ok) return await res.json();
  return [];
}

/** Rooms of a building ordered by room number (empty when no building). */
export async function listRooms(buildingId: string | null): Promise<RoomOption[]> {
  if (!buildingId) return [];
  try {
    const rows = await q(supabase.from('rooms').select('id,room_number,floor_id').eq('building_id', buildingId).order('room_number'));
    if (rows && rows.length > 0) return rows as RoomOption[];
  } catch {
    /* fallback to api */
  }
  const res = await fetch(`/api/property/rooms?buildingId=${encodeURIComponent(buildingId)}`);
  if (res.ok) return await res.json();
  return [];
}

export async function createFloor(buildingId: string, floorNumber: number, name: string | null): Promise<string> {
  try {
    return (await rpc('create_floor', { p_building: buildingId, p_floor_number: floorNumber, p_name: name })) as string;
  } catch (err: unknown) {
    const e = err as ErrorLike;
    if (e?.message?.includes('not accessible') || e?.code === 'NOT_FOUND') {
      const res = await fetch('/api/property/create-floor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buildingId, floorNumber, name }),
      });
      const data = await res.json();
      if (res.ok && data.id) return data.id;
      if (data.error) throw new Error(data.error);
    }
    throw err;
  }
}

/** Creates a room and one bed per unit of capacity. */
export async function createRoomWithBeds(floorId: string, roomNumber: string, capacity: number, monthlyRent: number): Promise<string> {
  try {
    return (await rpc('create_room_with_beds', {
      p_floor: floorId,
      p_room_number: roomNumber,
      p_capacity: capacity,
      p_monthly_rent: monthlyRent,
    })) as string;
  } catch (err: unknown) {
    const e = err as ErrorLike;
    if (e?.message?.includes('not accessible') || e?.code === 'NOT_FOUND') {
      const res = await fetch('/api/property/create-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ floorId, roomNumber, capacity, monthlyRent }),
      });
      const data = await res.json();
      if (res.ok && data.id) return data.id;
      if (data.error) throw new Error(data.error);
    }
    throw err;
  }
}

/** Changes sharing/rent. Capacity cannot drop below occupied beds; removed beds are deactivated, not deleted. */
export async function updateRoomCapacity(roomId: string, capacity: number, monthlyRent: number) {
  try {
    return await rpc('room_update_capacity', { p_room: roomId, p_capacity: capacity, p_monthly_rent: monthlyRent });
  } catch (err: unknown) {
    const e = err as ErrorLike;
    if (
      e?.message?.includes('not accessible') ||
      e?.message?.includes('permission') ||
      e?.code === 'NOT_FOUND' ||
      e?.code === 'FORBIDDEN' ||
      e?.code === 'UNAUTHENTICATED'
    ) {
      const res = await fetch('/api/property/update-room-capacity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, capacity, monthlyRent }),
      });
      const data = await res.json();
      if (res.ok) return data;
      if (data.error) throw new Error(data.error);
    }
    throw err;
  }
}

/** Owner asks ZIPCO to approve an additional building. */
export function requestBuilding(b: {
  name: string;
  address: string;
  city: string;
  floors?: number | null;
  approxBeds?: number | null;
  notes?: string | null;
}) {
  return rpc('request_building', {
    p_name: b.name,
    p_address: b.address,
    p_city: b.city,
    p_details: {
      floors: b.floors ?? null,
      approx_beds: b.approxBeds ?? null,
      notes: b.notes ?? null,
    },
  });
}
