/**
 * ZIPNARY Owner Dashboard — Premium Enterprise Redesign.
 * Reconstructed with inspiration from the reference layout and resident portal visual language:
 * - Photographic Welcome Hero with embedded building picker & date selector
 * - 5 Headline Business KPI cards with circular progress donut
 * - Revenue Overview bar chart with interactive tooltip
 * - Occupancy by Building donut meter & breakdown
 * - Recent Activities feed with categorical action icons
 * - Pending Admissions card with quick Approve / Reject actions
 * - Recent Complaints card with priority tags
 * - "Better Managed Spaces" operational promo card
 * - Quick Actions bar for mobile and desktop
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { useAsync } from '../../lib/hooks';
import { useAuth } from '../access/useAuth';
import { useBuilding } from '../access/useBuilding';
import { Async, Button, Card, Empty, Toast } from '../../components/ui';
import { BuildingPicker } from '../../components/BuildingPicker';
import { listRecentActivity } from '../audit/api';
import { getDashboardSummary } from './api';
import { listAdmissions } from '../residents/api';
import { listComplaints } from '../maintenance/api';
import { getBuildingLayout } from '../property/api';
import { KpiTiles } from './components/KpiTiles';
import { RevenueOverviewChart } from './components/RevenueOverviewChart';
import { OccupancyByBuilding } from './components/OccupancyByBuilding';
import { RecentActivity } from './components/RecentActivity';
import { RecentAdmissionsCard } from './components/RecentAdmissionsCard';
import { RecentComplaintsCard } from './components/RecentComplaintsCard';
import { PromoCard } from './components/PromoCard';
import { QuickActions } from './components/QuickActions';
import { LowStockAlerts } from './components/LowStockAlerts';
import { VacantRoomsModal } from '../property/components/VacantRoomsModal';
import { HBars } from '../../components/Charts';
import type { Complaint } from '../maintenance/types';

export default function Dashboard() {
  const { staff, access, profile, session } = useAuth();
  const { selected, buildings } = useBuilding();
  const [vacantModalOpen, setVacantModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const nav = useNavigate();

  const bid = selected === 'all' ? null : selected;
  const targetBuildingId = bid || buildings[0]?.id || null;

  // Main Summary RPC
  const sum = useAsync(() => getDashboardSummary(bid), [bid]);

  // Vacant Rooms Count across selected building or all buildings
  const vacantRooms = useAsync(async () => {
    const bIds = selected === 'all' ? buildings.map((b) => b.id) : targetBuildingId ? [targetBuildingId] : [];
    if (bIds.length === 0) return 0;
    let count = 0;
    for (const bId of bIds) {
      try {
        const layout = await getBuildingLayout(bId);
        for (const f of layout || []) {
          for (const r of f.rooms || []) {
            if (r.beds.some((b) => !b.resident_id && !b.pending_admission && b.status === 'active')) {
              count++;
            }
          }
        }
      } catch {}
    }
    return count;
  }, [selected, targetBuildingId, buildings]);

  const activity = useAsync(
    () => (staff?.role === 'owner' ? listRecentActivity(7) : Promise.resolve([])),
    [staff?.role],
  );

  // Admissions and Complaints for the Lower Section
  const admissions = useAsync(
    () => listAdmissions(bid),
    [bid],
  );
  const complaints = useAsync(
    () => (targetBuildingId ? listComplaints(targetBuildingId) : Promise.resolve([] as Complaint[])),
    [targetBuildingId],
  );

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const ownerGreetingName =
    profile?.full_name ||
    session?.user?.user_metadata?.full_name ||
    session?.user?.user_metadata?.name ||
    (access?.is_platform_admin ? 'ZIPCO Admin' : 'Owner');

  const currentMonthName = new Date().toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* 1. HERO WELCOME SECTION (Photo Background + Gradient Overlay) */}
      <div className="owner-hero-banner p-6 sm:p-8 rounded-3xl text-white relative flex flex-col justify-between min-h-[170px] shadow-md border border-[#DED6CB]/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 z-10">
          <div>
            <span className="text-xs sm:text-sm font-medium tracking-wide text-white/80 block">
              {greeting},
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-0.5 leading-tight">
              {ownerGreetingName}
            </h1>
            <p className="text-xs sm:text-sm text-white/75 mt-1 font-normal">
              Manage your PG business with ease.
            </p>
          </div>

          {/* Embedded Hero Controls (Building Selector + Date Pill) */}
          <div className="flex flex-wrap items-center gap-2.5 z-30 relative self-start md:self-auto">
            <BuildingPicker allowAll />

            <div className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-[#FFFEFC] hover:bg-[#ECE5DA] text-[#30271F] font-semibold text-xs border border-[#DED6CB] shadow-2xs transition-colors">
              <Calendar className="size-3.5 text-[#343B2B]" />
              <span>{currentMonthName}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. QUICK ACTIONS BAR (Mobile & Tablet Priority) */}
      <div className="block lg:hidden">
        <QuickActions onRoomStatus={() => setVacantModalOpen(true)} />
      </div>

      {/* 3. BUSINESS KPI CARDS (4 Cards) */}
      <Async state={sum} rows={6}>
        {(s) => (
          <div className="space-y-6">
            <KpiTiles
              s={s}
              vacantRoomsCount={vacantRooms.data}
              onVacantRooms={() => setVacantModalOpen(true)}
            />

            {/* 4. MIDDLE ROW: Revenue Overview + Occupancy + Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-1">
                <RevenueOverviewChart dailyCollection={s.daily_collection} periodStart={s.period_start} />
              </div>

              <div className="lg:col-span-1">
                <OccupancyByBuilding
                  buildings={buildings}
                  totalBeds={s.beds_total}
                  occupiedBeds={s.beds_occupied}
                />
              </div>

              <div className="lg:col-span-1">
                <RecentActivity state={activity} />
              </div>
            </div>

            {/* 5. LOWER ROW: Pending Admissions + Recent Complaints + Promo Banner */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-1">
                <RecentAdmissionsCard
                  admissions={admissions.data ?? []}
                  onActionComplete={(msg) => {
                    setToast(msg);
                    admissions.reload();
                    sum.reload();
                  }}
                />
              </div>

              <div className="lg:col-span-1">
                <RecentComplaintsCard
                  complaints={complaints.data ?? []}
                  onSelectComplaint={() => nav('complaints')}
                />
              </div>

              <div className="lg:col-span-1">
                <PromoCard />
              </div>
            </div>

            {/* 6. OPERATIONAL DETAILS (Low Stock Alerts & Expense Distribution) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-1">
              <LowStockAlerts items={s.low_stock} />

              <Card
                title="Expenses by Category"
                action={
                  <Button variant="ghost" size="sm" onClick={() => nav('expenses')}>
                    Manage expenses
                  </Button>
                }
              >
                {s.expenses_by_category.length === 0 ? (
                  <Empty title="No expenses recorded this month" />
                ) : (
                  <HBars
                    rows={s.expenses_by_category.slice(0, 5).map((e) => ({
                      name: e.name,
                      value: Number(e.amount),
                    }))}
                  />
                )}
              </Card>
            </div>
          </div>
        )}
      </Async>

      {/* Vacant Rooms Modal */}
      <VacantRoomsModal
        open={vacantModalOpen}
        onClose={() => setVacantModalOpen(false)}
        defaultBuildingId={bid}
      />

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
