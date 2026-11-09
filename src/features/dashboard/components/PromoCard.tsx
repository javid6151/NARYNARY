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
    <div className="bg-[#FFFEFC] border border-[#DED6CB] rounded-2xl p-6 sm:p-7 min-h-[195px] flex flex-col justify-between relative shadow-xs overflow-hidden group">
      {/* Ambient Photographic Background Layer with low intensity & smooth bottom fade */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden="true">
        <div
          className="absolute inset-0 bg-cover bg-[center_40%] opacity-25 mix-blend-multiply filter contrast-95 transition-transform duration-500 group-hover:scale-105"
          style={{ backgroundImage: "url('/owner-assets/lounge-promo.jpg')" }}
        />
        {/* Top-to-bottom gradient dissolving softly into card bg #FFFEFC */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(255, 254, 252, 0.12) 0%, rgba(255, 254, 252, 0.45) 45%, rgba(255, 254, 252, 0.92) 80%, #FFFEFC 100%)',
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
          className="inline-flex items-center gap-2.5 px-6 py-2.5 sm:py-3 rounded-2xl bg-[#343B2B] hover:bg-[#252A1F] text-white text-xs sm:text-[13.5px] font-semibold transition-all duration-150 hover:shadow-md active:scale-[0.98] cursor-pointer shadow-xs group/btn"
        >
          <span>Manage Rooms</span>
          <ArrowRight className="size-4 text-white/90 transition-transform group-hover/btn:translate-x-1" />
        </button>
      </div>
    </div>
  );
}
