// lib/insights/hooks/useCompetitionContext.ts
// Hook to load competition context for insights and strategic integration
//
// Used by:
// - Strategic Map (positioning insights)
// - QBR Story (competition chapter)
// - Insights Engine (gap detection)

import { useState, useEffect, useCallback } from 'react';
import type { ScoredCompetitor, CompetitionRun, CompetitorRole } from '@/lib/competition/types';

// ============================================================================
// Types
// ============================================================================

export interface CompetitionContext {
  // Latest run data
  latestRun: CompetitionRun | null;
  runDate: string | null;

  // Competitors by role
  core: ScoredCompetitor[];
  secondary: ScoredCompetitor[];
  alternative: ScoredCompetitor[];

  // Summary stats
  totalDiscovered: number;
  coreCount: number;
  secondaryCount: number;
  alternativeCount: number;
  humanProvidedCount: number;

  // Health flags
  hasMissingCoreCompetitors: boolean;
  hasLowConfidence: boolean;
  dataConfidence: number;

  // Threat analysis
  highThreatCount: number;
  topThreat: ScoredCompetitor | null;

  // Positioning summary
  avgOfferSimilarity: number;
  avgAudienceSimilarity: number;
  isCrowdedMarket: boolean;
}

export interface CompetitionDelta {
  type: 'new' | 'removed' | 'role_change' | 'threat_change';
  competitorId: string;
  competitorName: string;
  details: string;
  previousValue?: string | number;
  newValue?: string | number;
}

