/** Slide-in menu from the kitchen Home header: every kitchen screen, the owner console (staff only) and sign out. */
import { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { CalendarDays, ClipboardList, Home, LayoutDashboard, LogOut, Package, User, UtensilsCrossed, X } from 'lucide-react';
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
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden />
      <aside role="dialog" aria-modal="true" aria-label="Menu" className="relative h-full w-[80%] max-w-xs bg-white flex flex-col">
        <div className="p-5 bg-kitchen text-white flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{name}</p>
            <p className="text-[12px] text-white/75 truncate">{building?.name ?? 'Kitchen'}</p>
          </div>
          <button onClick={onClose} aria-label="Close menu" className="p-1.5 rounded-md hover:bg-white/10 cursor-pointer">
            <X className="size-5" />
          </button>
        </div>
        <ul className="flex-1 overflow-y-auto p-2">
          {LINKS.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                onClick={onClose}
                className={({ isActive }) =>
                  cx('flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px]', isActive ? 'bg-kitchen-50 text-kitchen font-medium' : 'hover:bg-subtle')
                }
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </NavLink>
            </li>
          ))}
          {staff && (
            <li>
              <NavLink to="/app" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] hover:bg-subtle">
                <LayoutDashboard className="size-5" aria-hidden />
                Owner console
              </NavLink>
            </li>
          )}
        </ul>
        <button
          onClick={async () => {
            await signOut();
            nav('/login');
          }}
          className="m-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] text-bad hover:bg-bad-bg cursor-pointer"
        >
          <LogOut className="size-5" aria-hidden />
          Sign out
        </button>
      </aside>
    </div>
  );
}
