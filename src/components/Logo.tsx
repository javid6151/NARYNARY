/** Brand mark + name. The name comes from configuration (`lib/brand.ts`). */
import { BRAND } from '../lib/brand';
import { cx } from '../lib/cx';

export function Logo({ dark, subtitle, tone = 'brand' }: { dark?: boolean; subtitle?: string; tone?: 'brand' | 'kitchen' }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <span
        className={cx(
          'size-9 rounded-lg grid place-items-center text-white font-bold text-[15px] shrink-0',
          tone === 'kitchen' ? 'bg-kitchen' : 'bg-brand-600',
        )}
        aria-hidden
      >
        {BRAND.slice(0, 1)}
      </span>
      <div className="leading-tight min-w-0">
        <div className={cx('font-bold tracking-wide text-[15px] truncate', dark ? 'text-white' : 'text-ink')}>{BRAND}</div>
        {subtitle && <div className={cx('text-[11px] truncate', dark ? 'text-nav-text' : 'text-muted')}>{subtitle}</div>}
      </div>
    </div>
  );
}
