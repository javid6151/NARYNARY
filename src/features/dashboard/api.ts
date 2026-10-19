/** Data access for the owner/manager dashboard. Totals come from one SQL summary function. */
import { q, rpc } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import type { DashboardSummary, OpenMaintenanceItem, RecentPayment } from './types';

/** Current-month KPIs for one building, or every accessible building when `buildingId` is null. */
export async function getDashboardSummary(buildingId: string | null) {
  return (await rpc('owner_dashboard_summary', { p_building: buildingId, p_month: null })) as unknown as DashboardSummary;
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
