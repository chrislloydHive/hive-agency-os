// lib/contextGraph/graphView.ts
// Graph visualization utilities for the Context Graph Explorer
//
// Transforms CompanyContextGraph into force-graph-friendly structures.

import type { CompanyContextGraph, DomainName } from './companyContextGraph';
import { DOMAIN_NAMES } from './companyContextGraph';
import type { ProvenanceTag, ContextSource } from './types';
import { calculateFreshness } from './freshness';

// ============================================================================
// Graph Node & Link Types
// ============================================================================

export type GraphNodeType = 'field' | 'valueVariant' | 'source';

export type GraphNodeStatus = 'missing' | 'fresh' | 'stale' | 'conflicted';

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  section?: DomainName;
  path?: string;
  status?: GraphNodeStatus;
  confidence?: number;
  freshnessScore?: number;
  isHumanOverride?: boolean;
  // For source nodes
  sourceType?: ContextSource;
  connectedFieldCount?: number;
  // For valueVariant nodes
  variantValue?: string;
  variantTimestamp?: string;
}

export type GraphLinkKind =
  | 'fieldRelation'      // Between related fields
  | 'fieldHasVariant'    // Field -> ValueVariant
  | 'variantFromSource'  // ValueVariant -> Source
  | 'snapshotMembership'; // For snapshot diffs

export interface GraphLink {
  id: string;
  source: string;
  target: string;
  kind: GraphLinkKind;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// ============================================================================
// Section Colors (for node styling)
// ============================================================================

export const SECTION_COLORS: Record<DomainName, string> = {
  identity: '#14b8a6',        // teal-500
  brand: '#8b5cf6',           // violet-500
  objectives: '#f59e0b',      // amber-500
  audience: '#ec4899',        // pink-500
  productOffer: '#06b6d4',    // cyan-500
  digitalInfra: '#6366f1',    // indigo-500
  website: '#22c55e',         // green-500
  content: '#f97316',         // orange-500
  seo: '#0ea5e9',             // sky-500
  ops: '#64748b',             // slate-500
  performanceMedia: '#d946ef', // fuchsia-500
  historical: '#78716c',      // stone-500
  creative: '#a855f7',        // purple-500
  competitive: '#ef4444',     // red-500
  budgetOps: '#84cc16',       // lime-500
  operationalConstraints: '#f43f5e', // rose-500
  storeRisk: '#eab308',       // yellow-500
  historyRefs: '#71717a',     // zinc-500
  social: '#10b981',          // emerald-500
};

export const SOURCE_COLORS: Record<string, string> = {
  website_lab: '#3b82f6',     // blue-500
  media_lab: '#d946ef',       // fuchsia-500
  brand_lab: '#8b5cf6',       // violet-500
  seo_lab: '#0ea5e9',         // sky-500
  content_lab: '#f97316',     // orange-500
  demand_lab: '#ec4899',      // pink-500
  gap_ia: '#22c55e',          // green-500
  gap_full: '#10b981',        // emerald-500
  brain: '#f59e0b',           // amber-500
  manual: '#fbbf24',          // yellow-400 (Hive yellow)
  user: '#fbbf24',            // yellow-400 (Hive yellow)
  airtable: '#64748b',        // slate-500
  inferred: '#94a3b8',        // slate-400
  default: '#6b7280',         // gray-500
};

// ============================================================================
// Helper Functions
// ============================================================================

function isWithMetaNode(node: unknown): node is { value: unknown; provenance: ProvenanceTag[] } {
  return (
    node !== null &&
    typeof node === 'object' &&
    'value' in node &&
    'provenance' in node
  );
}

function getFieldStatus(
  value: unknown,
  provenance: ProvenanceTag[]
): GraphNodeStatus {
  if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) {
    return 'missing';
  }

  // Check for conflicts (multiple high-confidence sources with different values)
  const highConfidenceSources = provenance.filter(p => p.confidence >= 0.7);
  if (highConfidenceSources.length > 1) {
    // This is a simplification - real conflict detection would compare values
    return 'conflicted';
  }

  // Check freshness
  if (provenance.length > 0) {
    try {
      const freshness = calculateFreshness(provenance[0]);
      if (freshness.score < 0.3) {
        return 'stale';
      }
    } catch {
      // Ignore freshness calculation errors
    }
  }

  return 'fresh';
}

function getHighestConfidence(provenance: ProvenanceTag[]): number {
  if (!provenance || provenance.length === 0) return 0;
  return Math.max(...provenance.map(p => p.confidence ?? 0));
}

function getFreshnessScore(provenance: ProvenanceTag[]): number {
  if (!provenance || provenance.length === 0) return 0;
  try {
    const freshness = calculateFreshness(provenance[0]);
    return freshness.score;
  } catch {
    return 0.5;
  }
}

function isHumanSource(provenance: ProvenanceTag[]): boolean {
  return provenance.some(p => p.source === 'manual' || p.source === 'user');
}

