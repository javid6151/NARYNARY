/** Resident money helpers: open charges, next rent due, advance balance and payment titles. */
import { addDays, isoDate } from '../../lib/format';
import type { MyCharge, MyPayment } from './types';

/** Charges that still have a balance. */
export const openCharges = (charges: MyCharge[]) => charges.filter((c) => ['unpaid', 'partially_paid'].includes(c.status));

/**
 * The next rent the resident has to pay: the oldest open rent charge if there is one; otherwise the
 * upcoming month's rent, which the PG bills for the 1st and which falls due on the 5th.
 */
export function nextRentDue(charges: MyCharge[], monthlyRent: number): { amount: number; dueDate: string; billed: boolean } {
  const open = openCharges(charges)
    .filter((c) => c.charge_type === 'rent')
    .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
  if (open) return { amount: Number(open.balance), dueDate: open.due_date, billed: true };
  const today = isoDate();
  const firstOfNext = (() => {
    const d = new Date(today + 'T00:00:00');
    return isoDate(new Date(d.getFullYear(), d.getMonth() + 1, 1));
  })();
  return { amount: Number(monthlyRent), dueDate: addDays(firstOfNext, 4), billed: false };
}

/** Money paid but not applied to any charge yet (kept by the PG as an advance). */
export const advanceBalance = (payments: MyPayment[]) =>
  payments
    .filter((p) => p.status === 'confirmed')
    .reduce((s, p) => s + Number(p.amount) - p.payment_allocations.reduce((a, x) => a + Number(x.allocated_amount), 0), 0);

/** What a payment was for, e.g. "Rent Oct 2026" or "Rent Oct 2026 + 2 more"; "Advance payment" if unallocated. */
export function paymentTitle(p: MyPayment) {
  const names = p.payment_allocations.map((a) => a.rent_charges?.description).filter(Boolean) as string[];
  if (!names.length) return 'Advance payment';
  return names.length === 1 ? names[0] : `${names[0]} + ${names.length - 1} more`;
}
