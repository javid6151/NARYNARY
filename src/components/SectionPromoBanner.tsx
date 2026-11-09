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
  extraActions?: ReactNode;
  controls?: ReactNode;
  statsBadge?: string;
  fromTop?: boolean;
  className?: string;
}

export function SectionPromoBanner({
  eyebrow,
  title,
  subtitle,
  imageSrc,
  primaryAction,
  secondaryAction,
  extraActions,
  controls,
  statsBadge,
  fromTop = false,
  className = '',
}: SectionPromoBannerProps) {
  const containerClasses = fromTop
    ? `relative -mt-6 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pt-7 sm:pt-8 pb-9 sm:pb-11 mb-5 flex flex-col justify-between ${className}`
    : `relative overflow-hidden rounded-[26px] p-6 sm:p-8 min-h-[195px] flex flex-col justify-between bg-[#F5F0E8] border border-[#DED6CB]/35 shadow-[0_2px_14px_rgba(48,39,31,0.03)] mb-6 group ${className}`;

  return (
    <div className={containerClasses}>
      {/* Ambient Photographic Background Layer with low intensity & bottom gradient fade */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden="true">
        <div
          className="absolute inset-0 bg-cover bg-[center_38%] opacity-28 mix-blend-multiply filter contrast-95 transition-transform duration-500 group-hover:scale-105"
          style={{ backgroundImage: `url('${imageSrc}')` }}
        />
        {/* Top-to-bottom gradient dissolving smoothly into page bg #F5F0E8 */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(245, 240, 232, 0.1) 0%, rgba(245, 240, 232, 0.45) 45%, rgba(245, 240, 232, 0.9) 78%, #F5F0E8 100%)',
          }}
        />
      </div>

      {/* Top Header / Eyebrow & Controls */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#343B2B] block mb-1.5">
            {eyebrow}
          </span>
          <h2 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#30271F] leading-tight max-w-xl">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs sm:text-[13.5px] text-[#5C554B] mt-2 max-w-lg font-normal leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        {(controls || statsBadge) && (
          <div className="flex flex-wrap items-center gap-2.5 z-30 relative self-start md:self-auto">
            {controls}
            {statsBadge && (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FFFEFC] border border-[#DED6CB] text-xs font-semibold text-[#30271F] shadow-2xs">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span>{statsBadge}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons with signature deep olive pill button & porcelain secondary */}
      {(primaryAction || secondaryAction || extraActions) && (
        <div className="relative z-10 mt-6 pt-1 flex flex-wrap items-center gap-3">
          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              className="inline-flex items-center gap-2.5 px-6 py-2.5 sm:py-3 rounded-2xl bg-[#343B2B] hover:bg-[#252A1F] text-white text-xs sm:text-[13.5px] font-semibold transition-all duration-150 hover:shadow-md active:scale-[0.98] cursor-pointer shadow-xs group/btn"
            >
              {primaryAction.icon && (
                <primaryAction.icon className="size-4 text-[#CAD7BF] transition-transform group-hover/btn:scale-105" />
              )}
              <span>{primaryAction.label}</span>
              <ArrowRight className="size-4 text-white/90 transition-transform group-hover/btn:translate-x-1" />
            </button>
          )}

          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="inline-flex items-center gap-2 px-5 py-2.5 sm:py-3 rounded-2xl bg-[#FFFEFC] hover:bg-[#ECE5DA] text-[#30271F] text-xs sm:text-[13.5px] font-semibold border border-[#DED6CB] transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
            >
              {secondaryAction.icon && <secondaryAction.icon className="size-4 text-[#343B2B]" />}
              <span>{secondaryAction.label}</span>
            </button>
          )}

          {extraActions}
        </div>
      )}
    </div>
  );
}
