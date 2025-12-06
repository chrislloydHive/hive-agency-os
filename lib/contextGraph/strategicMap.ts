// lib/contextGraph/strategicMap.ts
// Transform Context Graph data into a visual Strategic Map representation
//
// Strategic Map 2.0 - Enhanced with:
// - Rich node metadata (scores, criticality, conflicts)
// - Semantic edge types with visual meanings
// - Insight and dependency tracking
// - Support for timeline views and heatmaps

import type { CompanyContextGraph } from './companyContextGraph';
import type { ContextHealthScore, SectionScore } from './health';
import type { ProvenanceTag } from './types';
import { isHumanSource } from './sourcePriority';
import type { ClientInsight, InsightSeverity } from '@/lib/types/clientBrain';

// ============================================================================
// Types
// ============================================================================

/**
 * Domain clusters for the strategic map visualization
 */
export type StrategicMapNodeDomain =
  | 'identity'
  | 'audience'
  | 'brand'
  | 'productOffer'
  | 'competitive'
  | 'website'
  | 'seo'
  | 'content'
  | 'media'
  | 'ops'
  | 'objectives';

/**
 * Conflict types that can affect a node
 */
export interface NodeConflict {
  type: 'inconsistent_data' | 'missing_prerequisite' | 'stale_dependency' | 'circular_reference';
  message: string;
  severity: 'high' | 'medium' | 'low';
  relatedNodeIds: string[];
}

/**
 * A node in the strategic map representing a conceptual cluster
 * Enhanced for Strategic Map 2.0 with rich metadata
 */
export interface StrategicMapNode {
  /** Unique node ID (e.g., "identity.core") */
  id: string;
  /** Human-readable label */
  label: string;
  /** Domain this node belongs to */
  domain: StrategicMapNodeDomain;
  /** Truncated preview of the value */
  valuePreview?: string;
  /** How complete is this node's data */
  completeness: 'empty' | 'partial' | 'full';
  /** Confidence level derived from provenance */
  confidence: 'low' | 'medium' | 'high';
  /** Source type: human, AI, or mixed */
  provenanceKind: 'human' | 'ai' | 'mixed';
  /** Whether this is a critical node in the strategic spine */
  isCritical: boolean;
  /** Section score if available (0-100) */
  score?: number;
  /** Underlying field paths for deep linking */
  fieldPaths: string[];

  // ===== Strategic Map 2.0 Additions =====

  /** Completeness score (0-100) */
  completenessScore: number;
  /** Freshness score (0-100) - how recently updated */
  freshnessScore: number;
  /** Confidence score (0-100) */
  confidenceScore: number;
  /** Source mix breakdown */
  sourceMix: 'human' | 'ai' | 'mixed';
  /** Strategic criticality level */
  criticality: 'high' | 'medium' | 'low';
  /** Number of insights tied to this node */
  insightCount: number;
  /** IDs of insights tied to this node */
  insightIds: string[];
  /** Highest severity among linked insights */
  highestSeverity: InsightSeverity | null;
  /** Number of upstream + downstream connections */
  dependencyCount: number;
  /** Conflict flags for this node */
  conflictFlags: NodeConflict[];
  /** Last updated timestamp */
  lastUpdated?: string;
  /** Whether the node has been pinned to a fixed position */
  isPinned?: boolean;
  /** Custom position if pinned */
  pinnedPosition?: { x: number; y: number };
}

/**
 * Relationship types between nodes
 */
export type StrategicMapEdgeType =
  | 'supports'
  | 'informs'
  | 'contrasts'
  | 'depends_on'
  | 'competes_with';

/**
 * Visual style for edges based on semantic meaning
 */
export type StrategicMapEdgeStyle =
  | 'strong_alignment'   // Both nodes complete & validated
  | 'weak_link'          // Upstream incomplete
  | 'ai_inferred'        // Connection from LLM inference
  | 'human_verified'     // Verified provenance
  | 'gap_link';          // Downstream depends on missing upstream

/**
 * An edge connecting two nodes with semantic meaning
 */
export interface StrategicMapEdge {
  /** Unique edge ID */
  id: string;
  /** Source node ID */
  from: string;
  /** Target node ID */
  to: string;
  /** Relationship type */
  type: StrategicMapEdgeType;
  /** Visual style based on node health */
  style: StrategicMapEdgeStyle;
  /** Edge strength (0-1) based on node completeness */
  strength: number;
  /** Whether this edge was inferred by AI */
  isAIInferred: boolean;
  /** Whether this edge has been human-verified */
  isHumanVerified: boolean;
}

