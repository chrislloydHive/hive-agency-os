// lib/os/insights/insightPatterns.ts
// Pattern detection rules for the Insight Engine
// Each pattern defines conditions that trigger specific insight types

import type {
  Insight,
  InsightType,
  InsightTheme,
  InsightSeverity,
  InsightAction,
  PatternMatch,
  InsightEngineConfig,
} from './insightTypes';
import { DEFAULT_ENGINE_CONFIG, type ScoreHistory } from './insightTypes';
import type { ContextHealthData } from './insightExtractors';

// ============================================================================
// Pattern Definitions
// ============================================================================

export interface PatternDefinition {
  id: string;
  name: string;
  type: InsightType;
  description: string;
  /** Check if pattern matches given data */
  check: (context: PatternContext) => PatternMatch | null;
}

export interface PatternContext {
  companyId: string;
  currentSnapshot: SnapshotData | null;
  previousSnapshot: SnapshotData | null;
  scoreHistory: ScoreHistory[];
  findings: FindingData[];
  /** Context health from the Context Graph */
  contextHealth: ContextHealthData | null;
  config: InsightEngineConfig;
  now: Date;
}

export interface SnapshotData {
  overallScore: number | null;
  dimensions: Record<string, number | null>;
  focusAreas: string[];
  lastUpdated: string;
}

export interface FindingData {
  id: string;
  labSlug: string;
  severity: string;
  category: string;
  description: string;
  createdAt: string;
}

// ============================================================================
// Score Regression Pattern
// ============================================================================

export const scoreRegressionPattern: PatternDefinition = {
  id: 'score-regression',
  name: 'Score Regression',
  type: 'score_regression',
  description: 'Detects when overall or dimension scores drop significantly',
  check: (context: PatternContext): PatternMatch | null => {
    const { currentSnapshot, previousSnapshot, config } = context;

    if (!currentSnapshot?.overallScore || !previousSnapshot?.overallScore) {
      return null;
    }

    const change = currentSnapshot.overallScore - previousSnapshot.overallScore;

    if (change < -config.scoreChangeThreshold) {
      return {
        patternId: 'score-regression',
        patternName: 'Score Regression',
        confidence: Math.min(90, 60 + Math.abs(change)),
        matchedData: [
          { metric: 'overallScore', current: currentSnapshot.overallScore, previous: previousSnapshot.overallScore },
        ],
        suggestedInsight: {
          type: 'score_regression',
          theme: 'overall',
          severity: change < -20 ? 'critical' : 'warning',
          title: `Overall score dropped ${Math.abs(change).toFixed(0)} points`,
          message: `Your overall health score decreased from ${previousSnapshot.overallScore} to ${currentSnapshot.overallScore}. This may indicate emerging issues that need attention.`,
          timeframe: change < -20 ? 'immediate' : 'this_week',
        },
      };
    }

    // Check individual dimensions
    for (const [dim, current] of Object.entries(currentSnapshot.dimensions)) {
      const previous = previousSnapshot.dimensions[dim];
      if (current === null || previous === null) continue;

      const dimChange = current - previous;
      if (dimChange < -config.scoreChangeThreshold) {
        return {
          patternId: 'score-regression',
          patternName: 'Dimension Regression',
          confidence: Math.min(85, 55 + Math.abs(dimChange)),
          matchedData: [
            { dimension: dim, current, previous },
          ],
          suggestedInsight: {
            type: 'score_regression',
            theme: mapDimensionToTheme(dim),
            severity: dimChange < -15 ? 'warning' : 'info',
            title: `${formatDimension(dim)} score dropped ${Math.abs(dimChange).toFixed(0)} points`,
            message: `Your ${formatDimension(dim).toLowerCase()} score decreased from ${previous} to ${current}. Consider reviewing recent changes in this area.`,
            timeframe: 'this_week',
          },
        };
      }
    }

    return null;
  },
};

// ============================================================================
// Score Improvement Pattern
// ============================================================================

export const scoreImprovementPattern: PatternDefinition = {
  id: 'score-improvement',
  name: 'Score Improvement',
  type: 'score_improvement',
  description: 'Celebrates significant score improvements',
  check: (context: PatternContext): PatternMatch | null => {
    const { currentSnapshot, previousSnapshot, config } = context;

    if (!currentSnapshot?.overallScore || !previousSnapshot?.overallScore) {
      return null;
    }

    const change = currentSnapshot.overallScore - previousSnapshot.overallScore;

    if (change >= config.scoreChangeThreshold) {
      return {
        patternId: 'score-improvement',
        patternName: 'Score Improvement',
        confidence: Math.min(95, 70 + change),
        matchedData: [
          { metric: 'overallScore', current: currentSnapshot.overallScore, previous: previousSnapshot.overallScore },
        ],
        suggestedInsight: {
          type: 'score_improvement',
          theme: 'overall',
          severity: 'positive',
          title: `Overall score improved ${change.toFixed(0)} points`,
          message: `Great progress! Your overall health score increased from ${previousSnapshot.overallScore} to ${currentSnapshot.overallScore}. Keep up the momentum.`,
          timeframe: 'this_week',
        },
      };
    }

    return null;
  },
};

