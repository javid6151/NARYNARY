import { isoDate } from '../../lib/format';

/** Payment status of an expense: paid, overdue (past due date), partially_paid or unpaid. */
export const payStatus = (e: { total_amount: number; paid_amount: number; due_date: string | null }) =>
  Number(e.paid_amount) >= Number(e.total_amount)
    ? 'paid'
    : e.due_date && e.due_date < isoDate()
      ? 'overdue'
      : Number(e.paid_amount) > 0
        ? 'partially_paid'
        : 'unpaid';
