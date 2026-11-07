/**
 * Chef portal shell (`/kitchen/*`), mobile-first with a bottom tab bar
 * (Home, Today's Cooking, Stock, History, Profile) and a side menu for the menu planner and owner console.
 * Chefs see only their assigned buildings; owners/managers can open it too.
 * Fully styled with the ZIPNARY Enterprise design system (Warm Ivory, Porcelain White, Deep Olive).
 */
import { useEffect } from 'react';
import { Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAsync } from '../../../lib/hooks';
import { useAuth } from '../../access/useAuth';
import { useBuilding } from '../../access/useBuilding';
import { toSlug } from '../../access/api';
import { getMyName } from '../api';
import { useKitchenBase } from './useKitchenBase';
import { KitchenCooking } from './KitchenCooking';
import { KitchenHistory } from './KitchenHistory';
import { KitchenHome } from './KitchenHome';
import { KitchenMenu } from './KitchenMenu';
import { KitchenProfile } from './KitchenProfile';
import { KitchenStock } from './KitchenStock';
import { RecordMeal } from './record/RecordMeal';
import { KitchenNav } from './ui/KitchenNav';
import '../../owner/owner-portal.css';

export default function KitchenApp() {
  const { session } = useAuth();
  const me = useAsync(() => (session ? getMyName(session.user.id) : Promise.resolve('')), [session?.user.id]);
  const name = me.data ?? '';
  const base = useKitchenBase();
  const location = useLocation();
  const nav = useNavigate();
  const { tenantSlug, pgSlug } = useParams<{ tenantSlug?: string; pgSlug?: string }>();
  const { loading: buildingLoading, buildings } = useBuilding();

  // Ensure chef URL always contains the PG business name and PG building name
  useEffect(() => {
    if (buildingLoading) return;
    const isUnscoped = !tenantSlug || !pgSlug || (pgSlug === 'main' && buildings.length > 0 && !buildings.some((b) => toSlug(b.name) === 'main'));
    if (isUnscoped) {
      let sub = '';
      if (location.pathname.startsWith('/kitchen')) {
        sub = location.pathname.slice('/kitchen'.length);
      } else if (location.pathname.startsWith('/chef')) {
        sub = location.pathname.slice('/chef'.length);
      } else if (tenantSlug && location.pathname.startsWith(`/${tenantSlug}/chef`)) {
        sub = location.pathname.slice(`/${tenantSlug}/chef`.length);
      } else if (tenantSlug && pgSlug && location.pathname.startsWith(`/${tenantSlug}/${pgSlug}/chef`)) {
        sub = location.pathname.slice(`/${tenantSlug}/${pgSlug}/chef`.length);
      }
      nav(`${base}${sub}${location.search}`, { replace: true });
    }
  }, [buildingLoading, tenantSlug, pgSlug, buildings, base, location.pathname, location.search, nav]);

  return (
    <div className="owner-portal chef-portal min-h-screen bg-[#F5F0E8] text-[#30271F]">
      <div className="max-w-2xl mx-auto px-4 pb-28 pt-2">
        <main className="space-y-4">
          <Routes>
            <Route index element={<KitchenHome name={name} />} />
            <Route path="cooking" element={<KitchenCooking />} />
            <Route path="record/:date/:meal" element={<RecordMeal />} />
            <Route path="menu" element={<KitchenMenu />} />
            <Route path="stock" element={<KitchenStock />} />
            <Route path="history" element={<KitchenHistory />} />
            <Route path="profile" element={<KitchenProfile name={name} />} />
          </Routes>
        </main>
      </div>
      <KitchenNav />
    </div>
  );
}
