// lib/os/context/layout/autoLayout.ts
// AI-assisted auto-layout system for Context Graph V4
//
// Provides multiple layout algorithms:
// - Category: Cluster by domain columns (left to right)
// - Funnel: Arrange by buyer journey stages
// - Semantic: Group by label similarity within categories

import type { NodePosition } from '../dependencies';

// ============================================================================
// Types
// ============================================================================

export interface LayoutNode {
  id: string;
  label: string;
  domain: string;
  importance: number;
  position?: NodePosition;
  pinned?: boolean;
}

export interface LayoutResult {
  positions: Map<string, NodePosition>;
  changed: string[]; // IDs of nodes that were repositioned
}

// ============================================================================
// Layout Constants
// ============================================================================

// Category column order (left to right)
const CATEGORY_ORDER = [
  'identity',
  'audience',
  'productOffer',
  'brand',
  'content',
  'performanceMedia',
  'seo',
  'ops',
  'social',
  'website',
  'digitalInfra',
  'budgetOps',
  'competitive',
  'creative',
  'historical',
  'objectives',
  'operationalConstraints',
  'storeRisk',
  'historyRefs',
  'channels',
];

// Funnel stage order (buyer journey)
const FUNNEL_ORDER = [
  'audience',       // Who they serve
  'productOffer',   // What they sell
  'brand',          // How they position
  'content',        // How they communicate
  'social',         // Channel touchpoints
  'website',        // Digital presence
  'performanceMedia', // Growth/demand
  'seo',            // Organic growth
  'ops',            // Operations
  'budgetOps',      // Budget management
];

// Semantic keyword clusters
const SEMANTIC_CLUSTERS: Record<string, string[]> = {
  audience: ['persona', 'icp', 'segment', 'customer', 'buyer', 'user', 'target', 'demographic'],
  offer: ['pricing', 'feature', 'value', 'product', 'service', 'solution', 'package', 'tier'],
  brand: ['positioning', 'voice', 'tone', 'identity', 'mission', 'vision', 'values'],
  content: ['blog', 'article', 'post', 'copy', 'messaging', 'headline', 'pillar'],
  website: ['seo', 'page', 'url', 'cta', 'landing', 'site', 'navigation', 'meta'],
  demand: ['campaign', 'ad', 'media', 'conversion', 'funnel', 'lead', 'acquisition'],
  ops: ['budget', 'timeline', 'resource', 'constraint', 'workflow', 'process'],
  channels: ['social', 'email', 'platform', 'channel', 'distribution'],
};

// Layout parameters
const CANVAS_WIDTH = 4000;
const CANVAS_HEIGHT = 4000;
const CANVAS_CENTER_X = CANVAS_WIDTH / 2;
const CANVAS_CENTER_Y = CANVAS_HEIGHT / 2;
const COLUMN_WIDTH = 280;
const ROW_HEIGHT = 80;
const MIN_NODE_SPACING = 70;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get column index for a domain in category layout
 */
function getCategoryColumn(domain: string): number {
  const index = CATEGORY_ORDER.indexOf(domain);
  return index >= 0 ? index : CATEGORY_ORDER.length;
}

/**
 * Get column index for a domain in funnel layout
 */
function getFunnelColumn(domain: string): number {
  const index = FUNNEL_ORDER.indexOf(domain);
  return index >= 0 ? index : FUNNEL_ORDER.length;
}

/**
 * Determine semantic cluster for a node based on label
 */
function getSemanticCluster(label: string): string {
  const lowerLabel = label.toLowerCase();

  for (const [cluster, keywords] of Object.entries(SEMANTIC_CLUSTERS)) {
    for (const keyword of keywords) {
      if (lowerLabel.includes(keyword)) {
        return cluster;
      }
    }
  }

  return 'other';
}

/**
 * Apply force separation to prevent overlap
 */
function applyForceSeparation(
  positions: Map<string, NodePosition>,
  nodes: LayoutNode[],
  iterations: number = 3
): Map<string, NodePosition> {
  const result = new Map(positions);

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeA = nodes[i];
        const nodeB = nodes[j];

        // Skip if either is pinned
        if (nodeA.pinned || nodeB.pinned) continue;

        const posA = result.get(nodeA.id);
        const posB = result.get(nodeB.id);

        if (!posA || !posB) continue;

        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < MIN_NODE_SPACING && distance > 0) {
          const overlap = MIN_NODE_SPACING - distance;
          const pushX = (dx / distance) * overlap * 0.5;
          const pushY = (dy / distance) * overlap * 0.5;

          if (!nodeA.pinned) {
            result.set(nodeA.id, { x: posA.x - pushX, y: posA.y - pushY });
          }
          if (!nodeB.pinned) {
            result.set(nodeB.id, { x: posB.x + pushX, y: posB.y + pushY });
          }
        }
      }
    }
  }

  return result;
}

