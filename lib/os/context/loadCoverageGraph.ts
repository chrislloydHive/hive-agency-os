// lib/os/context/loadCoverageGraph.ts
// Coverage Graph Loader for Context Coverage View
//
// Returns cluster-ready data for the bubble map visualization showing:
// - Nodes colored by status (healthy, lowConfidence, conflict, missing, stale)
// - Nodes sized by importance
// - Domain summaries with completeness metrics

import { loadContextGraph } from '@/lib/contextGraph/storage';
import { computeContextHealthScore } from '@/lib/contextGraph/health';
import { flattenGraphToFields, type GraphFieldUi } from '@/lib/contextGraph/uiHelpers';
import { DOMAIN_NAMES, type DomainName } from '@/lib/contextGraph/companyContextGraph';
import { checkContextIntegrity } from './graphIntegrity';
import type { ContextHealth, MissingField } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Node status for coverage visualization
 */
export type CoverageNodeStatus = 'healthy' | 'lowConfidence' | 'conflict' | 'missing' | 'stale';

/**
 * A node in the coverage graph
 */
export interface CoverageNode {
  /** Unique identifier (field path) */
  id: string;
  /** Human-readable label */
  label: string;
  /** Domain this field belongs to */
  domain: DomainName;
  /** Current status */
  status: CoverageNodeStatus;
  /** Confidence score (0-1) */
  confidence: number;
  /** Freshness score (0-1) */
  freshness: number;
  /** Importance level (1-5) */
  importance: number;
  /** Current value (for tooltip) */
  value?: string | null;
  /** Whether this is a ghost node (missing but referenced) */
  isGhost: boolean;
  /** Source of the value */
  source?: string;
}

/**
 * Summary for a domain cluster
 */
export interface CoverageDomainSummary {
  /** Domain identifier */
  domain: DomainName;
  /** Human-readable label */
  label: string;
  /** Completeness percentage (0-1) */
  completeness: number;
  /** Freshness percentage (0-1) */
  fresh: number;
  /** Number of critical issues */
  criticalIssues: number;
  /** Total fields in domain */
  totalFields: number;
  /** Populated fields in domain */
  populatedFields: number;
}

/**
 * Complete coverage graph for visualization
 */
export interface CoverageGraph {
  /** All nodes in the graph */
  nodes: CoverageNode[];
  /** Domain summaries */
  domains: CoverageDomainSummary[];
  /** Overall health metrics */
  overallHealth: ContextHealth;
}

// ============================================================================
// Domain Labels and Importance
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

// Field importance mappings (default is 3)
const FIELD_IMPORTANCE: Record<string, number> = {
  // Critical fields (5)
  'identity.companyName': 5,
  'identity.industry': 5,
  'identity.websiteUrl': 5,
  'brand.valueProposition': 5,
  'audience.primaryIcp': 5,
  'objectives.primaryGoals': 5,

  // High importance (4)
  'identity.yearFounded': 4,
  'identity.employeeCount': 4,
  'brand.brandVoice': 4,
  'brand.visualIdentity': 4,
  'audience.segments': 4,
  'objectives.kpis': 4,
  'website.primaryUrl': 4,
  'seo.targetKeywords': 4,
  'competitive.topCompetitors': 4,

  // Medium-high (3) - default
  // Most fields fall here

  // Lower importance (2)
  'historical.previousCampaigns': 2,
  'historyRefs.legacyData': 2,

  // Lowest importance (1)
  'storeRisk.riskNotes': 1,
};

// ============================================================================
// Helper Functions
// ============================================================================

function getFieldImportance(path: string): number {
  // Check exact match
  if (FIELD_IMPORTANCE[path]) {
    return FIELD_IMPORTANCE[path];
  }

  // Check domain-level defaults
  const domain = path.split('.')[0];
  const domainImportance: Record<string, number> = {
    identity: 4,
    brand: 4,
    audience: 4,
    objectives: 4,
    website: 3,
    seo: 3,
    competitive: 3,
    content: 3,
    performanceMedia: 3,
    digitalInfra: 3,
    ops: 2,
    creative: 2,
    budgetOps: 2,
    historical: 2,
    operationalConstraints: 2,
    storeRisk: 2,
    historyRefs: 1,
    social: 3,
    productOffer: 3,
  };

  return domainImportance[domain] || 3;
}

function fieldToStatus(field: GraphFieldUi): CoverageNodeStatus {
  if (!field.value && field.value !== '0' && field.value !== 'false') {
    return 'missing';
  }
  if (field.freshness && field.freshness.normalized < 0.5) {
    return 'stale';
  }
  // TODO: Check for conflicts from integrity engine
  return 'healthy';
}

