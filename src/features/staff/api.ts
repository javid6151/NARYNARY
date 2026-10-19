/**
 * Data access for building staff: roster, daily attendance, end-of-day reports and salaries.
 * Salaries are paid through `pay_staff_salary`, which writes to the shared expense ledger
 * (source_type 'salary') and allows one payment per staff member per month.
 */
import { q, rpc } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import type { AttendanceMark, StaffDailyReport, StaffMember } from './types';

export function listStaff(buildingId: string): Promise<StaffMember[]> {
  return q(supabase.from('staff_members').select('*').eq('building_id', buildingId).order('full_name'));
}

/** Attendance marks of a building for one date. */
export function listAttendance(buildingId: string, date: string): Promise<AttendanceMark[]> {
  return q(
    supabase
      .from('staff_attendance')
      .select('staff_member_id,status,notes,marked_at')
      .eq('building_id', buildingId)
      .eq('attendance_date', date),
  );
}

export interface StaffInput {
  /** null creates a new staff member. */
  id: string | null;
  buildingId: string;
  fullName: string;
  role: string;
  phone: string | null;
  joiningDate: string | null;
  monthlySalary: number;
  payDay: number | null;
  status: string;
}

export function upsertStaffMember(s: StaffInput) {
  return rpc('upsert_staff_member', {
    p_id: s.id,
    p_building: s.buildingId,
    p_full_name: s.fullName,
    p_role: s.role,
    p_phone: s.phone,
    p_joining_date: s.joiningDate,
    p_monthly_salary: s.monthlySalary,
    p_pay_day: s.payDay,
    p_status: s.status,
  });
}

/** Saves the day's marks for all listed staff (re-marking is audited). Returns how many were saved. */
export function markAttendance(
  buildingId: string,
  date: string,
  entries: { staff_member_id: string; status: string; notes: string }[],
) {
  return rpc('mark_staff_attendance', { p_building: buildingId, p_date: date, p_entries: entries });
}

/** End-of-day reports of a building since `from`, newest first. */
export function listDailyReports(buildingId: string, from: string): Promise<StaffDailyReport[]> {
  return q(
    supabase
      .from('staff_daily_reports')
      .select('id,report_date,work_summary,status,staff_members(full_name,role)')
      .eq('building_id', buildingId)
      .gte('report_date', from)
      .order('report_date', { ascending: false }),
  );
}

export function submitDailyReport(staffId: string, date: string, summary: string) {
  return rpc('submit_staff_daily_report', { p_staff: staffId, p_date: date, p_summary: summary });
}

/** Owner only. Records the month's salary as a paid expense. */
export function payStaffSalary(p: { staffId: string; monthFirstDay: string; amount: number; method: string; reference: string | null }) {
  return rpc('pay_staff_salary', {
    p_staff: p.staffId,
    p_month: p.monthFirstDay,
    p_amount: p.amount,
    p_method: p.method,
    p_reference: p.reference,
  });
}