// ============================================================================
// Stale Data Pattern
// ============================================================================

export const staleDataPattern: PatternDefinition = {
  id: 'stale-data',
  name: 'Stale Data',
  type: 'stale_data',
  description: 'Detects when diagnostics haven\'t been run recently',
  check: (context: PatternContext): PatternMatch | null => {
    const { currentSnapshot, config, now } = context;

    if (!currentSnapshot?.lastUpdated) {
      return {
        patternId: 'stale-data',
        patternName: 'No Recent Data',
        confidence: 90,
        matchedData: [],
        suggestedInsight: {
          type: 'stale_data',
          theme: 'overall',
          severity: 'warning',
          title: 'No recent diagnostic data',
          message: 'Run a diagnostic to establish your current baseline and get personalized recommendations.',
          timeframe: 'this_week',
        },
      };
    }

    const lastUpdate = new Date(currentSnapshot.lastUpdated);
    const daysSinceUpdate = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceUpdate >= config.staleDaysThreshold) {
      return {
        patternId: 'stale-data',
        patternName: 'Stale Data',
        confidence: 85,
        matchedData: [
          { daysSinceUpdate, lastUpdated: currentSnapshot.lastUpdated },
        ],
        suggestedInsight: {
          type: 'stale_data',
          theme: 'overall',
          severity: 'info',
          title: `Data is ${daysSinceUpdate} days old`,
          message: `Your last diagnostic was ${daysSinceUpdate} days ago. Consider running a fresh scan to get updated insights.`,
          timeframe: 'this_week',
        },
      };
    }

    return null;
  },
};

// ============================================================================
// Context Health Pattern
// ============================================================================

export const contextHealthPattern: PatternDefinition = {
  id: 'context-health',
  name: 'Context Health',
  type: 'stale_data',
  description: 'Detects when Context Graph health is low',
  check: (context: PatternContext): PatternMatch | null => {
    const { contextHealth, companyId } = context;

    if (!contextHealth) return null;

    const healthScore = contextHealth.overallScore;

    // Critical: Very low health score
    if (healthScore < 40) {
      return {
        patternId: 'context-health',
        patternName: 'Low Context Health',
        confidence: 90,
        matchedData: [
          { healthScore, staleCount: contextHealth.staleFieldCount, missingCount: contextHealth.missingCriticalCount },
        ],
        suggestedInsight: {
          type: 'stale_data',
          theme: 'overall',
          severity: 'critical',
          title: 'Context health needs attention',
          message: `Your company context has a health score of ${healthScore}%. Many fields are stale or missing, which affects AI recommendations and report accuracy.`,
          timeframe: 'immediate',
          recommendedActions: [{
            title: 'Review Context',
            description: 'Visit the Brain Context page to update stale fields',
            effort: 'moderate',
            linkPath: `/c/${companyId}/brain/context`,
          }],
        },
      };
    }

    // Warning: Moderate health issues
    if (healthScore < 60) {
      return {
        patternId: 'context-health',
        patternName: 'Context Needs Update',
        confidence: 75,
        matchedData: [
          { healthScore, staleCount: contextHealth.staleFieldCount, missingCount: contextHealth.missingCriticalCount },
        ],
        suggestedInsight: {
          type: 'stale_data',
          theme: 'overall',
          severity: 'warning',
          title: 'Context data is getting stale',
          message: `Context health is ${healthScore}%. ${contextHealth.staleFieldCount || 0} fields need refreshing for better AI accuracy.`,
          timeframe: 'this_week',
          recommendedActions: [{
            title: 'Update Context',
            description: 'Refresh stale fields in the Context Graph',
            effort: 'quick',
            linkPath: `/c/${companyId}/brain/context`,
          }],
        },
      };
    }

    return null;
  },
};

// ============================================================================
// Emerging Risk Pattern
// ============================================================================

