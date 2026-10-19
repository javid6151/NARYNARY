/**
 * Each portal can run on its own local port (`npm run dev:portals`). The server for a port is started
 * with `VITE_PORTAL=<id>`; when a signed-in user belongs to a different portal, the app points them
 * to that portal's port. Ports are a convenience only — access is still decided by roles and RLS.
 */
export type PortalId = 'platform' | 'owner' | 'manager' | 'kitchen' | 'resident';

/** In start order. Owner and manager share the `/app` console; managers see only assigned buildings. */
export const PORTALS: { id: PortalId; label: string; port: number; path: string }[] = [
  { id: 'platform', label: 'Platform admin', port: 1000, path: '/platform' },
  { id: 'owner', label: 'Owner', port: 2001, path: '/app' },
  { id: 'manager', label: 'Manager', port: 3000, path: '/app' },
  { id: 'kitchen', label: 'Kitchen', port: 4000, path: '/kitchen' },
  { id: 'resident', label: 'Resident', port: 5000, path: '/resident' },
];

/** The portal this server was started for, or undefined for the all-in-one dev server (5173). */
export const CURRENT_PORTAL = PORTALS.find((p) => p.id === (import.meta.env.VITE_PORTAL as string | undefined));

export const portalUrl = (id: PortalId) => {
  const p = PORTALS.find((x) => x.id === id)!;
  return `http://localhost:${p.port}${p.path}`;
};
