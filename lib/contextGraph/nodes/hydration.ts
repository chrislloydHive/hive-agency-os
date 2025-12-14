// lib/contextGraph/nodes/hydration.ts
// Hydration layer for ContextNodes
//
// Combines canonical context graph fields with pending proposals
// to create a unified view for the UI to render.
//
// CANONICALIZATION: Filters out removed fields and deprecated domains
// during hydration to prevent them from appearing in the UI.

import type { CompanyContextGraph } from '../companyContextGraph';
import { isCanonicalKey } from '../canonicalFilter';
import type { ProvenanceTag } from '../types';

/**
 * A context field with value and provenance
 * (Local type alias matching the WithMeta pattern from companyContextGraph)
 */
interface ContextField<T = unknown> {
  value: T | null;
  provenance?: ProvenanceTag[];
}
import type { ContextNode, ContextNodeStatus, ContextProposal } from './types';
import { mapContextSourceToNodeSource } from './types';
import { loadPendingProposals } from './proposalStorage';

// ============================================================================
// Types
// ============================================================================

/**
 * A hydrated context node with optional pending proposal
 */
export interface HydratedContextNode<T = unknown> extends ContextNode<T> {
  /** If there's a pending proposal for this field */
  pendingProposal?: ContextProposal;
  /** The batch ID containing the pending proposal */
  proposalBatchId?: string;
}

/**
 * Map of field paths to hydrated nodes
 */
export type HydratedContextMap = Map<string, HydratedContextNode>;

// ============================================================================
// Field Path Utilities
// ============================================================================

/**
 * Known field paths in the context graph with their labels
 * CANONICALIZATION: Removed objectives, website scores, content scores, seo scores
 */
export const CONTEXT_FIELD_LABELS: Record<string, string> = {
  // Identity
  'identity.businessModel': 'Business Model',
  'identity.businessType': 'Business Type',
  'identity.industry': 'Industry',
  'identity.geographicFootprint': 'Geographic Footprint',
  'identity.marketMaturity': 'Market Stage',
  'identity.yearFounded': 'Year Founded',
  'identity.companySize': 'Company Size',

  // Brand
  'brand.positioning': 'Brand Positioning',
  'brand.tagline': 'Tagline',
  'brand.valueProps': 'Value Propositions',
  'brand.differentiators': 'Differentiators',
  'brand.toneOfVoice': 'Tone of Voice',

  // NOTE: Objectives REMOVED - belongs in Strategy
  // 'objectives.primaryObjective': 'Primary Objective',

  // Audience
  'audience.primaryAudience': 'Primary Audience / ICP',
  'audience.icpDescription': 'ICP Description',
  'audience.coreSegments': 'Core Segments',
  'audience.secondaryAudience': 'Secondary Audience',
  'audience.painPoints': 'Pain Points',
  'audience.demographics': 'Demographics',

  // Product/Offer
  'productOffer.primaryProducts': 'Primary Products/Services',
  'productOffer.priceRange': 'Price Range',
  'productOffer.avgOrderValue': 'Average Order Value',
  'productOffer.salesChannels': 'Sales Channels',
  'productOffer.primaryConversionAction': 'Primary Conversion Action',

  // NOTE: Website/Content/SEO scores REMOVED - belong in Diagnostics
  // 'website.websiteScore': 'Website Score',
  // 'content.contentScore': 'Content Score',
  // 'seo.seoScore': 'SEO Score',

  // Competitive (facts only)
  'competitive.competitors': 'Competitors',
  'competitive.competitorsNotes': 'Competitive Notes',
  // NOTE: synthesized conclusions REMOVED - belong in Strategy/Labs
  // 'competitive.positionSummary': 'Position Summary',

  // Constraints
  'operationalConstraints.minBudget': 'Min Budget',
  'operationalConstraints.maxBudget': 'Max Budget',
  'operationalConstraints.complianceRequirements': 'Compliance Requirements',
  'operationalConstraints.timeline': 'Timeline',

  // Creative
  'creative.brandAssets': 'Brand Assets',

  // Performance Media
  'performanceMedia.activeChannels': 'Active Channels',
  'performanceMedia.totalMonthlySpend': 'Monthly Ad Spend',
};

/**
 * Get a human-readable label for a field path
 */
export function getFieldLabel(fieldPath: string): string {
  return CONTEXT_FIELD_LABELS[fieldPath] || fieldPath.split('.').pop() || fieldPath;
}

// ============================================================================
// Hydration Functions
// ============================================================================

/**
 * Hydrate a single context field into a ContextNode
 */
