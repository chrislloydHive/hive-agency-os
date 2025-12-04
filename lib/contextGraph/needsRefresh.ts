// lib/contextGraph/needsRefresh.ts
// Needs Refresh Detection (Phase 2)
//
// Identifies fields and domains that need fresh data collection.
// Provides actionable refresh recommendations for the system.

import type { CompanyContextGraph } from './companyContextGraph';
import type { WithMetaType } from './types';
import { getFieldFreshness, getGraphFreshnessReport, type FreshnessScore } from './freshness';

// ============================================================================
// Refresh Flag Types
// ============================================================================

/**
 * Priority level for refresh
 */
export type RefreshPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Single field refresh recommendation
 */
export interface FieldRefreshFlag {
  /** Domain name */
  domain: string;
  /** Field name within domain */
  field: string;
  /** Current freshness score */
  freshnessScore: number;
  /** How urgent the refresh is */
  priority: RefreshPriority;
  /** Days since last update */
  daysSinceUpdate: number;
  /** Recommended source(s) to refresh from */
  recommendedSources: string[];
  /** Human-readable reason */
  reason: string;
}

/**
 * Domain-level refresh recommendation
 */
export interface DomainRefreshFlag {
  /** Domain name */
  domain: string;
  /** Number of fields needing refresh */
  staleFieldCount: number;
  /** Overall domain freshness */
  domainFreshness: number;
  /** Priority based on domain importance and staleness */
  priority: RefreshPriority;
  /** Fields that need refresh */
  fields: FieldRefreshFlag[];
  /** Recommended diagnostic tool to run */
  recommendedTool: string | null;
}

/**
 * Complete refresh report for a context graph
 */
export interface NeedsRefreshReport {
  /** Company ID */
  companyId: string;
  /** Overall refresh status */
  overallStatus: 'current' | 'needs_refresh' | 'urgent_refresh';
  /** Total number of fields needing refresh */
  totalStaleFields: number;
  /** Domain-level recommendations */
  domains: DomainRefreshFlag[];
  /** Top priority fields to refresh */
  topPriorityFields: FieldRefreshFlag[];
  /** Recommended actions in priority order */
  recommendedActions: RefreshAction[];
  /** When this report was generated */
  generatedAt: string;
}

/**
 * Actionable refresh recommendation
 */
export interface RefreshAction {
  /** Action type */
  type: 'run_diagnostic' | 'request_user_input' | 'fetch_analytics' | 'schedule_review';
  /** Priority */
  priority: RefreshPriority;
  /** Description of what to do */
  description: string;
  /** Tool or source to use */
  tool: string;
  /** Domains this will refresh */
  affectedDomains: string[];
  /** Estimated fields that will be refreshed */
  estimatedFieldCount: number;
}

// ============================================================================
// Domain to Tool Mapping
// ============================================================================

/**
 * Map domains to their primary diagnostic tools
 */
const DOMAIN_TOOL_MAP: Record<string, string> = {
  identity: 'brain',
  objectives: 'brain',
  audience: 'brain',
  budgetOps: 'media_profile',
  performanceMedia: 'media_cockpit',
  digitalInfra: 'ops_lab',
  brand: 'brand_lab',
  content: 'content_lab',
  seo: 'seo_lab',
  website: 'website_lab',
  ops: 'ops_lab',
  storeRisk: 'demand_lab',
};

/**
 * Map tools to human-readable names
 */
const TOOL_NAMES: Record<string, string> = {
  brain: 'Client Brain',
  gap_ia: 'GAP Initial Assessment',
  gap_full: 'Full GAP Report',
  gap_heavy: 'GAP Heavy Analysis',
  website_lab: 'Website Lab',
  brand_lab: 'Brand Lab',
  content_lab: 'Content Lab',
  seo_lab: 'SEO Lab',
  demand_lab: 'Demand Lab',
  ops_lab: 'Ops Lab',
  media_profile: 'Media Profile',
  media_lab: 'Media Lab',
  media_cockpit: 'Media Cockpit',
  analytics_ga4: 'GA4 Analytics',
  analytics_gads: 'Google Ads',
};

// ============================================================================
// Priority Calculation
// ============================================================================

/**
 * Calculate refresh priority based on freshness and domain importance
 */
