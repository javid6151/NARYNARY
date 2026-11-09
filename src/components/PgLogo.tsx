import { useState } from 'react';
import { cx } from '../lib/cx';

interface PgLogoProps {
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
  logoUrl,
  name = 'PG',
  size = 'md',
  className,
  alt,
}: PgLogoProps) {
  const [imgError, setImgError] = useState(false);
  const sizeClasses = SIZE_MAP[size] || SIZE_MAP.md;
  const initial = (name.trim() ? name.trim().charAt(0) : 'P').toUpperCase();

  if (logoUrl && !imgError) {
    return (
      <img
        src={logoUrl}
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

