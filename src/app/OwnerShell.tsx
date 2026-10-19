/**
 * Dedicated Owner Portal Shell (`/owner/*` or `/:tenantSlug/owner/*`).
 * Full business controls: all buildings, Settings, subscriptions, financial reports.
 */
import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Users, UserPlus, Wallet, Receipt, MessageSquareWarning, Wrench, UtensilsCrossed,
  Package, UserCog, Megaphone, FileBarChart, Settings, LogOut, Menu, X, ChefHat, Home, Shield,
} from 'lucide-react';
import { useAuth } from '../features/access/useAuth';
import { NotificationBell } from '../features/communication/components/NotificationBell';
import { Avatar } from '../components/ui';
import { cx } from '../lib/cx';
import { Logo } from '../components/Logo';

export function OwnerShell() {
  const { staff, chef, access, signOut, tenantSlug } = useAuth();
  const { tenantSlug: paramSlug } = useParams();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();

  const base = paramSlug ? `/${paramSlug}/owner` : '/owner';
  const residentBase = paramSlug ? `/${paramSlug}/resident` : (tenantSlug ? `/${tenantSlug}/resident` : '/resident');
  const chefBase = paramSlug ? `/${paramSlug}/chef` : (tenantSlug ? `/${tenantSlug}/chef` : '/chef');

  const navItems = [
    { to: base, label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: `${base}/buildings`, label: 'Buildings & Rooms', icon: Building2 },
    { to: `${base}/residents`, label: 'PG Members', icon: Users },
    { to: `${base}/admissions`, label: 'Admissions', icon: UserPlus },
    { to: `${base}/payments`, label: 'Payments', icon: Wallet },
    { to: `${base}/expenses`, label: 'Expenses', icon: Receipt },
    { to: `${base}/complaints`, label: 'Complaints', icon: MessageSquareWarning },
    { to: `${base}/maintenance`, label: 'Maintenance', icon: Wrench },
    { to: `${base}/food`, label: 'Food / Mess', icon: UtensilsCrossed },
    { to: `${base}/inventory`, label: 'Inventory', icon: Package },
    { to: `${base}/staff`, label: 'Staff & Salaries', icon: UserCog },
    { to: `${base}/communication`, label: 'Communication', icon: Megaphone },
    { to: `${base}/reports`, label: 'Reports', icon: FileBarChart },
    { to: `${base}/settings`, label: 'Settings', icon: Settings },
  ];

  const name = access?.memberships.length ? (staff?.tenant_name ?? 'Owner') : 'Owner';

  const sidebar = (
    <nav aria-label="Owner Main Navigation" className="flex flex-col h-full bg-nav text-nav-text">
      <div className="h-16 px-5 flex items-center justify-between border-b border-white/5">
        <Logo dark subtitle="Owner Portal" />
        <button className="lg:hidden p-1 text-white" onClick={() => setOpen(false)} aria-label="Close menu">
          <X className="size-5" />
        </button>
      </div>

      <div className="px-4 py-2 bg-brand-900/40 border-b border-white/5 flex items-center gap-2 text-xs text-brand-200">
        <Shield className="size-3.5 text-brand-400" />
        <span className="font-semibold tracking-wide uppercase">PG Owner Administration</span>
      </div>

      <ul className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {navItems.map((n) => (
          <li key={n.to}>
            <NavLink
              to={n.to}
              end={n.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition-colors',
                  isActive ? 'bg-brand-600 text-white font-medium shadow-xs' : 'hover:bg-white/5 hover:text-white text-nav-text',
                )
              }
            >
              <n.icon className="size-[18px] shrink-0" aria-hidden />
              {n.label}
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="px-3 pb-2 space-y-0.5 border-t border-white/5 pt-2">
        <NavLink
          to={residentBase}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-purple-200 hover:text-white hover:bg-white/5 transition-colors"
          onClick={() => setOpen(false)}
        >
          <Home className="size-4 text-purple-400" />
          Resident portal
        </NavLink>
        {chef && (
          <NavLink
            to={chefBase}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] hover:bg-white/5 text-nav-text hover:text-white"
            onClick={() => setOpen(false)}
          >
            <ChefHat className="size-4" />
            Kitchen portal
          </NavLink>
        )}
      </div>

      <div className="m-3 p-3 rounded-xl bg-nav-2 flex items-center gap-3 border border-white/5">
        <Avatar name={staff?.tenant_name ?? 'Owner'} size={34} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-white font-semibold truncate">{name}</p>
          <span className="inline-block text-[11px] font-medium px-1.5 py-0.2 rounded bg-brand-500/30 text-brand-200 border border-brand-400/30">
            Owner
          </span>
        </div>
        <button
          onClick={async () => {
            await signOut();
            nav('/login');
          }}
          aria-label="Sign out"
          title="Sign out"
          className="p-1.5 rounded-md hover:bg-white/10 text-nav-text hover:text-white cursor-pointer transition-colors"
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
          <Logo subtitle="Owner" />
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md bg-purple-50 text-brand-800 border border-brand-200">
          Owner Portal
        </span>
        <div className="flex-1" />
        <span className="hidden sm:inline text-[13px] text-muted">
          {staff?.tenant_name} <span className="tabular">· {staff?.tenant_code}</span>
        </span>
        <NavLink
          to={residentBase}
          className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer"
          title="Open Resident Portal"
        >
          <Home className="size-3.5 text-brand-600" />
          Resident Portal
        </NavLink>
        <NotificationBell />
      </header>
      <main className="px-4 py-6 lg:px-8 max-w-[1440px]">
        <Outlet />
      </main>
    </div>
  );
}
