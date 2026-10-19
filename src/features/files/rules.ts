/**
 * Upload kinds and client-side file rules. The database (`begin_upload`) and the storage
 * buckets enforce the same type/size limits; these checks only give faster feedback.
 */

export type UploadKind = 'resident_document' | 'expense_invoice' | 'maintenance_attachment';

/** Private bucket per upload kind (see migration 13). */
export const BUCKET: Record<UploadKind, string> = {
  resident_document: 'resident-documents',
  expense_invoice: 'expense-invoices',
  maintenance_attachment: 'maintenance-attachments',
};

export const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
/** Value for `<input type="file" accept>`. */
export const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,' + ALLOWED_TYPES.join(',');
export const MAX_BYTES = 5 * 1024 * 1024;

/** KYC document types offered in the UI. */
export const DOC_TYPES = [
  { id: 'id_proof', label: 'ID proof' },
  { id: 'address_proof', label: 'Address proof' },
  { id: 'photo', label: 'Photo' },
  { id: 'guardian_id', label: 'Guardian ID' },
  { id: 'other', label: 'Other' },
];

/** Client-side pre-check; returns a message for the first rule the file breaks, or null. */
export function fileError(f: File): string | null {
  if (!ALLOWED_TYPES.includes(f.type)) return `${f.name}: only PDF, JPG, PNG or WEBP files are allowed`;
  if (f.size > MAX_BYTES) return `${f.name}: file must be smaller than 5 MB`;
  if (f.size === 0) return `${f.name}: file is empty`;
  return null;
}

export const fmtBytes = (n: number | null | undefined) =>
  !n ? '—' : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