function calculatePriority(
  freshnessScore: number,
  domainImportance: number = 1.0
): RefreshPriority {
  // Adjust threshold based on domain importance
  const adjustedScore = freshnessScore / domainImportance;

  if (adjustedScore <= 0 || freshnessScore <= 0.1) {
    return 'critical';
  } else if (adjustedScore < 0.3 || freshnessScore < 0.25) {
    return 'high';
  } else if (adjustedScore < 0.5 || freshnessScore < 0.5) {
    return 'medium';
  } else {
    return 'low';
  }
}

/**
 * Domain importance weights (for prioritization)
 */
const DOMAIN_IMPORTANCE: Record<string, number> = {
  objectives: 1.3,      // Critical for planning
  performanceMedia: 1.3, // Critical for optimization
  identity: 1.2,        // Core company info
  budgetOps: 1.2,       // Budget decisions
  audience: 1.1,        // Targeting
  digitalInfra: 1.0,    // Technical setup
  seo: 0.9,
  website: 0.9,
  brand: 0.9,
  content: 0.8,
  ops: 0.8,
  storeRisk: 0.7,
};

// ============================================================================
// Main Detection Functions
// ============================================================================

/**
 * Get recommended sources for refreshing a field
 */
function getRecommendedSources(domain: string, field: string): string[] {
  const primaryTool = DOMAIN_TOOL_MAP[domain];
  const sources: string[] = [];

  if (primaryTool) {
    sources.push(primaryTool);
  }

  // Add secondary sources based on field type
  if (field.includes('budget') || field.includes('spend')) {
    sources.push('media_profile');
  }
  if (field.includes('performance') || field.includes('cpa') || field.includes('roas')) {
    sources.push('media_cockpit', 'analytics_gads');
  }
  if (field.includes('traffic') || field.includes('conversion')) {
    sources.push('analytics_ga4');
  }

  return [...new Set(sources)]; // Dedupe
}

/**
 * Build refresh flags for a single domain
 */
function buildDomainRefreshFlags(
  domainName: string,
  domain: Record<string, WithMetaType<unknown>>,
  staleThreshold: number = 0.5
): DomainRefreshFlag | null {
  const fields: FieldRefreshFlag[] = [];
  let totalFreshness = 0;
  let fieldCount = 0;

  for (const [fieldName, field] of Object.entries(domain)) {
    if (!field || typeof field !== 'object' || !('provenance' in field)) {
      continue;
    }

    const freshness = getFieldFreshness(field as WithMetaType<unknown>);
    if (!freshness) continue;

    fieldCount++;
    totalFreshness += freshness.score;

    if (freshness.score < staleThreshold) {
      const importance = DOMAIN_IMPORTANCE[domainName] ?? 1.0;

      fields.push({
        domain: domainName,
        field: fieldName,
        freshnessScore: freshness.score,
        priority: calculatePriority(freshness.score, importance),
        daysSinceUpdate: freshness.ageDays,
        recommendedSources: getRecommendedSources(domainName, fieldName),
        reason: freshness.label === 'expired'
          ? `Field expired ${Math.round(freshness.ageDays)} days ago`
          : `Field is ${freshness.label} (${Math.round(freshness.score * 100)}% fresh)`,
      });
    }
  }

  if (fields.length === 0) {
    return null;
  }

  const domainFreshness = fieldCount > 0 ? totalFreshness / fieldCount : 0;
  const importance = DOMAIN_IMPORTANCE[domainName] ?? 1.0;

  // Sort fields by priority
  fields.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return {
    domain: domainName,
    staleFieldCount: fields.length,
    domainFreshness,
    priority: calculatePriority(domainFreshness, importance),
    fields,
    recommendedTool: DOMAIN_TOOL_MAP[domainName] || null,
  };
}

/**
 * Generate refresh actions from domain flags
 */
