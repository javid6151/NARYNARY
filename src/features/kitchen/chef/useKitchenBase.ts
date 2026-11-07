import { useParams } from 'react-router-dom';
import { useAuth } from '../../access/useAuth';
import { useBuilding } from '../../access/useBuilding';
import { toSlug } from '../../access/api';

/**
 * Returns the scoped SaaS base path for the Kitchen/Chef portal,
 * ensuring the URL always contains the PG business name and PG building name.
 * e.g. /sunshine-pg/sunshine-boys-pg/chef
 */
export function useKitchenBase(): string {
  const { tenantSlug, pgSlug } = useParams<{ tenantSlug?: string; pgSlug?: string }>();
  const { chef, staff, access, tenantSlug: authTenantSlug } = useAuth();
  const { building, buildings } = useBuilding();

  const activeBuilding = building || buildings[0];
  const tName = chef?.tenant_name || staff?.tenant_name || access?.memberships?.[0]?.tenant_name || '';
  const bName = activeBuilding?.name || '';

  const tSlug = tenantSlug || authTenantSlug || (tName ? toSlug(tName) : '') || 'pg';
  const bSlug = (pgSlug && pgSlug !== 'main') ? pgSlug : (bName ? toSlug(bName) : '') || 'main';

  return `/${tSlug}/${bSlug}/chef`;
}
