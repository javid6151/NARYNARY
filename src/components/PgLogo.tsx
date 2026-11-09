import { useState, useEffect } from 'react';
import { cx } from '../lib/cx';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://spvsomgqvyzlfrvnucbl.supabase.co';

interface PgLogoProps {
  tenantId?: string | null;
  logoUrl?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  alt?: string;
}

const SIZE_MAP = {
  xs: 'size-7 text-xs rounded-lg',
  sm: 'size-8 text-sm rounded-xl',
  md: 'size-10 text-base rounded-xl',
  lg: 'size-12 text-lg rounded-2xl',
  xl: 'size-16 text-2xl rounded-2xl',
};

export function PgLogo({
  tenantId,
  logoUrl,
  name = 'PG',
  size = 'md',
  className,
  alt,
}: PgLogoProps) {
  const [imgError, setImgError] = useState(false);
  const [version, setVersion] = useState<number>(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('zipco_pg_logo_ts') : null;
      return stored ? Number(stored) : 0;
    } catch {
      return 0;
    }
  });

  const sizeClasses = SIZE_MAP[size] || SIZE_MAP.md;
  const initial = (name.trim() ? name.trim().charAt(0) : 'P').toUpperCase();

  useEffect(() => {
    const onLogoUpdated = () => {
      setImgError(false);
      setVersion(Date.now());
    };
    window.addEventListener('pg_logo_updated', onLogoUpdated);
    window.addEventListener('storage', onLogoUpdated);
    return () => {
      window.removeEventListener('pg_logo_updated', onLogoUpdated);
      window.removeEventListener('storage', onLogoUpdated);
    };
  }, []);

  // Primary URL is explicit logoUrl; fallback is the standard tenant logo in public pg-logos bucket
  let primaryUrl: string | null = null;
  if (logoUrl) {
    if (logoUrl.startsWith('data:')) {
      primaryUrl = logoUrl;
    } else {
      const sep = logoUrl.includes('?') ? '&' : '?';
      primaryUrl = version ? `${logoUrl}${sep}v=${version}` : logoUrl;
    }
  } else if (tenantId) {
    primaryUrl = `${SUPABASE_URL}/storage/v1/object/public/pg-logos/${tenantId}.png${version ? `?v=${version}` : ''}`;
  }

  useEffect(() => {
    setImgError(false);
  }, [primaryUrl]);

  if (primaryUrl && !imgError) {
    return (
      <img
        src={primaryUrl}
        alt={alt || `${name} Logo`}
        onError={() => setImgError(true)}
        className={cx(
          sizeClasses,
          'object-cover border border-[#DED6CB] shadow-2xs shrink-0 bg-white select-none',
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cx(
        sizeClasses,
        'bg-[#343B2B] text-white flex items-center justify-center font-bold shadow-2xs shrink-0 select-none',
        className,
      )}
      aria-hidden
    >
      <span>{initial}</span>
    </div>
  );
}
