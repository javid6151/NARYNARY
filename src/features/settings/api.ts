/**
 * Data access for owner settings: team logins (manager/chef invitations), subscription,
 * meal cutoffs and categories. Team changes go through RPCs that enforce plan limits and audit them.
 */
import { q, rpc } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import type { ExpenseCategoryRow, MealSettings, SubscriptionInfo, TeamMember } from './types';

/** Owner/manager/chef memberships with assigned buildings and, for claimed invitations, the login's profile. */
export async function listTeam(): Promise<TeamMember[]> {
  const ms = await q(
    supabase
      .from('tenant_memberships')
      .select('id,user_id,invite_email,display_name,role,status,created_at,building_memberships(buildings(name))')
      .in('role', ['owner', 'manager', 'chef'])
      .order('created_at'),
  );
  const ids = ms.map((m) => m.user_id).filter(Boolean) as string[];
  const profiles = ids.length ? await q(supabase.from('profiles').select('id,full_name,email').in('id', ids)) : [];
  return ms.map((m) => ({ ...m, profiles: profiles.find((p) => p.id === m.user_id) ?? null }));
}

/** Manager/chef limits from the tenant's subscription (null if none). */
export function getStaffLimits() {
  return q<{ manager_limit: number; chef_limit: number } | null>(
    supabase.from('subscriptions').select('manager_limit,chef_limit').maybeSingle(),
  );
}

/** Suspend, reactivate or revoke a manager/chef login. */
export function setMembershipStatus(membershipId: string, status: string) {
  return rpc('set_membership_status', { p_membership: membershipId, p_status: status });
}

/** Creates a manager/chef account directly with password and assigns buildings. */
export async function createTeamMember(params: {
  tenantId: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  password: string;
  buildingIds: string[];
}) {
  const res = await fetch('/api/auth/create-team-member', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || 'Failed to create team member');
  }
  return data;
}

/** Updates the password for a team member directly. */
export async function changeTeamPassword(userId: string, password: string) {
  const res = await fetch('/api/auth/change-team-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, password }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || 'Failed to update password');
  }
  return data;
}

/** Deletes a team member from memberships and auth. */
export async function deleteTeamMember(membershipId: string, userId?: string | null) {
  const res = await fetch('/api/auth/delete-team-member', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ membershipId, userId }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || 'Failed to delete team member');
  }
  return data;
}

/** Creates an invitation; the person gets access after signing up with this email and verifying it. */
export function inviteStaffAccount(i: { email: string; role: string; name: string | null; buildingIds: string[] }) {
  return rpc('invite_staff_account', { p_email: i.email, p_role: i.role, p_name: i.name, p_building_ids: i.buildingIds });
}

export function getSubscription(): Promise<SubscriptionInfo | null> {
  return q(supabase.from('subscriptions').select('*,subscription_plans(name,monthly_price)').maybeSingle()) as Promise<SubscriptionInfo | null>;
}

/** Residents counted against the plan limit (pending + active). */
export function listCountedResidentIds() {
  return q(supabase.from('residents').select('id').in('status', ['pending', 'active']));
}

export function getMealSettings(): Promise<MealSettings | null> {
  return q(supabase.from('meal_settings').select('*').maybeSingle());
}

export async function saveMealSettings(s: MealSettings) {
  await q(
    supabase
      .from('meal_settings')
      .update({
        breakfast_cutoff: s.breakfast_cutoff,
        lunch_cutoff: s.lunch_cutoff,
        dinner_cutoff: s.dinner_cutoff,
        allow_reviews: s.allow_reviews,
      })
      .eq('tenant_id', s.tenant_id)
      .select('tenant_id')
      .single(),
  );
  return true;
}

export function listAllExpenseCategories(): Promise<ExpenseCategoryRow[]> {
  return q(supabase.from('expense_categories').select('id,name,is_maintenance,is_active').order('name'));
}

export function listAllMaintenanceCategories(): Promise<{ id: string; name: string }[]> {
  return q(supabase.from('maintenance_categories').select('id,name').order('name'));
}

/** Adds an expense or maintenance category for the tenant. */
export async function addCategory(table: 'expense_categories' | 'maintenance_categories', tenantId: string | null, name: string) {
  // tenantId comes from the user's accessible buildings; RLS rejects any other tenant.
  await q(supabase.from(table).insert({ tenant_id: tenantId as string, name: name.trim() }).select('id').single());
  return true;
}

/** Categories are never deleted (history refers to them); they are deactivated instead. */
export async function setExpenseCategoryActive(id: string, active: boolean) {
  await q(supabase.from('expense_categories').update({ is_active: active }).eq('id', id).select('id').single());
  return true;
}
