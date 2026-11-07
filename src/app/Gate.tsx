/**
 * Route guards. These only decide which screen to show; every query is still authorized by RLS,
 * so a user who reaches a page they should not see gets no data.
 */
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/access/useAuth';
import { Loading } from '../components/ui';
import { AccountSuspended } from '../components/AccountSuspended';
import { ResidentLogin } from '../features/resident-portal/ResidentLogin';
import { WrongPortal } from './WrongPortal';

/** Requires a session; when `allow` is false, sends the user to their own home portal or shows WrongPortal. */
export function Gate({ allow, children }: { allow: boolean; children: ReactNode }) {
  const { session, loading, isSuspended, staff, chef, resident, access } = useAuth();
  const loc = useLocation();
  if (loading) return <FullLoading />;
  if (isSuspended) return <AccountSuspended />;
  if (!session) {
    const isResidentRoute = loc.pathname.startsWith('/resident') || loc.pathname.includes('/tenant/') || loc.pathname.includes('/tentant/');
    const isResidentPort = typeof window !== 'undefined' && (window.location.port === '5000' || import.meta.env.VITE_PORTAL === 'resident' || isResidentRoute);
    if (isResidentPort) {
      return <ResidentLogin />;
    }
    return <Navigate to="/" state={{ from: loc.pathname }} replace />;
  }
  if (!allow) {
    const isOwner = staff?.role === 'owner';
    const isManager = staff?.role === 'manager';
    const isChef = !!chef;
    const isResident = !!resident;
    const isPlatform = !!access?.is_platform_admin;
    const correctPortal = isOwner ? 'owner' : isManager ? 'manager' : isChef ? 'kitchen' : isResident ? 'resident' : isPlatform ? 'platform' : null;

    if (correctPortal) {
      return <WrongPortal portal={correctPortal} />;
    }

    return (
      <div className="max-w-md mx-auto pt-24 px-4 text-center space-y-4">
        <h1 className="text-xl font-semibold text-bad">Access Denied</h1>
        <p className="text-[13px] text-muted">Your account does not have permission to access this portal.</p>
        <div className="flex justify-center gap-2">
          <button
            onClick={() => {
              localStorage.clear();
              window.location.href = '/';
            }}
            className="inline-flex items-center justify-center rounded-lg font-medium h-9 px-3 text-sm bg-brand-600 text-white cursor-pointer"
          >
            Sign out & Re-login
          </button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

export function FullLoading() {
  return (
    <div className="max-w-md mx-auto pt-24 px-4">
      <Loading rows={3} />
    </div>
  );
}
