// lib/os/diagnostics/seoLabTypes.ts
// SEO Lab Diagnostic Output Types
//
// These types define the structure of SEO Lab diagnostic results that flow through:
// - Diagnostic runs
// - UI reports
// - Work item creation
// - Brain / Blueprint integration

// ============================================================================
// Subscores
// ============================================================================

/**
 * Status for SEO subscores
 * - strong/ok/weak/critical: for evaluated dimensions
 * - not_evaluated: for dimensions we don't have data for (e.g., Local & GBP)
 */
export type SeoSubscoreStatus = 'strong' | 'ok' | 'weak' | 'critical' | 'not_evaluated';

export interface SeoLabSubscore {
  label: string; // "Technical SEO", "On-page & Content", "Authority & Links", "SERP & Visibility", "Local & GBP"
  score: number | null;
  status: SeoSubscoreStatus;
  summary: string;
}

// ============================================================================
// Issues
// ============================================================================

export type SeoIssueCategory =
  | 'technical'
  | 'onpage'
  | 'content'
  | 'authority'
  | 'serp'
  | 'local';

export type SeoIssueSeverity = 'critical' | 'high' | 'medium' | 'low';

export type SeoIssueEffort = 'low' | 'medium' | 'high';

export interface SeoIssue {
  id: string;
  severity: SeoIssueSeverity;
  category: SeoIssueCategory;
  title: string;
  description: string;
  impactedPages?: string[];
  metricContext?: {
    impressions?: number;
    clicks?: number;
    ctr?: number;
    avgPosition?: number;
  };
  recommendedAction: string; // one-line action
  timeHorizon: 'now' | 'next' | 'later';
  impact: 'high' | 'medium' | 'low';
  effort: SeoIssueEffort; // Added for quick win derivation
}

// ============================================================================
// Quick Wins
// ============================================================================

export interface SeoLabQuickWin {
  title: string;
  description: string;
  reason: string; // why this matters
  impact: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  sourceIssueId?: string; // Link back to the source issue
}

// ============================================================================
// Projects
// ============================================================================

export interface SeoLabProject {
  title: string;
  description: string;
  theme: string; // "Technical cleanup", "Content strategy", etc.
  timeHorizon: 'now' | 'next' | 'later';
  impact: 'high' | 'medium' | 'low';
  issueIds: string[]; // IDs of issues grouped into this project
  issueCount: number; // Count of issues in this project
}

// ============================================================================
// Analytics Snapshot
// ============================================================================

export interface SeoAnalyticsQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SeoAnalyticsLandingPage {
  url: string;
  sessions: number;
  conversions?: number;
}

export interface SeoAnalyticsSnapshot {
  periodLabel: string;
  sessions?: number;
  organicSessions?: number;
  clicks?: number;
  impressions?: number;
  ctr?: number;
  avgPosition?: number;
  topQueries?: SeoAnalyticsQuery[];
  topLandingPages?: SeoAnalyticsLandingPage[];
}

// ============================================================================
// Data Confidence
// ============================================================================

/**
 * Data confidence level based on sample size and data quality
 */
export type DataConfidenceLevel = 'low' | 'medium' | 'high';

export interface DataConfidence {
  score: number; // 0-100
  level: DataConfidenceLevel;
  reason: string; // Human-readable explanation
}

// ============================================================================
// Maturity Stages
// ============================================================================

/**
 * SEO maturity stages based on on-site strength AND search performance
 * - unproven: Strong on-site signals, but little to no traffic
 * - emerging: Some traffic, early rankings
 * - scaling: Decent traffic & CTR, moving up
 * - established: Strong performance, good rankings & volume
 */
export type SeoMaturityStage = 'unproven' | 'emerging' | 'scaling' | 'established';

// ============================================================================
// Main Report Type
// ============================================================================

export interface SeoLabReport {
  // Split scoring system
  onSiteScore: number; // 0-100, from crawl/on-page signals only
  searchPerformanceScore: number | null; // 0-100 or null when data is too sparse to evaluate
  overallScore: number; // Combined score with caps applied (foundations-only when search is null)

