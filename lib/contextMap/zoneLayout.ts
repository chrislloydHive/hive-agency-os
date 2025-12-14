// lib/contextMap/zoneLayout.ts
// Zone layout calculations for the Context Map

import type { ZoneBounds, ComputedZone, PositionedNode, NodeVisualTier, ZoneId } from '@/components/context-map/types';
import type { HydratedContextNode } from '@/lib/contextGraph/nodes';
import { ALL_ZONES, LAYOUT, getZoneForDomain, MAX_VISIBLE_BEFORE_COLLAPSE, LOW_CONFIDENCE_THRESHOLD, MAX_COMPETITIVE_VISIBLE } from '@/components/context-map/constants';
import { sortNodesByVisualPriority } from './nodeGrouping';

// ============================================================================
// Zone Layout Computation
// ============================================================================

/**
 * Compute zone bounds based on container dimensions
 */
export function computeZoneBounds(
  containerWidth: number,
  containerHeight: number
): Map<string, ZoneBounds> {
  const { CANVAS_PADDING, ZONE_GAP, GRID_COLS, GRID_ROWS } = LAYOUT;

  const availableWidth = containerWidth - (CANVAS_PADDING * 2) - (ZONE_GAP * (GRID_COLS - 1));
  const availableHeight = containerHeight - (CANVAS_PADDING * 2) - (ZONE_GAP * (GRID_ROWS - 1));

  const zoneWidth = Math.floor(availableWidth / GRID_COLS);
  const zoneHeight = Math.floor(availableHeight / GRID_ROWS);

  const boundsMap = new Map<string, ZoneBounds>();

  for (const zone of ALL_ZONES) {
    boundsMap.set(zone.id, {
      x: CANVAS_PADDING + (zone.position.col * (zoneWidth + ZONE_GAP)),
      y: CANVAS_PADDING + (zone.position.row * (zoneHeight + ZONE_GAP)),
      width: zoneWidth,
      height: zoneHeight,
    });
  }

  return boundsMap;
}

/**
 * Result of layout computation including collapsed nodes
 */
export interface LayoutResult {
  /** Positioned nodes to render */
  positioned: PositionedNode[];
  /** Regular nodes that were collapsed due to max visible limit */
  collapsed: PositionedNode[];
  /** Low-confidence proposed nodes that were auto-collapsed */
  lowConfidenceCollapsed: PositionedNode[];
  /** Total number of nodes in this zone */
  totalNodes: number;
}

/**
 * Options for zone layout
 */
export interface LayoutNodesOptions {
  /** Maximum visible nodes before collapsing (default: 4) */
  maxVisible?: number;
  /** Whether to auto-collapse low confidence proposed nodes (default: true) */
  autoCollapseLowConfidence?: boolean;
  /** Threshold for low confidence (default: 0.6) */
  lowConfidenceThreshold?: number;
}

/**
 * Get visual tier for a node
 */
function getVisualTier(node: HydratedContextNode): NodeVisualTier {
  const isProposed = node.status === 'proposed' || !!node.pendingProposal;
  if (!isProposed) return 'confirmed';
  if (node.confidence >= LOW_CONFIDENCE_THRESHOLD) return 'proposed-high';
  return 'proposed-low';
}

/**
 * Position nodes in a grid within zone bounds
 */
function positionNodesInGrid(
  nodes: HydratedContextNode[],
  zoneBounds: ZoneBounds,
  zoneId: string
): PositionedNode[] {
  const { NODE_WIDTH, NODE_HEIGHT, NODE_GAP, ZONE_HEADER_HEIGHT } = LAYOUT;

  const contentWidth = zoneBounds.width - (NODE_GAP * 2);
  const cols = Math.max(1, Math.floor((contentWidth + NODE_GAP) / (NODE_WIDTH + NODE_GAP)));

  return nodes.map((node, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);

    return {
      ...node,
      position: {
        x: zoneBounds.x + NODE_GAP + (col * (NODE_WIDTH + NODE_GAP)),
        y: zoneBounds.y + ZONE_HEADER_HEIGHT + NODE_GAP + (row * (NODE_HEIGHT + NODE_GAP)),
      },
      size: {
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      },
      zoneId: zoneId as ZoneId,
      visualTier: getVisualTier(node),
    };
  });
}

/**
 * Layout nodes within a zone with collapsing support
 * - Sorts by visual priority (confirmed first, then high-conf proposed, then low-conf)
 * - Auto-collapses low-confidence proposed nodes
 * - Limits visible nodes to maxVisible
 */
export function layoutNodesInZone(
  nodes: HydratedContextNode[],
  zoneBounds: ZoneBounds,
  zoneId: string,
  options: LayoutNodesOptions = {}
): LayoutResult {
  const {
    maxVisible = MAX_VISIBLE_BEFORE_COLLAPSE,
    autoCollapseLowConfidence = true,
    lowConfidenceThreshold = LOW_CONFIDENCE_THRESHOLD,
  } = options;

  // Sort by visual priority
  const sortedNodes = sortNodesByVisualPriority(nodes);

  // Separate low-confidence proposed nodes if auto-collapse is enabled
  const regularNodes: HydratedContextNode[] = [];
  const lowConfidenceNodes: HydratedContextNode[] = [];

  if (autoCollapseLowConfidence) {
    for (const node of sortedNodes) {
      const isProposed = node.status === 'proposed' || !!node.pendingProposal;
      const isLowConf = node.confidence < lowConfidenceThreshold;

      if (isProposed && isLowConf) {
        lowConfidenceNodes.push(node);
      } else {
        regularNodes.push(node);
      }
    }
  } else {
    regularNodes.push(...sortedNodes);
  }

  // Take visible nodes from regular nodes
  const visibleNodes = regularNodes.slice(0, maxVisible);
  const collapsedRegular = regularNodes.slice(maxVisible);

  // Position visible nodes
  const positioned = positionNodesInGrid(visibleNodes, zoneBounds, zoneId);

  // Position collapsed nodes (for expansion)
  const collapsed = positionNodesInGrid(collapsedRegular, zoneBounds, zoneId);
  const lowConfidenceCollapsed = positionNodesInGrid(lowConfidenceNodes, zoneBounds, zoneId);

  return {
    positioned,
    collapsed,
    lowConfidenceCollapsed,
    totalNodes: nodes.length,
  };
}

