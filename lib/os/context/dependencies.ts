// lib/os/context/dependencies.ts
// Relationship/Dependency Graph Loader for Context Relationship View
//
// Returns node-edge data for the dependency visualization showing:
// - How context fields depend on each other
// - Correlations between domains
// - Ghost nodes for missing but referenced fields

import { loadContextGraph } from '@/lib/contextGraph/storage';
import { computeContextHealthScore } from '@/lib/contextGraph/health';
import { flattenGraphToFields, type GraphFieldUi } from '@/lib/contextGraph/uiHelpers';
import { DOMAIN_NAMES, type DomainName } from '@/lib/contextGraph/companyContextGraph';
import type { CoverageNodeStatus } from './loadCoverageGraph';

// ============================================================================
// Types
// ============================================================================

/**
 * Relationship type between nodes
 */
export type RelationshipType = 'dependency' | 'correlated' | 'derived';

/**
 * An edge in the relationship graph
 */
export interface RelationshipEdge {
  /** Unique identifier */
  id: string;
  /** Source node ID */
  fromNodeId: string;
  /** Target node ID */
  toNodeId: string;
  /** Type of relationship */
  type: RelationshipType;
  /** Relationship strength (0-1) */
  strength: number;
  /** Whether this is a ghost edge (target is missing) */
  isGhost: boolean;
  /** Human-readable description of the relationship */
  description?: string;
}

/**
 * Optional saved position for a node
 */
export interface NodePosition {
  x: number;
  y: number;
}

/**
 * A node in the relationship graph
 */
export interface RelationshipNode {
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
  /** Whether this is a ghost node (missing but referenced) */
  isGhost: boolean;
  /** Current value (for tooltip) */
  value?: string | null;
  /** Source of the value */
  source?: string;
  /** Optional saved position for drag-and-drop layout */
  position?: NodePosition;
}

/**
 * Complete relationship graph for visualization
 */
export interface RelationshipGraph {
  /** All nodes in the graph */
  nodes: RelationshipNode[];
  /** All edges connecting nodes */
  edges: RelationshipEdge[];
}

// ============================================================================
// Dependency Rules
// ============================================================================

/**
 * Predefined dependency relationships between context fields.
 * These represent semantic dependencies where one field's value
 * depends on or is informed by another.
 */
