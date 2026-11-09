/** Kitchen portal headers: brand header on Home, back/title bar (with optional subtitle) on inner screens. */
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChefHat, Menu } from 'lucide-react';
import { NotificationBell } from '../../../communication/components/NotificationBell';
import { Avatar } from '../../../../components/ui';
import { PgLogo } from '../../../../components/PgLogo';
import { useAuth } from '../../../access/useAuth';
import { useBuilding } from '../../../access/useBuilding';
import { useKitchenBase } from '../useKitchenBase';

export function KitchenBrandHeader({ name, onMenu }: { name: string; onMenu: () => void }) {
  const nav = useNavigate();
  const base = useKitchenBase();
  const { staff, chef } = useAuth();
  const { building } = useBuilding();
  const tenantBusinessName = chef?.tenant_name || staff?.tenant_name || building?.name || 'PG Kitchen';
  const tenantLogoUrl = chef?.logo_url || staff?.logo_url || null;
  const tenantId = chef?.tenant_id || staff?.tenant_id || building?.tenant_id;

  return (
    <header className="sticky top-0 z-20 bg-[#FFFEFC]/92 backdrop-blur-md border-b border-[#DED6CB] -mx-4 px-4 h-16 flex items-center gap-3 shadow-2xs mb-4">
      <button
        onClick={onMenu}
        aria-label="Open menu"
        className="p-2 -ml-2 rounded-xl hover:bg-[#ECE5DA] text-[#30271F] cursor-pointer transition-colors"
      >
        <Menu className="size-5" />
      </button>

      <div className="flex items-center gap-2.5 min-w-0">
        <PgLogo tenantId={tenantId} logoUrl={tenantLogoUrl} name={tenantBusinessName} size="sm" />
        <span className="font-bold text-[16px] text-[#30271F] truncate">
          {tenantBusinessName}
        </span>
      </div>

      <div className="flex-1" />

      <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#EBF0E6] text-[#343B2B] border border-[#CAD7BF]">
        <ChefHat className="size-3.5 text-[#343B2B]" />
        Chef Portal
      </span>

      <NotificationBell />

      <button
        onClick={() => nav(`${base}/profile`)}
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
  back,
  action,
}: {
  title: string;
  subtitle?: string;
  back?: string | null;
  action?: ReactNode;
}) {
  const nav = useNavigate();
  const base = useKitchenBase();
  const backTarget = back === undefined ? base : back;
  return (
    <header className="sticky top-0 z-20 bg-[#FFFEFC]/92 backdrop-blur-md border-b border-[#DED6CB] -mx-4 px-4 min-h-14 py-2.5 grid grid-cols-[40px_1fr_40px] items-center shadow-2xs mb-4">
      {backTarget ? (
        <button
          onClick={() => nav(backTarget)}
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