function generateRefreshActions(
  domainFlags: DomainRefreshFlag[]
): RefreshAction[] {
  const actions: RefreshAction[] = [];
  const toolDomainMap = new Map<string, DomainRefreshFlag[]>();

  // Group domains by their recommended tool
  for (const df of domainFlags) {
    if (df.recommendedTool) {
      const existing = toolDomainMap.get(df.recommendedTool) || [];
      existing.push(df);
      toolDomainMap.set(df.recommendedTool, existing);
    }
  }

  // Create actions for each tool
  for (const [tool, domains] of toolDomainMap) {
    const totalFields = domains.reduce((sum, d) => sum + d.staleFieldCount, 0);
    const highestPriority = domains.reduce(
      (best, d) => {
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        return order[d.priority] < order[best] ? d.priority : best;
      },
      'low' as RefreshPriority
    );

    let actionType: RefreshAction['type'];
    if (tool === 'brain') {
      actionType = 'request_user_input';
    } else if (tool.startsWith('analytics_')) {
      actionType = 'fetch_analytics';
    } else {
      actionType = 'run_diagnostic';
    }

    actions.push({
      type: actionType,
      priority: highestPriority,
      description: `Run ${TOOL_NAMES[tool] || tool} to refresh ${totalFields} stale fields`,
      tool,
      affectedDomains: domains.map((d) => d.domain),
      estimatedFieldCount: totalFields,
    });
  }

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return actions;
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Generate a complete "needs refresh" report for a context graph
 *
 * @param graph - The context graph to analyze
 * @param staleThreshold - Freshness score below which a field is considered stale
 * @returns Comprehensive refresh report
 */
export function getNeedsRefreshReport(
  graph: CompanyContextGraph,
  staleThreshold: number = 0.5
): NeedsRefreshReport {
  const domainFlags: DomainRefreshFlag[] = [];
  const allFields: FieldRefreshFlag[] = [];

  // Check each domain
  const domainNames = [
    'identity',
    'objectives',
    'audience',
    'budgetOps',
    'performanceMedia',
    'digitalInfra',
    'brand',
    'content',
    'seo',
    'website',
    'ops',
    'storeRisk',
  ];

  for (const domainName of domainNames) {
    const domain = graph[domainName as keyof CompanyContextGraph];
    if (!domain || typeof domain !== 'object') continue;

    const flags = buildDomainRefreshFlags(
      domainName,
      domain as Record<string, WithMetaType<unknown>>,
      staleThreshold
    );

    if (flags) {
      domainFlags.push(flags);
      allFields.push(...flags.fields);
    }
  }

  // Sort domains by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  domainFlags.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Get top priority fields
  allFields.sort((a, b) => {
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pDiff !== 0) return pDiff;
    return a.freshnessScore - b.freshnessScore;
  });
  const topPriorityFields = allFields.slice(0, 10);

  // Generate actions
  const recommendedActions = generateRefreshActions(domainFlags);

  // Determine overall status
  const criticalCount = domainFlags.filter((d) => d.priority === 'critical').length;
  const highCount = domainFlags.filter((d) => d.priority === 'high').length;

  let overallStatus: NeedsRefreshReport['overallStatus'];
  if (criticalCount > 0) {
    overallStatus = 'urgent_refresh';
  } else if (highCount > 0 || allFields.length > 10) {
    overallStatus = 'needs_refresh';
  } else {
    overallStatus = 'current';
  }

  return {
    companyId: graph.companyId,
    overallStatus,
    totalStaleFields: allFields.length,
    domains: domainFlags,
    topPriorityFields,
    recommendedActions,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Quick check if a graph needs refresh (without full report)
 */
export function needsRefresh(
  graph: CompanyContextGraph,
  staleThreshold: number = 0.5
): boolean {
  const report = getGraphFreshnessReport(graph);
  return report.summary.staleFields > 0 || report.overallScore < staleThreshold;
}

/**
 * Get fields that are critically stale (expired or very low freshness)
 */
export function getCriticallyStaleFields(
  graph: CompanyContextGraph
): FieldRefreshFlag[] {
  const report = getNeedsRefreshReport(graph, 0.25);
  return report.topPriorityFields.filter(
    (f) => f.priority === 'critical' || f.priority === 'high'
  );
}

/**
 * Check if a specific domain needs refresh
 */
export function domainNeedsRefresh(
  graph: CompanyContextGraph,
  domainName: keyof CompanyContextGraph,
  staleThreshold: number = 0.5
): boolean {
  const domain = graph[domainName];
  if (!domain || typeof domain !== 'object') return false;

  const flags = buildDomainRefreshFlags(
    domainName as string,
    domain as Record<string, WithMetaType<unknown>>,
    staleThreshold
  );

  return flags !== null && flags.staleFieldCount > 0;
}
