// components/competition/v4/TieredCompetitorSections.tsx
// Tiered competitor display for Competition Lab V4
//
// AUTHORITATIVE MODE:
// - NO user toggles or inputs for competitor inclusion/exclusion
// - System deterministically decides competitor placement
// - Retail-hybrid competitors are ALWAYS included, ALWAYS labeled clearly
// - Transparency via declarative copy, not user delegation
//
// SINGLE SOURCE OF TRUTH:
// - Uses reduceCompetitionForUI as the ONLY source for competitor data
// - All gating, deduplication, and sorting is handled by the reducer
// - This component is a pure render layer
//
// Product Principle: Hive OS explains competition — it does not ask users to define it.

'use client';

import { useState, useMemo, useEffect } from 'react';
import type {
  ScoredCompetitor,
  ExcludedCompetitorRecord,
  CompetitionV4Result,
} from '@/lib/competition-v4/types';
import {
  reduceCompetitionForUI,
  type ReducedCompetitor,
  type ReducedCompetition,
} from '@/lib/competition-v4/reduceCompetitionForUI';
import {
  assertValidCompetitionRun,
  type SubjectInfo,
} from '@/lib/competition-v4/validateCompetitionRun';

// ============================================================================
// Types
// ============================================================================

interface Props {
  data: CompetitionV4Result;
  subjectCompanyName?: string;
  subjectDomain?: string | null;
}

type PressureBadgeType = 'revenue' | 'pricing' | 'expectations';

// ============================================================================
// NOTE: Gating, deduplication, and tier assignment logic is handled by
// reduceCompetitionForUI. This component is a pure render layer.
// ============================================================================

// ============================================================================
// Pressure Badge Calculation
// ============================================================================

function calculatePressureBadges(
  competitor: ReducedCompetitor,
  allPrimary: ReducedCompetitor[],
  allContextual: ReducedCompetitor[]
): PressureBadgeType[] {
  const badges: PressureBadgeType[] = [];

  // Revenue Threat: High overlap primary competitors
  const revenueContributors = allPrimary
    .sort((a, b) => b.overlapScore - a.overlapScore)
    .slice(0, 3)
    .map(c => c.name);
  if (revenueContributors.includes(competitor.name)) {
    badges.push('revenue');
  }

  // Price Pressure: Budget positioning OR major retailer
  const allCompetitors = [...allPrimary, ...allContextual];
  const pricingContributors = [
    ...allCompetitors.filter(c => c.isMajorRetailer).slice(0, 2),
    ...allCompetitors.filter(c => c.pricePositioning === 'budget').slice(0, 2),
  ].map(c => c.name);
  if (pricingContributors.includes(competitor.name)) {
    badges.push('pricing');
  }

  // Expectation Setter: National brands, major retailers, premium brands
  const expectationContributors = [
    ...allCompetitors.filter(c => c.isMajorRetailer).slice(0, 2),
    ...allCompetitors.filter(c => c.hasNationalReach && !c.isMajorRetailer).slice(0, 1),
    ...allCompetitors.filter(c => c.pricePositioning === 'premium' && !c.isMajorRetailer).slice(0, 1),
  ].map(c => c.name);
  if (expectationContributors.includes(competitor.name)) {
    badges.push('expectations');
  }

  return badges;
}

// ============================================================================
// Helper Components
// ============================================================================

function OverlapScoreBadge({ score, emphasized }: { score: number; emphasized?: boolean }) {
  const getColor = () => {
    if (score >= 70) return 'bg-red-500/20 text-red-400 border-red-500/30';
    if (score >= 50) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    if (score >= 30) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getColor()} ${emphasized ? 'ring-1 ring-white/20' : ''}`}>
      {score}% overlap
    </span>
  );
}

function PressureBadge({ type }: { type: PressureBadgeType }) {
  const config = {
    revenue: { label: 'Revenue Threat', color: 'bg-red-500/15 text-red-300 border-red-500/30' },
    pricing: { label: 'Price Pressure', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
    expectations: { label: 'Expectation Setter', color: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
  };
  const { label, color } = config[type];
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${color}`}>
      {label}
    </span>
  );
}

