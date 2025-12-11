// app/c/[companyId]/brain/context/components/GraphUtils.ts
// Graph layout utilities for Context Map V3
//
// Provides:
// - Collision detection and resolution
// - Cluster-based initial placement
// - Node sizing based on importance
// - Viewport transform utilities

import type { NodePosition } from '@/lib/os/context';

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

export interface ViewportTransform {
  x: number;       // Pan X offset
  y: number;       // Pan Y offset
  scale: number;   // Zoom level
}

export interface ClusterZone {
  domain: string;
  centerX: number;
  centerY: number;
  radius: number;
  color: string;
}

// ============================================================================
// Constants
// ============================================================================

export const CANVAS_SIZE = 4000;
export const CANVAS_CENTER = CANVAS_SIZE / 2;

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 3;
export const ZOOM_SENSITIVITY = 0.001;

// Node size tiers based on importance (1-5)
export const NODE_SIZES: Record<number, number> = {
  1: 28,
  2: 32,
  3: 38,
  4: 44,
  5: 48,
};

// Minimum spacing between node centers
export const MIN_NODE_SPACING = 70;

// Collision detection passes
export const COLLISION_ITERATIONS = 5;

// Cluster configuration - maps domains to semantic categories
export const DOMAIN_CLUSTERS: Record<string, string> = {
  // Identity cluster
  identity: 'identity',

  // Audience cluster
  audience: 'audience',

  // Offer cluster
  productOffer: 'offer',

  // Brand cluster
  brand: 'brand',
  competitive: 'brand',

  // Content cluster
  content: 'content',
  creative: 'content',

  // Demand cluster
  performanceMedia: 'demand',
  seo: 'demand',

  // Ops cluster
  ops: 'ops',
  budgetOps: 'ops',
  operationalConstraints: 'ops',

  // Channel cluster
  social: 'channel',
  website: 'channel',
  digitalInfra: 'channel',
  channels: 'channel',

  // Other
  objectives: 'identity',
  historical: 'ops',
  storeRisk: 'ops',
  historyRefs: 'ops',
};

// Cluster colors (5-10% opacity backgrounds)
export const CLUSTER_COLORS: Record<string, string> = {
  identity: 'rgba(59, 130, 246, 0.08)',   // blue
  audience: 'rgba(236, 72, 153, 0.08)',   // pink
  offer: 'rgba(139, 92, 246, 0.08)',      // purple
  brand: 'rgba(245, 158, 11, 0.08)',      // amber
  content: 'rgba(99, 102, 241, 0.08)',    // indigo
  demand: 'rgba(239, 68, 68, 0.08)',      // red
  ops: 'rgba(120, 113, 108, 0.08)',       // stone
  channel: 'rgba(34, 197, 94, 0.08)',     // green
};

// Cluster positions (angles around center)
const CLUSTER_ANGLES: Record<string, number> = {
  identity: -90,      // top
  brand: -45,         // top-right
  audience: 0,        // right
  offer: 45,          // bottom-right
  content: 90,        // bottom
  demand: 135,        // bottom-left
  channel: 180,       // left
  ops: -135,          // top-left
};

// ============================================================================
// Node Sizing
// ============================================================================

/**
 * Get node size (diameter) based on importance level
 */
export function getNodeSize(importance: number): number {
  const level = Math.max(1, Math.min(5, Math.round(importance)));
  return NODE_SIZES[level] || NODE_SIZES[3];
}

/**
 * Get node radius for collision detection (includes padding)
 */
export function getNodeRadius(importance: number): number {
  return getNodeSize(importance) / 2 + 4; // 4px padding
}

// ============================================================================
// Cluster Placement
// ============================================================================

/**
 * Calculate cluster zones for background rendering
 */
