/** Row shapes for the resident portal. Every query here is limited by RLS to the resident's own records. */
import type { MealType } from '../kitchen/types';

/** Result of `my_resident_profile()`: the resident's current stay. */
export interface ResidentProfile {
  resident_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  business_name: string;
  building_id: string;
  building_name: string;
  building_address: string | null;
  floor_name: string;
  room_number: string;
  sharing: number;
  bed_label: string;
  admission_date: string;
  monthly_rent: number;
  security_deposit: number;
  mess_included: boolean;
  /** Opted in to showing first name + birthday to the building. */
  share_birthday: boolean;
  /** Whether the PG has a date of birth on file (needed for birthdays). */
  has_birthday: boolean;
  /** Per-meal "not eating" cutoff times (HH:MM:SS) and whether reviews are allowed. */
  cutoffs: Record<MealType, string> & { allow_reviews: boolean };
}

export interface MyCharge {
  id: string;
  description: string;
  charge_type: string;
  due_date: string;
  amount: number;
  paid_amount: number;
  balance: number;
  status: string;
}

export interface MyPayment {
  id: string;
  amount: number;
  payment_method: string;
  paid_at: string;
  /** confirmed | reversed */
  status: string;
  transaction_reference: string | null;
  receipts: { receipt_number: string }[];
  /** Charges this payment was applied to (oldest dues first). Any remainder is an advance. */
  payment_allocations: { allocated_amount: number; rent_charges: { description: string; charge_type: string } | null }[];
}

export interface DayMenu {
  id: string;
  meal_type: string;
  items: string;
  serving_start: string | null;
  serving_end: string | null;
  change_reason: string | null;
}

export interface MyComplaint {
  id: string;
  title: string;
  category: string;
  status: string;
  submitted_at: string;
  resolution_notes: string | null;
}

export interface ResidentNotice {
  id: string;
  title: string;
  body: string;
  category: string;
  published_at: string | null;
}
