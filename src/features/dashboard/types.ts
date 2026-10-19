/** Shapes returned by `owner_dashboard_summary()` and the dashboard side lists. */

export interface DashboardSummary {
  /** First day of the month being summarised. */
  period_start: string;
  beds_total: number;
  beds_occupied: number;
  rooms_total: number;
  residents_active: number;
  new_residents_month: number;
  collected_month: number;
  /** Charges that fell due this month. */
  billed_month: number;
  outstanding_total: number;
  overdue_total: number;
  overdue_residents: number;
  expenses_month: number;
  expenses_unpaid: number;
  expenses_by_category: { name: string; amount: number }[];
  daily_collection: { day: string; collected: number; spent: number }[];
  pending_admissions: number;
  open_complaints: number;
  open_maintenance: number;
  low_stock: { name: string; building: string; qty: number; unit: string; reorder: number }[];
  staff_on_duty: number;
}

export interface RecentPayment {
  id: string;
  amount: number;
  payment_method: string;
  paid_at: string;
  status: string;
  residents: { full_name: string } | null;
}

export interface OpenMaintenanceItem {
  id: string;
  title: string;
  priority: string;
  status: string;
}
