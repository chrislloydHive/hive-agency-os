'use client';

// components/os/overview/CompanyOverviewV3.tsx
// Company Overview V3 - Decision & Direction Hub
//
// NEW ARCHITECTURE (Reimagined):
// 1. Company Header with AI Snapshot
// 2. Business Need Selector (primary focus with AI recommend)
// 3. Best Path Forward (single AI recommendation)
// 4. Current Direction (compact strategy snapshot)
// 5. Key Signals (collapsed 3-bucket diagnostics)
// 6. Strategy-Aware Actions (context-dependent next steps)
//
// This replaces the diagnostics-centric dashboard with a user-intent-first hub.

import { useState, useCallback } from 'react';
import { CompanySnapshotHeader, deriveCompanyLifecycle } from './CompanySnapshotHeader';
import { BusinessNeedSelector, useBusinessNeed, DEFAULT_BUSINESS_NEEDS, type BusinessNeed } from './BusinessNeedSelector';
import { BestPathForward, deriveStrategyState, type StrategyState } from './BestPathForward';
import { CurrentDirectionCard } from './CurrentDirectionCard';
import { KeySignals, extractKeySignals } from './KeySignals';
import { StrategyAwareActions } from './StrategyAwareActions';
import type { CompanyStrategy, StrategyPlay } from '@/lib/types/strategy';
import type { CompanyStrategicSnapshot } from '@/lib/airtable/companyStrategySnapshot';
import type { RecentDiagnostic } from '@/components/os/blueprint/types';
import type { CompanyAlert } from '@/lib/os/companies/alerts';
import type { PerformancePulse } from '@/lib/os/analytics/performancePulse';
import type { CompanyScoreTrends } from '@/lib/os/diagnostics/runs';
import type { CompanyWorkSummary } from '@/lib/os/companies/workSummary';

// ============================================================================
// Types
// ============================================================================

export interface CompanyOverviewV3Props {
  companyId: string;
  companyName: string;

  // Strategy & Plays
  strategy: CompanyStrategy | null;
  plays: StrategyPlay[];

  // Supporting data
  strategySnapshot: CompanyStrategicSnapshot | null;
  recentDiagnostics: RecentDiagnostic[];
  alerts: CompanyAlert[];
  scoreTrends: CompanyScoreTrends;
  workSummary: CompanyWorkSummary;
  performancePulse: PerformancePulse | null;

  // Context completeness for AI recommendations
  contextCompleteness?: number;
  hasContextGaps?: boolean;

  // Company metadata for header
  industry?: string | null;
  stage?: string | null;

  // AI-generated snapshot (from server)
  aiSnapshot?: string | null;
}

// ============================================================================
// Component
// ============================================================================

