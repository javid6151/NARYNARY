/**
 * Promotional and operational action banner card for the ZIPNARY Owner Dashboard.
 * Matches the reference image layout:
 * "Better Managed Spaces, Happier Residents. [Manage Buildings →]"
 * with a warm interior photograph background and deep olive pill button.
 */
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export function PromoCard() {
  const nav = useNavigate();

  return (
    <div className="bg-[#F5F0E8] border border-[#DED6CB]/35 rounded-2xl p-6 sm:p-7 min-h-[195px] flex flex-col justify-between relative shadow-[0_2px_12px_rgba(48,39,31,0.03)] overflow-hidden group">
      {/* Ambient Photographic Background Layer matching page bg #F5F0E8 with subtle fade */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden="true">
        <div
          className="absolute inset-0 bg-cover bg-[center_35%] opacity-28 mix-blend-multiply filter contrast-95 transition-transform duration-500 group-hover:scale-105"
          style={{ backgroundImage: "url('/owner-assets/lounge-promo.jpg')" }}
        />
        {/* Top-to-bottom gradient dissolving seamlessly into #F5F0E8 */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(245, 240, 232, 0.1) 0%, rgba(245, 240, 232, 0.42) 42%, rgba(245, 240, 232, 0.88) 75%, #F5F0E8 100%)',
          }}
        />
      </div>

      <div className="relative z-10 max-w-xs">
        <span className="text-[11px] font-bold uppercase tracking-widest text-[#343B2B] block mb-1.5">
          PROPERTY GROWTH
        </span>
        <h3 className="text-2xl font-bold leading-tight tracking-tight text-[#30271F]">
          Better Managed Spaces, <br />
          Happier Residents.
        </h3>
      </div>

      <div className="relative z-10 mt-5 pt-1">
        <button
          onClick={() => nav('buildings')}
          className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-[#343B2B] hover:bg-[#252A1F] text-white text-xs sm:text-[13px] font-semibold transition-all duration-150 hover:shadow-md active:scale-[0.98] cursor-pointer shadow-xs group/btn"
        >
          <span>Manage Rooms</span>
          <ArrowRight className="size-4 text-white/90 transition-transform group-hover/btn:translate-x-1" />
        </button>
      </div>
    </div>
  );
}
