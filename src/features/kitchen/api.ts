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

/** Active items with unified expected and last actual stock for a building. */
export async function listStock(buildingId: string): Promise<StockRow[]> {
  const rows = await q<any[]>(
    supabase
      .from('inventory_stock')
      .select('item_id,name,category,base_unit,reorder_level,store_qty,kitchen_qty,last_unit_cost,is_active')
      .eq('building_id', buildingId)
      .eq('is_active', true)
      .order('name'),
  );

  let latestRecMap = new Map<string, { actual_qty: number; verified_at: string }>();
  try {
    const { data: recs } = await (supabase.from as any)('inventory_reconciliations')
      .select('id,verified_at,inventory_reconciliation_lines(item_id,actual_qty)')
      .eq('building_id', buildingId)
      .order('verified_at', { ascending: false })
      .limit(10);

    if (recs?.length) {
      for (const rec of recs) {
        for (const line of (rec as any).inventory_reconciliation_lines ?? []) {
          if (!latestRecMap.has(line.item_id)) {
            latestRecMap.set(line.item_id, {
              actual_qty: Number(line.actual_qty),
              verified_at: rec.verified_at,
            });
          }
        }
      }
    }
  } catch {
    try {
      const { data: logs } = await supabase
        .from('audit_logs')
        .select('created_at,after_data')
        .eq('action', 'inventory.reconciliation')
        .order('created_at', { ascending: false })
        .limit(10);
      for (const l of logs ?? []) {
        const after = l.after_data as any;
        if (after?.building_id === buildingId && Array.isArray(after.lines)) {
          for (const line of after.lines) {
            if (!latestRecMap.has(line.itemId)) {
              latestRecMap.set(line.itemId, {
                actual_qty: Number(line.actualQty),
                verified_at: l.created_at,
              });
            }
          }
        }
      }
    } catch {
      // Ignored
    }
  }

  return rows.map((r) => {
    const expected = Number(r.expected_qty ?? (Number(r.store_qty ?? 0) + Number(r.kitchen_qty ?? 0)));
    const rec = latestRecMap.get(r.item_id);

    return {
      ...r,
      expected_qty: expected,
      current_qty: expected,
      store_qty: 0,
      kitchen_qty: expected,
      last_actual_qty: rec ? rec.actual_qty : (r.last_actual_qty ?? null),
      last_verified_at: rec ? rec.verified_at : (r.last_verified_at ?? null),
    };
  });
}

export interface StockMovementFilter {
  buildingId: string;
  itemId?: string;
  type?: string;
  fromDate?: string;
  toDate?: string;
}

/** Filterable ledger rows for a building, with optional item, transaction type, or date range. */
export function listStockMovements(
  buildingIdOrFilter: string | StockMovementFilter,
  legacyItemId?: string,
): Promise<StockMovement[]> {
  const f: StockMovementFilter =
    typeof buildingIdOrFilter === 'string'
      ? { buildingId: buildingIdOrFilter, itemId: legacyItemId }
      : buildingIdOrFilter;

  let b = supabase
    .from('inventory_transactions')
    .select(
      'id,transaction_type,quantity,unit_cost,occurred_at,notes,reference_type,' +
        'inventory_items(name,base_unit),inventory_locations(kind),vendors(name)',
    )
    .eq('building_id', f.buildingId)
    .order('occurred_at', { ascending: false })
    .limit(400);

  if (f.itemId) b = b.eq('item_id', f.itemId);
  if (f.type) b = b.eq('transaction_type', f.type);
  if (f.fromDate) b = b.gte('occurred_at', `${f.fromDate}T00:00:00`);
  if (f.toDate) b = b.lte('occurred_at', `${f.toDate}T23:59:59`);

  return q(b) as unknown as Promise<StockMovement[]>;
}

export interface MoveInput {
  buildingId: string | null;
  itemId: string;
  /** purchase | adjust_in | adjust_out */
  action: string;
  quantity: number;
  unitCost: number | null;
  vendorId: string | null;
  notes: string | null;
  idempotencyKey: string;
}

