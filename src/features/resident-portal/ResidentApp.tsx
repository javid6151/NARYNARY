/**
 * Resident portal (`/resident/*`), a mobile-first single column with a bottom tab bar
 * (Home, Payments, Community chat button, Notices, Profile) and a side menu for everything else.
 * Loads the resident's current stay first; without an active admission it shows an empty state.
 */
import { Route, Routes } from 'react-router-dom';
import { useAsync } from '../../lib/hooks';
import { Card, Empty, LoadError, Loading } from '../../components/ui';
import { getMyProfile } from './api';
import { BirthdaysScreen } from './community/BirthdaysScreen';
import { ChatScreen } from './community/ChatScreen';
import { Community } from './community/Community';
import { PollsScreen } from './community/PollsScreen';
import { PostsScreen } from './community/PostsScreen';
import { VisitorPasses } from './community/VisitorPasses';
import { ResComplaints } from './tabs/ResComplaints';
import { ResHome } from './tabs/ResHome';
import { ResMeals } from './tabs/ResMeals';
import { ResNotices } from './tabs/ResNotices';
import { ResPayments } from './tabs/ResPayments';
import { ResProfile } from './tabs/ResProfile';
import { BottomNav } from './ui/BottomNav';
import { BrandHeader } from './ui/Headers';

export default function ResidentApp() {
  const prof = useAsync(() => getMyProfile(), []);
  if (prof.error) return <LoadError error={prof.error} retry={prof.reload} />;
  if (prof.loading && !prof.data) {
    return (
      <div className="max-w-md mx-auto p-6">
        <Loading />
      </div>
    );
  }
  const p = prof.data;
  return (
    <div className="min-h-full bg-canvas">
      <div className="max-w-md mx-auto min-h-full bg-canvas pb-28 px-4 relative">
        {!p ? (
          <>
            <BrandHeader subtitle="PG & Hostel" onMenu={() => undefined} />
            <Card>
              <Empty title="No active stay found">Your PG hasn’t linked an active admission to this account.</Empty>
            </Card>
          </>
        ) : (
          <main className="space-y-4">
            <Routes>
              <Route index element={<ResHome p={p} />} />
              <Route path="payments" element={<ResPayments p={p} />} />
              <Route path="meals" element={<ResMeals p={p} />} />
              <Route path="complaints" element={<ResComplaints />} />
              <Route path="notices" element={<ResNotices />} />
              <Route path="visitors" element={<VisitorPasses />} />
              <Route path="community" element={<Community />} />
              <Route path="community/chat/:id" element={<ChatScreen />} />
              <Route path="community/polls" element={<PollsScreen />} />
              <Route path="community/birthdays" element={<BirthdaysScreen p={p} onProfileChanged={prof.reload} />} />
              <Route path="community/:kind" element={<PostsScreen p={p} />} />
              <Route path="profile" element={<ResProfile p={p} />} />
            </Routes>
          </main>
        )}
        <BottomNav />
      </div>
    </div>
  );
}
