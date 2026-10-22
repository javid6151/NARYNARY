/** Latest rent payments across the selected building(s). */
import { useNavigate } from 'react-router-dom';
import type { AsyncState } from '../../../lib/hooks';
import { fmtDate, inr, label } from '../../../lib/format';
import { Async, Badge, Button, Card, Empty } from '../../../components/ui';
import type { RecentPayment } from '../types';

export function RecentPayments({ state }: { state: AsyncState<RecentPayment[]> }) {
  const nav = useNavigate();
  return (
    <Card title="Recent rent payments" action={<Button variant="ghost" size="sm" onClick={() => nav('payments')}>View all</Button>}>
      <Async state={state}>
        {(rows) =>
          rows.length === 0 ? (
            <Empty title="No payments yet" />
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5 text-[13px]">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{p.residents?.full_name}</p>
                    <p className="text-[12px] text-muted">{fmtDate(p.paid_at)} · {label(p.payment_method)}</p>
                  </div>
                  <span className="tabular font-medium">{inr(p.amount)}</span>
                  <Badge status={p.status === 'confirmed' ? 'paid' : p.status} />
                </li>
              ))}
            </ul>
          )
        }
      </Async>
    </Card>
  );
}