/** Posts one stock movement (purchase or adjustment). */
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

// ---------------------------------------------------------------- Stock Reconciliation

export async function submitStockReconciliation(
  buildingId: string,
  lines: { itemId: string; expectedQty: number; actualQty: number; notes?: string | null }[],
  notes?: string | null,
  periodStart?: string | null,
  periodEnd?: string | null,
): Promise<string> {
  const recData = {
    building_id: buildingId,
    period_start: periodStart || null,
    period_end: periodEnd || null,
    notes: notes || null,
  };

  try {
    const { data: rec, error: recErr } = await (supabase.from as any)('inventory_reconciliations')
      .insert(recData)
      .select('id')
      .single();

    if (recErr) throw recErr;

    if (lines.length > 0) {
      const lineInserts = lines.map((l) => ({
        reconciliation_id: rec.id,
        item_id: l.itemId,
        expected_qty: l.expectedQty,
        actual_qty: l.actualQty,
        discrepancy: l.actualQty - l.expectedQty,
        notes: l.notes || null,
      }));
      await (supabase.from as any)('inventory_reconciliation_lines').insert(lineInserts);
    }
    return rec.id;
  } catch {
    // Resilient fallback to audit_logs if table not yet active
    const { data: bRow } = await supabase.from('buildings').select('tenant_id').eq('id', buildingId).maybeSingle();
    const id = crypto.randomUUID();
    const tenantId = (bRow as any)?.tenant_id;
    if (tenantId) {
      await supabase.from('audit_logs').insert({
        tenant_id: tenantId,
        actor_type: 'tenant_user',
        action: 'inventory.reconciliation',
        entity_type: 'inventory_reconciliation',
        entity_id: id,
        after_data: {
          ...recData,
          lines,
        },
      });
    }
    return id;
  }
}

export async function listReconciliations(buildingId: string): Promise<any[]> {
  try {
    const recs = await q<any[]>(
      (supabase.from as any)('inventory_reconciliations')
        .select(
          'id,building_id,verified_by,verified_at,period_start,period_end,notes,' +
            'inventory_reconciliation_lines(id,item_id,expected_qty,actual_qty,discrepancy,notes,inventory_items(name,base_unit)),' +
            'profiles:verified_by(full_name)',
        )
        .eq('building_id', buildingId)
        .order('verified_at', { ascending: false })
        .limit(50),
    );
    return recs.map((r) => ({
      id: r.id,
      building_id: r.building_id,
      verified_by: r.verified_by,
      verified_at: r.verified_at,
      period_start: r.period_start,
      period_end: r.period_end,
      notes: r.notes,
      verifier_name: r.profiles?.full_name ?? 'Staff',
      lines: (r.inventory_reconciliation_lines ?? []).map((l: any) => ({
        id: l.id,
        item_id: l.item_id,
        item_name: l.inventory_items?.name,
        base_unit: l.inventory_items?.base_unit,
        expected_qty: Number(l.expected_qty),
        actual_qty: Number(l.actual_qty),
        discrepancy: Number(l.discrepancy),
        notes: l.notes,
      })),
    }));
  } catch {
    // Fallback: check audit_logs
    try {
      const logs = await q<any[]>(
        supabase
          .from('audit_logs')
          .select('id,created_at,actor_user_id,after_data,profiles:actor_user_id(full_name)')
          .eq('action', 'inventory.reconciliation')
          .order('created_at', { ascending: false })
          .limit(50),
      );
      return logs
        .filter((l) => l.after_data?.building_id === buildingId)
        .map((l) => ({
          id: l.id,
          building_id: l.after_data.building_id,
          verified_by: l.actor_user_id,
          verified_at: l.created_at,
          period_start: l.after_data.period_start ?? null,
          period_end: l.after_data.period_end ?? null,
          notes: l.after_data.notes ?? null,
          verifier_name: l.profiles?.full_name ?? 'Staff',
          lines: l.after_data.lines ?? [],
        }));
    } catch {
      return [];
    }
  }
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
