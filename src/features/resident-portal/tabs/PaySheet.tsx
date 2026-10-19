/**
 * "Pay Now" sheet. There is no online payment gateway yet, so this shows exactly what is due and how
 * to pay the PG; the office records the payment and the receipt then appears under Payments → History.
 */
import { useNavigate } from 'react-router-dom';
import { Banknote, Building2, Smartphone } from 'lucide-react';
import { useAsync } from '../../../lib/hooks';
import { fmtDate, inr, isoDate } from '../../../lib/format';
import { Async, Badge, Button, Drawer } from '../../../components/ui';
import { listMyCharges } from '../api';
import { openCharges } from '../money';
import type { ResidentProfile } from '../types';

const METHODS = [
  { icon: Smartphone, label: 'UPI', text: 'Pay to the PG’s UPI ID and share the transaction ID with the office.' },
  { icon: Building2, label: 'Bank transfer', text: 'Transfer to the PG’s bank account and share the UTR number.' },
  { icon: Banknote, label: 'Cash', text: 'Pay at the PG office and collect your receipt.' },
];

export function PaySheet({ p, onClose }: { p: ResidentProfile; onClose: () => void }) {
  const nav = useNavigate();
  const dues = useAsync(() => listMyCharges(), []);
  const open = openCharges(dues.data ?? []).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const total = open.reduce((s, c) => s + Number(c.balance), 0);
  const today = isoDate();

  const footer = (
    <Button
      onClick={() => {
        onClose();
        nav('/resident/payments');
      }}
    >
      View all payments
    </Button>
  );

  return (
    <Drawer open onClose={onClose} title="Pay rent & dues" footer={footer}>
      <div className="rounded-xl bg-brand-50 p-4">
        <p className="text-[13px] text-ink-2">Total outstanding</p>
        <p className="text-[28px] font-bold text-brand-700 tabular">{inr(total, true)}</p>
        <p className="text-[12px] text-muted">Payable to {p.business_name}</p>
      </div>
      <Async state={dues} rows={2}>
        {() =>
          open.length === 0 ? (
            <p className="text-[13px] text-ok">You have no pending dues. Your next rent will appear here once it is billed.</p>
          ) : (
            <ul className="divide-y divide-line text-[13px]">
              {open.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block font-medium truncate">{c.description}</span>
                    <span className="text-[12px] text-muted">Due {fmtDate(c.due_date)}</span>
                  </span>
                  <span className="text-right">
                    <span className="block tabular font-semibold">{inr(c.balance, true)}</span>
                    {c.due_date < today ? <Badge status="overdue" /> : <Badge status="unpaid">Due</Badge>}
                  </span>
                </li>
              ))}
            </ul>
          )
        }
      </Async>
      <div>
        <p className="text-[14px] font-semibold mb-2">How to pay</p>
        <ul className="space-y-2">
          {METHODS.map(({ icon: Icon, label, text }) => (
            <li key={label} className="flex gap-3 rounded-xl border border-line p-3">
              <Icon className="size-5 text-brand-600 shrink-0 mt-0.5" aria-hidden />
              <span>
                <span className="block text-[13.5px] font-medium">{label}</span>
                <span className="text-[12.5px] text-muted">{text}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="text-[12px] text-muted mt-3">
          Online payment inside the app is not available yet. Once the PG records your payment, the receipt appears under
          Payments → History and your dues update automatically.
        </p>
      </div>
    </Drawer>
  );
}