function fieldToNode(field: GraphFieldUi): CoverageNode {
  const status = fieldToStatus(field);
  const importance = getFieldImportance(field.path);
  const freshnessValue = field.freshness?.normalized ?? 0.9;
  // Extract source from provenance if available
  const source = field.provenance?.[0]?.source;

  return {
    id: field.path,
    label: field.label || field.path.split('.').pop() || field.path,
    domain: field.domain as DomainName,
    status,
    confidence: 0.8, // Default confidence
    freshness: freshnessValue,
    importance,
    value: field.value,
    isGhost: false,
    source,
  };
}

function createGhostNode(missingField: MissingField): CoverageNode {
  const domain = missingField.fieldPath.split('.')[0] as DomainName;
  const importanceMap: Record<string, number> = {
    critical: 5,
    high: 4,
    medium: 3,
    low: 2,
  };

  return {
    id: missingField.fieldPath,
    label: missingField.displayName,
    domain: DOMAIN_NAMES.includes(domain) ? domain : 'identity',
    status: 'missing',
    confidence: 0,
    freshness: 0,
    importance: importanceMap[missingField.importance] || 3,
    value: null,
    isGhost: true,
  };
}

// ============================================================================
// Main Loader
// ============================================================================

/**
 * Load coverage graph for a company
 *
 * @param companyId - The company ID to load coverage for
 * @returns CoverageGraph with nodes, domain summaries, and health metrics
 */
export async function loadCoverageGraph(companyId: string): Promise<CoverageGraph> {
  // Load context graph
  const graph = await loadContextGraph(companyId);

  // Compute health score
  const healthResult = await computeContextHealthScore(companyId);

  // Convert to ContextHealth type
  const overallHealth: ContextHealth = {
    overallScore: healthResult.overallScore,
    completenessScore: healthResult.completenessScore,
    freshnessScore: healthResult.freshnessScore,
    consistencyScore: 100,
    confidenceScore: healthResult.criticalCoverageScore,
    conflictCount: 0,
    staleFieldCount: healthResult.sectionScores?.filter(s => s.completeness < 50).length || 0,
    missingCriticalCount: healthResult.missingCriticalFields?.length || 0,
    checkedAt: new Date().toISOString(),
  };

  if (!graph) {
    // Return empty graph with ghost nodes for critical fields
    const ghostNodes: CoverageNode[] = (healthResult.missingCriticalFields || []).map(f => ({
      id: f.path,
      label: f.label || f.path,
      domain: (f.path.split('.')[0] as DomainName) || 'identity',
      status: 'missing' as CoverageNodeStatus,
      confidence: 0,
      freshness: 0,
      importance: 5,
      value: null,
      isGhost: true,
    }));

    return {
      nodes: ghostNodes,
      domains: DOMAIN_NAMES.map(domain => ({
        domain,
        label: DOMAIN_LABELS[domain],
        completeness: 0,
        fresh: 0,
        criticalIssues: domain === 'identity' || domain === 'brand' ? 1 : 0,
        totalFields: 0,
        populatedFields: 0,
      })),
      overallHealth,
    };
  }

  // Flatten graph to fields
  const fields = flattenGraphToFields(graph);

  // Convert fields to nodes
  const nodes: CoverageNode[] = fields.map(fieldToNode);

  // Add ghost nodes for missing critical fields
  const existingIds = new Set(nodes.map(n => n.id));
  for (const missing of healthResult.missingCriticalFields || []) {
    if (!existingIds.has(missing.path)) {
      nodes.push({
        id: missing.path,
        label: missing.label || missing.path.split('.').pop() || missing.path,
        domain: (missing.path.split('.')[0] as DomainName) || 'identity',
        status: 'missing',
        confidence: 0,
        freshness: 0,
        importance: 5,
        value: null,
        isGhost: true,
      });
    }
  }

  // Calculate domain summaries
  const domainFieldsMap = new Map<DomainName, CoverageNode[]>();
  for (const node of nodes) {
    if (!domainFieldsMap.has(node.domain)) {
      domainFieldsMap.set(node.domain, []);
    }
    domainFieldsMap.get(node.domain)!.push(node);
  }

  const domains: CoverageDomainSummary[] = DOMAIN_NAMES.map(domain => {
    const domainNodes = domainFieldsMap.get(domain) || [];
    const populatedNodes = domainNodes.filter(n => n.status !== 'missing');
    const freshNodes = domainNodes.filter(n => n.status === 'healthy');
    const criticalIssues = domainNodes.filter(n =>
      n.status === 'missing' && n.importance >= 4
    ).length;

    return {
      domain,
      label: DOMAIN_LABELS[domain],
      completeness: domainNodes.length > 0 ? populatedNodes.length / domainNodes.length : 0,
      fresh: domainNodes.length > 0 ? freshNodes.length / domainNodes.length : 0,
      criticalIssues,
      totalFields: domainNodes.length,
      populatedFields: populatedNodes.length,
    };
  });

  return {
    nodes,
    domains,
    overallHealth,
  };
}
