/** Resident bottom navigation: Home, Payments, a raised Community (chat) button, Notices, Profile. */
import { NavLink, useLocation, useParams } from 'react-router-dom';
import { Home, Megaphone, MessageSquareText, User, Wallet } from 'lucide-react';
import { cx } from '../../../lib/cx';

export function BottomNav() {
  const { tenantSlug, pgSlug, uniqueId } = useParams<{ tenantSlug?: string; pgSlug?: string; uniqueId?: string }>();
  const loc = useLocation();
  const tentantWord = loc.pathname.includes('/tentant/') ? 'tentant' : 'tenant';

  const base = tenantSlug && pgSlug && uniqueId
    ? `/${tenantSlug}/${pgSlug}/${tentantWord}/${uniqueId}`
    : tenantSlug && pgSlug
    ? `/${tenantSlug}/${pgSlug}/tentant/me`
    : tenantSlug
    ? `/${tenantSlug}/resident`
    : '/resident';

  const left = [
    { to: base, label: 'Home', icon: Home, end: true },
    { to: `${base}/payments`, label: 'Payments', icon: Wallet, end: false },
  ];
  const right = [
    { to: `${base}/notices`, label: 'Notices', icon: Megaphone, end: false },
    { to: `${base}/profile`, label: 'Profile', icon: User, end: false },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30" aria-label="Resident">
      <div className="max-w-md mx-auto bg-white border-t border-line grid grid-cols-5 shadow-[0_-4px_16px_rgba(20,20,40,0.04)]">
        {left.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cx('flex flex-col items-center gap-1 pt-2.5 pb-2 text-[11.5px]', isActive ? 'text-brand-600 font-semibold' : 'text-muted')
            }
          >
            <Icon className="size-[22px]" aria-hidden />
            {label}
          </NavLink>
        ))}
        <div className="flex justify-center">
          <NavLink
            to={`${base}/community`}
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
        {right.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cx('flex flex-col items-center gap-1 pt-2.5 pb-2 text-[11.5px]', isActive ? 'text-brand-600 font-semibold' : 'text-muted')
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

