// components/context-map/ZoneCollapseChip.tsx
// Collapsible chip showing hidden nodes in a zone

'use client';

import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

interface ZoneCollapseChipProps {
  /** Total count of collapsed nodes */
  count: number;
  /** Count of low-confidence proposed nodes in collapsed set */
  lowConfidenceCount: number;
  /** Whether the zone is currently expanded */
  isExpanded: boolean;
  /** SVG position for the chip */
  position: { x: number; y: number };
  /** Width of the chip */
  width: number;
  /** Called when chip is clicked */
  onClick: () => void;
}

const CHIP_HEIGHT = 28;

export function ZoneCollapseChip({
  count,
  lowConfidenceCount,
  isExpanded,
  position,
  width,
  onClick,
}: ZoneCollapseChipProps) {
  const hasLowConfidence = lowConfidenceCount > 0 && !isExpanded;

  // Determine the display label
  const label = hasLowConfidence
    ? `AI proposed (low conf) +${lowConfidenceCount}`
    : isExpanded
      ? 'Show less'
      : `+${count} more`;

  // Colors based on whether showing low-confidence
  const bgColor = hasLowConfidence
    ? 'rgba(251, 191, 36, 0.15)'
    : 'rgba(51, 65, 85, 0.5)';
  const borderColor = hasLowConfidence
    ? 'rgba(251, 191, 36, 0.3)'
    : 'rgba(71, 85, 105, 0.5)';
  const textColor = hasLowConfidence
    ? '#fbbf24'
    : 'rgba(148, 163, 184, 0.8)';

  const iconSize = 14;
  const iconX = hasLowConfidence ? position.x + 8 : position.x + width - 20;
  const iconY = position.y + (CHIP_HEIGHT - iconSize) / 2;
  const textX = hasLowConfidence ? position.x + 26 : position.x + 12;

  return (
    <g
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{ cursor: 'pointer' }}
      className="transition-opacity duration-150 hover:opacity-80"
    >
      {/* Chip background */}
      <rect
        x={position.x}
        y={position.y}
        width={width}
        height={CHIP_HEIGHT}
        rx={6}
        fill={bgColor}
        stroke={borderColor}
        strokeWidth={1}
      />

      {/* Sparkle icon for low confidence */}
      {hasLowConfidence && (
        <g transform={`translate(${iconX}, ${iconY})`}>
          <Sparkles width={iconSize} height={iconSize} color="#fbbf24" />
        </g>
      )}

      {/* Label text */}
      <text
        x={textX}
        y={position.y + 18}
        fill={textColor}
        fontSize={11}
        fontWeight={500}
        className="select-none"
      >
        {label}
      </text>

      {/* Expand/collapse chevron */}
      <g transform={`translate(${position.x + width - 20}, ${iconY})`}>
        {isExpanded ? (
          <ChevronUp width={iconSize} height={iconSize} color="rgba(148, 163, 184, 0.6)" />
        ) : (
          <ChevronDown width={iconSize} height={iconSize} color="rgba(148, 163, 184, 0.6)" />
        )}
      </g>
    </g>
  );
}
