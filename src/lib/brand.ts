/** Brand name is configuration (AGENTS.md: don't hardcode provisional naming into core logic). */
export const BRAND = (import.meta.env.VITE_BRAND_NAME as string | undefined) ?? 'ZIPNARY';
