'use client';

// app/c/[companyId]/brain/map/MapNode.tsx
// Strategic Map 2.0 - Polished node components
//
// Features:
// - Rich pill/rounded rectangle design with domain colors
// - Health chip and source icon
// - Mode-specific visual treatments
// - Completeness-based border styles
// - Smooth hover animations
// - Heatmap overlay support
// - Enhanced tooltips with full metadata
// - Double-click for focus mode

import { useState, useCallback } from 'react';
import {
  User,
  Bot,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  Lightbulb,
  Zap,
  Clock,
  TrendingUp,
  Ghost,
  ChevronRight,
  CheckCircle,
  Link2,
  Pin,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import {
  useStrategicMap,
  getModeNodeStyle,
  type GhostNode,
  type StrategicMapMode,
} from './StrategicMapContext';
import {
  DOMAIN_COLORS,
  DOMAIN_LABELS,
  type StrategicMapNode,
  getHeatmapColor,
} from '@/lib/contextGraph/strategicMap';
import type { InsightSeverity } from '@/lib/types/clientBrain';

// ============================================================================
// Constants
// ============================================================================

export const NODE_WIDTH = 180;
export const NODE_HEIGHT = 80;
export const GHOST_NODE_WIDTH = 160;
export const GHOST_NODE_HEIGHT = 72;

// ============================================================================
// Types
// ============================================================================

interface MapNodeProps {
  node: StrategicMapNode;
  position: { x: number; y: number };
  isSelected: boolean;
  isHovered: boolean;
  isConnected: boolean;
  isFocused: boolean;
  isDimmed?: boolean; // For focus mode - dim unrelated nodes
  onClick: () => void;
  onDoubleClick?: () => void; // For focus mode
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

interface GhostMapNodeProps {
  ghost: GhostNode;
  position: { x: number; y: number };
  onClick: () => void;
  onHover?: (hovered: boolean) => void;
}

// ============================================================================
// Source Icon Component
// ============================================================================

function SourceIcon({ kind, size = 'sm' }: { kind: 'human' | 'ai' | 'mixed'; size?: 'sm' | 'md' }) {
  const sizeClasses = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const badgeClasses = size === 'sm'
    ? 'w-5 h-5 text-[8px]'
    : 'w-6 h-6 text-[9px]';

  if (kind === 'human') {
    return (
      <div className={`${badgeClasses} rounded-full bg-emerald-500/20 flex items-center justify-center`} title="Human-verified data">
        <span className="font-bold text-emerald-400">H</span>
      </div>
    );
  }
  if (kind === 'ai') {
    return (
      <div className={`${badgeClasses} rounded-full bg-violet-500/20 flex items-center justify-center`} title="AI-generated data">
        <Sparkles className={`${size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} text-violet-400`} />
      </div>
    );
  }
  return (
    <div className={`${badgeClasses} rounded-full bg-amber-500/20 flex items-center justify-center`} title="Mixed sources">
      <span className="font-bold text-amber-400">M</span>
    </div>
  );
}

// ============================================================================
// Health Chip Component
// ============================================================================

// ============================================================================
// Severity Color Helper
// ============================================================================

const SEVERITY_COLORS: Record<InsightSeverity, { bg: string; text: string; border: string; glow: string }> = {
  low: { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/50', glow: '#64748b' },
  medium: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/50', glow: '#f59e0b' },
  high: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/50', glow: '#f97316' },
  critical: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/50', glow: '#ef4444' },
};

function getSeverityColors(severity: InsightSeverity | null) {
  if (!severity) return SEVERITY_COLORS.low;
  return SEVERITY_COLORS[severity];
}

// ============================================================================
// Health Chip Component
// ============================================================================

function HealthChip({ score, size = 'sm' }: { score: number; size?: 'sm' | 'md' }) {
  const getColor = () => {
    if (score >= 70) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (score >= 40) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  };

  return (
    <div className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border ${getColor()} ${size === 'sm' ? 'text-[9px]' : 'text-[10px]'}`}>
      <span className="font-semibold">{score}%</span>
    </div>
  );
}

// ============================================================================
// Mode Badge Component
// ============================================================================

function ModeBadge({
  mode,
  node,
  insightCount,
  actionCount,
}: {
  mode: StrategicMapMode;
  node: StrategicMapNode;
  insightCount: number;
  actionCount: number;
}) {
  // Structure mode: show critical warning for empty critical nodes
  if (mode === 'structure') {
    if (node.isCritical && node.completeness === 'empty') {
      return (
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">
          <AlertCircle className="w-3 h-3" />
          <span className="text-[8px] font-medium">Critical</span>
        </div>
      );
    }
    return null;
  }

  // Insights mode: show insight count with severity-based colors
  if (mode === 'insights' && (insightCount > 0 || node.insightCount > 0)) {
    const count = insightCount || node.insightCount;
    const severityColors = getSeverityColors(node.highestSeverity);
    return (
      <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full ${severityColors.bg} ${severityColors.text}`}>
        <Lightbulb className="w-3 h-3" />
        <span className="text-[8px] font-bold">{count}</span>
        {node.highestSeverity && (node.highestSeverity === 'high' || node.highestSeverity === 'critical') && (
          <AlertTriangle className="w-2.5 h-2.5" />
        )}
      </div>
    );
  }

  // Actions mode: show action warning or count
  if (mode === 'actions') {
    if (node.completeness === 'empty' || (node.score !== undefined && node.score < 40)) {
      return (
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">
          <AlertTriangle className="w-3 h-3" />
        </div>
      );
    }
    if (actionCount > 0) {
      return (
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
          <Zap className="w-3 h-3" />
          <span className="text-[8px] font-bold">{actionCount}</span>
        </div>
      );
    }
    return null;
  }

  // Signals mode: show freshness indicator
  if (mode === 'signals') {
    return (
      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
        <Clock className="w-3 h-3" />
      </div>
    );
  }

  return null;
}

// ============================================================================
// MapNode Component
// ============================================================================

export function MapNode({
  node,
  position,
  isSelected,
  isHovered,
  isConnected,
  isFocused,
  isDimmed = false,
  onClick,
  onDoubleClick,
  onMouseEnter,
  onMouseLeave,
}: MapNodeProps) {
  const {
    mode,
    nodeInsights,
    isAILoading,
    showHeatmap,
    pinnedNodeIds,
    togglePinNode,
    focusMode,
  } = useStrategicMap();

  const [showTooltip, setShowTooltip] = useState(false);

  const insights = nodeInsights[node.id] || [];
  const actionableInsights = insights.filter(i => i.actionable);
  const modeStyle = getModeNodeStyle(node, mode, insights);
  const domainColor = DOMAIN_COLORS[node.domain];
  const isPinned = pinnedNodeIds.has(node.id);

  // Heatmap colors based on completeness score
  const heatmapColors = getHeatmapColor(node.completenessScore);

  // Handle double-click for focus mode
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDoubleClick?.();
  }, [onDoubleClick]);

  // Handle pin toggle
  const handlePinClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    togglePinNode(node.id);
  }, [node.id, togglePinNode]);

  // Show tooltip on hover after a delay
  const handleMouseEnterWithTooltip = () => {
    onMouseEnter();
    const timer = setTimeout(() => setShowTooltip(true), 500);
    return () => clearTimeout(timer);
  };

  const handleMouseLeaveWithTooltip = () => {
    onMouseLeave();
    setShowTooltip(false);
  };

  // Border style based on completeness
  const getBorderStyle = () => {
    switch (node.completeness) {
      case 'full': return 'solid';
      case 'partial': return 'dashed';
      case 'empty': return 'dotted';
    }
  };

  // Get urgency color for actions mode
  const getActionsModeBgColor = () => {
    if (mode !== 'actions') return `${domainColor}12`;
    if (node.completeness === 'empty' || (node.score !== undefined && node.score < 40)) {
      return 'rgba(239, 68, 68, 0.08)'; // red
    }
    if (node.score !== undefined && node.score < 70) {
      return 'rgba(245, 158, 11, 0.08)'; // amber
    }
    return 'rgba(16, 185, 129, 0.08)'; // emerald
  };

  // Get opacity for signals mode (fresher = more opaque)
  const getSignalsModeOpacity = () => {
    if (mode !== 'signals') return modeStyle.opacity;
    // For now, use completeness as a proxy for freshness
    return node.completeness === 'full' ? 1 : node.completeness === 'partial' ? 0.7 : 0.4;
  };

  // Compute final opacity considering focus mode dimming
  const computedOpacity = isDimmed
    ? 0.25
    : focusMode.isActive && !focusMode.upstreamIds.includes(node.id) && !focusMode.downstreamIds.includes(node.id) && focusMode.focusedNodeId !== node.id
      ? 0.35
      : mode === 'signals'
        ? getSignalsModeOpacity()
        : modeStyle.opacity;

  return (
    <div
      id={`node-${node.id}`}
      onClick={onClick}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={handleMouseEnterWithTooltip}
      onMouseLeave={handleMouseLeaveWithTooltip}
      className={`absolute cursor-pointer group ${
        isSelected || isHovered || isConnected ? 'z-20' : 'z-10'
      }`}
      style={{
        left: position.x,
        top: position.y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        opacity: computedOpacity,
        transition: 'all 200ms ease-out',
        transform: isHovered ? 'scale(1.03)' : 'scale(1)',
      }}
    >
      {/* Glow effect for insights mode - use severity color */}
      {mode === 'insights' && node.insightCount > 0 && (
        <div
          className="absolute -inset-2 rounded-2xl blur-xl transition-all duration-300"
          style={{
            backgroundColor: getSeverityColors(node.highestSeverity).glow,
            opacity: node.highestSeverity === 'critical' ? 0.35 :
                    node.highestSeverity === 'high' ? 0.3 :
                    node.highestSeverity === 'medium' ? 0.2 : 0.1,
          }}
        />
      )}

      {/* Glow effect for other modes */}
      {mode !== 'insights' && modeStyle.glowIntensity > 0 && (
        <div
          className="absolute -inset-2 rounded-2xl blur-xl transition-all duration-300"
          style={{
            backgroundColor: modeStyle.badgeColor,
            opacity: modeStyle.glowIntensity * 0.25,
          }}
        />
      )}

      {/* Selection glow */}
      {isSelected && (
        <div
          className="absolute -inset-1 rounded-2xl blur-md"
          style={{
            backgroundColor: '#f59e0b',
            opacity: 0.3,
          }}
        />
      )}

      {/* Main card */}
      <div
        className={`relative h-full rounded-xl transition-all duration-200 overflow-hidden ${
          isSelected
            ? 'ring-2 ring-amber-400 shadow-lg shadow-amber-500/25'
            : isHovered
              ? 'ring-2 ring-white/20 shadow-xl'
              : isConnected
                ? 'ring-1 ring-white/10'
                : ''
        } ${isFocused ? 'animate-pulse' : ''}`}
        style={{
          background: `linear-gradient(135deg, ${
            mode === 'actions' ? getActionsModeBgColor() :
            mode === 'insights' && node.insightCount > 0 ? `${getSeverityColors(node.highestSeverity).glow}12` :
            `${domainColor}12`
          } 0%, ${domainColor}08 100%)`,
          borderWidth: mode === 'insights' && node.insightCount > 0 && (node.highestSeverity === 'high' || node.highestSeverity === 'critical') ? '3px' : '2px',
          borderStyle: getBorderStyle(),
          borderColor: isSelected ? '#f59e0b' :
            mode === 'insights' && node.insightCount > 0 ? `${getSeverityColors(node.highestSeverity).glow}${node.highestSeverity === 'critical' ? 'cc' : node.highestSeverity === 'high' ? '99' : '66'}` :
            `${domainColor}${node.completeness === 'full' ? '80' : node.completeness === 'partial' ? '50' : '30'}`,
        }}
      >
        {/* Gradient overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />

        {/* Content */}
        <div className="relative h-full p-3 flex flex-col">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h4
              className="text-[11px] font-semibold leading-tight line-clamp-1"
              style={{ color: domainColor }}
            >
              {node.label}
            </h4>
            <ModeBadge
              mode={mode}
              node={node}
              insightCount={insights.length}
              actionCount={actionableInsights.length}
            />
          </div>

          {/* Value preview */}
          <div className="flex-1 min-h-0">
            {node.valuePreview ? (
              <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
                {node.valuePreview}
              </p>
            ) : (
              <p className="text-[10px] text-slate-600 italic">
                No data yet
              </p>
            )}
          </div>

          {/* Footer row */}
          <div className="flex items-center justify-between mt-auto pt-1.5">
            {/* Health chip */}
            <div className="flex items-center gap-1.5">
              {node.score !== undefined && (
                <HealthChip score={node.score} size="sm" />
              )}
              {node.score === undefined && node.completeness !== 'empty' && (
                <div className="flex items-center gap-1 text-[9px] text-slate-500">
                  <CheckCircle className="w-3 h-3 text-slate-600" />
                  <span>Has data</span>
                </div>
              )}
            </div>

            {/* Source icon */}
            <SourceIcon kind={node.provenanceKind} size="sm" />
          </div>
        </div>

        {/* Loading overlay */}
        {isAILoading && isSelected && (
          <div className="absolute inset-0 bg-slate-900/70 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Pin indicator */}
        {isPinned && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center shadow-lg">
            <Pin className="w-2.5 h-2.5 text-slate-900" />
          </div>
        )}

        {/* Pin button on hover */}
        {isHovered && !isPinned && (
          <button
            onClick={handlePinClick}
            className="absolute -top-1 -right-1 w-4 h-4 bg-slate-700 hover:bg-amber-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Pin className="w-2.5 h-2.5 text-slate-300 hover:text-slate-900" />
          </button>
        )}
      </div>

      {/* Heatmap glow overlay */}
      {showHeatmap && (
        <div
          className="absolute -inset-4 rounded-3xl blur-2xl pointer-events-none"
          style={{
            backgroundColor: heatmapColors.glow,
            opacity: 0.4,
          }}
        />
      )}

      {/* Enhanced hover tooltip with full metadata */}
      {showTooltip && isHovered && !isSelected && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 z-50 pointer-events-none">
          <div className="relative bg-slate-800/95 backdrop-blur-sm border border-slate-700 rounded-xl shadow-2xl p-3 min-w-[220px] max-w-[280px]">
            {/* Arrow */}
            <div className="absolute left-1/2 -translate-x-1/2 top-full -mt-px">
              <div className="w-2 h-2 bg-slate-800 border-r border-b border-slate-700 rotate-45 -translate-y-1" />
            </div>

            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <h4 className="text-xs font-semibold text-slate-200">{node.label}</h4>
                <p className="text-[10px] text-slate-500">{DOMAIN_LABELS[node.domain]}</p>
              </div>
              <SourceIcon kind={node.provenanceKind} size="md" />
            </div>

            {/* Metrics row */}
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-slate-500">Complete:</span>
                <span className={`text-[10px] font-medium ${
                  node.completenessScore >= 70 ? 'text-emerald-400' :
                  node.completenessScore >= 40 ? 'text-amber-400' : 'text-red-400'
                }`}>{node.completenessScore}%</span>
              </div>
              <div className="w-px h-3 bg-slate-700" />
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-slate-500">Conf:</span>
                <span className="text-[10px] font-medium text-slate-300">{node.confidenceScore}%</span>
              </div>
              <div className="w-px h-3 bg-slate-700" />
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-slate-500">Fresh:</span>
                <span className={`text-[10px] font-medium ${
                  node.freshnessScore >= 70 ? 'text-emerald-400' :
                  node.freshnessScore >= 40 ? 'text-amber-400' : 'text-slate-500'
                }`}>{node.freshnessScore}%</span>
              </div>
            </div>

            {/* Dependencies */}
            <div className="flex items-center gap-3 mb-2 text-[10px]">
              <div className="flex items-center gap-1 text-slate-400">
                <ArrowUp className="w-3 h-3" />
                <span>{node.dependencyCount} deps</span>
              </div>
              {insights.length > 0 && (
                <div className="flex items-center gap-1 text-amber-400">
                  <Lightbulb className="w-3 h-3" />
                  <span>{insights.length} insights</span>
                </div>
              )}
              {node.conflictFlags.length > 0 && (
                <div className="flex items-center gap-1 text-red-400">
                  <AlertTriangle className="w-3 h-3" />
                  <span>{node.conflictFlags.length} issues</span>
                </div>
              )}
            </div>

            {/* Preview or conflict message */}
            {node.conflictFlags.length > 0 ? (
              <p className="text-[10px] text-red-400 leading-relaxed">
                {node.conflictFlags[0].message}
              </p>
            ) : node.valuePreview ? (
              <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-2">
                {node.valuePreview}
              </p>
            ) : (
              <p className="text-[10px] text-slate-600 italic">No data</p>
            )}

            {/* Hint */}
            <p className="text-[9px] text-slate-600 mt-2 pt-2 border-t border-slate-700">
              Click to select · Double-click for focus mode
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// GhostMapNode Component
// ============================================================================

export function GhostMapNode({ ghost, position, onClick, onHover }: GhostMapNodeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const domainColor = DOMAIN_COLORS[ghost.domain as keyof typeof DOMAIN_COLORS] || '#64748b';

  const handleMouseEnter = () => {
    setIsHovered(true);
    onHover?.(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    onHover?.(false);
  };

  return (
    <div
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="absolute cursor-pointer z-5"
      style={{
        left: position.x,
        top: position.y,
        width: GHOST_NODE_WIDTH,
        height: GHOST_NODE_HEIGHT,
        transition: 'all 200ms ease-out',
        transform: isHovered ? 'scale(1.05)' : 'scale(1)',
      }}
    >
      {/* Main card - translucent with dashed border */}
      <div
        className={`h-full rounded-xl p-3 border-2 border-dashed transition-all ${
          isHovered ? 'border-violet-400/60 bg-violet-500/5' : ''
        }`}
        style={{
          backgroundColor: isHovered ? undefined : `${domainColor}06`,
          borderColor: isHovered ? undefined : `${domainColor}25`,
        }}
      >
        {/* Ghost icon and label */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 rounded-full bg-violet-500/10 flex items-center justify-center">
            <Ghost className="w-3 h-3 text-violet-400/70" />
          </div>
          <span className="text-[10px] font-medium text-slate-500 truncate flex-1">
            {ghost.label}
          </span>
          {/* Priority badge */}
          <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${
            ghost.priority === 'high' ? 'bg-red-500/20 text-red-400' :
            ghost.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
            'bg-slate-500/20 text-slate-500'
          }`}>
            {ghost.priority}
          </span>
        </div>

        {/* Suggestion text */}
        <p className="text-[9px] text-slate-600 leading-relaxed line-clamp-2">
          {isHovered ? ghost.suggestion : 'No data yet'}
        </p>

        {/* Hover hint */}
        {isHovered && (
          <div className="flex items-center gap-1 mt-1.5 text-[8px] text-violet-400">
            <ChevronRight className="w-2.5 h-2.5" />
            <span>Click to fill in Context</span>
          </div>
        )}
      </div>

      {/* Tooltip on hover */}
      {isHovered && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 pointer-events-none">
          <div className="relative bg-slate-800 border border-slate-700 rounded-lg shadow-xl px-3 py-2 max-w-[200px]">
            {/* Arrow */}
            <div className="absolute left-1/2 -translate-x-1/2 top-full -mt-px">
              <div className="w-2 h-2 bg-slate-800 border-r border-b border-slate-700 rotate-45 -translate-y-1" />
            </div>
            <p className="text-[10px] text-slate-300 leading-relaxed">
              This area is empty. Filling it will improve Context Health and strategic clarity.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Node Badge Component (for use in lists)
// ============================================================================

interface NodeBadgeProps {
  node: StrategicMapNode;
  size?: 'sm' | 'md';
  showHealth?: boolean;
  onClick?: () => void;
}

export function NodeBadge({ node, size = 'sm', showHealth = false, onClick }: NodeBadgeProps) {
  const domainColor = DOMAIN_COLORS[node.domain];

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg transition-colors bg-slate-800/50 hover:bg-slate-800 ${
        size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'
      }`}
    >
      <span
        className={`rounded-full ${size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'}`}
        style={{ backgroundColor: domainColor }}
      />
      <span className="text-slate-300">{node.label}</span>
      {showHealth && node.score !== undefined && (
        <span className={`text-[9px] px-1 py-0.5 rounded ${
          node.score >= 70 ? 'bg-emerald-500/20 text-emerald-400' :
          node.score >= 40 ? 'bg-amber-500/20 text-amber-400' :
          'bg-red-500/20 text-red-400'
        }`}>
          {node.score}%
        </span>
      )}
    </button>
  );
}
