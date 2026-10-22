/**
 * Redesigned Recent Activities component for the ZIPNARY Owner Dashboard.
 * Displays real audited operations, admissions, payments, or maintenance events
 * with icons in styled rounded containers, clear typography, and relative timestamps.
 */
import { useNavigate } from 'react-router-dom';
import { UserCheck, Wallet, AlertTriangle, Megaphone, Clock } from 'lucide-react';
import type { AsyncState } from '../../../lib/hooks';
import { relTime } from '../../../lib/format';
import { Async } from '../../../components/ui';
import { activityLabel } from '../../audit/activityLabel';

interface ActivityItem {
  id: string;
  action: string;
  created_at: string;
}

export function RecentActivity({
  state,
}: {
  state: AsyncState<ActivityItem[]>;
}) {
  const nav = useNavigate();

  const getActionConfig = (action: string) => {
    if (action.includes('admission') || action.includes('resident')) {
      return {
        icon: UserCheck,
        bg: 'bg-[#EBF0E6]',
        color: 'text-[#343B2B]',
      };
    }
    if (action.includes('payment') || action.includes('charge')) {
      return {
        icon: Wallet,
        bg: 'bg-[#EAF3E4]',
        color: 'text-[#2F6B27]',
      };
    }
    if (action.includes('complaint') || action.includes('maintenance')) {
      return {
        icon: AlertTriangle,
        bg: 'bg-[#FDF1EC]',
        color: 'text-[#B9674B]',
      };
    }
    if (action.includes('notice') || action.includes('communication')) {
      return {
        icon: Megaphone,
        bg: 'bg-[#FDF5E8]',
        color: 'text-[#8C5D1E]',
      };
    }
    return {
      icon: Clock,
      bg: 'bg-[#ECE5DA]',
      color: 'text-[#30271F]',
    };
  };

  return (
    <div className="bg-[#FFFEFC] border border-[#DED6CB] rounded-2xl p-5 flex flex-col justify-between shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#ECE5DA]">
        <h3 className="font-bold text-[15px] text-[#30271F]">Recent Activities</h3>
        <button
          onClick={() => nav('reports')}
          className="text-xs font-semibold text-[#343B2B] hover:text-[#252A1F] hover:underline cursor-pointer"
        >
          View All
        </button>
      </div>

      {/* List */}
      <Async state={state}>
        {(rows) =>
          rows.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#77736B] italic">
              No recent activities recorded yet.
            </div>
          ) : (
            <ul className="space-y-3 py-1">
              {rows.slice(0, 4).map((a) => {
                const cfg = getActionConfig(a.action);
                const Icon = cfg.icon;

                return (
                  <li key={a.id} className="flex items-start gap-3 text-xs">
                    <div
                      className={`size-8 rounded-xl ${cfg.bg} ${cfg.color} flex items-center justify-center shrink-0 mt-0.5`}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#30271F] truncate leading-tight">
                        {activityLabel(a.action)}
                      </p>
                      <p className="text-[11px] text-[#77736B] mt-0.5">
                        System event verified
                      </p>
                    </div>
                    <span className="text-[11px] text-[#77736B] whitespace-nowrap tabular">
                      {relTime(a.created_at)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )
        }
      </Async>

      {/* Footer */}
      <div className="mt-3 pt-2.5 border-t border-[#ECE5DA] flex items-center justify-between text-xs text-[#77736B]">
        <span>Audited business records</span>
        <button
          onClick={() => nav('reports')}
          className="font-medium text-[#343B2B] hover:underline cursor-pointer"
        >
          Audit trail →
        </button>
      </div>
    </div>
  );
}
