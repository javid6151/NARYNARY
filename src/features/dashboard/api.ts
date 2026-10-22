/** Data access for the owner/manager dashboard. Totals come from one SQL summary function. */
import { q, rpc } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import type { DashboardSummary, OpenMaintenanceItem, RecentPayment } from './types';

/** Current-month KPIs for one building, or every accessible building when `buildingId` is null. */
export async function getDashboardSummary(buildingId: string | null) {
  try {
    return (await rpc('owner_dashboard_summary', { p_building: buildingId, p_month: null })) as unknown as DashboardSummary;
  } catch (err: any) {
    if (err?.message?.includes('no accessible buildings')) {
      return {
        period_start: new Date().toISOString().slice(0, 10),
        beds_total: 0,
        beds_occupied: 0,
        rooms_total: 0,
        residents_active: 0,
        new_residents_month: 0,
        collected_month: 0,
        billed_month: 0,
        outstanding_total: 0,
        overdue_total: 0,
        overdue_residents: 0,
        expenses_month: 0,
        expenses_by_category: [],
        expenses_unpaid: 0,
        daily_collection: [],
        pending_admissions: 0,
        open_complaints: 0,
        open_maintenance: 0,
        low_stock: [],
        staff_on_duty: 0,
      };
    }
    throw err;
  }
}

/** Six most recent payments across the given buildings. */
export function listRecentPayments(buildingIds: string[]): Promise<RecentPayment[]> {
  return q(
    supabase
      .from('payment_transactions')
      .select('id,amount,payment_method,paid_at,status,residents(full_name)')
      .in('building_id', buildingIds)
      .order('paid_at', { ascending: false })
      .limit(6),
  );
}

/** Five most recent requests that still need work across the given buildings. */
export function listOpenMaintenance(buildingIds: string[]): Promise<OpenMaintenanceItem[]> {
  return q(
    supabase
      .from('maintenance_requests')
      .select('id,title,priority,status,due_at')
      .in('building_id', buildingIds)
      .in('status', ['open', 'assigned', 'in_progress', 'on_hold'])
      .order('reported_at', { ascending: false })
      .limit(5),
  );
}
