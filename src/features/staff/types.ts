/** Row shapes for building staff (roster entries, not logins), attendance and daily reports. */

export interface StaffMember {
  id: string;
  full_name: string;
  role: string;
  phone: string | null;
  joining_date: string | null;
  monthly_salary: number;
  /** Day of month (1–28) salary is due. */
  pay_day: number | null;
  /** active | on_leave | inactive */
  status: string;
  aadhar_number?: string | null;
  aadhar_image_url?: string | null;
}

export interface AttendanceMark {
  staff_member_id: string;
  status: string;
  notes: string | null;
}

export interface StaffDailyReport {
  id: string;
  report_date: string;
  work_summary: string;
  status?: string;
  staff_members: { full_name: string; role: string };
}

export const STAFF_ROLES = ['warden', 'cook', 'kitchen_helper', 'cleaning', 'security', 'helper', 'driver', 'manager', 'other'];
export const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'half_day', 'leave', 'off_day'];
