/**
 * Dedicated Owner Portal Shell (`/owner/*` or `/:tenantSlug/owner/*`).
 * Full business controls: all buildings, Settings, subscriptions, financial reports.
 * Redesigned with the ZIPNARY Enterprise design system (Warm Ivory, Porcelain White, Deep Olive).
 */
import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import {
  LayoutDashboard, BedDouble, Users, Wallet, Receipt, MessageSquareWarning, Wrench, UtensilsCrossed,
  Package, UserCog, Megaphone, FileBarChart, Settings, LogOut, Menu, X, ChefHat, KeyRound,
  Headphones, ChevronRight, UserPlus, MoreHorizontal
} from 'lucide-react';
import { useAuth } from '../features/access/useAuth';
import { NotificationBell } from '../features/communication/components/NotificationBell';
import { Avatar } from '../components/ui';
import { cx } from '../lib/cx';
import '../features/owner/owner-portal.css';

export function OwnerShell() {
  const { staff, chef, access, signOut, tenantSlug, profile, session } = useAuth();
  const { tenantSlug: paramSlug, pgSlug: paramPgSlug } = useParams();
  const [open, setOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const nav = useNavigate();

  const base = paramSlug && paramPgSlug
    ? `/${paramSlug}/${paramPgSlug}/owner`
    : paramSlug
    ? `/${paramSlug}/owner`
    : '/owner';
  const chefBase = paramSlug && paramPgSlug
    ? `/${paramSlug}/${paramPgSlug}/chef`
    : paramSlug
    ? `/${paramSlug}/chef`
    : (tenantSlug ? `/${tenantSlug}/chef` : '/chef');

  const navItems = [
    { to: base, label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: `${base}/buildings`, label: 'Rooms', icon: BedDouble },
    { to: `${base}/residents`, label: 'Residents', icon: Users, end: true },
    { to: `${base}/residents/new`, label: 'Admissions', icon: UserPlus },
    { to: `${base}/resident-portal-server`, label: 'Resident Portal Server', icon: KeyRound },
    { to: `${base}/payments`, label: 'Payments', icon: Wallet },
    { to: `${base}/expenses`, label: 'Expenses', icon: Receipt },
    { to: `${base}/food`, label: 'Food & Mess', icon: UtensilsCrossed },
    { to: `${base}/inventory`, label: 'Inventory', icon: Package },
    { to: `${base}/staff`, label: 'Staff', icon: UserCog },
    { to: `${base}/complaints`, label: 'Complaints', icon: MessageSquareWarning },
    { to: `${base}/maintenance`, label: 'Maintenance', icon: Wrench },
    { to: `${base}/communication`, label: 'Notices', icon: Megaphone },
    { to: `${base}/reports`, label: 'Reports', icon: FileBarChart },
    { to: `${base}/settings`, label: 'Settings', icon: Settings },
  ];

  const userPersonName =
    profile?.full_name ||
    session?.user?.user_metadata?.full_name ||
    session?.user?.user_metadata?.name ||
    (access?.is_platform_admin ? 'ZIPCO Admin' : 'Owner');

  const tenantBusinessName =
    staff?.tenant_name || access?.owned_tenant?.business_name || 'ZIPNARY';

  const sidebar = (
    <nav aria-label="Owner Main Navigation" className="flex flex-col h-full bg-[#F5F0E8] text-[#30271F] border-r border-[#DED6CB] select-none">
      {/* Brand Header */}
      <div className="h-18 px-5 flex items-center justify-between border-b border-[#DED6CB]">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-[#343B2B] text-white flex items-center justify-center font-bold text-lg shadow-sm">
            <span>Z</span>
          </div>
          <div>
            <span className="font-bold text-[17px] tracking-tight text-[#30271F] block leading-tight">ZIPNARY</span>
            <span className="text-[11px] font-medium tracking-wide text-[#77736B] uppercase">Property Management</span>
          </div>
        </div>
        <button
          className="lg:hidden p-1.5 rounded-lg hover:bg-[#ECE5DA] text-[#30271F] transition-colors"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <ul className="flex-1 overflow-y-auto py-3 px-3.5 space-y-1 owner-scrollbar">
        {navItems.map((n) => (
          <li key={n.to}>
            <NavLink
              to={n.to}
              end={n.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] transition-all duration-150',
                  isActive
                    ? 'bg-[#343B2B] text-white font-medium shadow-sm active'
                    : 'text-[#30271F] hover:bg-[#ECE5DA] hover:text-[#30271F]',
                )
              }
            >
              <n.icon className="size-[18px] shrink-0" aria-hidden />
              <span>{n.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>

      {/* Portal Cross-Links */}
      {chef && (
        <div className="px-3 pb-2 space-y-1 border-t border-[#DED6CB] pt-2.5">
          <NavLink
            to={chefBase}
            className="flex items-center justify-between rounded-xl px-3 py-2 text-[13px] text-[#30271F] hover:bg-[#ECE5DA] transition-colors"
            onClick={() => setOpen(false)}
          >
            <span className="flex items-center gap-2.5">
              <ChefHat className="size-4" />
              Kitchen portal
            </span>
            <ChevronRight className="size-3.5 text-[#77736B]" />
          </NavLink>
        </div>
      )}

      {/* Need Help Card */}
      <div className="mx-3 my-2 p-3 rounded-2xl bg-[#ECE5DA]/70 border border-[#DED6CB] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-8 rounded-full bg-[#30271F] text-white flex items-center justify-center shrink-0">
            <Headphones className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-[#30271F] truncate">Need Help?</p>
            <p className="text-[11px] text-[#77736B] truncate">Contact Support →</p>
          </div>
        </div>
        <a
          href="mailto:support@zipnary.in"
          className="size-7 rounded-lg bg-white border border-[#DED6CB] text-[#30271F] flex items-center justify-center hover:bg-[#F5F0E8] transition-colors"
          title="Contact Support"
        >
          <ChevronRight className="size-3.5" />
        </a>
      </div>

      {/* Profile & Signout footer */}
      <div className="m-3 mt-1 p-2.5 rounded-2xl bg-[#FFFEFC] flex items-center gap-3 border border-[#DED6CB] shadow-xs">
        <Avatar name={userPersonName} size={36} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-[#30271F] font-semibold truncate leading-tight">{userPersonName}</p>
          <span className="inline-block text-[10.5px] font-medium text-[#77736B]">
            Owner
          </span>
        </div>
        <button
          onClick={async () => {
            await signOut();
            nav('/');
          }}
          aria-label="Sign out"
          title="Sign out"
          className="p-2 rounded-xl hover:bg-[#ECE5DA] text-[#77736B] hover:text-[#B9674B] cursor-pointer transition-colors"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </nav>
  );

  return (
    <div className="owner-portal min-h-screen bg-[#F5F0E8] text-[#30271F]">
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 z-30 shadow-xs">
        {sidebar}
      </aside>

      {/* Mobile Drawer Navigation */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-[#30271F]/40 backdrop-blur-xs" onClick={() => setOpen(false)} aria-hidden />
          <aside className="relative w-76 max-w-[85vw] h-full shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main App Container */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-20 h-16 bg-[#FFFEFC]/92 backdrop-blur-md border-b border-[#DED6CB] flex items-center gap-3 px-4 lg:px-8">
          <button
            className="lg:hidden p-2 -ml-2 rounded-xl hover:bg-[#ECE5DA] text-[#30271F] transition-colors"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>

          {/* Mobile Brand */}
          <div className="lg:hidden flex items-center gap-2">
            <div className="size-7 rounded-lg bg-[#343B2B] text-white flex items-center justify-center font-bold text-xs">
              Z
            </div>
            <span className="font-bold text-[15px] text-[#30271F]">ZIPNARY</span>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs font-medium text-[#77736B] hidden md:inline">
              {tenantBusinessName}
              {staff?.tenant_code && <span className="tabular"> · {staff.tenant_code}</span>}
            </span>
          </div>

          <div className="flex-1" />

          {access?.is_platform_admin && (
            <NavLink
              to="/platform"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-[#343B2B] bg-[#EBF0E6] hover:bg-[#CAD7BF] border border-[#CAD7BF] rounded-xl px-3 py-1.5 transition-colors cursor-pointer"
            >
              ← Super Admin
            </NavLink>
          )}

          <NotificationBell />

          <div className="flex items-center gap-2 pl-1 border-l border-[#DED6CB]">
            <Avatar name={userPersonName} size={34} />
            <div className="hidden md:block text-left">
              <p className="text-[12.5px] font-semibold text-[#30271F] leading-tight truncate max-w-28">
                {userPersonName}
              </p>
              <p className="text-[10.5px] text-[#77736B]">Owner</p>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-[1520px] w-full mx-auto pb-24 lg:pb-10">
          <Outlet />
        </main>

        {/* Mobile Bottom Navigation Bar (as shown in reference image) */}
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#FFFEFC]/95 backdrop-blur-md border-t border-[#DED6CB] px-3 py-2 shadow-lg">
          <div className="flex items-center justify-around">
            <NavLink
              to={base}
              end
              className={({ isActive }) =>
                cx(
                  'flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-[11px] font-medium transition-colors',
                  isActive ? 'text-[#343B2B]' : 'text-[#77736B]',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <LayoutDashboard className={cx('size-5', isActive && 'stroke-[2.25] text-[#343B2B]')} />
                  <span>Home</span>
                </>
              )}
            </NavLink>

            <NavLink
              to={`${base}/buildings`}
              className={({ isActive }) =>
                cx(
                  'flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-[11px] font-medium transition-colors',
                  isActive ? 'text-[#343B2B]' : 'text-[#77736B]',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <BedDouble className={cx('size-5', isActive && 'stroke-[2.25] text-[#343B2B]')} />
                  <span>Rooms</span>
                </>
              )}
            </NavLink>

            <NavLink
              to={`${base}/residents`}
              end
              className={({ isActive }) =>
                cx(
                  'flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-[11px] font-medium transition-colors',
                  isActive ? 'text-[#343B2B]' : 'text-[#77736B]',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Users className={cx('size-5', isActive && 'stroke-[2.25] text-[#343B2B]')} />
                  <span>Residents</span>
                </>
              )}
            </NavLink>

            <NavLink
              to={`${base}/payments`}
              className={({ isActive }) =>
                cx(
                  'flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-[11px] font-medium transition-colors',
                  isActive ? 'text-[#343B2B]' : 'text-[#77736B]',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Wallet className={cx('size-5', isActive && 'stroke-[2.25] text-[#343B2B]')} />
                  <span>Payments</span>
                </>
              )}
            </NavLink>

            <button
              onClick={() => setMoreMenuOpen(true)}
              className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-[11px] font-medium text-[#77736B] hover:text-[#30271F]"
            >
              <MoreHorizontal className="size-5" />
              <span>More</span>
            </button>
          </div>
        </div>

        {/* Mobile "More" Drawer */}
        {moreMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-[#30271F]/40 backdrop-blur-xs" onClick={() => setMoreMenuOpen(false)} />
            <div className="absolute bottom-0 inset-x-0 bg-[#FFFEFC] rounded-t-3xl border-t border-[#DED6CB] p-5 shadow-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
              <div className="w-12 h-1 bg-[#DED6CB] rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#DED6CB]">
                <h3 className="font-bold text-base text-[#30271F]">More Modules</h3>
                <button onClick={() => setMoreMenuOpen(false)} className="p-1 rounded-lg hover:bg-[#ECE5DA]">
                  <X className="size-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pb-6">
                {[
                  { to: `${base}/residents/new`, label: 'Admissions', icon: UserPlus },
                  { to: `${base}/expenses`, label: 'Expenses', icon: Receipt },
                  { to: `${base}/food`, label: 'Food & Mess', icon: UtensilsCrossed },
                  { to: `${base}/inventory`, label: 'Inventory', icon: Package },
                  { to: `${base}/staff`, label: 'Staff & Salaries', icon: UserCog },
                  { to: `${base}/complaints`, label: 'Complaints', icon: MessageSquareWarning },
                  { to: `${base}/maintenance`, label: 'Maintenance', icon: Wrench },
                  { to: `${base}/communication`, label: 'Notices', icon: Megaphone },
                  { to: `${base}/reports`, label: 'Reports', icon: FileBarChart },
                  { to: `${base}/settings`, label: 'Settings', icon: Settings },
                ].map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMoreMenuOpen(false)}
                    className="flex items-center gap-2.5 p-3 rounded-2xl border border-[#DED6CB] bg-[#F5F0E8]/50 hover:bg-[#EBF0E6] text-[#30271F] text-xs font-semibold"
                  >
                    <item.icon className="size-4 text-[#343B2B]" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                ))}
              </div>

              <div className="pt-3 border-t border-[#DED6CB] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Avatar name={userPersonName} size={32} />
                  <span className="text-xs font-semibold text-[#30271F]">{userPersonName}</span>
                </div>
                <button
                  onClick={async () => {
                    setMoreMenuOpen(false);
                    await signOut();
                    nav('/');
                  }}
                  className="flex items-center gap-1.5 text-xs text-[#B9674B] font-semibold px-3 py-1.5 rounded-xl bg-[#FDF1EC]"
                >
                  <LogOut className="size-3.5" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
