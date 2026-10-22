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
    <div
      className="rounded-3xl p-6 sm:p-7 min-h-[195px] flex flex-col justify-between text-white relative shadow-md border border-[#DED6CB]/30 overflow-hidden"
      style={{
        backgroundColor: '#30271F',
        backgroundImage: "linear-gradient(180deg, rgba(28, 22, 17, 0.35) 0%, rgba(28, 22, 17, 0.88) 100%), url('/owner-assets/lounge-promo.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="relative z-10 max-w-xs">
        <span className="text-[11px] font-bold uppercase tracking-widest text-[#A6B49A] block mb-1.5">
          PROPERTY GROWTH
        </span>
        <h3 className="text-2xl font-bold leading-tight tracking-tight text-white drop-shadow-sm">
          Better Managed Spaces, <br />
          Happier Residents.
        </h3>
      </div>

      <div className="relative z-10 mt-5 pt-1">
        <button
          onClick={() => nav('buildings')}
          className="inline-flex items-center gap-2.5 px-6 py-2.5 sm:py-3 rounded-2xl bg-[#343B2B] hover:bg-[#2A3022] text-white text-xs sm:text-[13.5px] font-semibold backdrop-blur-md border border-white/20 transition-all duration-150 hover:shadow-lg hover:border-white/35 active:scale-[0.98] cursor-pointer shadow-sm group"
        >
          <span>Manage Rooms</span>
          <ArrowRight className="size-4 text-white/90 transition-transform group-hover:translate-x-1" />
        </button>
      </div>
    </div>
  );
}
