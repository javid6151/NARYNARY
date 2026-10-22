/**
 * ZIPCO platform admin portal (`/platformadmin/*`): onboarding review, building requests, tenants,
 * plans and the cross-tenant audit log. Access requires an active `platform_admins` row.
 * Redesigned with the ZIPNARY Enterprise design system (Warm Ivory, Porcelain White, Deep Olive).
 */
import { useState } from 'react';
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import {
  Briefcase, Building2, ClipboardCheck, CreditCard, KeyRound, LogOut,
  ScrollText, ShieldAlert
} from 'lucide-react';
import { cx } from '../../lib/cx';
import { useAuth } from '../access/useAuth';
import { Audit } from './screens/Audit';
import { BuildingQueue } from './screens/BuildingQueue';
import { OnboardingQueue } from './screens/OnboardingQueue';
import { Plans } from './screens/Plans';
import { Tenants } from './screens/Tenants';
import { SuperAdminPasswordModal } from './components/SuperAdminPasswordModal';
import '../owner/owner-portal.css';

const NAV = [
  { to: '/platformadmin', label: 'Onboarding', icon: ClipboardCheck, end: true },
  { to: '/platformadmin/buildings', label: 'Building Requests', icon: Building2 },
  { to: '/platformadmin/tenants', label: 'Tenant Directory', icon: Briefcase },
  { to: '/platformadmin/plans', label: 'Subscription Plans', icon: CreditCard },
  { to: '/platformadmin/audit', label: 'Audit Log', icon: ScrollText },
];

export default function PlatformApp() {
  const { signOut } = useAuth();
  const nav = useNavigate();
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  return (
    <div className="owner-portal platform-portal min-h-screen bg-[#F5F0E8] text-[#30271F]">
      {/* Super Admin Glassmorphic Header */}
      <header className="sticky top-0 z-20 h-16 bg-[#FFFEFC]/92 backdrop-blur-md border-b border-[#DED6CB] shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center gap-4">
          {/* Brand Mark */}
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-[#343B2B] text-white flex items-center justify-center font-bold text-lg shadow-sm">
              <span>Z</span>
            </div>
            <div>
              <span className="font-bold text-[17px] tracking-tight text-[#30271F] block leading-tight">ZIPNARY</span>
              <span className="text-[10.5px] font-semibold tracking-wider text-[#77736B] uppercase">Super Admin</span>
            </div>
          </div>

          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#EBF0E6] text-[#343B2B] border border-[#CAD7BF]">
            <ShieldAlert className="size-3.5 text-[#343B2B]" />
            Platform Console
          </span>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1 overflow-x-auto ml-2 sm:ml-4 owner-scrollbar py-1" aria-label="Platform">
            {NAV.map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                end={i.end}
                className={({ isActive }) =>
                  cx(
                    'flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-medium whitespace-nowrap transition-all duration-150',
                    isActive
                      ? 'bg-[#343B2B] text-white shadow-xs'
                      : 'text-[#30271F] hover:bg-[#ECE5DA]',
                  )
                }
              >
                <i.icon className="size-4 shrink-0" aria-hidden />
                <span>{i.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="flex-1" />

          {/* Action Buttons */}
          <button
            aria-label="Change Super Admin Password"
            title="Change Super Admin Password"
            onClick={() => setShowPasswordModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FFFEFC] hover:bg-[#ECE5DA] text-[#30271F] border border-[#DED6CB] shadow-2xs cursor-pointer transition-colors"
          >
            <KeyRound className="size-3.5 text-[#343B2B]" />
            <span className="hidden md:inline">Change Password</span>
          </button>

          <button
            aria-label="Sign out"
            title="Sign out"
            onClick={async () => {
              await signOut();
              nav('/');
            }}
            className="p-2 rounded-xl hover:bg-[#FDF1EC] text-[#77736B] hover:text-[#B9674B] cursor-pointer transition-colors"
          >
            <LogOut className="size-4.5" />
          </button>
        </div>
      </header>

      <SuperAdminPasswordModal
        open={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-16">
        <Routes>
          <Route index element={<OnboardingQueue />} />
          <Route path="buildings" element={<BuildingQueue />} />
          <Route path="tenants" element={<Tenants />} />
          <Route path="plans" element={<Plans />} />
          <Route path="audit" element={<Audit />} />
        </Routes>
      </main>
    </div>
  );
}