function pathToLabel(path: string): string {
  const parts = path.split('.');
  const last = parts[parts.length - 1];
  return last
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// ============================================================================
// Field Relations (which fields are semantically related)
// ============================================================================

const FIELD_RELATIONS: Record<string, string[]> = {
  'identity.industry': ['audience.coreSegments', 'competitive.competitors'],
  'identity.businessModel': ['objectives.primaryObjective', 'budgetOps.totalMarketingBudget'],
  'brand.positioning': ['brand.valueProps', 'brand.differentiators', 'creative.coreMessages'],
  'brand.valueProps': ['brand.positioning', 'creative.proofPoints'],
  'audience.coreSegments': ['audience.painPoints', 'audience.motivations', 'performanceMedia.activeChannels'],
  'audience.painPoints': ['brand.valueProps', 'creative.coreMessages'],
  'objectives.primaryObjective': ['objectives.targetCpa', 'objectives.targetRoas', 'budgetOps.mediaSpendBudget'],
  'performanceMedia.activeChannels': ['budgetOps.mediaSpendBudget', 'performanceMedia.topPerformingChannel'],
  'creative.coreMessages': ['brand.positioning', 'audience.painPoints'],
};

// ============================================================================
// Core Graph Building Functions
// ============================================================================

/**
 * Build graph data for Field Graph mode (shows field nodes and their relations)
 */
export function buildFieldGraph(
  graph: CompanyContextGraph,
  sectionId: DomainName
): GraphData {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const nodeIds = new Set<string>();

  // Walk the domain and extract field nodes
  const domain = graph[sectionId];
  if (!domain) return { nodes: [], links: [] };

  const walk = (obj: unknown, pathParts: string[]) => {
    if (isWithMetaNode(obj)) {
      const path = pathParts.join('.');
      const nodeId = `field:${path}`;

      if (!nodeIds.has(nodeId)) {
        nodeIds.add(nodeId);
        nodes.push({
          id: nodeId,
          type: 'field',
          label: pathToLabel(path),
          section: sectionId,
          path,
          status: getFieldStatus(obj.value, obj.provenance),
          confidence: getHighestConfidence(obj.provenance),
          freshnessScore: getFreshnessScore(obj.provenance),
          isHumanOverride: isHumanSource(obj.provenance),
        });
      }
      return;
    }

    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      Object.entries(obj as Record<string, unknown>).forEach(([key, value]) => {
        walk(value, [...pathParts, key]);
      });
    }
  };

  walk(domain, [sectionId]);

  // Add related fields from other domains
  nodes.forEach(node => {
    if (!node.path) return;
    const relations = FIELD_RELATIONS[node.path];
    if (!relations) return;

    relations.forEach(relatedPath => {
      const [relDomain, ...relFieldParts] = relatedPath.split('.');
      const relDomainData = graph[relDomain as DomainName];
      if (!relDomainData) return;

      // Navigate to the field
      let fieldData: unknown = relDomainData;
      for (const part of relFieldParts) {
        if (fieldData && typeof fieldData === 'object' && part in fieldData) {
          fieldData = (fieldData as Record<string, unknown>)[part];
        } else {
          fieldData = undefined;
          break;
        }
      }

      if (isWithMetaNode(fieldData)) {
        const relNodeId = `field:${relatedPath}`;

        if (!nodeIds.has(relNodeId)) {
          nodeIds.add(relNodeId);
          nodes.push({
            id: relNodeId,
            type: 'field',
            label: pathToLabel(relatedPath),
            section: relDomain as DomainName,
            path: relatedPath,
            status: getFieldStatus(fieldData.value, fieldData.provenance),
            confidence: getHighestConfidence(fieldData.provenance),
            freshnessScore: getFreshnessScore(fieldData.provenance),
            isHumanOverride: isHumanSource(fieldData.provenance),
          });
        }

        // Create the relation link
        const linkId = `rel:${node.path}:${relatedPath}`;
        links.push({
          id: linkId,
          source: node.id,
          target: relNodeId,
          kind: 'fieldRelation',
        });
      }
    });
  });

  return { nodes, links };
}

/**
 * Build graph data for Provenance mode (shows fields, variants, and sources)
 */
