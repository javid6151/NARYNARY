/**
 * Holds the Supabase session and the user's access (memberships) for the whole app.
 * Roles are always read from the database (`my_access`), never from client storage.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { claimPendingAccess, determinePortalPath, getMyAccess, toSlug } from './api';
import { BUILDING_STORAGE_KEY } from './useBuilding';
import { AuthContext, type AuthCtx } from './useAuth';
import type { Access } from './types';

/** Safe timeout wrapper to prevent hanging promises on network failures or paused Supabase projects */
function withTimeout<T>(promise: PromiseLike<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  const [homePath, setHomePath] = useState<string>('/');
  const [isSuspended, setIsSuspended] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshAccess = useCallback(async () => {
    try {
      // Accept any staff invitation / link resident record matching the verified email.
      await withTimeout(claimPendingAccess(), 2500, undefined);
    } catch (e) {
      console.warn('claimPendingAccess non-fatal:', e);
    }
    try {
      const acc = await withTimeout(getMyAccess(), 3000, null as unknown as Access);
      setAccess(acc);

      if (!acc) {
        setHomePath('/');
        setIsSuspended(false);
        return;
      }

      // Check if user's membership is suspended
      const curSessionRes = await withTimeout(
        supabase.auth.getSession(),
        2000,
        { data: { session: null } } as any
      );
      const currentUid = curSessionRes?.data?.session?.user?.id;
      if (currentUid) {
        const { data: mems } = await withTimeout(
          supabase
            .from('tenant_memberships')
            .select('id, role, status')
            .eq('user_id', currentUid),
          2000,
          { data: null } as any
        );
        const hasSuspended = mems?.some((m: any) => m.status === 'suspended');
        const hasActive = mems?.some((m: any) => m.status === 'active');
        if (hasSuspended && !hasActive && !acc?.is_platform_admin) {
          setIsSuspended(true);
        } else {
          setIsSuspended(false);
        }
      } else {
        setIsSuspended(false);
      }

      const path = await withTimeout(determinePortalPath(acc, true), 2000, '/');
      setHomePath(path);
    } catch (e) {
      console.error('getMyAccess error:', e);
      setAccess(null);
      setHomePath('/');
      setIsSuspended(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function initializeSession() {
      // 1. Detect tokens passed via URL hash during cross-port redirection
      if (typeof window !== 'undefined' && window.location.hash.includes('access_token=')) {
        try {
          const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          if (accessToken && refreshToken) {
            const sRes = await withTimeout(
              supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              }),
              3000,
              { data: { session: null }, error: new Error('Timeout restoring session') } as any
            );

            // Clean the tokens from the browser URL address bar
            window.history.replaceState(null, '', window.location.pathname + window.location.search);

            if (!sRes.error && sRes.data.session) {
              if (!active) return;
              setSession(sRes.data.session);
              await withTimeout(refreshAccess(), 3500, undefined);
              setLoading(false);
              return;
            }
          }
        } catch (e) {
          console.warn('Cross-port token restore error:', e);
        }
      }

      // 2. Read saved session from this port's localStorage
      try {
        const sessionRes = await withTimeout(
          supabase.auth.getSession(),
          3000,
          { data: { session: null }, error: null } as any
        );
        if (!active) return;
        setSession(sessionRes.data.session);
        if (sessionRes.data.session) {
          await withTimeout(refreshAccess(), 3500, undefined);
        } else {
          setHomePath('/');
        }
      } catch (err) {
        console.error('Error fetching session:', err);
        if (active) setHomePath('/');
      } finally {
        if (active) setLoading(false);
      }
    }

    initializeSession();

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'SIGNED_IN') {
        setLoading(true);
        withTimeout(refreshAccess(), 3500, undefined).finally(() => setLoading(false));
      }
      if (event === 'SIGNED_OUT') {
        setAccess(null);
        setHomePath('/');
        setIsSuspended(false);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [refreshAccess]);

  const value = useMemo<AuthCtx>(() => {
    const ms = access?.memberships ?? [];
    const owner = ms.find((m) => m.role === 'owner') ?? null;
    const manager = ms.find((m) => m.role === 'manager') ?? null;
    const staff = owner ?? manager;
    const chef = ms.find((m) => m.role === 'chef') ?? null;
    const resident = ms.find((m) => m.role === 'resident') ?? null;

    const activeMembership = owner ?? manager ?? chef ?? resident;
    const tenantSlug = activeMembership?.tenant_name ? toSlug(activeMembership.tenant_name) : '';

    return {
      session,
      access,
      loading,
      refreshAccess,
      owner,
      manager,
      staff,
      chef,
      resident,
      isOwner: !!owner,
      isManager: !!manager,
      tenantSlug,
      isSuspended,
      homePath,
      signOut: async () => {
        try {
          await withTimeout(supabase.auth.signOut(), 2000, undefined);
        } catch {}
        setSession(null);
        setHomePath('/');
        setAccess(null);
        setIsSuspended(false);
        localStorage.removeItem(BUILDING_STORAGE_KEY);
      },
    };
  }, [session, access, loading, refreshAccess, homePath, isSuspended]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
