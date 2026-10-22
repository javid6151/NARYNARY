/**
 * Recent Complaints card for the ZIPNARY Owner Dashboard.
 * Displays issues with category icon, title, room tag, priority badge (High, Medium, Low),
 * and chevron navigation.
 */
import { useNavigate } from 'react-router-dom';
import {
  Wrench,
  Droplets,
  Wifi,
  AlertTriangle,
  ChevronRight,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { Complaint } from '../../maintenance/types';

interface RecentComplaintsCardProps {
  complaints: Complaint[];
  onSelectComplaint?: (id: string) => void;
}

export function RecentComplaintsCard({
  complaints,
  onSelectComplaint,
}: RecentComplaintsCardProps) {
  const nav = useNavigate();

  const getCategoryIcon = (category: string, title: string) => {
    const text = (category + ' ' + title).toLowerCase();
    if (text.includes('wifi') || text.includes('internet')) {
      return { icon: Wifi, bg: 'bg-[#EBF3F5]', color: 'text-[#265561]' };
    }
    if (text.includes('water') || text.includes('plumb') || text.includes('leak')) {
      return { icon: Droplets, bg: 'bg-[#EBF0E6]', color: 'text-[#343B2B]' };
    }
    if (text.includes('ac') || text.includes('electric') || text.includes('power')) {
      return { icon: Zap, bg: 'bg-[#FDF1EC]', color: 'text-[#B9674B]' };
    }
    if (text.includes('clean') || text.includes('waste')) {
      return { icon: Sparkles, bg: 'bg-[#FDF5E8]', color: 'text-[#8C5D1E]' };
    }
    return { icon: AlertTriangle, bg: 'bg-[#FDF1EC]', color: 'text-[#B9674B]' };
  };

  const getPriorityBadge = (priority: string) => {
    const p = (priority || '').toLowerCase();
    if (p === 'high' || p === 'urgent' || p === 'critical') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[#FDF1EC] text-[#B9674B] border border-[#B9674B]/20">
          High
        </span>
      );
    }
    if (p === 'medium') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[#FDF4E3] text-[#94600C] border border-[#94600C]/20">
          Medium
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[#EAF3E4] text-[#2F6B27] border border-[#2F6B27]/20">
        Low
      </span>
    );
  };

  return (
    <div className="bg-[#FFFEFC] border border-[#DED6CB] rounded-2xl p-5 flex flex-col justify-between shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#ECE5DA]">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-[15px] text-[#30271F]">Recent Complaints</h3>
          {complaints.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-[#FDF1EC] text-[#B9674B] text-xs font-bold tabular">
              {complaints.length}
            </span>
          )}
        </div>
        <button
          onClick={() => nav('complaints')}
          className="text-xs font-semibold text-[#343B2B] hover:text-[#252A1F] hover:underline cursor-pointer"
        >
          View All
        </button>
      </div>

      {/* List */}
      <div className="flex-1 py-1">
        {complaints.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#77736B] italic">
            <Wrench className="size-6 text-[#A6B49A] mx-auto mb-1.5 opacity-60" />
            No open complaints. Everything is running smoothly.
          </div>
        ) : (
          <ul className="divide-y divide-[#ECE5DA]">
            {complaints.slice(0, 3).map((c) => {
              const cfg = getCategoryIcon(c.category, c.title);
              const Icon = cfg.icon;
              const room = c.rooms ? `Room ${c.rooms.room_number}` : 'Common Area';

              return (
                <li
                  key={c.id}
                  onClick={() => {
                    if (onSelectComplaint) onSelectComplaint(c.id);
                    else nav('complaints');
                  }}
                  role="button"
                  tabIndex={0}
                  className="py-3 flex items-center justify-between gap-3 text-xs hover:bg-[#F5F0E8]/50 rounded-xl px-1.5 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`size-8 rounded-full ${cfg.bg} ${cfg.color} flex items-center justify-center shrink-0`}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-[#30271F] truncate leading-tight group-hover:text-[#343B2B]">
                        {c.title}
                      </p>
                      <p className="text-[11px] text-[#77736B] mt-0.5 truncate">
                        {room} · {c.residents?.full_name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {getPriorityBadge(c.priority)}
                    <ChevronRight className="size-4 text-[#77736B] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 pt-2.5 border-t border-[#ECE5DA] flex items-center justify-between text-xs text-[#77736B]">
        <span>Resolution tracking</span>
        <button
          onClick={() => nav('maintenance')}
          className="font-medium text-[#343B2B] hover:underline cursor-pointer"
        >
          Maintenance orders →
        </button>
      </div>
    </div>
  );
}
