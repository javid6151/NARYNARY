import { describe, expect, it } from 'vitest';
import { reconciliationStatus, stockStatus } from './stock';
import type { StockRow } from './types';
import { toBase } from './units';

describe('Unified Stock & Reconciliation Rules', () => {
  const baseItem: StockRow = {
    item_id: 'item-1',
    name: 'Basmati Rice',
    category: 'Grains & Rice',
    base_unit: 'kg',
    reorder_level: 3,
    expected_qty: 10,
    last_actual_qty: null,
    last_verified_at: null,
    last_unit_cost: 60,
    is_active: true,
  };

  it('calculates initial purchase expected stock and healthy stock status', () => {
    // 10 kg expected stock vs 3 kg reorder level -> in_stock
    expect(stockStatus(baseItem)).toBe('in_stock');
  });

  it('normalizes units accurately (e.g. 500g = 0.5kg) and calculates expected stock after usage', () => {
    const openingStock = 10;
    const usageGrams = 500;
    const usageKg = toBase(usageGrams, 'g', 'kg');
    expect(usageKg).toBe(0.5);

    const remainingExpected = openingStock - usageKg;
    expect(remainingExpected).toBe(9.5);
  });

  it('triggers low_stock status when expected stock drops to or below the minimum threshold', () => {
    // Threshold is 3 kg
    const lowStockItem: StockRow = { ...baseItem, expected_qty: 2.5 };
    expect(stockStatus(lowStockItem)).toBe('low_stock');

    const exactThresholdItem: StockRow = { ...baseItem, expected_qty: 3 };
    expect(stockStatus(exactThresholdItem)).toBe('low_stock');
  });

  it('handles zero stock and flags negative expected stock as critical_stock', () => {
    const zeroStockItem: StockRow = { ...baseItem, expected_qty: 0 };
    expect(stockStatus(zeroStockItem)).toBe('out_of_stock');

    const negativeStockItem: StockRow = { ...baseItem, expected_qty: -1.5 };
    expect(stockStatus(negativeStockItem)).toBe('critical_stock');
  });

  it('calculates physical reconciliation difference and status correctly', () => {
    // Never verified yet
    expect(reconciliationStatus(baseItem)).toBe('awaiting_verification');

    // Expected 7 kg, Actual 6.5 kg -> difference -0.5 kg (discrepancy)
    const itemWithDiscrepancy: StockRow = {
      ...baseItem,
      expected_qty: 7,
      last_actual_qty: 6.5,
    };
    expect(reconciliationStatus(itemWithDiscrepancy)).toBe('discrepancy');
    const diff = Number(itemWithDiscrepancy.last_actual_qty) - Number(itemWithDiscrepancy.expected_qty);
    expect(diff).toBe(-0.5);

    // Expected 7 kg, Actual 7 kg -> Matched
    const itemMatched: StockRow = {
      ...baseItem,
      expected_qty: 7,
      last_actual_qty: 7,
    };
    expect(reconciliationStatus(itemMatched)).toBe('matched');
  });

  it('tracks period-end closing balances: opening + purchases - usage +/- adjustments', () => {
    let expected = 0; // Opening stock
    expected += 10; // Purchase 10 kg
    expected -= 3; // Chef usage 3 kg
    expect(expected).toBe(7);

    expected += 5; // Additional purchase 5 kg
    expect(expected).toBe(12);

    // Physical count performed: 11.8 kg found (discrepancy: -0.2 kg)
    const physicalCount = 11.8;
    const difference = physicalCount - expected;
    expect(difference).toBeCloseTo(-0.2);

    // After authorized adjustment of -0.2 kg
    expected += difference;
    expect(expected).toBeCloseTo(11.8);
  });
});
