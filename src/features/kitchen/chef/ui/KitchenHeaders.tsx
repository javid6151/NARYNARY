/** Kitchen portal headers: brand header on Home, back/title bar (with optional subtitle) on inner screens. */
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, Menu } from 'lucide-react';
import { BRAND } from '../../../../lib/brand';
import { initials } from '../../../../lib/format';
import { NotificationBell } from '../../../communication/components/NotificationBell';

export function KitchenBrandHeader({ name, onMenu }: { name: string; onMenu: () => void }) {
  const nav = useNavigate();
  return (
    <header className="sticky top-0 z-20 bg-[#f6f8f6]/95 backdrop-blur -mx-4 px-4 h-16 flex items-center gap-3">
      <button onClick={onMenu} aria-label="Open menu" className="p-2 -ml-2 rounded-lg hover:bg-white cursor-pointer">
        <Menu className="size-6" />
      </button>
      <Home className="size-7 text-kitchen" aria-hidden />
      <div className="flex-1 leading-tight min-w-0">
        <p className="text-[18px] font-bold tracking-wide truncate">{BRAND}</p>
        <p className="text-[12.5px] text-ink-2">Kitchen Staff Portal</p>
      </div>
      <NotificationBell />
      <button
        onClick={() => nav('/kitchen/profile')}
        aria-label="Profile"
        className="size-10 rounded-full bg-[#5b6472] text-white font-semibold grid place-items-center cursor-pointer"
      >
        {initials(name).slice(0, 1) || '?'}
      </button>
    </header>
  );
}

export function KitchenTopBar({ title, subtitle, back = '/kitchen', action }: {
  title: string;
  subtitle?: string;
  back?: string | null;
  action?: ReactNode;
}) {
  const nav = useNavigate();
  return (
    <header className="sticky top-0 z-20 bg-[#f6f8f6]/95 backdrop-blur -mx-4 px-4 min-h-14 py-2 grid grid-cols-[40px_1fr_40px] items-center">
      {back ? (
        <button onClick={() => nav(back)} aria-label="Back" className="p-2 -ml-2 rounded-lg hover:bg-white cursor-pointer">
          <ArrowLeft className="size-5" />
        </button>
      ) : (
        <span />
      )}
      <div className="text-center min-w-0">
        <h1 className="text-[17px] font-semibold truncate">{title}</h1>
        {subtitle && <p className="text-[12.5px] text-muted">{subtitle}</p>}
      </div>
      <div className="flex justify-end">{action}</div>
    </header>
  );
}