export function hydrateFieldToNode<T>(
  fieldPath: string,
  field: ContextField<T> | undefined,
  pendingProposal?: ContextProposal,
  proposalBatchId?: string
): HydratedContextNode<T> {
  const category = fieldPath.split('.')[0] || 'unknown';
  const label = getFieldLabel(fieldPath);

  // If no field or no value, create an empty node
  if (!field || field.value === undefined) {
    const emptyNode: HydratedContextNode<T> = {
      key: fieldPath,
      category,
      value: null as unknown as T,
      status: 'proposed',
      source: 'import',
      confidence: 0,
      lastUpdated: new Date().toISOString(),
      provenance: [],
    };

    if (pendingProposal) {
      emptyNode.pendingProposal = pendingProposal;
      emptyNode.proposalBatchId = proposalBatchId;
    }

    return emptyNode;
  }

  // Determine status based on provenance
  const status = determineNodeStatus(field);
  const source = field.provenance?.[0]?.source
    ? mapContextSourceToNodeSource(field.provenance[0].source)
    : 'import';
  const confidence = field.provenance?.[0]?.confidence ?? 1;
  const lastUpdated = field.provenance?.[0]?.updatedAt || new Date().toISOString();

  const node: HydratedContextNode<T> = {
    key: fieldPath,
    category,
    value: field.value as T,
    status,
    source,
    confidence,
    lastUpdated,
    provenance: field.provenance || [],
  };

  // If confirmed, add confirmation details
  if (status === 'confirmed' && field.provenance?.[0]) {
    node.confirmedBy = field.provenance[0].source;
    node.confirmedAt = field.provenance[0].updatedAt;
  }

  // Attach pending proposal if exists
  if (pendingProposal) {
    node.pendingProposal = pendingProposal;
    node.proposalBatchId = proposalBatchId;
  }

  return node;
}

/**
 * Determine node status based on provenance
 * - User/manual sources = confirmed
 * - AI/lab sources = proposed (unless explicitly confirmed)
 */
function determineNodeStatus(field: ContextField<unknown>): ContextNodeStatus {
  if (!field.provenance?.length) {
    return 'proposed';
  }

  const latestProvenance = field.provenance[0];

  // User sources are always confirmed
  // Note: 'user_input' is used by updateContextGraphField when source='user'
  const userSources = ['user', 'user_input', 'manual', 'setup_wizard'];
  if (userSources.includes(latestProvenance.source)) {
    return 'confirmed';
  }

  // All other sources are considered proposed
  return 'proposed';
}

/**
 * Fields to hide from the Context Map UI
 * These are metadata, internal scoring, legacy aliases, or raw structured objects
 * that have user-friendly equivalents
 */
const HIDDEN_CONTEXT_FIELDS = new Set([
  // Metadata fields (internal tracking)
  'competitive.dataConfidence',
  'competitive.lastValidatedAt',

  // Legacy aliases (duplicate of other fields)
  'competitive.primaryCompetitors',  // alias for competitors
  'competitive.positioningSummary',  // alias for positionSummary

  // Raw structured objects (have user-friendly string equivalents)
  'competitive.positioningAxes',     // primaryAxis/secondaryAxis strings are friendlier

  // Other internal/deprecated fields
  'competitive.ownPositionPrimary',
  'competitive.ownPositionSecondary',
]);

/**
 * Field name suffixes that indicate internal/metadata fields to hide
 */
const HIDDEN_FIELD_SUFFIXES = [
  'dataConfidence',
  'lastValidatedAt',
  'lastRefreshedAt',
];

/**
 * Check if a field path should be hidden from the Context Map
 * CANONICALIZATION: Uses centralized isCanonicalKey check
 */
function shouldHideField(fieldPath: string): boolean {
  // CANONICALIZATION: Use centralized canonical check
  // This filters out removed fields and deprecated domains
  if (!isCanonicalKey(fieldPath)) {
    return true;
  }

  // Check explicit hidden list (metadata fields, internal fields)
  if (HIDDEN_CONTEXT_FIELDS.has(fieldPath)) {
    return true;
  }

  // Check field name suffixes (internal tracking fields)
  const fieldName = fieldPath.split('.').pop() || '';
  return HIDDEN_FIELD_SUFFIXES.some(suffix => fieldName === suffix);
}

/**
 * Hydrate an entire context graph into a map of ContextNodes
 */