const DEPENDENCY_RULES: Array<{
  from: string | RegExp;
  to: string | RegExp;
  type: RelationshipType;
  strength: number;
  description: string;
}> = [
  // Identity dependencies
  {
    from: 'identity.industry',
    to: 'audience.primaryIcp',
    type: 'dependency',
    strength: 0.9,
    description: 'Industry informs ICP definition',
  },
  {
    from: 'identity.companyName',
    to: 'brand.brandVoice',
    type: 'dependency',
    strength: 0.7,
    description: 'Company identity shapes brand voice',
  },
  {
    from: 'identity.websiteUrl',
    to: 'website.primaryUrl',
    type: 'derived',
    strength: 1.0,
    description: 'Website URL is derived from identity',
  },

  // Brand → Marketing dependencies
  {
    from: 'brand.valueProposition',
    to: 'content.messagingPillars',
    type: 'dependency',
    strength: 0.9,
    description: 'Value prop drives messaging',
  },
  {
    from: 'brand.brandVoice',
    to: 'creative.toneGuidelines',
    type: 'dependency',
    strength: 0.8,
    description: 'Brand voice guides creative tone',
  },
  {
    from: 'brand.visualIdentity',
    to: 'creative.visualGuidelines',
    type: 'dependency',
    strength: 0.9,
    description: 'Visual identity informs creative guidelines',
  },

  // Audience → Targeting dependencies
  {
    from: 'audience.primaryIcp',
    to: 'performanceMedia.targetingStrategy',
    type: 'dependency',
    strength: 0.9,
    description: 'ICP drives media targeting',
  },
  {
    from: 'audience.segments',
    to: 'content.contentStrategy',
    type: 'dependency',
    strength: 0.8,
    description: 'Audience segments shape content',
  },
  {
    from: 'audience.painPoints',
    to: 'brand.valueProposition',
    type: 'correlated',
    strength: 0.7,
    description: 'Pain points relate to value proposition',
  },

  // Objectives → Strategy dependencies
  {
    from: 'objectives.primaryGoals',
    to: 'performanceMedia.campaignObjectives',
    type: 'dependency',
    strength: 0.9,
    description: 'Business goals drive campaign objectives',
  },
  {
    from: 'objectives.kpis',
    to: 'performanceMedia.successMetrics',
    type: 'dependency',
    strength: 0.9,
    description: 'KPIs define success metrics',
  },
  {
    from: 'objectives.budget',
    to: 'budgetOps.totalBudget',
    type: 'derived',
    strength: 1.0,
    description: 'Budget is derived from objectives',
  },

  // SEO correlations
  {
    from: 'seo.targetKeywords',
    to: 'content.contentTopics',
    type: 'correlated',
    strength: 0.8,
    description: 'Keywords correlate with content topics',
  },
  {
    from: 'website.siteStructure',
    to: 'seo.technicalSeo',
    type: 'dependency',
    strength: 0.7,
    description: 'Site structure affects technical SEO',
  },

  // Competitive intelligence
  {
    from: 'competitive.topCompetitors',
    to: 'brand.positioning',
    type: 'dependency',
    strength: 0.7,
    description: 'Competitors inform positioning',
  },
  {
    from: 'competitive.marketGaps',
    to: 'productOffer.uniqueFeatures',
    type: 'correlated',
    strength: 0.6,
    description: 'Market gaps relate to product differentiation',
  },

  // Social → Brand
  {
    from: 'social.primaryPlatforms',
    to: 'content.channelStrategy',
    type: 'dependency',
    strength: 0.8,
    description: 'Social presence drives channel strategy',
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

function getFieldImportance(path: string): number {
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

  const domain = path.split('.')[0];
  return domainImportance[domain] || 3;
}

function fieldToStatus(field: GraphFieldUi): CoverageNodeStatus {
  if (!field.value && field.value !== '0' && field.value !== 'false') {
    return 'missing';
  }
  if (field.freshness && field.freshness.normalized < 0.5) {
    return 'stale';
  }
  return 'healthy';
}

function fieldToRelationshipNode(field: GraphFieldUi): RelationshipNode {
  const freshnessValue = field.freshness?.normalized ?? 0.9;
  const source = field.provenance?.[0]?.source;

  return {
    id: field.path,
    label: field.label || field.path.split('.').pop() || field.path,
    domain: field.domain as DomainName,
    status: fieldToStatus(field),
    confidence: 0.8, // Default confidence
    freshness: freshnessValue,
    importance: getFieldImportance(field.path),
    isGhost: false,
    value: field.value,
    source,
  };
}

function createGhostNodeForPath(path: string, label?: string): RelationshipNode {
  const domain = path.split('.')[0] as DomainName;

  return {
    id: path,
    label: label || path.split('.').pop() || path,
    domain: DOMAIN_NAMES.includes(domain) ? domain : 'identity',
    status: 'missing',
    confidence: 0,
    freshness: 0,
    importance: getFieldImportance(path),
    isGhost: true,
    value: null,
  };
}

function matchesRule(
  path: string,
  pattern: string | RegExp
): boolean {
  if (typeof pattern === 'string') {
    // Support wildcard patterns like 'audience.*'
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(path);
    }
    return path === pattern;
  }
  return pattern.test(path);
}

// ============================================================================
// Main Loader
// ============================================================================

/**
 * Load relationship graph for a company
 *
 * Builds a graph of dependencies and correlations between context fields.
 * Uses predefined rules and infers additional relationships from the data.
 *
 * @param companyId - The company ID to load relationships for
 * @returns RelationshipGraph with nodes and edges
 */
export async function loadRelationshipGraph(companyId: string): Promise<RelationshipGraph> {
  // Load context graph
  const graph = await loadContextGraph(companyId);

  if (!graph) {
    // Return empty graph with some ghost nodes
    const criticalPaths = [
      'identity.companyName',
      'identity.industry',
      'brand.valueProposition',
      'audience.primaryIcp',
      'objectives.primaryGoals',
    ];

    const nodes = criticalPaths.map(path => createGhostNodeForPath(path));

    // Create some basic edges between ghost nodes
    const edges: RelationshipEdge[] = [
      {
        id: 'edge-1',
        fromNodeId: 'identity.industry',
        toNodeId: 'audience.primaryIcp',
        type: 'dependency',
        strength: 0.9,
        isGhost: true,
        description: 'Industry informs ICP definition',
      },
    ];

    return { nodes, edges };
  }

  // Flatten graph to fields
  const fields = flattenGraphToFields(graph);

  // Build node map
  const nodeMap = new Map<string, RelationshipNode>();
  for (const field of fields) {
    nodeMap.set(field.path, fieldToRelationshipNode(field));
  }

  // Build edges from dependency rules
  const edges: RelationshipEdge[] = [];
  let edgeId = 0;

  for (const rule of DEPENDENCY_RULES) {
    // Find matching source nodes
    const sourceNodes = Array.from(nodeMap.entries())
      .filter(([path]) => matchesRule(path, rule.from))
      .map(([, node]) => node);

    // Find matching target nodes (or create ghost nodes)
    for (const sourceNode of sourceNodes) {
      const targetPaths = Array.from(nodeMap.keys())
        .filter(path => matchesRule(path, rule.to));

      if (targetPaths.length > 0) {
        // Create edges to existing nodes
        for (const targetPath of targetPaths) {
          const targetNode = nodeMap.get(targetPath);
          if (targetNode) {
            edges.push({
              id: `edge-${edgeId++}`,
              fromNodeId: sourceNode.id,
              toNodeId: targetNode.id,
              type: rule.type,
              strength: rule.strength,
              isGhost: false,
              description: rule.description,
            });
          }
        }
      } else {
        // Create ghost node and edge if the target pattern is a specific path
        if (typeof rule.to === 'string' && !rule.to.includes('*')) {
          if (!nodeMap.has(rule.to)) {
            const ghostNode = createGhostNodeForPath(rule.to);
            nodeMap.set(rule.to, ghostNode);
          }

          edges.push({
            id: `edge-${edgeId++}`,
            fromNodeId: sourceNode.id,
            toNodeId: rule.to,
            type: rule.type,
            strength: rule.strength,
            isGhost: true,
            description: rule.description,
          });
        }
      }
    }
  }

  // Add inferred correlations based on domain proximity
  // Fields in the same domain that are both populated tend to be correlated
  const domainFieldsMap = new Map<DomainName, RelationshipNode[]>();
  for (const node of nodeMap.values()) {
    if (!domainFieldsMap.has(node.domain)) {
      domainFieldsMap.set(node.domain, []);
    }
    domainFieldsMap.get(node.domain)!.push(node);
  }

  // Add some implicit intra-domain correlations for populated fields
  for (const [domain, domainNodes] of domainFieldsMap) {
    const populatedNodes = domainNodes.filter(n => n.status === 'healthy');
    if (populatedNodes.length >= 2) {
      // Add correlation between first two populated fields in domain
      edges.push({
        id: `edge-${edgeId++}`,
        fromNodeId: populatedNodes[0].id,
        toNodeId: populatedNodes[1].id,
        type: 'correlated',
        strength: 0.5,
        isGhost: false,
        description: `Related ${domain} fields`,
      });
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges,
  };
}

/**
 * Get edges that connect to a specific node
 *
 * @param graph - The relationship graph
 * @param nodeId - The node ID to find connections for
 * @returns Object with incoming and outgoing edges
 */
export function getNodeConnections(
  graph: RelationshipGraph,
  nodeId: string
): {
  dependsOn: Array<{ node: RelationshipNode; edge: RelationshipEdge }>;
  feedsInto: Array<{ node: RelationshipNode; edge: RelationshipEdge }>;
} {
  const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));

  const dependsOn: Array<{ node: RelationshipNode; edge: RelationshipEdge }> = [];
  const feedsInto: Array<{ node: RelationshipNode; edge: RelationshipEdge }> = [];

  for (const edge of graph.edges) {
    if (edge.toNodeId === nodeId) {
      // This node depends on the source
      const sourceNode = nodeMap.get(edge.fromNodeId);
      if (sourceNode) {
        dependsOn.push({ node: sourceNode, edge });
      }
    } else if (edge.fromNodeId === nodeId) {
      // This node feeds into the target
      const targetNode = nodeMap.get(edge.toNodeId);
      if (targetNode) {
        feedsInto.push({ node: targetNode, edge });
      }
    }
  }

  return { dependsOn, feedsInto };
}

/**
 * Get missing dependencies for a node
 * Returns ghost nodes that this node depends on but are missing
 */
export function getMissingDependencies(
  graph: RelationshipGraph,
  nodeId: string
): RelationshipNode[] {
  const { dependsOn } = getNodeConnections(graph, nodeId);
  return dependsOn
    .filter(({ node }) => node.isGhost || node.status === 'missing')
    .map(({ node }) => node);
}
