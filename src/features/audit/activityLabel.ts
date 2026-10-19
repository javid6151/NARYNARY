import { label } from '../../lib/format';

/** Human-readable text for audit actions written by `write_audit` in the SQL workflows. */
const ACTIVITY_LABELS: Record<string, string> = {
  'payment.recorded': 'Rent payment recorded',
  'payment.reversed': 'Payment reversed',
  'admission.created': 'New admission request',
  'admission.approved': 'Admission approved',
  'admission.rejected': 'Admission rejected',
  'expense.created': 'Expense added',
  'expense_payment.recorded': 'Expense payment recorded',
  'maintenance.created': 'Maintenance request created',
  'resident.checked_out': 'Resident checked out',
  'room.created': 'Room created',
  'inventory.purchase': 'Stock purchased',
  'inventory.issue': 'Stock issued to kitchen',
  'kitchen.report_submitted': 'Kitchen meal record submitted',
  'complaint.status': 'Complaint status updated',
  'staff.saved': 'Staff details saved',
  'membership.invited': 'Staff invited',
  'charges.generated': 'Monthly rent generated',
  'resident.account_linked': 'Resident activated their account',
  'onboarding.approve': 'Business approved by ZIPCO',
  'building.requested': 'Building approval requested',
};

/** Label for an audit action; unknown actions fall back to "Entity action". */
export function activityLabel(a: string) {
  return ACTIVITY_LABELS[a] ?? label(a.replace('.', ' '));
}
