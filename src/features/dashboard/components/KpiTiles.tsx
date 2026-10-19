/** The six headline KPI tiles; each links to the page that explains the number. */
import { useNavigate } from 'react-router-dom';
import { AlertCircle, BedDouble, Package, Users, Wallet, Wrench } from 'lucide-react';
import { inr } from '../../../lib/format';
import { StatCard } from '../../../components/ui';
import type { DashboardSummary } from '../types';

export function KpiTiles({ s }: { s: DashboardSummary }) {
  const nav = useNavigate();
  const occupancy = s.beds_total ? Math.round((s.beds_occupied / s.beds_total) * 100) : 0;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      <StatCard
        icon={<Users className="size-5" />}
        label="Active residents"
        value={s.residents_active}
        hint={`${s.new_residents_month} joined this month`}
        onClick={() => nav('/app/residents')}
      />
      <StatCard
        icon={<Wallet className="size-5" />}
        tone="ok"
        label="Collected this month"
        value={inr(s.collected_month)}
        hint={`${inr(s.billed_month)} fell due this month`}
        onClick={() => nav('/app/payments')}
      />
      <StatCard
        icon={<AlertCircle className="size-5" />}
        tone="bad"
        label="Pending dues"
        value={inr(s.outstanding_total)}
        hint={`${inr(s.overdue_total)} overdue · ${s.overdue_residents} residents`}
        onClick={() => nav('/app/payments')}
      />
      <StatCard
        icon={<BedDouble className="size-5" />}
        tone="info"
        label="Occupancy"
        value={`${occupancy}%`}
        hint={`${s.beds_total - s.beds_occupied} beds vacant`}
        onClick={() => nav('/app/buildings')}
      />
      <StatCard
        icon={<Wrench className="size-5" />}
        tone="warn"
        label="Open maintenance"
        value={s.open_maintenance}
        hint={`${s.open_complaints} open complaints`}
        onClick={() => nav('/app/maintenance')}
      />
      <StatCard
        icon={<Package className="size-5" />}
        tone="bad"
        label="Low stock items"
        value={s.low_stock.length}
        hint="At or below reorder level"
        onClick={() => nav('/app/inventory')}
      />
    </div>
  );
}
