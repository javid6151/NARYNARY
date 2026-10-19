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
