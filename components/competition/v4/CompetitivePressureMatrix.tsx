// components/competition/v4/CompetitivePressureMatrix.tsx
// Dimensional competitive pressure analysis for Competition Lab V4
//
// Replaces the single "threat score" with multi-dimensional analysis:
// - Revenue Displacement Risk
// - Margin Pressure
// - Brand Gravity
// - Geographic Saturation
// - Service Overlap
//
// Each dimension is derived from V4 competitor data, showing which
// competitors contribute to pressure on each dimension.

'use client';

import { useMemo } from 'react';
import type {
  CompetitionV4Result,
  ScoredCompetitor,
} from '@/lib/competition-v4/types';

// ============================================================================
// Types
// ============================================================================

interface Props {
  data: CompetitionV4Result;
}

interface PressureDimension {
  id: string;
  label: string;
  description: string;
  score: number; // 0-100
  level: 'low' | 'moderate' | 'high' | 'critical';
  contributors: Array<{
    name: string;
    contribution: number;
    reason: string;
  }>;
  color: string;
  icon: string;
}

// ============================================================================
// Pressure Calculation Functions
// ============================================================================

function calculateRevenueDisplacement(
  primary: ScoredCompetitor[],
  contextual: ScoredCompetitor[]
): PressureDimension {
  // INSTALL-FIRST competitors with high overlap = revenue displacement
  // RETAIL-HYBRID competitors (isMajorRetailer) are excluded from service overlap framing
  // They contribute to margin/expectation pressure instead
  const installFirstPrimary = primary.filter(c => !c.isMajorRetailer);
  const highOverlapPrimary = installFirstPrimary.filter(c => c.overlapScore >= 70);
  const mediumOverlapPrimary = installFirstPrimary.filter(c => c.overlapScore >= 50 && c.overlapScore < 70);

  const score = Math.min(100,
    (highOverlapPrimary.length * 25) +
    (mediumOverlapPrimary.length * 15) +
    (installFirstPrimary.length * 5)
  );

  // Only install-first competitors shown as "service overlap" contributors
  const contributors = installFirstPrimary
    .sort((a, b) => b.overlapScore - a.overlapScore)
    .slice(0, 3)
    .map(c => ({
      name: c.name,
      contribution: c.overlapScore,
      reason: `${c.overlapScore}% service overlap`,
    }));

  return {
    id: 'revenue',
    label: 'Revenue Displacement',
    description: 'Risk of losing deals to install-first competitors',
    score,
    level: score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'moderate' : 'low',
    contributors,
    color: score >= 50 ? 'red' : 'amber',
    icon: 'currency',
  };
}

function calculateMarginPressure(
  primary: ScoredCompetitor[],
  contextual: ScoredCompetitor[]
): PressureDimension {
  // Budget/mid competitors and major retailers create margin pressure
  const budgetCompetitors = [...primary, ...contextual].filter(
    c => c.pricePositioning === 'budget'
  );
  const majorRetailers = [...primary, ...contextual].filter(c => c.isMajorRetailer);
  const nationalPlayers = [...primary, ...contextual].filter(
    c => c.hasNationalReach || c.signalsUsed?.geographicOverlap === 'national'
  );

  const score = Math.min(100,
    (budgetCompetitors.length * 20) +
    (majorRetailers.length * 25) +
    (nationalPlayers.length * 10)
  );

  const contributors = [
    ...majorRetailers.slice(0, 2).map(c => ({
      name: c.name,
      contribution: 35,
      reason: 'Major retailer pricing power',
    })),
    ...budgetCompetitors.slice(0, 2).map(c => ({
      name: c.name,
      contribution: 25,
      reason: 'Budget positioning',
    })),
  ].slice(0, 3);

  return {
    id: 'margin',
    label: 'Margin Pressure',
    description: 'Downward pressure on pricing and profitability',
    score,
    level: score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'moderate' : 'low',
    contributors,
    color: score >= 50 ? 'amber' : 'yellow',
    icon: 'trending-down',
  };
}

