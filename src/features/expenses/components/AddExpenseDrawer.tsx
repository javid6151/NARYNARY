/**
 * Form to add an expense (optionally linked to a maintenance request) with an optional invoice
 * and optional first payment. The expense is saved first, then the invoice is uploaded.
 */
import { useRef, useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import { ApiError, newKey } from '../../../lib/api';
import { useAsync, useMutation } from '../../../lib/hooks';
import { inr, isoDate } from '../../../lib/format';
import { useBuilding } from '../../access/useBuilding';
import { Button, Drawer, ErrorBanner, Field, Input, Select, Textarea } from '../../../components/ui';
import { uploadFile } from '../../files/api';
import { ACCEPT, fileError, fmtBytes } from '../../files/rules';
import { createExpense, listActiveVendors, listExpenseCategories } from '../api';

export function AddExpenseDrawer({ open, onClose, onDone, maintenance }: {
  open: boolean;
  onClose: () => void;
  onDone: (m: string) => void;
  /** When set, the expense is a maintenance cost linked to this request. */
  maintenance?: { id: string; title: string };
}) {
  const { buildingId } = useBuilding();
  const cats = useAsync(() => listExpenseCategories(), []);
  const vendors = useAsync(() => listActiveVendors(), [open]);
  const [f, setF] = useState({
    title: maintenance ? `Repair — ${maintenance.title}` : '',
    category: '',
    vendor: '',
    date: isoDate(),
    due: '',
    subtotal: '',
    tax: '0',
    description: '',
    paid: '',
    method: 'upi',
    reference: '',
  });
  const [key, setKey] = useState(newKey);
  const [invoice, setInvoice] = useState<File | null>(null);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // create_expense is idempotent on `key`, so retrying after a failed upload does not duplicate the expense.
  const m = useMutation(async () => {
    const id = await createExpense({
      buildingId,
      categoryId: f.category,
      title: f.title,
      description: f.description || null,
      expenseDate: f.date,
      dueDate: f.due || null,
      subtotal: Number(f.subtotal),
      tax: Number(f.tax || 0),
      vendorId: f.vendor || null,
      sourceType: maintenance ? 'maintenance' : 'general',
      sourceId: maintenance?.id ?? null,
      initialPayment: Number(f.paid) > 0 ? { amount: Number(f.paid), method: f.method, reference: f.reference } : null,
      idempotencyKey: key,
    });
    if (invoice) {
      try {
        await uploadFile('expense_invoice', id, invoice);
      } catch (e) {
        throw new ApiError(
          (e as ApiError).code ?? 'INTERNAL_ERROR',
          `Expense saved, but the invoice did not upload: ${(e as Error).message} Save again to retry.`,
        );
      }
    }
    return id;
  });

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const total = Number(f.subtotal || 0) + Number(f.tax || 0);
  const catRows = (cats.data ?? []).filter((c) => !maintenance || c.is_maintenance);

  const save = async () => {
    if (await m.run()) {
      // New intent → new idempotency key.
      setKey(newKey());
      setInvoice(null);
      setF({ ...f, title: '', subtotal: '', tax: '0', paid: '', reference: '', description: '' });
      onDone('Expense saved');
    }
  };

  const pickInvoice = (file: File | undefined) => {
    if (!file) return;
    const err = fileError(file);
    setFileErr(err);
    if (!err) setInvoice(file);
  };

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button busy={m.busy} disabled={!f.title || !f.category || !(Number(f.subtotal) > 0)} onClick={save}>Save expense</Button>
    </>
  );

  return (
    <Drawer open={open} onClose={onClose} title={maintenance ? 'Add maintenance expense' : 'Add expense'} footer={footer}>
      <ErrorBanner error={m.error} />
      {maintenance && (
        <p className="rounded-lg bg-subtle px-3 py-2 text-[13px]">
          Linked to request: <b>{maintenance.title}</b>
        </p>
      )}
      <Field label="Title" required>
        {(id) => <Input id={id} value={f.title} onChange={set('title')} placeholder="e.g. Water bill — October" />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category" required>
          {(id) => (
            <Select id={id} value={f.category} onChange={set('category')}>
              <option value="">Select</option>
              {catRows.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Vendor">
          {(id) => (
            <Select id={id} value={f.vendor} onChange={set('vendor')}>
              <option value="">None</option>
              {(vendors.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Expense date" required>{(id) => <Input id={id} type="date" value={f.date} onChange={set('date')} />}</Field>
        <Field label="Due date">{(id) => <Input id={id} type="date" value={f.due} onChange={set('due')} />}</Field>
        <Field label="Amount before tax (₹)" required>
          {(id) => <Input id={id} type="number" min={0} step="0.01" value={f.subtotal} onChange={set('subtotal')} />}
        </Field>
        <Field label="Tax (₹)">
          {(id) => <Input id={id} type="number" min={0} step="0.01" value={f.tax} onChange={set('tax')} />}
        </Field>
      </div>
      <p className="text-[13px]">
        Total: <b className="tabular">{inr(total, true)}</b>
      </p>
      <Field label="Description">{(id) => <Textarea id={id} value={f.description} onChange={set('description')} />}</Field>

      <div className="space-y-1.5">
        <p className="text-[13px] font-medium text-ink-2">Invoice / bill</p>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            pickInvoice(file);
          }}
        />
        {invoice ? (
          <div className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-[13px]">
            <Paperclip className="size-4 text-muted" aria-hidden />
            <span className="flex-1 truncate">{invoice.name} · {fmtBytes(invoice.size)}</span>
            <button
              type="button"
              className="p-1 rounded hover:bg-subtle cursor-pointer"
              aria-label="Remove invoice"
              onClick={() => setInvoice(null)}
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()}>
            <Paperclip className="size-4" />
            Attach invoice
          </Button>
        )}
        {fileErr ? (
          <p className="text-[12px] text-bad" role="alert">{fileErr}</p>
        ) : (
          <p className="text-[12px] text-muted">Optional. PDF, JPG, PNG or WEBP up to 5 MB.</p>
        )}
      </div>

      <fieldset className="rounded-lg border border-line p-3 space-y-3">
        <legend className="text-[13px] font-medium px-1">Initial payment (optional)</legend>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount paid (₹)">
            {(id) => <Input id={id} type="number" min={0} max={total} value={f.paid} onChange={set('paid')} />}
          </Field>
          <Field label="Method" required={Number(f.paid) > 0}>
            {(id) => (
              <Select id={id} value={f.method} onChange={set('method')}>
                <option value="upi">UPI</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="cheque">Cheque</option>
                <option value="card">Card</option>
              </Select>
            )}
          </Field>
        </div>
        <Field label="Transaction reference">{(id) => <Input id={id} value={f.reference} onChange={set('reference')} />}</Field>
      </fieldset>
    </Drawer>
  );
}
