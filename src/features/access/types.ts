/** Who the signed-in user is and what they may open. Shapes match the `my_access()` SQL function. */

export type Role = 'owner' | 'manager' | 'chef' | 'resident';

export interface Membership {
  membership_id: string;
  tenant_id: string;
  /** Human-readable unique tenant ID, e.g. ZPN-000001 (assigned by the database). */
  tenant_code: string;
  role: Role;
  status: string;
  tenant_name: string;
  tenant_status: string;
  currency: string;
  timezone: string;
  /** Owners: every active building of the tenant. Staff: only assigned buildings. */
  building_ids: string[];
}

export interface Access {
  user_id: string;
  is_platform_admin: boolean;
  /** Active memberships only. */
  memberships: Membership[];
  /** The tenant this user applied to own (any status), used by onboarding. */
  owned_tenant: { tenant_id: string; tenant_code: string; status: string; business_name: string } | null;
}

/** An active building the user can see (RLS decides which). */
export interface Building {
  id: string;
  tenant_id: string;
  name: string;
  address: string | null;
  city: string | null;
  status: string;
}
