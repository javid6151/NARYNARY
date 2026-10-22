/**
 * Recent Admissions card for the ZIPNARY Owner Dashboard.
 * Displays recently onboarded residents with their allocated room/bed, rent amount,
 * and onboarding status, with quick-action links to full admissions & new onboarding.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BedDouble, CheckCircle2, Plus, UserPlus, Users } from 'lucide-react';
import { Avatar } from '../../../components/ui';
import { fmtDate, inr } from '../../../lib/format';
import { reviewAdmission } from '../../residents/api';
import type { AdmissionRow } from '../../residents/types';

interface RecentAdmissionsCardProps {
  admissions: AdmissionRow[];
  onActionComplete?: (msg: string) => void;
}

export function RecentAdmissionsCard({
  admissions,
  onActionComplete,
}: RecentAdmissionsCardProps) {
  const nav = useNavigate();
  const [busyId, setBusyId] = useState<string | null>(null);

  // Take the 3 most recent admissions (sorted by latest in the backend)
  const recentList = admissions.slice(0, 3);

  const handleDecision = async (id: string, decision: 'approve' | 'reject', name: string) => {
    try {
      setBusyId(id);
      await reviewAdmission(id, decision, null);
      if (onActionComplete) {
        onActionComplete(decision === 'approve' ? `Approved admission for ${name}` : `Rejected admission for ${name}`);
      }
    } catch (err: any) {
      if (onActionComplete) {
        onActionComplete(`Action failed: ${err.message || 'Error updating admission'}`);
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-[#FFFEFC] border border-[#DED6CB] rounded-2xl p-5 flex flex-col justify-between shadow-xs hover:border-[#CAD7BF] transition-all min-h-[290px]">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#ECE5DA]">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-[#EBF0E6] flex items-center justify-center text-[#343B2B]">
              <Users className="size-4 text-[#343B2B]" />
            </div>
            <div>
              <h3 className="font-bold text-[15px] text-[#30271F] leading-tight">Recent Admissions</h3>
            </div>
            {admissions.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[#EBF0E6] text-[#343B2B] text-xs font-bold tabular">
                {admissions.length}
              </span>
            )}
          </div>
          <button
            onClick={() => nav('admissions')}
            className="text-xs font-semibold text-[#343B2B] hover:text-[#252A1F] hover:underline cursor-pointer"
          >
            View All
          </button>
        </div>

        {/* List of Recent Admissions */}
        <div className="py-1">
          {recentList.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#77736B]">
              <div className="size-10 rounded-full bg-[#F5F0E8] flex items-center justify-center mx-auto mb-2 text-[#A6B49A]">
                <UserPlus className="size-5 text-[#343B2B]" />
              </div>
              <p className="font-medium text-[#30271F]">No admissions recorded yet</p>
              <p className="text-[11px] text-[#77736B] mt-0.5">Onboard residents with room allocation and instant login.</p>
              <button
                onClick={() => nav('residents/new')}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#343B2B] text-white text-xs font-semibold hover:bg-[#252A1F] transition-colors cursor-pointer"
              >
                <Plus className="size-3.5" />
                Add First Admission
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-[#ECE5DA]">
              {recentList.map((a) => {
                const isBusy = busyId === a.id;
                const name = a.residents?.full_name || 'Resident';
                const roomNum = a.rooms?.room_number;
                const bedLabel = a.beds?.bed_label;
                const allocation = roomNum ? `Room ${roomNum}${bedLabel ? ` · Bed ${bedLabel}` : ''}` : 'Unassigned';
                const isPending = a.status === 'pending_review';

                return (
                  <li key={a.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={name} size={34} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-[#30271F] truncate leading-tight">
                            {name}
                          </p>
                          {isPending ? (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[#FDF1EC] text-[#B9674B] border border-[#EAC4B6]">
                              Pending
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[#EBF0E6] text-[#343B2B]">
                              <CheckCircle2 className="size-2.5 text-[#343B2B]" />
                              Active
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-[#77736B] mt-0.5 truncate">
                          <BedDouble className="size-3 shrink-0 text-[#A6B49A]" />
                          <span className="truncate">{allocation}</span>
                          {a.monthly_rent ? (
                            <>
                              <span>•</span>
                              <span className="font-medium text-[#30271F]">{inr(a.monthly_rent)}/mo</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isPending ? (
                        <>
                          <button
                            disabled={isBusy}
                            onClick={() => handleDecision(a.id, 'approve', name)}
                            className="px-2.5 py-1 rounded-lg bg-[#EBF0E6] hover:bg-[#CAD7BF] text-[#343B2B] border border-[#CAD7BF] text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                            title="Approve and allocate bed"
                          >
                            Approve
                          </button>
                          <button
                            disabled={isBusy}
                            onClick={() => handleDecision(a.id, 'reject', name)}
                            className="px-2 py-1 rounded-lg text-[#B9674B] hover:bg-[#FDF1EC] text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                            title="Reject request"
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <div className="text-right">
                          <span className="text-[11px] font-medium text-[#77736B]">
                            {fmtDate(a.admission_date || a.created_at)}
                          </span>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 pt-2.5 border-t border-[#ECE5DA] flex items-center justify-between text-xs text-[#77736B]">
        <span className="text-[11px]">Direct bed allocation & KYC</span>
        <button
          onClick={() => nav('residents/new')}
          className="inline-flex items-center gap-1 font-semibold text-[#343B2B] hover:underline cursor-pointer"
        >
          <Plus className="size-3.5" />
          <span>New Admission</span>
        </button>
      </div>
    </div>
  );
}
