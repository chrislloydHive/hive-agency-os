// components/context-map/ContextMapClient.tsx
// Main Context Map client component that orchestrates all subcomponents

'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Map as MapIcon, List } from 'lucide-react';
import type { HydratedContextNode } from '@/lib/contextGraph/nodes';
import type { MapFilters, Transform, PositionedNode, ViewMode } from './types';
import { computeZonesWithNodes, computeEdges, filterNodes, calculateStatistics } from '@/lib/contextMap';
import { ContextMapCanvas } from './ContextMapCanvas';
import { ContextMapToolbar } from './ContextMapToolbar';
import { ContextMapLegend } from './ContextMapLegend';
import { ContextMapDetailPanel } from './ContextMapDetailPanel';
import { ContextMapListView } from './ContextMapListView';
import { ContextMapReadinessStrip } from './ContextMapReadinessStrip';
import { ProposalReviewBanner } from './ProposalReviewBanner';
import { ProposalReviewPanel } from './ProposalReviewPanel';
import { CORE_NODE_KEYS, RECOMMENDED_NODE_KEYS, getShortLabel, getZoneForField, getKeyFromShortLabel } from './constants';
import type { StrategyReadinessResult } from '@/lib/types/context';

interface ContextMapClientProps {
  nodes: HydratedContextNode[];
  companyId: string;
  /** For proposal actions (proposed nodes) */
  onAcceptProposal?: (proposalId: string, batchId: string) => Promise<void>;
  onRejectProposal?: (proposalId: string, batchId: string) => Promise<void>;
  onEditProposal?: (proposalId: string, batchId: string, value: unknown) => Promise<void>;
  /** For confirmed node editing (creates new revision) */
  onUpdateNode?: (nodeKey: string, value: unknown) => Promise<void>;
  /** For deleting a node's value */
  onDeleteNode?: (nodeKey: string) => Promise<void>;
  /** For AI-assisted context suggestions */
  onSuggestWithAI?: (zoneId: string) => Promise<void>;
  /** For adding a new node (AI-assisted or manual) */
  onAddNode?: (zoneId: string, mode: 'ai' | 'manual') => void;
  /** Zone currently loading AI suggestions */
  loadingZoneId?: string | null;
  /** Deep link: Focus on a specific node key */
  focusKey?: string;
  /** Deep link: Focus on multiple node keys (for Fix button) */
  focusKeys?: string[];
  /** Deep link: Focus on a specific zone */
  focusZone?: string;
  /** External view mode control - if provided, hides internal toggle */
  externalViewMode?: ViewMode;
  /** Hide the internal header with view toggle (when parent controls view mode) */
  hideHeader?: boolean;
  /** Initial status filter (for deep links like ?filterStatus=proposed) */
  initialStatusFilter?: 'all' | 'confirmed' | 'proposed';
  /** Deep link: Focus on a specific proposal batch (opens review panel filtered to this batch) */
  focusBatchId?: string;
}

const DEFAULT_FILTERS: MapFilters = {
  status: 'all',
  sources: [],
  minConfidence: 0,
  showEdges: false,
};

const DEFAULT_TRANSFORM: Transform = {
  x: 40,
  y: 40,
  scale: 1,
};

/**
 * Calculate strategy readiness from nodes
 *
 * TWO-LEVEL READINESS:
 * - CORE_NODE_KEYS: Hard blockers - missing these shows "Context incomplete" (red)
 * - RECOMMENDED_NODE_KEYS: Soft gaps - missing these shows "Context gaps" (amber)
 *
 * Context gaps inform AI confidence but do not halt workflow.
 */
