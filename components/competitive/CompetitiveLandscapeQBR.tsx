'use client';

// components/competitive/CompetitiveLandscapeQBR.tsx
// Comprehensive Competitive Landscape section for QBR
//
// Features:
// - Enhanced positioning map with clusters and whitespace
// - Threat model summary
// - Feature matrix highlights
// - Messaging differentiation score
// - Substitutes awareness

import { useMemo } from 'react';
import { PositioningMapBrandHalo } from './PositioningMapBrandHalo';
import {
  mapPositionToSvgCoordinates,
  type CompetitorPoint,
  type BrandPosition,
} from './positioningMapUtils';
import type {
  MarketCluster,
  ThreatScore,
  WhitespaceOpportunity,
  Substitute,
  FeatureMatrixEntry,
  MessageOverlap,
} from '@/lib/contextGraph/domains/competitive';

// ============================================================================
// Types
// ============================================================================

export interface CompetitiveLandscapeQBRProps {
  companyName: string;

  // Positioning map data
  primaryAxisLabel: string;
  secondaryAxisLabel: string;
  primaryAxisLow?: string;
  primaryAxisHigh?: string;
  secondaryAxisLow?: string;
  secondaryAxisHigh?: string;
  brandPosition?: BrandPosition | null;
  competitors?: CompetitorPoint[];
  positioningSummary?: string | null;

  // Expanded competitive data
  marketClusters?: MarketCluster[];
  whitespaceOpportunities?: WhitespaceOpportunity[];
  threatScores?: ThreatScore[];
  overallThreatLevel?: number | null;
  featuresMatrix?: FeatureMatrixEntry[];
  messageOverlap?: MessageOverlap[];
  messagingDifferentiationScore?: number | null;
  substitutes?: Substitute[];
  differentiationStrategy?: string | null;
  competitiveAdvantages?: string[];
  competitiveThreats?: string[];
}

// ============================================================================
// Sub-components
// ============================================================================

function ThreatLevelBadge({ level }: { level: number }) {
  let color = 'bg-green-500/20 text-green-400';
  let label = 'Low';

  if (level >= 70) {
    color = 'bg-red-500/20 text-red-400';
    label = 'Critical';
  } else if (level >= 50) {
    color = 'bg-orange-500/20 text-orange-400';
    label = 'High';
  } else if (level >= 30) {
    color = 'bg-yellow-500/20 text-yellow-400';
    label = 'Medium';
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {label} ({level}/100)
    </span>
  );
}

function MetricCard({
  label,
  value,
  subtext,
  color = 'purple',
}: {
  label: string;
  value: string | number;
  subtext?: string;
  color?: 'purple' | 'green' | 'red' | 'orange' | 'blue';
}) {
  const colorClasses = {
    purple: 'border-purple-500/30 bg-purple-500/10',
    green: 'border-green-500/30 bg-green-500/10',
    red: 'border-red-500/30 bg-red-500/10',
    orange: 'border-orange-500/30 bg-orange-500/10',
    blue: 'border-blue-500/30 bg-blue-500/10',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-2xl font-bold text-slate-100">{value}</div>
      {subtext && <div className="text-xs text-slate-400 mt-1">{subtext}</div>}
    </div>
  );
}

function CompetitorThreatList({ threats }: { threats: ThreatScore[] }) {
  const sortedThreats = useMemo(
    () => [...threats].sort((a, b) => b.threatLevel - a.threatLevel).slice(0, 5),
    [threats]
  );

  if (sortedThreats.length === 0) return null;

  return (
    <div className="space-y-2">
      {sortedThreats.map((threat) => (
        <div
          key={threat.competitorName}
          className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
        >
          <div>
            <div className="font-medium text-slate-200">{threat.competitorName}</div>
            {threat.threatDrivers.length > 0 && (
              <div className="text-xs text-slate-500 mt-0.5">
                {threat.threatDrivers.slice(0, 2).join(' • ')}
              </div>
            )}
          </div>
          <ThreatLevelBadge level={threat.threatLevel} />
        </div>
      ))}
    </div>
  );
}

function FeatureGapsList({ features }: { features: FeatureMatrixEntry[] }) {
  // Find features where company doesn't support but competitors do
  const gaps = useMemo(
    () =>
      features
        .filter((f) => {
          const competitorCount = f.competitors.filter((c) => c.hasFeature).length;
          return !f.companySupport && competitorCount >= 2;
        })
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 5),
    [features]
  );

  if (gaps.length === 0) return null;

  return (
    <div className="space-y-2">
      {gaps.map((feature) => (
        <div
          key={feature.featureName}
          className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
        >
          <div>
            <div className="font-medium text-slate-200">{feature.featureName}</div>
            {feature.description && (
              <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                {feature.description}
              </div>
            )}
          </div>
          <span className="text-xs text-orange-400 bg-orange-500/10 px-2 py-1 rounded">
            Importance: {feature.importance}
          </span>
        </div>
      ))}
    </div>
  );
}

