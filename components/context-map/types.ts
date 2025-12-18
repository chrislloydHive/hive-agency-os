// components/context-map/types.ts
// TypeScript types for the Context Map visualization

import type { HydratedContextNode, ContextProposal } from '@/lib/contextGraph/nodes';

// ============================================================================
// Zone Types
// ============================================================================

export type ZoneId =
  | 'business-reality'
  | 'brand'
  | 'offer'
  | 'objectives'
  | 'constraints'
  | 'audience'
  | 'go-to-market'
  | 'competitive'
  | 'execution'
  | 'overflow';

export interface ZoneDefinition {
  id: ZoneId;
  label: string;
  domains: string[];
  position: { row: number; col: number };
  color: string;
}

export interface ZoneBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Info about a missing field for UI display */
export interface MissingFieldInfo {
  key: string;
  label: string;
  isRequired: boolean;
}

export interface ComputedZone extends ZoneDefinition {
  bounds: ZoneBounds;
  nodes: PositionedNode[];
  totalNodes: number;
  visibleNodes: number;
  /** Nodes collapsed due to max visible limit */
  collapsedNodes?: PositionedNode[];
  /** Low-confidence proposed nodes auto-collapsed */
  lowConfidenceCollapsed?: PositionedNode[];
  /** Whether this zone is missing required context fields */
  isMissingRequired?: boolean;
  /** Specific fields that are missing in this zone */
  missingFields?: MissingFieldInfo[];
}

/**
 * Zone collapse UI state
 */
export interface ZoneCollapseState {
  isExpanded: boolean;
  visibleCount: number;
  lowConfidenceCount: number;
}

// ============================================================================
// Node Types
// ============================================================================

/**
 * Visual style tier based on status and confidence
 * Used to determine node prominence in the map
 */
export type NodeVisualTier = 'confirmed' | 'proposed-high' | 'proposed-low' | 'ghost';

export interface PositionedNode extends HydratedContextNode {
  position: { x: number; y: number };
  size: { width: number; height: number };
  zoneId: ZoneId;
  visualTier?: NodeVisualTier;
}

export interface NodeCardProps {
  node: PositionedNode;
  isSelected: boolean;
  isHovered: boolean;
  zoneColor: string;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

// ============================================================================
// Filter Types
// ============================================================================

export type StatusFilter = 'all' | 'confirmed' | 'proposed';
export type SourceFilter = 'user' | 'ai' | 'lab' | 'strategy' | 'import';

export interface MapFilters {
  status: StatusFilter;
  sources: SourceFilter[];
  minConfidence: number;
  showEdges: boolean;
}

// ============================================================================
// Edge Types
// ============================================================================

export interface EdgeDefinition {
  fromZone: ZoneId;
  toZone: ZoneId;
  label?: string;
}

export interface ComputedEdge extends EdgeDefinition {
  fromPoint: { x: number; y: number };
  toPoint: { x: number; y: number };
  isHighlighted: boolean;
}

// ============================================================================
// Transform & Interaction Types
// ============================================================================

export interface Transform {
  x: number;
  y: number;
  scale: number;
}

export interface CanvasProps {
  width: number;
  height: number;
  zones: ComputedZone[];
  edges: ComputedEdge[];
  selectedNode: PositionedNode | null;
  hoveredNode: PositionedNode | null;
  transform: Transform;
  filters: MapFilters;
  onNodeClick: (node: PositionedNode) => void;
  onNodeHover: (node: PositionedNode | null) => void;
  onTransformChange: (transform: Transform) => void;
  onResetView: () => void;
}

// ============================================================================
// Detail Panel Types
// ============================================================================

/** Where-used reference entry - shows what references a context node */
export interface WhereUsedRef {
  type: 'strategy' | 'program' | 'lab' | 'automation';
  id: string;
  label: string;
  link?: string;
}

export interface DetailPanelProps {
  node: HydratedContextNode | null;
  isOpen: boolean;
  onClose: () => void;
  onAcceptProposal?: (proposalId: string, batchId: string) => Promise<void>;
  onRejectProposal?: (proposalId: string, batchId: string) => Promise<void>;
  onEditProposal?: (proposalId: string, batchId: string, value: unknown) => Promise<void>;
  whereUsed?: WhereUsedRef[];
}

// ============================================================================
// Toolbar Types
// ============================================================================

export interface ToolbarProps {
  filters: MapFilters;
  onFiltersChange: (filters: MapFilters) => void;
  onResetView: () => void;
  viewMode: 'map' | 'list';
  onViewModeChange: (mode: 'map' | 'list') => void;
}

// ============================================================================
// View Mode Types
// ============================================================================

export type ViewMode = 'map' | 'list';

// ============================================================================
// List View Types
// ============================================================================

export type SortField = 'label' | 'value' | 'status' | 'source' | 'confidence' | 'lastUpdated' | 'zone';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

export interface ListViewProps {
  nodes: HydratedContextNode[];
  selectedNode: HydratedContextNode | null;
  filters: MapFilters;
  searchQuery: string;
  sortField: SortField;
  sortDirection: SortDirection;
  onNodeClick: (node: HydratedContextNode) => void;
  onSearchChange: (query: string) => void;
  onSortChange: (field: SortField) => void;
}
