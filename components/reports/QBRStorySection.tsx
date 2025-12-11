'use client';

// components/reports/QBRStorySection.tsx
// QBR Story Section - Generic narrative section component for story view

import { ChevronRight } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface QBRStorySectionProps {
  id: string;
  title: string;
  eyebrow?: string;
  summary?: string;
  pill?: string;
  pillColor?: 'blue' | 'emerald' | 'amber' | 'purple' | 'cyan' | 'red' | 'indigo' | 'orange';
  children: React.ReactNode;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const PILL_COLORS = {
  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  purple: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  red: 'bg-red-500/10 text-red-400 border-red-500/30',
  indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
  orange: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
};

// Section intro microcopy
export const SECTION_INTROS: Record<string, string> = {
  exec: 'High-level narrative for leadership.',
  performance: 'How each lab and module performed this quarter.',
  challenges: 'Key blockers and risks impacting growth.',
  'next-quarter': 'Focus areas and strategic priorities for the next 90 days.',
  'deep-dives': 'Context and nuance behind key themes.',
  recommendations: 'Sequenced actions to move the score up.',
};

// ============================================================================
// Main Component
// ============================================================================

export function QBRStorySection({
  id,
  title,
  eyebrow,
  summary,
  pill,
  pillColor = 'blue',
  children,
  className = '',
}: QBRStorySectionProps) {
  const intro = SECTION_INTROS[id];

  return (
    <section
      id={id}
      className={`rounded-2xl border border-slate-800 bg-slate-950/80 overflow-hidden ${className}`}
    >
      {/* Section Header */}
      <div className="p-5 md:p-6 border-b border-slate-800/50">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            {/* Eyebrow */}
            {eyebrow && (
              <p className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">
                {eyebrow}
              </p>
            )}

            {/* Title row */}
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
              {pill && (
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-medium border ${PILL_COLORS[pillColor]}`}
                >
                  {pill}
                </span>
              )}
            </div>

            {/* Intro or summary */}
            {(intro || summary) && (
              <p className="text-sm text-slate-400">{summary || intro}</p>
            )}
          </div>
        </div>
      </div>

      {/* Section Body */}
      <div className="p-5 md:p-6">{children}</div>
    </section>
  );
}

// ============================================================================
// Story Section Bullet List Component
// ============================================================================

interface StorySectionBulletListProps {
  bullets: string[];
  icon?: React.ElementType;
  iconColor?: string;
}

export function StorySectionBulletList({
  bullets,
  icon: Icon = ChevronRight,
  iconColor = 'text-slate-500',
}: StorySectionBulletListProps) {
  if (bullets.length === 0) return null;

  return (
    <ul className="space-y-2">
      {bullets.map((bullet, idx) => (
        <li key={idx} className="flex items-start gap-2 text-sm text-slate-300">
          <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${iconColor}`} />
          <span>{bullet}</span>
        </li>
      ))}
    </ul>
  );
}

// ============================================================================
// Story Section Stats Row Component
// ============================================================================

interface StorySectionStat {
  label: string;
  value: string | number;
  suffix?: string;
}

interface StorySectionStatsRowProps {
  stats: StorySectionStat[];
}

export function StorySectionStatsRow({ stats }: StorySectionStatsRowProps) {
  return (
    <div className="flex flex-wrap gap-4 p-4 rounded-lg bg-slate-800/30 border border-slate-700/30">
      {stats.map((stat, idx) => (
        <div key={idx} className="text-center min-w-[80px]">
          <div className="text-xl font-bold text-slate-100 tabular-nums">
            {stat.value}
            {stat.suffix && <span className="text-sm text-slate-500">{stat.suffix}</span>}
          </div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wide">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
