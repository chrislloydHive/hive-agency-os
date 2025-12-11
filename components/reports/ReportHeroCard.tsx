'use client';

// components/reports/ReportHeroCard.tsx
// Report Hero Card - Reusable hero-style card for strategic reports (Annual Plan, QBR)
//
// Features:
// - Icon with subtle background circle
// - Eyebrow, title, description
// - Status badge
// - Primary CTA button

import { ReactNode } from 'react';
import { Sparkles, Eye, Loader2 } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface ReportHeroCardProps {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  badge?: string;
  badgeVariant?: 'default' | 'success' | 'warning';
  ctaLabel: string;
  ctaVariant?: 'primary' | 'secondary';
  isLoading?: boolean;
  onCtaClick: () => void;
  secondaryAction?: {
    label: string;
    href: string;
  };
}

// ============================================================================
// Main Component
// ============================================================================

export function ReportHeroCard({
  icon,
  eyebrow,
  title,
  description,
  badge,
  badgeVariant = 'default',
  ctaLabel,
  ctaVariant = 'primary',
  isLoading,
  onCtaClick,
  secondaryAction,
}: ReportHeroCardProps) {
  const badgeStyles = {
    default: 'bg-slate-800 text-slate-400 border-slate-700',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  };

  return (
    <div className="relative rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-4 md:p-5 overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-slate-800/20 to-transparent rounded-full -mr-10 -mt-10 pointer-events-none" />

      <div className="relative flex flex-col h-full">
        {/* Top: Icon + Content */}
        <div className="flex-1 space-y-3">
          {/* Icon */}
          <div className="inline-flex p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50">
            {icon}
          </div>

          {/* Eyebrow */}
          <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">
            {eyebrow}
          </p>

          {/* Title */}
          <h3 className="text-lg md:text-xl font-semibold text-slate-50">
            {title}
          </h3>

          {/* Description */}
          <p className="text-sm text-slate-400 leading-relaxed">
            {description}
          </p>
        </div>

        {/* Bottom: Badge + Actions */}
        <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-800/60">
          {/* Badge */}
          {badge && (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${badgeStyles[badgeVariant]}`}>
              {badge}
            </span>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 ml-auto">
            {secondaryAction && (
              <a
                href={secondaryAction.href}
                className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              >
                <Eye className="w-4 h-4" />
                {secondaryAction.label}
              </a>
            )}

            <button
              onClick={onCtaClick}
              disabled={isLoading}
              className={`inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                ctaVariant === 'primary'
                  ? 'bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-white shadow-lg shadow-sky-500/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {isLoading ? 'Generating...' : ctaLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
