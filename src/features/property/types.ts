/** Row shapes for building structure. Layout shapes match the `building_layout()` SQL function. */

export interface LayoutBed {
  bed_id: string;
  label: string;
  status: string;
  /** Set when an active resident occupies the bed. */
  resident_id: string | null;
  resident_name: string | null;
  admission_id: string | null;
  /** An admission for this bed is waiting for approval. */
  pending_admission: boolean;
}

export interface LayoutRoom {
  room_id: string;
  room_number: string;
  /** Number of beds (sharing type). */
  capacity: number;
  /** Monthly rent per bed for new admissions. */
  rent: number;
  status: string;
  beds: LayoutBed[];
}

export interface LayoutFloor {
  floor_id: string;
  floor_number: number;
  floor_name: string;
  rooms: LayoutRoom[];
}

/** A building that is not active yet (requested, changes requested or rejected). */
export interface BuildingRequest {
  id: string;
  name: string;
  status: string;
  review_notes: string | null;
}

export interface FloorOption {
  id: string;
  name: string | null;
  floor_number: number;
}

export interface RoomOption {
  id: string;
  room_number: string;
  floor_id: string;
}