function calculateBrandGravity(
  primary: ScoredCompetitor[],
  contextual: ScoredCompetitor[]
): PressureDimension {
  // Major retailers and premium brands have high brand gravity
  const majorRetailers = [...primary, ...contextual].filter(c => c.isMajorRetailer);
  const premiumBrands = [...primary, ...contextual].filter(
    c => c.pricePositioning === 'premium' || (c.brandTrustScore && c.brandTrustScore >= 70)
  );
  const nationalBrands = [...primary, ...contextual].filter(c => c.hasNationalReach);

  const score = Math.min(100,
    (majorRetailers.length * 30) +
    (premiumBrands.length * 15) +
    (nationalBrands.length * 10)
  );

  const contributors = [
    ...majorRetailers.slice(0, 2).map(c => ({
      name: c.name,
      contribution: 40,
      reason: 'National brand recognition',
    })),
    ...premiumBrands.filter(c => !c.isMajorRetailer).slice(0, 1).map(c => ({
      name: c.name,
      contribution: 25,
      reason: 'Premium brand perception',
    })),
  ].slice(0, 3);

  return {
    id: 'brand',
    label: 'Brand Gravity',
    description: 'Customer attention pulled by established brands',
    score,
    level: score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'moderate' : 'low',
    contributors,
    color: score >= 50 ? 'purple' : 'indigo',
    icon: 'star',
  };
}

function calculateGeographicSaturation(
  primary: ScoredCompetitor[],
  contextual: ScoredCompetitor[],
  decomposition: CompetitionV4Result['decomposition']
): PressureDimension {
  // Count local/regional competitors in same geographic scope
  const localCompetitors = primary.filter(
    c => c.isLocal || c.signalsUsed?.geographicOverlap === 'local'
  );
  const regionalCompetitors = primary.filter(
    c => c.signalsUsed?.geographicOverlap === 'regional'
  );
  const nationalInLocal = [...primary, ...contextual].filter(
    c => (c.hasNationalReach || c.isMajorRetailer) &&
        decomposition?.geographic_scope !== 'National'
  );

  const score = Math.min(100,
    (localCompetitors.length * 15) +
    (regionalCompetitors.length * 10) +
    (nationalInLocal.length * 20) +
    (primary.length * 5)
  );

  const contributors = [
    ...localCompetitors.slice(0, 2).map(c => ({
      name: c.name,
      contribution: 20,
      reason: 'Local market presence',
    })),
    ...nationalInLocal.slice(0, 1).map(c => ({
      name: c.name,
      contribution: 30,
      reason: 'National player in local market',
    })),
  ].slice(0, 3);

  return {
    id: 'geographic',
    label: 'Geographic Saturation',
    description: 'Competitor density in your service areas',
    score,
    level: score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'moderate' : 'low',
    contributors,
    color: score >= 50 ? 'blue' : 'cyan',
    icon: 'map',
  };
}

function calculateServiceOverlap(
  primary: ScoredCompetitor[],
  alternatives: ScoredCompetitor[]
): PressureDimension {
  // High service overlap = direct competition for same jobs
  const withInstallation = primary.filter(c => c.hasInstallation);
  const highServiceOverlap = primary.filter(
    c => c.signalsUsed?.serviceOverlap === true
  );
  const avgOverlap = primary.length > 0
    ? Math.round(primary.reduce((sum, c) => sum + c.overlapScore, 0) / primary.length)
    : 0;

  const score = Math.min(100,
    avgOverlap + (withInstallation.length * 5) + (alternatives.length * 3)
  );

  const contributors = primary
    .filter(c => c.hasInstallation)
    .sort((a, b) => b.overlapScore - a.overlapScore)
    .slice(0, 3)
    .map(c => ({
      name: c.name,
      contribution: c.overlapScore,
      reason: c.signalsUsed?.serviceOverlap ? 'Direct service overlap' : 'Similar service offering',
    }));

  return {
    id: 'service',
    label: 'Service Overlap',
    description: 'Competition for the same types of jobs/projects',
    score,
    level: score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'moderate' : 'low',
    contributors,
    color: score >= 50 ? 'emerald' : 'green',
    icon: 'tool',
  };
}

// ============================================================================
// Sub-components
// ============================================================================

