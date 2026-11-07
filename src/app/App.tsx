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
import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { configError } from '../lib/supabase';
import { useAuth } from '../features/access/useAuth';
import { BuildingProvider } from '../features/access/BuildingProvider';
import Onboarding from '../features/onboarding/Onboarding';
import LandingPage from '../features/marketing/LandingPage';
import { FullLoading, Gate } from './Gate';
import { OwnerShell } from './OwnerShell';
import { ManagerShell } from './ManagerShell';
import { ResidentLogin } from '../features/resident-portal/ResidentLogin';
import { AccountSuspended } from '../components/AccountSuspended';

const Dashboard = lazy(() => import('../features/dashboard/Dashboard'));
const Buildings = lazy(() => import('../features/property/Buildings'));
const Residents = lazy(() => import('../features/residents/Residents'));
const NewAdmission = lazy(() => import('../features/residents/NewAdmission'));
const ResidentPortalServer = lazy(() => import('../features/residents/ResidentPortalServer'));
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

function AppRedirect({ homePath }: { homePath: string }) {
  const loc = useLocation();
  const sub = loc.pathname.replace(/^\/app\/?/, '');
  const target = sub ? `${homePath.replace(/\/$/, '')}/${sub}` : homePath;
  return <Navigate to={target + loc.search} replace />;
}

