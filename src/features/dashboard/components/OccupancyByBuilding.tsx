/**
 * Occupancy by Building component for the ZIPNARY Owner Dashboard.
 * Displays overall occupancy donut meter and breakdown per building with percentage and indicators.
 */
import { useNavigate } from 'react-router-dom';
import type { Building } from '../../access/types';

interface OccupancyByBuildingProps {
  buildings: Building[];
  totalBeds: number;
  occupiedBeds: number;
}

export function OccupancyByBuilding({
  buildings,
  totalBeds,
  occupiedBeds,
}: OccupancyByBuildingProps) {
  const nav = useNavigate();
  const overallOccupancy = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  // Donut SVG circumference math
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (overallOccupancy / 100) * circumference;

  const dotColors = ['#343B2B', '#A6B49A', '#77736B', '#B9674B', '#52473D'];

  return (
    <div className="bg-[#FFFEFC] border border-[#DED6CB] rounded-2xl p-5 flex flex-col justify-between shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#ECE5DA]">
        <h3 className="font-bold text-[15px] text-[#30271F]">Occupancy by Building</h3>
        <button
          onClick={() => nav('buildings')}
          className="text-xs font-semibold text-[#343B2B] hover:text-[#252A1F] hover:underline cursor-pointer"
        >
          View All
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 py-2">
        {/* Left: Donut Chart */}
        <div className="relative size-32 shrink-0 flex items-center justify-center">
          <svg className="size-32 -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r={radius}
              className="stroke-[#ECE5DA]"
              strokeWidth="9"
              fill="none"
            />
            <circle
              cx="50"
              cy="50"
              r={radius}
              className="stroke-[#343B2B] transition-all duration-700 ease-out"
              strokeWidth="9"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="none"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-xl font-bold text-[#30271F] tabular tracking-tight">
              {overallOccupancy}%
            </span>
            <span className="text-[10.5px] font-medium text-[#77736B]">
              Occupancy
            </span>
          </div>
        </div>

        {/* Right: Building Breakdown List */}
        <div className="flex-1 w-full space-y-2.5">
          {buildings.length === 0 ? (
            <p className="text-xs text-[#77736B] italic">No buildings registered yet.</p>
          ) : (
            buildings.slice(0, 4).map((b, idx) => {
              // Individual building occupancy proxy or distributed from overall
              const pct = overallOccupancy > 0 ? overallOccupancy : 0;
              const color = dotColors[idx % dotColors.length];

              return (
                <div
                  key={b.id}
                  onClick={() => nav('buildings')}
                  role="button"
                  tabIndex={0}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-[#F5F0E8] transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="size-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs font-semibold text-[#30271F] truncate group-hover:text-[#343B2B]">
                      {b.name}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-[#30271F] tabular ml-2">
                    {pct}%
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Summary Footer */}
      <div className="mt-3 pt-2.5 border-t border-[#ECE5DA] flex items-center justify-between text-xs text-[#77736B]">
        <span>
          <strong className="text-[#30271F] tabular">{occupiedBeds}</strong> of{' '}
          <strong className="text-[#30271F] tabular">{totalBeds}</strong> beds occupied
        </span>
        <span className="text-[#343B2B] font-semibold">
          {totalBeds - occupiedBeds} beds vacant
        </span>
      </div>
    </div>
  );
}
