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

/** Requires a session; when `allow` is false, sends the user to their own home portal. */
export function Gate({ allow, children }: { allow: boolean; children: ReactNode }) {
  const { session, loading, homePath, isSuspended } = useAuth();
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
    if (homePath === loc.pathname || (homePath !== '/' && loc.pathname.startsWith(homePath))) {
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
    return <Navigate to={homePath} replace />;
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