// ============================================================================
// Layout Algorithms
// ============================================================================

/**
 * Auto-layout by category columns (left to right)
 *
 * Clusters categories into columns:
 * Identity -> Audience -> Offer -> Brand -> Content -> Demand -> Ops -> Channels
 */
export function autoLayoutByCategory(nodes: LayoutNode[]): LayoutResult {
  const positions = new Map<string, NodePosition>();
  const changed: string[] = [];

  // Group nodes by domain
  const domainGroups = new Map<string, LayoutNode[]>();

  for (const node of nodes) {
    if (node.pinned && node.position) {
      // Keep pinned positions
      positions.set(node.id, { ...node.position });
      continue;
    }

    if (!domainGroups.has(node.domain)) {
      domainGroups.set(node.domain, []);
    }
    domainGroups.get(node.domain)!.push(node);
  }

  // Calculate columns needed
  const columnsUsed = new Set<number>();
  for (const domain of domainGroups.keys()) {
    columnsUsed.add(getCategoryColumn(domain));
  }
  const totalColumns = Math.max(...columnsUsed) + 1;

  // Start position (centered around canvas center)
  const startX = CANVAS_CENTER_X - (totalColumns * COLUMN_WIDTH) / 2;
  const startY = CANVAS_CENTER_Y - 200;

  // Position each domain group
  for (const [domain, groupNodes] of domainGroups) {
    const column = getCategoryColumn(domain);
    const columnX = startX + column * COLUMN_WIDTH + COLUMN_WIDTH / 2;

    // Sort by importance (higher importance at top)
    groupNodes.sort((a, b) => b.importance - a.importance);

    // Position nodes vertically in column
    groupNodes.forEach((node, index) => {
      const y = startY + index * ROW_HEIGHT;
      positions.set(node.id, { x: columnX, y });
      changed.push(node.id);
    });
  }

  // Apply force separation
  const finalPositions = applyForceSeparation(positions, nodes);

  return { positions: finalPositions, changed };
}

/**
 * Auto-layout by buyer funnel stages
 *
 * Reorders by journey: Audience -> Offer -> Content -> Channels -> Conversion -> Ops
 */
export function autoLayoutByFunnel(nodes: LayoutNode[]): LayoutResult {
  const positions = new Map<string, NodePosition>();
  const changed: string[] = [];

  // Group nodes by funnel stage
  const funnelGroups = new Map<number, LayoutNode[]>();

  for (const node of nodes) {
    if (node.pinned && node.position) {
      positions.set(node.id, { ...node.position });
      continue;
    }

    const stage = getFunnelColumn(node.domain);
    if (!funnelGroups.has(stage)) {
      funnelGroups.set(stage, []);
    }
    funnelGroups.get(stage)!.push(node);
  }

  // Calculate total stages
  const stages = Array.from(funnelGroups.keys()).sort((a, b) => a - b);
  const totalStages = stages.length;

  // Start position (funnel shape - wider at top)
  const centerX = CANVAS_CENTER_X;
  const startY = CANVAS_CENTER_Y - 400;

  // Position each stage
  for (const stage of stages) {
    const stageNodes = funnelGroups.get(stage) || [];
    const stageIndex = stages.indexOf(stage);

    // Funnel narrows as we go down
    const stageWidth = 800 - stageIndex * 60;
    const y = startY + stageIndex * 120;

    // Sort by importance
    stageNodes.sort((a, b) => b.importance - a.importance);

    // Distribute horizontally
    const spacing = stageWidth / (stageNodes.length + 1);
    const startX = centerX - stageWidth / 2;

    stageNodes.forEach((node, index) => {
      const x = startX + (index + 1) * spacing;
      positions.set(node.id, { x, y });
      changed.push(node.id);
    });
  }

  // Apply force separation
  const finalPositions = applyForceSeparation(positions, nodes);

  return { positions: finalPositions, changed };
}

/**
 * Auto-layout by semantic similarity
 *
 * Uses node labels to cluster related nodes together
 */
