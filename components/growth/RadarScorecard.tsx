// components/growth/RadarScorecard.tsx

import React from "react";

import type { Scorecard } from "@/lib/growth-plan/growthActionPlanSchema";
import {
  dimensionColors,
  type DimensionKey,
  getTextColorHex,
} from "@/lib/ui/dimensionColors";

type Props = {
  scorecard: Scorecard;
  socialSignals?: {
    hasLinkedIn: boolean;
    hasFacebook: boolean;
    hasInstagram: boolean;
    linkedinStrength?: "none" | "weak" | "present" | "strong";
    facebookStrength?: "none" | "weak" | "present" | "strong";
    instagramStrength?: "none" | "weak" | "present" | "strong";
  };
};

const DIMENSION_LABELS: Record<string, string> = {
  website: "Website & Conversion",
  content: "Content",
  seo: "SEO & Visibility",
  brand: "Brand & Positioning",
  authority: "Authority",
};

const DIMENSION_ORDER: (keyof Scorecard)[] = [
  "website",
  "content",
  "seo",
  "brand",
  "authority",
];

interface Point {
  x: number;
  y: number;
}

/**
 * Convert polar coordinates (angle in radians, radius) to Cartesian (x, y)
 */
function polarToCartesian(angle: number, radius: number, center: number): Point {
  return {
    x: center + radius * Math.cos(angle),
    y: center + radius * Math.sin(angle),
  };
}


