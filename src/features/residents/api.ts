/**
 * Data access for residents, admissions and checkout.
 *
 * Admission workflow (SQL in migration 8):
 * 1. `create_admission` (owner/manager) creates the resident + a pending admission and holds the bed.
 *    It is idempotent on its key, so a retried submit reuses the same admission.
 * 2. `review_admission` (owner only) approves → allocates the bed and creates first charges, or rejects.
 * 3. The resident signs up with the email on file and is linked by `claim_pending_access`.
 * 4. `checkout_resident` releases the bed; history is kept.
 */
import { q, rpc } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import type {
  AdmissionCharge, AdmissionRow, ResidentCharge, ResidentComplaint, ResidentDetails, ResidentPatch, ResidentPayment, ResidentRow,
} from './types';

// `resident_directory` and `rent_charge_balances` are views: every column is typed nullable,
// so their row shapes are asserted here.

/** Active residents of a building, by room number. */
export function listActiveResidents(buildingId: string): Promise<ResidentRow[]> {
  return q(
    supabase.from('resident_directory').select('*').eq('building_id', buildingId).eq('status', 'active').order('room_number'),
  ) as unknown as Promise<ResidentRow[]>;
}

/** Residents who checked out of this building (found through their completed admissions), by name. */
export async function listPastResidents(buildingId: string): Promise<ResidentRow[]> {
  const adm = await q(supabase.from('admissions').select('resident_id').eq('building_id', buildingId).eq('status', 'completed'));
  if (!adm.length) return [];
  return q(
    supabase.from('resident_directory').select('*').in('id', adm.map((a) => a.resident_id)).order('full_name'),
  ) as unknown as Promise<ResidentRow[]>;
}

/** Open / in-progress complaints of a building (ids only, for the count tile). */
export function listOpenComplaintIds(buildingId: string | null) {
  if (!buildingId) return Promise.resolve([]);
  return q(supabase.from('complaints').select('id', { count: 'exact' }).eq('building_id', buildingId).in('status', ['open', 'in_progress']));
}

export function getResident(residentId: string): Promise<ResidentDetails> {
  return q(supabase.from('residents').select('*').eq('id', residentId).single());
}

/** Staff edit of contact details. RLS + column grants limit what can change. */
export async function updateResident(residentId: string, patch: ResidentPatch) {
  await q(supabase.from('residents').update(patch).eq('id', residentId).select('id').single());
  return true;
}

/** All charges of a resident, latest due first. */
export function listResidentCharges(residentId: string): Promise<ResidentCharge[]> {
  return q(
    supabase
      .from('rent_charge_balances')
      .select('id,description,charge_type,due_date,amount,paid_amount,balance,status')
      .eq('resident_id', residentId)
      .order('due_date', { ascending: false }),
  ) as unknown as Promise<ResidentCharge[]>;
}

export function listResidentPayments(residentId: string): Promise<ResidentPayment[]> {
  return q(
    supabase
      .from('payment_transactions')
      .select('id,amount,payment_method,paid_at,status,transaction_reference,receipts(receipt_number)')
      .eq('resident_id', residentId)
      .order('paid_at', { ascending: false }),
  );
}

export function listResidentComplaints(residentId: string): Promise<ResidentComplaint[]> {
  return q(
    supabase
      .from('complaints')
      .select('id,title,status,submitted_at,priority')
      .eq('resident_id', residentId)
      .order('submitted_at', { ascending: false }),
  );
}

// ---------------------------------------------------------------- Admissions

/** Latest 300 admissions of a building with resident, bed and location. */
export function listAdmissions(buildingId: string): Promise<AdmissionRow[]> {
  return q(
    supabase
      .from('admissions')
      .select(
        'id,status,admission_date,monthly_rent,security_deposit,setup_fee,mess_included,source,review_notes,created_at,approved_at,' +
          'residents(id,full_name,phone,email,user_id,occupation,id_number_last4,status),' +
          'rooms(room_number),beds(bed_label),floors(name),buildings(name)',
      )
      .eq('building_id', buildingId)
      .order('created_at', { ascending: false })
      .limit(300),
  ) as unknown as Promise<AdmissionRow[]>;
}

/** Charges created by an admission (after approval). */
export function listAdmissionCharges(admissionId: string): Promise<AdmissionCharge[]> {
  return q(
    supabase
      .from('rent_charge_balances')
      .select('id,description,amount,paid_amount,balance,status')
      .eq('admission_id', admissionId)
      .order('due_date'),
  ) as unknown as Promise<AdmissionCharge[]>;
}

/** Owner approves (allocates bed, creates charges) or rejects (releases the held bed). */
export function reviewAdmission(admissionId: string, decision: 'approve' | 'reject', notes: string | null) {
  return rpc('review_admission', { p_admission: admissionId, p_decision: decision, p_notes: notes });
}

export interface CreateAdmissionInput {
  bedId: string;
  resident: Record<string, unknown>;
  terms: Record<string, unknown>;
  idempotencyKey: string;
}

/** Creates the resident and a pending admission holding the bed. Returns the admission id. */
export function createAdmission(a: CreateAdmissionInput) {
  return rpc('create_admission', {
    p_bed: a.bedId,
    p_resident: a.resident,
    p_terms: a.terms,
    p_idempotency_key: a.idempotencyKey,
  });
}

/** Resident id of an admission (to attach KYC documents after creating it). */
export async function getAdmissionResidentId(admissionId: string) {
  // `.single()` returns an error (thrown by q) when the row is missing, so `adm` is always set here.
  const adm = await q<{ resident_id: string }>(supabase.from('admissions').select('resident_id').eq('id', admissionId).single());
  return adm.resident_id;
}

/** Ends the stay: releases the bed, records any deposit refund and returns remaining dues. */
export async function checkoutResident(c: { admissionId: string | null; date: string; reason: string | null; depositRefund: number }) {
  const result = await rpc('checkout_resident', {
    p_admission: c.admissionId,
    p_checkout_date: c.date,
    p_reason: c.reason,
    p_deposit_refund: c.depositRefund,
  });
  return result as unknown as { outstanding: number };
}
