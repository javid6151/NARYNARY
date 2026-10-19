/** Row shapes for rent charges, payments and receipts. */

/** A receipt relation as PostgREST may return it (array, single object or none). */
export type ReceiptRef = { receipt_number: string }[] | { receipt_number: string } | null;

/** An unpaid or partly paid charge (`rent_charge_balances` view) with the resident's name. */
export interface OpenCharge {
  id: string;
  resident_id: string;
  description: string;
  charge_type: string;
  due_date: string;
  amount: number;
  paid_amount: number;
  balance: number;
  status: string;
  residents: { full_name: string; phone: string };
}

/** A resident's own open charge, as shown in the payment allocation preview. */
export interface ChargeBalance {
  id: string;
  description: string;
  due_date: string;
  balance: number;
  status: string;
}

export interface Payment {
  id: string;
  amount: number;
  payment_method: string;
  paid_at: string;
  /** confirmed | reversed */
  status: string;
  transaction_reference: string | null;
  reversal_reason: string | null;
  residents: { full_name: string };
  receipts: ReceiptRef;
}

/** Active resident for pickers, with their current outstanding amount. */
export interface BillingResident {
  id: string;
  full_name: string;
  room_number: string;
  bed_label: string;
  outstanding: number;
}

/** Result of `record_payment`. `unallocated` is kept as an advance. */
export interface RecordPaymentResult {
  receipt_number: string;
  unallocated: number;
}