export const emergingRiskPattern: PatternDefinition = {
  id: 'emerging-risk',
  name: 'Emerging Risk',
  type: 'emerging_risk',
  description: 'Detects patterns that suggest future problems',
  check: (context: PatternContext): PatternMatch | null => {
    const { scoreHistory, currentSnapshot } = context;

    if (scoreHistory.length < 3) return null;

    // Check for consistent downward trend
    const recentScores = scoreHistory.slice(-3).map(h => h.overallScore).filter((s): s is number => s !== null);
    if (recentScores.length < 3) return null;

    const isDowntrend = recentScores[0] > recentScores[1] && recentScores[1] > recentScores[2];
    const totalDecline = recentScores[0] - recentScores[2];

    if (isDowntrend && totalDecline > 5) {
      return {
        patternId: 'emerging-risk',
        patternName: 'Consistent Decline',
        confidence: 70,
        matchedData: recentScores.map((score, i) => ({ period: i, score })),
        suggestedInsight: {
          type: 'emerging_risk',
          theme: 'overall',
          severity: totalDecline > 15 ? 'warning' : 'info',
          title: 'Declining score trend detected',
          message: `Your scores have declined across the last 3 periods, dropping ${totalDecline.toFixed(0)} points total. Address underlying issues before they compound.`,
          timeframe: 'this_week',
        },
      };
    }

    // Check for high-severity finding accumulation
    const { findings } = context;
    const criticalFindings = findings.filter(f => f.severity === 'critical' || f.severity === 'high');
    if (criticalFindings.length >= 5) {
      return {
        patternId: 'emerging-risk',
        patternName: 'Finding Accumulation',
        confidence: 75,
        matchedData: criticalFindings.slice(0, 5),
        suggestedInsight: {
          type: 'emerging_risk',
          theme: 'overall',
          severity: 'warning',
          title: `${criticalFindings.length} high-priority issues detected`,
          message: 'Multiple critical or high-severity findings have accumulated. Prioritize addressing these to prevent further score decline.',
          timeframe: 'immediate',
        },
      };
    }

    return null;
  },
};

// ============================================================================
// Opportunity Pattern
// ============================================================================

export const opportunityPattern: PatternDefinition = {
  id: 'opportunity',
  name: 'Opportunity Detection',
  type: 'opportunity',
  description: 'Identifies quick wins and improvement opportunities',
  check: (context: PatternContext): PatternMatch | null => {
    const { findings, currentSnapshot } = context;

    // Look for low-effort fixes among findings
    const quickWinCandidates = findings.filter(f =>
      (f.severity === 'medium' || f.severity === 'low') &&
      (f.category === 'content' || f.category === 'seo' || f.category === 'local')
    );

    if (quickWinCandidates.length >= 3) {
      return {
        patternId: 'opportunity',
        patternName: 'Quick Win Cluster',
        confidence: 65,
        matchedData: quickWinCandidates.slice(0, 5),
        suggestedInsight: {
          type: 'opportunity',
          theme: mapCategoryToTheme(quickWinCandidates[0].category),
          severity: 'positive',
          title: `${quickWinCandidates.length} quick wins available`,
          message: `You have ${quickWinCandidates.length} relatively easy fixes that could boost your scores. These are good candidates for a focused improvement sprint.`,
          timeframe: 'this_week',
        },
      };
    }

    // Check for dimension near milestone
    if (currentSnapshot) {
      for (const [dim, score] of Object.entries(currentSnapshot.dimensions)) {
        if (score === null) continue;

        // Close to 70 (good threshold) or 90 (excellent threshold)
        if (score >= 65 && score < 70) {
          return {
            patternId: 'opportunity',
            patternName: 'Near Milestone',
            confidence: 80,
            matchedData: [{ dimension: dim, score, target: 70 }],
            suggestedInsight: {
              type: 'opportunity',
              theme: mapDimensionToTheme(dim),
              severity: 'positive',
              title: `${formatDimension(dim)} is close to "Good" status`,
              message: `Your ${formatDimension(dim).toLowerCase()} score is ${score}, just ${70 - score} points from reaching "Good" status. A small push could cross this milestone.`,
              timeframe: 'this_week',
            },
          };
        }

        if (score >= 85 && score < 90) {
          return {
            patternId: 'opportunity',
            patternName: 'Near Excellent',
            confidence: 80,
            matchedData: [{ dimension: dim, score, target: 90 }],
            suggestedInsight: {
              type: 'opportunity',
              theme: mapDimensionToTheme(dim),
              severity: 'positive',
              title: `${formatDimension(dim)} is close to "Excellent" status`,
              message: `Your ${formatDimension(dim).toLowerCase()} score is ${score}, just ${90 - score} points from "Excellent" status. You're almost there!`,
              timeframe: 'this_month',
            },
          };
        }
      }
    }

    return null;
  },
};

// ============================================================================
// Milestone Pattern
// ============================================================================

