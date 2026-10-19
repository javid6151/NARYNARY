/**
 * Owner/manager dashboard for the current month: KPI tiles, collections vs expenses chart,
 * today's to-dos, recent payments, open maintenance, expense split, low stock and (owner) activity.
 * Works for one building or "All buildings".
 */
import { useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useAsync } from '../../lib/hooks';
import { useAuth } from '../access/useAuth';
import { useBuilding } from '../access/useBuilding';
import { Async, Button, Card, Empty, PageHeader } from '../../components/ui';
import { BuildingPicker } from '../../components/BuildingPicker';
import { DailyBars, HBars } from '../../components/Charts';
import { listRecentActivity } from '../audit/api';
import { getDashboardSummary, listOpenMaintenance, listRecentPayments } from './api';
import { KpiTiles } from './components/KpiTiles';
import { LowStockAlerts } from './components/LowStockAlerts';
import { OpenMaintenance } from './components/OpenMaintenance';
import { RecentActivity } from './components/RecentActivity';
import { RecentPayments } from './components/RecentPayments';
import { TodaySummary } from './components/TodaySummary';

export default function Dashboard() {
  const { staff } = useAuth();
  const { selected, buildings } = useBuilding();
  const nav = useNavigate();
  const bid = selected === 'all' ? null : selected;
  const sum = useAsync(() => getDashboardSummary(bid), [bid]);
  const ids = bid ? [bid] : buildings.map((b) => b.id);
  // Side lists load in parallel with the summary.
  const payments = useAsync(() => listRecentPayments(ids), [ids.join()]);
  const maint = useAsync(() => listOpenMaintenance(ids), [ids.join()]);
  const activity = useAsync(
    () => (staff?.role === 'owner' ? listRecentActivity(7) : Promise.resolve([])),
    [staff?.role],
  );

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <PageHeader
        title={`${greet}!`}
        subtitle={`Here’s what’s happening at ${staff?.tenant_name} this month.`}
        actions={
          <>
            <BuildingPicker allowAll />
            <Button onClick={() => nav('/app/admissions/new')}>
              <UserPlus className="size-4" />
              New admission
            </Button>
          </>
        }
      />
      <Async state={sum} rows={6}>
        {(s) => (
          <div className="space-y-5">
            <KpiTiles s={s} />

            <div className="grid xl:grid-cols-3 gap-5">
              <Card
                title="Collections vs expenses"
                className="xl:col-span-2"
                action={
                  <span className="text-[12px] text-muted">
                    {new Date(s.period_start + 'T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                  </span>
                }
              >
                {s.daily_collection.some((d) => d.collected || d.spent) ? (
                  <DailyBars data={s.daily_collection} a={{ key: 'collected', label: 'Collected' }} b={{ key: 'spent', label: 'Expenses' }} />
                ) : (
                  <Empty title="No payments or expenses yet this month" />
                )}
              </Card>
              <TodaySummary s={s} />
            </div>

            <div className="grid xl:grid-cols-3 gap-5">
              <RecentPayments state={payments} />
              <OpenMaintenance state={maint} />
              <Card title="Expenses by category">
                {s.expenses_by_category.length === 0 ? (
                  <Empty title="No expenses this month" />
                ) : (
                  <HBars rows={s.expenses_by_category.slice(0, 6).map((e) => ({ name: e.name, value: Number(e.amount) }))} />
                )}
              </Card>
            </div>

            <div className="grid xl:grid-cols-2 gap-5">
              <LowStockAlerts items={s.low_stock} />
              {staff?.role === 'owner' && <RecentActivity state={activity} />}
            </div>
          </div>
        )}
      </Async>
    </>
  );
}
