// components/competition/CompetitionLabStrategistView.tsx
// Competition Lab V3.5 - Strategist View
//
// A clean, card-based layout for strategic intelligence.
// Designed to be read like a one-page strategist brief.
//
// Layout:
// - Row 1: Story of the Landscape (3 cards: Headline, Position, Q-Focus)
// - Row 2: Who You Really Compete With (clustered by type)
// - Row 3: Strategic Playbook (Plays, Risks, Talking Points)

'use client';

import { useMemo } from 'react';
import type { CompetitionStrategistModel, StrategistCompetitorSummary } from '@/lib/competition-v3/strategist-types';

// ============================================================================
// Types
// ============================================================================

interface Props {
  strategist: CompetitionStrategistModel;
  /** Vertical category for hiding agency-only sections */
  verticalCategory?: string | null;
}

/**
 * Verticals where fractional/internal/platform don't make sense.
 * These are the "non-agency" verticals.
 */
const HIDE_AGENCY_ALTERNATIVES = new Set([
  'retail',
  'automotive',
  'consumer-dtc',
  'manufacturing',
  'software',
  'marketplace',
  'financial-services',
]);

// ============================================================================
// Main Component
// ============================================================================

export function CompetitionLabStrategistView({ strategist, verticalCategory }: Props) {
  // Determine if we should hide agency-only sections
  const hideAgencyAlternatives = verticalCategory
    ? HIDE_AGENCY_ALTERNATIVES.has(verticalCategory.toLowerCase())
    : false;

  // Group competitors by type for better display
  const competitorGroups = useMemo(() => {
    const direct = strategist.primaryCompetitors.filter(c => c.type.toLowerCase().includes('direct'));
    const partial = strategist.primaryCompetitors.filter(c =>
      c.type.toLowerCase().includes('partial') || c.type.toLowerCase().includes('overlap')
    );
    const fractional = strategist.altOptionsByType.fractional;
    const platforms = strategist.altOptionsByType.platform;
    const internal = strategist.altOptionsByType.internal;

    // Calculate average threats
    const avgThreat = (arr: StrategistCompetitorSummary[]) =>
      arr.length > 0 ? Math.round(arr.reduce((sum, c) => sum + c.threat, 0) / arr.length) : 0;

    return {
      direct: { items: direct, avgThreat: avgThreat(direct) },
      partial: { items: partial, avgThreat: avgThreat(partial) },
      fractional: { items: fractional, avgThreat: avgThreat(fractional) },
      platforms: { items: platforms, avgThreat: avgThreat(platforms) },
      internal: { items: internal, avgThreat: avgThreat(internal) },
    };
  }, [strategist]);

  return (
    <div className="space-y-6 pb-8">
      {/* ================================================================== */}
      {/* Row 1: Story of the Landscape */}
      {/* ================================================================== */}
      <section>
        <SectionHeader title="Story of the Landscape" />
        <div className="grid gap-4 md:grid-cols-3">
          {/* Card 1: Headline */}
          <Card title="Headline" accent="rose">
            <p className="text-base font-semibold text-slate-100 mb-2 leading-snug">
              {strategist.headline}
            </p>
            <p className="text-sm text-slate-400 leading-relaxed line-clamp-3">
              {strategist.elevator}
            </p>
          </Card>

          {/* Card 2: Position */}
          <Card title="Position" accent="amber">
            <p className="text-sm text-slate-300 leading-relaxed mb-2 line-clamp-4">
              {strategist.positioningSummary}
            </p>
            {strategist.keyTalkingPoints.length > 0 && (
              <ul className="space-y-1">
                {strategist.keyTalkingPoints.slice(0, 2).map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-400 line-clamp-1">
                    <span className="text-amber-400 mt-0.5 shrink-0">•</span>
                    <span className="line-clamp-1">{point}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Card 3: Q-Focus */}
          <Card title="Q-Focus" accent="emerald">
            {strategist.recommendedPlays.now.length > 0 ? (
              <ul className="space-y-2">
                {strategist.recommendedPlays.now.slice(0, 3).map((play, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-medium">
                      {i + 1}
                    </span>
                    <span className="line-clamp-2">{play}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500 italic">No immediate plays identified</p>
            )}
          </Card>
        </div>
      </section>

      {/* ================================================================== */}
      {/* Row 2: Who You Really Compete With */}
      {/* ================================================================== */}
      <section>
        <SectionHeader title="Who You Really Compete With" />
        <div className="grid gap-4 lg:grid-cols-[1fr,320px]">
          {/* Left Column: Primary & Secondary Competitors */}
          <div className="space-y-4">
            {/* Direct Competitors Group */}
            {strategist.primaryCompetitors.length > 0 && (
              <CompetitorGroup
                title="Direct"
                count={strategist.primaryCompetitors.length}
                avgThreat={competitorGroups.direct.avgThreat || competitorGroups.partial.avgThreat}
                accent="red"
              >
                <div className="space-y-2">
                  {strategist.primaryCompetitors.slice(0, 4).map((comp) => (
                    <CompetitorRow key={comp.id} competitor={comp} isPrimary />
                  ))}
                </div>
              </CompetitorGroup>
            )}

            {/* Partial Competitors Group */}
            {competitorGroups.partial.items.length > 0 && (
              <CompetitorGroup
                title="Partial Overlap"
                count={competitorGroups.partial.items.length}
                avgThreat={competitorGroups.partial.avgThreat}
                accent="orange"
              >
                <div className="space-y-2">
                  {competitorGroups.partial.items.slice(0, 3).map((comp) => (
                    <CompetitorRow key={comp.id} competitor={comp} />
                  ))}
                </div>
              </CompetitorGroup>
            )}
          </div>

          {/* Right Column: Platforms / Alternatives / Internal */}
          {/* Hidden for non-agency verticals (retail, automotive, etc.) where these categories don't apply */}
          {!hideAgencyAlternatives && (
            <div className="space-y-3">
              {/* Platforms */}
              {competitorGroups.platforms.items.length > 0 && (
                <Card
                  title="Platforms"
                  subtitle={`${competitorGroups.platforms.items.length} tools`}
                  accent="amber"
                  compact
                >
                  <div className="space-y-2">
                    {competitorGroups.platforms.items.slice(0, 3).map((comp) => (
                      <CompetitorRowCompact key={comp.id} competitor={comp} />
                    ))}
                  </div>
                </Card>
              )}

              {/* Internal Hire */}
              {competitorGroups.internal.items.length > 0 && (
                <Card
                  title="Internal Hire"
                  subtitle="Build vs buy"
                  accent="blue"
                  compact
                >
                  <div className="space-y-2">
                    {competitorGroups.internal.items.slice(0, 2).map((comp) => (
                      <CompetitorRowCompact key={comp.id} competitor={comp} />
                    ))}
                  </div>
                </Card>
              )}

              {/* Fractional Alternatives */}
              {competitorGroups.fractional.items.length > 0 && (
                <Card
                  title="Fractional"
                  subtitle="Alternative path"
                  accent="sky"
                  compact
                >
                  <div className="space-y-2">
                    {competitorGroups.fractional.items.slice(0, 2).map((comp) => (
                      <CompetitorRowCompact key={comp.id} competitor={comp} />
                    ))}
                  </div>
                </Card>
              )}

              {/* Empty state if no alternatives */}
              {competitorGroups.platforms.items.length === 0 &&
               competitorGroups.internal.items.length === 0 &&
               competitorGroups.fractional.items.length === 0 && (
                <Card title="Alternatives" accent="slate" compact>
                  <p className="text-xs text-slate-500 italic">No platform or internal alternatives identified</p>
                </Card>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ================================================================== */}
      {/* Row 3: Strategic Playbook */}
      {/* ================================================================== */}
      <section>
        <SectionHeader title="Strategic Playbook" />
        <div className="grid gap-4 md:grid-cols-3">
          {/* Plays - NOW / NEXT / LATER */}
          <Card title="Recommended Plays" accent="emerald">
            <div className="space-y-3">
              {/* Now */}
              <PlaySection
                label="Now"
                items={strategist.recommendedPlays.now}
                color="emerald"
              />
              {/* Next */}
              <PlaySection
                label="Next"
                items={strategist.recommendedPlays.next}
                color="amber"
              />
              {/* Later */}
              <PlaySection
                label="Later"
                items={strategist.recommendedPlays.later}
                color="slate"
              />
            </div>
          </Card>

          {/* Key Risks */}
          <Card title="Key Risks" accent="red">
            <ul className="space-y-2">
              {strategist.keyRisks.slice(0, 5).map((risk, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="flex-shrink-0 w-4 h-4 rounded bg-red-500/20 text-red-400 flex items-center justify-center text-xs mt-0.5">
                    !
                  </span>
                  <span className="line-clamp-2">{risk}</span>
                </li>
              ))}
              {strategist.keyRisks.length === 0 && (
                <li className="text-sm text-slate-500 italic">No major risks identified</li>
              )}
            </ul>
          </Card>

          {/* Messaging Anchors / Sales Talking Points */}
          <Card title="Messaging Anchors" accent="violet">
            <ul className="space-y-2">
              {strategist.keyTalkingPoints.slice(0, 5).map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="text-violet-400 mt-0.5 shrink-0">✓</span>
                  <span className="line-clamp-2">{point}</span>
                </li>
              ))}
              {strategist.keyTalkingPoints.length === 0 && (
                <li className="text-sm text-slate-500 italic">No talking points generated</li>
              )}
            </ul>
          </Card>
        </div>
      </section>

      {/* ================================================================== */}
      {/* Row 4: Watch List (if present) */}
      {/* ================================================================== */}
      {strategist.watchListNotes && (
        <section>
          <SectionHeader title="Watch List" />
          <Card title="Emerging Patterns" accent="cyan">
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
              {strategist.watchListNotes}
            </p>
          </Card>
        </section>
      )}
    </div>
  );
}

// ============================================================================
// Section Header Component
// ============================================================================

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
      {title}
    </h3>
  );
}

// ============================================================================
// Competitor Group Component (for clustered display)
// ============================================================================

interface CompetitorGroupProps {
  title: string;
  count: number;
  avgThreat: number;
  accent: 'red' | 'orange' | 'amber' | 'sky' | 'blue';
  children: React.ReactNode;
}

function CompetitorGroup({ title, count, avgThreat, accent, children }: CompetitorGroupProps) {
  const accentColors = {
    red: 'border-red-500/30 bg-red-500/5',
    orange: 'border-orange-500/30 bg-orange-500/5',
    amber: 'border-amber-500/30 bg-amber-500/5',
    sky: 'border-sky-500/30 bg-sky-500/5',
    blue: 'border-blue-500/30 bg-blue-500/5',
  };

  const headerColors = {
    red: 'text-red-400',
    orange: 'text-orange-400',
    amber: 'text-amber-400',
    sky: 'text-sky-400',
    blue: 'text-blue-400',
  };

  return (
    <div className={`rounded-lg border ${accentColors[accent]} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h4 className={`text-sm font-semibold ${headerColors[accent]}`}>{title}</h4>
          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400">
            {count}
          </span>
        </div>
        {avgThreat > 0 && (
          <span className="text-xs text-slate-500">
            Avg threat: <span className={avgThreat >= 60 ? 'text-red-400' : 'text-slate-400'}>{avgThreat}</span>
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

// ============================================================================
// Play Section Component (NOW/NEXT/LATER)
// ============================================================================

function PlaySection({
  label,
  items,
  color,
}: {
  label: string;
  items: string[];
  color: 'emerald' | 'amber' | 'slate';
}) {
  const labelColors = {
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    slate: 'text-slate-500',
  };

  const arrowColors = {
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    slate: 'text-slate-600',
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`text-[10px] font-bold uppercase ${labelColors[color]}`}>{label}</span>
        <div className="flex-1 h-px bg-slate-800" />
      </div>
      <ul className="space-y-1">
        {items.slice(0, 3).map((item, i) => (
          <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
            <span className={`${arrowColors[color]} mt-0.5 shrink-0`}>→</span>
            <span className="line-clamp-2">{item}</span>
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-xs text-slate-500 italic">None</li>
        )}
      </ul>
    </div>
  );
}

// ============================================================================
// Compact Competitor Row (for sidebar alternatives)
// ============================================================================

function CompetitorRowCompact({ competitor }: { competitor: StrategistCompetitorSummary }) {
  const threatColor =
    competitor.threat >= 70 ? 'text-red-400' :
    competitor.threat >= 50 ? 'text-amber-400' :
    'text-slate-400';

  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium text-slate-200 truncate block">{competitor.name}</span>
        {competitor.keyAngles.length > 0 && (
          <span className="text-[10px] text-slate-500 truncate block">{competitor.keyAngles[0]}</span>
        )}
      </div>
      <span className={`text-xs font-mono ${threatColor}`}>{competitor.threat}</span>
    </div>
  );
}

// ============================================================================
// Card Component
// ============================================================================

interface CardProps {
  title: string;
  subtitle?: string;
  accent?: 'rose' | 'amber' | 'emerald' | 'red' | 'sky' | 'blue' | 'violet' | 'cyan' | 'slate' | 'orange';
  compact?: boolean;
  className?: string;
  children: React.ReactNode;
}

function Card({ title, subtitle, accent = 'amber', compact, className, children }: CardProps) {
  const accentColors = {
    rose: 'border-rose-500/30',
    amber: 'border-amber-500/30',
    emerald: 'border-emerald-500/30',
    red: 'border-red-500/30',
    sky: 'border-sky-500/30',
    blue: 'border-blue-500/30',
    violet: 'border-violet-500/30',
    cyan: 'border-cyan-500/30',
    slate: 'border-slate-500/30',
    orange: 'border-orange-500/30',
  };

  const titleColors = {
    rose: 'text-rose-400',
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
    red: 'text-red-400',
    sky: 'text-sky-400',
    blue: 'text-blue-400',
    violet: 'text-violet-400',
    cyan: 'text-cyan-400',
    slate: 'text-slate-400',
    orange: 'text-orange-400',
  };

  return (
    <div
      className={`rounded-lg border ${accentColors[accent]} bg-slate-900/50 ${compact ? 'p-3' : 'p-4'} ${className || ''}`}
    >
      <div className="flex items-baseline justify-between mb-3">
        <h4 className={`text-sm font-semibold ${titleColors[accent]}`}>{title}</h4>
        {subtitle && (
          <span className="text-xs text-slate-500">{subtitle}</span>
        )}
      </div>
      {children}
    </div>
  );
}

// ============================================================================
// Competitor Row Component
// ============================================================================

interface CompetitorRowProps {
  competitor: StrategistCompetitorSummary;
  isPrimary?: boolean;
}

function CompetitorRow({ competitor, isPrimary }: CompetitorRowProps) {
  const threatColor =
    competitor.threat >= 70 ? 'text-red-400' :
    competitor.threat >= 50 ? 'text-amber-400' :
    'text-slate-400';

  return (
    <div className={`${isPrimary ? 'p-3 rounded-lg bg-slate-800/50 border border-slate-700/50' : ''}`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-medium ${isPrimary ? 'text-slate-100' : 'text-slate-200'} text-sm truncate`}>
              {competitor.name}
            </span>
            <span className={`text-xs ${threatColor} font-mono`}>
              {competitor.threat}
            </span>
          </div>
          <span className="text-xs text-slate-500">{competitor.type}</span>
        </div>
      </div>

      {isPrimary && (
        <>
          <p className="text-xs text-slate-400 mb-2 leading-relaxed">
            {competitor.whyThreat}
          </p>
          {competitor.keyAngles.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {competitor.keyAngles.slice(0, 3).map((angle, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-400 border border-slate-700"
                >
                  {angle.length > 40 ? angle.slice(0, 40) + '...' : angle}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {!isPrimary && competitor.keyAngles.length > 0 && (
        <p className="text-xs text-slate-500 mt-0.5">
          {competitor.keyAngles[0]}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

export function StrategistViewSkeleton() {
  return (
    <div className="space-y-6 pb-8 animate-pulse">
      {/* Section 1 */}
      <section>
        <div className="h-4 w-40 bg-slate-800 rounded mb-3" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
              <div className="h-4 w-24 bg-slate-800 rounded mb-3" />
              <div className="h-6 w-full bg-slate-800 rounded mb-2" />
              <div className="h-4 w-3/4 bg-slate-800 rounded" />
            </div>
          ))}
        </div>
      </section>

      {/* Section 2 */}
      <section>
        <div className="h-4 w-48 bg-slate-800 rounded mb-3" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <div className="h-4 w-32 bg-slate-800 rounded mb-4" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="mb-3">
                <div className="h-4 w-40 bg-slate-800 rounded mb-1" />
                <div className="h-3 w-full bg-slate-800 rounded" />
              </div>
            ))}
          </div>
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                <div className="h-4 w-24 bg-slate-800 rounded mb-2" />
                <div className="h-3 w-full bg-slate-800 rounded" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// Error State
// ============================================================================

export function StrategistViewError({ message }: { message?: string }) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-6 text-center">
      <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-3">
        <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <p className="text-sm font-medium text-amber-300 mb-1">
        Couldn't build the strategist view
      </p>
      <p className="text-xs text-amber-400/70">
        {message || 'You can still use the Data view to explore raw competitor data.'}
      </p>
    </div>
  );
}