export const RadarScorecard: React.FC<Props> = ({ scorecard, socialSignals }) => {
  const dims = scorecard.evaluatedDimensions ?? [];
  
  // Filter to only dimensions that have scores
  const dimensionsWithScores = DIMENSION_ORDER.filter(
    (key) => dims.includes(key) && typeof scorecard[key] === "number"
  );

  if (dimensionsWithScores.length === 0) {
    return (
      <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
        <div className="mb-4 text-xs font-medium uppercase tracking-wide text-gray-400">
          GAP Score Breakdown
        </div>
        <div className="text-xs text-gray-400">
          No dimension-level scores available.
        </div>
      </div>
    );
  }

  // Radar chart constants - responsive sizing
  const SIZE = 260; // Base size, scaled via CSS
  const CENTER = SIZE / 2;
  const MAX_RADIUS = 100; // Maximum radius for score of 100
  const NUM_RINGS = 4; // 25, 50, 75, 100

  // Calculate angles for each dimension (evenly spaced around circle)
  // Start at top (12 o'clock) and go clockwise
  const numDimensions = Math.max(1, dimensionsWithScores.length); // Ensure at least 1
  const angles = dimensionsWithScores.map((_, index) => {
    // Start at -π/2 (top), then distribute evenly
    const baseAngle = -Math.PI / 2;
    const angleStep = (2 * Math.PI) / numDimensions;
    return baseAngle + index * angleStep;
  });

  // Get scores for each dimension
  const scores = dimensionsWithScores.map((key) => {
    const value = scorecard[key];
    return typeof value === "number" ? value : 0;
  });

  // Calculate points for the data polygon
  const dataPoints = scores.map((score, index) => {
    const radius = (score / 100) * MAX_RADIUS;
    return polarToCartesian(angles[index], radius, CENTER);
  });

  // Generate grid rings (25, 50, 75, 100)
  const gridRings = Array.from({ length: NUM_RINGS }, (_, i) => {
    const ringValue = ((i + 1) * 100) / NUM_RINGS;
    const ringRadius = (ringValue / 100) * MAX_RADIUS;
    const ringPoints = angles.map((angle) =>
      polarToCartesian(angle, ringRadius, CENTER)
    );
    return {
      value: ringValue,
      points: ringPoints,
    };
  });

  // Generate axis lines (spokes)
  const axisLines = angles.map((angle) => {
    const endPoint = polarToCartesian(angle, MAX_RADIUS, CENTER);
    return {
      x1: CENTER,
      y1: CENTER,
      x2: endPoint.x,
      y2: endPoint.y,
    };
  });

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800 p-4 sm:p-6">
      <div className="mb-3 text-[10px] font-medium uppercase tracking-wide text-gray-400 sm:mb-4 sm:text-xs">
        GAP Score Breakdown
      </div>

      <div className="flex flex-col items-center gap-4 sm:gap-6 md:flex-row md:items-start">
        {/* Radar Chart */}
        <div className="flex-shrink-0 w-full md:w-auto flex justify-center">
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="overflow-visible w-full max-w-[220px] h-auto sm:max-w-[260px]"
          >
            {/* Grid rings (background polygons) */}
            {gridRings.map((ring, i) => (
              <polygon
                key={`ring-${i}`}
                points={ring.points.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="#374151"
                strokeWidth="1"
                opacity={0.3}
              />
            ))}

            {/* Axis lines (spokes) */}
            {axisLines.map((line, i) => (
              <line
                key={`axis-${i}`}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke="#4B5563"
                strokeWidth="1"
                opacity={0.4}
              />
            ))}

            {/* Data polygon (filled area) */}
            <polygon
              points={dataPoints.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="#fbbf24"
              fillOpacity="0.2"
              stroke="#fbbf24"
              strokeWidth="2"
            />

            {/* Data points (circle markers) */}
            {dataPoints.map((point, i) => (
              <circle
                key={`point-${i}`}
                cx={point.x}
                cy={point.y}
                r="4"
                fill="#fbbf24"
                stroke="#1F2937"
                strokeWidth="1.5"
              />
            ))}

            {/* Dimension labels positioned outside the chart */}
            {dimensionsWithScores.map((key, index) => {
              const angle = angles[index];
              const labelRadius = MAX_RADIUS + 20;
              const labelPoint = polarToCartesian(angle, labelRadius, CENTER);
              const score = scores[index];
              const isActive = typeof score === "number" && score > 0;
              const dimensionKey = key as DimensionKey;
              const colors = dimensionColors[dimensionKey] || {
                text: "text-gray-400",
              };

              // Convert Tailwind color to hex for SVG
              const textColor = isActive
                ? getTextColorHex(colors.text)
                : "#6B7280";

              return (
                <g key={`label-${key}`}>
                  <text
                    x={labelPoint.x}
                    y={labelPoint.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={textColor}
                    fontSize="12"
                    fontWeight="500"
                  >
                    {DIMENSION_LABELS[key] ?? key}
                  </text>
                  {isActive && (
                    <text
                      x={labelPoint.x}
                      y={labelPoint.y + 14}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={textColor}
                      fontSize="12"
                      fontWeight="600"
                    >
                      {score}/100
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-2">
          {dimensionsWithScores.map((key) => {
            const value = scorecard[key];
            const score = typeof value === "number" ? value : 0;
            const isActive = score > 0;
            const dimensionKey = key as DimensionKey;
            const colors = dimensionColors[dimensionKey] || {
              pill: "bg-gray-500/20 text-gray-300",
              text: "text-gray-300",
            };

            return (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg bg-gray-700/50 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      isActive
                        ? colors.pill.split(" ").find((c) => c.startsWith("bg-")) ||
                          "bg-gray-500"
                        : "bg-gray-600"
                    }`}
                  />
                  <span
                    className={`text-xs ${
                      isActive ? colors.text : "text-gray-500"
                    }`}
                  >
                    {DIMENSION_LABELS[key] ?? key}
                  </span>
                </div>
                <span
                  className={`text-xs font-semibold ${
                    isActive ? colors.text : "text-gray-500"
                  }`}
                >
                  {score}/100
                </span>
              </div>
            );
          })}
          
          {/* Social Presence Row */}
          {socialSignals && (
            <div className="flex items-center justify-between rounded-lg bg-gray-700/50 px-3 py-2 border border-gray-600/50">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-xs text-gray-300">Social Presence</span>
              </div>
              <div className="flex items-center gap-1.5">
                {socialSignals.hasLinkedIn && (
                  <span className="text-[10px] text-blue-300" title="LinkedIn">
                    LI
                  </span>
                )}
                {socialSignals.hasFacebook && (
                  <span className="text-[10px] text-blue-400" title="Facebook">
                    FB
                  </span>
                )}
                {socialSignals.hasInstagram && (
                  <span className="text-[10px] text-pink-400" title="Instagram">
                    IG
                  </span>
                )}
                {!socialSignals.hasLinkedIn && !socialSignals.hasFacebook && !socialSignals.hasInstagram && (
                  <span className="text-[10px] text-gray-500">None</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