function MessagingOverlapChart({ overlaps }: { overlaps: MessageOverlap[] }) {
  const sortedOverlaps = useMemo(
    () => [...overlaps].sort((a, b) => b.overlapScore - a.overlapScore).slice(0, 5),
    [overlaps]
  );

  if (sortedOverlaps.length === 0) return null;

  return (
    <div className="space-y-3">
      {sortedOverlaps.map((overlap) => (
        <div key={overlap.theme} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-300">{overlap.theme}</span>
            <span
              className={`text-xs ${
                overlap.overlapScore >= 60
                  ? 'text-red-400'
                  : overlap.overlapScore >= 40
                  ? 'text-orange-400'
                  : 'text-green-400'
              }`}
            >
              {overlap.overlapScore}% overlap
            </span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                overlap.overlapScore >= 60
                  ? 'bg-red-500'
                  : overlap.overlapScore >= 40
                  ? 'bg-orange-500'
                  : 'bg-green-500'
              }`}
              style={{ width: `${overlap.overlapScore}%` }}
            />
          </div>
          {overlap.suggestion && (
            <div className="text-xs text-slate-500 italic">→ {overlap.suggestion}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function SubstitutesList({ substitutes }: { substitutes: Substitute[] }) {
  const sortedSubstitutes = useMemo(
    () => [...substitutes].sort((a, b) => b.threatLevel - a.threatLevel).slice(0, 4),
    [substitutes]
  );

  if (sortedSubstitutes.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      {sortedSubstitutes.map((sub) => (
        <div key={sub.name} className="p-3 bg-slate-800/50 rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-slate-200 text-sm">{sub.name}</span>
            <span className="text-xs text-slate-500">{sub.threatLevel}/100</span>
          </div>
          {sub.category && (
            <span className="text-xs text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">
              {sub.category}
            </span>
          )}
          {sub.reasonCustomersChooseThem && (
            <div className="text-xs text-slate-500 mt-1 line-clamp-2">
              {sub.reasonCustomersChooseThem}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ClusterLegend({ clusters }: { clusters: MarketCluster[] }) {
  if (clusters.length === 0) return null;

  const clusterColors = ['#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6', '#10B981'];

  return (
    <div className="flex flex-wrap gap-2">
      {clusters.map((cluster, idx) => (
        <div
          key={cluster.clusterName}
          className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 rounded text-xs"
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: cluster.color || clusterColors[idx % clusterColors.length] }}
          />
          <span className="text-slate-300">{cluster.clusterName}</span>
          <span className="text-slate-500">({cluster.threatLevel})</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CompetitiveLandscapeQBR({
  companyName,
  primaryAxisLabel,
  secondaryAxisLabel,
  primaryAxisLow,
  primaryAxisHigh,
  secondaryAxisLow,
  secondaryAxisHigh,
  brandPosition,
  competitors = [],
  positioningSummary,
  marketClusters = [],
  whitespaceOpportunities = [],
  threatScores = [],
  overallThreatLevel,
  featuresMatrix = [],
  messageOverlap = [],
  messagingDifferentiationScore,
  substitutes = [],
  differentiationStrategy,
  competitiveAdvantages = [],
  competitiveThreats = [],
}: CompetitiveLandscapeQBRProps) {
  // Calculate summary metrics
  const highThreatCount = threatScores.filter((t) => t.threatLevel >= 60).length;
  const featureGapCount = featuresMatrix.filter((f) => {
    const competitorCount = f.competitors.filter((c) => c.hasFeature).length;
    return !f.companySupport && competitorCount >= 2;
  }).length;
  const saturatedMessagingCount = messageOverlap.filter((m) => m.overlapScore >= 60).length;

  return (
    <div className="space-y-8">
      {/* Header Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          label="Overall Threat Level"
          value={overallThreatLevel ?? 'N/A'}
          subtext={overallThreatLevel != null ? (overallThreatLevel >= 60 ? 'High Alert' : 'Manageable') : undefined}
          color={overallThreatLevel != null && overallThreatLevel >= 60 ? 'red' : 'green'}
        />
        <MetricCard
          label="High-Threat Competitors"
          value={highThreatCount}
          subtext={`of ${threatScores.length} analyzed`}
          color={highThreatCount >= 3 ? 'orange' : 'blue'}
        />
        <MetricCard
          label="Feature Gaps"
          value={featureGapCount}
          subtext="vs competitors"
          color={featureGapCount >= 3 ? 'red' : 'green'}
        />
        <MetricCard
          label="Messaging Differentiation"
          value={messagingDifferentiationScore != null ? `${messagingDifferentiationScore}%` : 'N/A'}
          subtext={saturatedMessagingCount > 0 ? `${saturatedMessagingCount} saturated themes` : undefined}
          color={
            messagingDifferentiationScore != null
              ? messagingDifferentiationScore >= 60
                ? 'green'
                : 'orange'
              : 'purple'
          }
        />
      </div>

      {/* Positioning Map + Clusters */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="font-medium text-slate-200 mb-4">Market Positioning</h3>
          <div className="flex justify-center">
            <PositioningMapBrandHalo
              primaryAxisLabel={primaryAxisLabel}
              secondaryAxisLabel={secondaryAxisLabel}
              primaryAxisLow={primaryAxisLow}
              primaryAxisHigh={primaryAxisHigh}
              secondaryAxisLow={secondaryAxisLow}
              secondaryAxisHigh={secondaryAxisHigh}
              brandPosition={brandPosition}
              competitors={competitors}
              companyName={companyName}
              showAnnotations={true}
              width={400}
              height={400}
            />
          </div>

          {/* Cluster Legend */}
          {marketClusters.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs text-slate-500 mb-2">Market Clusters</h4>
              <ClusterLegend clusters={marketClusters} />
            </div>
          )}

          {/* Whitespace Opportunities */}
          {whitespaceOpportunities.length > 0 && (
            <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <h4 className="text-xs text-green-400 font-medium mb-2">Whitespace Opportunities</h4>
              <div className="space-y-1">
                {whitespaceOpportunities.slice(0, 3).map((ws) => (
                  <div key={ws.name} className="text-sm text-slate-300">
                    <span className="font-medium">{ws.name}</span>
                    {ws.strategicFit !== undefined && (
                      <span className="text-xs text-slate-500 ml-2">
                        (Fit: {ws.strategicFit}/100)
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column: Threat Model + Strategy */}
        <div className="space-y-4">
          {/* Threat Scores */}
          {threatScores.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="font-medium text-slate-200 mb-4">Competitor Threat Model</h3>
              <CompetitorThreatList threats={threatScores} />
            </div>
          )}

          {/* Differentiation Strategy */}
          {differentiationStrategy && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="font-medium text-slate-200 mb-2">Differentiation Strategy</h3>
              <p className="text-sm text-slate-400">{differentiationStrategy}</p>
            </div>
          )}

          {/* Competitive Advantages */}
          {competitiveAdvantages.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="font-medium text-slate-200 mb-3">Competitive Advantages</h3>
              <ul className="space-y-1">
                {competitiveAdvantages.slice(0, 4).map((adv, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span className="text-slate-300">{adv}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Feature Matrix & Messaging */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Feature Gaps */}
        {featuresMatrix.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="font-medium text-slate-200 mb-4">Feature Gaps</h3>
            <p className="text-xs text-slate-500 mb-3">
              Features competitors have that you don&apos;t
            </p>
            <FeatureGapsList features={featuresMatrix} />
            {featureGapCount === 0 && (
              <p className="text-sm text-green-400">No significant feature gaps detected!</p>
            )}
          </div>
        )}

        {/* Messaging Overlap */}
        {messageOverlap.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="font-medium text-slate-200 mb-4">Messaging Overlap</h3>
            <p className="text-xs text-slate-500 mb-3">
              High overlap = saturated messaging theme
            </p>
            <MessagingOverlapChart overlaps={messageOverlap} />
          </div>
        )}
      </div>

      {/* Substitutes */}
      {substitutes.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="font-medium text-slate-200 mb-4">Alternative Solutions & Substitutes</h3>
          <p className="text-xs text-slate-500 mb-3">
            Non-traditional competitors and workarounds customers might use
          </p>
          <SubstitutesList substitutes={substitutes} />
        </div>
      )}

      {/* Positioning Summary */}
      {positioningSummary && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="font-medium text-slate-200 mb-2">Positioning Summary</h3>
          <p className="text-sm text-slate-400">{positioningSummary}</p>
        </div>
      )}

      {/* Competitive Threats */}
      {competitiveThreats.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
          <h3 className="font-medium text-red-400 mb-3">Key Competitive Threats</h3>
          <ul className="space-y-2">
            {competitiveThreats.map((threat, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-red-400 mt-0.5">⚠</span>
                <span className="text-slate-300">{threat}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
