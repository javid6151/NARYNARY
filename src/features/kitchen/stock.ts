/** Stock rules and labels shared by the owner Inventory page and the chef portal. */
import type { StockRow } from './types';

/** out_of_stock when nothing left; low_stock at or below the reorder level; otherwise in_stock. */
export const stockStatus = (s: StockRow) => {
  const qty = Number(s.expected_qty ?? (Number(s.store_qty ?? 0) + Number(s.kitchen_qty ?? 0)));
  if (qty < 0) return 'critical_stock';
  if (qty === 0) return 'out_of_stock';
  if (qty <= Number(s.reorder_level)) return 'low_stock';
  return 'in_stock';
};

/** Status of last physical reconciliation check */
export const reconciliationStatus = (s: StockRow): 'matched' | 'discrepancy' | 'awaiting_verification' => {
  if (s.last_actual_qty == null || s.last_actual_qty === undefined) return 'awaiting_verification';
  const expected = Number(s.expected_qty ?? (Number(s.store_qty ?? 0) + Number(s.kitchen_qty ?? 0)));
  const diff = Number(s.last_actual_qty) - expected;
  return Math.abs(diff) < 0.001 ? 'matched' : 'discrepancy';
};

export const CATEGORIES = [
  'Grains & Rice', 'Pulses & Lentils', 'Vegetables', 'Cooking Oil & Ghee', 'Spices & Masala', 'Dairy Products', 'Beverages',
  'Non-Veg Items', 'Cleaning Supplies', 'Disposable Items', 'Other',
];

export const UNITS = ['kg', 'g', 'litre', 'ml', 'piece', 'pack', 'dozen'];

/** Ledger transaction types shown to people. */
export const TX_LABEL: Record<string, string> = {
  purchase: 'Purchase',
  usage: 'Chef meal usage',
  consumption: 'Chef meal usage',
  adjustment_in: 'Stock correction (+)',
  adjustment_out: 'Stock correction (−)',
  correction_in: 'Stock correction (+)',
  correction_out: 'Stock correction (−)',
  opening_balance: 'Opening stock',
  issue_out: 'Issued to kitchen (Legacy)',
  issue_in: 'Received in kitchen (Legacy)',
  return_out: 'Returned from kitchen (Legacy)',
  return_in: 'Returned to store (Legacy)',
  wastage: 'Wastage (Legacy)',
};

/** Transaction types that add stock to their location. */
export const INBOUND_TYPES = ['purchase', 'issue_in', 'return_in', 'adjustment_in', 'correction_in', 'opening_balance'];

/** Movement choices in the stock drawer; adjustments are owner/manager only. */
export const MOVE_ACTIONS: [string, string][] = [
  ['purchase', 'Record purchase'],
];
export const ADJUST_ACTIONS: [string, string][] = [
  ['adjust_in', 'Stock correction (+)'],
  ['adjust_out', 'Stock correction (−)'],
];

