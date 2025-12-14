// components/context-map/ContextMapEdges.tsx
// Connection lines between zones

'use client';

import type { ComputedEdge } from './types';
import { COLORS } from './constants';

interface ContextMapEdgesProps {
  edges: ComputedEdge[];
  hoveredZone: string | null;
}

export function ContextMapEdges({ edges, hoveredZone }: ContextMapEdgesProps) {
  return (
    <g className="pointer-events-none">
      {edges.map((edge, index) => {
        const isHighlighted =
          hoveredZone === edge.fromZone || hoveredZone === edge.toZone;

        // Calculate control points for curved line
        const midX = (edge.fromPoint.x + edge.toPoint.x) / 2;
        const midY = (edge.fromPoint.y + edge.toPoint.y) / 2;

        // Add some curve offset based on edge direction
        const dx = edge.toPoint.x - edge.fromPoint.x;
        const dy = edge.toPoint.y - edge.fromPoint.y;
        const curveOffset = Math.min(Math.abs(dx), Math.abs(dy)) * 0.3;

        // Perpendicular offset for curve
        const length = Math.sqrt(dx * dx + dy * dy);
        const perpX = (-dy / length) * curveOffset;
        const perpY = (dx / length) * curveOffset;

        const controlX = midX + perpX;
        const controlY = midY + perpY;

        const pathD = `M ${edge.fromPoint.x} ${edge.fromPoint.y} Q ${controlX} ${controlY} ${edge.toPoint.x} ${edge.toPoint.y}`;

        return (
          <g key={`${edge.fromZone}-${edge.toZone}-${index}`}>
            {/* Edge line */}
            <path
              d={pathD}
              fill="none"
              stroke={isHighlighted ? COLORS.EDGE_HIGHLIGHT_COLOR : COLORS.EDGE_COLOR}
              strokeWidth={isHighlighted ? COLORS.EDGE_WIDTH * 1.5 : COLORS.EDGE_WIDTH}
              strokeLinecap="round"
              className="transition-all duration-200"
            />

            {/* Arrow at end */}
            <ArrowHead
              x={edge.toPoint.x}
              y={edge.toPoint.y}
              angle={Math.atan2(
                edge.toPoint.y - controlY,
                edge.toPoint.x - controlX
              )}
              color={isHighlighted ? COLORS.EDGE_HIGHLIGHT_COLOR : COLORS.EDGE_COLOR}
              size={isHighlighted ? 8 : 6}
            />
          </g>
        );
      })}
    </g>
  );
}

interface ArrowHeadProps {
  x: number;
  y: number;
  angle: number;
  color: string;
  size: number;
}

function ArrowHead({ x, y, angle, color, size }: ArrowHeadProps) {
  // Calculate arrow points
  const arrowAngle = Math.PI / 6; // 30 degrees
  const point1X = x - size * Math.cos(angle - arrowAngle);
  const point1Y = y - size * Math.sin(angle - arrowAngle);
  const point2X = x - size * Math.cos(angle + arrowAngle);
  const point2Y = y - size * Math.sin(angle + arrowAngle);

  return (
    <polygon
      points={`${x},${y} ${point1X},${point1Y} ${point2X},${point2Y}`}
      fill={color}
    />
  );
}
