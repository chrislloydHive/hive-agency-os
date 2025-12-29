// lib/contextGraph/health.ts
// Context Graph health checking utilities
//
// Provides comprehensive health scoring for Context Graphs including:
// - Overall score (0-100) with completeness, critical coverage, freshness
// - Section-by-section breakdown
// - Missing critical fields identification
// - Severity levels for gating

import type { CompanyContextGraph, DomainName } from './companyContextGraph';
import { DOMAIN_NAMES } from './companyContextGraph';
import {
  getAllSections,
  getFieldsBySection,
  getAutoFillMode,
  type ContextFieldDef,
  type ContextSectionId,
} from './schema';
import { getFieldFreshness } from './freshness';
import type { WithMetaType } from './types';
import { computeConvergenceScore } from './convergence';

/**
 * Context Graph health status
 */
export type ContextGraphHealthStatus = 'healthy' | 'partial' | 'empty' | 'unavailable';

/**
 * Context Graph health check result
 */
export interface ContextGraphHealth {
  status: ContextGraphHealthStatus;
  completenessScore: number;
  domainCoverage: Record<DomainName, number>;
  missingCoreDomains: DomainName[];
  lastUpdated: string | null;
  message: string;
}

/**
 * Core domains that should have data for a healthy graph
 */
const CORE_DOMAINS: DomainName[] = [
  'identity',
  'objectives',
  'audience',
];

/**
 * Check if a context graph is healthy and usable
 *
 * @param graph - The context graph to check, or null if unavailable
 * @returns Health check result with status and details
 */
export function checkContextGraphHealth(
  graph: CompanyContextGraph | null
): ContextGraphHealth {
  // Unavailable - null graph
  if (!graph) {
    return {
      status: 'unavailable',
      completenessScore: 0,
      domainCoverage: createEmptyDomainCoverage(),
      missingCoreDomains: [...CORE_DOMAINS],
      lastUpdated: null,
      message: 'Context data is not available for this company.',
    };
  }

  // Calculate domain coverage
  const domainCoverage = graph.meta.domainCoverage
    ? (graph.meta.domainCoverage as Record<DomainName, number>)
    : calculateDomainCoverageLocal(graph);

  const completenessScore = graph.meta.completenessScore ?? 0;

  // Find missing core domains (coverage < 10%)
  const missingCoreDomains = CORE_DOMAINS.filter(
    domain => (domainCoverage[domain] ?? 0) < 10
  );

  // Determine status
  let status: ContextGraphHealthStatus;
  let message: string;

  if (completenessScore >= 50 && missingCoreDomains.length === 0) {
    status = 'healthy';
    message = 'Context data is complete and ready for use.';
  } else if (completenessScore >= 20 || missingCoreDomains.length < CORE_DOMAINS.length) {
    status = 'partial';
    message = 'Context data is partially available. Some insights may be limited.';
  } else {
    status = 'empty';
    message = 'Context data is mostly empty. Run Strategic Setup or diagnostics to populate.';
  }

  return {
    status,
    completenessScore,
    domainCoverage,
    missingCoreDomains,
    lastUpdated: graph.meta.updatedAt ?? null,
    message,
  };
}

/**
 * Quick check if graph is healthy enough to proceed
 * Use this for gating features that require context data
 */
export function isContextGraphHealthy(graph: CompanyContextGraph | null): boolean {
  if (!graph) return false;
  const health = checkContextGraphHealth(graph);
  return health.status === 'healthy' || health.status === 'partial';
}

/**
 * Get a user-friendly status label
 */
export function getHealthStatusLabel(status: ContextGraphHealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'Complete';
    case 'partial':
      return 'Partial';
    case 'empty':
      return 'Empty';
    case 'unavailable':
      return 'Unavailable';
  }
}

/**
 * Get status color classes for UI
 */
export function getHealthStatusColors(status: ContextGraphHealthStatus): {
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case 'healthy':
      return {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
      };
    case 'partial':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
      };
    case 'empty':
      return {
        bg: 'bg-slate-500/10',
        text: 'text-slate-400',
        border: 'border-slate-500/30',
      };
    case 'unavailable':
      return {
        bg: 'bg-red-500/10',
        text: 'text-red-400',
        border: 'border-red-500/30',
      };
  }
}

/**
 * Create empty domain coverage record
 */