export function calculateClusterZones(
  nodes: LayoutNode[],
  positions: Map<string, NodePosition>
): ClusterZone[] {
  const clusterNodes = new Map<string, NodePosition[]>();

  // Group positions by cluster
  for (const node of nodes) {
    const cluster = DOMAIN_CLUSTERS[node.domain] || 'ops';
    const pos = positions.get(node.id);
    if (pos) {
      if (!clusterNodes.has(cluster)) {
        clusterNodes.set(cluster, []);
      }
      clusterNodes.get(cluster)!.push(pos);
    }
  }

  const zones: ClusterZone[] = [];

  for (const [cluster, clusterPositions] of clusterNodes) {
    if (clusterPositions.length === 0) continue;

    // Calculate centroid
    const centerX = clusterPositions.reduce((sum, p) => sum + p.x, 0) / clusterPositions.length;
    const centerY = clusterPositions.reduce((sum, p) => sum + p.y, 0) / clusterPositions.length;

    // Calculate radius (max distance from center + padding)
    let maxDist = 60; // Minimum radius
    for (const pos of clusterPositions) {
      const dist = Math.sqrt(Math.pow(pos.x - centerX, 2) + Math.pow(pos.y - centerY, 2));
      maxDist = Math.max(maxDist, dist + 50);
    }

    zones.push({
      domain: cluster,
      centerX,
      centerY,
      radius: maxDist,
      color: CLUSTER_COLORS[cluster] || 'rgba(100, 116, 139, 0.06)',
    });
  }

  return zones;
}

/**
 * Get initial cluster center position for a domain
 */
function getClusterCenter(domain: string, clusterRadius: number): { x: number; y: number } {
  const cluster = DOMAIN_CLUSTERS[domain] || 'ops';
  const angle = (CLUSTER_ANGLES[cluster] || 0) * (Math.PI / 180);

  return {
    x: CANVAS_CENTER + Math.cos(angle) * clusterRadius,
    y: CANVAS_CENTER + Math.sin(angle) * clusterRadius,
  };
}

/**
 * Compute initial layout with cluster-based placement
 */
export function computeClusteredLayout(
  nodes: LayoutNode[],
  clusterRadius: number = 400
): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>();

  // First, use any saved positions
  for (const node of nodes) {
    if (node.position) {
      positions.set(node.id, { x: node.position.x, y: node.position.y });
    }
  }

  // Group remaining nodes by cluster
  const nodesWithoutPosition = nodes.filter(n => !positions.has(n.id));
  const clusterGroups = new Map<string, LayoutNode[]>();

  for (const node of nodesWithoutPosition) {
    const cluster = DOMAIN_CLUSTERS[node.domain] || 'ops';
    if (!clusterGroups.has(cluster)) {
      clusterGroups.set(cluster, []);
    }
    clusterGroups.get(cluster)!.push(node);
  }

  // Place nodes in clusters
  for (const [cluster, clusterNodes] of clusterGroups) {
    const center = getClusterCenter(cluster, clusterRadius);
    const nodeCount = clusterNodes.length;
    const innerRadius = Math.min(100, 30 + nodeCount * 12);

    clusterNodes.forEach((node, index) => {
      if (nodeCount === 1) {
        positions.set(node.id, { x: center.x, y: center.y });
      } else {
        // Spiral placement within cluster
        const angle = (2 * Math.PI * index) / nodeCount;
        const spiralOffset = (index % 3) * 20; // Slight variation
        const radius = innerRadius + spiralOffset;

        positions.set(node.id, {
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius,
        });
      }
    });
  }

  return positions;
}

// ============================================================================
// Collision Detection & Resolution
// ============================================================================

/**
 * Run collision detection and push overlapping nodes apart
 * This is a lightweight, non-physics approach
 */
export function resolveCollisions(
  nodes: LayoutNode[],
  positions: Map<string, NodePosition>,
  iterations: number = COLLISION_ITERATIONS
): Map<string, NodePosition> {
  const result = new Map(positions);

  for (let iter = 0; iter < iterations; iter++) {
    let hadCollision = false;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeA = nodes[i];
        const nodeB = nodes[j];
        const posA = result.get(nodeA.id);
        const posB = result.get(nodeB.id);

        if (!posA || !posB) continue;

        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const radiusA = getNodeRadius(nodeA.importance);
        const radiusB = getNodeRadius(nodeB.importance);
        const minDistance = radiusA + radiusB + 10; // 10px extra spacing

        if (distance < minDistance && distance > 0) {
          hadCollision = true;
          const overlap = minDistance - distance;
          const pushX = (dx / distance) * overlap * 0.5;
          const pushY = (dy / distance) * overlap * 0.5;

          result.set(nodeA.id, {
            x: posA.x - pushX,
            y: posA.y - pushY,
          });
          result.set(nodeB.id, {
            x: posB.x + pushX,
            y: posB.y + pushY,
          });
        } else if (distance === 0) {
          // Exact overlap - push in random direction
          hadCollision = true;
          const angle = Math.random() * 2 * Math.PI;
          const push = minDistance / 2;
          result.set(nodeA.id, {
            x: posA.x - Math.cos(angle) * push,
            y: posA.y - Math.sin(angle) * push,
          });
          result.set(nodeB.id, {
            x: posB.x + Math.cos(angle) * push,
            y: posB.y + Math.sin(angle) * push,
          });
        }
      }
    }

    // Early exit if no collisions
    if (!hadCollision) break;
  }

  return result;
}

