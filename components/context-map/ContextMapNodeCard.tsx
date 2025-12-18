// components/context-map/ContextMapNodeCard.tsx
// Individual node card component for the Context Map

'use client';

import type { PositionedNode, NodeVisualTier } from './types';
import { getShortLabel, formatRelativeTime, SOURCE_LABELS, COLORS, VISUAL_TIERS, LOW_CONFIDENCE_THRESHOLD } from './constants';
import { getValuePreview } from './field-renderers';
import { getSchemaV2Entry } from '@/lib/contextGraph/unifiedRegistry';

interface ContextMapNodeCardProps {
  node: PositionedNode;
  zoneColor: string;
  isSelected: boolean;
  isHovered: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onQuickConfirm?: () => void;
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

export function ContextMapNodeCard({
  node,
  zoneColor,
  isSelected,
  isHovered,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onQuickConfirm,
}: ContextMapNodeCardProps) {
  const { position, size, status, source, confidence, lastUpdated, value, pendingProposal } = node;

  // Determine visual tier and get styling config
  const visualTier = node.visualTier || getVisualTier(node);
  const tierConfig = getTierConfig(visualTier);

  const isProposed = status === 'proposed' || !!pendingProposal;
  const borderColor = isProposed ? COLORS.PROPOSED_COLOR : zoneColor;

  // Apply tier-based styling
  const borderStyle = tierConfig.borderStyle === 'dashed' ? '4 2' :
                      tierConfig.borderStyle === 'dotted' ? '2 2' : 'none';
  const opacity = tierConfig.opacity;
  const bgOpacity = tierConfig.bgOpacity;

  // Scale dimensions for lower-tier nodes
  const scaledWidth = size.width * tierConfig.scale;
  const scaledHeight = size.height * tierConfig.scale;
  const xOffset = (size.width - scaledWidth) / 2;
  const yOffset = (size.height - scaledHeight) / 2;

  const label = getShortLabel(node.key);
  // Use Schema V2 field metadata for type-aware preview (select labels, list formatting, etc.)
  const fieldMeta = getSchemaV2Entry(node.key);
  const valuePreview = getValuePreview(value, fieldMeta, 50);
  const relativeTime = formatRelativeTime(lastUpdated);
  const sourceLabel = SOURCE_LABELS[source] || source;
  const confidencePercent = Math.round(confidence * 100);

  // Source icon character
  const sourceIcon = source === 'ai' ? '✨' : source === 'user' ? '👤' : source === 'lab' ? '🔬' : '📥';

  // Actual render positions (with scale offset)
  const renderX = position.x + xOffset;
  const renderY = position.y + yOffset;

  return (
    <g
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ cursor: 'pointer', opacity }}
      className="transition-opacity duration-150"
    >
      {/* Card background */}
      <rect
        x={renderX}
        y={renderY}
        width={scaledWidth}
        height={scaledHeight}
        rx={8}
        fill={`rgba(30, 41, 59, ${bgOpacity})`}
        stroke={isSelected ? '#22d3ee' : isHovered ? borderColor : borderColor}
        strokeWidth={isSelected ? 2 : isHovered ? 2 : tierConfig.borderWidth}
        strokeDasharray={borderStyle}
        className="transition-all duration-150"
      />

      {/* Selection highlight */}
      {isSelected && (
        <rect
          x={renderX - 2}
          y={renderY - 2}
          width={scaledWidth + 4}
          height={scaledHeight + 4}
          rx={10}
          fill="none"
          stroke="#22d3ee"
          strokeWidth={1}
          strokeOpacity={0.4}
        />
      )}

      {/* Header row: source icon + label + status badge */}
      <g>
        {/* Source icon */}
        <text
          x={renderX + 8}
          y={renderY + 18}
          fontSize={10}
          className="select-none"
        >
          {sourceIcon}
        </text>

        {/* Label */}
        <text
          x={renderX + 22}
          y={renderY + 18}
          fill="#e2e8f0"
          fontSize={12}
          fontWeight={500}
          className="select-none"
        >
          {label.length > 20 ? label.slice(0, 20) + '...' : label}
        </text>

        {/* Status badge - show tier for proposed nodes */}
        {isProposed && (
          <g>
            <rect
              x={renderX + scaledWidth - 60}
              y={renderY + 6}
              width={52}
              height={16}
              rx={4}
              fill={visualTier === 'proposed-low' ? 'rgba(100, 116, 139, 0.3)' : `${COLORS.PROPOSED_COLOR}30`}
            />
            <text
              x={renderX + scaledWidth - 34}
              y={renderY + 17}
              fill={visualTier === 'proposed-low' ? '#94a3b8' : COLORS.PROPOSED_COLOR}
              fontSize={9}
              textAnchor="middle"
              fontWeight={500}
              className="select-none"
            >
              {visualTier === 'proposed-low' ? 'LOW CONF' : 'PROPOSED'}
            </text>
          </g>
        )}
      </g>

      {/* Value preview */}
      <text
        x={renderX + 8}
        y={renderY + 38}
        fill={visualTier === 'proposed-low' ? '#64748b' : '#94a3b8'}
        fontSize={11}
        className="select-none"
      >
        {valuePreview.length > 30 ? valuePreview.slice(0, 30) + '...' : valuePreview}
      </text>

      {/* Footer row: confidence + updated */}
      <g>
        {/* Confidence bar */}
        <rect
          x={renderX + 8}
          y={renderY + scaledHeight - 16}
          width={40}
          height={4}
          rx={2}
          fill="rgba(51, 65, 85, 0.8)"
        />
        <rect
          x={renderX + 8}
          y={renderY + scaledHeight - 16}
          width={40 * confidence}
          height={4}
          rx={2}
          fill={confidence > 0.7 ? '#22c55e' : confidence > 0.4 ? '#f59e0b' : '#ef4444'}
        />

        {/* Confidence text */}
        <text
          x={renderX + 54}
          y={renderY + scaledHeight - 10}
          fill="#64748b"
          fontSize={9}
          className="select-none"
        >
          {confidencePercent}%
        </text>

        {/* Updated time */}
        <text
          x={renderX + scaledWidth - 8}
          y={renderY + scaledHeight - 10}
          fill="#475569"
          fontSize={9}
          textAnchor="end"
          className="select-none"
        >
          {relativeTime}
        </text>
      </g>

      {/* Pending proposal indicator */}
      {pendingProposal && (
        <circle
          cx={renderX + scaledWidth - 6}
          cy={renderY + 6}
          r={5}
          fill={COLORS.PROPOSED_COLOR}
          className="animate-pulse"
        />
      )}

      {/* Quick confirm button - appears on hover for proposed nodes */}
      {isProposed && isHovered && onQuickConfirm && (
        <g
          onClick={(e) => {
            e.stopPropagation();
            onQuickConfirm();
          }}
          style={{ cursor: 'pointer' }}
        >
          {/* Button background */}
          <rect
            x={renderX + scaledWidth - 28}
            y={renderY + scaledHeight - 24}
            width={20}
            height={18}
            rx={4}
            fill="#22c55e"
            className="hover:fill-emerald-400 transition-colors"
          />
          {/* Checkmark icon */}
          <path
            d={`M${renderX + scaledWidth - 23} ${renderY + scaledHeight - 14} l3 3 l5 -6`}
            stroke="white"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>
      )}
    </g>
  );
}
