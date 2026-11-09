/**
 * Layout for the owner/manager console (`/app/*`): sidebar (drawer on mobile), header with
 * notifications, and the routed page. Settings is listed for owners only; links to the kitchen
 * and resident portals appear when the user also has those roles.
 */
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, BedDouble, Users, Wallet, Receipt, MessageSquareWarning, UtensilsCrossed,
  Package, UserCog, Megaphone, FileBarChart, Settings, LogOut, Menu, X, ChefHat, Home,
} from 'lucide-react';
import { useAuth } from '../features/access/useAuth';
import { NotificationBell } from '../features/communication/components/NotificationBell';
import { Avatar } from '../components/ui';
import { cx } from '../lib/cx';
import { Logo } from '../components/Logo';

const NAV = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/buildings', label: 'Rooms', icon: BedDouble },
  { to: '/app/residents', label: 'PG Members', icon: Users },
  { to: '/app/payments', label: 'Payments', icon: Wallet },
  { to: '/app/expenses', label: 'Expenses', icon: Receipt },
  { to: '/app/complaints', label: 'Complaints', icon: MessageSquareWarning },
  { to: '/app/food', label: 'Food / Mess', icon: UtensilsCrossed },
  { to: '/app/inventory', label: 'Inventory', icon: Package },
  { to: '/app/staff', label: 'Staff', icon: UserCog },
  { to: '/app/communication', label: 'Communication', icon: Megaphone },
  { to: '/app/reports', label: 'Reports', icon: FileBarChart },
  { to: '/app/settings', label: 'Settings', icon: Settings, ownerOnly: true },
];

export function StaffShell() {
  const { staff, chef, resident, access, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const isOwner = staff?.role === 'owner';
  const items = NAV.filter((n) => !n.ownerOnly || isOwner);
  const name = access?.memberships.length ? (staff?.tenant_name ?? '') : '';

  const sidebar = (
    <nav aria-label="Main" className="flex flex-col h-full bg-nav text-nav-text">
      <div className="h-16 px-5 flex items-center justify-between border-b border-white/5">
        <Logo dark subtitle="PG & Hostel Management" />
        <button className="lg:hidden p-1 text-white" onClick={() => setOpen(false)} aria-label="Close menu">
          <X className="size-5" />
        </button>
      </div>
      <ul className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {items.map((n) => (
          <li key={n.to}>
            <NavLink
              to={n.to}
              end={n.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition-colors',
                  isActive ? 'bg-brand-600 text-white' : 'hover:bg-white/5 hover:text-white',
                )
              }
            >
              <n.icon className="size-[18px] shrink-0" aria-hidden />
              {n.label}
            </NavLink>
          </li>
        ))}
      </ul>
      {(chef || resident) && (
        <div className="px-3 pb-2 space-y-0.5">
          {chef && (
            <NavLink to="/kitchen" className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] hover:bg-white/5">
              <ChefHat className="size-4" />
              Kitchen portal
            </NavLink>
          )}
          {resident && (
            <NavLink to="/resident" className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] hover:bg-white/5">
              <Home className="size-4" />
              Resident portal
            </NavLink>
          )}
        </div>
      )}
      <div className="m-3 p-3 rounded-xl bg-nav-2 flex items-center gap-3">
        <Avatar name={staff?.tenant_name ?? 'User'} size={34} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-white font-medium truncate">{name}</p>
          <p className="text-[11.5px] capitalize">{staff?.role}</p>
        </div>
        <button
          onClick={async () => {
            await signOut();
            nav('/');
          }}
          aria-label="Sign out"
          title="Sign out"
          className="p-1.5 rounded-md hover:bg-white/10 cursor-pointer"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-full lg:pl-64">
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 z-30">{sidebar}</aside>
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} aria-hidden />
          <aside className="relative w-72 max-w-[85vw] h-full">{sidebar}</aside>
        </div>
      )}
      <header className="sticky top-0 z-20 h-14 bg-white/90 backdrop-blur border-b border-line flex items-center gap-3 px-4 lg:px-8">
        <button className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-subtle" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu className="size-5" />
        </button>
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="flex-1" />
        <span className="hidden sm:inline text-[13px] text-muted">
          {staff?.tenant_name} <span className="tabular">· {staff?.tenant_code}</span>
        </span>
        <NotificationBell />
      </header>
      <main className="px-4 py-6 lg:px-8 max-w-[1440px]">
        <Outlet />
      </main>
    </div>
  );
}