export function autoLayoutSemantic(nodes: LayoutNode[]): LayoutResult {
  const positions = new Map<string, NodePosition>();
  const changed: string[] = [];

  // Group nodes by semantic cluster
  const semanticGroups = new Map<string, LayoutNode[]>();

  for (const node of nodes) {
    if (node.pinned && node.position) {
      positions.set(node.id, { ...node.position });
      continue;
    }

    // Determine cluster based on label and domain
    let cluster = getSemanticCluster(node.label);

    // Fall back to domain-based clustering
    if (cluster === 'other') {
      if (['audience', 'objectives'].includes(node.domain)) cluster = 'audience';
      else if (['productOffer'].includes(node.domain)) cluster = 'offer';
      else if (['brand', 'competitive'].includes(node.domain)) cluster = 'brand';
      else if (['content', 'creative'].includes(node.domain)) cluster = 'content';
      else if (['website', 'seo', 'digitalInfra'].includes(node.domain)) cluster = 'website';
      else if (['performanceMedia'].includes(node.domain)) cluster = 'demand';
      else if (['ops', 'budgetOps', 'operationalConstraints'].includes(node.domain)) cluster = 'ops';
      else if (['social', 'channels'].includes(node.domain)) cluster = 'channels';
      else cluster = 'other';
    }

    if (!semanticGroups.has(cluster)) {
      semanticGroups.set(cluster, []);
    }
    semanticGroups.get(cluster)!.push(node);
  }

  // Arrange clusters in a circle
  const clusters = Array.from(semanticGroups.keys());
  const clusterCount = clusters.length;
  const clusterRadius = 600;

  clusters.forEach((cluster, clusterIndex) => {
    const clusterNodes = semanticGroups.get(cluster) || [];

    // Calculate cluster center position (circular arrangement)
    const angle = (2 * Math.PI * clusterIndex) / clusterCount - Math.PI / 2;
    const clusterCenterX = CANVAS_CENTER_X + Math.cos(angle) * clusterRadius;
    const clusterCenterY = CANVAS_CENTER_Y + Math.sin(angle) * clusterRadius;

    // Sort nodes by importance
    clusterNodes.sort((a, b) => b.importance - a.importance);

    // Arrange nodes in a small cluster
    const nodeCount = clusterNodes.length;
    const innerRadius = Math.min(120, 40 + nodeCount * 15);

    clusterNodes.forEach((node, nodeIndex) => {
      if (nodeCount === 1) {
        positions.set(node.id, { x: clusterCenterX, y: clusterCenterY });
      } else {
        const nodeAngle = (2 * Math.PI * nodeIndex) / nodeCount;
        positions.set(node.id, {
          x: clusterCenterX + Math.cos(nodeAngle) * innerRadius,
          y: clusterCenterY + Math.sin(nodeAngle) * innerRadius,
        });
      }
      changed.push(node.id);
    });
  });

  // Apply force separation
  const finalPositions = applyForceSeparation(positions, nodes);

  return { positions: finalPositions, changed };
}

// ============================================================================
// Story Mode Stage Definitions
// ============================================================================

export interface StoryStage {
  id: string;
  title: string;
  description: string;
  domains: string[];
  insightPrompt?: string;
}

export const STORY_STAGES: StoryStage[] = [
  {
    id: 'identity',
    title: 'Who They Are',
    description: 'The company\'s core identity, brand positioning, and how they differentiate in the market.',
    domains: ['identity', 'brand'],
    insightPrompt: 'How well-defined is the brand positioning?',
  },
  {
    id: 'audience',
    title: 'Who They Serve',
    description: 'Target audience segments, ICPs, and the customers they\'re trying to reach.',
    domains: ['audience', 'objectives'],
    insightPrompt: 'Are audience segments clearly defined and connected to content?',
  },
  {
    id: 'offer',
    title: 'What They Sell',
    description: 'Products, services, value propositions, and competitive differentiation.',
    domains: ['productOffer', 'competitive'],
    insightPrompt: 'Is the offer well-connected to audience needs?',
  },
  {
    id: 'content',
    title: 'How They Communicate',
    description: 'Content strategy, messaging pillars, and creative assets.',
    domains: ['content', 'creative'],
    insightPrompt: 'Does content align with audience and brand?',
  },
  {
    id: 'growth',
    title: 'How They Grow',
    description: 'Demand generation, channels, SEO, and performance marketing.',
    domains: ['performanceMedia', 'seo', 'social', 'website', 'digitalInfra', 'channels'],
    insightPrompt: 'Are growth channels properly connected to content and audience?',
  },
  {
    id: 'ops',
    title: 'Operational Realities',
    description: 'Budget constraints, operational limitations, and historical context.',
    domains: ['ops', 'budgetOps', 'operationalConstraints', 'historical', 'storeRisk', 'historyRefs'],
    insightPrompt: 'Are operational constraints reflected in strategy?',
  },
];

/**
 * Get nodes for a specific story stage
 */
export function getNodesForStage(
  nodes: LayoutNode[],
  stageId: string
): LayoutNode[] {
  const stage = STORY_STAGES.find(s => s.id === stageId);
  if (!stage) return [];

  return nodes.filter(node => stage.domains.includes(node.domain));
}

/**
 * Calculate camera center for a story stage
 */