  // Data confidence
  dataConfidence: DataConfidence;

  // Maturity assessment
  maturityStage: SeoMaturityStage;
  narrativeSummary: string;

  subscores: SeoLabSubscore[];

  topStrengths: string[];
  topGaps: string[];

  quickWins: SeoLabQuickWin[];
  projects: SeoLabProject[];

  issues: SeoIssue[];

  analyticsSnapshot?: SeoAnalyticsSnapshot;

  // Metadata
  generatedAt: string;
  companyId: string;
  url: string;
}

// ============================================================================
// Engine Result Wrapper
// ============================================================================

export interface SeoLabEngineResult {
  success: boolean;
  score?: number;
  summary?: string;
  report?: SeoLabReport;
  error?: string;
}

// ============================================================================
// Legacy Type Aliases (for backward compatibility during migration)
// ============================================================================

/** @deprecated Use SeoLabSubscore instead */
export type SeoHeavySubscore = SeoLabSubscore;

/** @deprecated Use SeoLabQuickWin instead */
export type SeoHeavyQuickWin = SeoLabQuickWin;

/** @deprecated Use SeoLabProject instead */
export type SeoHeavyProject = SeoLabProject;

/** @deprecated Use SeoLabReport instead */
export type SeoHeavyReport = SeoLabReport;

/** @deprecated Use SeoLabEngineResult instead */
export type SeoHeavyEngineResult = SeoLabEngineResult;

// ============================================================================
// Scoring Helper Functions
// ============================================================================
//
// UPDATED 2024: Data-sparse vs data-rich scoring logic
// When search data is extremely sparse (e.g., <20 impressions, 0 clicks),
// we cannot confidently score search performance. In these cases:
// - searchPerformanceScore is null (not 0)
// - overallScore is capped and labeled "foundations only"
// - maturityStage is "unproven" regardless of on-site quality
// - SERP & Visibility subscore is "not_evaluated"
// ============================================================================

/**
 * Detect if search analytics data is too sparse to meaningfully evaluate
 *
 * Returns true (sparse) when:
 * - No analytics snapshot
 * - Zero impressions
 * - Less than 20 impressions (too small a sample)
 * - Positive impressions but zero clicks (no engagement signal)
 */
export function isSearchDataSparse(analytics?: SeoAnalyticsSnapshot | null): boolean {
  if (!analytics) return true;

  const impressions = analytics.impressions ?? 0;
  const clicks = analytics.clicks ?? 0;

  // No data at all
  if (impressions <= 0) return true;

  // Very small footprint - not enough to draw conclusions
  if (impressions < 20) return true;

  // Impressions but no clicks - can't evaluate engagement/CTR
  if (impressions > 0 && clicks === 0) return true;

  return false;
}

/**
 * Compute data confidence from analytics snapshot
 *
 * Heuristic:
 * - Start at 0
 * - Add points for impressions volume (log scale)
 * - Add points for clicks
 * - Cap at 100
 *
 * For very low data (e.g., 6 impressions, 0 clicks), this returns ~10-30
 * IMPORTANT: When data is sparse, cap at 30 to indicate low confidence
 */
