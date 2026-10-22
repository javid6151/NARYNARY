/**
 * Resident profile drawer with tabs (overview, KYC documents, charges, payments, complaints)
 * and the actions record payment / edit / checkout for active residents.
 */
import { useState } from 'react';
import { LogOut as CheckoutIcon, Pencil, Wallet } from 'lucide-react';
import { useAsync } from '../../../lib/hooks';
import { fmtDate, inr, label } from '../../../lib/format';
import { Async, Avatar, Badge, Button, Drawer, Empty, Table, Tabs, Td } from '../../../components/ui';
import { ResidentDocuments } from '../../files/components/ResidentDocuments';
import { RecordPaymentDrawer } from '../../billing/components/RecordPaymentDrawer';
import { receiptNo } from '../../billing/receipt';
import { getResident, listResidentCharges, listResidentComplaints, listResidentPayments } from '../api';
import type { ResidentRow } from '../types';
import { CheckoutDialog } from './CheckoutDialog';
import { EditResident } from './EditResident';
import { ResidentOverview } from './ResidentOverview';

type Tab = 'overview' | 'documents' | 'charges' | 'payments' | 'complaints';

export function ResidentDrawer({ r, onClose, onChanged }: { r: ResidentRow; onClose: () => void; onChanged: (m: string) => void }) {
  const [tab, setTab] = useState<Tab>('overview');
  const [edit, setEdit] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [pay, setPay] = useState(false);
  // Charges/payments reload when the outstanding amount changes (after a payment).
  const charges = useAsync(() => listResidentCharges(r.id), [r.id, r.outstanding]);
  const payments = useAsync(() => listResidentPayments(r.id), [r.id, r.outstanding]);
  const complaints = useAsync(() => listResidentComplaints(r.id), [r.id]);
  const detail = useAsync(() => getResident(r.id), [r.id, edit]);

  return (
    <Drawer open onClose={onClose} title="Resident profile" wide>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={r.full_name} size={56} />
        <div className="flex-1 min-w-0">
          <p className="text-lg font-semibold">
            {r.full_name} <Badge status={r.status} />
          </p>
          <p className="text-[13px] text-muted">
            {r.room_number ? `Room ${r.room_number} · Bed ${r.bed_label} · ` : ''}
            {r.phone}
          </p>
        </div>
        {r.status === 'active' && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setPay(true)}>
              <Wallet className="size-4" />
              Record payment
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setEdit(true)}>
              <Pencil className="size-4" />
              Edit
            </Button>
            <Button size="sm" variant="danger" onClick={() => setCheckout(true)}>
              <CheckoutIcon className="size-4" />
              Checkout
            </Button>
          </div>
        )}
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'documents', label: 'Documents' },
          { id: 'charges', label: 'Charges' },
          { id: 'payments', label: 'Payments' },
          { id: 'complaints', label: 'Complaints' },
        ]}
      />

      {tab === 'overview' && <Async state={detail}>{(d) => <ResidentOverview r={r} details={d} />}</Async>}

      {tab === 'documents' && <ResidentDocuments residentId={r.id} canEdit />}

      {tab === 'charges' && (
        <Async state={charges}>
          {(cs) =>
            cs.length === 0 ? (
              <Empty title="No charges" />
            ) : (
              <Table head={['Charge', 'Due', 'Amount', 'Paid', 'Status']}>
                {cs.map((c) => (
                  <tr key={c.id}>
                    <Td>{c.description}</Td>
                    <Td>{fmtDate(c.due_date)}</Td>
                    <Td className="tabular">{inr(c.amount)}</Td>
                    <Td className="tabular">{inr(c.paid_amount)}</Td>
                    <Td><Badge status={c.status} /></Td>
                  </tr>
                ))}
              </Table>
            )
          }
        </Async>
      )}

      {tab === 'payments' && (
        <Async state={payments}>
          {(ps) =>
            ps.length === 0 ? (
              <Empty title="No payments yet" />
            ) : (
              <Table head={['Date', 'Amount', 'Method', 'UTR / Ref', 'Receipt', 'Status']}>
                {ps.map((p) => (
                  <tr key={p.id}>
                    <Td>{fmtDate(p.paid_at)}</Td>
                    <Td className="tabular font-medium">{inr(p.amount)}</Td>
                    <Td>{label(p.payment_method)}</Td>
                    <Td className="tabular font-mono text-xs">{p.transaction_reference || '—'}</Td>
                    <Td className="tabular font-mono text-xs">{receiptNo(p.receipts)}</Td>
                    <Td><Badge status={p.status === 'confirmed' ? 'paid' : p.status} /></Td>
                  </tr>
                ))}
              </Table>
            )
          }
        </Async>
      )}

      {tab === 'complaints' && (
        <Async state={complaints}>
          {(cs) =>
            cs.length === 0 ? (
              <Empty title="No complaints" />
            ) : (
              <ul className="divide-y divide-line text-[13px]">
                {cs.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-2.5">
                    <span className="flex-1">
                      {c.title}
                      <span className="text-muted"> · {fmtDate(c.submitted_at)}</span>
                    </span>
                    <Badge status={c.priority} />
                    <Badge status={c.status} />
                  </li>
                ))}
              </ul>
            )
          }
        </Async>
      )}

      {edit && detail.data && (
        <EditResident
          data={detail.data}
          onClose={() => setEdit(false)}
          onSaved={() => {
            setEdit(false);
            onChanged('Resident details saved');
          }}
        />
      )}
      <CheckoutDialog
        bed={checkout ? { admission_id: r.admission_id, resident_name: r.full_name } : null}
        onClose={() => setCheckout(false)}
        onDone={(m) => {
          setCheckout(false);
          onChanged(m);
          onClose();
        }}
      />
      <RecordPaymentDrawer
        open={pay}
        resident={{ id: r.id, full_name: r.full_name }}
        onClose={() => setPay(false)}
        onDone={(m) => {
          setPay(false);
          onChanged(m);
        }}
      />
    </Drawer>
  );
}
