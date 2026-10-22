/** Data access for the signed-in user's memberships and visible buildings. */
import { q, rpc } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import type { Access, Building } from './types';

/** Accepts staff invitations / links resident records that match the user's verified email. */
export function claimPendingAccess() {
  return rpc('claim_pending_access');
}

/** Memberships, roles and platform-admin flag; drives portal routing on the client. */
export async function getMyAccess() {
  return (await rpc('my_access')) as unknown as Access;
}

/** Active buildings the user may access (owner: all of the tenant; staff: assigned only). */
export function listActiveBuildings(): Promise<Building[]> {
  return q(supabase.from('buildings').select('id,tenant_id,name,address,city,status').eq('status', 'active').order('name'));
}

/** Slugify helper to convert business or building names into URL slugs. */
export function toSlug(str: string): string {
  return (str || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface PortalDestination {
  port: number;
  path: string;
}

/** Determines both the dedicated hosting port and path based on database role.
 * - Super admin port: 1000
 * - Owner port: 2000
 * - Manager port: 3000
 * - Chef port: 4000
 * - The rest (Resident / Public): 5000
 */
export async function determinePortalRoute(access: Access | null, hasSession = true): Promise<PortalDestination> {
  if (!hasSession) {
    const port = typeof window !== 'undefined' && window.location.port ? Number(window.location.port) : 5000;
    return { port, path: '/' };
  }
  if (access?.is_platform_admin) return { port: 1000, path: '/platformadmin' };

  const ms = access?.memberships ?? [];
  const owner = ms.find((m) => m.role === 'owner');
  const manager = ms.find((m) => m.role === 'manager');
  const chef = ms.find((m) => m.role === 'chef');
  const resident = ms.find((m) => m.role === 'resident');

  // If owner application is pending review, route them to /onboarding to view review status
  if (owner && owner.tenant_status !== 'active') {
    return { port: 2000, path: '/onboarding' };
  }

  // Helper to get active building slug
  const getFirstBuildingSlug = async (): Promise<string> => {
    try {
      const buildings = await listActiveBuildings();
      if (buildings.length > 0 && buildings[0].name) {
        return toSlug(buildings[0].name);
      }
    } catch (e) {
      console.warn('Failed to list buildings for slug determination:', e);
    }
    return 'main';
  };

  if (owner) {
    const businessSlug = toSlug(owner.tenant_name) || 'pg';
    const pgSlug = await getFirstBuildingSlug();
    return { port: 2000, path: `/${businessSlug}/${pgSlug}/owner` };
  }

  if (manager) {
    const businessSlug = toSlug(manager.tenant_name) || 'pg';
    const pgSlug = await getFirstBuildingSlug();
    return { port: 3000, path: `/${businessSlug}/${pgSlug}/manager` };
  }

  if (chef) {
    const businessSlug = toSlug(chef.tenant_name) || 'pg';
    const pgSlug = await getFirstBuildingSlug();
    return { port: 4000, path: `/${businessSlug}/${pgSlug}/chef` };
  }

  if (resident) {
    const businessSlug = toSlug(resident.tenant_name) || 'pg';
    try {
      const profile = (await rpc('my_resident_profile')) as any;
      if (profile) {
        const bSlug = toSlug(profile.business_name || resident.tenant_name) || businessSlug;
        const pgSlug = toSlug(profile.building_name) || (await getFirstBuildingSlug());
        const uniqueId = profile.resident_id || profile.phone || 'me';
        return { port: 5000, path: `/${bSlug}/${pgSlug}/tentant/${uniqueId}` };
      }
    } catch {
      // fallback
    }
    const pgSlug = await getFirstBuildingSlug();
    return { port: 5000, path: `/${businessSlug}/${pgSlug}/tentant/me` };
  }

  // Non-residents (new PG account signups) go to Owner port 2000 onboarding
  return { port: 2000, path: '/onboarding' };
}

/** Determines which portal path a user belongs to based on their database role & memberships. */
export async function determinePortalPath(access: Access | null, hasSession = true): Promise<string> {
  const route = await determinePortalRoute(access, hasSession);
  return route.path;
}