export function computeDataConfidence(analytics?: SeoAnalyticsSnapshot): DataConfidence {
  if (!analytics) {
    return {
      score: 0,
      level: 'low',
      reason: 'No search analytics data available.',
    };
  }

  const impressions = analytics.impressions ?? 0;
  const clicks = analytics.clicks ?? 0;
  const isSparse = isSearchDataSparse(analytics);

  let score = 0;

  // Impressions contribution (0-50 points, log scale)
  // 10 impressions = ~5pts, 100 = ~20pts, 1000 = ~35pts, 10000 = ~50pts
  if (impressions > 0) {
    score += Math.min(50, Math.log10(impressions + 1) * 12.5);
  }

  // Clicks contribution (0-30 points, log scale)
  // 1 click = ~5pts, 10 = ~15pts, 100 = ~25pts, 1000 = ~30pts
  if (clicks > 0) {
    score += Math.min(30, Math.log10(clicks + 1) * 10);
  }

  // Query diversity contribution (0-20 points)
  const queryCount = analytics.topQueries?.length ?? 0;
  score += Math.min(20, queryCount * 2);

  score = Math.round(Math.min(100, score));

  // IMPORTANT: Cap confidence at 30 when data is sparse
  // This ensures we don't claim high confidence with insufficient data
  if (isSparse) {
    score = Math.min(score, 30);
  }

  // Determine level and reason
  let level: DataConfidenceLevel;
  let reason: string;

  if (isSparse) {
    level = 'low';
    reason = `Search data is too sparse (${impressions.toLocaleString()} impressions, ${clicks.toLocaleString()} clicks over ${analytics.periodLabel || 'the period'}). Treat this as a foundations score, not proof that SEO is working.`;
  } else if (score < 34) {
    level = 'low';
    reason = `Very low sample size (${impressions.toLocaleString()} impressions, ${clicks.toLocaleString()} clicks over ${analytics.periodLabel || 'the period'}). Treat search insights as directional.`;
  } else if (score < 67) {
    level = 'medium';
    reason = `Moderate sample size (${impressions.toLocaleString()} impressions, ${clicks.toLocaleString()} clicks). Results are reasonably reliable.`;
  } else {
    level = 'high';
    reason = `Strong sample size (${impressions.toLocaleString()} impressions, ${clicks.toLocaleString()} clicks). Results are highly reliable.`;
  }

  return { score, level, reason };
}

/**
 * Compute search performance score from analytics data
 *
 * UPDATED: Returns null when data is too sparse to meaningfully evaluate.
 * This prevents false confidence (e.g., score: 0 implying "we know it's zero")
 * when we simply don't have enough data to say anything meaningful.
 *
 * When data is NOT sparse, combines:
 *   - Log-scaled clicks (0-50 pts)
 *   - CTR vs benchmark (~2-3%) (0-30 pts)
 *   - Position bonus for avg position < 20 (0-20 pts)
 */
export function computeSearchPerformanceScore(analytics?: SeoAnalyticsSnapshot): number | null {
  // If data is sparse, we cannot meaningfully score search performance
  if (isSearchDataSparse(analytics)) {
    return null;
  }

  // At this point we know analytics exists and has sufficient data
  const impressions = analytics!.impressions ?? 0;
  const clicks = analytics!.clicks ?? 0;
  const ctr = analytics!.ctr ?? 0;
  const avgPosition = analytics!.avgPosition;

  let score = 0;

  // Clicks contribution (0-50 points, log scale)
  // 1 click = ~5, 10 = ~17, 100 = ~33, 1000 = ~50
  if (clicks > 0) {
    score += Math.min(50, Math.log10(clicks + 1) * 16.7);
  }

  // CTR contribution (0-30 points)
  // Benchmark CTR is ~2-3% for organic search
  // CTR of 0% = 0pts, 1% = 10pts, 2% = 20pts, 3%+ = 30pts
  if (ctr > 0) {
    score += Math.min(30, ctr * 1000); // ctr is 0-1 range, so 0.03 * 1000 = 30
  }

  // Position contribution (0-20 points)
  // Position 1-3 = 20pts, 4-10 = 15pts, 11-20 = 10pts, 21-50 = 5pts, >50 = 0pts
  if (avgPosition !== undefined && avgPosition > 0) {
    if (avgPosition <= 3) {
      score += 20;
    } else if (avgPosition <= 10) {
      score += 15;
    } else if (avgPosition <= 20) {
      score += 10;
    } else if (avgPosition <= 50) {
      score += 5;
    }
  }

  return Math.round(Math.min(100, score));
}

/**
 * Derive SEO maturity stage from scores and data confidence
 *
 * UPDATED: Now respects searchPerformanceScore being null and uses dataConfidence.
 *
 * Rules:
 * - If searchScore is null or dataConfidence < 30 → "unproven" (insufficient data)
 * - Else if overallScore < 50 → "unproven"
 * - Else if overallScore < 70 → "emerging"
 * - Else if overallScore < 85 → "scaling"
 * - Else → "established"
 */
