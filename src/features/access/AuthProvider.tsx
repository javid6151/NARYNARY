/**
 * Holds the Supabase session and the user's access (memberships) for the whole app.
 * Roles are always read from the database (`my_access`), never from client storage.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { claimPendingAccess, getMyAccess } from './api';
import { BUILDING_STORAGE_KEY } from './useBuilding';
import { AuthContext, type AuthCtx } from './useAuth';
import type { Access } from './types';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAccess = useCallback(async () => {
    try {
      // Accept any staff invitation / link resident record matching the verified email.
      await claimPendingAccess();
      setAccess(await getMyAccess());
    } catch (e) {
      console.error(e);
      setAccess(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) await refreshAccess();
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'SIGNED_IN') {
        setLoading(true);
        refreshAccess().finally(() => setLoading(false));
      }
      if (event === 'SIGNED_OUT') setAccess(null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [refreshAccess]);

  const value = useMemo<AuthCtx>(() => {
    const ms = access?.memberships ?? [];
    const staff = ms.find((m) => m.role === 'owner') ?? ms.find((m) => m.role === 'manager') ?? null;
    const chef = ms.find((m) => m.role === 'chef') ?? null;
    const resident = ms.find((m) => m.role === 'resident') ?? null;
    // Platform admin wins, then staff, chef, resident; a user with no membership goes to onboarding.
    const homePath = !session ? '/login'
      : access?.is_platform_admin ? '/platform'
      : staff ? '/app'
      : chef ? '/kitchen'
      : resident ? '/resident'
      : '/onboarding';
    return {
      session, access, loading, refreshAccess, staff, chef, resident, homePath,
      signOut: async () => {
        await supabase.auth.signOut();
        localStorage.removeItem(BUILDING_STORAGE_KEY);
      },
    };
  }, [session, access, loading, refreshAccess]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
