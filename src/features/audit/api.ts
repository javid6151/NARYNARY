/**
 * Read access to the audit trail. Rows are written only by SQL workflows (`write_audit`);
 * RLS lets owners read their tenant's entries and platform admins read all.
 */
import { q } from '../../lib/api';
import { supabase } from '../../lib/supabase';

/** The latest `limit` audit actions visible to the user (dashboard "Recent activity"). */
export function listRecentActivity(limit: number): Promise<{ id: string; action: string; created_at: string }[]> {
  return q(supabase.from('audit_logs').select('id,action,created_at').order('created_at', { ascending: false }).limit(limit));
}

/** Audit entries in [from, toExclusive), newest first, capped at 2000 (Reports → System activity). */
export function listAuditLogsBetween(from: string, toExclusive: string) {
  return q(
    supabase
      .from('audit_logs')
      .select('created_at,action,entity_type,actor_type')
      .gte('created_at', from)
      .lt('created_at', toExclusive)
      .order('created_at', { ascending: false })
      .limit(2000),
  );
}

/** Latest 300 entries across all tenants with tenant name (platform admin audit view). */
export function listPlatformAuditLogs() {
  return q(
    supabase
      .from('audit_logs')
      .select('id,created_at,action,entity_type,actor_type,tenants(business_name)')
      .order('created_at', { ascending: false })
      .limit(300),
  );
}