function createEmptyDomainCoverage(): Record<DomainName, number> {
  const coverage: Partial<Record<DomainName, number>> = {};
  for (const domain of DOMAIN_NAMES) {
    coverage[domain] = 0;
  }
  return coverage as Record<DomainName, number>;
}

/**
 * Calculate domain coverage locally (fallback when not in meta)
 */
function calculateDomainCoverageLocal(graph: CompanyContextGraph): Record<DomainName, number> {
  const coverage: Partial<Record<DomainName, number>> = {};

  for (const domain of DOMAIN_NAMES) {
    let totalFields = 0;
    let populatedFields = 0;

    function countFields(obj: unknown, depth = 0): void {
      if (depth > 10) return;

      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        const record = obj as Record<string, unknown>;

        if ('value' in record && 'provenance' in record) {
          totalFields++;
          if (record.value !== null && record.value !== undefined) {
            if (Array.isArray(record.value) && record.value.length === 0) {
              // Empty arrays don't count
            } else {
              populatedFields++;
            }
          }
        } else {
          for (const value of Object.values(record)) {
            countFields(value, depth + 1);
          }
        }
      }
    }

    countFields(graph[domain]);
    coverage[domain] = totalFields > 0 ? Math.round((populatedFields / totalFields) * 100) : 0;
  }

  return coverage as Record<DomainName, number>;
}

// ============================================================================
// Context Health Score Types
// ============================================================================

/**
 * Section-level health scores
 */
export interface SectionScore {
  section: ContextSectionId;
  label: string;
  completeness: number;      // 0-100
  criticalCoverage: number;  // 0-100
  freshness: number;         // 0-100
  totalFields: number;
  populatedFields: number;
  criticalFields: number;
  criticalPopulated: number;
  staleFields: number;
}

/**
 * Comprehensive context health score
 */
export interface ContextHealthScore {
  companyId: string;
  /** Overall health score 0-100 */
  overallScore: number;
  /** Completeness contribution 0-100 */
  completenessScore: number;
  /** Critical fields coverage 0-100 */
  criticalCoverageScore: number;
  /** Freshness score 0-100 */
  freshnessScore: number;
  /** Confidence score 0-100 (from provenance confidence values) */
  confidenceScore: number;
  /** Per-section breakdown */
  sectionScores: SectionScore[];
  /** Missing critical fields */
  missingCriticalFields: ContextFieldDef[];
  /** Severity classification */
  severity: ContextSeverity;
  /** When the score was computed */
  computedAt: string;
  /** Detailed stats */
  stats: {
    totalFields: number;
    populatedFields: number;
    criticalFields: number;
    criticalPopulated: number;
    staleFields: number;
    averageConfidence: number;
    /** Fields excluded from scoring (manual mode) */
    manualFields: number;
    /** Fields that can be auto-filled */
    autoFillableFields: number;
  };
}

/**
 * Context severity levels for gating
 */
export type ContextSeverity = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Human-readable section labels
 */
const SECTION_LABELS: Record<ContextSectionId, string> = {
  identity: 'Identity',
  audience: 'Audience',
  brand: 'Brand',
  website: 'Website',
  media: 'Media',
  creative: 'Creative',
  objectives: 'Objectives',
  constraints: 'Budget & Constraints',
  productOffer: 'Product/Offer',
  content: 'Content',
  seo: 'SEO',
  ops: 'Operations',
  competitive: 'Competitive',
  historical: 'Historical',
  storeRisk: 'Store Risk',
};

// ============================================================================
// Main Scoring Function
// ============================================================================

/**
 * Compute comprehensive context health score for a company
 *
 * Scoring rules:
 * - Completeness: % of AUTO-FILLABLE fields with values (excludes manual fields)
 * - Critical Coverage: % of AUTO-FILLABLE critical fields with values
 * - Freshness: Average freshness score (0-1 -> 0-100) of populated fields
 * - Confidence: Average confidence from provenance (0-1 -> 0-100)
 *
 * IMPORTANT: Manual fields (autoFillMode === 'manual') are EXCLUDED from the
 * completeness and critical coverage denominators. This ensures health score
 * reflects how well the system did on auto-fillable context, not how many
 * business goals the user hasn't typed yet.
 *
 * Overall score = weighted average:
 *   0.4 * criticalCoverageScore + 0.3 * completenessScore + 0.2 * freshnessScore + 0.1 * confidenceScore
 */
