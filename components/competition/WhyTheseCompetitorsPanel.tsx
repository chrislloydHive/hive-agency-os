// components/competition/WhyTheseCompetitorsPanel.tsx
// Competition Lab V4 - "Why these competitors?" Transparency Panel
//
// Shows:
// - Modality inference used (with confidence badge)
// - Top trait rules that drove classification
// - Per-competitor: signalsUsed badges, overlapScore, classification badge

'use client';

import { useMemo, useState } from 'react';
import type {
  CompetitionV4Result,
  ScoredCompetitor,
  CompetitorSignalsUsed,
  ModalityInferenceInfo,
  CompetitiveModalityType,
} from '@/lib/competition-v4/types';

// ============================================================================
// Types
// ============================================================================

interface Props {
  /** The V4 competition result */
  result: CompetitionV4Result;
  /** Whether to show in compact mode */
  compact?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const MODALITY_LABELS: Record<CompetitiveModalityType, string> = {
  'Retail+Installation': 'Retail + Installation',
  'InstallationOnly': 'Installation Only',
  'RetailWithInstallAddon': 'Retail (Install Optional)',
  'ProductOnly': 'Product Only',
  'InternalAlternative': 'Internal Alternative',
};

const CLASSIFICATION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  primary: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
  contextual: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  alternative: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' },
  excluded: { bg: 'bg-slate-600/10', text: 'text-slate-500', border: 'border-slate-600/30' },
};

const CLASSIFICATION_LABELS: Record<string, string> = {
  primary: 'Primary',
  contextual: 'Contextual',
  alternative: 'Alternative',
  excluded: 'Excluded',
};

// ============================================================================
// Main Component
// ============================================================================

