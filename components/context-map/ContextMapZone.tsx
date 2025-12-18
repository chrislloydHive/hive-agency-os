// components/context-map/ContextMapZone.tsx
// Zone container component for the Context Map with collapsing support
//
// Uses foreignObject to embed HTML for proper flexbox layout and scrolling.
// Cards are full-width and the node list scrolls internally when overflow occurs.

'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ComputedZone, PositionedNode } from './types';
import { ContextMapNodeCardHTML } from './ContextMapNodeCardHTML';
import type { NodeCardAction } from './NodeCardActionMenu';
import { ZoneCollapseChip } from './ZoneCollapseChip';
import { LAYOUT } from './constants';

interface ContextMapZoneProps {
  zone: ComputedZone;
  selectedNode: PositionedNode | null;
  hoveredNode: PositionedNode | null;
  isHovered: boolean;
  isDimmed?: boolean;
  onNodeClick: (node: PositionedNode) => void;
  onNodeHover: (node: PositionedNode | null) => void;
  onZoneHover: (zoneId: string | null) => void;
  onSuggestWithAI?: (zoneId: string) => void;
  onQuickConfirm?: (node: PositionedNode) => void;
  /** Called when user wants to edit a node's value */
  onEditNode?: (node: PositionedNode) => void;
  /** Called when user wants to view node details */
  onViewNode?: (node: PositionedNode) => void;
  /** Called when user wants to delete a node */
  onDeleteNode?: (node: PositionedNode) => void;
  /** Called when user wants to add a new node (AI-assisted or manual) */
  onAddNode?: (zoneId: string, mode: 'ai' | 'manual') => void;
  loadingZoneId?: string | null;
}

