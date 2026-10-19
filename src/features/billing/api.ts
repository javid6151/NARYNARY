/**
 * Data access for rent billing: charges, payments, allocations and receipts.
 *
 * Money rules (enforced in SQL, see migration 9):
 * - Charges and payments are separate; a payment is allocated to charges oldest-first.
 * - `record_payment` is idempotent on its key and issues a receipt number.
 * - Payments are never edited; `reverse_payment` marks one reversed and re-opens the charges it paid.
 */
import { q, rpc } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import type { BillingResident, ChargeBalance, OpenCharge, Payment, RecordPaymentResult } from './types';

/** Charge statuses that still have a balance. */
const OPEN = ['unpaid', 'partially_paid'];

// Views report every column as nullable; rows from these views always have them, so shapes are asserted.

/** Open charges of a building with resident name/phone, oldest due first. */
export function listOpenCharges(buildingId: string): Promise<OpenCharge[]> {
  return q(
    supabase
      .from('rent_charge_balances')
      .select('id,resident_id,description,charge_type,due_date,amount,paid_amount,balance,status,residents(full_name,phone)')
      .eq('building_id', buildingId)
      .in('status', OPEN)
      .order('due_date'),
  ) as unknown as Promise<OpenCharge[]>;
}

/** Open charges of one resident, oldest due first. */
export function listResidentOpenCharges(residentId: string): Promise<ChargeBalance[]> {
  return q(
    supabase
      .from('rent_charge_balances')
      .select('id,description,due_date,balance,status')
      .eq('resident_id', residentId)
      .in('status', OPEN)
      .order('due_date'),
  ) as unknown as Promise<ChargeBalance[]>;
}

/** Latest 500 payments of a building with resident and receipt number. */
export function listPayments(buildingId: string): Promise<Payment[]> {
  return q(
    supabase
      .from('payment_transactions')
      .select('id,amount,payment_method,paid_at,status,transaction_reference,reversal_reason,residents(full_name),receipts(receipt_number)')
      .eq('building_id', buildingId)
      .order('paid_at', { ascending: false })
      .limit(500),
  );
}

/** Active residents of a building for pickers, alphabetical. */
export function listBillingResidents(buildingId: string | null): Promise<BillingResident[]> {
  if (!buildingId) return Promise.resolve([]);
  return q(
    supabase
      .from('resident_directory')
      .select('id,full_name,room_number,bed_label,outstanding')
      .eq('building_id', buildingId)
      .eq('status', 'active')
      .order('full_name'),
  ) as unknown as Promise<BillingResident[]>;
}

export interface RecordPaymentInput {
  residentId: string;
  amount: number;
  method: string;
  reference: string | null;
  paidAt: string;
  notes: string | null;
  idempotencyKey: string;
}

/** Records a payment; with no explicit allocations the server applies it to the oldest dues first. */
export async function recordPayment(p: RecordPaymentInput) {
  const result = await rpc('record_payment', {
    p_resident: p.residentId,
    p_amount: p.amount,
    p_method: p.method,
    p_reference: p.reference,
    p_paid_at: p.paidAt,
    p_allocations: null,
    p_idempotency_key: p.idempotencyKey,
    p_notes: p.notes,
  });
  return result as unknown as RecordPaymentResult;
}

/** Creates the month's rent charge for every active resident; already-billed residents are skipped. Returns the count. */
export function generateMonthlyCharges(buildingId: string, monthFirstDay: string) {
  return rpc('generate_monthly_charges', { p_building: buildingId, p_month: monthFirstDay });
}

/** Adds a one-off charge (utility, late fee, meal, other) to a resident. */
export function addCharge(c: { residentId: string; type: string; description: string; amount: number; due: string }) {
  return rpc('add_charge', {
    p_resident: c.residentId,
    p_type: c.type,
    p_description: c.description,
    p_amount: c.amount,
    p_due: c.due,
  });
}

/** Owner only. Keeps the original record, marks it reversed and re-opens the charges it paid. */
export function reversePayment(paymentId: string, reason: string) {
  return rpc('reverse_payment', { p_payment: paymentId, p_reason: reason });
}
