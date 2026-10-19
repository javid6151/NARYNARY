/** Resident bottom navigation: Home, Payments, a raised Community (chat) button, Notices, Profile. */
import { NavLink } from 'react-router-dom';
import { Home, Megaphone, MessageSquareText, User, Wallet } from 'lucide-react';
import { cx } from '../../../lib/cx';

const LEFT = [
  { to: '/resident', label: 'Home', icon: Home, end: true },
  { to: '/resident/payments', label: 'Payments', icon: Wallet },
];
const RIGHT = [
  { to: '/resident/notices', label: 'Notices', icon: Megaphone },
  { to: '/resident/profile', label: 'Profile', icon: User },
];

function Tab({ to, label, icon: Icon, end }: (typeof LEFT)[number]) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cx('flex flex-col items-center gap-1 pt-2.5 pb-2 text-[11.5px]', isActive ? 'text-brand-600 font-semibold' : 'text-muted')
      }
    >
      <Icon className="size-[22px]" aria-hidden />
      {label}
    </NavLink>
  );
}

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30" aria-label="Resident">
      <div className="max-w-md mx-auto bg-white border-t border-line grid grid-cols-5 shadow-[0_-4px_16px_rgba(20,20,40,0.04)]">
        {LEFT.map((t) => <Tab key={t.to} {...t} />)}
        <div className="flex justify-center">
          <NavLink
            to="/resident/community"
            aria-label="Community chat"
            className={({ isActive }) =>
              cx(
                '-mt-6 size-[60px] rounded-full grid place-items-center text-white shadow-lg shadow-brand-600/30 ring-4 ring-white',
                isActive ? 'bg-brand-700' : 'bg-brand-600',
              )
            }
          >
            <MessageSquareText className="size-6" aria-hidden />
          </NavLink>
        </div>
        {RIGHT.map((t) => <Tab key={t.to} {...t} />)}
      </div>
    </nav>
  );
}
