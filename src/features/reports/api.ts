/**
 * Queries behind the Reports page. Each returns raw rows for one building and period;
 * `definitions.ts` turns them into export columns. RLS limits every report to what the user may see.
 * Date ranges: `from` inclusive, `toExclusive` is the day after the chosen "To" date.
 */
import { q } from '../../lib/api';
import { supabase } from '../../lib/supabase';

// Views report every column as nullable; joined rows are asserted to the shapes the exports read.

export function reportResidents(buildingId: string) {
  return q(
    supabase.from('resident_directory').select('*').eq('building_id', buildingId).eq('status', 'active').order('room_number'),
  );
}

export function reportPayments(buildingId: string, from: string, toExclusive: string) {
  return q(
    supabase
      .from('payment_transactions')
      .select('paid_at,amount,payment_method,transaction_reference,status,residents(full_name),receipts(receipt_number)')
      .eq('building_id', buildingId)
      .gte('paid_at', from)
      .lt('paid_at', toExclusive)
      .order('paid_at'),
  );
}

export function reportOpenCharges(buildingId: string) {
  return q(
    supabase
      .from('rent_charge_balances')
      .select('description,due_date,amount,paid_amount,balance,status,residents(full_name,phone)')
      .eq('building_id', buildingId)
      .in('status', ['unpaid', 'partially_paid'])
      .order('due_date'),
  ) as unknown as Promise<{
    description: string;
    due_date: string;
    amount: number;
    paid_amount: number;
    balance: number;
    status: string;
    residents: { full_name: string; phone: string };
  }[]>;
}

/** Approved expenses with `expense_date` in [from, to] (both inclusive). */
export function reportExpenses(buildingId: string, from: string, to: string) {
  return q(
    supabase
      .from('expense_balances')
      .select('expense_date,title,source_type,total_amount,paid_amount,outstanding_amount,expense_categories(name),vendors(name)')
      .eq('building_id', buildingId)
      .eq('status', 'approved')
      .gte('expense_date', from)
      .lte('expense_date', to)
      .order('expense_date'),
  ) as unknown as Promise<{
    expense_date: string;
    title: string;
    source_type: string;
    total_amount: number;
    paid_amount: number;
    outstanding_amount: number;
    expense_categories: { name: string };
    vendors: { name: string } | null;
  }[]>;
}

export function reportComplaints(buildingId: string, from: string, toExclusive: string) {
  return q(
    supabase
      .from('complaints')
      .select('submitted_at,title,category,priority,status,resolved_at,residents(full_name),rooms(room_number)')
      .eq('building_id', buildingId)
      .gte('submitted_at', from)
      .lt('submitted_at', toExclusive)
      .order('submitted_at'),
  );
}

/** Meal reviews whose menu date is in [from, to]. */
export function reportMealReviews(buildingId: string, from: string, to: string) {
  return q(
    supabase
      .from('meal_reviews')
      .select('rating,comment,residents(full_name),meal_menus!inner(meal_date,meal_type,items)')
      .eq('building_id', buildingId)
      .gte('meal_menus.meal_date', from)
      .lte('meal_menus.meal_date', to),
  );
}

export function reportStock(buildingId: string) {
  return q(
    supabase
      .from('inventory_stock')
      .select('name,category,base_unit,store_qty,kitchen_qty,reorder_level')
      .eq('building_id', buildingId)
      .eq('is_active', true)
      .order('name'),
  );
}

/** Attendance marks with `attendance_date` in [from, to]. */
export function reportAttendance(buildingId: string, from: string, to: string) {
  return q(
    supabase
      .from('staff_attendance')
      .select('attendance_date,status,notes,marked_at,staff_members(full_name,role)')
      .eq('building_id', buildingId)
      .gte('attendance_date', from)
      .lte('attendance_date', to)
      .order('attendance_date'),
  );
}
