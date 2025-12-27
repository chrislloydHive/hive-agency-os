// hooks/useOutcomeInsights.ts
// Hook for fetching and filtering RFP outcome insights

import { useState, useEffect, useMemo } from 'react';
import type { OutcomeInsight, OutcomeAnalysisResult } from '@/lib/os/rfp/analyzeOutcomes';
import type { BidReadiness } from '@/lib/os/rfp/computeBidReadiness';
import type { OutcomeTimeRange } from '@/lib/airtable/rfp';

// ============================================================================
// Types
// ============================================================================

export interface OutcomeInsightsData {
  analysis: OutcomeAnalysisResult;
  topInsights: OutcomeInsight[];
  isPredictive: boolean;
  summary: string;
  insightsByCategory: {
    score_threshold: OutcomeInsight[];
    recommendation: OutcomeInsight[];
    acknowledgement: OutcomeInsight[];
    risk: OutcomeInsight[];
  };
}

export interface FirmOutcomeInsightsData extends OutcomeInsightsData {
  meta: {
    sampleSize: number;
    timeRange: OutcomeTimeRange;
    minConfidence: string;
    totalRfps: number;
  };
}

export interface UseOutcomeInsightsResult {
  data: OutcomeInsightsData | null;
  loading: boolean;
  error: string | null;
}

export interface UseFirmOutcomeInsightsResult {
  data: FirmOutcomeInsightsData | null;
  loading: boolean;
  error: string | null;
}

