/**
 * Quick Actions component for the ZIPNARY Owner Dashboard.
 * Appears on mobile and tablet (and clean on desktop):
 * Add Resident, Room Status, Payments, Complaints.
 */
import { useNavigate } from 'react-router-dom';
import { UserPlus, DoorOpen, Wallet, MessageSquareWarning } from 'lucide-react';

export function QuickActions({
  onRoomStatus,
}: {
  onRoomStatus?: () => void;
}) {
  const nav = useNavigate();

  const actions = [
    {
      label: 'Add Resident',
      icon: UserPlus,
      bg: 'bg-[#FDF5E8]',
      color: 'text-[#8C5D1E]',
      onClick: () => nav('residents/new'),
    },
    {
      label: 'Room Status',
      icon: DoorOpen,
      bg: 'bg-[#EBF0E6]',
      color: 'text-[#343B2B]',
      onClick: onRoomStatus || (() => nav('buildings')),
    },
    {
      label: 'Payments',
      icon: Wallet,
      bg: 'bg-[#FDF1EC]',
      color: 'text-[#B9674B]',
      onClick: () => nav('payments'),
    },
    {
      label: 'Complaints',
      icon: MessageSquareWarning,
      bg: 'bg-[#EBF3F5]',
      color: 'text-[#265561]',
      onClick: () => nav('complaints'),
    },
  ];

  return (
    <div className="bg-[#FFFEFC] border border-[#DED6CB] rounded-2xl p-4 shadow-xs">
      <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-[#ECE5DA]">
        <h3 className="font-bold text-[14px] text-[#30271F]">Quick Actions</h3>
        <button
          onClick={() => nav('buildings')}
          className="text-xs font-semibold text-[#343B2B] hover:underline cursor-pointer"
        >
          View All
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <button
              key={act.label}
              onClick={act.onClick}
              className="flex flex-col items-center justify-center p-3 rounded-xl border border-[#DED6CB] bg-[#F5F0E8]/40 hover:bg-[#EBF0E6] transition-all hover:-translate-y-0.5 cursor-pointer text-center group"
            >
              <div
                className={`size-10 rounded-xl ${act.bg} ${act.color} flex items-center justify-center mb-2 shadow-2xs group-hover:scale-105 transition-transform`}
              >
                <Icon className="size-5" />
              </div>
              <span className="text-xs font-semibold text-[#30271F] group-hover:text-[#343B2B]">
                {act.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
