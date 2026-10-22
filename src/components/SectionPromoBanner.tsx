/**
 * Reusable Section Hero & Promotional Banner component for the ZIPNARY Owner Portal.
 * Reproduces the exact visual aesthetic requested by the user:
 * - High-resolution architectural photographic background
 * - Ambient dark gradient overlay for optimal text legibility
 * - Elegant uppercase tracking eyebrow badge
 * - Large, crisp typography
 * - Signature deep olive pill button with subtle border, hover lift, and directional arrow.
 */
import type { ReactNode } from 'react';
import { ArrowRight, type LucideIcon } from 'lucide-react';

interface ActionButton {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  variant?: 'primary' | 'secondary';
}

interface SectionPromoBannerProps {
  eyebrow: string;
  title: string | ReactNode;
  subtitle?: string;
  imageSrc: string;
  primaryAction?: ActionButton;
  secondaryAction?: ActionButton;
  statsBadge?: string;
  className?: string;
}

export function SectionPromoBanner({
  eyebrow,
  title,
  subtitle,
  imageSrc,
  primaryAction,
  secondaryAction,
  statsBadge,
  className = '',
}: SectionPromoBannerProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-[26px] p-6 sm:p-8 min-h-[195px] flex flex-col justify-between text-white shadow-md border border-[#DED6CB]/30 mb-6 ${className}`}
      style={{
        backgroundColor: '#261F18',
        backgroundImage: `linear-gradient(180deg, rgba(24, 18, 14, 0.42) 0%, rgba(24, 18, 14, 0.85) 100%), url('${imageSrc}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center 40%',
      }}
    >
      {/* Top Header / Eyebrow */}
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <span className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-[#A6B49A] block mb-1.5 drop-shadow-sm">
            {eyebrow}
          </span>
          <h2 className="text-2xl sm:text-[28px] font-bold tracking-tight text-white leading-tight drop-shadow-sm max-w-xl">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs sm:text-[13.5px] text-white/85 mt-2 max-w-lg font-normal leading-relaxed drop-shadow-sm">
              {subtitle}
            </p>
          )}
        </div>

        {statsBadge && (
          <div className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-xs font-semibold text-white shadow-sm">
            <span className="size-2 rounded-full bg-emerald-400" />
            <span>{statsBadge}</span>
          </div>
        )}
      </div>

      {/* Action Buttons with signature deep olive pill button matching user reference */}
      {(primaryAction || secondaryAction) && (
        <div className="relative z-10 mt-6 pt-1 flex flex-wrap items-center gap-3">
          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              className="inline-flex items-center gap-2.5 px-6 py-2.5 sm:py-3 rounded-2xl bg-[#343B2B] hover:bg-[#2A3022] text-white text-xs sm:text-[13.5px] font-semibold backdrop-blur-md border border-white/20 transition-all duration-150 hover:shadow-lg hover:border-white/35 active:scale-[0.98] cursor-pointer shadow-sm group"
            >
              {primaryAction.icon && (
                <primaryAction.icon className="size-4 text-[#CAD7BF] transition-transform group-hover:scale-105" />
              )}
              <span>{primaryAction.label}</span>
              <ArrowRight className="size-4 text-white/90 transition-transform group-hover:translate-x-1" />
            </button>
          )}

          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="inline-flex items-center gap-2 px-4 py-2.5 sm:py-3 rounded-2xl bg-white/15 hover:bg-white/25 text-white text-xs sm:text-[13.5px] font-semibold backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-sm"
            >
              {secondaryAction.icon && <secondaryAction.icon className="size-4" />}
              <span>{secondaryAction.label}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
