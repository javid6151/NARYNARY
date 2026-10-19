/** Stock rules and labels shared by the owner Inventory page and the chef portal. */
import type { StockRow } from './types';

/** out_of_stock when nothing left; low_stock at or below the reorder level; otherwise in_stock. */
export const stockStatus = (s: StockRow) => {
  const total = Number(s.store_qty) + Number(s.kitchen_qty);
  return total <= 0 ? 'out_of_stock' : total <= Number(s.reorder_level) ? 'low_stock' : 'in_stock';
};

export const CATEGORIES = [
  'Grains & Rice', 'Pulses & Lentils', 'Vegetables', 'Cooking Oil & Ghee', 'Spices & Masala', 'Dairy Products', 'Beverages',
  'Non-Veg Items', 'Cleaning Supplies', 'Disposable Items', 'Other',
];

export const UNITS = ['kg', 'g', 'litre', 'ml', 'piece', 'pack', 'dozen'];

/** Ledger transaction types shown to people. A move between locations writes an _out and an _in row. */
export const TX_LABEL: Record<string, string> = {
  purchase: 'Purchase',
  issue_out: 'Issued to kitchen',
  issue_in: 'Received in kitchen',
  consumption: 'Used in cooking',
  return_out: 'Returned from kitchen',
  return_in: 'Returned to store',
  wastage: 'Wastage',
  adjustment_in: 'Adjustment (+)',
  adjustment_out: 'Adjustment (−)',
};

/** Transaction types that add stock to their location. */
export const INBOUND_TYPES = ['purchase', 'issue_in', 'return_in', 'adjustment_in'];

/** Movement choices in the stock drawer; adjustments are owner/manager only. */
export const MOVE_ACTIONS: [string, string][] = [
  ['purchase', 'Purchase (into store)'],
  ['issue', 'Issue store → kitchen'],
  ['return', 'Return kitchen → store'],
  ['wastage', 'Wastage (from kitchen)'],
];
export const ADJUST_ACTIONS: [string, string][] = [
  ['adjust_in', 'Stock adjustment (+)'],
  ['adjust_out', 'Stock adjustment (−)'],
];
