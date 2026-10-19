import type { ReceiptRef } from './types';

/** Receipt number from a payment's `receipts` relation, or '—' when there is none. */
export const receiptNo = (r: ReceiptRef) => (Array.isArray(r) ? r[0]?.receipt_number ?? '—' : r?.receipt_number ?? '—');
