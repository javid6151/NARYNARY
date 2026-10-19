/** Auth context shape and hook. The provider lives in `AuthProvider.tsx`. */
import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Access, Membership } from './types';

export interface AuthCtx {
  session: Session | null;
  access: Access | null;
  loading: boolean;
  refreshAccess: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Owner membership if any. */
  owner: Membership | null;
  /** Manager membership if any. */
  manager: Membership | null;
  /** Owner membership if any, otherwise manager membership. */
  staff: Membership | null;
  chef: Membership | null;
  resident: Membership | null;
  isOwner: boolean;
  isManager: boolean;
  tenantSlug: string;
  /** Where to send this user by default: /platform, /owner, /manager, /chef, /resident or /onboarding. */
  homePath: string;
}

export const AuthContext = createContext<AuthCtx | null>(null);

export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error('useAuth outside provider');
  return c;
}