export const milestonePattern: PatternDefinition = {
  id: 'milestone',
  name: 'Milestone Achievement',
  type: 'milestone',
  description: 'Celebrates when important thresholds are crossed',
  check: (context: PatternContext): PatternMatch | null => {
    const { currentSnapshot, previousSnapshot } = context;

    if (!currentSnapshot || !previousSnapshot) return null;

    // Check overall score milestones
    const thresholds = [50, 70, 80, 90];
    const current = currentSnapshot.overallScore;
    const previous = previousSnapshot.overallScore;

    if (current !== null && previous !== null) {
      for (const threshold of thresholds) {
        if (previous < threshold && current >= threshold) {
          const label = threshold === 50 ? 'baseline' :
                       threshold === 70 ? '"Good"' :
                       threshold === 80 ? '"Strong"' : '"Excellent"';
          return {
            patternId: 'milestone',
            patternName: 'Score Milestone',
            confidence: 95,
            matchedData: [{ threshold, previous, current }],
            suggestedInsight: {
              type: 'milestone',
              theme: 'overall',
              severity: 'positive',
              title: `Reached ${label} score milestone!`,
              message: `Congratulations! Your overall score crossed ${threshold} (now ${current}). This represents significant progress in your digital health.`,
              timeframe: 'this_week',
            },
          };
        }
      }
    }

    return null;
  },
};

// ============================================================================
// All Patterns Export
// ============================================================================

export const ALL_PATTERNS: PatternDefinition[] = [
  scoreRegressionPattern,
  scoreImprovementPattern,
  staleDataPattern,
  contextHealthPattern,  // Context Graph health monitoring
  emergingRiskPattern,
  opportunityPattern,
  milestonePattern,
];

// ============================================================================
// Helper Functions
// ============================================================================

function mapDimensionToTheme(dimension: string): InsightTheme {
  const mapping: Record<string, InsightTheme> = {
    'performance': 'performance',
    'visibility': 'visibility',
    'brand': 'brand',
    'content': 'content',
    'local': 'local',
    'social': 'social',
    'seo': 'visibility',
    'technical': 'performance',
    'engagement': 'social',
  };
  return mapping[dimension.toLowerCase()] || 'overall';
}

function mapCategoryToTheme(category: string): InsightTheme {
  const mapping: Record<string, InsightTheme> = {
    'technical': 'performance',
    'seo': 'visibility',
    'content': 'content',
    'brand': 'brand',
    'local': 'local',
    'social': 'social',
    'website': 'performance',
  };
  return mapping[category.toLowerCase()] || 'overall';
}

function formatDimension(dimension: string): string {
  return dimension
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ============================================================================
// Insight Builder from Pattern Match
// ============================================================================

export function buildInsightFromMatch(
  match: PatternMatch,
  companyId: string,
  relatedLabs?: string[]
): Insight {
  const now = new Date().toISOString();

  const defaultActions: InsightAction[] = [];

  // Add default action based on type
  switch (match.suggestedInsight.type) {
    case 'score_regression':
    case 'emerging_risk':
      defaultActions.push({
        title: 'Review findings',
        description: 'Check your latest findings to identify the root cause',
        effort: 'quick',
        linkPath: `/c/${companyId}/findings`,
      });
      break;
    case 'stale_data':
      defaultActions.push({
        title: 'Run a diagnostic',
        description: 'Get fresh data with an updated scan',
        effort: 'moderate',
        linkPath: `/c/${companyId}/blueprint`,
      });
      break;
    case 'opportunity':
      defaultActions.push({
        title: 'View quick wins',
        description: 'See all available quick wins in your plan',
        effort: 'quick',
        linkPath: `/c/${companyId}/plan`,
      });
      break;
    case 'milestone':
    case 'score_improvement':
      defaultActions.push({
        title: 'Share your progress',
        description: 'Generate a report to share this achievement',
        effort: 'quick',
        linkPath: `/c/${companyId}/reports`,
      });
      break;
  }

  return {
    id: `insight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: match.suggestedInsight.type || 'trend',
    theme: match.suggestedInsight.theme || 'overall',
    severity: match.suggestedInsight.severity || 'info',
    title: match.suggestedInsight.title || match.patternName,
    message: match.suggestedInsight.message || '',
    evidence: match.matchedData.map(data => {
      // Handle unknown type with type guard
      const dataObj = data && typeof data === 'object' ? data as Record<string, unknown> : {};
      const keys = Object.keys(dataObj);
      const values = Object.values(dataObj);
      return {
        type: 'metric' as const,
        label: keys[0] || 'Value',
        currentValue: (values[0] as string | number) ?? 'N/A',
      };
    }),
    recommendedActions: defaultActions,
    generatedAt: now,
    timeframe: match.suggestedInsight.timeframe || 'this_week',
    confidence: match.confidence,
    relatedLabs,
    metadata: {
      patternId: match.patternId,
      patternName: match.patternName,
    },
  };
}
