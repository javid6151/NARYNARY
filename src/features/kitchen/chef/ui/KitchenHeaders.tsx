/** Kitchen portal headers: brand header on Home, back/title bar (with optional subtitle) on inner screens. */
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChefHat, Menu } from 'lucide-react';
import { NotificationBell } from '../../../communication/components/NotificationBell';
import { Avatar } from '../../../../components/ui';

export function KitchenBrandHeader({ name, onMenu }: { name: string; onMenu: () => void }) {
  const nav = useNavigate();
  return (
    <header className="sticky top-0 z-20 bg-[#FFFEFC]/92 backdrop-blur-md border-b border-[#DED6CB] -mx-4 px-4 h-16 flex items-center gap-3 shadow-2xs mb-4">
      <button
        onClick={onMenu}
        aria-label="Open menu"
        className="p-2 -ml-2 rounded-xl hover:bg-[#ECE5DA] text-[#30271F] cursor-pointer transition-colors"
      >
        <Menu className="size-5" />
      </button>

      <div className="flex items-center gap-2.5">
        <div className="size-9 rounded-xl bg-[#343B2B] text-white flex items-center justify-center font-bold text-base shadow-sm">
          <span>Z</span>
        </div>
        <div className="leading-tight min-w-0">
          <span className="font-bold text-[16px] text-[#30271F] block leading-tight">ZIPNARY</span>
          <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[#77736B]">Chef & Kitchen</span>
        </div>
      </div>

      <div className="flex-1" />

      <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#EBF0E6] text-[#343B2B] border border-[#CAD7BF]">
        <ChefHat className="size-3.5 text-[#343B2B]" />
        Chef Portal
      </span>

      <NotificationBell />

      <button
        onClick={() => nav('/kitchen/profile')}
        aria-label="Profile"
        className="cursor-pointer transition-transform hover:scale-105 active:scale-95"
      >
        <Avatar name={name || 'Chef'} size={34} />
      </button>
    </header>
  );
}

export function KitchenTopBar({
  title,
  subtitle,
  back = '/kitchen',
  action,
}: {
  title: string;
  subtitle?: string;
  back?: string | null;
  action?: ReactNode;
}) {
  const nav = useNavigate();
  return (
    <header className="sticky top-0 z-20 bg-[#FFFEFC]/92 backdrop-blur-md border-b border-[#DED6CB] -mx-4 px-4 min-h-14 py-2.5 grid grid-cols-[40px_1fr_40px] items-center shadow-2xs mb-4">
      {back ? (
        <button
          onClick={() => nav(back)}
          aria-label="Back"
          className="p-2 -ml-2 rounded-xl hover:bg-[#ECE5DA] text-[#30271F] cursor-pointer transition-colors"
        >
          <ArrowLeft className="size-5" />
        </button>
      ) : (
        <span />
      )}
      <div className="text-center min-w-0">
        <h1 className="text-[16px] font-bold text-[#30271F] truncate">{title}</h1>
        {subtitle && <p className="text-[11.5px] text-[#77736B] truncate">{subtitle}</p>}
      </div>
      <div className="flex justify-end">{action}</div>
    </header>
  );
}
