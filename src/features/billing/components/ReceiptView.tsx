/** Printable payment receipt (browser print). */
import { Printer } from 'lucide-react';
import { fmtDateTime, inr, label } from '../../../lib/format';
import { Button, Drawer } from '../../../components/ui';
import { receiptNo } from '../receipt';
import type { Payment } from '../types';

export function ReceiptView({ p, building, tenant, onClose }: { p: Payment; building: string; tenant: string; onClose: () => void }) {
  const footer = (
    <Button onClick={() => window.print()}>
      <Printer className="size-4" />
      Print
    </Button>
  );
  return (
    <Drawer open onClose={onClose} title="Payment receipt" footer={footer}>
      <div id="receipt" className="rounded-xl border border-line p-5 text-[13px] space-y-3 print:border-0">
        <div className="flex justify-between">
          <div>
            <p className="font-semibold text-base">{tenant}</p>
            <p className="text-muted">{building}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold">Receipt</p>
            <p className="tabular">{receiptNo(p.receipts)}</p>
          </div>
        </div>
        <hr className="border-line" />
        <dl className="grid grid-cols-2 gap-y-2">
          <dt className="text-muted">Received from</dt>
          <dd className="text-right font-medium">{p.residents.full_name}</dd>
          <dt className="text-muted">Amount</dt>
          <dd className="text-right font-semibold tabular">{inr(p.amount, true)}</dd>
          <dt className="text-muted">Method</dt>
          <dd className="text-right">{label(p.payment_method)}</dd>
          <dt className="text-muted">Reference</dt>
          <dd className="text-right">{p.transaction_reference ?? '—'}</dd>
          <dt className="text-muted">Date</dt>
          <dd className="text-right">{fmtDateTime(p.paid_at)}</dd>
          <dt className="text-muted">Status</dt>
          <dd className="text-right">{p.status === 'reversed' ? `Reversed — ${p.reversal_reason}` : 'Paid'}</dd>
        </dl>
      </div>
    </Drawer>
  );
}