export interface RelevantInsight {
  insight: OutcomeInsight;
  relevanceReason: string;
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Fetch outcome insights for a company
 */
export function useOutcomeInsights(companyId: string): UseOutcomeInsightsResult {
  const [data, setData] = useState<OutcomeInsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchInsights() {
      try {
        const response = await fetch(
          `/api/os/companies/${companyId}/rfps/outcomes`
        );
        if (!response.ok) {
          throw new Error('Failed to fetch insights');
        }
        const result = await response.json();
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchInsights();

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return { data, loading, error };
}

// ============================================================================
// Firm-Scoped Hook (Institutional Learning)
// ============================================================================

/**
 * Minimum sample size required to show insights in callouts
 */
export const FIRM_INSIGHTS_MIN_SAMPLE = 10;

/**
 * Fetch firm-wide outcome insights (institutional learning)
 */
export function useFirmOutcomeInsights(options?: {
  timeRange?: OutcomeTimeRange;
  minConfidence?: 'low' | 'medium' | 'high';
  enabled?: boolean;
}): UseFirmOutcomeInsightsResult {
  const { timeRange = '365d', minConfidence = 'medium', enabled = true } = options ?? {};
  const [data, setData] = useState<FirmOutcomeInsightsData | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchInsights() {
      try {
        const response = await fetch(
          `/api/os/rfp/outcomes/analysis?timeRange=${timeRange}&minConfidence=${minConfidence}`
        );
        if (!response.ok) {
          throw new Error('Failed to fetch firm insights');
        }
        const result = await response.json();
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchInsights();

    return () => {
      cancelled = true;
    };
  }, [timeRange, minConfidence, enabled]);

  return { data, loading, error };
}

/**
 * Check if firm insights are valid and meet minimum requirements for display
 */
export function hasFirmInsightsForDisplay(data: FirmOutcomeInsightsData | null): boolean {
  if (!data) return false;
  if (!data.analysis.isStatisticallyMeaningful) return false;
  if (data.meta.sampleSize < FIRM_INSIGHTS_MIN_SAMPLE) return false;
  // Must have at least one medium+ confidence insight
  return data.topInsights.some(i => i.confidence !== 'low');
}

// ============================================================================
// Filtering Helpers
// ============================================================================

/**
 * Get insights relevant to the current bid readiness state
 */
export function getRelevantInsights(
  insights: OutcomeInsightsData | null,
  readiness: BidReadiness,
  maxInsights: number = 2
): RelevantInsight[] {
  if (!insights || !insights.analysis.isStatisticallyMeaningful) {
    return [];
  }

  const relevant: RelevantInsight[] = [];
  const { insightsByCategory } = insights;

  // Check for critical risks in current state
  const hasCriticalRisks = readiness.topRisks.some(r => r.severity === 'critical');
  if (hasCriticalRisks) {
    const criticalInsight = insightsByCategory.risk.find(
      i => i.signal === 'submitted with critical risks' && i.confidence !== 'low'
    );
    if (criticalInsight) {
      relevant.push({
        insight: criticalInsight,
        relevanceReason: 'You have critical risks',
      });
    }
  }

  // Check for acknowledged risks scenario
  const hasAcknowledgedRisks = readiness.topRisks.length > 0;
  if (hasAcknowledgedRisks && relevant.length < maxInsights) {
    const riskInsight = insightsByCategory.acknowledgement.find(
      i => i.signal === 'submitted with acknowledged risks' && i.confidence !== 'low'
    );
    if (riskInsight && Math.abs(riskInsight.winRateDelta) >= 10) {
      relevant.push({
        insight: riskInsight,
        relevanceReason: 'You have outstanding risks',
      });
    }
  }

  // Match recommendation
  const recommendationLabel = readiness.recommendation === 'go' ? 'Go'
    : readiness.recommendation === 'conditional' ? 'Conditional Go'
    : 'No-Go';

  if (relevant.length < maxInsights) {
    const recInsight = insightsByCategory.recommendation.find(
      i => i.signal === `recommendation = ${recommendationLabel}` && i.confidence !== 'low'
    );
    if (recInsight && Math.abs(recInsight.winRateDelta) >= 10) {
      relevant.push({
        insight: recInsight,
        relevanceReason: `Current recommendation: ${recommendationLabel}`,
      });
    }
  }

  // Match score threshold
  if (relevant.length < maxInsights) {
    const scoreThreshold = readiness.score >= 70 ? 70 : readiness.score >= 60 ? 60 : 50;
    const scoreInsight = insightsByCategory.score_threshold.find(
      i => i.signal === `score >= ${scoreThreshold}` && i.confidence !== 'low'
    );
    if (scoreInsight && Math.abs(scoreInsight.winRateDelta) >= 10) {
      relevant.push({
        insight: scoreInsight,
        relevanceReason: `Your score is ${readiness.score}%`,
      });
    }
  }

  return relevant.slice(0, maxInsights);
}

/**
 * Get insights relevant for submission decision
 */
export function getSubmissionInsights(
  insights: OutcomeInsightsData | null,
  recommendation: 'go' | 'conditional' | 'no_go',
  hasCriticalRisks: boolean,
  hasAcknowledgedRisks: boolean,
  maxInsights: number = 2
): RelevantInsight[] {
  if (!insights || !insights.analysis.isStatisticallyMeaningful) {
    return [];
  }

  const relevant: RelevantInsight[] = [];
  const { insightsByCategory } = insights;

  // For conditional/no_go, show risk-related insights
  if (recommendation !== 'go') {
    // Critical risks insight
    if (hasCriticalRisks) {
      const criticalInsight = insightsByCategory.risk.find(
        i => i.signal === 'submitted with critical risks' && i.confidence !== 'low'
      );
      if (criticalInsight) {
        relevant.push({
          insight: criticalInsight,
          relevanceReason: 'Historical data on critical risks',
        });
      }
    }

    // Acknowledged risks insight
    if (hasAcknowledgedRisks && relevant.length < maxInsights) {
      const ackInsight = insightsByCategory.acknowledgement.find(
        i => i.signal === 'submitted with acknowledged risks' && i.confidence !== 'low'
      );
      if (ackInsight && Math.abs(ackInsight.winRateDelta) >= 5) {
        relevant.push({
          insight: ackInsight,
          relevanceReason: 'Historical data on risk acknowledgement',
        });
      }
    }
  }

  // Recommendation insight
  if (relevant.length < maxInsights) {
    const recLabel = recommendation === 'go' ? 'Go'
      : recommendation === 'conditional' ? 'Conditional Go'
      : 'No-Go';

    const recInsight = insightsByCategory.recommendation.find(
      i => i.signal === `recommendation = ${recLabel}` && i.confidence !== 'low'
    );
    if (recInsight && Math.abs(recInsight.winRateDelta) >= 10) {
      relevant.push({
        insight: recInsight,
        relevanceReason: `Historical "${recLabel}" outcomes`,
      });
    }
  }

  return relevant.slice(0, maxInsights);
}

/**
 * Check if insights meet minimum confidence threshold
 */
export function hasValidInsights(insights: OutcomeInsightsData | null): boolean {
  if (!insights) return false;
  if (!insights.analysis.isStatisticallyMeaningful) return false;
  // Must have at least one medium+ confidence insight
  return insights.topInsights.some(i => i.confidence !== 'low');
}