function DimensionBar({ dimension }: { dimension: PressureDimension }) {
  const colorClasses = {
    red: 'bg-red-500',
    amber: 'bg-amber-500',
    yellow: 'bg-yellow-500',
    purple: 'bg-purple-500',
    indigo: 'bg-indigo-500',
    blue: 'bg-blue-500',
    cyan: 'bg-cyan-500',
    emerald: 'bg-emerald-500',
    green: 'bg-green-500',
  };

  const levelBadgeColors = {
    low: 'bg-emerald-500/20 text-emerald-400',
    moderate: 'bg-yellow-500/20 text-yellow-400',
    high: 'bg-amber-500/20 text-amber-400',
    critical: 'bg-red-500/20 text-red-400',
  };

  return (
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4 hover:border-slate-600/50 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{dimension.label}</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${levelBadgeColors[dimension.level]}`}>
            {dimension.level}
          </span>
        </div>
        <span className="text-lg font-bold text-slate-300">{dimension.score}</span>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full ${colorClasses[dimension.color as keyof typeof colorClasses] || 'bg-slate-500'} transition-all duration-500`}
          style={{ width: `${dimension.score}%` }}
        />
      </div>

      {/* Description */}
      <p className="text-xs text-slate-500 mb-3">{dimension.description}</p>

      {/* Contributors */}
      {dimension.contributors.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Top Contributors</p>
          {dimension.contributors.map((c, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs">
              <span className="text-slate-400">{c.name}</span>
              <span className="text-slate-500">{c.reason}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OverallPressureSummary({ dimensions }: { dimensions: PressureDimension[] }) {
  const avgScore = Math.round(
    dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length
  );

  const highPressureDimensions = dimensions.filter(d => d.level === 'high' || d.level === 'critical');

  let summary = '';
  if (avgScore >= 60) {
    summary = 'High competitive pressure across multiple dimensions. Differentiation is critical.';
  } else if (avgScore >= 40) {
    summary = 'Moderate competitive pressure. Focus on strengthening weak dimensions.';
  } else if (avgScore >= 20) {
    summary = 'Manageable competitive pressure. Opportunity to build market position.';
  } else {
    summary = 'Low competitive pressure. Strong market opportunity or unique positioning.';
  }

  return (
    <div className="bg-gradient-to-r from-slate-800/50 to-slate-900/50 border border-slate-700 rounded-lg p-5 mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-white">Competitive Pressure Overview</h3>
            <span className={`px-2 py-1 rounded text-sm font-bold ${
              avgScore >= 60 ? 'bg-red-500/20 text-red-400' :
              avgScore >= 40 ? 'bg-amber-500/20 text-amber-400' :
              avgScore >= 20 ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-emerald-500/20 text-emerald-400'
            }`}>
              {avgScore}/100
            </span>
          </div>
          <p className="text-sm text-slate-400">{summary}</p>
          {highPressureDimensions.length > 0 && (
            <p className="text-xs text-slate-500 mt-2">
              High pressure areas: {highPressureDimensions.map(d => d.label).join(', ')}
            </p>
          )}
        </div>

        {/* Mini radar/chart representation */}
        <div className="flex-shrink-0 w-32 h-32 relative">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            {/* Background pentagon */}
            <polygon
              points="50,10 90,40 75,85 25,85 10,40"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="text-slate-700"
            />
            <polygon
              points="50,25 75,45 65,75 35,75 25,45"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="text-slate-700/50"
            />
            {/* Data polygon - simplified visualization */}
            <polygon
              points={`
                50,${50 - (dimensions[0]?.score || 0) * 0.4}
                ${50 + (dimensions[1]?.score || 0) * 0.4},${50 - (dimensions[1]?.score || 0) * 0.1}
                ${50 + (dimensions[2]?.score || 0) * 0.25},${50 + (dimensions[2]?.score || 0) * 0.35}
                ${50 - (dimensions[3]?.score || 0) * 0.25},${50 + (dimensions[3]?.score || 0) * 0.35}
                ${50 - (dimensions[4]?.score || 0) * 0.4},${50 - (dimensions[4]?.score || 0) * 0.1}
              `}
              fill="currentColor"
              fillOpacity="0.3"
              stroke="currentColor"
              strokeWidth="2"
              className="text-purple-500"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CompetitivePressureMatrix({ data }: Props) {
  const dimensions = useMemo(() => {
    const sc = data.scoredCompetitors;
    if (!sc) return [];

    const primary = sc.primary || [];
    const contextual = sc.contextual || [];
    const alternatives = sc.alternatives || [];

    return [
      calculateRevenueDisplacement(primary, contextual),
      calculateMarginPressure(primary, contextual),
      calculateBrandGravity(primary, contextual),
      calculateGeographicSaturation(primary, contextual, data.decomposition),
      calculateServiceOverlap(primary, alternatives),
    ];
  }, [data]);

  if (dimensions.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <p>No competitive pressure data available.</p>
      </div>
    );
  }

  return (
    <div>
      <OverallPressureSummary dimensions={dimensions} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {dimensions.map(dimension => (
          <DimensionBar key={dimension.id} dimension={dimension} />
        ))}
      </div>
    </div>
  );
}