export interface UseCompetitionContextResult {
  context: CompetitionContext | null;
  deltas: CompetitionDelta[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// ============================================================================
// Default empty context
// ============================================================================

const EMPTY_CONTEXT: CompetitionContext = {
  latestRun: null,
  runDate: null,
  core: [],
  secondary: [],
  alternative: [],
  totalDiscovered: 0,
  coreCount: 0,
  secondaryCount: 0,
  alternativeCount: 0,
  humanProvidedCount: 0,
  hasMissingCoreCompetitors: true,
  hasLowConfidence: true,
  dataConfidence: 0,
  highThreatCount: 0,
  topThreat: null,
  avgOfferSimilarity: 0,
  avgAudienceSimilarity: 0,
  isCrowdedMarket: false,
};

// ============================================================================
// Hook
// ============================================================================

export function useCompetitionContext(companyId: string): UseCompetitionContextResult {
  const [context, setContext] = useState<CompetitionContext | null>(null);
  const [deltas, setDeltas] = useState<CompetitionDelta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContext = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/os/companies/${companyId}/competition`);

      if (!response.ok) {
        if (response.status === 404) {
          // No competition data yet - return empty context
          setContext(EMPTY_CONTEXT);
          setDeltas([]);
          return;
        }
        throw new Error(`Failed to fetch competition context: ${response.status}`);
      }

      const data = await response.json();
      const run = data.run as CompetitionRun | null;
      const competitors = run?.competitors || [];

      // Group by role
      const core = competitors.filter((c: ScoredCompetitor) => c.role === 'core');
      const secondary = competitors.filter((c: ScoredCompetitor) => c.role === 'secondary');
      const alternative = competitors.filter((c: ScoredCompetitor) => c.role === 'alternative');

      // Calculate stats
      const humanProvidedCount = competitors.filter(
        (c: ScoredCompetitor) => c.provenance?.humanOverride || c.provenance?.discoveredFrom?.includes('human_provided')
      ).length;

      const highThreatCompetitors = competitors.filter(
        (c: ScoredCompetitor) => (c.threatLevel ?? 0) >= 60
      );

      const topThreat = highThreatCompetitors.length > 0
        ? highThreatCompetitors.sort((a: ScoredCompetitor, b: ScoredCompetitor) => (b.threatLevel ?? 0) - (a.threatLevel ?? 0))[0]
        : null;

      // Calculate averages
      const avgOfferSimilarity = competitors.length > 0
        ? Math.round(competitors.reduce((sum: number, c: ScoredCompetitor) => sum + c.offerSimilarity, 0) / competitors.length)
        : 0;

      const avgAudienceSimilarity = competitors.length > 0
        ? Math.round(competitors.reduce((sum: number, c: ScoredCompetitor) => sum + c.audienceSimilarity, 0) / competitors.length)
        : 0;

      // Determine market crowdedness
      const isCrowdedMarket = core.length >= 3 && avgOfferSimilarity >= 70;

      const newContext: CompetitionContext = {
        latestRun: run,
        runDate: run?.completedAt || run?.startedAt || null,
        core,
        secondary,
        alternative,
        totalDiscovered: competitors.length,
        coreCount: core.length,
        secondaryCount: secondary.length,
        alternativeCount: alternative.length,
        humanProvidedCount,
        hasMissingCoreCompetitors: core.length === 0,
        hasLowConfidence: (run?.dataConfidenceScore ?? 0) < 50,
        dataConfidence: run?.dataConfidenceScore ?? 0,
        highThreatCount: highThreatCompetitors.length,
        topThreat,
        avgOfferSimilarity,
        avgAudienceSimilarity,
        isCrowdedMarket,
      };

      setContext(newContext);

      // TODO: Calculate deltas from previous run when we have run history
      setDeltas([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load competition context');
      setContext(EMPTY_CONTEXT);
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  return {
    context,
    deltas,
    isLoading,
    error,
    refresh: fetchContext,
  };
}

// ============================================================================
// Server-side helper
// ============================================================================

export async function getCompetitionContext(companyId: string): Promise<CompetitionContext> {
  // This would be used in server components / API routes
  // For now, return empty context - implement with actual DB/API call
  return EMPTY_CONTEXT;
}

// ============================================================================
// Insight generation helpers
// ============================================================================

export function generateCompetitionInsights(context: CompetitionContext): string[] {
  const insights: string[] = [];

  // Missing core competitors
  if (context.hasMissingCoreCompetitors) {
    insights.push(
      'Missing core competitors — Strategic Map accuracy reduced. Run Competition Discovery to identify your main competitors.'
    );
  }

  // Low confidence
  if (context.hasLowConfidence && context.totalDiscovered > 0) {
    insights.push(
      `Competition data confidence is low (${context.dataConfidence}%). Consider adding more context (ICP, offers, positioning) to improve accuracy.`
    );
  }

  // Crowded market
  if (context.isCrowdedMarket) {
    insights.push(
      `Crowded market detected: ${context.coreCount} core competitors with ${context.avgOfferSimilarity}% average offer similarity. Differentiation is critical.`
    );
  }

  // High threat competitors
  if (context.highThreatCount > 0 && context.topThreat) {
    insights.push(
      `${context.highThreatCount} high-threat competitor${context.highThreatCount > 1 ? 's' : ''} identified. Top threat: ${context.topThreat.competitorName} (threat level: ${context.topThreat.threatLevel}).`
    );
  }

  // Human-provided competitors
  if (context.humanProvidedCount > 0) {
    insights.push(
      `${context.humanProvidedCount} competitor${context.humanProvidedCount > 1 ? 's were' : ' was'} manually added, improving positioning insights accuracy.`
    );
  }

  return insights;
}

// ============================================================================
// QBR Story context builder
// ============================================================================

export interface QbrCompetitionStoryContext {
  core: Array<{
    name: string;
    domain: string | null;
    threatLevel: number | null;
    offerSimilarity: number;
  }>;
  secondary: Array<{
    name: string;
    domain: string | null;
  }>;
  alternative: Array<{
    name: string;
    domain: string | null;
  }>;
  discoveredCount: number;
  topThreats: string[];
  marketCrowdedness: 'crowded' | 'competitive' | 'defensible';
  keyInsight: string;
}

export function buildQbrCompetitionContext(context: CompetitionContext): QbrCompetitionStoryContext {
  // Determine market crowdedness
  let marketCrowdedness: 'crowded' | 'competitive' | 'defensible' = 'competitive';
  if (context.isCrowdedMarket) {
    marketCrowdedness = 'crowded';
  } else if (context.coreCount <= 2 && context.avgOfferSimilarity < 50) {
    marketCrowdedness = 'defensible';
  }

  // Build key insight
  let keyInsight = '';
  if (context.hasMissingCoreCompetitors) {
    keyInsight = 'No core competitors identified yet. Run Competition Discovery to improve strategic accuracy.';
  } else if (marketCrowdedness === 'crowded') {
    keyInsight = `Market is crowded with ${context.coreCount} core competitors. Focus on differentiation and unique positioning.`;
  } else if (marketCrowdedness === 'defensible') {
    keyInsight = `Market position is defensible with limited direct competition. Focus on market expansion.`;
  } else {
    keyInsight = `Moderate competition with ${context.coreCount} core competitors. Balance differentiation with growth.`;
  }

  return {
    core: context.core.map(c => ({
      name: c.competitorName,
      domain: c.competitorDomain,
      threatLevel: c.threatLevel,
      offerSimilarity: c.offerSimilarity,
    })),
    secondary: context.secondary.map(c => ({
      name: c.competitorName,
      domain: c.competitorDomain,
    })),
    alternative: context.alternative.map(c => ({
      name: c.competitorName,
      domain: c.competitorDomain,
    })),
    discoveredCount: context.totalDiscovered,
    topThreats: context.core
      .filter(c => (c.threatLevel ?? 0) >= 60)
      .sort((a, b) => (b.threatLevel ?? 0) - (a.threatLevel ?? 0))
      .slice(0, 3)
      .map(c => c.competitorName),
    marketCrowdedness,
    keyInsight,
  };
}
