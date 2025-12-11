'use client';

// components/reports/QBRHighlightsGrid.tsx
// QBR Highlights Grid - 2x2 grid for Key Wins, Challenges, Next Quarter Focus, Theme Deep Dives

import { Trophy, AlertTriangle, Target, Layers, ChevronRight } from 'lucide-react';
import type { QBRNarrativeSection, ThemeDeepDive } from '@/components/qbr/types';

// ============================================================================
// Types
// ============================================================================

interface QBRHighlightsGridProps {
  keyWins?: QBRNarrativeSection;
  keyChallenges?: QBRNarrativeSection;
  nextQuarterFocus?: QBRNarrativeSection;
  themeDeepDives?: ThemeDeepDive[];
}

// ============================================================================
// Highlight Card Component
// ============================================================================

interface HighlightCardProps {
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  title: string;
  pill?: string;
  bullets: string[];
  jumpToId: string;
  emptyMessage?: string;
}

function HighlightCard({
  icon: Icon,
  iconColor,
  bgColor,
  borderColor,
  title,
  pill,
  bullets,
  jumpToId,
  emptyMessage = 'No data available',
}: HighlightCardProps) {
  const handleJumpClick = () => {
    const element = document.getElementById(jumpToId);
    if (element) {
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - offset;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    }
  };

  const hasBullets = bullets && bullets.length > 0;
  const displayBullets = hasBullets ? bullets.slice(0, 5) : [];

  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} p-4 md:p-5 flex flex-col`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-lg ${iconColor}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
            {pill && (
              <span className="text-[10px] text-slate-500">{pill}</span>
            )}
          </div>
        </div>
      </div>

      {/* Bullets */}
      <div className="flex-1 mb-3">
        {hasBullets ? (
          <ul className="space-y-1.5">
            {displayBullets.map((bullet, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                <span className="text-slate-500 mt-0.5">\u2022</span>
                <span className="line-clamp-2">{bullet}</span>
              </li>
            ))}
            {bullets.length > 5 && (
              <li className="text-xs text-slate-500 pl-4">
                +{bullets.length - 5} more...
              </li>
            )}
          </ul>
        ) : (
          <p className="text-xs text-slate-500 italic">{emptyMessage}</p>
        )}
      </div>

      {/* Jump to section link */}
      <button
        onClick={handleJumpClick}
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors self-start"
      >
        Jump to section
        <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  );
}

// ============================================================================
// Theme Card (Simplified)
// ============================================================================

interface ThemeCardProps {
  themes: ThemeDeepDive[];
}

function ThemeCard({ themes }: ThemeCardProps) {
  const handleJumpClick = () => {
    const element = document.getElementById('deep-dives');
    if (element) {
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - offset;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    }
  };

  const topThemes = themes.slice(0, 4);

  return (
    <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4 md:p-5 flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Theme Deep Dives</h3>
            <span className="text-[10px] text-slate-500">{themes.length} areas analyzed</span>
          </div>
        </div>
      </div>

      {/* Theme pills */}
      <div className="flex-1 mb-3">
        {topThemes.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {topThemes.map((theme, idx) => (
              <span
                key={idx}
                className="inline-flex items-center px-2 py-1 rounded text-[11px] font-medium bg-slate-800/50 text-slate-300 border border-slate-700/50"
              >
                {theme.theme}
                <span className="ml-1.5 text-slate-500">({theme.findings.length})</span>
              </span>
            ))}
            {themes.length > 4 && (
              <span className="text-xs text-slate-500 self-center">
                +{themes.length - 4} more
              </span>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">No themes identified</p>
        )}
      </div>

      {/* Jump to section link */}
      <button
        onClick={handleJumpClick}
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors self-start"
      >
        View all themes
        <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function QBRHighlightsGrid({
  keyWins,
  keyChallenges,
  nextQuarterFocus,
  themeDeepDives = [],
}: QBRHighlightsGridProps) {
  // Get the challenge tone for styling
  const challengeTone = keyChallenges?.tone;
  const isCritical = challengeTone === 'critical';

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Key Wins */}
      <HighlightCard
        icon={Trophy}
        iconColor="bg-emerald-500/20 text-emerald-400"
        bgColor="bg-emerald-500/5"
        borderColor="border-emerald-500/30"
        title="Key Wins"
        pill={keyWins?.subtitle}
        bullets={keyWins?.bullets || []}
        jumpToId="key-wins"
        emptyMessage="No wins captured this quarter"
      />

      {/* Key Challenges */}
      <HighlightCard
        icon={AlertTriangle}
        iconColor={isCritical ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}
        bgColor={isCritical ? 'bg-red-500/5' : 'bg-amber-500/5'}
        borderColor={isCritical ? 'border-red-500/30' : 'border-amber-500/30'}
        title="Key Challenges"
        pill={keyChallenges?.subtitle}
        bullets={keyChallenges?.bullets || []}
        jumpToId="challenges"
        emptyMessage="No significant challenges identified"
      />

      {/* Next Quarter Focus */}
      <HighlightCard
        icon={Target}
        iconColor="bg-cyan-500/20 text-cyan-400"
        bgColor="bg-cyan-500/5"
        borderColor="border-cyan-500/30"
        title="Next Quarter Focus"
        pill={nextQuarterFocus?.subtitle}
        bullets={nextQuarterFocus?.bullets || []}
        jumpToId="next-quarter"
        emptyMessage="Focus areas not yet defined"
      />

      {/* Theme Deep Dives */}
      <ThemeCard themes={themeDeepDives} />
    </div>
  );
}
