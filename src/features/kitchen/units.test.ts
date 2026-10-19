import { describe, expect, it } from 'vitest';
import { formatTotals, toBase, unitOptions } from './units';

describe('kitchen units', () => {
  it('offers compatible units with the base unit first', () => {
    expect(unitOptions('kg')).toEqual(['kg', 'g']);
    expect(unitOptions('litre')).toEqual(['litre', 'ml']);
    expect(unitOptions('piece')).toEqual(['piece']);
  });

  it('converts entered quantities to the base unit', () => {
    expect(toBase(200, 'g', 'kg')).toBe(0.2);
    expect(toBase(500, 'ml', 'litre')).toBe(0.5);
    expect(toBase(1.5, 'kg', 'g')).toBe(1500);
    expect(toBase(3, 'piece', 'piece')).toBe(3);
    expect(() => toBase(1, 'ml', 'kg')).toThrow();
  });

  it('formats mixed totals by dimension', () => {
    expect(formatTotals([{ qty: 8, baseUnit: 'kg' }, { qty: 0.05, baseUnit: 'kg' }, { qty: 0.5, baseUnit: 'litre' }])).toBe('8.05 kg / 500 ml');
    expect(formatTotals([{ qty: 1.2, baseUnit: 'litre' }])).toBe('1.2 litre');
    expect(formatTotals([{ qty: 6, baseUnit: 'piece' }])).toBe('6 piece');
    expect(formatTotals([])).toBe('0');
  });
});