export interface ComputeZonesOptions {
  canvasWidth: number;
  canvasHeight: number;
  padding?: number;
  maxNodesPerZone?: number;
  /** Layout options for collapsing */
  layoutOptions?: LayoutNodesOptions;
}

/**
 * Compute all zones with positioned nodes
 */
export function computeZonesWithNodes(
  nodes: HydratedContextNode[],
  options: ComputeZonesOptions
): ComputedZone[] {
  const { canvasWidth, canvasHeight, layoutOptions } = options;
  const boundsMap = computeZoneBounds(canvasWidth, canvasHeight);

  // Group nodes by zone
  const nodesByZone = new Map<string, HydratedContextNode[]>();
  for (const zone of ALL_ZONES) {
    nodesByZone.set(zone.id, []);
  }

  for (const node of nodes) {
    const domain = node.category;
    const zoneId = getZoneForDomain(domain);
    const zoneNodes = nodesByZone.get(zoneId) || [];
    zoneNodes.push(node);
    nodesByZone.set(zoneId, zoneNodes);
  }

  // Compute zones with positioned nodes
  return ALL_ZONES.map((zone) => {
    const bounds = boundsMap.get(zone.id)!;
    const zoneNodes = nodesByZone.get(zone.id) || [];

    // Competitive zone gets special collapsed limit of 3
    const zoneLayoutOptions: LayoutNodesOptions = zone.id === 'competitive'
      ? { ...layoutOptions, maxVisible: MAX_COMPETITIVE_VISIBLE }
      : layoutOptions || {};

    const layoutResult = layoutNodesInZone(zoneNodes, bounds, zone.id, zoneLayoutOptions);

    return {
      ...zone,
      bounds,
      nodes: layoutResult.positioned,
      totalNodes: layoutResult.totalNodes,
      visibleNodes: layoutResult.positioned.length,
      collapsedNodes: layoutResult.collapsed,
      lowConfidenceCollapsed: layoutResult.lowConfidenceCollapsed,
    };
  });
}

// ============================================================================
// Edge Layout Computation
// ============================================================================

import type { ComputedEdge } from '@/components/context-map/types';
import { EDGE_DEFINITIONS } from '@/components/context-map/constants';

/**
 * Get center point of a zone
 */
function getZoneCenter(bounds: ZoneBounds): { x: number; y: number } {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

/**
 * Compute edges between zones
 */
export function computeEdges(
  zones: ComputedZone[],
  highlightedZone: string | null = null
): ComputedEdge[] {
  const zoneMap = new Map<string, ComputedZone>();
  for (const zone of zones) {
    zoneMap.set(zone.id, zone);
  }

  return EDGE_DEFINITIONS.map((edge) => {
    const fromZone = zoneMap.get(edge.fromZone);
    const toZone = zoneMap.get(edge.toZone);

    if (!fromZone || !toZone) {
      return null;
    }

    const fromCenter = getZoneCenter(fromZone.bounds);
    const toCenter = getZoneCenter(toZone.bounds);

    const isHighlighted =
      highlightedZone === edge.fromZone || highlightedZone === edge.toZone;

    return {
      ...edge,
      fromPoint: fromCenter,
      toPoint: toCenter,
      isHighlighted,
    };
  }).filter((e): e is ComputedEdge => e !== null);
}

// ============================================================================
// Hit Testing
// ============================================================================

/**
 * Find node at a given point (for click/hover detection)
 */
export function findNodeAtPoint(
  zones: ComputedZone[],
  point: { x: number; y: number },
  transform: { x: number; y: number; scale: number }
): PositionedNode | null {
  // Transform point to canvas coordinates
  const canvasX = (point.x - transform.x) / transform.scale;
  const canvasY = (point.y - transform.y) / transform.scale;

  for (const zone of zones) {
    for (const node of zone.nodes) {
      if (
        canvasX >= node.position.x &&
        canvasX <= node.position.x + node.size.width &&
        canvasY >= node.position.y &&
        canvasY <= node.position.y + node.size.height
      ) {
        return node;
      }
    }
  }

  return null;
}

/**
 * Find zone at a given point
 */
export function findZoneAtPoint(
  zones: ComputedZone[],
  point: { x: number; y: number },
  transform: { x: number; y: number; scale: number }
): ComputedZone | null {
  const canvasX = (point.x - transform.x) / transform.scale;
  const canvasY = (point.y - transform.y) / transform.scale;

  for (const zone of zones) {
    if (
      canvasX >= zone.bounds.x &&
      canvasX <= zone.bounds.x + zone.bounds.width &&
      canvasY >= zone.bounds.y &&
      canvasY <= zone.bounds.y + zone.bounds.height
    ) {
      return zone;
    }
  }

  return null;
}
