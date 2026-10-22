/**
 * Resident portal (`/resident/*`), a mobile-first single column with a bottom tab bar
 * (Home, Payments, Community chat button, Notices, Profile) and a side menu for everything else.
 * Accessible to residents, as well as owners and managers for viewing/troubleshooting.
 */
import { useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { useAsync } from '../../lib/hooks';
import { Card, Empty, LoadError, Loading } from '../../components/ui';
import { useAuth } from '../access/useAuth';
import { useBuilding } from '../access/useBuilding';
import { listActiveResidents } from '../residents/api';
import type { ResidentRow } from '../residents/types';
import type { ResidentProfile } from './types';
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
import { AccountSuspended } from '../../components/AccountSuspended';
import './resident-portal.css';

export default function ResidentApp() {
  const { staff, isSuspended } = useAuth();
  if (isSuspended) return <AccountSuspended />;
  const { buildingId, building } = useBuilding();
  const [selectedResId, setSelectedResId] = useState<string>('');

  const prof = useAsync(() => getMyProfile(), []);
  const activeResidents = useAsync(
    () => (staff && buildingId ? listActiveResidents(buildingId) : Promise.resolve([] as ResidentRow[])),
    [staff, buildingId]
  );

  if (prof.error && !staff) return <LoadError error={prof.error} retry={prof.reload} />;
  if (prof.loading && !prof.data && !staff) {
    return (
      <div className="max-w-md mx-auto p-6">
        <Loading />
      </div>
    );
  }

  const p = prof.data;

  // If staff member doesn't have a personal stay, or chooses to preview a resident:
  const residentList = activeResidents.data ?? [];
  const selectedResident = residentList.find((r) => r.id === selectedResId) ?? residentList[0];

  const staffPreviewProfile: ResidentProfile | null = selectedResident
    ? {
        resident_id: selectedResident.id,
        full_name: selectedResident.full_name,
        phone: selectedResident.phone,
        email: selectedResident.email,
        business_name: building?.name ?? 'PG Hostel',
        building_id: buildingId ?? selectedResident.building_id ?? '',
        building_name: building?.name ?? 'Main Building',
        building_address: building?.address ?? '',
        floor_name: 'Floor',
        room_number: selectedResident.room_number ?? '101',
        sharing: selectedResident.sharing_capacity ?? 2,
        bed_label: selectedResident.bed_label ?? 'A',
        admission_date: selectedResident.admission_date ?? new Date().toISOString().slice(0, 10),
        monthly_rent: Number(selectedResident.monthly_rent ?? 0),
        security_deposit: Number(selectedResident.monthly_rent ?? 0) * 2,
        mess_included: true,
        share_birthday: false,
        has_birthday: false,
        cutoffs: { breakfast: '09:00:00', lunch: '13:00:00', dinner: '20:30:00', allow_reviews: true },
      }
    : null;

  const effectiveProfile: ResidentProfile | null = (selectedResId && staffPreviewProfile) ? staffPreviewProfile : (p ?? staffPreviewProfile);

  return (
    <div className="resident-portal resident-shell min-h-full">
      <div className="resident-shell__content min-h-full px-4 relative">
        {/* Staff View Switcher Banner */}
        {staff && (
          <div className="resident-staff-banner mt-3 mb-2 border rounded-xl p-3 text-[13px] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold">
                {staff.role === 'owner' ? 'Owner' : 'Manager'} Portal View
              </span>
              <a
                href={
                  typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                    ? (staff.role === 'owner' ? 'http://localhost:2000/owner' : 'http://localhost:3000/manager')
                    : (staff.role === 'owner' ? '/owner' : '/manager')
                }
                className="font-medium hover:underline text-xs"
              >
                Staff Console →
              </a>
            </div>
            {residentList.length > 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">Previewing:</span>
                <select
                  value={selectedResId || residentList[0]?.id}
                  onChange={(e) => setSelectedResId(e.target.value)}
                  className="text-xs bg-white border border-brand-300 rounded px-2 py-1 flex-1 font-medium text-ink cursor-pointer"
                >
                  {p && <option value="">My Stay ({p.full_name})</option>}
                  {residentList.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.full_name} ({r.room_number ? `Rm ${r.room_number}` : ''} {r.bed_label ? `Bed ${r.bed_label}` : ''} · {r.phone})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-xs">
                You have staff access to the resident portal. Add residents in the staff console to preview specific stays.
              </p>
            )}
          </div>
        )}

        {!effectiveProfile ? (
          <>
            <BrandHeader subtitle="PG & Hostel" onMenu={() => undefined} />
            <Card>
              <Empty title="No active stay found">
                {staff
                  ? 'No active residents found in this building to preview.'
                  : 'Your PG has not linked an active admission to this account.'}
              </Empty>
            </Card>
          </>
        ) : (
          <main className="resident-main space-y-4">
            <Routes>
              <Route index element={<ResHome p={effectiveProfile} />} />
              <Route path="payments" element={<ResPayments p={effectiveProfile} />} />
              <Route path="meals" element={<ResMeals p={effectiveProfile} />} />
              <Route path="complaints" element={<ResComplaints />} />
              <Route path="notices" element={<ResNotices />} />
              <Route path="visitors" element={<VisitorPasses />} />
              <Route path="community" element={<Community />} />
              <Route path="community/chat/:id" element={<ChatScreen />} />
              <Route path="community/polls" element={<PollsScreen />} />
              <Route path="community/birthdays" element={<BirthdaysScreen p={effectiveProfile} onProfileChanged={prof.reload} />} />
              <Route path="community/:kind" element={<PostsScreen p={effectiveProfile} />} />
              <Route path="profile" element={<ResProfile p={effectiveProfile} />} />
            </Routes>
          </main>
        )}
        <BottomNav />
      </div>
    </div>
  );
}
