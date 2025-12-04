// lib/contextGraph/contextHealth.ts
// Context Health Score Computation
//
// Computes a numeric health score based on needs-refresh flags.
// Missing fields hurt more than stale fields.

/**
 * Needs refresh flag structure
 */
export interface NeedsRefreshFlag {
  domain: string;
  field: string;
  reason: 'missing' | 'stale' | 'low_confidence' | 'expired';
  freshness?: number;
  priority?: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Context health result
 */
export interface ContextHealthResult {
  score: number;
  status: 'healthy' | 'fair' | 'needs_attention' | 'critical';
  missingCount: number;
  staleCount: number;
  topIssues: NeedsRefreshFlag[];
}

/**
 * Compute context health score from needs-refresh flags
 *
 * Scoring logic:
 * - Start at 95 (baseline for healthy graph)
 * - Missing fields: -12 points each (capped at 60 points total)
 * - Stale fields: Variable based on freshness (0-8 points each)
 * - Low confidence: -4 points each
 * - Expired: -10 points each
 *
 * @param needsRefresh Array of fields that need refresh
 * @returns Health score (5-95)
 */
export function computeContextHealthScore(
  needsRefresh: NeedsRefreshFlag[]
): number {
  if (!needsRefresh || needsRefresh.length === 0) return 95;

  let score = 95;
  let missingPenalty = 0;
  let stalePenalty = 0;
  let otherPenalty = 0;

  needsRefresh.forEach((flag) => {
    switch (flag.reason) {
      case 'missing':
        missingPenalty += 12;
        break;
      case 'stale': {
        const freshness = flag.freshness ?? 0.3;
        stalePenalty += Math.round((1 - freshness) * 8);
        break;
      }
      case 'low_confidence':
        otherPenalty += 4;
        break;
      case 'expired':
        otherPenalty += 10;
        break;
    }
  });

  // Cap missing penalty at 60 points
  missingPenalty = Math.min(missingPenalty, 60);

  // Cap stale penalty at 30 points
  stalePenalty = Math.min(stalePenalty, 30);

  // Cap other penalty at 15 points
  otherPenalty = Math.min(otherPenalty, 15);

  score -= missingPenalty + stalePenalty + otherPenalty;

  return Math.max(5, score);
}

/**
 * Get health status label from score
 */
export function getHealthStatus(
  score: number
): 'healthy' | 'fair' | 'needs_attention' | 'critical' {
  if (score >= 75) return 'healthy';
  if (score >= 50) return 'fair';
  if (score >= 25) return 'needs_attention';
  return 'critical';
}

/**
 * Compute full context health result
 */
export function computeContextHealth(
  needsRefresh: NeedsRefreshFlag[]
): ContextHealthResult {
  const score = computeContextHealthScore(needsRefresh);
  const status = getHealthStatus(score);

  const missingCount = needsRefresh.filter((f) => f.reason === 'missing').length;
  const staleCount = needsRefresh.filter((f) => f.reason === 'stale').length;

  // Get top 5 issues, prioritizing critical/high priority and missing fields
  const topIssues = [...needsRefresh]
    .sort((a, b) => {
      // Priority order
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const reasonOrder = { missing: 0, expired: 1, stale: 2, low_confidence: 3 };

      const aPriority = priorityOrder[a.priority || 'medium'];
      const bPriority = priorityOrder[b.priority || 'medium'];

      if (aPriority !== bPriority) return aPriority - bPriority;

      const aReason = reasonOrder[a.reason];
      const bReason = reasonOrder[b.reason];

      return aReason - bReason;
    })
    .slice(0, 5);

  return {
    score,
    status,
    missingCount,
    staleCount,
    topIssues,
  };
}

/**
 * Convert NeedsRefreshReport from needsRefresh.ts to NeedsRefreshFlag[]
 *
 * The NeedsRefreshReport from needsRefresh.ts has this structure:
 * - topPriorityFields: FieldRefreshFlag[] with domain, field, freshnessScore, priority, daysSinceUpdate, reason
 */
export function convertNeedsRefreshReport(
  report: {
    overallStatus: string;
    totalStaleFields: number;
    topPriorityFields: Array<{
      domain: string;
      field: string;
      freshnessScore?: number;
      priority?: string;
      daysSinceUpdate?: number;
      reason?: string;
    }>;
  } | null
): NeedsRefreshFlag[] {
  if (!report) return [];

  return report.topPriorityFields.map((field) => {
    // Map reason - default to 'stale' if not provided or not a valid value
    let reason: NeedsRefreshFlag['reason'] = 'stale';
    if (field.reason) {
      const lowerReason = field.reason.toLowerCase();
      if (lowerReason.includes('missing')) reason = 'missing';
      else if (lowerReason.includes('expired')) reason = 'expired';
      else if (lowerReason.includes('confidence')) reason = 'low_confidence';
    }

    // Map priority
    let priority: NeedsRefreshFlag['priority'] = 'medium';
    if (field.priority) {
      const lowerPriority = field.priority.toLowerCase();
      if (lowerPriority === 'critical') priority = 'critical';
      else if (lowerPriority === 'high') priority = 'high';
      else if (lowerPriority === 'low') priority = 'low';
    } else if (field.daysSinceUpdate && field.daysSinceUpdate > 30) {
      priority = 'high';
    }

    return {
      domain: field.domain,
      field: field.field,
      reason,
      freshness: field.freshnessScore,
      priority,
    };
  });
}