/**
 * Snapshot of the map at a point in time (for timeline view)
 */
export interface StrategicMapSnapshot {
  snapshotId: string;
  timestamp: string;
  reason?: string;
  nodes: StrategicMapNode[];
  edges: StrategicMapEdge[];
  overallScore: number;
}

/**
 * Diff between two snapshots
 */
export interface StrategicMapDiff {
  addedNodes: string[];
  removedNodes: string[];
  changedNodes: Array<{
    nodeId: string;
    changes: {
      field: string;
      from: unknown;
      to: unknown;
    }[];
  }>;
  addedEdges: string[];
  removedEdges: string[];
  scoreDelta: number;
}

/**
 * The complete strategic map graph
 */
export interface StrategicMapGraph {
  nodes: StrategicMapNode[];
  edges: StrategicMapEdge[];
  /** Overall map health score */
  mapScore: number;
  /** Timestamp of data */
  generatedAt: string;
  /** Quick stats for the map */
  stats: {
    totalNodes: number;
    completeNodes: number;
    partialNodes: number;
    emptyNodes: number;
    humanNodes: number;
    aiNodes: number;
    mixedNodes: number;
    criticalNodes: number;
    totalInsights: number;
    totalConflicts: number;
    averageFreshness: number;
  };
}

// ============================================================================
// Node Definitions
// ============================================================================

/**
 * Static definition of conceptual nodes and their field mappings
 */
interface NodeDefinition {
  id: string;
  label: string;
  domain: StrategicMapNodeDomain;
  /** Field paths to check for values */
  fields: string[];
  /** Is this a critical "spine" node */
  isCritical: boolean;
  /** Criticality level for ranking */
  criticality: 'high' | 'medium' | 'low';
  /** Field to use for value preview (first one with value) */
  previewFields: string[];
  /** Expected upstream dependencies */
  upstreamDependencies: string[];
}