export async function computeContextHealthScore(
  companyId: string
): Promise<ContextHealthScore> {
  // Lazy import to avoid circular dependency
  const { loadContextGraph } = await import('./storage');

  const graph = await loadContextGraph(companyId);

  // Initialize tracking variables
  const sectionScores: SectionScore[] = [];
  const missingCriticalFields: ContextFieldDef[] = [];

  // Total fields (for informational purposes)
  let totalFieldsAll = 0;
  // Auto-fillable fields only (used for scoring)
  let totalAutoFillable = 0;
  let populatedAutoFillable = 0;
  let criticalAutoFillable = 0;
  let criticalAutoFillablePopulated = 0;
  // Manual fields (excluded from scoring)
  let manualFields = 0;

  let totalFreshness = 0;
  let freshnessCount = 0;
  let totalConfidence = 0;
  let confidenceCount = 0;
  let staleFields = 0;

  // Get all sections
  const sections = getAllSections();

  for (const section of sections) {
    const sectionFields = getFieldsBySection(section);
    if (sectionFields.length === 0) continue;

    let sectionPopulated = 0;
    let sectionAutoFillable = 0;
    let sectionCritical = 0;
    let sectionCriticalPopulated = 0;
    let sectionFreshness = 0;
    let sectionFreshnessCount = 0;
    let sectionStale = 0;

    for (const fieldDef of sectionFields) {
      // Skip deprecated fields
      if (fieldDef.deprecated) continue;

      totalFieldsAll++;

      const autoFillMode = getAutoFillMode(fieldDef);

      // Track manual fields separately (excluded from scoring)
      if (autoFillMode === 'manual') {
        manualFields++;
        continue; // Skip manual fields in score calculation
      }

      // From here, we're only counting auto/assist fields
      totalAutoFillable++;
      sectionAutoFillable++;

      if (fieldDef.critical) {
        criticalAutoFillable++;
        sectionCritical++;
      }

      // Check if field is populated
      const fieldData = getFieldFromGraph(graph, fieldDef);
      const isPopulated = fieldData !== null && isFieldPopulated(fieldData);

      if (isPopulated) {
        populatedAutoFillable++;
        sectionPopulated++;

        if (fieldDef.critical) {
          criticalAutoFillablePopulated++;
          sectionCriticalPopulated++;
        }

        // Get freshness
        const freshness = getFieldFreshness(fieldData as WithMetaType<unknown>);
        if (freshness) {
          const freshnessValue = freshness.score * 100;
          totalFreshness += freshnessValue;
          freshnessCount++;
          sectionFreshness += freshnessValue;
          sectionFreshnessCount++;

          if (freshness.label === 'stale' || freshness.label === 'expired') {
            staleFields++;
            sectionStale++;
          }
        }

        // Get confidence from convergence scoring (includes humanEdited boost)
        const convergence = computeConvergenceScore(fieldData as WithMetaType<unknown>);
        if (convergence.finalConfidence > 0) {
          totalConfidence += convergence.finalConfidence * 100;
          confidenceCount++;
        }
      } else if (fieldDef.critical) {
        missingCriticalFields.push(fieldDef);
      }
    }

    // Calculate section scores (based on auto-fillable fields only)
    const sectionCompleteness = sectionAutoFillable > 0
      ? Math.round((sectionPopulated / sectionAutoFillable) * 100)
      : 100;

    const sectionCriticalCoverage = sectionCritical > 0
      ? Math.round((sectionCriticalPopulated / sectionCritical) * 100)
      : 100;

    const sectionAvgFreshness = sectionFreshnessCount > 0
      ? Math.round(sectionFreshness / sectionFreshnessCount)
      : 100;

    sectionScores.push({
      section,
      label: SECTION_LABELS[section] || section,
      completeness: sectionCompleteness,
      criticalCoverage: sectionCriticalCoverage,
      freshness: sectionAvgFreshness,
      totalFields: sectionAutoFillable, // Only auto-fillable fields
      populatedFields: sectionPopulated,
      criticalFields: sectionCritical,
      criticalPopulated: sectionCriticalPopulated,
      staleFields: sectionStale,
    });
  }

  // Calculate global scores (based on auto-fillable fields only)
  const completenessScore = totalAutoFillable > 0
    ? Math.round((populatedAutoFillable / totalAutoFillable) * 100)
    : 0;

  const criticalCoverageScore = criticalAutoFillable > 0
    ? Math.round((criticalAutoFillablePopulated / criticalAutoFillable) * 100)
    : 100;

  const freshnessScore = freshnessCount > 0
    ? Math.round(totalFreshness / freshnessCount)
    : 100;

  const confidenceScore = confidenceCount > 0
    ? Math.round(totalConfidence / confidenceCount)
    : 100;

  // Calculate overall score with weights
  // Critical coverage is most important (40%), then completeness (30%), then freshness (20%), then confidence (10%)
  const overallScore = Math.round(
    0.4 * criticalCoverageScore +
    0.3 * completenessScore +
    0.2 * freshnessScore +
    0.1 * confidenceScore
  );

  // Determine severity
  const severity = getContextSeverity({ overallScore } as ContextHealthScore);

  // Sort section scores by critical coverage (lowest first for attention)
  sectionScores.sort((a, b) => a.criticalCoverage - b.criticalCoverage);

  return {
    companyId,
    overallScore,
    completenessScore,
    criticalCoverageScore,
    freshnessScore,
    confidenceScore,
    sectionScores,
    missingCriticalFields,
    severity,
    computedAt: new Date().toISOString(),
    stats: {
      totalFields: totalFieldsAll,
      populatedFields: populatedAutoFillable,
      criticalFields: criticalAutoFillable,
      criticalPopulated: criticalAutoFillablePopulated,
      staleFields,
      averageConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 100,
      manualFields,
      autoFillableFields: totalAutoFillable,
    },
  };
}

