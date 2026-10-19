/** Row shapes for complaints and maintenance requests. */

export interface MaintenanceRequest {
  id: string;
  title: string;
  description: string;
  /** low | medium | high | critical */
  priority: string;
  /** open | assigned | in_progress | on_hold | completed | cancelled */
  status: string;
  reported_at: string;
  due_at: string | null;
  completed_at: string | null;
  /** Free-text staff name. */
  assigned_to: string | null;
  completion_notes: string | null;
  complaint_id: string | null;
  floor_id: string | null;
  room_id: string | null;
  maintenance_categories: { name: string };
  rooms: { room_number: string } | null;
  floors: { name: string | null } | null;
  vendors: { name: string } | null;
}

export interface MaintenanceActivity {
  id: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  created_at: string;
}

export interface Complaint {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  /** open | in_progress | awaiting_resident | resolved | closed | rejected */
  status: string;
  submitted_at: string;
  resolved_at: string | null;
  resolution_notes: string | null;
  room_id: string | null;
  residents: { full_name: string };
  rooms: { room_number: string } | null;
  /** Requests created from this complaint (at most one in practice). */
  maintenance_requests: { id: string; status: string }[];
}

/** The complaint fields a new maintenance request is pre-filled from. */
export interface ComplaintSource {
  id: string;
  title: string;
  description: string;
  room_id: string | null;
}