export function WhyTheseCompetitorsPanel({ result, compact = false }: Props) {
  const [expandedCompetitor, setExpandedCompetitor] = useState<string | null>(null);

  const scoredCompetitors = result.scoredCompetitors;
  const modalityInfo = result.modalityInference;

  // Combine all competitors for display
  const allCompetitors = useMemo(() => {
    if (!scoredCompetitors) return [];
    return [
      ...(scoredCompetitors.primary || []),
      ...(scoredCompetitors.contextual || []),
      ...(scoredCompetitors.alternatives || []),
    ];
  }, [scoredCompetitors]);

  // Get top trait rules
  const topRules = useMemo(() => {
    return scoredCompetitors?.topTraitRules?.slice(0, 5) || [];
  }, [scoredCompetitors]);

  if (!scoredCompetitors) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/30 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/50">
        <h3 className="text-sm font-medium text-slate-200">Why these competitors?</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Trait-based classification for {result.companyName}
        </p>
      </div>

      {/* Modality Section */}
      <div className="px-4 py-3 border-b border-slate-800">
        <ModalitySection
          modality={scoredCompetitors.modality}
          confidence={scoredCompetitors.modalityConfidence}
          inferenceInfo={modalityInfo}
        />
      </div>

      {/* Top Rules Section */}
      {topRules.length > 0 && (
        <div className="px-4 py-3 border-b border-slate-800">
          <div className="text-xs font-medium text-slate-400 mb-2">Classification Rules Applied</div>
          <div className="flex flex-wrap gap-1.5">
            {topRules.map((rule, i) => (
              <span
                key={i}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300"
              >
                {rule}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Competitor Buckets */}
      <div className="divide-y divide-slate-800">
        {/* Primary Competitors */}
        {scoredCompetitors.primary.length > 0 && (
          <BucketSection
            title="Primary Competitors"
            description="Direct revenue threats - customers actively compare"
            competitors={scoredCompetitors.primary}
            classification="primary"
            expandedId={expandedCompetitor}
            onToggle={setExpandedCompetitor}
            compact={compact}
          />
        )}

        {/* Contextual Competitors */}
        {scoredCompetitors.contextual.length > 0 && (
          <BucketSection
            title="Contextual Competitors"
            description="Comparison anchors - customers may reference"
            competitors={scoredCompetitors.contextual}
            classification="contextual"
            expandedId={expandedCompetitor}
            onToggle={setExpandedCompetitor}
            compact={compact}
          />
        )}

        {/* Alternative Competitors */}
        {scoredCompetitors.alternatives.length > 0 && (
          <BucketSection
            title="Alternatives"
            description="Secondary considerations"
            competitors={scoredCompetitors.alternatives}
            classification="alternative"
            expandedId={expandedCompetitor}
            onToggle={setExpandedCompetitor}
            compact={compact}
          />
        )}
      </div>

      {/* Excluded Section (collapsible) */}
      {scoredCompetitors.excluded.length > 0 && (
        <ExcludedSection excluded={scoredCompetitors.excluded} />
      )}
    </div>
  );
}

// ============================================================================
// Modality Section
// ============================================================================

interface ModalitySectionProps {
  modality: CompetitiveModalityType | null;
  confidence?: number;
  inferenceInfo?: ModalityInferenceInfo;
}

function ModalitySection({ modality, confidence, inferenceInfo }: ModalitySectionProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (!modality) {
    return (
      <div className="text-xs text-slate-500">No modality set</div>
    );
  }

  const confidenceColor = confidence
    ? confidence >= 80 ? 'text-green-400'
    : confidence >= 60 ? 'text-amber-400'
    : 'text-red-400'
    : 'text-slate-400';

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-400">Competitive Modality:</span>
          <span className="text-sm text-slate-200">{MODALITY_LABELS[modality] || modality}</span>
        </div>
        {confidence !== undefined && (
          <span className={`text-xs ${confidenceColor}`}>
            {confidence}% confidence
          </span>
        )}
      </div>

      {/* Inference Details (expandable) */}
      {inferenceInfo && (
        <div className="mt-2">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-slate-500 hover:text-slate-400 flex items-center gap-1"
          >
            <svg
              className={`w-3 h-3 transition-transform ${showDetails ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {showDetails ? 'Hide details' : 'Show inference details'}
          </button>

          {showDetails && (
            <div className="mt-2 pl-4 border-l border-slate-700 space-y-2">
              <div className="text-xs text-slate-400">{inferenceInfo.explanation}</div>

              {inferenceInfo.signals.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-slate-500 mb-1">Signals detected:</div>
                  <div className="flex flex-wrap gap-1">
                    {inferenceInfo.signals.map((signal, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400"
                      >
                        {signal}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-4 text-xs">
                <span className="text-slate-500">
                  Service emphasis: <span className="text-slate-300">{Math.round(inferenceInfo.serviceEmphasis * 100)}%</span>
                </span>
                <span className="text-slate-500">
                  Product emphasis: <span className="text-slate-300">{Math.round(inferenceInfo.productEmphasis * 100)}%</span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Bucket Section
// ============================================================================

interface BucketSectionProps {
  title: string;
  description: string;
  competitors: ScoredCompetitor[];
  classification: string;
  expandedId: string | null;
  onToggle: (id: string | null) => void;
  compact: boolean;
}

function BucketSection({
  title,
  description,
  competitors,
  classification,
  expandedId,
  onToggle,
  compact,
}: BucketSectionProps) {
  const colors = CLASSIFICATION_COLORS[classification] || CLASSIFICATION_COLORS.alternative;

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${colors.text}`}>{title}</span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] ${colors.bg} ${colors.text} ${colors.border} border`}>
              {competitors.length}
            </span>
          </div>
          <p className="text-[10px] text-slate-500">{description}</p>
        </div>
      </div>

      <div className="space-y-1">
        {competitors.map(comp => (
          <CompetitorRow
            key={comp.domain || comp.name}
            competitor={comp}
            classification={classification}
            isExpanded={expandedId === (comp.domain || comp.name)}
            onToggle={() => onToggle(
              expandedId === (comp.domain || comp.name) ? null : (comp.domain || comp.name)
            )}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Competitor Row
// ============================================================================

interface CompetitorRowProps {
  competitor: ScoredCompetitor;
  classification: string;
  isExpanded: boolean;
  onToggle: () => void;
  compact: boolean;
}

function CompetitorRow({ competitor, classification, isExpanded, onToggle, compact }: CompetitorRowProps) {
  const colors = CLASSIFICATION_COLORS[classification] || CLASSIFICATION_COLORS.alternative;

  return (
    <div className={`rounded border ${colors.border} ${colors.bg}`}>
      {/* Main row */}
      <button
        onClick={onToggle}
        className="w-full px-2 py-1.5 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-slate-200 truncate">{competitor.name}</span>
          {competitor.domain && (
            <span className="text-[10px] text-slate-500 truncate hidden sm:inline">
              {competitor.domain}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Overlap Score */}
          <span className={`text-xs ${colors.text}`}>
            {competitor.overlapScore}%
          </span>

          {/* Signal badges (compact) */}
          {!compact && competitor.signalsUsed && (
            <SignalBadges signals={competitor.signalsUsed} compact />
          )}

          {/* Expand icon */}
          <svg
            className={`w-3 h-3 text-slate-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-2 pb-2 border-t border-slate-800/50 pt-2 space-y-2">
          {/* Reasons */}
          {competitor.reasons && competitor.reasons.length > 0 && (
            <div>
              <div className="text-[10px] font-medium text-slate-500 mb-1">Why included:</div>
              <ul className="text-[10px] text-slate-400 space-y-0.5 pl-3">
                {competitor.reasons.map((reason, i) => (
                  <li key={i} className="list-disc">{reason}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Why This Matters */}
          {competitor.whyThisMatters && (
            <div>
              <div className="text-[10px] font-medium text-slate-500 mb-1">Strategic significance:</div>
              <div className="text-[10px] text-slate-400">{competitor.whyThisMatters}</div>
            </div>
          )}

          {/* Full Signal Details */}
          {competitor.signalsUsed && (
            <div>
              <div className="text-[10px] font-medium text-slate-500 mb-1">Signals used:</div>
              <SignalBadges signals={competitor.signalsUsed} />
            </div>
          )}

          {/* Rules Applied */}
          {competitor.rulesApplied && competitor.rulesApplied.length > 0 && (
            <div>
              <div className="text-[10px] font-medium text-slate-500 mb-1">Rules applied:</div>
              <div className="flex flex-wrap gap-1">
                {competitor.rulesApplied.map((rule, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                    {rule}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Confidence */}
          {competitor.confidence !== undefined && (
            <div className="text-[10px] text-slate-500">
              Signal confidence: <span className="text-slate-300">{competitor.confidence}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Signal Badges
// ============================================================================

interface SignalBadgesProps {
  signals: CompetitorSignalsUsed;
  compact?: boolean;
}

function SignalBadges({ signals, compact = false }: SignalBadgesProps) {
  const badges: { label: string; value: string; color: string }[] = [];

  if (signals.installationCapability !== undefined) {
    badges.push({
      label: 'Install',
      value: signals.installationCapability ? 'Yes' : 'No',
      color: signals.installationCapability ? 'bg-green-500/20 text-green-400' : 'bg-slate-600/20 text-slate-500',
    });
  }

  if (signals.geographicOverlap) {
    badges.push({
      label: 'Geo',
      value: signals.geographicOverlap,
      color: 'bg-blue-500/20 text-blue-400',
    });
  }

  if (signals.marketReach) {
    badges.push({
      label: 'Reach',
      value: signals.marketReach,
      color: 'bg-purple-500/20 text-purple-400',
    });
  }

  if (signals.pricePositioning && signals.pricePositioning !== 'unknown') {
    badges.push({
      label: 'Price',
      value: signals.pricePositioning,
      color: 'bg-amber-500/20 text-amber-400',
    });
  }

  if (signals.productOverlap !== undefined) {
    badges.push({
      label: 'Products',
      value: signals.productOverlap ? 'Overlap' : 'Different',
      color: signals.productOverlap ? 'bg-green-500/20 text-green-400' : 'bg-slate-600/20 text-slate-500',
    });
  }

  if (signals.serviceOverlap !== undefined) {
    badges.push({
      label: 'Services',
      value: signals.serviceOverlap ? 'Overlap' : 'Different',
      color: signals.serviceOverlap ? 'bg-green-500/20 text-green-400' : 'bg-slate-600/20 text-slate-500',
    });
  }

  if (compact) {
    // Show just icons/abbreviations
    return (
      <div className="flex gap-0.5">
        {badges.slice(0, 3).map((badge, i) => (
          <span
            key={i}
            className={`text-[9px] px-1 py-0.5 rounded ${badge.color}`}
            title={`${badge.label}: ${badge.value}`}
          >
            {badge.label.slice(0, 2)}
          </span>
        ))}
        {badges.length > 3 && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-slate-700 text-slate-400">
            +{badges.length - 3}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((badge, i) => (
        <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded ${badge.color}`}>
          {badge.label}: {badge.value}
        </span>
      ))}
    </div>
  );
}

// ============================================================================
// Excluded Section
// ============================================================================

interface ExcludedSectionProps {
  excluded: { name: string; domain: string; reason: string }[];
}

function ExcludedSection({ excluded }: ExcludedSectionProps) {
  const [showExcluded, setShowExcluded] = useState(false);

  return (
    <div className="px-4 py-2 border-t border-slate-800 bg-slate-900/50">
      <button
        onClick={() => setShowExcluded(!showExcluded)}
        className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-400"
      >
        <svg
          className={`w-3 h-3 transition-transform ${showExcluded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {excluded.length} excluded (low overlap)
      </button>

      {showExcluded && (
        <div className="mt-2 space-y-1">
          {excluded.map((comp, i) => (
            <div key={i} className="flex items-start gap-2 text-[10px]">
              <span className="text-slate-400 min-w-0 truncate">{comp.name}</span>
              <span className="text-slate-600 flex-shrink-0">&mdash;</span>
              <span className="text-slate-500 truncate">{comp.reason}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
