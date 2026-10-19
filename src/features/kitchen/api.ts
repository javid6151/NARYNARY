/**
 * Data access for meals and kitchen inventory.
 *
 * Inventory is an append-only ledger (`inventory_transactions`); `inventory_stock` is a view that sums it
 * per building into store and kitchen quantities. Stock never goes negative: `inventory_move` and
 * `submit_kitchen_report` lock the item and reject a movement larger than what is available.
 * Both are idempotent on their key, so a retried request posts once.
 */
import { q, rpc } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import type { KitchenReport, KitchenReportLine, KitchenReportLineInput, MealCount, MealReview, Menu, StockMovement, StockRow } from './types';

// ---------------------------------------------------------------- Meals

/** Expected headcount, who is not eating, menu and kitchen report for each meal of a date. */
export async function getMealCounts(buildingId: string, date: string) {
  return (await rpc('meal_count_summary', { p_building: buildingId, p_date: date })) as unknown as MealCount;
}

/** Menus of a building with `meal_date` in [from, to]. */
export function listMenus(buildingId: string, from: string, to: string): Promise<Menu[]> {
  return q(
    supabase
      .from('meal_menus')
      .select('id,meal_date,meal_type,items,serving_start,serving_end,change_reason')
      .eq('building_id', buildingId)
      .gte('meal_date', from)
      .lte('meal_date', to),
  ) as Promise<Menu[]>;
}

export interface MenuInput {
  buildingId: string;
  date: string;
  mealType: string;
  items: string;
  servingStart: string;
  servingEnd: string;
  /** Required by the server for a last-minute change; residents are notified with it. */
  changeReason: string | null;
}

/** Creates or replaces the menu for one meal. */
export function upsertMealMenu(m: MenuInput) {
  return rpc('upsert_meal_menu', {
    p_building: m.buildingId,
    p_date: m.date,
    p_meal_type: m.mealType,
    p_items: m.items,
    p_serving_start: m.servingStart,
    p_serving_end: m.servingEnd,
    p_change_reason: m.changeReason,
  });
}

/** Latest 500 reviews of meals served on or after `from`. */
export function listMealReviews(buildingId: string, from: string): Promise<MealReview[]> {
  return q(
    supabase
      .from('meal_reviews')
      .select('id,rating,comment,created_at,residents(full_name),meal_menus!inner(meal_date,meal_type,items,building_id)')
      .eq('building_id', buildingId)
      .gte('meal_menus.meal_date', from)
      .order('created_at', { ascending: false })
      .limit(500),
  ) as unknown as Promise<MealReview[]>;
}

// ---------------------------------------------------------------- Inventory

/** Active items with store/kitchen quantities for a building (view rows are asserted). */
export function listStock(buildingId: string): Promise<StockRow[]> {
  return q(
    supabase
      .from('inventory_stock')
      .select('item_id,name,category,base_unit,reorder_level,store_qty,kitchen_qty,last_unit_cost,is_active')
      .eq('building_id', buildingId)
      .eq('is_active', true)
      .order('name'),
  ) as Promise<StockRow[]>;
}

/** Latest 300 ledger rows for a building, optionally for one item. */
export function listStockMovements(buildingId: string, itemId?: string): Promise<StockMovement[]> {
  let b = supabase
    .from('inventory_transactions')
    .select(
      'id,transaction_type,quantity,unit_cost,occurred_at,notes,reference_type,' +
        'inventory_items(name,base_unit),inventory_locations(kind),vendors(name)',
    )
    .eq('building_id', buildingId)
    .order('occurred_at', { ascending: false })
    .limit(300);
  if (itemId) b = b.eq('item_id', itemId);
  return q(b) as unknown as Promise<StockMovement[]>;
}

export interface MoveInput {
  buildingId: string | null;
  itemId: string;
  /** purchase | issue | return | wastage | adjust_in | adjust_out */
  action: string;
  quantity: number;
  unitCost: number | null;
  vendorId: string | null;
  notes: string | null;
  idempotencyKey: string;
}

/** Posts one stock movement (two ledger rows for store↔kitchen moves). */
export function inventoryMove(m: MoveInput) {
  return rpc('inventory_move', {
    p_building: m.buildingId,
    p_item: m.itemId,
    p_action: m.action,
    p_qty: m.quantity,
    p_unit_cost: m.unitCost,
    p_vendor: m.vendorId,
    p_notes: m.notes,
    p_idempotency_key: m.idempotencyKey,
  });
}

/** Adds an item to the tenant's catalogue (stock starts at zero in every building). */
export async function addInventoryItem(i: { tenantId: string | null; name: string; category: string; baseUnit: string; reorderLevel: number }) {
  await q(
    supabase
      .from('inventory_items')
      // tenantId comes from the user's accessible buildings; RLS rejects any other tenant.
      .insert({ tenant_id: i.tenantId as string, name: i.name, category: i.category, base_unit: i.baseUnit, reorder_level: i.reorderLevel })
      .select('id')
      .single(),
  );
  return true;
}

// ---------------------------------------------------------------- Kitchen reports

export interface KitchenReportInput {
  buildingId: string | null;
  date: string;
  mealType: string;
  actualCount: number;
  summary: string | null;
  lines: KitchenReportLineInput[];
  idempotencyKey: string;
}

/** Records a cooked meal and posts all its usage/return/wastage lines to the ledger in one transaction. */
export function submitKitchenReport(r: KitchenReportInput) {
  return rpc('submit_kitchen_report', {
    p_building: r.buildingId,
    p_date: r.date,
    p_meal_type: r.mealType,
    p_actual_count: r.actualCount,
    p_summary: r.summary,
    p_lines: r.lines,
    p_idempotency_key: r.idempotencyKey,
  });
}

/** Latest 90 meal records of a building. */
export function listKitchenReports(buildingId: string): Promise<KitchenReport[]> {
  return q(
    supabase
      .from('kitchen_daily_reports')
      .select('id,report_date,meal_type,expected_meal_count,actual_meal_count,summary,submitted_at')
      .eq('building_id', buildingId)
      .order('report_date', { ascending: false })
      .order('meal_type')
      .limit(90),
  );
}

/** Ingredients used / wasted / returned for one meal record. */
export function listKitchenReportLines(reportId: string): Promise<KitchenReportLine[]> {
  return q(
    supabase
      .from('inventory_transactions')
      .select('id,transaction_type,quantity,notes,inventory_items(name,base_unit)')
      .eq('reference_id', reportId)
      .in('transaction_type', ['consumption', 'wastage', 'return_in']),
  );
}

// ---------------------------------------------------------------- Chef profile

/** The signed-in user's display name from their profile (used for the greeting). */
export async function getMyName(userId: string) {
  const rows = await q(supabase.from('profiles').select('full_name,email').eq('id', userId).limit(1));
  return rows[0]?.full_name || rows[0]?.email?.split('@')[0] || '';
}
