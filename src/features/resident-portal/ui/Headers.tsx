/** Resident portal headers: the brand header on Home, and a back/title/action bar on inner screens. */
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Menu } from 'lucide-react';
import { NotificationBell } from '../../communication/components/NotificationBell';
import { PgLogo } from '../../../components/PgLogo';
import type { ResidentProfile } from '../types';

export function BrandHeader({
  p,
  subtitle,
  onMenu,
  overlay = false,
}: {
  p?: ResidentProfile | null;
  subtitle?: string;
  onMenu: () => void;
  overlay?: boolean;
}) {
  const pgName = p?.business_name || p?.building_name || 'PG Resident Portal';
  const sub = subtitle || (p?.building_name ? `${p.building_name} · Resident portal` : 'Resident portal');

  return (
    <header className={`sticky top-0 z-20 -mx-4 px-4 h-16 flex items-center gap-3 ${overlay ? 'resident-brand-header--overlay' : 'resident-brand-header'}`}>
      <button onClick={onMenu} aria-label="Open menu" className="p-2 -ml-2 rounded-xl hover:bg-black/5 cursor-pointer transition-colors">
        <Menu className="size-6 text-[#30271F]" />
      </button>

      {/* Specific PG Logo (or monogram fallback) */}
      <PgLogo logoUrl={p?.logo_url} name={pgName} size="sm" />

      <div className="flex-1 leading-tight min-w-0">
        <p className="resident-brand-name text-[18px] font-bold tracking-tight text-[#30271F] truncate">{pgName}</p>
        <p className="resident-brand-subtitle text-[11.5px] text-[#77736B] truncate">{sub}</p>
      </div>

      <NotificationBell />
    </header>
  );
}

/** Centered title with a back arrow (defaults to Home) and an optional right-hand action. */
export function TopBar({ title, back = '/resident', action }: { title: string; back?: string | null; action?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="resident-subpage-header sticky top-0 z-20 backdrop-blur -mx-4 px-4 h-14 grid grid-cols-[40px_1fr_40px] items-center">
      {back ? (
        <button onClick={() => nav(back)} aria-label="Back" className="p-2 -ml-2 rounded-lg hover:bg-white/70 cursor-pointer">
          <ArrowLeft className="size-5" />
        </button>
      ) : (
        <span />
      )}
      <h1 className="text-center text-[17px] font-semibold truncate">{title}</h1>
      <div className="flex justify-end">{action}</div>
    </header>
  );
}
