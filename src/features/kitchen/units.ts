/**
 * Unit handling for kitchen quantities. Stock is always stored in each item's base unit
 * (kg, g, litre, ml, piece …); the chef may enter a compatible unit (e.g. g for a kg item)
 * and the quantity is converted to the base unit before it is sent to the server.
 */

/** Size of each unit in its dimension's smallest unit (g for mass, ml for volume). */
const MASS: Record<string, number> = { g: 1, kg: 1000 };
const VOLUME: Record<string, number> = { ml: 1, litre: 1000 };

const dimension = (unit: string) => (unit in MASS ? MASS : unit in VOLUME ? VOLUME : null);

/** Units the chef can choose for an item stored in `baseUnit` (base unit first). */
export function unitOptions(baseUnit: string): string[] {
  const dim = dimension(baseUnit);
  return dim ? [baseUnit, ...Object.keys(dim).filter((u) => u !== baseUnit)] : [baseUnit];
}

/** Converts `qty` in `unit` to the item's `baseUnit` (rounded to 3 decimals, the ledger's precision). */
export function toBase(qty: number, unit: string, baseUnit: string): number {
  if (unit === baseUnit) return qty;
  const dim = dimension(baseUnit);
  if (!dim || !(unit in dim)) throw new Error(`Cannot convert ${unit} to ${baseUnit}`);
  return Math.round(((qty * dim[unit]) / dim[baseUnit]) * 1000) / 1000;
}

/**
 * Human total of quantities in mixed base units, grouped by dimension:
 * mass in kg, volume in ml (litre from 1000 ml), anything else per unit — e.g. "13.4 kg / 700 ml".
 */
export function formatTotals(lines: { qty: number; baseUnit: string }[]): string {
  let grams = 0;
  let ml = 0;
  const other: Record<string, number> = {};
  for (const { qty, baseUnit } of lines) {
    if (baseUnit in MASS) grams += qty * MASS[baseUnit];
    else if (baseUnit in VOLUME) ml += qty * VOLUME[baseUnit];
    else other[baseUnit] = (other[baseUnit] ?? 0) + qty;
  }
  const r = (n: number) => String(Math.round(n * 1000) / 1000);
  const parts: string[] = [];
  if (grams) parts.push(`${r(grams / 1000)} kg`);
  if (ml) parts.push(ml >= 1000 ? `${r(ml / 1000)} litre` : `${r(ml)} ml`);
  for (const [u, n] of Object.entries(other)) parts.push(`${r(n)} ${u}`);
  return parts.join(' / ') || '0';
}
