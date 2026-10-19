/** Payment history table with receipt and (owner-only) reverse actions. */
import { Printer, RotateCcw } from 'lucide-react';
import { fmtDate, inr, label } from '../../../lib/format';
import { Badge, Button, Table, Td } from '../../../components/ui';
import { receiptNo } from '../receipt';
import type { Payment } from '../types';

export function PaymentHistoryTable({ rows, canReverse, onReceipt, onReverse }: {
  rows: Payment[];
  /** Only owners may reverse; the server enforces this too. */
  canReverse: boolean;
  onReceipt: (p: Payment) => void;
  onReverse: (p: Payment) => void;
}) {
  return (
    <Table head={['Date', 'Resident', 'Amount', 'Method', 'Reference', 'Receipt', 'Status', '']}>
      {rows.map((p) => (
        <tr key={p.id} className="hover:bg-subtle/60">
          <Td>{fmtDate(p.paid_at)}</Td>
          <Td className="font-medium">{p.residents.full_name}</Td>
          <Td className="tabular">{inr(p.amount, true)}</Td>
          <Td>{label(p.payment_method)}</Td>
          <Td className="text-muted">{p.transaction_reference ?? '—'}</Td>
          <Td className="tabular">{receiptNo(p.receipts)}</Td>
          <Td>
            <Badge status={p.status === 'confirmed' ? 'paid' : p.status}>{p.status === 'confirmed' ? 'Paid' : undefined}</Badge>
          </Td>
          <Td>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => onReceipt(p)} aria-label="View receipt">
                <Printer className="size-4" />
              </Button>
              {canReverse && p.status === 'confirmed' && (
                <Button variant="ghost" size="sm" onClick={() => onReverse(p)} aria-label="Reverse payment">
                  <RotateCcw className="size-4" />
                </Button>
              )}
            </div>
          </Td>
        </tr>
      ))}
    </Table>
  );
}
