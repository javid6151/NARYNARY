/** Resident portal headers: the brand header on Home, and a back/title/action bar on inner screens. */
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Menu } from 'lucide-react';
import { BRAND } from '../../../lib/brand';
import { NotificationBell } from '../../communication/components/NotificationBell';

export function BrandHeader({ subtitle, onMenu }: { subtitle: string; onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-20 bg-canvas/95 backdrop-blur -mx-4 px-4 h-16 flex items-center gap-3">
      <button onClick={onMenu} aria-label="Open menu" className="p-2 -ml-2 rounded-lg hover:bg-white cursor-pointer">
        <Menu className="size-6 text-ink" />
      </button>
      <div className="flex-1 leading-tight">
        <p className="text-[20px] font-bold text-brand-700 tracking-wide">{BRAND}</p>
        <p className="text-[13px] text-ink-2">{subtitle}</p>
      </div>
      <NotificationBell />
    </header>
  );
}

/** Centered title with a back arrow (defaults to Home) and an optional right-hand action. */
export function TopBar({ title, back = '/resident', action }: { title: string; back?: string | null; action?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="sticky top-0 z-20 bg-canvas/95 backdrop-blur -mx-4 px-4 h-14 grid grid-cols-[40px_1fr_40px] items-center">
      {back ? (
        <button onClick={() => nav(back)} aria-label="Back" className="p-2 -ml-2 rounded-lg hover:bg-white cursor-pointer">
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