// ============================================================================
// Viewport Transform Utilities
// ============================================================================

/**
 * Calculate centered initial viewport transform
 */
export function getInitialViewport(
  containerWidth: number,
  containerHeight: number,
  positions: Map<string, NodePosition>
): ViewportTransform {
  if (positions.size === 0) {
    // Default to center of canvas
    return {
      x: containerWidth / 2 - CANVAS_CENTER,
      y: containerHeight / 2 - CANVAS_CENTER,
      scale: 1,
    };
  }

  // Calculate bounding box of all nodes
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const pos of positions.values()) {
    minX = Math.min(minX, pos.x);
    maxX = Math.max(maxX, pos.x);
    minY = Math.min(minY, pos.y);
    maxY = Math.max(maxY, pos.y);
  }

  // Add padding
  const padding = 100;
  minX -= padding;
  maxX += padding;
  minY -= padding;
  maxY += padding;

  // Calculate center of content
  const contentCenterX = (minX + maxX) / 2;
  const contentCenterY = (minY + maxY) / 2;

  // Calculate scale to fit
  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;
  const scaleX = containerWidth / contentWidth;
  const scaleY = containerHeight / contentHeight;
  const scale = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 1x

  // Calculate offset to center content
  return {
    x: containerWidth / 2 - contentCenterX * scale,
    y: containerHeight / 2 - contentCenterY * scale,
    scale: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale)),
  };
}

/**
 * Apply zoom centered on a specific point
 */
export function zoomAtPoint(
  transform: ViewportTransform,
  zoomDelta: number,
  pointX: number,
  pointY: number
): ViewportTransform {
  const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, transform.scale + zoomDelta));
  const scaleFactor = newScale / transform.scale;

  // Adjust pan to keep the point stationary
  return {
    x: pointX - (pointX - transform.x) * scaleFactor,
    y: pointY - (pointY - transform.y) * scaleFactor,
    scale: newScale,
  };
}

/**
 * Convert screen coordinates to canvas coordinates
 */
export function screenToCanvas(
  screenX: number,
  screenY: number,
  transform: ViewportTransform
): { x: number; y: number } {
  return {
    x: (screenX - transform.x) / transform.scale,
    y: (screenY - transform.y) / transform.scale,
  };
}

/**
 * Convert canvas coordinates to screen coordinates
 */
export function canvasToScreen(
  canvasX: number,
  canvasY: number,
  transform: ViewportTransform
): { x: number; y: number } {
  return {
    x: canvasX * transform.scale + transform.x,
    y: canvasY * transform.scale + transform.y,
  };
}

/**
 * Clamp zoom level to valid range
 */
export function clampZoom(scale: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale));
}

// ============================================================================
// Minimap Utilities
// ============================================================================

export const MINIMAP_SIZE = 150;
export const MINIMAP_SCALE = 0.05; // 5% of actual size

/**
 * Calculate minimap viewport rectangle
 */
export function getMinimapViewport(
  transform: ViewportTransform,
  containerWidth: number,
  containerHeight: number
): { x: number; y: number; width: number; height: number } {
  // Convert screen corners to canvas coordinates
  const topLeft = screenToCanvas(0, 0, transform);
  const bottomRight = screenToCanvas(containerWidth, containerHeight, transform);

  // Convert to minimap coordinates
  return {
    x: topLeft.x * MINIMAP_SCALE,
    y: topLeft.y * MINIMAP_SCALE,
    width: (bottomRight.x - topLeft.x) * MINIMAP_SCALE,
    height: (bottomRight.y - topLeft.y) * MINIMAP_SCALE,
  };
}

/**
 * Convert minimap click to viewport center
 */
export function minimapClickToViewport(
  clickX: number,
  clickY: number,
  containerWidth: number,
  containerHeight: number,
  currentScale: number
): ViewportTransform {
  // Convert minimap click to canvas coordinates
  const canvasX = clickX / MINIMAP_SCALE;
  const canvasY = clickY / MINIMAP_SCALE;

  // Calculate viewport to center on this point
  return {
    x: containerWidth / 2 - canvasX * currentScale,
    y: containerHeight / 2 - canvasY * currentScale,
    scale: currentScale,
  };
}
