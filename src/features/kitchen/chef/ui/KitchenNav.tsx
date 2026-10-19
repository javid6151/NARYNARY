/** Kitchen bottom navigation: Home, Today's Cooking, Stock, History, Profile. */
import { NavLink } from 'react-router-dom';
import { ClipboardList, Home, Package, User, UtensilsCrossed } from 'lucide-react';
import { cx } from '../../../../lib/cx';

const TABS = [
  { to: '/kitchen', label: 'Home', icon: Home, end: true },
  { to: '/kitchen/cooking', label: 'Today’s Cooking', icon: UtensilsCrossed },
  { to: '/kitchen/stock', label: 'Stock', icon: Package },
  { to: '/kitchen/history', label: 'History', icon: ClipboardList },
  { to: '/kitchen/profile', label: 'Profile', icon: User },
];

export function KitchenNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30" aria-label="Kitchen">
      <div className="max-w-lg mx-auto bg-white border-t border-line grid grid-cols-5">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cx('flex flex-col items-center gap-1 pt-2.5 pb-2 text-[11px] leading-tight text-center', isActive ? 'text-kitchen font-semibold' : 'text-muted')
            }
          >
            <Icon className="size-[22px]" aria-hidden />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
