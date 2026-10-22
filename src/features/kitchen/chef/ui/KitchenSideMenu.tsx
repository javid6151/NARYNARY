/** Slide-in menu from the kitchen Home header: every kitchen screen, the owner console (staff only) and sign out. */
import { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { CalendarDays, ClipboardList, Headphones, Home, LayoutDashboard, LogOut, Package, User, UtensilsCrossed, X } from 'lucide-react';
import { cx } from '../../../../lib/cx';
import { useAuth } from '../../../access/useAuth';
import { useBuilding } from '../../../access/useBuilding';

const LINKS = [
  { to: '/kitchen', label: 'Home', icon: Home, end: true },
  { to: '/kitchen/cooking', label: 'Today’s cooking', icon: UtensilsCrossed },
  { to: '/kitchen/menu', label: 'Menu planner', icon: CalendarDays },
  { to: '/kitchen/stock', label: 'Stock', icon: Package },
  { to: '/kitchen/history', label: 'Cooking history', icon: ClipboardList },
  { to: '/kitchen/profile', label: 'Profile', icon: User },
];

export function KitchenSideMenu({ name, open, onClose }: { name: string; open: boolean; onClose: () => void }) {
  const { staff, signOut } = useAuth();
  const { building } = useBuilding();
  const nav = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-[#30271F]/40 backdrop-blur-xs" onClick={onClose} aria-hidden />
      <aside role="dialog" aria-modal="true" aria-label="Menu" className="relative h-full w-[82%] max-w-xs bg-[#F5F0E8] text-[#30271F] flex flex-col border-r border-[#DED6CB] shadow-2xl animate-in slide-in-from-left duration-200">
        <div className="p-5 bg-[#343B2B] text-white flex items-center gap-3">
          <div className="size-10 rounded-xl bg-white/10 flex items-center justify-center font-bold text-lg">
            <span>Z</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[15px] truncate">{name || 'Chef'}</p>
            <p className="text-[12px] text-white/75 truncate">{building?.name ?? 'Kitchen Staff'}</p>
          </div>
          <button onClick={onClose} aria-label="Close menu" className="p-1.5 rounded-lg hover:bg-white/15 text-white cursor-pointer transition-colors">
            <X className="size-5" />
          </button>
        </div>

        <ul className="flex-1 overflow-y-auto p-3 space-y-1">
          {LINKS.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                onClick={onClose}
                className={({ isActive }) =>
                  cx(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all',
                    isActive ? 'bg-[#343B2B] text-white shadow-xs' : 'text-[#30271F] hover:bg-[#ECE5DA]',
                  )
                }
              >
                <Icon className="size-[18px]" aria-hidden />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
          {staff && (
            <li className="pt-2 border-t border-[#DED6CB]/60">
              <NavLink to="/app" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] text-[#343B2B] font-semibold bg-[#EBF0E6] hover:bg-[#CAD7BF]">
                <LayoutDashboard className="size-[18px]" aria-hidden />
                Owner Console
              </NavLink>
            </li>
          )}
        </ul>

        {/* Need Help Card */}
        <div className="mx-3 my-2 p-3 rounded-2xl bg-[#ECE5DA]/70 border border-[#DED6CB] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-8 rounded-full bg-[#30271F] text-white flex items-center justify-center shrink-0">
              <Headphones className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-[#30271F] truncate">Need Help?</p>
              <p className="text-[11px] text-[#77736B] truncate">Contact Support</p>
            </div>
          </div>
          <a
            href="mailto:support@zipnary.in"
            className="text-[11px] font-semibold text-[#343B2B] hover:underline"
          >
            Email
          </a>
        </div>

        <div className="p-3 border-t border-[#DED6CB]">
          <button
            onClick={async () => {
              await signOut();
              nav('/');
            }}
            className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold text-[#B9674B] bg-[#FDF1EC] border border-[#F3D7CC] hover:bg-[#FBE5DC] cursor-pointer transition-colors"
          >
            <LogOut className="size-4" aria-hidden />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
