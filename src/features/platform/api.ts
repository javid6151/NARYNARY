/**
 * Data access for ZIPCO platform administration. Every write is an RPC that first checks
 * `_require_platform_admin()` and writes an audit entry; RLS gives platform admins cross-tenant reads.
 */
import { q, rpc } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import type { BuildingRequestRow, Plan, PlatformOnboardingRequest, TenantAccount } from './types';

export async function listOnboardingRequests(): Promise<PlatformOnboardingRequest[]> {
  const rows = await q(supabase.from('tenant_onboarding_requests').select('*').order('created_at', { ascending: false }));
  // business_details / contact_details are jsonb written by submit_onboarding; their shape is asserted here.
  return rows as unknown as PlatformOnboardingRequest[];
}

/** decision: approve (creates tenant, buildings, defaults and a trial) | reject | changes_requested */
export function reviewOnboarding(requestId: string, decision: string, notes: string | null) {
  return rpc('platform_review_onboarding', { p_request: requestId, p_decision: decision, p_notes: notes });
}

/** Buildings across all tenants that are not active yet, newest first. */
export function listBuildingRequests(): Promise<BuildingRequestRow[]> {
  return q(
    supabase
      .from('buildings')
      .select('id,name,address,city,status,requested_details,created_at,tenants(business_name)')
      .neq('status', 'active')
      .order('created_at', { ascending: false }),
  );
}

export function reviewBuilding(buildingId: string, decision: string, notes: string | null) {
  return rpc('platform_review_building', { p_building: buildingId, p_decision: decision, p_notes: notes });
}

export function listTenants(): Promise<TenantAccount[]> {
  return q(
    supabase
      .from('tenants')
      .select(
        'id,tenant_code,business_name,email,phone,city,status,approved_at,created_at,' +
          'subscriptions(id,status,trial_end,resident_limit,manager_limit,chef_limit,price_override,subscription_plans(name,monthly_price))',
      )
      .order('created_at', { ascending: false }),
  ) as unknown as Promise<TenantAccount[]>;
}

/** Suspending blocks all owner, staff and resident access for the tenant immediately (data is kept). */
export function setTenantStatus(tenantId: string, status: string, reason: string) {
  return rpc('platform_set_tenant_status', { p_tenant: tenantId, p_status: status, p_reason: reason });
}

export interface SubscriptionUpdate {
  status: string;
  trialEnd: string | null;
  residentLimit: number;
  managerLimit: number;
  chefLimit: number;
  priceOverride: number | null;
}

export function updateSubscription(tenantId: string, s: SubscriptionUpdate) {
  return rpc('platform_update_subscription', {
    p_tenant: tenantId,
    p_status: s.status,
    p_trial_end: s.trialEnd,
    p_resident_limit: s.residentLimit,
    p_manager_limit: s.managerLimit,
    p_chef_limit: s.chefLimit,
    p_price_override: s.priceOverride,
  });
}

export function listPlans(): Promise<Plan[]> {
  return q(supabase.from('subscription_plans').select('*').order('monthly_price'));
}

export interface PlanInput {
  /** null creates a new plan. */
  id: string | null;
  name: string;
  monthlyPrice: number;
  includedResidents: number;
  maxManagers: number;
  maxChefs: number;
  trialDays: number;
  isActive: boolean;
}

/** Plan changes apply to new subscriptions only. */
export function upsertPlan(p: PlanInput) {
  return rpc('platform_upsert_plan', {
    p_id: p.id,
    p_name: p.name,
    p_monthly_price: p.monthlyPrice,
    p_included_residents: p.includedResidents,
    p_max_managers: p.maxManagers,
    p_max_chefs: p.maxChefs,
    p_trial_days: p.trialDays,
    p_is_active: p.isActive,
  });
}
