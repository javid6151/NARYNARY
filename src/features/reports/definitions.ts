/**
 * The report catalogue. Each report fetches rows for a building (and a date range when `dated`)
 * and maps them to flat, human-readable columns used for both the preview table and the CSV export.
 */
import { BedDouble, MessageSquareWarning, Package, Receipt, Star, UserCog, Users, Wallet, Activity, type LucideIcon } from 'lucide-react';
import { addDays, fmtDateTime, isoDate, label } from '../../lib/format';
import { listAuditLogsBetween } from '../audit/api';
import { activityLabel } from '../audit/activityLabel';
import { getBuildingLayout } from '../property/api';
import {
  reportAttendance, reportComplaints, reportExpenses, reportMealReviews, reportOpenCharges, reportPayments, reportResidents, reportStock,
} from './api';

export type ReportRow = Record<string, string | number | null>;

export interface ReportDef {
  id: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  /** Hidden from managers. */
  ownerOnly?: boolean;
  /** Shows From/To filters. */
  dated: boolean;
  run: (buildingId: string, from: string, to: string) => Promise<ReportRow[]>;
}

/** Exclusive upper bound for timestamp ranges: the day after `to`. */
const end = (to: string) => addDays(to, 1);

export const REPORTS: ReportDef[] = [
  {
    id: 'residents',
    title: 'Resident report',
    desc: 'Current residents with room, bed, contact, admission date and dues.',
    icon: Users,
    dated: false,
    run: async (b) =>
      (await reportResidents(b)).map((r) => ({
        Name: r.full_name,
        Phone: r.phone,
        Email: r.email,
        Room: r.room_number,
        Bed: r.bed_label,
        'Admission date': r.admission_date,
        'Monthly rent': r.monthly_rent,
        Outstanding: r.outstanding,
      })),
  },
  {
    id: 'rent',
    title: 'Rent payment report',
    desc: 'Payments received in the period with method, reference and receipt.',
    icon: Wallet,
    dated: true,
    run: async (b, f, t) =>
      (await reportPayments(b, f, end(t))).map((p) => ({
        Date: p.paid_at.slice(0, 10),
        Resident: p.residents.full_name,
        Amount: p.amount,
        Method: label(p.payment_method),
        Reference: p.transaction_reference,
        Receipt: p.receipts?.[0]?.receipt_number ?? null,
        Status: label(p.status),
      })),
  },
  {
    id: 'dues',
    title: 'Outstanding dues report',
    desc: 'Unpaid and partially paid charges with balance and due date.',
    icon: Wallet,
    dated: false,
    run: async (b) =>
      (await reportOpenCharges(b)).map((c) => ({
        Resident: c.residents.full_name,
        Phone: c.residents.phone,
        Charge: c.description,
        'Due date': c.due_date,
        Amount: c.amount,
        Paid: c.paid_amount,
        Balance: c.balance,
        Overdue: c.due_date < isoDate() ? 'Yes' : 'No',
      })),
  },
  {
    id: 'expenses',
    title: 'Expense report',
    desc: 'All expenses by category and vendor with paid / outstanding amounts.',
    icon: Receipt,
    dated: true,
    run: async (b, f, t) =>
      (await reportExpenses(b, f, t)).map((e) => ({
        Date: e.expense_date,
        Expense: e.title,
        Category: e.expense_categories.name,
        Source: label(e.source_type),
        Vendor: e.vendors?.name ?? null,
        Total: e.total_amount,
        Paid: e.paid_amount,
        Outstanding: e.outstanding_amount,
      })),
  },
  {
    id: 'occupancy',
    title: 'Occupancy report',
    desc: 'Room-wise beds, occupied and vacant.',
    icon: BedDouble,
    dated: false,
    run: async (b) =>
      (await getBuildingLayout(b)).flatMap((f) =>
        f.rooms.map((r) => ({
          Floor: f.floor_name,
          Room: r.room_number,
          Sharing: r.capacity,
          Rent: r.rent,
          Occupied: r.beds.filter((x) => x.resident_id).length,
          Vacant: r.beds.filter((x) => !x.resident_id).length,
          Residents: r.beds.filter((x) => x.resident_name).map((x) => x.resident_name).join('; '),
        })),
      ),
  },
  {
    id: 'complaints',
    title: 'Complaints report',
    desc: 'Complaints raised with category, status and resolution date.',
    icon: MessageSquareWarning,
    dated: true,
    run: async (b, f, t) =>
      (await reportComplaints(b, f, end(t))).map((c) => ({
        Raised: c.submitted_at.slice(0, 10),
        Resident: c.residents.full_name,
        Room: c.rooms?.room_number ?? null,
        Title: c.title,
        Category: label(c.category),
        Priority: label(c.priority),
        Status: label(c.status),
        Resolved: c.resolved_at?.slice(0, 10) ?? null,
      })),
  },
  {
    id: 'food',
    title: 'Food review report',
    desc: 'Meal ratings and comments from residents.',
    icon: Star,
    dated: true,
    run: async (b, f, t) =>
      (await reportMealReviews(b, f, t)).map((r) => ({
        Date: r.meal_menus.meal_date,
        Meal: label(r.meal_menus.meal_type),
        Menu: r.meal_menus.items,
        Resident: r.residents.full_name,
        Rating: r.rating,
        Comment: r.comment,
      })),
  },
  {
    id: 'inventory',
    title: 'Inventory report',
    desc: 'Current stock in store and kitchen against reorder levels.',
    icon: Package,
    dated: false,
    run: async (b) =>
      (await reportStock(b)).map((s) => ({
        Item: s.name,
        Category: s.category,
        Unit: s.base_unit,
        Store: s.store_qty,
        Kitchen: s.kitchen_qty,
        'Reorder level': s.reorder_level,
        Status: Number(s.store_qty) + Number(s.kitchen_qty) <= Number(s.reorder_level) ? 'Low' : 'OK',
      })),
  },
  {
    id: 'attendance',
    title: 'Staff attendance report',
    desc: 'Daily attendance marks for staff in the period.',
    icon: UserCog,
    dated: true,
    run: async (b, f, t) =>
      (await reportAttendance(b, f, t)).map((a) => ({
        Date: a.attendance_date,
        Staff: a.staff_members.full_name,
        Role: label(a.staff_members.role),
        Status: label(a.status),
        Notes: a.notes,
      })),
  },
  {
    id: 'activity',
    title: 'System activity report',
    desc: 'Audit trail of sensitive actions across your business.',
    icon: Activity,
    ownerOnly: true,
    dated: true,
    // Tenant-wide: the building selection does not apply to the audit trail.
    run: async (_b, f, t) =>
      (await listAuditLogsBetween(f, end(t))).map((a) => ({
        When: fmtDateTime(a.created_at),
        Action: activityLabel(a.action),
        Entity: label(a.entity_type),
        Actor: label(a.actor_type),
      })),
  },
];