export function getCameraForStage(
  positions: Map<string, NodePosition>,
  nodes: LayoutNode[],
  stageId: string
): { x: number; y: number; scale: number } {
  const stageNodes = getNodesForStage(nodes, stageId);

  if (stageNodes.length === 0) {
    return { x: CANVAS_CENTER_X, y: CANVAS_CENTER_Y, scale: 1 };
  }

  // Calculate bounding box of stage nodes
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const node of stageNodes) {
    const pos = positions.get(node.id);
    if (pos) {
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x);
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y);
    }
  }

  // Add padding
  const padding = 150;
  minX -= padding;
  maxX += padding;
  minY -= padding;
  maxY += padding;

  // Calculate center
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  // Calculate scale to fit (assume 800x600 viewport)
  const width = maxX - minX;
  const height = maxY - minY;
  const scaleX = 800 / width;
  const scaleY = 600 / height;
  const scale = Math.min(scaleX, scaleY, 1.5);

  return { x: centerX, y: centerY, scale: Math.max(0.5, scale) };
}

// ============================================================================
// Insight Overlay Types
// ============================================================================

export type InsightOverlayType = 'risks' | 'opportunities' | 'missing';

export interface InsightOverlay {
  nodeId: string;
  type: InsightOverlayType;
  color: string;
  message?: string;
}

export interface GhostEdge {
  fromNodeId: string;
  toNodeId: string;
  type: InsightOverlayType;
  label?: string;
}

/**
 * Generate insight overlays for nodes
 */
export function generateInsightOverlays(
  nodes: LayoutNode[],
  overlayType: InsightOverlayType
): { overlays: InsightOverlay[]; ghostEdges: GhostEdge[] } {
  const overlays: InsightOverlay[] = [];
  const ghostEdges: GhostEdge[] = [];

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const domainNodes = new Map<string, LayoutNode[]>();

  // Group by domain
  for (const node of nodes) {
    if (!domainNodes.has(node.domain)) {
      domainNodes.set(node.domain, []);
    }
    domainNodes.get(node.domain)!.push(node);
  }

  if (overlayType === 'risks') {
    // Highlight disconnected offers
    const offers = domainNodes.get('productOffer') || [];
    for (const offer of offers) {
      overlays.push({
        nodeId: offer.id,
        type: 'risks',
        color: '#ef4444', // red
        message: 'Offer may be disconnected from audience',
      });
    }

    // Highlight brand nodes without offer connections
    const brands = domainNodes.get('brand') || [];
    for (const brand of brands) {
      overlays.push({
        nodeId: brand.id,
        type: 'risks',
        color: '#f97316', // orange
        message: 'Brand positioning may not be connected to offers',
      });
    }
  }

  if (overlayType === 'opportunities') {
    // Highlight audience nodes (opportunity to connect to content)
    const audiences = domainNodes.get('audience') || [];
    for (const audience of audiences) {
      overlays.push({
        nodeId: audience.id,
        type: 'opportunities',
        color: '#10b981', // green
        message: 'Opportunity: Connect audience to content strategy',
      });
    }

    // Highlight content nodes
    const content = domainNodes.get('content') || [];
    for (const c of content) {
      overlays.push({
        nodeId: c.id,
        type: 'opportunities',
        color: '#3b82f6', // blue
        message: 'Opportunity: Link content to demand channels',
      });
    }
  }

  if (overlayType === 'missing') {
    // Generate ghost edges for common missing links
    const audienceNodes = domainNodes.get('audience') || [];
    const contentNodes = domainNodes.get('content') || [];
    const offerNodes = domainNodes.get('productOffer') || [];
    const demandNodes = domainNodes.get('performanceMedia') || [];
    const brandNodes = domainNodes.get('brand') || [];
    const channelNodes = [...(domainNodes.get('social') || []), ...(domainNodes.get('channels') || [])];

    // Audience -> Content ghost edges
    if (audienceNodes.length > 0 && contentNodes.length > 0) {
      ghostEdges.push({
        fromNodeId: audienceNodes[0].id,
        toNodeId: contentNodes[0].id,
        type: 'missing',
        label: 'Audience → Content',
      });
    }

    // Offer -> Demand ghost edges
    if (offerNodes.length > 0 && demandNodes.length > 0) {
      ghostEdges.push({
        fromNodeId: offerNodes[0].id,
        toNodeId: demandNodes[0].id,
        type: 'missing',
        label: 'Offer → Demand',
      });
    }

    // Brand -> Offer ghost edges
    if (brandNodes.length > 0 && offerNodes.length > 0) {
      ghostEdges.push({
        fromNodeId: brandNodes[0].id,
        toNodeId: offerNodes[0].id,
        type: 'missing',
        label: 'Brand → Offer',
      });
    }

    // Offer -> Channel ghost edges
    if (offerNodes.length > 0 && channelNodes.length > 0) {
      ghostEdges.push({
        fromNodeId: offerNodes[0].id,
        toNodeId: channelNodes[0].id,
        type: 'missing',
        label: 'Offer → Channel',
      });
    }
  }

  return { overlays, ghostEdges };
}
