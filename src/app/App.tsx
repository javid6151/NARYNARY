/**
 * Route table for all portals:
 * - `/app/*`      owner and manager (StaffShell); Settings is owner-only
 * - `/kitchen/*`  chef portal (owners/managers may open it too)
 * - `/resident/*` resident portal
 * - `/platform/*` ZIPCO platform admin
 * - `/onboarding` new owner application
 * Pages are lazy-loaded so each portal only downloads its own code.
 */
import { lazy, Suspense, type ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { configError } from '../lib/supabase';
import { useAuth } from '../features/access/useAuth';
import { BuildingProvider } from '../features/access/BuildingProvider';
import Login from '../features/auth/Login';
import Onboarding from '../features/onboarding/Onboarding';
import { CURRENT_PORTAL, getActivePortal, type PortalId } from '../lib/portals';
import { FullLoading, Gate } from './Gate';
import { WrongPortal } from './WrongPortal';
import { StaffShell } from './StaffShell';

const Dashboard = lazy(() => import('../features/dashboard/Dashboard'));
const Buildings = lazy(() => import('../features/property/Buildings'));
const Residents = lazy(() => import('../features/residents/Residents'));
const Admissions = lazy(() => import('../features/residents/Admissions'));
const NewAdmission = lazy(() => import('../features/residents/NewAdmission'));
const Payments = lazy(() => import('../features/billing/Payments'));
const Expenses = lazy(() => import('../features/expenses/Expenses'));
const Complaints = lazy(() => import('../features/maintenance/Complaints'));
const Maintenance = lazy(() => import('../features/maintenance/Maintenance'));
const Food = lazy(() => import('../features/kitchen/Food'));
const Inventory = lazy(() => import('../features/kitchen/Inventory'));
const Staff = lazy(() => import('../features/staff/Staff'));
const Communication = lazy(() => import('../features/communication/Communication'));
const Reports = lazy(() => import('../features/reports/Reports'));
const Settings = lazy(() => import('../features/settings/Settings'));
const KitchenApp = lazy(() => import('../features/kitchen/chef/KitchenApp'));
const ResidentApp = lazy(() => import('../features/resident-portal/ResidentApp'));
const PlatformApp = lazy(() => import('../features/platform/PlatformApp'));

export default function App() {
  const { session, loading, homePath, staff, chef, resident, access } = useAuth();
  if (configError) return <div className="p-8 text-bad">{configError}</div>;

  const activePortal = CURRENT_PORTAL ?? getActivePortal();

  // On a per-portal port, send users who belong elsewhere to their own portal's port.
  // (New owners without a membership complete onboarding on the owner port.)
  if (activePortal && session && !loading) {
    const isAllowed =
      activePortal.id === 'platform' ? !!access?.is_platform_admin
      : activePortal.id === 'owner' ? (staff?.role === 'owner' || (!staff && !chef && !resident && !access?.is_platform_admin))
      : activePortal.id === 'manager' ? (staff?.role === 'manager' || staff?.role === 'owner')
      : activePortal.id === 'kitchen' ? (!!chef || !!staff)
      : activePortal.id === 'resident' ? (!!resident || !!staff)
      : true;

    if (!isAllowed) {
      const targetPortal: PortalId = access?.is_platform_admin ? 'platform'
        : staff?.role === 'owner' ? 'owner'
        : staff?.role === 'manager' ? 'manager'
        : chef ? 'kitchen'
        : resident ? 'resident'
        : 'owner';
      return <WrongPortal portal={targetPortal} />;
    }
  }

  // Signed-in users who open /login or /signup go straight to their portal.
  const authPage = (page: ReactElement) => (loading ? <FullLoading /> : session ? <Navigate to={homePath} replace /> : page);

  return (
    <Suspense fallback={<FullLoading />}>
      <Routes>
        <Route path="/login" element={authPage(<Login />)} />
        <Route path="/signup" element={authPage(<Login mode="signup" />)} />
        <Route path="/onboarding" element={<Gate allow={!activePortal || activePortal.id === 'owner'}><Onboarding /></Gate>} />

        <Route
          path="/app"
          element={
            <Gate allow={!!staff}>
              <BuildingProvider>
                <StaffShell />
              </BuildingProvider>
            </Gate>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="buildings" element={<Buildings />} />
          <Route path="residents" element={<Residents />} />
          <Route path="admissions" element={<Admissions />} />
          <Route path="admissions/new" element={<NewAdmission />} />
          <Route path="payments" element={<Payments />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="complaints" element={<Complaints />} />
          <Route path="maintenance" element={<Maintenance />} />
          <Route path="food" element={<Food />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="staff" element={<Staff />} />
          <Route path="communication" element={<Communication />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={staff?.role === 'owner' ? <Settings /> : <Navigate to="/app" replace />} />
        </Route>

        <Route
          path="/kitchen/*"
          element={
            <Gate allow={!!chef || !!staff}>
              <BuildingProvider>
                <KitchenApp />
              </BuildingProvider>
            </Gate>
          }
        />
        <Route
          path="/resident/*"
          element={
            <Gate allow={!!resident || !!staff}>
              <BuildingProvider>
                <ResidentApp />
              </BuildingProvider>
            </Gate>
          }
        />
        <Route path="/platform/*" element={<Gate allow={!!access?.is_platform_admin}><PlatformApp /></Gate>} />
        <Route path="*" element={loading ? <FullLoading /> : <Navigate to={homePath} replace />} />
      </Routes>
    </Suspense>
  );
}
