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
  CONTEXT_FIELDS,
  getCriticalFields,
  getAllSections,
  getFieldsBySection,
  type ContextFieldDef,
  type ContextSectionId,
  type WriterModuleId,
} from './schema';
import { getFieldFreshness, type FreshnessScore } from './freshness';
import type { WithMetaType } from './types';

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
 * - Completeness: % of fields with values
 * - Critical Coverage: % of critical fields with values
 * - Freshness: Average freshness score (0-1 -> 0-100) of populated fields
 * - Confidence: Average confidence from provenance (0-1 -> 0-100)
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

  let totalFields = 0;
  let populatedFields = 0;
  let criticalFields = 0;
  let criticalPopulated = 0;
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
    let sectionCritical = 0;
    let sectionCriticalPopulated = 0;
    let sectionFreshness = 0;
    let sectionFreshnessCount = 0;
    let sectionStale = 0;

    for (const fieldDef of sectionFields) {
      // Skip deprecated fields
      if (fieldDef.deprecated) continue;

      totalFields++;

      if (fieldDef.critical) {
        criticalFields++;
        sectionCritical++;
      }

      // Check if field is populated
      const fieldData = getFieldFromGraph(graph, fieldDef);
      const isPopulated = fieldData !== null && isFieldPopulated(fieldData);

      if (isPopulated) {
        populatedFields++;
        sectionPopulated++;

        if (fieldDef.critical) {
          criticalPopulated++;
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

        // Get confidence from provenance
        const confidence = getFieldConfidence(fieldData);
        if (confidence !== null) {
          totalConfidence += confidence * 100;
          confidenceCount++;
        }
      } else if (fieldDef.critical) {
        missingCriticalFields.push(fieldDef);
      }
    }

    // Calculate section scores
    const sectionCompleteness = sectionFields.filter(f => !f.deprecated).length > 0
      ? Math.round((sectionPopulated / sectionFields.filter(f => !f.deprecated).length) * 100)
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
      totalFields: sectionFields.filter(f => !f.deprecated).length,
      populatedFields: sectionPopulated,
      criticalFields: sectionCritical,
      criticalPopulated: sectionCriticalPopulated,
      staleFields: sectionStale,
    });
  }

  // Calculate global scores
  const completenessScore = totalFields > 0
    ? Math.round((populatedFields / totalFields) * 100)
    : 0;

  const criticalCoverageScore = criticalFields > 0
    ? Math.round((criticalPopulated / criticalFields) * 100)
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
      totalFields,
      populatedFields,
      criticalFields,
      criticalPopulated,
      staleFields,
      averageConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 100,
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
function getFieldConfidence(field: WithMetaType<unknown> | null): number | null {
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
