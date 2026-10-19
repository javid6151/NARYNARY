/**
 * Route table for ZIPNARY:
 * - `/`               Public marketing website with direct login/signup
 * - `/owner/*`        Dedicated Owner Portal (OwnerShell with Settings)
 * - `/:tenant/owner/*`Tenant-prefixed Owner Portal (e.g. `/yvr/owner`)
 * - `/manager/*`      Dedicated Manager Portal (ManagerShell without Settings)
 * - `/:tenant/manager/*` Tenant-prefixed Manager Portal (e.g. `/yvr/manager`)
 * - `/chef/*`         Chef/Kitchen Portal (`/kitchen/*` alias)
 * - `/resident/*`     Resident Portal
 * - `/platform/*`     ZIPCO Platform Admin
 * - `/onboarding`     New PG Owner application
 */
import { lazy, Suspense, type ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { configError } from '../lib/supabase';
import { useAuth } from '../features/access/useAuth';
import { BuildingProvider } from '../features/access/BuildingProvider';
import Login from '../features/auth/Login';
import Onboarding from '../features/onboarding/Onboarding';
import LandingPage from '../features/marketing/LandingPage';
import { FullLoading, Gate } from './Gate';
import { OwnerShell } from './OwnerShell';
import { ManagerShell } from './ManagerShell';

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

  // Signed-in users opening login/signup go straight to their portal.
  const authPage = (page: ReactElement) => (loading ? <FullLoading /> : session ? <Navigate to={homePath} replace /> : page);

  const ownerRoutes = (
    <>
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
      <Route path="settings" element={<Settings />} />
    </>
  );

  const managerRoutes = (
    <>
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
    </>
  );

  return (
    <Suspense fallback={<FullLoading />}>
      <Routes>
        {/* Public Marketing Homepage */}
        <Route path="/" element={<LandingPage />} />

        {/* Authentication & Onboarding */}
        <Route path="/login" element={authPage(<Login />)} />
        <Route path="/signup" element={authPage(<Login mode="signup" />)} />
        <Route path="/onboarding" element={<Gate allow={true}><Onboarding /></Gate>} />

        {/* Dedicated Owner Portal: /owner/* */}
        <Route
          path="/owner"
          element={
            <Gate allow={!!staff && (staff.role === 'owner' || !!access?.is_platform_admin)}>
              <BuildingProvider>
                <OwnerShell />
              </BuildingProvider>
            </Gate>
          }
        >
          {ownerRoutes}
        </Route>

        {/* Tenant-prefixed Owner Portal: /:tenantSlug/owner/* */}
        <Route
          path="/:tenantSlug/owner"
          element={
            <Gate allow={!!staff && (staff.role === 'owner' || !!access?.is_platform_admin)}>
              <BuildingProvider>
                <OwnerShell />
              </BuildingProvider>
            </Gate>
          }
        >
          {ownerRoutes}
        </Route>

        {/* Dedicated Manager Portal: /manager/* */}
        <Route
          path="/manager"
          element={
            <Gate allow={!!staff}>
              <BuildingProvider>
                <ManagerShell />
              </BuildingProvider>
            </Gate>
          }
        >
          {managerRoutes}
        </Route>

        {/* Tenant-prefixed Manager Portal: /:tenantSlug/manager/* */}
        <Route
          path="/:tenantSlug/manager"
          element={
            <Gate allow={!!staff}>
              <BuildingProvider>
                <ManagerShell />
              </BuildingProvider>
            </Gate>
          }
        >
          {managerRoutes}
        </Route>

        {/* Legacy /app route -> smart redirect to /owner or /manager based on role */}
        <Route
          path="/app/*"
          element={
            <Gate allow={!!staff}>
              <Navigate to={staff?.role === 'owner' ? '/owner' : '/manager'} replace />
            </Gate>
          }
        />

        {/* Kitchen / Chef Portal */}
        <Route
          path="/chef/*"
          element={
            <Gate allow={!!chef || !!staff}>
              <BuildingProvider>
                <KitchenApp />
              </BuildingProvider>
            </Gate>
          }
        />
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
          path="/:tenantSlug/chef/*"
          element={
            <Gate allow={!!chef || !!staff}>
              <BuildingProvider>
                <KitchenApp />
              </BuildingProvider>
            </Gate>
          }
        />

        {/* Resident Portal */}
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
        <Route
          path="/:tenantSlug/resident/*"
          element={
            <Gate allow={!!resident || !!staff}>
              <BuildingProvider>
                <ResidentApp />
              </BuildingProvider>
            </Gate>
          }
        />
        <Route
          path="/tenant/:residentId/*"
          element={
            <Gate allow={!!resident || !!staff}>
              <BuildingProvider>
                <ResidentApp />
              </BuildingProvider>
            </Gate>
          }
        />

        {/* Platform Super Admin */}
        <Route path="/platform/*" element={<Gate allow={!!access?.is_platform_admin}><PlatformApp /></Gate>} />

        {/* Catch-all */}
        <Route path="*" element={loading ? <FullLoading /> : <Navigate to={homePath || '/'} replace />} />
      </Routes>
    </Suspense>
  );
}
