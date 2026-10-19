/** Slide-in menu opened from the Home header: every resident screen plus sign out. */
import { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Home, LogOut, Megaphone, MessageSquareText, MessageSquareWarning, Ticket, User, UtensilsCrossed, Vote, Wallet, X,
} from 'lucide-react';
import { cx } from '../../../lib/cx';
import { useAuth } from '../../access/useAuth';
import { Avatar } from '../../../components/ui';
import type { ResidentProfile } from '../types';

const LINKS = [
  { to: '/resident', label: 'Home', icon: Home, end: true },
  { to: '/resident/payments', label: 'Payments & receipts', icon: Wallet },
  { to: '/resident/meals', label: 'Meals', icon: UtensilsCrossed },
  { to: '/resident/complaints', label: 'Complaints', icon: MessageSquareWarning },
  { to: '/resident/visitors', label: 'Visitor passes', icon: Ticket },
  { to: '/resident/community', label: 'Community', icon: MessageSquareText },
  { to: '/resident/community/polls', label: 'Polls', icon: Vote },
  { to: '/resident/notices', label: 'Notices', icon: Megaphone },
  { to: '/resident/profile', label: 'Profile', icon: User },
];

export function SideMenu({ p, open, onClose }: { p: ResidentProfile; open: boolean; onClose: () => void }) {
  const { signOut } = useAuth();
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
        <div className="p-5 bg-brand-600 text-white flex items-center gap-3">
          <Avatar name={p.full_name} size={44} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{p.full_name}</p>
            <p className="text-[12px] text-brand-100 truncate">Room {p.room_number} · {p.building_name}</p>
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
                  cx('flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px]', isActive ? 'bg-brand-50 text-brand-700 font-medium' : 'hover:bg-subtle')
                }
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </NavLink>
            </li>
          ))}
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
