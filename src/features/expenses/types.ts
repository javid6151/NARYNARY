/** Row shapes for the expense ledger, categories, vendors and expense payments. */

/** One row of the `expense_balances` view: an approved expense with paid/outstanding derived from payments. */
export interface ExpenseRow {
  id: string;
  title: string;
  description: string | null;
  expense_date: string;
  due_date: string | null;
  total_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  /** general | maintenance | salary | purchase … — what created the expense. */
  source_type: string;
  source_id: string | null;
  status: string;
  category_id: string;
  vendor_id: string | null;
  expense_categories: { name: string };
  vendors: { name: string } | null;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  is_maintenance: boolean;
}

export interface VendorOption {
  id: string;
  name: string;
}

export interface Vendor {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  service_categories: string[];
  is_active: boolean;
}

export interface ExpensePayment {
  id: string;
  amount: number;
  paid_at: string;
  payment_method: string;
  transaction_reference: string | null;
  status: string;
}
