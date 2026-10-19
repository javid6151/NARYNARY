/** Row shapes for the ZIPCO platform admin portal. */

export interface PlatformOnboardingRequest {
  id: string;
  /** submitted | under_review | approved | rejected | changes_requested */
  status: string;
  created_at: string;
  review_notes: string | null;
  reviewed_at: string | null;
  contact_details: { phone: string; email: string; city: string };
  business_details: {
    business_name: string;
    notes?: string;
    buildings: { name: string; address?: string; city?: string; floors?: number; approx_beds?: number }[];
  };
}

export interface BuildingRequestRow {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  status: string;
  created_at: string;
  tenants: { business_name: string };
}

export interface TenantSubscription {
  id: string;
  status: string;
  trial_end: string | null;
  resident_limit: number;
  manager_limit: number;
  chef_limit: number;
  price_override: number | null;
  subscription_plans: { name: string; monthly_price: number };
}

export interface TenantAccount {
  id: string;
  /** Human-readable unique tenant ID, e.g. ZPN-000001. */
  tenant_code: string;
  business_name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  status: string;
  approved_at: string | null;
  created_at: string;
  /** At most one per tenant. */
  subscriptions: TenantSubscription[];
}

export interface Plan {
  id: string;
  name: string;
  monthly_price: number;
  included_residents: number;
  max_managers: number;
  max_chefs: number;
  trial_days: number;
  is_active: boolean;
  is_default: boolean;
}

export interface PlatformAuditEntry {
  id: string;
  created_at: string;
  action: string;
  entity_type: string;
  actor_type: string;
  tenants: { business_name: string } | null;
}

/** Onboarding statuses that still need a decision. */
export const PENDING_ONBOARDING = ['submitted', 'under_review'];
