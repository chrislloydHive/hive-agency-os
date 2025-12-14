// components/context-map/ContextMapNodeCardHTML.tsx
// HTML-based node card for use inside foreignObject containers
// Supports full-width layout and CSS-based styling
//
// NOTE: Action menus use Portal to render outside the scroll container,
// preventing clipping by overflow: auto/hidden.

'use client';

import type { PositionedNode, NodeVisualTier } from './types';
import { getShortLabel, truncateValue, formatRelativeTime, SOURCE_LABELS, COLORS, VISUAL_TIERS, LOW_CONFIDENCE_THRESHOLD } from './constants';
import { NodeCardActionMenu, type NodeCardAction } from './NodeCardActionMenu';

interface ContextMapNodeCardHTMLProps {
  node: PositionedNode;
  zoneColor: string;
  isSelected: boolean;
  isHovered: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onQuickConfirm?: () => void;
  /** Optional actions for the card's dropdown menu */
  actions?: NodeCardAction[];
  /** Called when action menu opens/closes (useful for preventing card click) */
  onActionMenuOpenChange?: (open: boolean) => void;
}

/**
 * Determine the visual tier for a node based on status and confidence
 */
function getVisualTier(node: PositionedNode): NodeVisualTier {
  const isProposed = node.status === 'proposed' || !!node.pendingProposal;
  if (!isProposed) return 'confirmed';
  if (node.confidence >= LOW_CONFIDENCE_THRESHOLD) return 'proposed-high';
  return 'proposed-low';
}

/**
 * Get the tier configuration for styling
 */
function getTierConfig(tier: NodeVisualTier) {
  switch (tier) {
    case 'confirmed':
      return VISUAL_TIERS.CONFIRMED;
    case 'proposed-high':
      return VISUAL_TIERS.PROPOSED_HIGH;
    case 'proposed-low':
      return VISUAL_TIERS.PROPOSED_LOW;
    case 'ghost':
      return VISUAL_TIERS.GHOST;
  }
}

export function ContextMapNodeCardHTML({
  node,
  zoneColor,
  isSelected,
  isHovered,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onQuickConfirm,
  actions,
  onActionMenuOpenChange,
}: ContextMapNodeCardHTMLProps) {
  const { status, source, confidence, lastUpdated, value, pendingProposal } = node;

  // Determine visual tier and get styling config
  const visualTier = node.visualTier || getVisualTier(node);
  const tierConfig = getTierConfig(visualTier);

  const isProposed = status === 'proposed' || !!pendingProposal;
  const borderColor = isProposed ? COLORS.PROPOSED_COLOR : zoneColor;

  // Apply tier-based styling
  const opacity = tierConfig.opacity;
  const bgOpacity = tierConfig.bgOpacity;

  const label = getShortLabel(node.key);
  const valuePreview = truncateValue(value, 50);
  const relativeTime = formatRelativeTime(lastUpdated);
  const confidencePercent = Math.round(confidence * 100);

  // Source icon character
  const sourceIcon = source === 'ai' ? '✨' : source === 'user' ? '👤' : source === 'lab' ? '🔬' : '📥';

  // Border style based on tier
  const borderStyle = tierConfig.borderStyle === 'dashed' ? 'dashed' :
                      tierConfig.borderStyle === 'dotted' ? 'dotted' : 'solid';

  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="w-full cursor-pointer transition-all duration-150"
      style={{
        opacity,
        minWidth: 0, // Critical for flex children
      }}
    >
      <div
        className="w-full p-2 rounded-lg transition-all duration-150"
        style={{
          backgroundColor: `rgba(30, 41, 59, ${bgOpacity})`,
          border: `${tierConfig.borderWidth}px ${borderStyle} ${isSelected ? '#22d3ee' : borderColor}`,
          boxShadow: isSelected ? '0 0 0 2px rgba(34, 211, 238, 0.3)' : undefined,
        }}
      >
        {/* Header row: source icon + label + status badge + action menu */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="text-[10px] flex-shrink-0">{sourceIcon}</span>
            <span className="text-xs font-medium text-slate-200 truncate">
              {label}
            </span>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Status badge - show tier for proposed nodes */}
            {isProposed && (
              <span
                className="px-1.5 py-0.5 text-[9px] font-medium rounded"
                style={{
                  backgroundColor: visualTier === 'proposed-low' ? 'rgba(100, 116, 139, 0.3)' : `${COLORS.PROPOSED_COLOR}30`,
                  color: visualTier === 'proposed-low' ? '#94a3b8' : COLORS.PROPOSED_COLOR,
                }}
              >
                {visualTier === 'proposed-low' ? 'LOW CONF' : 'PROPOSED'}
              </span>
            )}

            {/* Pending proposal indicator */}
            {pendingProposal && (
              <span
                className="w-2.5 h-2.5 rounded-full animate-pulse"
                style={{ backgroundColor: COLORS.PROPOSED_COLOR }}
              />
            )}

            {/* Action menu - renders via Portal to avoid scroll clipping */}
            {actions && actions.length > 0 && (
              <NodeCardActionMenu
                actions={actions}
                onOpenChange={onActionMenuOpenChange}
              />
            )}
          </div>
        </div>

        {/* Value preview */}
        <div
          className="text-[11px] mt-1.5 truncate min-w-0"
          style={{ color: visualTier === 'proposed-low' ? '#64748b' : '#94a3b8' }}
        >
          {valuePreview || <span className="italic text-slate-500">(empty)</span>}
        </div>

        {/* Footer row: confidence + updated + quick confirm */}
        <div className="flex items-center justify-between mt-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            {/* Confidence bar */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <div className="w-10 h-1 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${confidencePercent}%`,
                    backgroundColor: confidence > 0.7 ? '#22c55e' : confidence > 0.4 ? '#f59e0b' : '#ef4444',
                  }}
                />
              </div>
              <span className="text-[9px] text-slate-500">{confidencePercent}%</span>
            </div>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            {/* Updated time */}
            <span className="text-[9px] text-slate-600 truncate">{relativeTime}</span>

            {/* Quick confirm button */}
            {isProposed && isHovered && onQuickConfirm && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickConfirm();
                }}
                className="flex-shrink-0 p-1 bg-emerald-500 hover:bg-emerald-400 rounded transition-colors"
                title="Quick confirm"
              >
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