const NODE_DEFINITIONS: NodeDefinition[] = [
  // Identity - Foundation
  {
    id: 'identity.core',
    label: 'Company Identity',
    domain: 'identity',
    fields: ['identity.businessName', 'identity.tagline', 'identity.industry', 'identity.businessModel'],
    isCritical: true,
    criticality: 'high',
    previewFields: ['identity.tagline', 'identity.industry'],
    upstreamDependencies: [],
  },
  // Audience - Who we serve
  {
    id: 'audience.icp',
    label: 'Target Audience (ICP)',
    domain: 'audience',
    fields: ['audience.primaryICP', 'audience.audienceSummary', 'audience.segments', 'audience.buyerPersonas'],
    isCritical: true,
    criticality: 'high',
    previewFields: ['audience.primaryICP', 'audience.audienceSummary'],
    upstreamDependencies: ['identity.core'],
  },
  // Brand - How we position
  {
    id: 'brand.positioning',
    label: 'Brand Positioning',
    domain: 'brand',
    fields: ['brand.positioning', 'brand.tagline', 'brand.valueProps', 'brand.differentiators', 'brand.toneOfVoice'],
    isCritical: true,
    criticality: 'high',
    previewFields: ['brand.positioning', 'brand.tagline'],
    upstreamDependencies: ['identity.core', 'audience.icp'],
  },
  // Product/Offer - What we sell
  {
    id: 'productOffer.coreOffers',
    label: 'Core Offerings',
    domain: 'productOffer',
    fields: ['productOffer.primaryOffering', 'productOffer.offerings', 'productOffer.valueProposition', 'productOffer.pricingModel'],
    isCritical: true,
    criticality: 'high',
    previewFields: ['productOffer.primaryOffering', 'productOffer.valueProposition'],
    upstreamDependencies: ['brand.positioning', 'audience.icp'],
  },
  // Competitive - Market position
  {
    id: 'competitive.landscape',
    label: 'Competitive Landscape',
    domain: 'competitive',
    fields: ['competitive.competitors', 'competitive.competitiveAdvantage', 'competitive.marketPosition', 'competitive.primaryAxis'],
    isCritical: true,
    criticality: 'high',
    previewFields: ['competitive.competitiveAdvantage', 'competitive.marketPosition'],
    upstreamDependencies: ['productOffer.coreOffers'],
  },
  // Website - Digital presence
  {
    id: 'website.conversionFlow',
    label: 'Website & Conversion',
    domain: 'website',
    fields: ['website.websiteScore', 'website.websiteSummary', 'website.funnelIssues', 'website.quickWins'],
    isCritical: false,
    criticality: 'medium',
    previewFields: ['website.websiteSummary'],
    upstreamDependencies: ['productOffer.coreOffers'],
  },
  // SEO - Organic reach
  {
    id: 'seo.overall',
    label: 'SEO Health',
    domain: 'seo',
    fields: ['seo.seoScore', 'seo.seoSummary', 'seo.topKeywords', 'seo.technicalIssues'],
    isCritical: false,
    criticality: 'medium',
    previewFields: ['seo.seoSummary'],
    upstreamDependencies: ['content.strategy', 'website.conversionFlow'],
  },
  // Content - Content strategy
  {
    id: 'content.strategy',
    label: 'Content Strategy',
    domain: 'content',
    fields: ['content.contentScore', 'content.contentSummary', 'content.contentPillars', 'content.contentGaps'],
    isCritical: false,
    criticality: 'medium',
    previewFields: ['content.contentSummary'],
    upstreamDependencies: ['audience.icp', 'brand.positioning'],
  },
  // Media - Paid channels
  {
    id: 'media.strategy',
    label: 'Media Strategy',
    domain: 'media',
    fields: ['performanceMedia.mediaMix', 'performanceMedia.keyChannels', 'performanceMedia.mediaBudget', 'performanceMedia.targetRoas'],
    isCritical: false,
    criticality: 'medium',
    previewFields: ['performanceMedia.mediaMix'],
    upstreamDependencies: ['audience.icp', 'productOffer.coreOffers'],
  },
  // Ops - Infrastructure
  {
    id: 'ops.analytics',
    label: 'Analytics & Ops',
    domain: 'ops',
    fields: ['digitalInfra.trackingStackSummary', 'digitalInfra.ga4Health', 'ops.trackingTools', 'ops.opsScore'],
    isCritical: false,
    criticality: 'low',
    previewFields: ['digitalInfra.trackingStackSummary'],
    upstreamDependencies: ['website.conversionFlow'],
  },
  // Objectives - Goals
  {
    id: 'objectives.primary',
    label: 'Business Objectives',
    domain: 'objectives',
    fields: ['objectives.primaryObjective', 'objectives.kpis', 'objectives.growthGoals', 'objectives.conversionGoals'],
    isCritical: true,
    criticality: 'high',
    previewFields: ['objectives.primaryObjective'],
    upstreamDependencies: ['identity.core'],
  },
];

// ============================================================================
// Edge Definitions
// ============================================================================

/**
 * Static edge definitions showing conceptual relationships
 */
interface EdgeDefinition {
  from: string;
  to: string;
  type: StrategicMapEdgeType;
  description?: string;
}

const EDGE_DEFINITIONS: EdgeDefinition[] = [
  // Identity flows
  { from: 'identity.core', to: 'audience.icp', type: 'informs', description: 'Identity shapes who we target' },
  { from: 'identity.core', to: 'brand.positioning', type: 'informs', description: 'Identity informs brand positioning' },
  { from: 'identity.core', to: 'objectives.primary', type: 'informs', description: 'Identity guides objectives' },

  // Audience flows
  { from: 'audience.icp', to: 'productOffer.coreOffers', type: 'informs', description: 'Audience needs shape offers' },
  { from: 'audience.icp', to: 'media.strategy', type: 'informs', description: 'Audience determines channels' },
  { from: 'audience.icp', to: 'content.strategy', type: 'informs', description: 'Audience shapes content' },

  // Brand flows
  { from: 'brand.positioning', to: 'productOffer.coreOffers', type: 'supports', description: 'Brand supports offers' },
  { from: 'brand.positioning', to: 'content.strategy', type: 'informs', description: 'Brand guides content tone' },

  // Product flows
  { from: 'productOffer.coreOffers', to: 'website.conversionFlow', type: 'informs', description: 'Offers drive website' },
  { from: 'productOffer.coreOffers', to: 'media.strategy', type: 'informs', description: 'Offers inform media' },

  // SEO/Content flows
  { from: 'content.strategy', to: 'seo.overall', type: 'supports', description: 'Content supports SEO' },
  { from: 'seo.overall', to: 'website.conversionFlow', type: 'supports', description: 'SEO drives website traffic' },

  // Competitive flows
  { from: 'competitive.landscape', to: 'brand.positioning', type: 'contrasts', description: 'Competition shapes positioning' },
  { from: 'competitive.landscape', to: 'productOffer.coreOffers', type: 'contrasts', description: 'Competition informs differentiation' },

  // Objectives flows
  { from: 'objectives.primary', to: 'media.strategy', type: 'depends_on', description: 'Objectives drive media investment' },
  { from: 'objectives.primary', to: 'content.strategy', type: 'depends_on', description: 'Objectives prioritize content' },

  // Ops/Analytics
  { from: 'website.conversionFlow', to: 'ops.analytics', type: 'depends_on', description: 'Website needs tracking' },
];

