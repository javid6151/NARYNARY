/**
 * Chef profile: name, email, role, assigned buildings, owner console (staff only) and sign out.
 * Redesigned with the ZIPNARY Enterprise design system (Warm Ivory, Porcelain White, Deep Olive).
 */
import { useNavigate } from 'react-router-dom';
import { ChefHat, LayoutDashboard, LogOut } from 'lucide-react';
import { useAuth } from '../../access/useAuth';
import { useBuilding } from '../../access/useBuilding';
import { Avatar, Button, Card } from '../../../components/ui';
import { KitchenTopBar } from './ui/KitchenHeaders';

export function KitchenProfile({ name }: { name: string }) {
  const { session, chef, staff, signOut } = useAuth();
  const { buildings } = useBuilding();
  const nav = useNavigate();
  const m = chef ?? staff;

  return (
    <>
      <KitchenTopBar title="Chef Profile & Access" />

      <div className="bg-[#FFFEFC] border border-[#DED6CB] rounded-2xl p-5 flex items-center gap-4 shadow-2xs">
        <Avatar name={name || 'Chef'} size={60} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-lg font-bold text-[#30271F] truncate">{name || 'Chef Member'}</p>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#EBF0E6] text-[#343B2B] border border-[#CAD7BF] text-[11px] font-bold uppercase">
              <ChefHat className="size-3" />
              Kitchen Staff
            </span>
          </div>
          <p className="text-[13px] text-[#77736B] truncate mt-0.5">{session?.user.email}</p>
        </div>
      </div>

      <Card title="Kitchen Operational Access" className="bg-[#FFFEFC] border-[#DED6CB] rounded-2xl shadow-2xs">
        <dl className="grid grid-cols-2 gap-y-2.5 text-[13.5px]">
          <dt className="text-[#77736B]">PG Enterprise</dt>
          <dd className="text-right font-semibold text-[#30271F]">{m?.tenant_name || 'ZIPNARY'}</dd>
          <dt className="text-[#77736B]">Assigned Role</dt>
          <dd className="text-right capitalize font-semibold text-[#343B2B]">{m?.role || 'Chef'}</dd>
          <dt className="text-[#77736B]">Authorized Buildings</dt>
          <dd className="text-right font-medium text-[#30271F]">{buildings.map((b) => b.name).join(', ') || '—'}</dd>
        </dl>
        <p className="text-[11.5px] text-[#77736B] mt-3.5 pt-3 border-t border-[#DED6CB] leading-relaxed">
          The kitchen staff portal provides strict operational access to daily menus, meal responses, and ingredient balances. Financial KYC and resident ledger data are restricted per policy.
        </p>
      </Card>

      {staff && (
        <Button
          variant="secondary"
          className="w-full rounded-xl py-3 border-[#DED6CB]"
          onClick={() => nav('/app')}
        >
          <LayoutDashboard className="size-4 text-[#343B2B]" />
          Open Owner Console
        </Button>
      )}

      <button
        onClick={async () => {
          await signOut();
          nav('/');
        }}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-[14px] font-semibold text-[#B9674B] bg-[#FDF1EC] border border-[#F3D7CC] hover:bg-[#FBE5DC] cursor-pointer transition-colors shadow-2xs"
      >
        <LogOut className="size-4" />
        <span>Sign Out</span>
      </button>
    </>
  );
}