function CompetitorTypeBadge({ type }: { type: 'install-first' | 'retail-hybrid' | 'expectation-setter' }) {
  const config = {
    'install-first': { label: 'Install-First', color: 'bg-blue-500/15 text-blue-300' },
    'retail-hybrid': { label: 'Retail-Hybrid', color: 'bg-purple-500/15 text-purple-300' },
    'expectation-setter': { label: 'Retail-Hybrid (Expectation Setter)', color: 'bg-amber-500/15 text-amber-300' },
  };
  const { label, color } = config[type];
  return <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${color}`}>{label}</span>;
}

function PricePositionBadge({ position }: { position?: 'budget' | 'mid' | 'premium' }) {
  if (!position) return null;
  const config = {
    budget: { label: 'Budget', color: 'bg-green-500/10 text-green-400' },
    mid: { label: 'Mid-market', color: 'bg-blue-500/10 text-blue-400' },
    premium: { label: 'Premium', color: 'bg-purple-500/10 text-purple-400' },
  };
  const { label, color } = config[position];
  return <span className={`px-2 py-0.5 rounded text-[10px] ${color}`}>{label}</span>;
}

function GeoReachBadge({ reach }: { reach?: 'local' | 'regional' | 'national' }) {
  if (!reach) return null;
  const config = {
    local: { label: 'Local', color: 'text-slate-400' },
    regional: { label: 'Regional', color: 'text-slate-400' },
    national: { label: 'National', color: 'text-amber-400' },
  };
  const { label, color } = config[reach];
  return <span className={`text-[10px] ${color}`}>{label}</span>;
}

function SignalsList({ signals }: { signals?: Record<string, unknown> }) {
  if (!signals || Object.keys(signals).length === 0) return null;

  const formatSignal = (key: string, value: unknown): string | null => {
    if (value === true) return key.replace(/([A-Z])/g, ' $1').trim();
    if (value === false) return null;
    if (typeof value === 'string') return `${key}: ${value}`;
    return null;
  };

  const formattedSignals = Object.entries(signals)
    .map(([k, v]) => formatSignal(k, v))
    .filter(Boolean);

  if (formattedSignals.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {formattedSignals.map((signal, idx) => (
        <span key={idx} className="px-1.5 py-0.5 bg-slate-800 text-slate-500 text-[10px] rounded">
          {signal}
        </span>
      ))}
    </div>
  );
}

// ============================================================================
// Competitor Card Components (using ReducedCompetitor from reducer)
// ============================================================================

interface EnrichedCompetitor extends ReducedCompetitor {
  pressureBadges: PressureBadgeType[];
  isMultiDimensionThreat: boolean;
}

function PrimaryCompetitorCard({
  competitor,
  competitorType,
}: {
  competitor: EnrichedCompetitor;
  competitorType: 'install-first' | 'retail-hybrid';
}) {
  const [expanded, setExpanded] = useState(false);

  // Visual emphasis: higher opacity/contrast for multi-dimension threats or high overlap
  const isEmphasized = competitor.isMultiDimensionThreat || competitor.overlapScore >= 70;
  const borderClass = competitorType === 'retail-hybrid'
    ? 'border-purple-500/30 hover:border-purple-500/50'
    : 'border-red-500/20 hover:border-red-500/40';
  const bgOpacity = isEmphasized ? 'bg-slate-800/70' : 'bg-slate-800/40';

  return (
    <div className={`${bgOpacity} border ${borderClass} rounded-lg overflow-hidden transition-colors`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className={`text-sm font-semibold ${isEmphasized ? 'text-white' : 'text-slate-200'} truncate`}>
                {competitor.name}
              </h4>
              <CompetitorTypeBadge type={competitorType} />
            </div>
            {competitor.domain && (
              <a
                href={`https://${competitor.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-slate-500 hover:text-slate-400 transition-colors"
              >
                {competitor.domain}
              </a>
            )}
          </div>
          <OverlapScoreBadge score={competitor.overlapScore} emphasized={isEmphasized} />
        </div>

        {/* Pressure Badges */}
        {competitor.pressureBadges.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {competitor.pressureBadges.map(badge => (
              <PressureBadge key={badge} type={badge} />
            ))}
          </div>
        )}

        {/* Competition Mechanism */}
        <p className={`text-sm leading-relaxed mb-3 ${isEmphasized ? 'text-slate-200' : 'text-slate-400'}`}>
          {competitor.competitionMechanism}
        </p>

        {/* Why This Matters (if different) */}
        {competitor.whyThisMatters && competitor.whyThisMatters !== competitor.competitionMechanism && (
          <p className="text-xs text-slate-400 leading-relaxed mb-3 italic">
            {competitor.whyThisMatters}
          </p>
        )}

        {/* Quick Stats */}
        <div className="flex items-center gap-3 text-xs">
          <PricePositionBadge position={competitor.pricePositioning === 'unknown' ? undefined : competitor.pricePositioning} />
          <GeoReachBadge reach={competitor.raw.signalsUsed?.geographicOverlap} />
          {competitor.hasInstallation && (
            <span className="text-blue-400">Has Installation</span>
          )}
        </div>

        {/* Expand/Collapse */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-xs text-slate-500 hover:text-slate-400 transition-colors flex items-center gap-1"
        >
          <span>{expanded ? 'Hide' : 'Show'} details</span>
          <svg
            className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-700/50 mt-2 pt-3 space-y-3">
          {competitor.reasons && competitor.reasons.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Classification Reasons</p>
              <ul className="space-y-1">
                {competitor.reasons.map((reason, idx) => (
                  <li key={idx} className="text-xs text-slate-400 flex items-start gap-2">
                    <span className="text-red-400 mt-0.5">•</span>
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <SignalsList signals={competitor.raw.signalsUsed as Record<string, unknown>} />
          {competitor.raw.rulesApplied && competitor.raw.rulesApplied.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Rules Applied</p>
              <div className="flex flex-wrap gap-1">
                {competitor.raw.rulesApplied.map((rule, idx) => (
                  <span key={idx} className="px-1.5 py-0.5 bg-slate-700 text-slate-400 text-[10px] rounded">
                    {rule}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Mandatory explanatory copy for retail-hybrid competitors.
 * This copy MUST appear wherever retail-hybrids are shown (per spec).
 */
const RETAIL_HYBRID_EXPLANATORY_COPY =
  'National retail brands influence early-stage consideration and pricing expectations but rarely compete on service depth. They are shown here to contextualize customer expectations.';

/**
 * Card for Retail-Hybrid competitors in Contextual tier.
 * Shows "Expectation Setter" label and mandatory explanatory copy.
 *
 * AUTHORITATIVE: No gating language - these are always included, always in Contextual
 * under InstallationOnly mode. The system decided this, not the user.
 */
function RetailHybridContextualCard({
  competitor,
}: {
  competitor: EnrichedCompetitor;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-slate-800/30 border border-amber-500/30 rounded-lg overflow-hidden">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className="text-sm font-medium text-slate-200 truncate">{competitor.name}</h4>
              <CompetitorTypeBadge type="expectation-setter" />
            </div>
            {competitor.domain && (
              <span className="text-xs text-slate-500">{competitor.domain}</span>
            )}
          </div>
          <OverlapScoreBadge score={competitor.overlapScore} />
        </div>

        {/* Mandatory Explanatory Copy - AUTHORITATIVE, not conditional */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded p-3 mb-3">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {RETAIL_HYBRID_EXPLANATORY_COPY}
          </p>
        </div>

        {/* Competition Mechanism */}
        <p className="text-xs text-slate-400 leading-relaxed mb-2">
          {competitor.competitionMechanism}
        </p>

        {/* Pressure Badges */}
        {competitor.pressureBadges.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {competitor.pressureBadges.map(badge => (
              <PressureBadge key={badge} type={badge} />
            ))}
          </div>
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-[10px] text-slate-500 hover:text-slate-400 transition-colors"
        >
          {expanded ? 'Less' : 'More'} details
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-3 border-t border-slate-700/30 pt-2">
          <SignalsList signals={competitor.raw.signalsUsed as Record<string, unknown>} />
        </div>
      )}
    </div>
  );
}

function ContextualCompetitorCard({ competitor }: { competitor: EnrichedCompetitor }) {
  const [expanded, setExpanded] = useState(false);

  const isLowOverlap = competitor.overlapScore < 40;
  const textClass = isLowOverlap ? 'text-slate-400' : 'text-slate-200';

  return (
    <div className={`${isLowOverlap ? 'bg-slate-800/20' : 'bg-slate-800/30'} border border-amber-500/20 rounded-lg overflow-hidden hover:border-amber-500/30 transition-colors`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className={`text-sm font-medium ${textClass} truncate`}>{competitor.name}</h4>
              {competitor.isMajorRetailer && (
                <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-[10px] rounded">Big Box</span>
              )}
            </div>
            {competitor.domain && (
              <span className="text-xs text-slate-500">{competitor.domain}</span>
            )}
          </div>
          <OverlapScoreBadge score={competitor.overlapScore} />
        </div>

        <p className={`text-xs ${isLowOverlap ? 'text-slate-500' : 'text-slate-400'} leading-relaxed mb-2`}>
          {competitor.competitionMechanism}
        </p>

        {competitor.whyThisMatters && (
          <p className="text-xs text-slate-500 leading-relaxed italic">
            {competitor.whyThisMatters}
          </p>
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-[10px] text-slate-500 hover:text-slate-400 transition-colors"
        >
          {expanded ? 'Less' : 'More'} details
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-3 border-t border-slate-700/30 pt-2">
          <SignalsList signals={competitor.raw.signalsUsed as Record<string, unknown>} />
        </div>
      )}
    </div>
  );
}

function AlternativeCard({ competitor }: { competitor: ReducedCompetitor }) {
  return (
    <div className="bg-slate-800/15 border border-slate-600/20 rounded-lg p-3 hover:border-slate-600/40 transition-colors">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h4 className="text-sm text-slate-400">{competitor.name}</h4>
        <span className="text-[10px] text-slate-600">{competitor.overlapScore}%</span>
      </div>
      <p className="text-xs text-slate-500">
        {competitor.whyThisMatters || competitor.raw.reason || 'Alternative solution customers may consider'}
      </p>
    </div>
  );
}

function ExcludedCard({ excluded }: { excluded: ExcludedCompetitorRecord }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-800 last:border-0">
      <div className="flex-1 min-w-0">
        <span className="text-sm text-slate-500">{excluded.name}</span>
        {excluded.domain && (
          <span className="text-xs text-slate-600 ml-2">({excluded.domain})</span>
        )}
      </div>
      <span className="text-[10px] text-slate-600 flex-shrink-0 max-w-[200px] text-right">
        {excluded.reason}
      </span>
    </div>
  );
}

// ============================================================================
// Section Components
// ============================================================================

function SectionHeader({
  title,
  subtitle,
  count,
  color,
  icon,
}: {
  title: string;
  subtitle: string;
  count: number;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <span className="px-2 py-0.5 bg-slate-800 text-slate-400 text-xs rounded-full">{count}</span>
        </div>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

function SubGroupHeader({ title, description, count, badge }: {
  title: string;
  description: string;
  count: number;
  badge: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-700/50">
      <div className="flex items-center gap-3">
        <h4 className="text-sm font-medium text-slate-300">{title}</h4>
        {badge}
        <span className="text-xs text-slate-500">({count})</span>
      </div>
      <p className="text-xs text-slate-500 hidden md:block">{description}</p>
    </div>
  );
}

function EmptyContextualState({
  hasRetailHybrids,
}: {
  hasRetailHybrids: boolean;
}) {
  return (
    <div className="bg-slate-800/20 border border-amber-500/10 rounded-lg p-6 text-center">
      <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-amber-500/10 flex items-center justify-center">
        <svg className="w-5 h-5 text-amber-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p className="text-sm text-slate-400 mb-2">
        No additional contextual competitors identified.
      </p>
      <p className="text-xs text-slate-500">
        {hasRetailHybrids
          ? 'Retail-hybrid competitors (expectation setters) appear above.'
          : 'Competitors that influence expectations without directly competing for jobs will appear here when detected.'}
      </p>
    </div>
  );
}

function SubjectCompanyNote() {
  return (
    <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg px-4 py-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>
      <p className="text-xs text-purple-300/80">
        Your company is shown on the Plot Map and Pressure Analysis as a reference point.
      </p>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Enrich ReducedCompetitor with UI-specific data (pressure badges).
 * This is a pure render-time enrichment, not affecting core reducer logic.
 */
function enrichForUI(
  competitor: ReducedCompetitor,
  allPrimary: ReducedCompetitor[],
  allContextual: ReducedCompetitor[]
): EnrichedCompetitor {
  const pressureBadges = calculatePressureBadges(competitor, allPrimary, allContextual);
  return {
    ...competitor,
    pressureBadges,
    isMultiDimensionThreat: pressureBadges.length >= 2,
  };
}

export function TieredCompetitorSections({ data, subjectCompanyName, subjectDomain }: Props) {
  const [showExcluded, setShowExcluded] = useState(false);

  // Build subject info for reducer
  const subject: SubjectInfo = useMemo(() => ({
    companyName: subjectCompanyName || '',
    domain: subjectDomain || data.domain || null,
  }), [subjectCompanyName, subjectDomain, data.domain]);

  // SINGLE SOURCE OF TRUTH: Use reducer for all tier assignment and gating
  const reduced = useMemo(() => reduceCompetitionForUI(data, subject), [data, subject]);

  // DEV LOGGING: Fail-fast validation in development
  useEffect(() => {
    if (data && subject.companyName) {
      // This logs errors in dev/test, warns in production
      assertValidCompetitionRun(data, subject);
    }
  }, [data, subject]);

  // Enrich competitors with UI-specific data (pressure badges)
  const {
    installFirst,
    retailHybridPrimary,
    contextual,
    gatedRetailHybrid,
    alternatives,
    excluded,
    subjectWasFiltered,
  } = useMemo(() => {
    const allPrimary = [...reduced.tiers.primaryInstallFirst, ...reduced.tiers.primaryRetailHybrid];
    const allContextual = reduced.tiers.contextual;

    // Separate retail-hybrids that were gated from primary (originalTier === 'primary' but now in contextual)
    const gatedFromPrimary = allContextual.filter(c => c.mechanism === 'retail-hybrid' && c.originalTier === 'primary');
    const regularContextual = allContextual.filter(c => !(c.mechanism === 'retail-hybrid' && c.originalTier === 'primary'));

    return {
      installFirst: reduced.tiers.primaryInstallFirst.map(c => enrichForUI(c, allPrimary, allContextual)),
      retailHybridPrimary: reduced.tiers.primaryRetailHybrid.map(c => enrichForUI(c, allPrimary, allContextual)),
      contextual: regularContextual.map(c => enrichForUI(c, allPrimary, allContextual)),
      gatedRetailHybrid: gatedFromPrimary.map(c => enrichForUI(c, allPrimary, allContextual)),
      alternatives: reduced.tiers.alternatives,
      excluded: reduced.tiers.excluded,
      subjectWasFiltered: reduced.notes.suppressedSubjectCount > 0,
    };
  }, [reduced]);

  if (!data.scoredCompetitors) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>No scored competitors available. Run analysis to see tiered results.</p>
      </div>
    );
  }

  const totalPrimary = installFirst.length + retailHybridPrimary.length;
  const totalContextual = contextual.length + gatedRetailHybrid.length;

  return (
    <div className="space-y-8">
      {/* Subject Company Note */}
      {subjectWasFiltered && <SubjectCompanyNote />}

      {/* ================================================================== */}
      {/* SECTION A: Primary Competitors (Install-First, or Retail-Hybrid if gating allows) */}
      {/* ================================================================== */}
      <section>
        <SectionHeader
          title="Primary Competitors"
          subtitle="Companies customers most often choose instead of you for installation"
          count={totalPrimary}
          color="bg-red-500/20"
          icon={
            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />
        <p className="text-xs text-slate-500 -mt-2 mb-4">
          Grouped by how competitors win business — not just what they offer.
        </p>

        {totalPrimary === 0 ? (
          <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-6 text-center">
            <p className="text-sm text-slate-500">No primary competitors identified</p>
            <p className="text-xs text-slate-600 mt-1">This may indicate a unique market position or insufficient data</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Install-First Sub-Group */}
            {installFirst.length > 0 && (
              <div>
                <SubGroupHeader
                  title="Install-First Competitors"
                  description="Businesses whose primary value proposition is labor/installation services"
                  count={installFirst.length}
                  badge={<CompetitorTypeBadge type="install-first" />}
                />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {installFirst.map((competitor, idx) => (
                    <PrimaryCompetitorCard
                      key={`${competitor.name}-${idx}`}
                      competitor={competitor}
                      competitorType="install-first"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Retail-Hybrid Sub-Group (ONLY if gating allows) */}
            {retailHybridPrimary.length > 0 && (
              <div>
                <SubGroupHeader
                  title="Retail-Hybrid Competitors"
                  description="Retailers whose primary business is product sale, with installation as add-on"
                  count={retailHybridPrimary.length}
                  badge={<CompetitorTypeBadge type="retail-hybrid" />}
                />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {retailHybridPrimary.map((competitor, idx) => (
                    <PrimaryCompetitorCard
                      key={`${competitor.name}-${idx}`}
                      competitor={competitor}
                      competitorType="retail-hybrid"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ================================================================== */}
      {/* SECTION B: Contextual Competitors (includes Retail-Hybrid Expectation Setters) */}
      {/* ================================================================== */}
      <section>
        <SectionHeader
          title="Contextual Competitors"
          subtitle="Companies that influence customer expectations or early consideration"
          count={totalContextual}
          color="bg-amber-500/20"
          icon={
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          }
        />

        {totalContextual === 0 ? (
          <EmptyContextualState hasRetailHybrids={false} />
        ) : (
          <div className="space-y-4">
            {/* Retail-Hybrid Expectation Setters (ALWAYS included, ALWAYS in Contextual under InstallationOnly) */}
            {gatedRetailHybrid.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Retail-Hybrid (Expectation Setters)
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {gatedRetailHybrid.map((competitor, idx) => (
                    <RetailHybridContextualCard
                      key={`retail-hybrid-${competitor.name}-${idx}`}
                      competitor={competitor}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Regular Contextual Competitors */}
            {contextual.length > 0 && (
              <div className={gatedRetailHybrid.length > 0 ? 'pt-4 border-t border-slate-700/50' : ''}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {contextual.map((competitor, idx) => (
                    <ContextualCompetitorCard key={`${competitor.name}-${idx}`} competitor={competitor} />
                  ))}
                </div>
              </div>
            )}

            {/* If only retail hybrids exist, show explanation */}
            {gatedRetailHybrid.length > 0 && contextual.length === 0 && (
              <EmptyContextualState hasRetailHybrids={true} />
            )}
          </div>
        )}
      </section>

      {/* ================================================================== */}
      {/* SECTION C: Alternatives & Substitutes */}
      {/* ================================================================== */}
      <section>
        <SectionHeader
          title="Alternatives & Substitutes"
          subtitle="Ways customers solve the problem without hiring you"
          count={alternatives.length}
          color="bg-slate-500/20"
          icon={
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          }
        />

        {alternatives.length === 0 ? (
          <div className="bg-slate-800/10 border border-slate-700/30 rounded-lg p-4 text-center">
            <p className="text-xs text-slate-500">No alternatives identified</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            {alternatives.map((alt, idx) => (
              <AlternativeCard key={`${alt.name}-${idx}`} competitor={alt} />
            ))}
          </div>
        )}
      </section>

      {/* ================================================================== */}
      {/* SECTION D: Explicitly Excluded */}
      {/* ================================================================== */}
      {excluded.length > 0 && (
        <section>
          <button
            onClick={() => setShowExcluded(!showExcluded)}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-400 transition-colors mb-3"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showExcluded ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-sm font-medium">Explicitly Excluded</span>
            <span className="px-1.5 py-0.5 bg-slate-800 text-slate-500 text-[10px] rounded">{excluded.length}</span>
            <span className="text-xs text-slate-600">- Entities evaluated and intentionally removed</span>
          </button>

          {showExcluded && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
              <p className="text-xs text-slate-500 mb-3">
                These entities were considered during analysis but excluded based on qualification rules.
              </p>
              <div className="divide-y divide-slate-800">
                {excluded.map((exc, idx) => (
                  <ExcludedCard key={`${exc.name}-${idx}`} excluded={exc} />
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
