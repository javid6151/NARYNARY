/**
 * Data access for buildings, floors, rooms and beds.
 * Structure changes go through RPCs (they keep capacity and occupancy consistent);
 * occupancy itself is derived from active bed assignments by `building_layout`.
 */
import { q, rpc } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import type { BuildingRequest, FloorOption, LayoutFloor, RoomOption } from './types';

/** Floors → rooms → beds with current occupant and pending admissions. */
export async function getBuildingLayout(buildingId: string) {
  return (await rpc('building_layout', { p_building: buildingId })) as unknown as LayoutFloor[];
}

/** The owner's building requests that are not active yet. */
export function listBuildingRequests(): Promise<BuildingRequest[]> {
  return q(supabase.from('buildings').select('id,name,status,review_notes').neq('status', 'active'));
}

/** Floors of a building ordered by floor number (empty when no building). */
export function listFloors(buildingId: string | null): Promise<FloorOption[]> {
  if (!buildingId) return Promise.resolve([]);
  return q(supabase.from('floors').select('id,name,floor_number').eq('building_id', buildingId).order('floor_number'));
}

/** Rooms of a building ordered by room number (empty when no building). */
export function listRooms(buildingId: string | null): Promise<RoomOption[]> {
  if (!buildingId) return Promise.resolve([]);
  return q(supabase.from('rooms').select('id,room_number,floor_id').eq('building_id', buildingId).order('room_number'));
}

export function createFloor(buildingId: string, floorNumber: number, name: string | null) {
  return rpc('create_floor', { p_building: buildingId, p_floor_number: floorNumber, p_name: name });
}

/** Creates a room and one bed per unit of capacity. */
export function createRoomWithBeds(floorId: string, roomNumber: string, capacity: number, monthlyRent: number) {
  return rpc('create_room_with_beds', {
    p_floor: floorId,
    p_room_number: roomNumber,
    p_capacity: capacity,
    p_monthly_rent: monthlyRent,
  });
}

/** Changes sharing/rent. Capacity cannot drop below occupied beds; removed beds are deactivated, not deleted. */
export function updateRoomCapacity(roomId: string, capacity: number, monthlyRent: number) {
  return rpc('room_update_capacity', { p_room: roomId, p_capacity: capacity, p_monthly_rent: monthlyRent });
}

/** Owner asks ZIPCO to approve an additional building. */
export function requestBuilding(b: { name: string; address: string; city: string; floors: number | null }) {
  return rpc('request_building', { p_name: b.name, p_address: b.address, p_city: b.city, p_details: { floors: b.floors } });
}