export function deriveSeoMaturityStage(
  overallScore: number,
  searchScore: number | null,
  dataConfidence: number
): SeoMaturityStage {
  // If we don't really know how it performs in search,
  // it's unproven regardless of on-site score.
  if (searchScore === null || dataConfidence < 30) {
    return 'unproven';
  }

  // Thresholds based on overall score (which blends on-site + search)
  if (overallScore < 50) return 'unproven';
  if (overallScore < 70) return 'emerging';
  if (overallScore < 85) return 'scaling';
  return 'established';
}

/**
 * Compute overall score with data-sparse vs data-rich logic
 *
 * UPDATED: Two regimes:
 *
 * 1. FOUNDATIONS-ONLY (when searchPerformanceScore is null or dataConfidence < 30):
 *    - Score = onSiteScore * 0.75
 *    - Capped at 79 (can never look "elite" without search proof)
 *
 * 2. DATA-RICH (when we have valid search performance data):
 *    - Score = 0.6 * onSiteScore + 0.4 * searchPerformanceScore
 *    - Additional caps when search performance is weak
 *    - Penalty for low confidence even in data-rich cases
 */
export function computeOverallScore(
  onSiteScore: number,
  searchPerformanceScore: number | null,
  dataConfidence: DataConfidence
): number {
  // Determine if we're in foundations-only regime
  const isFoundationsOnly = searchPerformanceScore === null || dataConfidence.score < 30;

  if (isFoundationsOnly) {
    // Foundations-only regime: good on-site can never look "elite" without proof
    const foundationsScore = onSiteScore * 0.75;
    // Cap so it can't look like an established SEO engine
    return Math.round(Math.min(foundationsScore, 79));
  }

  // Data-rich regime: blend on-site and performance
  let overall = 0.6 * onSiteScore + 0.4 * searchPerformanceScore;

  // Apply caps when search performance is weak
  if (searchPerformanceScore < 10) {
    overall = Math.min(overall, 55);
  } else if (searchPerformanceScore < 20) {
    overall = Math.min(overall, 65);
  }

  // Penalty for low confidence even in data-rich cases
  if (dataConfidence.score < 40) {
    overall -= 10;
  }

  return Math.max(0, Math.round(overall));
}

/**
 * Get status from score for subscores
 */
export function getStatusFromScore(
  score: number | null
): SeoSubscoreStatus {
  if (score === null) return 'not_evaluated';
  if (score >= 75) return 'strong';
  if (score >= 50) return 'ok';
  if (score >= 25) return 'weak';
  return 'critical';
}

/**
 * Generate a unique ID for an issue
 */
export function generateIssueId(category: SeoIssueCategory, index: number): string {
  return `seo-${category}-${index}-${Date.now().toString(36)}`;
}

/**
 * Get human-readable label for maturity stage
 */
export function getMaturityStageLabel(stage: SeoMaturityStage): string {
  const labels: Record<SeoMaturityStage, string> = {
    unproven: 'Unproven',
    emerging: 'Emerging',
    scaling: 'Scaling',
    established: 'Established',
  };
  return labels[stage] || stage;
}

/**
 * Get color class for maturity stage
 */
export function getMaturityStageColor(stage: SeoMaturityStage): string {
  const colors: Record<SeoMaturityStage, string> = {
    unproven: 'text-slate-400',
    emerging: 'text-amber-400',
    scaling: 'text-cyan-400',
    established: 'text-emerald-400',
  };
  return colors[stage] || 'text-slate-400';
}

/**
 * Get color class for data confidence level
 */
export function getDataConfidenceColor(level: DataConfidenceLevel): string {
  const colors: Record<DataConfidenceLevel, string> = {
    low: 'text-amber-400',
    medium: 'text-cyan-400',
    high: 'text-emerald-400',
  };
  return colors[level] || 'text-slate-400';
}