export default function App() {
  const { loading, homePath, staff, chef, resident, access, isSuspended } = useAuth();
  if (configError) return <div className="p-8 text-bad">{configError}</div>;
  if (loading) return <FullLoading />;
  if (isSuspended) return <AccountSuspended />;

  const isPlatformAdmin = !!access?.is_platform_admin;
  const isOwnerActive = !!staff && staff.role === 'owner' && staff.tenant_status === 'active';
  const isManagerActive = !!staff && staff.role === 'manager' && staff.tenant_status === 'active';
  const isStaffActive = !!staff && staff.tenant_status === 'active';
  const isChefActive = !!chef && chef.tenant_status === 'active';
  const isResidentActive = !!resident && resident.tenant_status === 'active';
  const currentPortNum = typeof window !== 'undefined' && window.location.port ? Number(window.location.port) : null;
  const portalEnv = import.meta.env.VITE_PORTAL as string | undefined;
  const isResidentPort = typeof window !== 'undefined' && (window.location.port === '5000' || portalEnv === 'resident');

  const ownerRoutes = (
    <>
      <Route index element={<Dashboard />} />
      <Route path="buildings" element={<Buildings />} />
      <Route path="residents" element={<Residents />} />
      <Route path="residents/new" element={<NewAdmission />} />
      <Route path="admissions" element={<Navigate to="../residents" replace />} />
      <Route path="admissions/new" element={<NewAdmission />} />
      <Route path="resident-portal-server" element={<ResidentPortalServer />} />
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
      <Route path="residents/new" element={<NewAdmission />} />
      <Route path="admissions" element={<Navigate to="../residents" replace />} />
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
        {/* Port 5000 is dedicated exclusively to the Resident Portal */}
        {isResidentPort ? (
          <>
            <Route
              path="/"
              element={
                isResidentActive || (resident && resident.tenant_status === 'active') || isStaffActive || isPlatformAdmin ? (
                  <BuildingProvider>
                    <ResidentApp />
                  </BuildingProvider>
                ) : (
                  <ResidentLogin />
                )
              }
            />
            <Route path="/login" element={<ResidentLogin />} />
            <Route path="/signup" element={<ResidentLogin />} />
          </>
        ) : (
          <>
            {/* Direct Portal / Landing for role ports 1000, 2000, 3000, 4000, 6000 */}
            <Route
              path="/"
              element={
                currentPortNum === 6000 || portalEnv === 'public' ? (
                  <LandingPage />
                ) : (currentPortNum === 1000 || portalEnv === 'platform') && isPlatformAdmin ? (
                  <Navigate to="/platformadmin" replace />
                ) : (currentPortNum === 2000 || portalEnv === 'owner') && isOwnerActive ? (
                  <Navigate to="/owner" replace />
                ) : (currentPortNum === 3000 || portalEnv === 'manager') && isManagerActive ? (
                  <Navigate to="/manager" replace />
                ) : (currentPortNum === 4000 || portalEnv === 'kitchen') && isChefActive ? (
                  <Navigate to="/chef" replace />
                ) : isPlatformAdmin ? (
                  <Navigate to="/platformadmin" replace />
                ) : isOwnerActive ? (
                  <Navigate to="/owner" replace />
                ) : isManagerActive ? (
                  <Navigate to="/manager" replace />
                ) : isChefActive ? (
                  <Navigate to="/chef" replace />
                ) : isResidentActive ? (
                  <Navigate to={homePath || '/resident'} replace />
                ) : (
                  <LandingPage />
                )
              }
            />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/signup" element={<Navigate to="/?mode=signup" replace />} />
          </>
        )}

        <Route path="/onboarding" element={<Gate allow={true}><Onboarding /></Gate>} />

        {/* Dedicated & Parameterized Owner Portals: /:tenantSlug/:pgSlug/owner/* */}
        <Route
          path="/:tenantSlug/:pgSlug/owner"
          element={
            <Gate allow={isPlatformAdmin || isOwnerActive}>
              <BuildingProvider>
                <OwnerShell />
              </BuildingProvider>
            </Gate>
          }
        >
          {ownerRoutes}
        </Route>

        <Route
          path="/:tenantSlug/owner"
          element={
            <Gate allow={isPlatformAdmin || isOwnerActive}>
              <BuildingProvider>
                <OwnerShell />
              </BuildingProvider>
            </Gate>
          }
        >
          {ownerRoutes}
        </Route>

        <Route
          path="/owner"
          element={
            <Gate allow={isPlatformAdmin || isOwnerActive}>
              <BuildingProvider>
                <OwnerShell />
              </BuildingProvider>
            </Gate>
          }
        >
          {ownerRoutes}
        </Route>

        {/* Dedicated & Parameterized Manager Portals: /:tenantSlug/:pgSlug/manager/* */}
        <Route
          path="/:tenantSlug/:pgSlug/manager"
          element={
            <Gate allow={isPlatformAdmin || isManagerActive}>
              <BuildingProvider>
                <ManagerShell />
              </BuildingProvider>
            </Gate>
          }
        >
          {managerRoutes}
        </Route>

        <Route
          path="/:tenantSlug/manager"
          element={
            <Gate allow={isPlatformAdmin || isManagerActive}>
              <BuildingProvider>
                <ManagerShell />
              </BuildingProvider>
            </Gate>
          }
        >
          {managerRoutes}
        </Route>

        <Route
          path="/manager"
          element={
            <Gate allow={isPlatformAdmin || isManagerActive}>
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
            <Gate allow={isPlatformAdmin || isStaffActive}>
              <AppRedirect homePath={homePath} />
            </Gate>
          }
        />

        {/* Kitchen / Chef Portal */}
        <Route
          path="/:tenantSlug/:pgSlug/chef/*"
          element={
            <Gate allow={isPlatformAdmin || isChefActive || isStaffActive}>
              <BuildingProvider>
                <KitchenApp />
              </BuildingProvider>
            </Gate>
          }
        />
        <Route
          path="/:tenantSlug/chef/*"
          element={
            <Gate allow={isPlatformAdmin || isChefActive || isStaffActive}>
              <BuildingProvider>
                <KitchenApp />
              </BuildingProvider>
            </Gate>
          }
        />
        <Route
          path="/chef/*"
          element={
            <Gate allow={isPlatformAdmin || isChefActive || isStaffActive}>
              <BuildingProvider>
                <KitchenApp />
              </BuildingProvider>
            </Gate>
          }
        />
        <Route
          path="/kitchen/*"
          element={
            <Gate allow={isPlatformAdmin || isChefActive || isStaffActive}>
              <BuildingProvider>
                <KitchenApp />
              </BuildingProvider>
            </Gate>
          }
        />

        {/* Resident / Tenant Portal */}
        <Route
          path="/:tenantSlug/:pgSlug/tentant/:uniqueId/*"
          element={
            <Gate allow={isPlatformAdmin || isResidentActive || isStaffActive}>
              <BuildingProvider>
                <ResidentApp />
              </BuildingProvider>
            </Gate>
          }
        />
        <Route
          path="/:tenantSlug/:pgSlug/tenant/:uniqueId/*"
          element={
            <Gate allow={isPlatformAdmin || isResidentActive || isStaffActive}>
              <BuildingProvider>
                <ResidentApp />
              </BuildingProvider>
            </Gate>
          }
        />
        <Route
          path="/:tenantSlug/:pgSlug/tentant/*"
          element={
            <Gate allow={isPlatformAdmin || isResidentActive || isStaffActive}>
              <BuildingProvider>
                <ResidentApp />
              </BuildingProvider>
            </Gate>
          }
        />
        <Route
          path="/:tenantSlug/:pgSlug/tenant/*"
          element={
            <Gate allow={isPlatformAdmin || isResidentActive || isStaffActive}>
              <BuildingProvider>
                <ResidentApp />
              </BuildingProvider>
            </Gate>
          }
        />
        <Route
          path="/:tenantSlug/:pgSlug/resident/*"
          element={
            <Gate allow={isPlatformAdmin || isResidentActive || isStaffActive}>
              <BuildingProvider>
                <ResidentApp />
              </BuildingProvider>
            </Gate>
          }
        />
        <Route
          path="/:tenantSlug/resident/*"
          element={
            <Gate allow={isPlatformAdmin || isResidentActive || isStaffActive}>
              <BuildingProvider>
                <ResidentApp />
              </BuildingProvider>
            </Gate>
          }
        />
        <Route
          path="/resident/*"
          element={
            <Gate allow={isPlatformAdmin || isResidentActive || isStaffActive}>
              <BuildingProvider>
                <ResidentApp />
              </BuildingProvider>
            </Gate>
          }
        />
        <Route
          path="/tenant/:residentId/*"
          element={
            <Gate allow={isPlatformAdmin || isResidentActive || isStaffActive}>
              <BuildingProvider>
                <ResidentApp />
              </BuildingProvider>
            </Gate>
          }
        />

        {/* Platform Super Admin */}
        <Route path="/platformadmin/*" element={<Gate allow={isPlatformAdmin}><PlatformApp /></Gate>} />
        <Route path="/platform/*" element={<Navigate to="/platformadmin" replace />} />

        {/* Catch-all */}
        <Route path="*" element={loading ? <FullLoading /> : <Navigate to={homePath || '/'} replace />} />
      </Routes>
    </Suspense>
  );
}
