/**
 * Holds the Supabase session and the user's access (memberships) for the whole app.
 * Roles are always read from the database (`my_access`), never from client storage.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { claimPendingAccess, determinePortalPath, getMyAccess, toSlug } from './api';
import { BUILDING_STORAGE_KEY } from './useBuilding';
import { AuthContext, type AuthCtx, type UserProfile } from './useAuth';
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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [homePath, setHomePath] = useState<string>('/');
  const [isSuspended, setIsSuspended] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (uid: string, meta?: any, email?: string) => {
    try {
      const { data: p } = await withTimeout(
        supabase
          .from('profiles')
          .select('id, full_name, phone, email, avatar_path')
          .eq('id', uid)
          .maybeSingle(),
        2500,
        { data: null } as any
      );
      if (p) {
        setProfile(p);
        return p;
      }
    } catch (e) {
      console.warn('fetchProfile non-fatal:', e);
    }
    const fallback: UserProfile = {
      id: uid,
      full_name: meta?.full_name || meta?.name || (email ? email.split('@')[0] : 'Owner'),
      phone: meta?.phone || null,
      email: email || null,
    };
    setProfile(fallback);
    return fallback;
  }, []);

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

  const updateProfile = useCallback(
    async (updates: { full_name?: string; phone?: string }) => {
      const curUid = session?.user?.id;
      if (!curUid) throw new Error('Not authenticated');

      const cleanName = updates.full_name !== undefined ? updates.full_name.trim() : undefined;
      const cleanPhone = updates.phone !== undefined ? updates.phone.trim() : undefined;

      // 1. Direct update on profiles table
      const profileUpdates: any = { updated_at: new Date().toISOString() };
      if (cleanName !== undefined) profileUpdates.full_name = cleanName;
      if (cleanPhone !== undefined) profileUpdates.phone = cleanPhone;

      const { error: pErr } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', curUid);

      if (pErr) {
        console.warn('Direct profile update warning:', pErr);
      }

      // 2. Update Supabase Auth user metadata
      try {
        const metaUpdates: any = {};
        if (cleanName !== undefined) {
          metaUpdates.full_name = cleanName;
          metaUpdates.name = cleanName;
        }
        if (cleanPhone !== undefined) {
          metaUpdates.phone = cleanPhone;
        }
        await supabase.auth.updateUser({ data: metaUpdates });
      } catch (e) {
        console.warn('updateUser metadata warning:', e);
      }

      // 3. Call backend endpoint to update tenant_memberships and synchronize
      try {
        await fetch('/api/auth/update-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: curUid, fullName: cleanName, phone: cleanPhone }),
        });
      } catch (e) {
        console.warn('Backend update-profile endpoint warning:', e);
      }

      // 4. Update local profile state immediately
      setProfile((prev) => ({
        id: curUid,
        full_name: cleanName !== undefined ? cleanName : (prev?.full_name ?? null),
        phone: cleanPhone !== undefined ? cleanPhone : (prev?.phone ?? null),
        email: prev?.email ?? session?.user?.email ?? null,
        avatar_path: prev?.avatar_path ?? null,
      }));

      // 5. Refresh access
      await refreshAccess();
    },
    [session, refreshAccess]
  );

  const updateTenantBranding = useCallback(
    async (branding: { logo_url?: string | null; business_name?: string }) => {
      try {
        const { error: rpcErr } = await (supabase.rpc as any)('update_tenant_branding', {
          p_logo_url: branding.logo_url ?? null,
          p_business_name: branding.business_name ?? null,
        });
        if (rpcErr) throw rpcErr;
      } catch (err: unknown) {
        console.warn('update_tenant_branding RPC error, attempting fallback update:', err);
        const myUid = session?.user?.id;
        if (myUid) {
          await supabase
            .from('tenants')
            .update({
              logo_url: branding.logo_url,
              ...(branding.business_name ? { business_name: branding.business_name.trim() } : {}),
            })
            .eq('owner_user_id', myUid);
        }
      }
      await refreshAccess();
    },
    [session, refreshAccess]
  );

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
              fetchProfile(sRes.data.session.user.id, sRes.data.session.user.user_metadata, sRes.data.session.user.email);
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
          fetchProfile(sessionRes.data.session.user.id, sessionRes.data.session.user.user_metadata, sessionRes.data.session.user.email);
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
      if (event === 'SIGNED_IN' && s) {
        setLoading(true);
        fetchProfile(s.user.id, s.user.user_metadata, s.user.email);
        withTimeout(refreshAccess(), 3500, undefined).finally(() => setLoading(false));
      }
      if (event === 'SIGNED_OUT') {
        setAccess(null);
        setProfile(null);
        setHomePath('/');
        setIsSuspended(false);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [refreshAccess, fetchProfile]);

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
      profile,
      loading,
      refreshAccess,
      updateProfile,
      updateTenantBranding,
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
        setProfile(null);
        setHomePath('/');
        setAccess(null);
        setIsSuspended(false);
        localStorage.removeItem(BUILDING_STORAGE_KEY);
      },
    };
  }, [session, access, profile, loading, refreshAccess, updateProfile, updateTenantBranding, homePath, isSuspended]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