function calculateReadinessFromNodes(nodes: HydratedContextNode[]): StrategyReadinessResult {
  const nodesByKey = new Map(nodes.map(n => [n.key, n]));
  const missingCritical: string[] = [];
  const missingRecommended: string[] = [];
  let confirmedCount = 0;

  // Check CORE fields (hard blockers)
  for (const key of CORE_NODE_KEYS) {
    const node = nodesByKey.get(key);
    const label = getShortLabel(key);

    if (!node || node.value === null || node.value === undefined) {
      missingCritical.push(label);
    } else if (node.status === 'proposed' || node.pendingProposal) {
      // Proposed but not confirmed - still counts as "needs review" but not blocking
      missingRecommended.push(label);
      confirmedCount++; // Count it towards completeness since it has a value
    } else {
      confirmedCount++;
    }
  }

  // Check RECOMMENDED fields (soft gaps - never block)
  for (const key of RECOMMENDED_NODE_KEYS) {
    const node = nodesByKey.get(key);
    const label = getShortLabel(key);

    if (!node || node.value === null || node.value === undefined) {
      // Missing recommended field - soft gap, never blocks
      missingRecommended.push(label);
    }
    // Note: We don't count recommended fields in completeness score
    // They're informational only
  }

  const totalCore = CORE_NODE_KEYS.length;
  const completenessScore = Math.round((confirmedCount / totalCore) * 100);

  let status: 'ready' | 'blocked' | 'needs_info';
  if (missingCritical.length === 0 && missingRecommended.length === 0) {
    status = 'ready';
  } else if (missingCritical.length > 0) {
    status = 'blocked';
  } else {
    status = 'needs_info'; // Only soft gaps - doesn't block
  }

  return {
    status,
    missingCritical,
    missingRecommended,
    completenessScore,
  };
}

