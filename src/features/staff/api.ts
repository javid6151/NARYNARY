/**
 * Data access for building staff: roster, daily attendance, end-of-day reports and salaries.
 * Salaries are paid through `pay_staff_salary`, which writes to the shared expense ledger
 * (source_type 'salary') and allows one payment per staff member per month.
 */
import { q, rpc } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import type { AttendanceMark, StaffDailyReport, StaffMember } from './types';

export async function listStaff(buildingId: string): Promise<StaffMember[]> {
  const staff = await q<StaffMember[]>(
    supabase.from('staff_members').select('*').eq('building_id', buildingId).order('full_name'),
  );
  if (!staff.length) return staff;

  // Check if KYC details need to be merged from audit_logs
  const missingKyc = staff.some((s) => !s.aadhar_number && !s.aadhar_image_url);
  if (missingKyc) {
    const ids = staff.map((s) => s.id);
    const { data: logs } = await supabase
      .from('audit_logs')
      .select('entity_id, after_data, created_at')
      .eq('action', 'staff.kyc')
      .eq('entity_type', 'staff_member')
      .in('entity_id', ids)
      .order('created_at', { ascending: false });

    if (logs?.length) {
      const kycMap = new Map<string, { aadhar_number?: string | null; aadhar_image_url?: string | null }>();
      for (const log of logs) {
        if (log.entity_id && !kycMap.has(log.entity_id) && log.after_data) {
          kycMap.set(log.entity_id, log.after_data as any);
        }
      }
      for (const s of staff) {
        const kyc = kycMap.get(s.id);
        if (kyc) {
          if (!s.aadhar_number) s.aadhar_number = kyc.aadhar_number ?? null;
          if (!s.aadhar_image_url) s.aadhar_image_url = kyc.aadhar_image_url ?? null;
        }
      }
    }
  }
  return staff;
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
  aadharNumber?: string | null;
  aadharImageUrl?: string | null;
  aadharFile?: File | null;
}

export async function upsertStaffMember(s: StaffInput): Promise<string> {
  let aadharImageUrl = s.aadharImageUrl ?? null;

  if (s.aadharFile) {
    const cleanName = s.aadharFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${s.buildingId}/${Date.now()}-${cleanName}`;
    const { error: upErr } = await supabase.storage.from('staff-documents').upload(path, s.aadharFile, {
      contentType: s.aadharFile.type || 'image/png',
      upsert: true,
    });
    if (!upErr) {
      const { data: pub } = supabase.storage.from('staff-documents').getPublicUrl(path);
      if (pub?.publicUrl) {
        aadharImageUrl = pub.publicUrl;
      }
    }
  }

  const staffId = (await rpc('upsert_staff_member', {
    p_id: s.id,
    p_building: s.buildingId,
    p_full_name: s.fullName,
    p_role: s.role,
    p_phone: s.phone,
    p_joining_date: s.joiningDate,
    p_monthly_salary: s.monthlySalary,
    p_pay_day: s.payDay ?? 5,
    p_status: s.status ?? 'active',
  })) as unknown as string;

  const kycData = {
    aadhar_number: s.aadharNumber || null,
    aadhar_image_url: aadharImageUrl,
  };

  try {
    await supabase.from('staff_members').update(kycData as any).eq('id', staffId);
  } catch {
    // Column might not exist in database yet
  }

  try {
    const { data: bRow } = await supabase.from('buildings').select('tenant_id').eq('id', s.buildingId).maybeSingle();
    if (bRow?.tenant_id) {
      await supabase.from('audit_logs').insert({
        tenant_id: bRow.tenant_id,
        actor_type: 'tenant_user',
        action: 'staff.kyc',
        entity_type: 'staff_member',
        entity_id: staffId,
        after_data: kycData,
      });
    }
  } catch {
    // Non-blocking fallback
  }

  return staffId;
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

export interface StaffAttendanceRecord {
  id: string;
  attendance_date: string;
  status: string;
  notes: string | null;
  marked_at: string;
}

/** All attendance records for a specific staff member. */
export function listStaffMemberAttendance(staffId: string): Promise<StaffAttendanceRecord[]> {
  return q(
    supabase
      .from('staff_attendance')
      .select('id,attendance_date,status,notes,marked_at')
      .eq('staff_member_id', staffId)
      .order('attendance_date', { ascending: false }),
  );
}

export interface StaffSalaryPayment {
  id: string;
  title: string;
  description: string | null;
  total_amount: number;
  status: string;
  expense_date: string;
  created_at?: string;
  expense_payments?: {
    paid_at: string;
    payment_method: string;
    transaction_reference: string | null;
  }[];
}

/** Salary expenses for a specific staff member. */
export function listStaffMemberSalaries(staffId: string): Promise<StaffSalaryPayment[]> {
  return q(
    supabase
      .from('expenses')
      .select('id,title,description,total_amount,status,expense_date,created_at,expense_payments(paid_at,payment_method,transaction_reference)')
      .eq('source_type', 'salary')
      .eq('source_id', staffId)
      .order('expense_date', { ascending: false }),
  );
}

/** Daily reports for a specific staff member. */
export function listStaffMemberReports(staffId: string): Promise<StaffDailyReport[]> {
  return q(
    supabase
      .from('staff_daily_reports')
      .select('id,report_date,work_summary,status,created_at,staff_members(full_name,role)')
      .eq('staff_member_id', staffId)
      .order('report_date', { ascending: false }),
  );
}

/** Marks attendance for a single staff member on a given date. */
export function markSingleStaffAttendance(
  buildingId: string,
  staffId: string,
  date: string,
  status: string,
  notes: string,
) {
  return rpc('mark_staff_attendance', {
    p_building: buildingId,
    p_date: date,
    p_entries: [{ staff_member_id: staffId, status, notes }],
  });
}