// ============================================================================
// Severity Helpers
// ============================================================================

/**
 * Determine context severity from health score
 */
export function getContextSeverity(health: Pick<ContextHealthScore, 'overallScore'>): ContextSeverity {
  if (health.overallScore >= 80) return 'healthy';
  if (health.overallScore >= 50) return 'degraded';
  return 'unhealthy';
}

/**
 * Get severity colors for UI
 */
export function getSeverityColors(severity: ContextSeverity): {
  bg: string;
  text: string;
  border: string;
} {
  switch (severity) {
    case 'healthy':
      return {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
      };
    case 'degraded':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
      };
    case 'unhealthy':
      return {
        bg: 'bg-red-500/10',
        text: 'text-red-400',
        border: 'border-red-500/30',
      };
  }
}

/**
 * Get severity label for UI
 */
export function getSeverityLabel(severity: ContextSeverity): string {
  switch (severity) {
    case 'healthy':
      return 'Healthy';
    case 'degraded':
      return 'Needs Improvement';
    case 'unhealthy':
      return 'Weak / Incomplete';
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a field from the graph by its definition
 */
function getFieldFromGraph(
  graph: CompanyContextGraph | null,
  fieldDef: ContextFieldDef
): WithMetaType<unknown> | null {
  if (!graph) return null;

  const domain = graph[fieldDef.domain as keyof CompanyContextGraph];
  if (!domain || typeof domain !== 'object') return null;

  const field = (domain as Record<string, unknown>)[fieldDef.field];
  if (!field || typeof field !== 'object') return null;

  // Check if it's a WithMetaType field (has value and provenance)
  if ('value' in field && 'provenance' in field) {
    return field as WithMetaType<unknown>;
  }

  return null;
}

/**
 * Check if a field is populated (has a non-empty value)
 */
function isFieldPopulated(field: WithMetaType<unknown>): boolean {
  if (field.value === null || field.value === undefined) return false;

  // Empty arrays don't count
  if (Array.isArray(field.value) && field.value.length === 0) return false;

  // Empty strings don't count
  if (typeof field.value === 'string' && field.value.trim() === '') return false;

  return true;
}

/**
 * Get confidence from field provenance
 */
function _getFieldConfidence(field: WithMetaType<unknown> | null): number | null {
  if (!field || !field.provenance || field.provenance.length === 0) return null;

  // Use the most recent provenance entry's confidence
  const latestProvenance = field.provenance[0];
  if (!latestProvenance) return null;

  // Confidence can be stored as 'confidence' or derived from source quality
  if ('confidence' in latestProvenance && typeof latestProvenance.confidence === 'number') {
    return latestProvenance.confidence;
  }

  // Default confidence based on source type
  const source = latestProvenance.source || 'unknown';
  const sourceConfidence: Record<string, number> = {
    user: 1.0,
    setup_wizard: 0.95,
    manual: 0.9,
    gap_heavy: 0.85,
    gap: 0.8,
    brand_lab: 0.8,
    audience_lab: 0.8,
    creative_lab: 0.8,
    competitor_lab: 0.8,
    website_lab: 0.75,
    content_lab: 0.75,
    seo_lab: 0.75,
    demand_lab: 0.75,
    ops_lab: 0.7,
    analytics: 0.9,
    import: 0.7,
    unknown: 0.5,
  };

  return sourceConfidence[source] ?? 0.5;
}

// ============================================================================
// Section Gating Helpers
// ============================================================================

/**
 * Check if a specific section has adequate coverage for a flow
 */
export function checkSectionForFlow(
  health: ContextHealthScore,
  section: ContextSectionId,
  threshold: number = 50
): { adequate: boolean; score: number; message?: string } {
  const sectionScore = health.sectionScores.find(s => s.section === section);

  if (!sectionScore) {
    return {
      adequate: false,
      score: 0,
      message: `Section "${section}" not found in health score.`,
    };
  }

  const adequate = sectionScore.criticalCoverage >= threshold;

  return {
    adequate,
    score: sectionScore.criticalCoverage,
    message: adequate
      ? undefined
      : `${SECTION_LABELS[section]} needs attention (${sectionScore.criticalCoverage}% critical coverage).`,
  };
}

/**
 * Get recommended actions based on health score
 */
export function getHealthRecommendations(
  health: ContextHealthScore
): Array<{
  action: string;
  section: ContextSectionId;
  path: string;
  priority: 'high' | 'medium' | 'low';
}> {
  const recommendations: Array<{
    action: string;
    section: ContextSectionId;
    path: string;
    priority: 'high' | 'medium' | 'low';
  }> = [];

  // Add recommendations for sections with low critical coverage
  for (const section of health.sectionScores) {
    if (section.criticalCoverage < 50 && section.criticalFields > 0) {
      recommendations.push({
        action: `Complete ${section.label} section`,
        section: section.section,
        path: '/brain/setup',
        priority: section.criticalCoverage < 30 ? 'high' : 'medium',
      });
    } else if (section.staleFields > 0) {
      recommendations.push({
        action: `Refresh stale ${section.label} data`,
        section: section.section,
        path: '/brain/context',
        priority: 'low',
      });
    }
  }

  // Add specific missing field recommendations
  for (const field of health.missingCriticalFields.slice(0, 3)) {
    const primarySource = field.primarySources[0];
    let path = '/brain/setup';

    if (primarySource === 'AudienceLab') path = '/diagnostics/audience';
    else if (primarySource === 'BrandLab') path = '/diagnostics/brand';
    else if (primarySource === 'CreativeLab') path = '/labs/creative';
    else if (primarySource === 'CompetitorLab') path = '/labs/competitor';
    else if (primarySource === 'GAP' || primarySource === 'GAPHeavy') path = '/gap';

    recommendations.push({
      action: `Fill "${field.label}"`,
      section: field.section,
      path,
      priority: 'high',
    });
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recommendations.slice(0, 5);
}

// ============================================================================
// Competitive Health Score
// ============================================================================

/**
 * Competitive health metrics
 */
export interface CompetitiveHealthScore {
  /** Overall competitive health 0-100 */
  overallScore: number;
  /** Competitor coverage (% of competitors with full data) */
  competitorCoverage: number;
  /** Average competitor confidence (from provenance) */
  competitorConfidence: number;
  /** Feature matrix completeness */
  featureMatrixCompleteness: number;
  /** Pricing landscape completeness */
  pricingLandscapeCompleteness: number;
  /** Messaging analysis completeness */
  messagingCompleteness: number;
  /** Cluster analysis completeness */
  clusterCompleteness: number;
  /** Whitespace opportunities identified */
  whitespacePresence: number;
  /** Threat modeling completeness */
  threatModelingCompleteness: number;
  /** AI-seeded status - true if ALL competitors are autoSeeded (unverified) */
  isAiSeeded: boolean;
  /** Status message for UI display */
  statusMessage?: string;
  /** Detailed counts */
  counts: {
    competitors: number;
    competitorsWithPosition: number;
    competitorsWithConfidence: number;
    competitorsWithTrajectory: number;
    featuresTracked: number;
    pricingModels: number;
    messageThemes: number;
    clusters: number;
    whitespaceOpportunities: number;
    threatScores: number;
    substitutes: number;
    /** Number of AI-seeded (unverified) competitors */
    autoSeededCompetitors: number;
    /** Number of human-verified competitors */
    verifiedCompetitors: number;
  };
  /** Recommendations for improving competitive health */
  recommendations: string[];
}

/**
 * Compute competitive-specific health score
 */
export async function computeCompetitiveHealthScore(
  companyId: string
): Promise<CompetitiveHealthScore> {
  // Lazy import to avoid circular dependency
  const { loadContextGraph } = await import('./storage');

  const graph = await loadContextGraph(companyId);
  const competitive = graph?.competitive;

  // Initialize counts
  const counts = {
    competitors: 0,
    competitorsWithPosition: 0,
    competitorsWithConfidence: 0,
    competitorsWithTrajectory: 0,
    featuresTracked: 0,
    pricingModels: 0,
    messageThemes: 0,
    clusters: 0,
    whitespaceOpportunities: 0,
    threatScores: 0,
    substitutes: 0,
    autoSeededCompetitors: 0,
    verifiedCompetitors: 0,
  };

  const recommendations: string[] = [];

  if (!competitive) {
    return {
      overallScore: 0,
      competitorCoverage: 0,
      competitorConfidence: 0,
      featureMatrixCompleteness: 0,
      pricingLandscapeCompleteness: 0,
      messagingCompleteness: 0,
      clusterCompleteness: 0,
      whitespacePresence: 0,
      threatModelingCompleteness: 0,
      isAiSeeded: false,
      statusMessage: 'No competitors tracked. Run Competitor Lab to analyze your competitive landscape.',
      counts,
      recommendations: ['Run Competitor Lab to analyze your competitive landscape'],
    };
  }

  // Get competitors
  const competitors = competitive.competitors?.value ||
    competitive.primaryCompetitors?.value || [];
  counts.competitors = competitors.filter(c => c.category !== 'own').length;

  // Calculate competitor coverage metrics
  let totalConfidence = 0;
  let confidenceCount = 0;

  for (const c of competitors) {
    if (c.category === 'own') continue;

    // Track autoSeeded vs verified
    if (c.autoSeeded) {
      counts.autoSeededCompetitors++;
    } else {
      counts.verifiedCompetitors++;
    }

    // Check for positioning
    if (c.xPosition !== null && c.xPosition !== undefined ||
        c.positionPrimary !== null && c.positionPrimary !== undefined) {
      counts.competitorsWithPosition++;
    }

    // Check for confidence
    if (c.confidence !== null && c.confidence !== undefined) {
      counts.competitorsWithConfidence++;
      totalConfidence += c.confidence;
      confidenceCount++;
    }

    // Check for trajectory
    if (c.trajectory) {
      counts.competitorsWithTrajectory++;
    }
  }

  // Get feature matrix
  const featuresMatrix = competitive.featuresMatrix?.value || [];
  counts.featuresTracked = featuresMatrix.length;

  // Get pricing models
  const pricingModels = competitive.pricingModels?.value || [];
  counts.pricingModels = pricingModels.length;

  // Get messaging overlap
  const messageOverlap = competitive.messageOverlap?.value || [];
  counts.messageThemes = messageOverlap.length;

  // Get clusters
  const clusters = competitive.marketClusters?.value || [];
  counts.clusters = clusters.length;

  // Get whitespace
  const whitespace = competitive.whitespaceMap?.value || [];
  counts.whitespaceOpportunities = whitespace.length;

  // Get threat scores
  const threatScores = competitive.threatScores?.value || [];
  counts.threatScores = threatScores.length;

  // Get substitutes
  const substitutes = competitive.substitutes?.value || [];
  counts.substitutes = substitutes.length;

  // Calculate component scores
  const competitorCoverage = counts.competitors > 0
    ? Math.round((counts.competitorsWithPosition / counts.competitors) * 100)
    : 0;

  const competitorConfidence = confidenceCount > 0
    ? Math.round((totalConfidence / confidenceCount) * 100)
    : 0;

  // Feature matrix completeness (expect at least 5 features)
  const featureMatrixCompleteness = Math.min(100, Math.round((counts.featuresTracked / 5) * 100));

  // Pricing landscape (expect at least 3 pricing models, matching competitor count)
  const expectedPricing = Math.max(3, counts.competitors);
  const pricingLandscapeCompleteness = Math.min(100, Math.round((counts.pricingModels / expectedPricing) * 100));

  // Messaging completeness (expect at least 5 themes)
  const messagingCompleteness = Math.min(100, Math.round((counts.messageThemes / 5) * 100));

  // Cluster completeness (expect at least 2 clusters)
  const clusterCompleteness = Math.min(100, Math.round((counts.clusters / 2) * 100));

  // Whitespace presence (expect at least 3 opportunities)
  const whitespacePresence = Math.min(100, Math.round((counts.whitespaceOpportunities / 3) * 100));

  // Threat modeling (expect threat scores for at least 80% of competitors)
  const expectedThreats = Math.max(1, Math.round(counts.competitors * 0.8));
  const threatModelingCompleteness = counts.competitors > 0
    ? Math.min(100, Math.round((counts.threatScores / expectedThreats) * 100))
    : 0;

  // Determine AI-seeded status
  // isAiSeeded is true if there are competitors but ALL are autoSeeded (none verified)
  const isAiSeeded = counts.competitors > 0 && counts.verifiedCompetitors === 0;

  // Calculate overall score with weights
  // Competitor coverage (30%), Feature matrix (15%), Pricing (10%), Messaging (15%),
  // Clusters (10%), Whitespace (10%), Threat modeling (10%)
  let overallScore = Math.round(
    0.30 * competitorCoverage +
    0.15 * featureMatrixCompleteness +
    0.10 * pricingLandscapeCompleteness +
    0.15 * messagingCompleteness +
    0.10 * clusterCompleteness +
    0.10 * whitespacePresence +
    0.10 * threatModelingCompleteness
  );

  // If all competitors are AI-seeded, cap the score at 50% of its normal value
  // This ensures Competitive doesn't contribute fully to global health until verified
  if (isAiSeeded) {
    overallScore = Math.round(overallScore * 0.5);
  }

  // Generate status message
  let statusMessage: string | undefined;
  if (counts.competitors === 0) {
    statusMessage = 'No competitors tracked. Run Competitor Lab to analyze your competitive landscape.';
  } else if (isAiSeeded) {
    statusMessage = 'Competitive landscape is AI-generated. Review competitors to finalize this section.';
  }

  // Generate recommendations
  if (counts.competitors === 0) {
    recommendations.push('Run Competitor Lab to identify competitors');
  } else {
    // Prioritize verification if AI-seeded
    if (isAiSeeded) {
      recommendations.unshift('Review AI-suggested competitors to verify accuracy');
    }
    if (competitorCoverage < 50) {
      recommendations.push('Add positioning coordinates for more competitors');
    }
    if (featureMatrixCompleteness < 50) {
      recommendations.push('Expand feature matrix comparison');
    }
    if (pricingLandscapeCompleteness < 50) {
      recommendations.push('Add pricing data for competitors');
    }
    if (messagingCompleteness < 50) {
      recommendations.push('Analyze messaging theme overlap');
    }
    if (clusterCompleteness < 50) {
      recommendations.push('Identify market clusters');
    }
    if (whitespacePresence < 50) {
      recommendations.push('Identify whitespace opportunities');
    }
    if (threatModelingCompleteness < 50) {
      recommendations.push('Complete threat modeling for competitors');
    }
    if (counts.substitutes === 0) {
      recommendations.push('Identify substitute products/solutions');
    }
    if (counts.competitorsWithTrajectory < counts.competitors * 0.5) {
      recommendations.push('Add trajectory analysis for competitors');
    }
  }

  return {
    overallScore,
    competitorCoverage,
    competitorConfidence,
    featureMatrixCompleteness,
    pricingLandscapeCompleteness,
    messagingCompleteness,
    clusterCompleteness,
    whitespacePresence,
    threatModelingCompleteness,
    isAiSeeded,
    statusMessage,
    counts,
    recommendations: recommendations.slice(0, 5),
  };
}
