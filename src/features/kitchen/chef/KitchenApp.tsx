/**
 * Chef portal shell (`/kitchen/*`), mobile-first with a bottom tab bar
 * (Home, Today's Cooking, Stock, History, Profile) and a side menu for the menu planner and owner console.
 * Chefs see only their assigned buildings; owners/managers can open it too.
 */
import { Route, Routes } from 'react-router-dom';
import { useAsync } from '../../../lib/hooks';
import { useAuth } from '../../access/useAuth';
import { getMyName } from '../api';
import { KitchenCooking } from './KitchenCooking';
import { KitchenHistory } from './KitchenHistory';
import { KitchenHome } from './KitchenHome';
import { KitchenMenu } from './KitchenMenu';
import { KitchenProfile } from './KitchenProfile';
import { KitchenStock } from './KitchenStock';
import { RecordMeal } from './record/RecordMeal';
import { KitchenNav } from './ui/KitchenNav';

export default function KitchenApp() {
  const { session } = useAuth();
  const me = useAsync(() => (session ? getMyName(session.user.id) : Promise.resolve('')), [session?.user.id]);
  const name = me.data ?? '';
  return (
    <div className="min-h-full bg-[#f6f8f6]">
      <div className="max-w-lg mx-auto px-4 pb-28">
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
