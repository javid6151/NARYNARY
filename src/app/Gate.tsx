/**
 * Route guards. These only decide which screen to show; every query is still authorized by RLS,
 * so a user who reaches a page they should not see gets no data.
 */
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/access/useAuth';
import { Loading } from '../components/ui';

/** Requires a session; when `allow` is false, sends the user to their own home portal. */
export function Gate({ allow, children }: { allow: boolean; children: ReactNode }) {
  const { session, loading, homePath } = useAuth();
  const loc = useLocation();
  if (loading) return <FullLoading />;
  if (!session) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (!allow) return <Navigate to={homePath} replace />;
  return <>{children}</>;
}

export function FullLoading() {
  return (
    <div className="max-w-md mx-auto pt-24 px-4">
      <Loading rows={3} />
    </div>
  );
}