export function CompanyOverviewV3({
  companyId,
  companyName,
  strategy,
  plays: _plays,
  strategySnapshot: _strategySnapshot,
  recentDiagnostics,
  alerts,
  scoreTrends: _scoreTrends,
  workSummary: _workSummary,
  performancePulse: _performancePulse,
  contextCompleteness = 0,
  hasContextGaps = false,
  industry,
  stage,
  aiSnapshot,
}: CompanyOverviewV3Props) {
  // Business need state (session-scoped)
  const { activeNeed, setActiveNeed } = useBusinessNeed(companyId);

  // AI recommendation state
  const [aiRecommendedNeed, setAiRecommendedNeed] = useState<BusinessNeed | null>(null);
  const [aiRecommendationReason, setAiRecommendationReason] = useState<string>('');
  const [aiRecommendationLoading, setAiRecommendationLoading] = useState(false);

  // Compute derived data
  const hasDiagnostics = recentDiagnostics.some(d => d.status === 'complete');
  const latestDiagnostic = recentDiagnostics.find(d => d.status === 'complete');
  const latestScore = latestDiagnostic?.score ?? null;

  // Derive states
  const strategyState = deriveStrategyState(strategy);
  const lifecycle = deriveCompanyLifecycle({
    hasStrategy: strategyState !== 'not_started',
    hasDiagnostics,
    latestScore,
    alertCount: alerts.length,
    criticalAlertCount: alerts.filter(a => a.severity === 'critical').length,
  });

  // Extract key signals from diagnostics
  const { strengths, weaknesses, risks } = extractKeySignals(recentDiagnostics, alerts);

  // Compute strategy completeness (simplified - could be enhanced)
  const strategyCompleteness = computeStrategyCompleteness(strategy);

  // Determine if signals should be force-expanded (critical alerts)
  const hasCriticalAlerts = alerts.some(a => a.severity === 'critical');

  // Generate diagnostic insight for BestPathForward
  const diagnosticInsight = generateDiagnosticInsight(recentDiagnostics, latestScore);

  // AI recommendation handler
  const handleRequestAiRecommendation = useCallback(async () => {
    setAiRecommendationLoading(true);
    try {
      // Simple heuristic-based recommendation based on diagnostics and strategy state
      const recommendation = deriveAiRecommendedNeed({
        strategyState,
        hasDiagnostics,
        latestScore,
        hasContextGaps,
        contextCompleteness,
        alerts,
      });

      // Simulate brief delay for UX
      await new Promise(resolve => setTimeout(resolve, 500));

      setAiRecommendedNeed(recommendation.need);
      setAiRecommendationReason(recommendation.reason);
    } finally {
      setAiRecommendationLoading(false);
    }
  }, [strategyState, hasDiagnostics, latestScore, hasContextGaps, contextCompleteness, alerts]);

  return (
    <div className="space-y-6">
      {/* ================================================================== */}
      {/* 1. COMPANY HEADER - AI snapshot & lifecycle badge */}
      {/* ================================================================== */}
      <section id="company-header">
        <CompanySnapshotHeader
          companyId={companyId}
          companyName={companyName}
          aiSnapshot={aiSnapshot}
          lifecycle={lifecycle}
          industry={industry}
          stage={stage}
        />
      </section>

      {/* ================================================================== */}
      {/* 2. BUSINESS NEED SELECTOR - "What are you trying to accomplish?" */}
      {/* ================================================================== */}
      <section id="business-need">
        <BusinessNeedSelector
          companyId={companyId}
          activeNeed={activeNeed}
          onSelectNeed={setActiveNeed}
          compact={activeNeed !== null}
          aiRecommendedNeed={aiRecommendedNeed}
          aiRecommendationReason={aiRecommendationReason}
          aiRecommendationLoading={aiRecommendationLoading}
          onRequestAiRecommendation={hasDiagnostics ? handleRequestAiRecommendation : undefined}
        />
      </section>

      {/* ================================================================== */}
      {/* 3. BEST PATH FORWARD - Single AI recommendation */}
      {/* ================================================================== */}
      <section id="best-path">
        <BestPathForward
          companyId={companyId}
          activeNeed={activeNeed}
          strategyState={strategyState}
          hasContextGaps={hasContextGaps}
          contextCompleteness={contextCompleteness}
          hasDiagnostics={hasDiagnostics}
          latestScore={latestScore}
          diagnosticInsight={diagnosticInsight}
        />
      </section>

      {/* ================================================================== */}
      {/* 4. CURRENT DIRECTION - Compact strategy snapshot */}
      {/* ================================================================== */}
      <section id="current-direction">
        <CurrentDirectionCard
          companyId={companyId}
          strategy={strategy}
          strategyState={strategyState}
          strategyCompleteness={strategyCompleteness}
        />
      </section>

      {/* ================================================================== */}
      {/* 5. KEY SIGNALS - Collapsed 3-bucket diagnostics */}
      {/* ================================================================== */}
      <section id="key-signals">
        <KeySignals
          companyId={companyId}
          strengths={strengths}
          weaknesses={weaknesses}
          risks={risks}
          forceExpanded={hasCriticalAlerts}
          latestScore={latestScore}
          hasDiagnostics={hasDiagnostics}
        />
      </section>

      {/* ================================================================== */}
      {/* 6. STRATEGY-AWARE ACTIONS - Context-dependent next steps */}
      {/* ================================================================== */}
      <section id="actions">
        <StrategyAwareActions
          companyId={companyId}
          strategyState={strategyState}
          strategy={strategy}
          activeNeed={activeNeed}
          contextCompleteness={contextCompleteness}
          hasContextGaps={hasContextGaps}
          maxActions={4}
        />
      </section>
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function computeStrategyCompleteness(strategy: CompanyStrategy | null): number {
  if (!strategy) return 0;

  let score = 0;
  let total = 0;

  // Has title
  total += 15;
  if (strategy.title) score += 15;

  // Has summary
  total += 15;
  if (strategy.summary) score += 15;

  // Has objectives
  total += 30;
  if (strategy.objectives?.length > 0) {
    score += Math.min(30, strategy.objectives.length * 10);
  }

  // Has pillars
  total += 30;
  if (strategy.pillars?.length > 0) {
    score += Math.min(30, strategy.pillars.length * 10);
  }

  // Has plays
  total += 10;
  if (strategy.plays && strategy.plays.length > 0) score += 10;

  return Math.round((score / total) * 100);
}

function generateDiagnosticInsight(
  diagnostics: RecentDiagnostic[],
  latestScore: number | null
): string | null {
  if (!latestScore) return null;

  const completedDiags = diagnostics.filter(d => d.status === 'complete' && d.score !== null);
  if (completedDiags.length === 0) return null;

  // Find lowest scoring diagnostic
  const lowestScoring = completedDiags.reduce((min, d) =>
    (d.score !== null && (min.score === null || d.score < min.score)) ? d : min
  );

  if (lowestScoring.score !== null && lowestScoring.score < 50) {
    return `${lowestScoring.toolLabel} scored ${lowestScoring.score}% and may need immediate attention.`;
  }

  // Find highest scoring for positive insight
  const highestScoring = completedDiags.reduce((max, d) =>
    (d.score !== null && (max.score === null || d.score > max.score)) ? d : max
  );

  if (highestScoring.score !== null && highestScoring.score >= 80) {
    return `${highestScoring.toolLabel} is performing well at ${highestScoring.score}%.`;
  }

  return null;
}

function deriveAiRecommendedNeed(data: {
  strategyState: StrategyState;
  hasDiagnostics: boolean;
  latestScore: number | null;
  hasContextGaps: boolean;
  contextCompleteness: number;
  alerts: CompanyAlert[];
}): { need: BusinessNeed; reason: string } {
  const { strategyState, hasDiagnostics, latestScore, hasContextGaps: _hasContextGaps, contextCompleteness: _contextCompleteness, alerts } = data;

  // If no diagnostics, suggest diagnosing
  if (!hasDiagnostics) {
    return {
      need: DEFAULT_BUSINESS_NEEDS.find(n => n.key === 'diagnose_issues')!,
      reason: 'Start with diagnostics to understand your current state.',
    };
  }

  // If critical alerts, suggest diagnosing
  if (alerts.some(a => a.severity === 'critical')) {
    return {
      need: DEFAULT_BUSINESS_NEEDS.find(n => n.key === 'diagnose_issues')!,
      reason: 'Critical issues detected that need immediate attention.',
    };
  }

  // If low score, suggest fixing fundamentals
  if (latestScore !== null && latestScore < 50) {
    return {
      need: DEFAULT_BUSINESS_NEEDS.find(n => n.key === 'diagnose_issues')!,
      reason: `Your diagnostic score of ${latestScore}% suggests foundational issues to address.`,
    };
  }

  // If no strategy, suggest preparing for growth
  if (strategyState === 'not_started') {
    return {
      need: DEFAULT_BUSINESS_NEEDS.find(n => n.key === 'prepare_growth')!,
      reason: 'Build your strategic foundation before scaling efforts.',
    };
  }

  // If good score and strategy locked, suggest growth
  if (strategyState === 'locked' && latestScore !== null && latestScore >= 70) {
    return {
      need: DEFAULT_BUSINESS_NEEDS.find(n => n.key === 'increase_leads')!,
      reason: 'With strong fundamentals in place, focus on growth.',
    };
  }

  // Default to improving conversion
  return {
    need: DEFAULT_BUSINESS_NEEDS.find(n => n.key === 'improve_conversion')!,
    reason: 'Optimize your existing efforts for better results.',
  };
}

// ============================================================================
// Re-exports for barrel imports
// ============================================================================

export { CompanySnapshotHeader, deriveCompanyLifecycle } from './CompanySnapshotHeader';
export { BusinessNeedSelector, useBusinessNeed, DEFAULT_BUSINESS_NEEDS } from './BusinessNeedSelector';
export { BestPathForward, deriveStrategyState } from './BestPathForward';
export { CurrentDirectionCard } from './CurrentDirectionCard';
export { KeySignals, extractKeySignals } from './KeySignals';
export { StrategyAwareActions } from './StrategyAwareActions';

// Legacy exports for backwards compatibility
export { StrategySnapshotCard } from './StrategySnapshotCard';
export { ActivePlaysList } from './ActivePlaysList';
export { AINextActionCard } from './AINextActionCard';
export { SupportingSignals } from './SupportingSignals';
