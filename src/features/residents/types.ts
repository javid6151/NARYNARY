/** Row shapes for residents and admissions. */

/** One row of the `resident_directory` view: resident + current bed + outstanding dues. */
export interface ResidentRow {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  status: string;
  /** True once the resident has signed up and been linked to a login. */
  has_login: boolean;
  building_id: string | null;
  room_id: string | null;
  room_number: string | null;
  floor_id: string | null;
  bed_label: string | null;
  sharing_capacity: number | null;
  monthly_rent: number | null;
  admission_date: string | null;
  admission_id: string | null;
  outstanding: number;
}

/** Full resident record (`residents` table) shown on the profile overview. */
export interface ResidentDetails {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  gender: string | null;
  date_of_birth: string | null;
  occupation: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  /** Only the last 4 characters of the ID are ever stored. */
  id_number_last4: string | null;
}

/** Editable resident fields (staff edit form). */
export interface ResidentPatch {
  full_name: string;
  phone: string;
  email: string | null;
  occupation: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
}

export interface ResidentCharge {
  id: string;
  description: string;
  due_date: string;
  amount: number;
  paid_amount: number;
  status: string;
}

export interface ResidentPayment {
  id: string;
  paid_at: string;
  amount: number;
  payment_method: string;
  transaction_reference?: string | null;
  status: string;
  receipts: { receipt_number: string }[] | { receipt_number: string } | null;
}

export interface ResidentComplaint {
  id: string;
  title: string;
  status: string;
  submitted_at: string;
  priority: string;
}

export interface AdmissionRow {
  id: string;
  /** pending_review | approved | rejected | completed (checked out) */
  status: string;
  admission_date: string;
  monthly_rent: number;
  security_deposit: number;
  setup_fee: number;
  mess_included: boolean;
  source: string | null;
  review_notes: string | null;
  created_at: string;
  approved_at: string | null;
  residents: {
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
    user_id: string | null;
    occupation: string | null;
    id_number_last4: string | null;
    status: string;
  };
  rooms: { room_number: string };
  beds: { bed_label: string };
  floors: { name: string | null };
  buildings: { name: string };
}

export interface AdmissionCharge {
  id: string;
  description: string;
  amount: number;
  balance: number;
  status: string;
}

/** New admission wizard: resident step fields. */
export interface ResidentForm {
  full_name: string;
  phone: string;
  email: string;
  gender: string;
  date_of_birth: string;
  occupation: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  id_type: string;
  id_number_last4: string;
  portal_password?: string;
}

export interface TermsForm {
  admission_date: string;
  monthly_rent: string;
  security_deposit: string;
  setup_fee: string;
  mess_included: boolean;
  source: string;
  payment_status: 'paid' | 'not_paid';
  payment_method: 'upi' | 'cash';
  payment_reference: string;
  reminder_date: string;
  reminder_note: string;
}

/** A KYC file chosen in the wizard, uploaded after the admission is created. */
export interface PendingDoc {
  file: File;
  type: string;
}