export function ContextMapClient({
  nodes,
  companyId: _companyId,
  onAcceptProposal,
  onRejectProposal,
  onEditProposal,
  onUpdateNode,
  onDeleteNode,
  onSuggestWithAI,
  onAddNode,
  loadingZoneId,
  focusKey,
  focusKeys,
  focusZone,
  externalViewMode,
  hideHeader = false,
  initialStatusFilter,
  focusBatchId,
}: ContextMapClientProps) {
  // Merge focusKey into focusKeys for unified handling
  const allFocusKeys = useMemo(() => {
    const keys = new Set<string>();
    if (focusKey) keys.add(focusKey);
    if (focusKeys) focusKeys.forEach(k => keys.add(k));
    return Array.from(keys);
  }, [focusKey, focusKeys]);
  // View mode state - use external mode if provided
  const [internalViewMode, setInternalViewMode] = useState<ViewMode>('map');
  const viewMode = externalViewMode ?? internalViewMode;
  const setViewMode = setInternalViewMode;

  // Build default filters with initial status if provided
  const defaultFiltersWithInitial: MapFilters = {
    ...DEFAULT_FILTERS,
    status: initialStatusFilter ?? 'all',
  };

  // Track if initial focus has been handled
  const [initialFocusHandled, setInitialFocusHandled] = useState(false);
  const [initialBatchHandled, setInitialBatchHandled] = useState(false);

  // Map state
  const [selectedNode, setSelectedNode] = useState<PositionedNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<PositionedNode | null>(null);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [filters, setFilters] = useState<MapFilters>(defaultFiltersWithInitial);
  const [transform, setTransform] = useState<Transform>(DEFAULT_TRANSFORM);

  // Detail panel state
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);

  // Proposal review panel state
  const [proposalReviewOpen, setProposalReviewOpen] = useState(false);

  // Filter nodes based on current filters
  const filteredNodes = useMemo(() => {
    return filterNodes(nodes, filters);
  }, [nodes, filters]);

  // Compute zones with positioned nodes
  const zones = useMemo(() => {
    return computeZonesWithNodes(filteredNodes, {
      canvasWidth: 1200,
      canvasHeight: 900,
      padding: 20,
      maxNodesPerZone: 12,
    });
  }, [filteredNodes]);

  // Compute edges between zones
  const edges = useMemo(() => {
    return computeEdges(zones);
  }, [zones]);

  // Statistics for toolbar
  const stats = useMemo(() => {
    return calculateStatistics(nodes);
  }, [nodes]);

  // Strategy readiness calculated from nodes
  const strategyReadiness = useMemo(() => {
    return calculateReadinessFromNodes(nodes);
  }, [nodes]);

  // Debug: Log when nodes change
  useEffect(() => {
    console.log('[ContextMapClient] nodes prop updated:', {
      count: nodes.length,
      confirmedCount: nodes.filter(n => n.status === 'confirmed').length,
      proposedCount: nodes.filter(n => n.status === 'proposed').length,
      withPendingProposal: nodes.filter(n => !!n.pendingProposal).length,
    });
  }, [nodes]);

  // Deep link handler: Focus on a specific node or zone when provided
  useEffect(() => {
    if (initialFocusHandled) return;

    // Handle focusKey - find and select the node, open detail panel
    if (focusKey && zones.length > 0) {
      // Find the node with this key in any zone
      for (const zone of zones) {
        const foundNode = zone.nodes.find(n => n.key === focusKey);
        if (foundNode) {
          console.log(`[ContextMapClient] Deep link: focusing on node ${focusKey}`);
          setSelectedNode(foundNode);
          setDetailPanelOpen(true);
          setInitialFocusHandled(true);
          return;
        }
      }
      console.log(`[ContextMapClient] Deep link: node ${focusKey} not found`);
    }

    // Handle focusZone - just highlight the zone (already happens via URL params)
    if (focusZone && zones.length > 0) {
      console.log(`[ContextMapClient] Deep link: focusing on zone ${focusZone}`);
      setHoveredZone(focusZone);
      setInitialFocusHandled(true);
    }
  }, [focusKey, focusZone, zones, initialFocusHandled]);

  // Deep link handler: Auto-open proposal review panel when focusBatchId is present
  useEffect(() => {
    if (focusBatchId && !initialBatchHandled) {
      console.log(`[ContextMapClient] Deep link: opening proposal review for batch ${focusBatchId}`);
      setProposalReviewOpen(true);
      setInitialBatchHandled(true);
    }
  }, [focusBatchId, initialBatchHandled]);

  // Filter nodes for proposal review panel (by batch if specified via deep link)
  const proposalNodesForReview = useMemo(() => {
    if (!focusBatchId) return nodes;
    return nodes.filter(n => n.proposalBatchId === focusBatchId);
  }, [nodes, focusBatchId]);

  // Handlers
  const handleNodeClick = useCallback((node: PositionedNode | HydratedContextNode) => {
    // Convert HydratedContextNode to PositionedNode if needed for list view
    const positionedNode = 'position' in node
      ? node
      : { ...node, position: { x: 0, y: 0 }, size: { width: 0, height: 0 }, zoneId: 'overflow' as const };
    setSelectedNode(positionedNode);
    setDetailPanelOpen(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetailPanelOpen(false);
    setSelectedNode(null);
  }, []);

  const handleResetView = useCallback(() => {
    setTransform(DEFAULT_TRANSFORM);
  }, []);

  const handleFiltersChange = useCallback((newFilters: MapFilters) => {
    setFilters(newFilters);
  }, []);

  // Handle "Fix" click from readiness strip - find missing fields and focus on them
  const handleReadinessFixClick = useCallback((type: 'strategy' | 'program') => {
    console.log('[ContextMap] Fix clicked for:', type);

    // Get missing fields - first check core (hard blockers), then recommended (soft gaps)
    const nodesByKey = new Map(nodes.map(n => [n.key, n]));
    const missingCoreKeys: string[] = [];
    const missingRecommendedKeys: string[] = [];

    // Check core fields (hard blockers)
    for (const key of CORE_NODE_KEYS) {
      const node = nodesByKey.get(key);
      if (!node || node.value === null || node.value === undefined) {
        missingCoreKeys.push(key);
      }
    }

    // Check recommended fields (soft gaps)
    for (const key of RECOMMENDED_NODE_KEYS) {
      const node = nodesByKey.get(key);
      if (!node || node.value === null || node.value === undefined) {
        missingRecommendedKeys.push(key);
      }
    }

    // Prioritize fixing core fields first, then recommended
    const missingKeys = missingCoreKeys.length > 0 ? missingCoreKeys : missingRecommendedKeys;

    if (missingKeys.length === 0) {
      console.log('[ContextMap] No missing fields to fix');
      return;
    }

    // Focus on the first missing field by opening its zone's add modal
    // Use getZoneForField to properly map node keys to zone IDs
    const firstMissingKey = missingKeys[0];
    const zoneId = getZoneForField(firstMissingKey); // e.g., "identity.businessModel" → "business-reality"

    console.log(`[ContextMap] Missing core keys:`, missingCoreKeys);
    console.log(`[ContextMap] Missing recommended keys:`, missingRecommendedKeys);
    console.log(`[ContextMap] First missing key: ${firstMissingKey} → Zone: ${zoneId}`);

    // Trigger AI suggestion for the zone with missing fields
    // This opens the AI-assisted add flow for that zone
    if (onSuggestWithAI) {
      console.log(`[ContextMap] Triggering AI suggest for zone: ${zoneId}`);
      onSuggestWithAI(zoneId);
    } else if (onAddNode) {
      // Fallback: open manual add modal
      console.log(`[ContextMap] Opening add modal for zone: ${zoneId}`);
      onAddNode(zoneId, 'manual');
    }
  }, [nodes, onSuggestWithAI, onAddNode]);

  // Handle click on a specific field badge in readiness strip
  // Navigates directly to the zone containing that field and opens manual edit
  const handleFieldClick = useCallback((fieldLabel: string, _isCritical: boolean) => {
    console.log(`[ContextMap] Field badge clicked: "${fieldLabel}"`);

    // Convert label back to field key
    const fieldKey = getKeyFromShortLabel(fieldLabel);
    if (!fieldKey) {
      console.warn(`[ContextMap] Could not find field key for label: "${fieldLabel}"`);
      return;
    }

    console.log(`[ContextMap] Resolved field key: ${fieldKey}`);

    // Get the zone for this field
    const zoneId = getZoneForField(fieldKey);
    console.log(`[ContextMap] Zone for field: ${zoneId}`);

    // Open manual add/edit modal for this zone
    // This allows the user to directly fill in the missing field
    if (onAddNode) {
      console.log(`[ContextMap] Opening manual edit modal for zone: ${zoneId}`);
      onAddNode(zoneId, 'manual');
    } else {
      console.warn('[ContextMap] onAddNode not provided, cannot open edit modal');
    }
  }, [onAddNode]);

  // Quick confirm handler - confirms a proposed node with its current value
  const handleQuickConfirm = useCallback(async (node: PositionedNode) => {
    if (!onUpdateNode) {
      console.warn('[ContextMap] Quick confirm: onUpdateNode not provided');
      return;
    }
    try {
      console.log(`[ContextMap] Quick confirm: saving ${node.key}...`);
      await onUpdateNode(node.key, node.value);
      console.log(`[ContextMap] Quick confirm: saved ${node.key} successfully`);
    } catch (error) {
      console.error(`[ContextMap] Quick confirm failed for ${node.key}:`, error);
    }
  }, [onUpdateNode]);

  // Delete node handler - removes a node's value
  const handleDeleteNode = useCallback(async (node: PositionedNode) => {
    if (!onDeleteNode) {
      console.warn('[ContextMap] Delete: onDeleteNode not provided');
      return;
    }
    try {
      console.log(`[ContextMap] Delete: deleting ${node.key}...`);
      await onDeleteNode(node.key);
      console.log(`[ContextMap] Delete: deleted ${node.key} successfully`);
      // Close detail panel if this was the selected node
      if (selectedNode?.key === node.key) {
        setDetailPanelOpen(false);
        setSelectedNode(null);
      }
    } catch (error) {
      console.error(`[ContextMap] Delete failed for ${node.key}:`, error);
    }
  }, [onDeleteNode, selectedNode]);

  // Accept all proposals handler
  const handleAcceptAllProposals = useCallback(async () => {
    if (!onAcceptProposal) return;

    const proposalNodes = nodes.filter(n => n.pendingProposal && n.proposalBatchId);
    console.log(`[ContextMap] Accepting all ${proposalNodes.length} proposals...`);

    for (const node of proposalNodes) {
      if (node.pendingProposal && node.proposalBatchId) {
        try {
          await onAcceptProposal(node.pendingProposal.id, node.proposalBatchId);
        } catch (error) {
          console.error(`[ContextMap] Failed to accept proposal for ${node.key}:`, error);
        }
      }
    }
  }, [nodes, onAcceptProposal]);

  // Reject all proposals handler
  const handleRejectAllProposals = useCallback(async () => {
    if (!onRejectProposal) return;

    const proposalNodes = nodes.filter(n => n.pendingProposal && n.proposalBatchId);
    console.log(`[ContextMap] Rejecting all ${proposalNodes.length} proposals...`);

    for (const node of proposalNodes) {
      if (node.pendingProposal && node.proposalBatchId) {
        try {
          await onRejectProposal(node.pendingProposal.id, node.proposalBatchId);
        } catch (error) {
          console.error(`[ContextMap] Failed to reject proposal for ${node.key}:`, error);
        }
      }
    }
  }, [nodes, onRejectProposal]);

  // Get the raw HydratedContextNode for detail panel
  const selectedRawNode = useMemo(() => {
    if (!selectedNode) return null;
    return nodes.find((n) => n.key === selectedNode.key) || null;
  }, [selectedNode, nodes]);

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header with View Toggle - hidden when parent controls view mode */}
      {!hideHeader && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/50">
          <div className="text-sm font-medium text-slate-200">Context Map</div>

          {/* View Mode Toggle - only shown when not controlled externally */}
          {!externalViewMode && (
            <div className="flex items-center gap-1 p-0.5 bg-slate-800 rounded-lg">
              <button
                onClick={() => setViewMode('map')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'map'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                Map
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'list'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                List
              </button>
            </div>
          )}
        </div>
      )}

      {/* Toolbar */}
      <ContextMapToolbar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onResetView={handleResetView}
        stats={stats}
      />

      {/* Readiness Strip */}
      <ContextMapReadinessStrip
        strategyReadiness={strategyReadiness}
        onFixClick={handleReadinessFixClick}
        onFieldClick={handleFieldClick}
      />

      {/* Proposal Review Banner */}
      <ProposalReviewBanner
        nodes={nodes}
        onReviewClick={() => setProposalReviewOpen(true)}
        onAcceptAll={onAcceptProposal ? handleAcceptAllProposals : undefined}
        onRejectAll={onRejectProposal ? handleRejectAllProposals : undefined}
      />

      {/* Main Content */}
      <div className="flex-1 relative overflow-hidden">
        {viewMode === 'map' ? (
          <>
            <ContextMapCanvas
              zones={zones}
              edges={edges}
              selectedNode={selectedNode}
              hoveredNode={hoveredNode}
              hoveredZone={hoveredZone}
              transform={transform}
              filters={filters}
              loadingZoneId={loadingZoneId}
              onNodeClick={handleNodeClick}
              onNodeHover={setHoveredNode}
              onZoneHover={setHoveredZone}
              onTransformChange={setTransform}
              onResetView={handleResetView}
              onSuggestWithAI={onSuggestWithAI}
              onQuickConfirm={onUpdateNode ? handleQuickConfirm : undefined}
              onDeleteNode={onDeleteNode ? handleDeleteNode : undefined}
              onAddNode={onAddNode}
            />
            <ContextMapLegend compact />
          </>
        ) : (
          <ContextMapListView
            nodes={filteredNodes}
            filters={filters}
            onNodeClick={handleNodeClick}
            selectedNode={selectedRawNode}
            onAcceptProposal={onAcceptProposal}
            onRejectProposal={onRejectProposal}
            onDeleteNode={onDeleteNode}
            onAddNode={onAddNode}
            loadingZoneId={loadingZoneId}
          />
        )}
      </div>

      {/* Detail Panel */}
      <ContextMapDetailPanel
        node={selectedRawNode}
        isOpen={detailPanelOpen}
        onClose={handleCloseDetail}
        onAcceptProposal={onAcceptProposal}
        onRejectProposal={onRejectProposal}
        onEditProposal={onEditProposal}
        onUpdateNode={onUpdateNode}
        onDeleteNode={onDeleteNode}
      />

      {/* Proposal Review Panel */}
      {onAcceptProposal && onRejectProposal && (
        <ProposalReviewPanel
          isOpen={proposalReviewOpen}
          nodes={proposalNodesForReview}
          onClose={() => setProposalReviewOpen(false)}
          onAcceptProposal={onAcceptProposal}
          onRejectProposal={onRejectProposal}
          onEditProposal={onEditProposal}
          onAcceptAll={handleAcceptAllProposals}
          onRejectAll={handleRejectAllProposals}
          focusBatchId={focusBatchId}
        />
      )}
    </div>
  );
}
