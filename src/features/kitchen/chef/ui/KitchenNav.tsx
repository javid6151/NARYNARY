import { NavLink } from 'react-router-dom';
import { ClipboardList, Home, Package, User, UtensilsCrossed } from 'lucide-react';
import { cx } from '../../../../lib/cx';
import { useKitchenBase } from '../useKitchenBase';

export function KitchenNav() {
  const base = useKitchenBase();

  const tabs = [
    { to: base, label: 'Home', icon: Home, end: true },
    { to: `${base}/cooking`, label: 'Cooking', icon: UtensilsCrossed },
    { to: `${base}/stock`, label: 'Stock', icon: Package },
    { to: `${base}/history`, label: 'History', icon: ClipboardList },
    { to: `${base}/profile`, label: 'Profile', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-[#FFFEFC]/95 backdrop-blur-md border-t border-[#DED6CB] shadow-lg" aria-label="Kitchen Navigation">
      <div className="max-w-2xl mx-auto grid grid-cols-5 p-2 gap-1">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cx(
                'flex flex-col items-center justify-center gap-1 py-1.5 px-1 text-[11px] font-medium rounded-xl transition-all',
                isActive
                  ? 'bg-[#EBF0E6] text-[#343B2B] font-bold shadow-2xs'
                  : 'text-[#77736B] hover:text-[#30271F] hover:bg-[#F5F0E8]',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cx('size-5', isActive ? 'text-[#343B2B] stroke-[2.25]' : 'text-[#77736B]')} aria-hidden />
                <span className="truncate">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
