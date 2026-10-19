import { describe, expect, it } from 'vitest';
import { addDays, inr, isoDate, label } from './format';
import { toApiError } from './api';

describe('format', () => {
  it('formats INR with Indian grouping', () => {
    expect(inr(148750)).toBe('₹1,48,750');
    expect(inr(10.5, true)).toBe('₹10.50');
  });
  it('adds days across month boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('isoDate uses the local calendar date', () => {
    expect(isoDate(new Date(2026, 9, 18, 23, 30))).toBe('2026-10-18');
  });
  it('labels snake_case statuses', () => {
    expect(label('partially_paid')).toBe('Partially paid');
  });
});

describe('toApiError', () => {
  it('maps coded database errors to stable app codes', () => {
    const e = toApiError({ message: 'CONFLICT: this bed is already occupied' });
    expect(e.code).toBe('CONFLICT');
    expect(e.message).toBe('this bed is already occupied');
  });
  it('maps permission errors', () => {
    expect(toApiError({ message: 'permission denied for table x', code: '42501' }).code).toBe('FORBIDDEN');
  });
  it('never leaks raw SQL text for unknown errors', () => {
    const e = toApiError({ message: 'relation "secret_table" does not exist', code: '42P01' });
    expect(e.code).toBe('INTERNAL_ERROR');
    expect(e.message).not.toContain('secret_table');
  });
});
