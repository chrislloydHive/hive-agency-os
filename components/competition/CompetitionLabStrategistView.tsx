// components/competition/CompetitionLabStrategistView.tsx
// Competition Lab V4 - Strategist View
//
// A clean, card-based layout for strategic intelligence.
// Designed to be read like a one-page strategist brief.

'use client';

import type { CompetitionStrategistModel, StrategistCompetitorSummary } from '@/lib/competition-v3/strategist-types';

// ============================================================================
// Types
// ============================================================================

interface Props {
  strategist: CompetitionStrategistModel;
}

// ============================================================================
// Main Component
// ============================================================================

export function CompetitionLabStrategistView({ strategist }: Props) {
  return (
    <div className="space-y-6 pb-8">
      {/* Section 1: Story of the Landscape */}
      <section>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Story of the Landscape
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          {/* Card 1: Headline */}
          <Card
            title="Competitive Headline"
            accent="rose"
          >
            <p className="text-lg font-semibold text-slate-100 mb-2">
              {strategist.headline}
            </p>
            <p className="text-sm text-slate-400 leading-relaxed">
              {strategist.elevator}
            </p>
          </Card>

          {/* Card 2: Where You Sit */}
          <Card
            title="Where You Sit"
            accent="amber"
          >
            <p className="text-sm text-slate-300 leading-relaxed mb-3">
              {strategist.positioningSummary.slice(0, 200)}
              {strategist.positioningSummary.length > 200 ? '...' : ''}
            </p>
            {strategist.keyTalkingPoints.length > 0 && (
              <ul className="space-y-1.5">
                {strategist.keyTalkingPoints.slice(0, 3).map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                    <span className="text-amber-400 mt-0.5">•</span>
                    {point}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Card 3: Plays This Quarter */}
          <Card
            title="Plays This Quarter"
            accent="emerald"
          >
            {strategist.recommendedPlays.now.length > 0 ? (
              <ul className="space-y-2">
                {strategist.recommendedPlays.now.slice(0, 3).map((play, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-medium">
                      {i + 1}
                    </span>
                    {play}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500 italic">No immediate plays identified</p>
            )}
          </Card>
        </div>
      </section>

      {/* Section 2: Who You Really Compete With */}
      <section>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Who You Really Compete With
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {/* Primary Competitors */}
          <Card
            title="Primary Competitors"
            subtitle={`${strategist.primaryCompetitors.length} direct threats`}
            accent="red"
            className="md:row-span-2"
          >
            <div className="space-y-3">
              {strategist.primaryCompetitors.map((comp) => (
                <CompetitorRow key={comp.id} competitor={comp} isPrimary />
              ))}
              {strategist.primaryCompetitors.length === 0 && (
                <p className="text-sm text-slate-500 italic">No primary competitors identified</p>
              )}
            </div>
          </Card>

          {/* Alternatives */}
          <div className="space-y-4">
            {/* Fractional CMOs */}
            {strategist.altOptionsByType.fractional.length > 0 && (
              <Card
                title="Fractional CMOs"
                subtitle="Alternative hire path"
                accent="sky"
                compact
              >
                <div className="space-y-2">
                  {strategist.altOptionsByType.fractional.slice(0, 2).map((comp) => (
                    <CompetitorRow key={comp.id} competitor={comp} />
                  ))}
                </div>
              </Card>
            )}

            {/* Platforms */}
            {strategist.altOptionsByType.platform.length > 0 && (
              <Card
                title="Platforms"
                subtitle="Tool alternatives"
                accent="amber"
                compact
              >
                <div className="space-y-2">
                  {strategist.altOptionsByType.platform.slice(0, 2).map((comp) => (
                    <CompetitorRow key={comp.id} competitor={comp} />
                  ))}
                </div>
              </Card>
            )}

            {/* Internal Hire */}
            {strategist.altOptionsByType.internal.length > 0 && (
              <Card
                title="Internal Hire"
                subtitle="Build vs. buy decision"
                accent="blue"
                compact
              >
                <div className="space-y-2">
                  {strategist.altOptionsByType.internal.slice(0, 2).map((comp) => (
                    <CompetitorRow key={comp.id} competitor={comp} />
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </section>

      {/* Section 3: Plays, Risks, Talking Points */}
      <section>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Strategic Playbook
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          {/* Plays */}
          <Card
            title="Recommended Plays"
            accent="emerald"
          >
            <div className="space-y-4">
              {/* Now */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-emerald-400 uppercase">Now</span>
                  <div className="flex-1 h-px bg-slate-800" />
                </div>
                <ul className="space-y-1">
                  {strategist.recommendedPlays.now.map((play, i) => (
                    <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                      <span className="text-emerald-400 text-xs mt-1">→</span>
                      {play}
                    </li>
                  ))}
                  {strategist.recommendedPlays.now.length === 0 && (
                    <li className="text-sm text-slate-500 italic">None</li>
                  )}
                </ul>
              </div>

              {/* Next */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-amber-400 uppercase">Next</span>
                  <div className="flex-1 h-px bg-slate-800" />
                </div>
                <ul className="space-y-1">
                  {strategist.recommendedPlays.next.map((play, i) => (
                    <li key={i} className="text-sm text-slate-400 flex items-start gap-2">
                      <span className="text-amber-400 text-xs mt-1">→</span>
                      {play}
                    </li>
                  ))}
                  {strategist.recommendedPlays.next.length === 0 && (
                    <li className="text-sm text-slate-500 italic">None</li>
                  )}
                </ul>
              </div>

              {/* Later */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Later</span>
                  <div className="flex-1 h-px bg-slate-800" />
                </div>
                <ul className="space-y-1">
                  {strategist.recommendedPlays.later.map((play, i) => (
                    <li key={i} className="text-sm text-slate-500 flex items-start gap-2">
                      <span className="text-slate-600 text-xs mt-1">→</span>
                      {play}
                    </li>
                  ))}
                  {strategist.recommendedPlays.later.length === 0 && (
                    <li className="text-sm text-slate-500 italic">None</li>
                  )}
                </ul>
              </div>
            </div>
          </Card>

          {/* Risks */}
          <Card
            title="Key Risks"
            accent="red"
          >
            <ul className="space-y-2">
              {strategist.keyRisks.map((risk, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="flex-shrink-0 w-4 h-4 rounded bg-red-500/20 text-red-400 flex items-center justify-center text-xs">
                    !
                  </span>
                  {risk}
                </li>
              ))}
              {strategist.keyRisks.length === 0 && (
                <li className="text-sm text-slate-500 italic">No major risks identified</li>
              )}
            </ul>
          </Card>

          {/* Sales Talking Points */}
          <Card
            title="Sales Talking Points"
            accent="violet"
          >
            <ul className="space-y-2">
              {strategist.keyTalkingPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="text-violet-400 mt-0.5">✓</span>
                  {point}
                </li>
              ))}
              {strategist.keyTalkingPoints.length === 0 && (
                <li className="text-sm text-slate-500 italic">No talking points generated</li>
              )}
            </ul>
          </Card>
        </div>
      </section>

      {/* Section 4: Watch List (if present) */}
      {strategist.watchListNotes && (
        <section>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Watch List
          </h3>
          <Card
            title="Emerging Patterns"
            accent="cyan"
          >
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
// Card Component
// ============================================================================

interface CardProps {
  title: string;
  subtitle?: string;
  accent?: 'rose' | 'amber' | 'emerald' | 'red' | 'sky' | 'blue' | 'violet' | 'cyan';
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
