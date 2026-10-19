/**
 * ZIPCO platform admin portal (`/platform/*`): onboarding review, building requests, tenants,
 * plans and the cross-tenant audit log. Access requires an active `platform_admins` row.
 */
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { Briefcase, Building2, ClipboardCheck, CreditCard, LogOut, ScrollText } from 'lucide-react';
import { cx } from '../../lib/cx';
import { useAuth } from '../access/useAuth';
import { Logo } from '../../components/Logo';
import { Audit } from './screens/Audit';
import { BuildingQueue } from './screens/BuildingQueue';
import { OnboardingQueue } from './screens/OnboardingQueue';
import { Plans } from './screens/Plans';
import { Tenants } from './screens/Tenants';

const NAV = [
  { to: '/platform', label: 'Onboarding', icon: ClipboardCheck, end: true },
  { to: '/platform/buildings', label: 'Building requests', icon: Building2 },
  { to: '/platform/tenants', label: 'Tenants', icon: Briefcase },
  { to: '/platform/plans', label: 'Plans', icon: CreditCard },
  { to: '/platform/audit', label: 'Audit log', icon: ScrollText },
];

export default function PlatformApp() {
  const { signOut } = useAuth();
  const nav = useNavigate();
  return (
    <div className="min-h-full">
      <header className="bg-nav text-white">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
          <Logo dark subtitle="ZIPCO Platform Admin" />
          <nav className="flex gap-1 overflow-x-auto ml-4" aria-label="Platform">
            {NAV.map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                end={i.end}
                className={({ isActive }) =>
                  cx(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] whitespace-nowrap',
                    isActive ? 'bg-brand-600' : 'text-nav-text hover:bg-white/5',
                  )
                }
              >
                <i.icon className="size-4" aria-hidden />
                {i.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex-1" />
          <button
            aria-label="Sign out"
            onClick={async () => {
              await signOut();
              nav('/login');
            }}
            className="p-2 rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <LogOut className="size-5" />
          </button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
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