export function buildProvenanceGraph(
  graph: CompanyContextGraph,
  sectionId: DomainName
): GraphData {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const nodeIds = new Set<string>();
  const sourceNodeCounts = new Map<string, number>();

  const domain = graph[sectionId];
  if (!domain) return { nodes: [], links: [] };

  const walk = (obj: unknown, pathParts: string[]) => {
    if (isWithMetaNode(obj)) {
      const path = pathParts.join('.');
      const fieldNodeId = `field:${path}`;

      if (!nodeIds.has(fieldNodeId)) {
        nodeIds.add(fieldNodeId);
        nodes.push({
          id: fieldNodeId,
          type: 'field',
          label: pathToLabel(path),
          section: sectionId,
          path,
          status: getFieldStatus(obj.value, obj.provenance),
          confidence: getHighestConfidence(obj.provenance),
          freshnessScore: getFreshnessScore(obj.provenance),
          isHumanOverride: isHumanSource(obj.provenance),
        });
      }

      // Add value variant nodes for each provenance entry
      obj.provenance.forEach((prov, idx) => {
        const variantNodeId = `variant:${path}:${idx}`;

        if (!nodeIds.has(variantNodeId)) {
          nodeIds.add(variantNodeId);
          nodes.push({
            id: variantNodeId,
            type: 'valueVariant',
            label: `v${idx + 1}`,
            section: sectionId,
            path,
            confidence: prov.confidence,
            variantTimestamp: prov.updatedAt,
          });

          // Link field -> variant
          links.push({
            id: `fhv:${path}:${idx}`,
            source: fieldNodeId,
            target: variantNodeId,
            kind: 'fieldHasVariant',
          });
        }

        // Add source node
        const sourceNodeId = `source:${prov.source}`;

        if (!nodeIds.has(sourceNodeId)) {
          nodeIds.add(sourceNodeId);
          sourceNodeCounts.set(sourceNodeId, 1);
          nodes.push({
            id: sourceNodeId,
            type: 'source',
            label: formatSourceLabel(prov.source),
            sourceType: prov.source,
            connectedFieldCount: 1,
          });
        } else {
          const count = sourceNodeCounts.get(sourceNodeId) ?? 0;
          sourceNodeCounts.set(sourceNodeId, count + 1);
        }

        // Link variant -> source
        const vfsLinkId = `vfs:${path}:${idx}:${prov.source}`;
        if (!links.some(l => l.id === vfsLinkId)) {
          links.push({
            id: vfsLinkId,
            source: variantNodeId,
            target: sourceNodeId,
            kind: 'variantFromSource',
          });
        }
      });

      return;
    }

    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      Object.entries(obj as Record<string, unknown>).forEach(([key, value]) => {
        walk(value, [...pathParts, key]);
      });
    }
  };

  walk(domain, [sectionId]);

  // Update source node counts
  nodes.forEach(node => {
    if (node.type === 'source') {
      node.connectedFieldCount = sourceNodeCounts.get(node.id) ?? 0;
    }
  });

  return { nodes, links };
}

function formatSourceLabel(source: ContextSource): string {
  const labels: Record<string, string> = {
    website_lab: 'Website Lab',
    media_lab: 'Media Lab',
    brand_lab: 'Brand Lab',
    seo_lab: 'SEO Lab',
    content_lab: 'Content Lab',
    demand_lab: 'Demand Lab',
    ops_lab: 'Ops Lab',
    audience_lab: 'Audience Lab',
    gap_ia: 'GAP IA',
    gap_full: 'GAP Full',
    gap_heavy: 'GAP Heavy',
    brain: 'Client Brain',
    manual: 'Manual Entry',
    user: 'User Input',
    airtable: 'Airtable',
    inferred: 'AI Inferred',
    analytics_ga4: 'GA4',
    analytics_gsc: 'Search Console',
    analytics_gads: 'Google Ads',
    setup_wizard: 'Setup Wizard',
  };
  return labels[source] || source.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ============================================================================
// Server Function
// ============================================================================

export type GraphMode = 'field' | 'provenance';

/**
 * Get context graph visualization data for a specific section
 *
 * @param graph - The full company context graph
 * @param sectionId - The domain/section to visualize
 * @param mode - 'field' for field relations, 'provenance' for source tracking
 */
export function getContextGraphForSection(
  graph: CompanyContextGraph | null,
  sectionId: DomainName,
  mode: GraphMode
): GraphData {
  if (!graph) {
    return { nodes: [], links: [] };
  }

  if (mode === 'field') {
    return buildFieldGraph(graph, sectionId);
  } else {
    return buildProvenanceGraph(graph, sectionId);
  }
}

/**
 * Get all snapshots for a company (stub - implement with actual snapshot loading)
 */
export interface SnapshotInfo {
  id: string;
  label: string;
  createdAt: string;
  reason?: string;
}

// ============================================================================
// Node Positioning Helpers
// ============================================================================

/**
 * Generate initial positions for nodes to cluster by section
 * This helps create a more deterministic initial layout
 */
export function getInitialNodePositions(
  nodes: GraphNode[],
  width: number,
  height: number
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.35;

  // Group nodes by section
  const sectionGroups = new Map<string, GraphNode[]>();
  nodes.forEach(node => {
    const section = node.section || 'other';
    if (!sectionGroups.has(section)) {
      sectionGroups.set(section, []);
    }
    sectionGroups.get(section)!.push(node);
  });

  // Position each section group
  const sections = Array.from(sectionGroups.keys());
  sections.forEach((section, sectionIdx) => {
    const angle = (2 * Math.PI * sectionIdx) / sections.length;
    const sectionCenterX = centerX + radius * Math.cos(angle);
    const sectionCenterY = centerY + radius * Math.sin(angle);

    const sectionNodes = sectionGroups.get(section)!;
    const nodeRadius = 30;

    sectionNodes.forEach((node, nodeIdx) => {
      // Arrange nodes in a small cluster around the section center
      const nodeAngle = (2 * Math.PI * nodeIdx) / sectionNodes.length;
      const spread = Math.min(80, sectionNodes.length * 15);

      positions.set(node.id, {
        x: sectionCenterX + spread * Math.cos(nodeAngle),
        y: sectionCenterY + spread * Math.sin(nodeAngle),
      });
    });
  });

  return positions;
}
