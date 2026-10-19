/** Row shapes for meals (menus, headcounts, reviews) and kitchen inventory. */

export type MealType = 'breakfast' | 'lunch' | 'dinner';

export interface Menu {
  id: string;
  meal_date: string;
  meal_type: MealType;
  items: string;
  serving_start: string | null;
  serving_end: string | null;
  /** Set when a menu was changed at the last minute (residents are notified). */
  change_reason: string | null;
}

/** Result of `meal_count_summary()`: who is eating each meal on one date. */
export interface MealCount {
  date: string;
  /** Active residents on the mess plan. */
  total_residents: number;
  meals: {
    meal_type: MealType;
    /** Residents who marked themselves not eating. Expected = total_residents − not_eating. */
    not_eating: number;
    menu: { id: string; items: string } | null;
    unavailable: { name: string; room: string; bed: string; marked_at: string }[];
    /** Kitchen report for this meal, once recorded. */
    report: { id: string; actual: number } | null;
  }[];
}

export interface MealReview {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  residents: { full_name: string };
  meal_menus: { meal_date: string; meal_type: MealType; items: string };
}

/** One row of the `inventory_stock` view: store + kitchen quantity per item for a building. */
export interface StockRow {
  item_id: string;
  name: string;
  category: string;
  base_unit: string;
  reorder_level: number;
  store_qty: number;
  kitchen_qty: number;
  last_unit_cost: number | null;
  is_active: boolean;
}

export interface StockMovement {
  id: string;
  transaction_type: string;
  quantity: number;
  unit_cost: number | null;
  occurred_at: string;
  notes: string | null;
  inventory_items: { name: string; base_unit: string };
  inventory_locations: { kind: string };
  vendors: { name: string } | null;
}

export interface KitchenReport {
  id: string;
  report_date: string;
  meal_type: string;
  expected_meal_count: number | null;
  actual_meal_count: number | null;
  summary: string | null;
}

/** A stock movement that belongs to a kitchen report (used / wasted / returned). */
export interface KitchenReportLine {
  id: string;
  transaction_type: string;
  quantity: number;
  notes: string | null;
  inventory_items: { name: string; base_unit: string };
}

/** One editable ingredient line in the chef's meal record (quantity as typed). */
export interface IngredientLine {
  item_id: string;
  quantity: string;
  /** Unit the quantity was entered in; defaults to the item's base unit. */
  unit?: string;
  reason?: string;
}

/** A line sent to `submit_kitchen_report`. */
export interface KitchenReportLineInput {
  item_id: string;
  kind: 'consumption' | 'return' | 'wastage';
  quantity: number;
  reason?: string;
}
