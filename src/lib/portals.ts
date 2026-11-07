/**
 * Each portal can run on its own local port (`npm run dev:portals`). The server for a port is started
 * with `VITE_PORTAL=<id>`; when a signed-in user belongs to a different portal, the app points them
 * to that portal's port. Ports are a convenience only — access is still decided by roles and RLS.
 */
export type PortalId = 'platform' | 'owner' | 'manager' | 'kitchen' | 'resident' | 'public';

export const PORTALS: { id: PortalId; label: string; port: number; path: string }[] = [
  { id: 'platform', label: 'Super Admin', port: 1000, path: '/platformadmin' },
  { id: 'owner', label: 'Owner', port: 2000, path: '/owner' },
  { id: 'manager', label: 'Manager', port: 3000, path: '/manager' },
  { id: 'kitchen', label: 'Chef', port: 4000, path: '/chef' },
  { id: 'resident', label: 'Resident', port: 5000, path: '/resident' },
  { id: 'public', label: 'Public Website', port: 6000, path: '/' },
];

/** The portal this server was started for, detected via VITE_PORTAL or window.location.port. */
export const getActivePortal = (): typeof PORTALS[number] | undefined => {
  const fromEnv = PORTALS.find((p) => p.id === (import.meta.env.VITE_PORTAL as string | undefined));
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined' && window.location.port) {
    const portNum = Number(window.location.port);
    return PORTALS.find((p) => p.port === portNum);
  }
  return undefined;
};

export const CURRENT_PORTAL = getActivePortal();

/**
 * Dynamic URL helper that resolves URLs against the current domain/origin in the browser.
 * Adapts automatically to any connected domain, subdomain, or local host, now and in the future.
 */
export function getPortalBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }
  return '';
}

/**
 * Returns the full dynamic URL for the resident portal on the current domain.
 */
export function getResidentPortalUrl(): string {
  const base = getPortalBaseUrl();
  return base ? `${base}/resident` : '/resident';
}

export const portalUrl = (id: PortalId): string => {
  const p = PORTALS.find((x) => x.id === id);
  if (!p) return '/';
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return `http://localhost:${p.port}${p.path}`;
  }
  const base = getPortalBaseUrl();
  return base ? `${base}${p.path}` : p.path;
};
