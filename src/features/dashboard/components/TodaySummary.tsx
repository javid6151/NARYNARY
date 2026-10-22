/** "Today’s summary" card: pending work counts with links, plus the occupancy meter. */
import { useNavigate } from 'react-router-dom';
import { MessageSquareWarning, Receipt, UserCheck, Wallet, type LucideIcon } from 'lucide-react';
import { inr } from '../../../lib/format';
import { Card } from '../../../components/ui';
import { Meter } from '../../../components/Charts';
import type { DashboardSummary } from '../types';

export function TodaySummary({ s }: { s: DashboardSummary }) {
  const nav = useNavigate();
  const items: { icon: LucideIcon; label: string; value: string | number; to: string }[] = [
    { icon: MessageSquareWarning, label: 'Open complaints', value: s.open_complaints, to: 'complaints' },
    { icon: UserCheck, label: 'Staff on duty today', value: s.staff_on_duty, to: 'staff' },
    { icon: Receipt, label: 'Unpaid expenses', value: inr(s.expenses_unpaid), to: 'expenses' },
    { icon: Wallet, label: 'Expenses this month', value: inr(s.expenses_month), to: 'expenses' },
  ];
  return (
    <Card title="Today’s summary">
      <ul className="divide-y divide-line text-[13px]">
        {items.map(({ icon: I, label, value, to }) => (
          <li key={label}>
            <button onClick={() => nav(to)} className="w-full flex items-center gap-3 py-2.5 hover:text-brand-700 cursor-pointer">
              <I className="size-4 text-muted" aria-hidden />
              <span className="flex-1 text-left">{label}</span>
              <span className="font-semibold tabular">{value}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <Meter value={s.beds_occupied} total={s.beds_total} label="beds occupied" />
      </div>
    </Card>
  );
}
