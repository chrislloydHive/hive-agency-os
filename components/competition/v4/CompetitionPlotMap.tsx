// components/competition/v4/CompetitionPlotMap.tsx
// 2D Competitive Landscape Map for Competition Lab V4
//
// Visualizes competitors as bubbles on a scatter plot:
// - X-axis: Price Positioning (Budget → Premium)
// - Y-axis: Brand Recognition (Low → High)
// - Bubble size: Overlap Score
// - Color: Competitor Tier

'use client';

import { useState, useMemo, useCallback } from 'react';
import type { CompetitionV4Result } from '@/lib/competition-v4/types';
import {
  mapCompetitionToPlotPoints,
  getTierColor,
  getTierLabel,
  type PlotPoint,
  type CompetitorTier,
  type PlotMapData,
} from '@/lib/competition-v4/mapCompetitionToPlotPoints';

// ============================================================================
// Types
// ============================================================================

interface Props {
  data: CompetitionV4Result;
  companyName: string;
}

interface TierFilter {
  primary: boolean;
  contextual: boolean;
  alternatives: boolean;
  excluded: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const PLOT_PADDING = { top: 40, right: 40, bottom: 60, left: 60 };
const PLOT_WIDTH = 700;
const PLOT_HEIGHT = 500;
const MIN_BUBBLE_RADIUS = 8;
const MAX_BUBBLE_RADIUS = 28;

// ============================================================================
// Helper Functions
// ============================================================================

function scaleBubbleRadius(overlapScore: number): number {
  // Scale 0-100 to MIN-MAX radius
  const normalized = Math.max(0, Math.min(100, overlapScore)) / 100;
  return MIN_BUBBLE_RADIUS + normalized * (MAX_BUBBLE_RADIUS - MIN_BUBBLE_RADIUS);
}

function scaleX(value: number, width: number): number {
  // Scale 0-100 to plot area
  return PLOT_PADDING.left + (value / 100) * width;
}

function scaleY(value: number, height: number): number {
  // Scale 0-100 to plot area (inverted for SVG coordinates)
  return PLOT_PADDING.top + (1 - value / 100) * height;
}

// ============================================================================
// Sub-components
// ============================================================================

function TierFilterControls({
  filters,
  onChange,
  counts,
}: {
  filters: TierFilter;
  onChange: (tier: CompetitorTier, enabled: boolean) => void;
  counts: Record<CompetitorTier, number>;
}) {
  const tiers: CompetitorTier[] = ['primary', 'contextual', 'alternatives', 'excluded'];

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <span className="text-xs text-slate-500 uppercase tracking-wide">Show:</span>
      {tiers.map(tier => (
        <label
          key={tier}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <input
            type="checkbox"
            checked={filters[tier]}
            onChange={e => onChange(tier, e.target.checked)}
            className="sr-only"
          />
          <span
            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
              filters[tier]
                ? 'border-transparent'
                : 'border-slate-600 bg-slate-800'
            }`}
            style={{
              backgroundColor: filters[tier] ? getTierColor(tier) : undefined,
            }}
          >
            {filters[tier] && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </span>
          <span className={`text-sm transition-colors ${
            filters[tier] ? 'text-slate-200' : 'text-slate-500'
          } group-hover:text-slate-300`}>
            {getTierLabel(tier)}
            <span className="ml-1 text-xs text-slate-500">({counts[tier]})</span>
          </span>
        </label>
      ))}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-6 text-xs flex-wrap">
      <div className="flex items-center gap-4">
        <span className="text-slate-500">Tier:</span>
        {(['primary', 'contextual', 'alternatives', 'excluded'] as const).map(tier => (
          <div key={tier} className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: getTierColor(tier) }}
            />
            <span className="text-slate-400">{getTierLabel(tier)}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 text-slate-500">
        <span>Size = Overlap</span>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full border-2 border-slate-500 border-dashed" />
          <span>Retail-Hybrid</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full border border-slate-500/50" style={{ boxShadow: '0 0 0 2px rgba(100,116,139,0.3)' }} />
          <span>Uncertain</span>
        </div>
      </div>
    </div>
  );
}

function Tooltip({
  point,
  x,
  y,
}: {
  point: PlotPoint;
  x: number;
  y: number;
}) {
  // Adjust tooltip position to stay in bounds
  const tooltipX = Math.min(x + 15, PLOT_WIDTH + PLOT_PADDING.left - 220);
  const tooltipY = Math.max(y - 10, PLOT_PADDING.top);

  return (
    <g>
      <foreignObject
        x={tooltipX}
        y={tooltipY}
        width={220}
        height={200}
        style={{ overflow: 'visible' }}
      >
        <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-3 text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-white truncate max-w-[140px]">
              {point.name}
            </span>
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{
                backgroundColor: `${getTierColor(point.tier)}20`,
                color: getTierColor(point.tier),
              }}
            >
              {getTierLabel(point.tier)}
            </span>
          </div>

          {point.domain && (
            <div className="text-slate-500 text-[10px] mb-2 truncate">{point.domain}</div>
          )}

          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <span className="text-slate-500">Price:</span>{' '}
              <span className="text-slate-300 capitalize">
                {point.pricePositioning}
                {point.priceAssumed && <span className="text-slate-600">*</span>}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Brand:</span>{' '}
              <span className="text-slate-300">
                {point.brandRecognition}
                {point.brandAssumed && <span className="text-slate-600">*</span>}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Overlap:</span>{' '}
              <span className="text-slate-300">{point.overlapScore}%</span>
            </div>
            <div>
              <span className="text-slate-500">Confidence:</span>{' '}
              <span className={point.isLowConfidence ? 'text-amber-400' : 'text-slate-300'}>
                {point.confidence}%
              </span>
            </div>
            {point.geographicReach && point.geographicReach !== 'unknown' && (
              <div>
                <span className="text-slate-500">Reach:</span>{' '}
                <span className="text-slate-300 capitalize">{point.geographicReach}</span>
              </div>
            )}
            <div>
              <span className="text-slate-500">Type:</span>{' '}
              <span className="text-slate-300 capitalize">
                {point.modality === 'install-first' ? 'Install-First' : 'Retail-Hybrid'}
              </span>
            </div>
          </div>

          {point.whyThisMatters && (
            <div className="text-slate-400 line-clamp-2 text-[10px] leading-relaxed border-t border-slate-700/50 pt-2 mt-2">
              {point.whyThisMatters}
            </div>
          )}

          {point.estimated && (
            <div className="text-amber-500/80 text-[10px] mt-2 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Estimated positioning
            </div>
          )}

          <div className="text-[10px] text-slate-600 mt-2">Click for details</div>
        </div>
      </foreignObject>
    </g>
  );
}

function DetailPanel({
  point,
  onClose,
}: {
  point: PlotPoint;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-md h-full bg-slate-900 border-l border-slate-700 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-700 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: getTierColor(point.tier) }}
            />
            <div>
              <h3 className="font-semibold text-white">{point.name}</h3>
              {point.domain && (
                <a
                  href={`https://${point.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-purple-400 hover:underline"
                >
                  {point.domain}
                </a>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Tier Badge */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{
                backgroundColor: `${getTierColor(point.tier)}20`,
                color: getTierColor(point.tier),
              }}
            >
              {getTierLabel(point.tier)} Competitor
            </span>
            {point.isSubject && (
              <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-purple-500/20 text-purple-400">
                Your Company
              </span>
            )}
            {point.estimated && (
              <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-500/20 text-amber-400 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Estimated
              </span>
            )}
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-500 mb-1">Price Position</div>
              <div className="text-lg font-semibold text-white capitalize">
                {point.pricePositioning}
                {point.priceAssumed && (
                  <span className="text-xs text-slate-500 ml-1">(inferred)</span>
                )}
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-500 mb-1">Brand Recognition</div>
              <div className="text-lg font-semibold text-white">
                {point.brandRecognition}/100
                {point.brandAssumed && (
                  <span className="text-xs text-slate-500 ml-1">(inferred)</span>
                )}
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-500 mb-1">Overlap Score</div>
              <div className="text-lg font-semibold text-white">{point.overlapScore}%</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-500 mb-1">Geographic Reach</div>
              <div className="text-lg font-semibold text-white capitalize">
                {point.geographicReach || 'Unknown'}
              </div>
            </div>
          </div>

          {/* Why This Matters */}
          {point.whyThisMatters && (
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-2">Why This Matters</h4>
              <p className="text-sm text-slate-400 leading-relaxed">{point.whyThisMatters}</p>
            </div>
          )}

          {/* Reasons */}
          {point.reasons && point.reasons.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-2">Classification Reasons</h4>
              <ul className="space-y-2">
                {point.reasons.map((reason, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-slate-400">
                    <span className="text-slate-600 mt-1">•</span>
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Signals Used */}
          {point.signalsUsed && Object.keys(point.signalsUsed).length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-2">Signals Used</h4>
              <div className="bg-slate-800/30 rounded-lg p-3 space-y-2">
                {Object.entries(point.signalsUsed).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span className="text-slate-300">
                      {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Categories */}
          {((point.serviceCategories && point.serviceCategories.length > 0) ||
            (point.productCategories && point.productCategories.length > 0)) && (
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-2">Categories</h4>
              <div className="flex flex-wrap gap-2">
                {point.serviceCategories?.map((cat, idx) => (
                  <span key={`service-${idx}`} className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">
                    {cat}
                  </span>
                ))}
                {point.productCategories?.map((cat, idx) => (
                  <span key={`product-${idx}`} className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs">
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {point.isRetailer && (
              <span className="px-2 py-1 bg-amber-500/20 text-amber-300 rounded text-xs">
                Major Retailer
              </span>
            )}
            {point.hasInstallation && (
              <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded text-xs">
                Offers Installation
              </span>
            )}
            {point.hasNationalReach && (
              <span className="px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded text-xs">
                National Reach
              </span>
            )}
            {point.isLocal && (
              <span className="px-2 py-1 bg-slate-500/20 text-slate-300 rounded text-xs">
                Local Player
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-[500px] border border-slate-700 rounded-lg bg-slate-800/20">
      <div className="text-center max-w-sm">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
          <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>
        <p className="text-slate-300 text-sm font-medium mb-1">Not enough data for plot map</p>
        <p className="text-slate-500 text-xs">
          At least 2 competitors are needed to generate a meaningful landscape visualization.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CompetitionPlotMap({ data, companyName }: Props) {
  const [filters, setFilters] = useState<TierFilter>({
    primary: true,
    contextual: true,
    alternatives: true,
    excluded: false, // Hidden by default
  });
  const [hoveredPoint, setHoveredPoint] = useState<PlotPoint | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<PlotPoint | null>(null);

  // Map data to plot points
  const plotData = useMemo(() => {
    return mapCompetitionToPlotPoints(data, companyName);
  }, [data, companyName]);

  // Filter points based on tier toggles
  const filteredPoints = useMemo(() => {
    return plotData.points.filter(p => filters[p.tier]);
  }, [plotData.points, filters]);

  // Count points by tier
  const tierCounts = useMemo(() => {
    const counts: Record<CompetitorTier, number> = {
      primary: 0,
      contextual: 0,
      alternatives: 0,
      excluded: 0,
    };
    for (const point of plotData.points) {
      counts[point.tier]++;
    }
    return counts;
  }, [plotData.points]);

  // Handle filter change
  const handleFilterChange = useCallback((tier: CompetitorTier, enabled: boolean) => {
    setFilters(prev => ({ ...prev, [tier]: enabled }));
  }, []);

  // Calculate plot dimensions
  const plotAreaWidth = PLOT_WIDTH - PLOT_PADDING.left - PLOT_PADDING.right;
  const plotAreaHeight = PLOT_HEIGHT - PLOT_PADDING.top - PLOT_PADDING.bottom;

  // Check if we have enough data
  if (plotData.points.length < 2) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-4 p-4 bg-slate-800/30 border border-slate-700 rounded-lg">
        <TierFilterControls
          filters={filters}
          onChange={handleFilterChange}
          counts={tierCounts}
        />
        <Legend />
      </div>

      {/* Helper text - perception map framing */}
      <p className="text-xs text-slate-500 text-center italic">
        {plotData.helperText}
        {plotData.modalityConfidence < 70 && (
          <span className="text-amber-500/70 ml-1">
            (Low confidence: positions show uncertainty)
          </span>
        )}
      </p>

      {/* Validation warnings (dev only) */}
      {process.env.NODE_ENV === 'development' && plotData.validation.warnings.length > 0 && (
        <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
          <div className="text-xs text-red-400 font-medium mb-1">Validation Warnings</div>
          {plotData.validation.warnings.map((warning, idx) => (
            <div key={idx} className="text-xs text-red-300/80">{warning}</div>
          ))}
        </div>
      )}

      {/* Plot */}
      <div className="border border-slate-700 rounded-lg bg-slate-900/50 p-4 overflow-x-auto">
        <svg
          width={PLOT_WIDTH + PLOT_PADDING.left + PLOT_PADDING.right}
          height={PLOT_HEIGHT}
          className="mx-auto"
        >
          {/* Background */}
          <rect
            x={PLOT_PADDING.left}
            y={PLOT_PADDING.top}
            width={plotAreaWidth}
            height={plotAreaHeight}
            fill="#0f172a"
            rx={4}
          />

          {/* Grid lines */}
          <g stroke="#1e293b" strokeWidth={1}>
            {/* Vertical lines */}
            {[0, 25, 50, 75, 100].map(v => (
              <line
                key={`v-${v}`}
                x1={scaleX(v, plotAreaWidth)}
                y1={PLOT_PADDING.top}
                x2={scaleX(v, plotAreaWidth)}
                y2={PLOT_PADDING.top + plotAreaHeight}
              />
            ))}
            {/* Horizontal lines */}
            {[0, 25, 50, 75, 100].map(v => (
              <line
                key={`h-${v}`}
                x1={PLOT_PADDING.left}
                y1={scaleY(v, plotAreaHeight)}
                x2={PLOT_PADDING.left + plotAreaWidth}
                y2={scaleY(v, plotAreaHeight)}
              />
            ))}
          </g>

          {/* Quadrant labels (semi-transparent) */}
          <g className="text-[10px]" fill="#475569" opacity={0.6}>
            <text x={scaleX(25, plotAreaWidth)} y={scaleY(85, plotAreaHeight)} textAnchor="middle">
              {plotData.quadrantLabels.topLeft}
            </text>
            <text x={scaleX(75, plotAreaWidth)} y={scaleY(85, plotAreaHeight)} textAnchor="middle">
              {plotData.quadrantLabels.topRight}
            </text>
            <text x={scaleX(25, plotAreaWidth)} y={scaleY(15, plotAreaHeight)} textAnchor="middle">
              {plotData.quadrantLabels.bottomLeft}
            </text>
            <text x={scaleX(75, plotAreaWidth)} y={scaleY(15, plotAreaHeight)} textAnchor="middle">
              {plotData.quadrantLabels.bottomRight}
            </text>
          </g>

          {/* Axis labels */}
          <g className="text-xs" fill="#94a3b8">
            {/* X-axis */}
            <text
              x={scaleX(50, plotAreaWidth)}
              y={PLOT_HEIGHT - 10}
              textAnchor="middle"
              className="font-medium"
            >
              {plotData.axisLabels.x.label}
            </text>
            <text
              x={PLOT_PADDING.left}
              y={PLOT_HEIGHT - 28}
              textAnchor="start"
              fill="#64748b"
            >
              {plotData.axisLabels.x.low}
            </text>
            <text
              x={PLOT_PADDING.left + plotAreaWidth}
              y={PLOT_HEIGHT - 28}
              textAnchor="end"
              fill="#64748b"
            >
              {plotData.axisLabels.x.high}
            </text>

            {/* Y-axis */}
            <text
              x={15}
              y={scaleY(50, plotAreaHeight)}
              textAnchor="middle"
              transform={`rotate(-90, 15, ${scaleY(50, plotAreaHeight)})`}
              className="font-medium"
            >
              {plotData.axisLabels.y.label}
            </text>
            <text
              x={PLOT_PADDING.left - 10}
              y={PLOT_PADDING.top + plotAreaHeight}
              textAnchor="end"
              fill="#64748b"
            >
              {plotData.axisLabels.y.low}
            </text>
            <text
              x={PLOT_PADDING.left - 10}
              y={PLOT_PADDING.top + 10}
              textAnchor="end"
              fill="#64748b"
            >
              {plotData.axisLabels.y.high}
            </text>
          </g>

          {/* Data points */}
          <g>
            {filteredPoints.map(point => {
              const cx = scaleX(point.x, plotAreaWidth);
              const cy = scaleY(point.y, plotAreaHeight);
              const r = scaleBubbleRadius(point.size);
              const isHovered = hoveredPoint?.id === point.id;
              const isSelected = selectedPoint?.id === point.id;
              const isRetailHybrid = point.modality === 'retail-hybrid';

              // Opacity reduction for low confidence
              const baseOpacity = point.isLowConfidence ? 0.5 : 0.7;
              const fillOpacity = point.tier === 'excluded' ? 0.3 : baseOpacity;

              return (
                <g
                  key={point.id}
                  onMouseEnter={() => setHoveredPoint(point)}
                  onMouseLeave={() => setHoveredPoint(null)}
                  onClick={() => setSelectedPoint(point)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Uncertainty halo for low-confidence points */}
                  {point.uncertaintyRadius > 0 && !point.isSubject && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={r + point.uncertaintyRadius}
                      fill="none"
                      stroke={getTierColor(point.tier)}
                      strokeWidth={1}
                      strokeDasharray="3 2"
                      opacity={0.3}
                    />
                  )}

                  {/* Outer glow for subject company */}
                  {point.isSubject && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={r + 6}
                      fill="none"
                      stroke="#a855f7"
                      strokeWidth={2}
                      strokeDasharray="4 2"
                      opacity={0.6}
                    />
                  )}

                  {/* Main bubble */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHovered || isSelected ? r + 2 : r}
                    fill={getTierColor(point.tier)}
                    fillOpacity={fillOpacity}
                    stroke={isHovered || isSelected ? '#fff' : getTierColor(point.tier)}
                    strokeWidth={isHovered || isSelected ? 2 : isRetailHybrid ? 1.5 : 1}
                    strokeDasharray={isRetailHybrid && !point.isSubject ? '4 2' : undefined}
                    style={{
                      transition: 'r 0.15s ease-out, stroke-width 0.15s ease-out',
                    }}
                  />

                  {/* Label for larger bubbles or hovered */}
                  {(r >= 18 || isHovered) && (
                    <text
                      x={cx}
                      y={cy}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#fff"
                      fontSize={10}
                      fontWeight={500}
                      pointerEvents="none"
                      className="select-none"
                    >
                      {point.name.length > 12
                        ? point.name.slice(0, 10) + '…'
                        : point.name}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {/* Tooltip */}
          {hoveredPoint && !selectedPoint && (
            <Tooltip
              point={hoveredPoint}
              x={scaleX(hoveredPoint.x, plotAreaWidth)}
              y={scaleY(hoveredPoint.y, plotAreaHeight)}
            />
          )}
        </svg>
      </div>

      {/* Modality indicator */}
      {plotData.modality && (
        <div className="text-xs text-slate-500 text-center">
          Competitive Mode: <span className="text-slate-400">{plotData.modality}</span>
        </div>
      )}

      {/* Detail Panel */}
      {selectedPoint && (
        <DetailPanel
          point={selectedPoint}
          onClose={() => setSelectedPoint(null)}
        />
      )}
    </div>
  );
}
