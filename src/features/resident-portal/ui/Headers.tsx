/** Resident portal headers: the brand header on Home, and a back/title/action bar on inner screens. */
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Menu } from 'lucide-react';
import { BRAND } from '../../../lib/brand';
import { NotificationBell } from '../../communication/components/NotificationBell';

export function BrandHeader({ subtitle, onMenu, overlay = false }: { subtitle: string; onMenu: () => void; overlay?: boolean }) {
  return (
    <header className={`sticky top-0 z-20 -mx-4 px-4 h-16 flex items-center gap-3 ${overlay ? 'resident-brand-header--overlay' : 'resident-brand-header'}`}>
      <button onClick={onMenu} aria-label="Open menu" className="p-2 -ml-2 rounded-lg hover:bg-white/10 cursor-pointer">
        <Menu className="size-6" />
      </button>
      <div className="flex-1 leading-tight">
        <p className="resident-brand-name text-[20px] font-bold tracking-wide">{BRAND}</p>
        <p className="resident-brand-subtitle text-[12px] opacity-75">{subtitle}</p>
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