// ============================================================================
// Domain Colors & Labels
// ============================================================================

export const DOMAIN_COLORS: Record<StrategicMapNodeDomain, string> = {
  identity: '#3b82f6',      // blue
  audience: '#8b5cf6',      // purple
  brand: '#ec4899',         // pink
  productOffer: '#f59e0b',  // amber
  competitive: '#ef4444',   // red
  website: '#10b981',       // emerald
  seo: '#06b6d4',           // cyan
  content: '#84cc16',       // lime
  media: '#f97316',         // orange
  ops: '#6366f1',           // indigo
  objectives: '#14b8a6',    // teal
};

export const DOMAIN_LABELS: Record<StrategicMapNodeDomain, string> = {
  identity: 'Identity',
  audience: 'Audience',
  brand: 'Brand',
  productOffer: 'Product & Offers',
  competitive: 'Competitive',
  website: 'Website',
  seo: 'SEO',
  content: 'Content',
  media: 'Media',
  ops: 'Ops & Infra',
  objectives: 'Objectives',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a nested value from the graph using dot notation
 */
function getNestedValue(graph: CompanyContextGraph, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = graph;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Extract value and provenance from a WithMeta field
 */
function extractFieldData(field: unknown): { value: unknown; provenance: ProvenanceTag[]; updatedAt?: string } | null {
  if (!field || typeof field !== 'object') return null;

  const f = field as { value?: unknown; provenance?: ProvenanceTag[]; updatedAt?: string };
  if ('value' in f) {
    return {
      value: f.value,
      provenance: f.provenance || [],
      updatedAt: f.updatedAt,
    };
  }

  return null;
}

/**
 * Check if a value is considered "populated"
 */
function isPopulated(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

/**
 * Truncate string for preview
 */
function truncate(str: string, maxLength: number = 80): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Determine provenance kind from provenance tags
 */
function getProvenanceKind(provenances: ProvenanceTag[]): 'human' | 'ai' | 'mixed' {
  if (provenances.length === 0) return 'ai';

  const hasHuman = provenances.some(p => isHumanSource(p.source));
  const hasAi = provenances.some(p => !isHumanSource(p.source));

  if (hasHuman && hasAi) return 'mixed';
  if (hasHuman) return 'human';
  return 'ai';
}

/**
 * Get average confidence from provenance tags
 */
function getAverageConfidence(provenances: ProvenanceTag[]): 'low' | 'medium' | 'high' {
  if (provenances.length === 0) return 'low';

  const avgConfidence = provenances.reduce((sum, p) => sum + (p.confidence || 0), 0) / provenances.length;

  if (avgConfidence >= 0.7) return 'high';
  if (avgConfidence >= 0.4) return 'medium';
  return 'low';
}

/**
 * Get confidence as a numeric score (0-100)
 */
function getConfidenceScore(provenances: ProvenanceTag[]): number {
  if (provenances.length === 0) return 0;
  const avg = provenances.reduce((sum, p) => sum + (p.confidence || 0), 0) / provenances.length;
  return Math.round(avg * 100);
}

/**
 * Get completeness level based on populated field ratio
 */
function getCompleteness(populatedCount: number, totalCount: number): 'empty' | 'partial' | 'full' {
  if (totalCount === 0) return 'empty';
  const ratio = populatedCount / totalCount;

  if (ratio >= 0.75) return 'full';
  if (ratio > 0) return 'partial';
  return 'empty';
}

/**
 * Get completeness as a numeric score (0-100)
 */
function getCompletenessScore(populatedCount: number, totalCount: number): number {
  if (totalCount === 0) return 0;
  return Math.round((populatedCount / totalCount) * 100);
}

/**
 * Calculate freshness score based on last update time
 */
function getFreshnessScore(lastUpdated?: string): number {
  if (!lastUpdated) return 0;

  try {
    const updateDate = new Date(lastUpdated);
    const now = new Date();
    const daysSinceUpdate = Math.floor((now.getTime() - updateDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceUpdate <= 7) return 100;
    if (daysSinceUpdate <= 30) return 80;
    if (daysSinceUpdate <= 90) return 60;
    if (daysSinceUpdate <= 180) return 40;
    return 20;
  } catch {
    return 0;
  }
}

/**
 * Determine edge style based on connected nodes
 */
function getEdgeStyle(
  fromNode: StrategicMapNode | undefined,
  toNode: StrategicMapNode | undefined
): StrategicMapEdgeStyle {
  if (!fromNode || !toNode) return 'weak_link';

  // Check for gap link (downstream depends on empty upstream)
  if (fromNode.completeness === 'empty') {
    return 'gap_link';
  }

  // Check for human verified
  const isVerified = fromNode.provenanceKind === 'human' && toNode.provenanceKind === 'human';
  if (isVerified && fromNode.completeness === 'full' && toNode.completeness === 'full') {
    return 'human_verified';
  }

  // Check for AI inferred
  if (fromNode.provenanceKind === 'ai' || toNode.provenanceKind === 'ai') {
    if (fromNode.completeness !== 'full' || toNode.completeness !== 'full') {
      return 'ai_inferred';
    }
  }

  // Strong alignment if both complete
  if (fromNode.completeness === 'full' && toNode.completeness === 'full') {
    return 'strong_alignment';
  }

  // Default to weak link
  return 'weak_link';
}

/**
 * Calculate edge strength based on node completeness
 */
function getEdgeStrength(fromNode: StrategicMapNode | undefined, toNode: StrategicMapNode | undefined): number {
  if (!fromNode || !toNode) return 0.2;

  const fromScore = fromNode.completenessScore / 100;
  const toScore = toNode.completenessScore / 100;

  return (fromScore + toScore) / 2;
}

/**
 * Detect conflicts for a node based on its dependencies
 */
function detectNodeConflicts(
  node: ReturnType<typeof buildNodeFromDefinition>,
  allNodes: Map<string, ReturnType<typeof buildNodeFromDefinition>>,
  definition: NodeDefinition
): NodeConflict[] {
  const conflicts: NodeConflict[] = [];

  // Check for missing prerequisites
  for (const depId of definition.upstreamDependencies) {
    const depNode = allNodes.get(depId);
    if (!depNode || depNode.completeness === 'empty') {
      conflicts.push({
        type: 'missing_prerequisite',
        message: `Depends on "${depId}" which is incomplete`,
        severity: definition.criticality === 'high' ? 'high' : 'medium',
        relatedNodeIds: [depId],
      });
    }
  }

  // Check for stale dependencies
  for (const depId of definition.upstreamDependencies) {
    const depNode = allNodes.get(depId);
    if (depNode && depNode.freshnessScore < 40) {
      conflicts.push({
        type: 'stale_dependency',
        message: `Upstream node "${depId}" has stale data`,
        severity: 'low',
        relatedNodeIds: [depId],
      });
    }
  }

  return conflicts;
}

/**
 * Build a single node from its definition
 */
function buildNodeFromDefinition(
  def: NodeDefinition,
  graph: CompanyContextGraph | null,
  health: ContextHealthScore | null
): Omit<StrategicMapNode, 'dependencyCount' | 'conflictFlags'> {
  let populatedCount = 0;
  let totalCount = 0;
  let valuePreview: string | undefined;
  const allProvenances: ProvenanceTag[] = [];
  let latestUpdate: string | undefined;

  // Process each field in the node
  for (const fieldPath of def.fields) {
    totalCount++;

    if (graph) {
      const rawField = getNestedValue(graph, fieldPath);
      const fieldData = extractFieldData(rawField);

      if (fieldData && isPopulated(fieldData.value)) {
        populatedCount++;
        allProvenances.push(...fieldData.provenance);

        // Track latest update
        if (fieldData.updatedAt) {
          if (!latestUpdate || new Date(fieldData.updatedAt) > new Date(latestUpdate)) {
            latestUpdate = fieldData.updatedAt;
          }
        }

        // Set preview from first preview field with value
        if (!valuePreview && def.previewFields.includes(fieldPath)) {
          const val = fieldData.value;
          if (typeof val === 'string') {
            valuePreview = truncate(val);
          } else if (typeof val === 'number') {
            valuePreview = `Score: ${val}`;
          } else if (Array.isArray(val) && val.length > 0) {
            valuePreview = `${val.length} items`;
          }
        }
      }
    }
  }

  // Find section score from health data
  let sectionScore: number | undefined;
  if (health?.sectionScores) {
    const sectionId = def.domain === 'ops' ? 'ops' :
                      def.domain === 'media' ? 'media' :
                      def.domain;
    const section = health.sectionScores.find(s => s.section === sectionId);
    if (section) {
      sectionScore = section.completeness;
    }
  }

  const completenessScore = getCompletenessScore(populatedCount, totalCount);
  const confidenceScore = getConfidenceScore(allProvenances);
  const freshnessScore = getFreshnessScore(latestUpdate);
  const provenanceKind = getProvenanceKind(allProvenances);

  return {
    id: def.id,
    label: def.label,
    domain: def.domain,
    valuePreview,
    completeness: getCompleteness(populatedCount, totalCount),
    confidence: getAverageConfidence(allProvenances),
    provenanceKind,
    isCritical: def.isCritical,
    score: sectionScore,
    fieldPaths: def.fields,
    // Strategic Map 2.0 additions
    completenessScore,
    freshnessScore,
    confidenceScore,
    sourceMix: provenanceKind,
    criticality: def.criticality,
    insightCount: 0, // Populated in second pass
    insightIds: [],  // Populated in second pass
    highestSeverity: null, // Populated in second pass
    lastUpdated: latestUpdate,
  };
}

// ============================================================================
// Main Transform Function
// ============================================================================

/**
 * Node insight metadata for enriching map nodes
 */
export interface NodeInsightMetadata {
  insightCount: number;
  insightIds: string[];
  highestSeverity: InsightSeverity | null;
}

/**
 * Severity ranking for comparison
 */
const SEVERITY_RANK: Record<InsightSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/**
 * Map insights to nodes based on contextPaths
 * Returns a map of nodeId -> insight metadata
 */
export function mapInsightsToNodes(
  insights: ClientInsight[],
  nodeDefinitions: NodeDefinition[]
): Record<string, NodeInsightMetadata> {
  const result: Record<string, NodeInsightMetadata> = {};

  // Initialize all nodes with empty metadata
  for (const def of nodeDefinitions) {
    result[def.id] = {
      insightCount: 0,
      insightIds: [],
      highestSeverity: null,
    };
  }

  // Map each insight to its matching nodes
  for (const insight of insights) {
    const contextPaths = insight.contextPaths || [];

    // For each node, check if any of its fields match any insight contextPath
    for (const def of nodeDefinitions) {
      const matchesNode = contextPaths.some(path => {
        // Check if path matches any node field directly
        if (def.fields.includes(path)) return true;

        // Check if path starts with the same domain prefix
        const pathDomain = path.split('.')[0];
        const nodeDomain = def.id.split('.')[0];
        if (pathDomain === nodeDomain) {
          // Check if path is a subpath of any node field
          return def.fields.some(f =>
            path.startsWith(f + '.') || f.startsWith(path + '.')
          );
        }

        // Also match insights by category to domain
        const categoryToNodeId: Record<string, string[]> = {
          brand: ['brand.positioning'],
          audience: ['audience.icp'],
          competitive: ['competitive.landscape'],
          website: ['website.conversionFlow'],
          seo: ['seo.overall'],
          content: ['content.strategy'],
          media: ['media.strategy'],
          ops: ['ops.analytics'],
          product: ['productOffer.coreOffers'],
        };

        const matchingNodeIds = categoryToNodeId[insight.category] || [];
        if (matchingNodeIds.includes(def.id)) return true;

        return false;
      });

      if (matchesNode) {
        result[def.id].insightCount++;
        result[def.id].insightIds.push(insight.id);

        // Update highest severity
        if (insight.severity) {
          const currentRank = result[def.id].highestSeverity
            ? SEVERITY_RANK[result[def.id].highestSeverity!]
            : 0;
          const newRank = SEVERITY_RANK[insight.severity];
          if (newRank > currentRank) {
            result[def.id].highestSeverity = insight.severity;
          }
        }
      }
    }
  }

  return result;
}

/**
 * Build a Strategic Map Graph from the Context Graph and health data
 */
export function buildStrategicMapGraph(
  graph: CompanyContextGraph | null,
  health: ContextHealthScore | null,
  insights?: ClientInsight[]
): StrategicMapGraph {
  const nodesMap = new Map<string, Omit<StrategicMapNode, 'dependencyCount' | 'conflictFlags'>>();

  // First pass: build all nodes
  for (const def of NODE_DEFINITIONS) {
    nodesMap.set(def.id, buildNodeFromDefinition(def, graph, health));
  }

  // Compute insight metadata if insights provided
  const insightMetadata = insights
    ? mapInsightsToNodes(insights, NODE_DEFINITIONS)
    : null;

  // Second pass: add dependency counts, conflicts, and insight metadata
  const nodes: StrategicMapNode[] = [];
  for (const def of NODE_DEFINITIONS) {
    const baseNode = nodesMap.get(def.id)!;

    // Count dependencies (edges connected to this node)
    const dependencyCount = EDGE_DEFINITIONS.filter(
      e => e.from === def.id || e.to === def.id
    ).length;

    // Detect conflicts
    const conflicts = detectNodeConflicts(baseNode as any, nodesMap as any, def);

    // Get insight metadata for this node
    const nodeInsights = insightMetadata?.[def.id];

    nodes.push({
      ...baseNode,
      dependencyCount,
      conflictFlags: conflicts,
      insightCount: nodeInsights?.insightCount || 0,
      insightIds: nodeInsights?.insightIds || [],
      highestSeverity: nodeInsights?.highestSeverity || null,
    });
  }

  // Build edges with semantic styling
  const edges: StrategicMapEdge[] = EDGE_DEFINITIONS.map((edgeDef, i) => {
    const fromNode = nodes.find(n => n.id === edgeDef.from);
    const toNode = nodes.find(n => n.id === edgeDef.to);

    return {
      id: `edge-${i}`,
      from: edgeDef.from,
      to: edgeDef.to,
      type: edgeDef.type,
      style: getEdgeStyle(fromNode, toNode),
      strength: getEdgeStrength(fromNode, toNode),
      isAIInferred: fromNode?.provenanceKind === 'ai' || toNode?.provenanceKind === 'ai',
      isHumanVerified: fromNode?.provenanceKind === 'human' && toNode?.provenanceKind === 'human',
    };
  });

  // Calculate stats
  const stats = {
    totalNodes: nodes.length,
    completeNodes: nodes.filter(n => n.completeness === 'full').length,
    partialNodes: nodes.filter(n => n.completeness === 'partial').length,
    emptyNodes: nodes.filter(n => n.completeness === 'empty').length,
    humanNodes: nodes.filter(n => n.provenanceKind === 'human').length,
    aiNodes: nodes.filter(n => n.provenanceKind === 'ai').length,
    mixedNodes: nodes.filter(n => n.provenanceKind === 'mixed').length,
    criticalNodes: nodes.filter(n => n.isCritical).length,
    totalInsights: nodes.reduce((sum, n) => sum + n.insightCount, 0),
    totalConflicts: nodes.reduce((sum, n) => sum + n.conflictFlags.length, 0),
    averageFreshness: nodes.length > 0
      ? Math.round(nodes.reduce((sum, n) => sum + n.freshnessScore, 0) / nodes.length)
      : 0,
  };

  return {
    nodes,
    edges,
    mapScore: health?.overallScore || 0,
    generatedAt: new Date().toISOString(),
    stats,
  };
}

/**
 * Get node position in a radial/clustered layout
 * Returns x,y coordinates for the node based on its domain
 */
export function getNodePosition(
  node: StrategicMapNode,
  index: number,
  totalNodes: number,
  containerWidth: number,
  containerHeight: number
): { x: number; y: number } {
  // Check for pinned position
  if (node.isPinned && node.pinnedPosition) {
    return node.pinnedPosition;
  }

  // Domain positions in a conceptual layout
  // Identity at top, flowing down to objectives
  const domainPositions: Record<StrategicMapNodeDomain, { x: number; y: number }> = {
    identity: { x: 0.5, y: 0.08 },
    audience: { x: 0.25, y: 0.25 },
    brand: { x: 0.75, y: 0.25 },
    productOffer: { x: 0.5, y: 0.40 },
    competitive: { x: 0.85, y: 0.40 },
    website: { x: 0.35, y: 0.58 },
    content: { x: 0.15, y: 0.55 },
    seo: { x: 0.25, y: 0.72 },
    media: { x: 0.65, y: 0.58 },
    ops: { x: 0.85, y: 0.72 },
    objectives: { x: 0.5, y: 0.88 },
  };

  const pos = domainPositions[node.domain] || { x: 0.5, y: 0.5 };

  return {
    x: pos.x * containerWidth,
    y: pos.y * containerHeight,
  };
}

/**
 * Get all domains that have at least one non-empty node
 */
export function getActiveDomains(nodes: StrategicMapNode[]): StrategicMapNodeDomain[] {
  return [...new Set(
    nodes
      .filter(n => n.completeness !== 'empty')
      .map(n => n.domain)
  )];
}

/**
 * Check if the graph has enough data to be useful
 */
export function hasEnoughData(nodes: StrategicMapNode[]): boolean {
  const nonEmptyCount = nodes.filter(n => n.completeness !== 'empty').length;
  return nonEmptyCount >= 3; // At least 3 nodes with data
}

/**
 * Get heatmap color for a node based on score
 */
export function getHeatmapColor(score: number): { bg: string; text: string; glow: string } {
  if (score >= 70) {
    return { bg: '#10b98120', text: '#10b981', glow: '#10b98140' };
  }
  if (score >= 40) {
    return { bg: '#f59e0b20', text: '#f59e0b', glow: '#f59e0b40' };
  }
  return { bg: '#ef444420', text: '#ef4444', glow: '#ef444440' };
}

/**
 * Get edge visual properties based on style
 */
export function getEdgeVisualProps(edge: StrategicMapEdge): {
  strokeColor: string;
  strokeWidth: number;
  strokeDasharray: string | undefined;
  opacity: number;
  glowFilter: boolean;
} {
  switch (edge.style) {
    case 'strong_alignment':
      return {
        strokeColor: '#10b981',
        strokeWidth: 2.5,
        strokeDasharray: undefined,
        opacity: 0.8,
        glowFilter: false,
      };
    case 'human_verified':
      return {
        strokeColor: '#3b82f6',
        strokeWidth: 2,
        strokeDasharray: undefined,
        opacity: 0.9,
        glowFilter: false,
      };
    case 'ai_inferred':
      return {
        strokeColor: '#8b5cf6',
        strokeWidth: 1.5,
        strokeDasharray: undefined,
        opacity: 0.6,
        glowFilter: true,
      };
    case 'gap_link':
      return {
        strokeColor: '#ef4444',
        strokeWidth: 2,
        strokeDasharray: '6,4',
        opacity: 0.7,
        glowFilter: false,
      };
    case 'weak_link':
    default:
      return {
        strokeColor: '#475569',
        strokeWidth: 1,
        strokeDasharray: '4,4',
        opacity: 0.5,
        glowFilter: false,
      };
  }
}

/**
 * Find the strategic spine (critical path through the map)
 */
export function findStrategicSpine(graph: StrategicMapGraph): string[] {
  const spine: string[] = [];
  const criticalOrder: StrategicMapNodeDomain[] = [
    'identity',
    'audience',
    'brand',
    'productOffer',
    'competitive',
    'objectives',
  ];

  for (const domain of criticalOrder) {
    const node = graph.nodes.find(n => n.domain === domain && n.isCritical);
    if (node) {
      spine.push(node.id);
    }
  }

  return spine;
}

/**
 * Get upstream and downstream nodes for a given node
 */
export function getNodeConnections(
  nodeId: string,
  graph: StrategicMapGraph
): { upstream: StrategicMapNode[]; downstream: StrategicMapNode[] } {
  const upstream: StrategicMapNode[] = [];
  const downstream: StrategicMapNode[] = [];

  for (const edge of graph.edges) {
    if (edge.to === nodeId) {
      const node = graph.nodes.find(n => n.id === edge.from);
      if (node) upstream.push(node);
    }
    if (edge.from === nodeId) {
      const node = graph.nodes.find(n => n.id === edge.to);
      if (node) downstream.push(node);
    }
  }

  return { upstream, downstream };
}

/**
 * Export node definitions for use in other modules
 */
export { NODE_DEFINITIONS, EDGE_DEFINITIONS };
export type { NodeDefinition, EdgeDefinition };
