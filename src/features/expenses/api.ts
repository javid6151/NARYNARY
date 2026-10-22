/**
 * Data access for the shared expense ledger (general, maintenance and salary expenses all live here).
 * Expenses and their payments are written through idempotent RPCs; vendors are plain RLS-checked rows.
 */
import { q, rpc } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import type { ExpenseCategory, ExpensePayment, ExpenseRow, Vendor, VendorOption } from './types';

/** Approved expenses of a building (latest 500), optionally only one source type (e.g. 'maintenance'). */
export async function listExpenses(buildingId: string, source?: string): Promise<ExpenseRow[]> {
  let qb = supabase
    .from('expense_balances')
    .select('*,expense_categories(name),vendors(name)')
    .eq('building_id', buildingId)
    .eq('status', 'approved')
    .order('expense_date', { ascending: false })
    .limit(500);
  if (source) qb = qb.eq('source_type', source);
  // Views report every column as nullable; the view only returns real expenses, so the row shape is asserted here.
  const rows = (await q(qb)) as unknown as ExpenseRow[];
  if (!rows || rows.length === 0) return [];

  const creatorIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean))] as string[];
  if (creatorIds.length > 0) {
    try {
      const [profs, mems] = await Promise.all([
        q(supabase.from('profiles').select('id,full_name,email').in('id', creatorIds)),
        q(supabase.from('tenant_memberships').select('user_id,display_name,role').in('user_id', creatorIds)),
      ]);
      const profMap = new Map((profs as any[]).map((p) => [p.id, p]));
      const memMap = new Map((mems as any[]).map((m) => [m.user_id, m]));

      for (const r of rows) {
        if (!r.created_by) continue;
        const p = profMap.get(r.created_by);
        const m = memMap.get(r.created_by);
        const name = m?.display_name || p?.full_name || (p?.email ? p.email.split('@')[0] : 'Staff');
        const role = m?.role ? (m.role.charAt(0).toUpperCase() + m.role.slice(1)) : null;
        r.recorded_by = {
          id: r.created_by,
          name,
          role,
          email: p?.email ?? null,
        };
      }
    } catch {
      // Fallback gracefully without breaking expense list
    }
  }

  return rows;
}

export function listExpenseCategories(): Promise<ExpenseCategory[]> {
  return q(supabase.from('expense_categories').select('id,name,is_maintenance').eq('is_active', true).order('name'));
}

export function listActiveVendors(): Promise<VendorOption[]> {
  return q(supabase.from('vendors').select('id,name').eq('is_active', true).order('name'));
}

/** All vendors (active and inactive) for the Vendors tab. */
export function listVendors(): Promise<Vendor[]> {
  return q(supabase.from('vendors').select('*').order('name'));
}

export interface VendorInput {
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  service_categories: string[];
}

/** Inserts a vendor, or updates it (including active flag) when `id` is given. */
export async function saveVendor(v: VendorInput, opts: { id?: string; isActive: boolean; tenantId: string }) {
  if (opts.id) {
    await q(supabase.from('vendors').update({ ...v, is_active: opts.isActive }).eq('id', opts.id).select('id').single());
  } else {
    await q(supabase.from('vendors').insert({ ...v, tenant_id: opts.tenantId }).select('id').single());
  }
  return true;
}

export interface CreateExpenseInput {
  buildingId: string | null;
  categoryId: string;
  title: string;
  description: string | null;
  expenseDate: string;
  dueDate: string | null;
  subtotal: number;
  tax: number;
  vendorId: string | null;
  sourceType: 'general' | 'maintenance';
  /** Maintenance request id when `sourceType` is 'maintenance'. */
  sourceId: string | null;
  initialPayment: { amount: number; method: string; reference: string } | null;
  idempotencyKey: string;
}

/** Creates an expense (and optional first payment). Idempotent on `idempotencyKey`. Returns the expense id. */
export function createExpense(e: CreateExpenseInput) {
  return rpc('create_expense', {
    p_building: e.buildingId,
    p_category: e.categoryId,
    p_title: e.title,
    p_description: e.description,
    p_expense_date: e.expenseDate,
    p_due_date: e.dueDate,
    p_subtotal: e.subtotal,
    p_tax: e.tax,
    p_vendor: e.vendorId,
    p_source_type: e.sourceType,
    p_source_id: e.sourceId,
    p_initial_payment: e.initialPayment,
    p_idempotency_key: e.idempotencyKey,
  });
}

export function listExpensePayments(expenseId: string): Promise<ExpensePayment[]> {
  return q(
    supabase
      .from('expense_payments')
      .select('id,amount,paid_at,payment_method,transaction_reference,status')
      .eq('expense_id', expenseId)
      .order('paid_at'),
  );
}

export interface ExpensePaymentInput {
  expenseId: string;
  amount: number;
  method: string;
  reference: string | null;
  paidAt: string;
  idempotencyKey: string;
}

/** Records a payment against an expense; rejected server-side if it exceeds the outstanding amount. */
export function recordExpensePayment(p: ExpensePaymentInput) {
  return rpc('record_expense_payment', {
    p_expense: p.expenseId,
    p_amount: p.amount,
    p_method: p.method,
    p_reference: p.reference,
    p_paid_at: p.paidAt,
    p_notes: null,
    p_idempotency_key: p.idempotencyKey,
  });
}
