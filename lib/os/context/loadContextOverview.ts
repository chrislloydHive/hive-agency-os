// lib/os/context/loadContextOverview.ts
// Loader for Context Overview data used in Context Header
//
// Given a companyId, returns:
// - health: ContextHealth
// - counts of fields by domain/status
// - flags for missing/critical domains

import { loadContextGraph } from '@/lib/contextGraph/storage';
import { computeContextHealthScore } from '@/lib/contextGraph/health';
import { flattenGraphToFields } from '@/lib/contextGraph/uiHelpers';
import { DOMAIN_NAMES, type DomainName } from '@/lib/contextGraph/companyContextGraph';
import type { ContextHealth } from './types';

// ============================================================================
// Types
// ============================================================================

export interface DomainStats {
  domain: DomainName;
  label: string;
  totalFields: number;
  populatedFields: number;
  completeness: number;
  hasIssues: boolean;
  isCritical: boolean;
}

export interface ContextOverview {
  /** Overall context health */
  health: ContextHealth;
  /** Whether the company has a context graph */
  hasGraph: boolean;
  /** Total fields across all domains */
  totalFields: number;
  /** Total populated fields */
  populatedFields: number;
  /** Fields by status */
  fieldsByStatus: {
    ok: number;
    stale: number;
    lowConfidence: number;
    conflicted: number;
    missing: number;
  };
  /** Per-domain statistics */
  domainStats: DomainStats[];
  /** Domains with critical issues (needs attention) */
  criticalDomains: DomainName[];
  /** Missing critical fields */
  missingCriticalFields: string[];
  /** When the overview was computed */
  computedAt: string;
}

// ============================================================================
// Domain Labels
// ============================================================================

const DOMAIN_LABELS: Record<DomainName, string> = {
  identity: 'Identity',
  brand: 'Brand',
  objectives: 'Objectives',
  audience: 'Audience',
  productOffer: 'Product/Offer',
  digitalInfra: 'Digital Infrastructure',
  website: 'Website',
  content: 'Content',
  seo: 'SEO',
  ops: 'Operations',
  performanceMedia: 'Performance Media',
  historical: 'Historical',
  creative: 'Creative',
  competitive: 'Competitive',
  budgetOps: 'Budget & Ops',
  operationalConstraints: 'Constraints',
  storeRisk: 'Store Risk',
  historyRefs: 'History References',
  social: 'Social',
  capabilities: 'Capabilities',
};

// Critical domains that need attention if incomplete
const CRITICAL_DOMAINS: DomainName[] = ['identity', 'brand', 'audience', 'objectives'];

// ============================================================================
// Main Loader
// ============================================================================

/**
 * Load context overview for a company
 *
 * @param companyId - The company ID to load overview for
 * @returns ContextOverview with health, domain stats, and critical flags
 */
export async function loadContextOverview(companyId: string): Promise<ContextOverview> {
  // Load context graph
  const graph = await loadContextGraph(companyId);

  // Compute health score
  const healthResult = await computeContextHealthScore(companyId);

  // Convert to ContextHealth type
  const health: ContextHealth = {
    overallScore: healthResult.overallScore,
    completenessScore: healthResult.completenessScore,
    freshnessScore: healthResult.freshnessScore,
    consistencyScore: 100 - (healthResult.missingCriticalFields?.length || 0) * 10,
    confidenceScore: healthResult.criticalCoverageScore,
    conflictCount: 0, // TODO: Track conflicts
    staleFieldCount: healthResult.sectionScores?.filter(s => s.completeness < 50).length || 0,
    missingCriticalCount: healthResult.missingCriticalFields?.length || 0,
    checkedAt: new Date().toISOString(),
  };

  if (!graph) {
    // No graph exists
    return {
      health,
      hasGraph: false,
      totalFields: 0,
      populatedFields: 0,
      fieldsByStatus: {
        ok: 0,
        stale: 0,
        lowConfidence: 0,
        conflicted: 0,
        missing: 0,
      },
      domainStats: DOMAIN_NAMES.map(domain => ({
        domain,
        label: DOMAIN_LABELS[domain],
        totalFields: 0,
        populatedFields: 0,
        completeness: 0,
        hasIssues: CRITICAL_DOMAINS.includes(domain),
        isCritical: CRITICAL_DOMAINS.includes(domain),
      })),
      criticalDomains: CRITICAL_DOMAINS,
      missingCriticalFields: healthResult.missingCriticalFields?.map(f => f.path) || [],
      computedAt: new Date().toISOString(),
    };
  }

  // Flatten graph to fields
  const fields = flattenGraphToFields(graph);

  // Calculate field counts by status
  let okCount = 0;
  let staleCount = 0;
  const lowConfidenceCount = 0;
  const conflictedCount = 0;
  let missingCount = 0;

  for (const field of fields) {
    if (!field.value) {
      missingCount++;
    } else if (field.freshness && field.freshness.normalized < 0.5) {
      staleCount++;
    } else {
      okCount++;
    }
  }

  // Calculate per-domain stats
  const domainStats: DomainStats[] = [];
  const fieldsByDomain = new Map<DomainName, typeof fields>();

  for (const field of fields) {
    const domain = field.domain as DomainName;
    if (!fieldsByDomain.has(domain)) {
      fieldsByDomain.set(domain, []);
    }
    fieldsByDomain.get(domain)!.push(field);
  }

  for (const domain of DOMAIN_NAMES) {
    const domainFields = fieldsByDomain.get(domain) || [];
    const populatedFields = domainFields.filter(f => f.value != null && f.value !== '').length;
    const totalFields = domainFields.length;
    const completeness = totalFields > 0 ? Math.round((populatedFields / totalFields) * 100) : 0;
    const hasIssues = completeness < 50 || domainFields.some(f => f.freshness && f.freshness.normalized < 0.5);

    domainStats.push({
      domain,
      label: DOMAIN_LABELS[domain],
      totalFields,
      populatedFields,
      completeness,
      hasIssues,
      isCritical: CRITICAL_DOMAINS.includes(domain),
    });
  }

  // Identify critical domains with issues
  const criticalDomains = domainStats
    .filter(d => d.isCritical && d.hasIssues)
    .map(d => d.domain);

  return {
    health,
    hasGraph: true,
    totalFields: fields.length,
    populatedFields: fields.filter(f => f.value != null && f.value !== '').length,
    fieldsByStatus: {
      ok: okCount,
      stale: staleCount,
      lowConfidence: lowConfidenceCount,
      conflicted: conflictedCount,
      missing: missingCount,
    },
    domainStats,
    criticalDomains,
    missingCriticalFields: healthResult.missingCriticalFields?.map(f => f.path) || [],
    computedAt: new Date().toISOString(),
  };
}
