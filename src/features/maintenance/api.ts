/**
 * Data access for complaints (raised by residents) and maintenance requests (work orders).
 * Status changes go through RPCs that write an activity log and notify the resident;
 * completing a request linked to a complaint resolves the complaint.
 */
import { q, rpc } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import type { Complaint, MaintenanceActivity, MaintenanceRequest } from './types';

// ---------------------------------------------------------------- Maintenance requests

/** Latest 500 requests of a building, newest first. */
export function listMaintenanceRequests(buildingId: string): Promise<MaintenanceRequest[]> {
  return q(
    supabase
      .from('maintenance_requests')
      .select('*,maintenance_categories(name),rooms(room_number),floors(name),vendors(name)')
      .eq('building_id', buildingId)
      .order('reported_at', { ascending: false })
      .limit(500),
  );
}

/** Ids of expense categories flagged as maintenance (to include manually categorised costs). */
export function listMaintenanceExpenseCategoryIds(): Promise<{ id: string }[]> {
  return q(supabase.from('expense_categories').select('id').eq('is_maintenance', true));
}

export function listMaintenanceCategories(): Promise<{ id: string; name: string }[]> {
  return q(supabase.from('maintenance_categories').select('id,name').eq('is_active', true).order('name'));
}

/** Status history of a request, oldest first. */
export function listMaintenanceActivity(requestId: string): Promise<MaintenanceActivity[]> {
  return q(
    supabase
      .from('maintenance_activity')
      .select('id,from_status,to_status,note,created_at')
      .eq('maintenance_request_id', requestId)
      .order('created_at'),
  );
}

export interface CreateMaintenanceInput {
  buildingId: string | null;
  floorId: string | null;
  roomId: string | null;
  categoryId: string;
  title: string;
  description: string;
  priority: string;
  dueAt: string | null;
  assignedTo: string | null;
  vendorId: string | null;
  /** Complaint this request was created from, if any. */
  complaintId: string | null;
}

export function createMaintenanceRequest(r: CreateMaintenanceInput) {
  return rpc('create_maintenance_request', {
    p_building: r.buildingId,
    p_floor: r.floorId,
    p_room: r.roomId,
    p_category: r.categoryId,
    p_title: r.title,
    p_description: r.description,
    p_priority: r.priority,
    p_due_at: r.dueAt,
    p_assigned_to: r.assignedTo,
    p_vendor: r.vendorId,
    p_complaint: r.complaintId,
  });
}

/** Moves a request to `status`; the server rejects transitions that are not allowed. */
export function updateMaintenanceStatus(requestId: string, status: string, note: string | null, assignedTo: string | null) {
  return rpc('update_maintenance_status', { p_request: requestId, p_status: status, p_note: note, p_assigned_to: assignedTo });
}

// ---------------------------------------------------------------- Complaints

/** Latest 300 complaints of a building with resident, room and linked request. */
export function listComplaints(buildingId: string): Promise<Complaint[]> {
  return q(
    supabase
      .from('complaints')
      .select('*,residents(full_name),rooms(room_number),maintenance_requests(id,status)')
      .eq('building_id', buildingId)
      .order('submitted_at', { ascending: false })
      .limit(300),
  );
}

/** Updates a complaint's status; the resident is notified. */
export function updateComplaintStatus(complaintId: string, status: string, notes: string | null) {
  return rpc('update_complaint_status', { p_complaint: complaintId, p_status: status, p_notes: notes });
}