export async function hydrateContextGraph(
  graph: CompanyContextGraph
): Promise<HydratedContextMap> {
  const nodeMap = new Map<string, HydratedContextNode>();

  // Load pending proposals
  const pendingBatches = await loadPendingProposals(graph.companyId);

  // Build a map of fieldPath -> proposal for quick lookup
  const proposalMap = new Map<string, { proposal: ContextProposal; batchId: string }>();
  for (const batch of pendingBatches) {
    for (const proposal of batch.proposals) {
      if (proposal.status === 'pending') {
        proposalMap.set(proposal.fieldPath, { proposal, batchId: batch.id });
      }
    }
  }

  // Hydrate each domain
  const domains = [
    'identity', 'brand', 'objectives', 'audience', 'productOffer',
    'digitalInfra', 'website', 'content', 'seo', 'ops',
    'performanceMedia', 'historical', 'creative', 'competitive',
    'budgetOps', 'operationalConstraints', 'storeRisk', 'historyRefs',
  ] as const;

  for (const domain of domains) {
    const domainData = (graph as any)[domain];
    if (!domainData || typeof domainData !== 'object') continue;

    for (const [fieldKey, fieldValue] of Object.entries(domainData)) {
      // Skip non-field entries (like nested objects without value/provenance)
      if (!fieldValue || typeof fieldValue !== 'object') continue;
      if (!('value' in (fieldValue as object)) && !('provenance' in (fieldValue as object))) continue;

      const fieldPath = `${domain}.${fieldKey}`;

      // Skip hidden/metadata fields
      if (shouldHideField(fieldPath)) {
        continue;
      }

      const proposalData = proposalMap.get(fieldPath);

      const node = hydrateFieldToNode(
        fieldPath,
        fieldValue as ContextField<unknown>,
        proposalData?.proposal,
        proposalData?.batchId
      );

      nodeMap.set(fieldPath, node);
    }
  }

  // Add nodes for proposals on fields that don't exist in the graph yet
  for (const [fieldPath, proposalData] of proposalMap.entries()) {
    if (!nodeMap.has(fieldPath)) {
      const node = hydrateFieldToNode(
        fieldPath,
        undefined,
        proposalData.proposal,
        proposalData.batchId
      );
      nodeMap.set(fieldPath, node);
    }
  }

  return nodeMap;
}

/**
 * Get hydrated nodes for a specific domain
 */
export async function getHydratedDomain(
  graph: CompanyContextGraph,
  domain: string
): Promise<HydratedContextNode[]> {
  const allNodes = await hydrateContextGraph(graph);

  return Array.from(allNodes.values()).filter(
    node => node.category === domain
  );
}

/**
 * Get a single hydrated node by field path
 */
export async function getHydratedNode(
  graph: CompanyContextGraph,
  fieldPath: string
): Promise<HydratedContextNode | null> {
  const allNodes = await hydrateContextGraph(graph);
  return allNodes.get(fieldPath) || null;
}

// ============================================================================
// Summary Functions
// ============================================================================

/**
 * Get summary of pending proposals for a company
 */
export async function getProposalSummary(
  companyId: string
): Promise<{
  totalPending: number;
  byTrigger: Record<string, number>;
  byDomain: Record<string, number>;
  batches: Array<{
    id: string;
    trigger: string;
    proposalCount: number;
    createdAt: string;
  }>;
}> {
  const batches = await loadPendingProposals(companyId);

  const byTrigger: Record<string, number> = {};
  const byDomain: Record<string, number> = {};
  let totalPending = 0;

  for (const batch of batches) {
    for (const proposal of batch.proposals) {
      if (proposal.status === 'pending') {
        totalPending++;

        // Count by trigger
        byTrigger[proposal.trigger] = (byTrigger[proposal.trigger] || 0) + 1;

        // Count by domain
        const domain = proposal.fieldPath.split('.')[0];
        byDomain[domain] = (byDomain[domain] || 0) + 1;
      }
    }
  }

  return {
    totalPending,
    byTrigger,
    byDomain,
    batches: batches.map(b => ({
      id: b.id,
      trigger: b.trigger,
      proposalCount: b.proposals.filter(p => p.status === 'pending').length,
      createdAt: b.createdAt,
    })),
  };
}

/**
 * Get fields that have pending proposals
 */
export async function getFieldsWithPendingProposals(
  companyId: string
): Promise<string[]> {
  const batches = await loadPendingProposals(companyId);

  const fieldPaths = new Set<string>();
  for (const batch of batches) {
    for (const proposal of batch.proposals) {
      if (proposal.status === 'pending') {
        fieldPaths.add(proposal.fieldPath);
      }
    }
  }

  return Array.from(fieldPaths);
}
