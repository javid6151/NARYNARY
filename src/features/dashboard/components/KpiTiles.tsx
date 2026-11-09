/**
 * Redesigned KPI Tiles for the ZIPNARY Owner Portal.
 * 4 Headline Business KPI Cards:
 * 1. Occupied Beds & Rooms (merged card with radial progress donut & vacant breakdown)
 * 2. Monthly Revenue (collections with collection rate & total billed)
 * 3. This Month Expenses (approved operational expenses with unpaid badge & view ledger)
 * 4. Pending Rent (total outstanding with overdue resident count)
 */
import { useNavigate } from 'react-router-dom';
import { BedDouble, Wallet, Receipt, AlertCircle } from 'lucide-react';
import { inr } from '../../../lib/format';
import type { DashboardSummary } from '../types';

export function KpiTiles({
  s,
  vacantRoomsCount,
  onVacantRooms,
}: {
  s: DashboardSummary;
  vacantRoomsCount?: number | null;
  onVacantRooms?: () => void;
}) {
  const nav = useNavigate();
  const occupancy = s.beds_total ? Math.round((s.beds_occupied / s.beds_total) * 100) : 0;
  const collectionRate = s.billed_month > 0 ? Math.round((s.collected_month / s.billed_month) * 100) : 100;
  const vacantBeds = Math.max(0, s.beds_total - s.beds_occupied);
  const vacantRooms =
    vacantRoomsCount ??
    Math.max(
      0,
      s.rooms_total - Math.floor(s.beds_occupied / Math.max(1, Math.round(s.beds_total / Math.max(1, s.rooms_total))))
    );

  // Donut SVG circumference math
  const radius = 13;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (occupancy / 100) * circumference;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* 1. Merged Rooms & Beds Occupancy */}
      <div
        onClick={onVacantRooms || (() => nav('buildings'))}
        role="button"
        tabIndex={0}
        className="text-left bg-[#FFFEFC] border border-[#DED6CB] rounded-2xl p-4 flex flex-col justify-between hover:border-[#CAD7BF] hover:shadow-xs transition-all cursor-pointer group"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-10 rounded-xl bg-[#EBF0E6] text-[#343B2B] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <BedDouble className="size-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[12px] font-medium text-[#77736B] block truncate">Occupied Beds</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-bold text-[#30271F] tabular tracking-tight">
                  {s.beds_occupied}
                </span>
                <span className="text-xs font-semibold text-[#77736B] tabular">
                  / {s.beds_total}
                </span>
              </div>
            </div>
          </div>

          {/* Donut progress ring */}
          <div className="relative size-10 shrink-0 flex items-center justify-center">
            <svg className="size-10 -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r={radius}
                className="stroke-[#ECE5DA]"
                strokeWidth="3.5"
                fill="none"
              />
              <circle
                cx="18"
                cy="18"
                r={radius}
                className="stroke-[#343B2B] transition-all duration-500 ease-out"
                strokeWidth="3.5"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="none"
              />
            </svg>
            <span className="absolute text-[9.5px] font-bold text-[#343B2B] tabular">
              {occupancy}%
            </span>
          </div>
        </div>
        <div className="mt-3 pt-2.5 border-t border-[#ECE5DA] flex items-center justify-between text-[11.5px] text-[#77736B]">
          <span className="font-semibold text-[#343B2B]">
            {vacantRooms} Vacant Rooms · {vacantBeds} Beds
          </span>
          <span className="text-[#343B2B] font-medium group-hover:underline">View Rooms →</span>
        </div>
      </div>

      {/* 2. Monthly Revenue */}
      <div
        onClick={() => nav('payments')}
        role="button"
        tabIndex={0}
        className="text-left bg-[#FFFEFC] border border-[#DED6CB] rounded-2xl p-4 flex flex-col justify-between hover:border-[#CAD7BF] hover:shadow-xs transition-all cursor-pointer group"
      >
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-[#FDF5E8] text-[#8C5D1E] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Wallet className="size-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[12px] font-medium text-[#77736B] block truncate">Monthly Revenue</span>
            <div className="text-2xl font-bold text-[#30271F] tabular tracking-tight mt-0.5 truncate">
              {inr(s.collected_month)}
            </div>
          </div>
        </div>
        <div className="mt-3 pt-2.5 border-t border-[#ECE5DA] flex items-center justify-between text-[11.5px]">
          <span className="inline-flex items-center gap-1 font-semibold text-[#2F6B27] bg-[#EAF3E4] px-1.5 py-0.5 rounded-md text-[10.5px]">
            ↑ {collectionRate}%
          </span>
          <span className="text-[#77736B] truncate">Billed: {inr(s.billed_month)}</span>
        </div>
      </div>

      {/* 3. This Month Expenses */}
      <div
        onClick={() => nav('expenses')}
        role="button"
        tabIndex={0}
        className="text-left bg-[#FFFEFC] border border-[#DED6CB] rounded-2xl p-4 flex flex-col justify-between hover:border-[#CAD7BF] hover:shadow-xs transition-all cursor-pointer group"
      >
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-[#F4EFF8] text-[#4C2365] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Receipt className="size-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[12px] font-medium text-[#77736B] block truncate">This Month Expenses</span>
            <div className="text-2xl font-bold text-[#30271F] tabular tracking-tight mt-0.5 truncate">
              {inr(s.expenses_month)}
            </div>
          </div>
        </div>
        <div className="mt-3 pt-2.5 border-t border-[#ECE5DA] flex items-center justify-between text-[11.5px]">
          {s.expenses_unpaid > 0 ? (
            <span className="inline-flex items-center gap-1 font-semibold text-[#B9674B] bg-[#FDF1EC] px-1.5 py-0.5 rounded-md text-[10.5px]">
              Unpaid: {inr(s.expenses_unpaid)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-semibold text-[#2F6B27] bg-[#EAF3E4] px-1.5 py-0.5 rounded-md text-[10.5px]">
              ✓ All Paid
            </span>
          )}
          <span className="text-[#343B2B] font-medium group-hover:underline">View Ledger →</span>
        </div>
      </div>

      {/* 4. Pending Rent */}
      <div
        onClick={() => nav('payments')}
        role="button"
        tabIndex={0}
        className="text-left bg-[#FFFEFC] border border-[#DED6CB] rounded-2xl p-4 flex flex-col justify-between hover:border-[#B9674B]/40 hover:shadow-xs transition-all cursor-pointer group"
      >
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-[#FDF1EC] text-[#B9674B] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <AlertCircle className="size-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[12px] font-medium text-[#77736B] block truncate">Pending Rent</span>
            <div className="text-2xl font-bold text-[#30271F] tabular tracking-tight mt-0.5 truncate">
              {inr(s.outstanding_total)}
            </div>
          </div>
        </div>
        <div className="mt-3 pt-2.5 border-t border-[#ECE5DA] flex items-center justify-between text-[11.5px]">
          <span className="inline-flex items-center gap-1 font-semibold text-[#B9674B] bg-[#FDF1EC] px-2 py-0.5 rounded-md text-[10.5px]">
            <span className="size-1.5 rounded-full bg-[#B9674B] inline-block" />
            {s.overdue_residents} Residents
          </span>
          <span className="text-[#77736B]">Overdue</span>
        </div>
      </div>
    </div>
  );
}