export function ContextMapZone({
  zone,
  selectedNode,
  hoveredNode,
  isHovered,
  isDimmed = false,
  onNodeClick,
  onNodeHover,
  onZoneHover,
  onSuggestWithAI,
  onQuickConfirm,
  onEditNode,
  onViewNode,
  onDeleteNode,
  onAddNode,
  loadingZoneId,
}: ContextMapZoneProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { bounds, label, color, nodes, totalNodes, visibleNodes } = zone;

  // Close menu when clicking outside (but not on the dropdown itself)
  useEffect(() => {
    if (!showAddMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const isOutsideButton = addButtonRef.current && !addButtonRef.current.contains(target);
      const isOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(target);
      if (isOutsideButton && isOutsideDropdown) {
        setShowAddMenu(false);
      }
    };
    // Use mousedown with a small delay to let click events fire first
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAddMenu]);

  // Get collapsed node counts
  const collapsedCount = zone.collapsedNodes?.length || 0;
  const lowConfidenceCount = zone.lowConfidenceCollapsed?.length || 0;
  const totalCollapsed = collapsedCount + lowConfidenceCount;

  // Calculate displayed nodes based on expansion state
  const displayedNodes = useMemo(() => {
    if (!isExpanded) {
      return nodes;
    }

    // When expanded, include collapsed nodes
    const allNodes = [...nodes];

    // Add regular collapsed nodes
    if (zone.collapsedNodes) {
      // Recalculate positions for expanded nodes
      const { NODE_WIDTH, NODE_HEIGHT, NODE_GAP, ZONE_HEADER_HEIGHT } = LAYOUT;
      const contentWidth = bounds.width - (NODE_GAP * 2);
      const cols = Math.max(1, Math.floor((contentWidth + NODE_GAP) / (NODE_WIDTH + NODE_GAP)));

      zone.collapsedNodes.forEach((node, index) => {
        const totalIndex = nodes.length + index;
        const col = totalIndex % cols;
        const row = Math.floor(totalIndex / cols);

        allNodes.push({
          ...node,
          position: {
            x: bounds.x + NODE_GAP + (col * (NODE_WIDTH + NODE_GAP)),
            y: bounds.y + ZONE_HEADER_HEIGHT + NODE_GAP + (row * (NODE_HEIGHT + NODE_GAP)),
          },
        });
      });
    }

    // Add low-confidence collapsed nodes
    if (zone.lowConfidenceCollapsed) {
      const { NODE_WIDTH, NODE_HEIGHT, NODE_GAP, ZONE_HEADER_HEIGHT } = LAYOUT;
      const contentWidth = bounds.width - (NODE_GAP * 2);
      const cols = Math.max(1, Math.floor((contentWidth + NODE_GAP) / (NODE_WIDTH + NODE_GAP)));

      zone.lowConfidenceCollapsed.forEach((node, index) => {
        const totalIndex = nodes.length + (zone.collapsedNodes?.length || 0) + index;
        const col = totalIndex % cols;
        const row = Math.floor(totalIndex / cols);

        allNodes.push({
          ...node,
          position: {
            x: bounds.x + NODE_GAP + (col * (NODE_WIDTH + NODE_GAP)),
            y: bounds.y + ZONE_HEADER_HEIGHT + NODE_GAP + (row * (NODE_HEIGHT + NODE_GAP)),
          },
        });
      });
    }

    return allNodes;
  }, [nodes, zone.collapsedNodes, zone.lowConfidenceCollapsed, isExpanded, bounds]);

  // Calculate chip position (at bottom of zone)
  const chipY = bounds.y + bounds.height - 36;
  const chipPosition = { x: bounds.x + 8, y: chipY };
  const chipWidth = bounds.width - 16;

  // Show collapse chip if there are hidden nodes
  const showCollapseChip = totalCollapsed > 0;

  // Build actions for a node
  const getNodeActions = useCallback((node: PositionedNode): NodeCardAction[] => {
    const actions: NodeCardAction[] = [];
    const isProposed = node.status === 'proposed' || !!node.pendingProposal;

    // View action - always available
    if (onViewNode) {
      actions.push({
        id: 'view',
        label: 'View Details',
        icon: 'view',
        onClick: () => onViewNode(node),
      });
    }

    // Edit action - always available for confirmed, or to edit proposal
    if (onEditNode) {
      actions.push({
        id: 'edit',
        label: isProposed ? 'Edit Proposal' : 'Edit Value',
        icon: 'edit',
        onClick: () => onEditNode(node),
      });
    }

    // Quick confirm action - only for proposed nodes
    if (isProposed && onQuickConfirm) {
      actions.push({
        id: 'confirm',
        label: 'Confirm Value',
        icon: 'confirm',
        onClick: () => onQuickConfirm(node),
      });
    }

    // Delete action - available for nodes with values
    if (onDeleteNode && node.value) {
      actions.push({
        id: 'delete',
        label: 'Delete Value',
        icon: 'delete',
        destructive: true,
        onClick: () => onDeleteNode(node),
      });
    }

    return actions;
  }, [onViewNode, onEditNode, onQuickConfirm, onDeleteNode]);

  // Calculate content area dimensions
  const headerHeight = 36;
  const chipHeight = showCollapseChip ? 36 : 0;
  const contentPadding = 8;
  const contentTop = bounds.y + headerHeight;
  const contentHeight = bounds.height - headerHeight - chipHeight;

  return (
    <g
      onMouseEnter={() => onZoneHover(zone.id)}
      onMouseLeave={() => onZoneHover(null)}
      style={{
        opacity: isDimmed ? 0.3 : 1,
        transition: 'opacity 200ms ease-in-out',
      }}
    >
      {/* Zone background */}
      <rect
        x={bounds.x}
        y={bounds.y}
        width={bounds.width}
        height={bounds.height}
        rx={12}
        fill="rgba(30, 41, 59, 0.4)"
        stroke={isHovered ? color : 'rgba(51, 65, 85, 0.5)'}
        strokeWidth={isHovered ? 2 : 1}
        className="transition-all duration-200"
      />

      {/* Zone header */}
      <g>
        {/* Header background */}
        <rect
          x={bounds.x}
          y={bounds.y}
          width={bounds.width}
          height={36}
          rx={12}
          fill={`${color}15`}
        />
        {/* Round only top corners by clipping bottom */}
        <rect
          x={bounds.x}
          y={bounds.y + 12}
          width={bounds.width}
          height={24}
          fill={`${color}15`}
        />

        {/* Zone label */}
        <text
          x={bounds.x + 12}
          y={bounds.y + 23}
          fill={color}
          fontSize={13}
          fontWeight={600}
          className="select-none"
        >
          {label}
        </text>

        {/* Node count (shifted left to make room for Add button) */}
        <text
          x={bounds.x + bounds.width - (onAddNode ? 36 : 12)}
          y={bounds.y + 23}
          fill="rgba(148, 163, 184, 0.7)"
          fontSize={11}
          textAnchor="end"
          className="select-none"
        >
          {isExpanded
            ? totalNodes
            : totalNodes > visibleNodes
              ? `${visibleNodes}/${totalNodes}`
              : totalNodes}
        </text>

        {/* Add button in header */}
        {onAddNode && (
          <foreignObject
            x={bounds.x + bounds.width - 32}
            y={bounds.y + 6}
            width={24}
            height={24}
          >
            <div
              // @ts-expect-error - xmlns is valid for foreignObject
              xmlns="http://www.w3.org/1999/xhtml"
            >
              <button
                ref={addButtonRef}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!showAddMenu) {
                    // Calculate screen position for portal
                    const rect = (e.target as HTMLElement).getBoundingClientRect();
                    setMenuPosition({
                      top: rect.bottom + 4,
                      left: rect.right - 170,
                    });
                  }
                  setShowAddMenu(!showAddMenu);
                }}
                className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                title="Add context"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </foreignObject>
        )}

        {/* Dropdown menu - rendered via portal to avoid SVG pointer-events issues */}
        {onAddNode && showAddMenu && menuPosition && typeof document !== 'undefined' && createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[9999]"
            style={{ top: menuPosition.top, left: menuPosition.left }}
          >
            <div className="min-w-[170px] py-2 bg-slate-800 border-2 border-cyan-400 rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.7)]">
              <button
                onClick={() => {
                  setShowAddMenu(false);
                  onAddNode(zone.id, 'ai');
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-600/50 transition-colors"
              >
                <span className="text-purple-400 text-lg">✨</span>
                Add with AI
              </button>
              <button
                onClick={() => {
                  setShowAddMenu(false);
                  onAddNode(zone.id, 'manual');
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-600/50 transition-colors"
              >
                <span className="text-cyan-400 text-lg">+</span>
                Add manually
              </button>
            </div>
          </div>,
          document.body
        )}
      </g>

      {/* Node cards container using foreignObject for HTML/CSS layout */}
      <foreignObject
        x={bounds.x}
        y={contentTop}
        width={bounds.width}
        height={contentHeight}
      >
        <div
          // @ts-expect-error - xmlns is valid for foreignObject
          xmlns="http://www.w3.org/1999/xhtml"
          className="flex flex-col h-full min-h-0 w-full"
          style={{ minHeight: 0 }} // Critical for flex children
          onWheel={(e) => e.stopPropagation()}
        >
          {/* Scrollable card list */}
          <div
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
            style={{
              padding: contentPadding,
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(100, 116, 139, 0.3) transparent',
            }}
            onWheel={(e) => {
              // Stop wheel events from bubbling to canvas (prevents zoom while scrolling)
              e.stopPropagation();
            }}
            onMouseDown={(e) => {
              // Stop mousedown from triggering canvas pan
              e.stopPropagation();
            }}
          >
            <div className="flex flex-col gap-2 w-full min-w-0">
              {displayedNodes.length > 0 ? (
                displayedNodes.map((node) => (
                  <ContextMapNodeCardHTML
                    key={node.key}
                    node={node}
                    zoneColor={color}
                    isSelected={selectedNode?.key === node.key}
                    isHovered={hoveredNode?.key === node.key}
                    onClick={() => onNodeClick(node)}
                    onMouseEnter={() => onNodeHover(node)}
                    onMouseLeave={() => onNodeHover(null)}
                    onQuickConfirm={onQuickConfirm ? () => onQuickConfirm(node) : undefined}
                    actions={getNodeActions(node)}
                  />
                ))
              ) : (
                /* Empty zone placeholder - shows specific missing fields */
                <div
                  className={`w-full p-4 rounded-lg border border-dashed ${
                    loadingZoneId === zone.id
                      ? 'border-cyan-500/50 bg-cyan-500/10'
                      : zone.missingFields?.some(f => f.isRequired)
                        ? 'border-red-500/40 bg-red-900/20'
                        : 'border-amber-500/30 bg-slate-800/30'
                  }`}
                >
                  {loadingZoneId === zone.id ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-cyan-400">Generating AI suggestions...</span>
                    </div>
                  ) : (
                    <>
                      {/* Show specific missing fields */}
                      {zone.missingFields && zone.missingFields.length > 0 ? (
                        <>
                          <div className="flex items-start gap-2 mb-2">
                            {zone.missingFields.some(f => f.isRequired) ? (
                              <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                            <div className="flex-1 min-w-0">
                              <span className={`text-xs font-medium ${zone.missingFields.some(f => f.isRequired) ? 'text-red-300' : 'text-amber-300'}`}>
                                Missing context:
                              </span>
                              <ul className="mt-1 space-y-0.5">
                                {zone.missingFields.slice(0, 4).map((field) => (
                                  <li key={field.key} className="flex items-center gap-1.5 text-[11px]">
                                    <span className={`w-1 h-1 rounded-full ${field.isRequired ? 'bg-red-400' : 'bg-slate-500'}`} />
                                    <span className={field.isRequired ? 'text-red-200' : 'text-slate-400'}>
                                      {field.label}
                                      {field.isRequired && <span className="text-red-400 ml-0.5">*</span>}
                                    </span>
                                  </li>
                                ))}
                                {zone.missingFields.length > 4 && (
                                  <li className="text-[11px] text-slate-500">
                                    +{zone.missingFields.length - 4} more
                                  </li>
                                )}
                              </ul>
                            </div>
                          </div>
                          {/* Action buttons */}
                          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-700/50">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSuggestWithAI?.(zone.id);
                              }}
                              className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-purple-300 bg-purple-500/10 border border-purple-500/30 rounded hover:bg-purple-500/20 transition-colors"
                            >
                              <span>✨</span>
                              Propose with AI
                            </button>
                            {onAddNode && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAddNode(zone.id, 'manual');
                                }}
                                className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-slate-300 bg-slate-700/50 border border-slate-600/50 rounded hover:bg-slate-700 transition-colors"
                              >
                                <span>+</span>
                                Add manually
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        /* Fallback for empty zones without specific field info */
                        <>
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              onSuggestWithAI?.(zone.id);
                            }}
                            className="flex items-center gap-2 text-slate-400 cursor-pointer hover:text-slate-300 transition-colors"
                          >
                            <span className="text-sm">+</span>
                            <span className="text-xs">Add context</span>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </foreignObject>

      {/* Collapse/Expand chip */}
      {showCollapseChip && (
        <ZoneCollapseChip
          count={totalCollapsed}
          lowConfidenceCount={lowConfidenceCount}
          isExpanded={isExpanded}
          position={chipPosition}
          width={chipWidth}
          onClick={() => setIsExpanded(!isExpanded)}
        />
      )}
    </g>
  );
}

// Note: GhostSuggestionCard is now rendered inline in the zone component
// for proper HTML/CSS layout inside foreignObject
