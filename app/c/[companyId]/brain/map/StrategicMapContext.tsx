'use client';

// app/c/[companyId]/brain/map/StrategicMapContext.tsx
// Strategic Map 2.0 Context Provider
//
// Provides global state for:
// - Mode switching (Structure, Insights, Actions, Signals)
// - Heatmap overlay toggle
// - Focus mode state
// - Node selection and hover
// - Ghost node visibility
// - AI panel state
// - Filter state
// - Timeline slider position

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type {
  StrategicMapNode,
  StrategicMapGraph,
  StrategicMapNodeDomain,
} from '@/lib/contextGraph/strategicMap';
import type { ContextHealthScore } from '@/lib/contextGraph/health';
import type { ClientInsight } from '@/lib/types/clientBrain';

// ============================================================================
// Types
// ============================================================================

/**
 * Strategic Map viewing modes
 */
export type StrategicMapMode = 'structure' | 'insights' | 'actions' | 'signals';

/**
 * Mode configuration with metadata
 */
export interface ModeConfig {
  id: StrategicMapMode;
  label: string;
  description: string;
  icon: 'network' | 'lightbulb' | 'zap' | 'radar';
  /** Emphasizes different node properties */
  emphasis: 'completeness' | 'insights' | 'actions' | 'signals';
}

/**
 * Ghost node representing empty/missing context
 */
export interface GhostNode {
  id: string;
  label: string;
  domain: StrategicMapNodeDomain;
  suggestion: string;
  priority: 'high' | 'medium' | 'low';
  fieldPaths: string[];
}

/**
 * Node-specific insights for the drawer
 */
export interface NodeInsight {
  id: string;
  type: 'opportunity' | 'gap' | 'strength' | 'risk';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
  relatedInsightId?: string;
}

/**
 * AI-generated node summary
 */
export interface NodeAISummary {
  summary: string;
  confidence: number;
  recommendations: string[];
  relatedQuestions: string[];
  generatedAt: string;
}

/**
 * Filter state for macro-level filtering
 */
export interface MapFilters {
  domain: StrategicMapNodeDomain | 'all';
  completeness: 'all' | 'full' | 'partial' | 'empty';
  source: 'all' | 'human' | 'ai' | 'mixed';
  criticality: 'all' | 'high' | 'medium' | 'low';
  confidence: 'all' | 'low' | 'medium' | 'high';
  hasInsights: 'all' | 'yes' | 'no';
  dependencies: 'all' | 'high' | 'low';
}

/**
 * AI panel state for map-level AI features
 */
export interface AIAnalysisState {
  isLoading: boolean;
  type: 'explain' | 'gaps' | 'opportunities' | null;
  result: unknown | null;
  error: string | null;
}

/**
 * Focus mode state for single-node deep dive
 */
export interface FocusModeState {
  isActive: boolean;
  focusedNodeId: string | null;
  upstreamIds: string[];
  downstreamIds: string[];
  circuitExplanation: string | null;
}

/**
 * Strategic Map context state
 */
export interface StrategicMapContextState {
  // Mode
  mode: StrategicMapMode;
  setMode: (mode: StrategicMapMode) => void;
  modeConfigs: ModeConfig[];

  // Node selection
  selectedNode: StrategicMapNode | null;
  setSelectedNode: (node: StrategicMapNode | null) => void;
  hoveredNode: string | null;
  setHoveredNode: (nodeId: string | null) => void;

  // Ghost nodes
  showGhostNodes: boolean;
  setShowGhostNodes: (show: boolean) => void;
  ghostNodes: GhostNode[];

  // Heatmap
  showHeatmap: boolean;
  setShowHeatmap: (show: boolean) => void;

  // Focus mode
  focusMode: FocusModeState;
  enterFocusMode: (nodeId: string) => void;
  exitFocusMode: () => void;

  // Filters
  filters: MapFilters;
  setFilters: (filters: MapFilters) => void;
  resetFilters: () => void;

  // AI state
  isAILoading: boolean;
  setIsAILoading: (loading: boolean) => void;
  nodeSummaries: Record<string, NodeAISummary>;
  setNodeSummary: (nodeId: string, summary: NodeAISummary) => void;

  // Node insights (keyed by node ID)
  nodeInsights: Record<string, NodeInsight[]>;
  setNodeInsights: (nodeId: string, insights: NodeInsight[]) => void;

  // Map-level AI analysis
  aiAnalysis: AIAnalysisState;
  runAIAnalysis: (type: 'explain' | 'gaps' | 'opportunities') => Promise<void>;
  clearAIAnalysis: () => void;

  // Global insights from Brain
  globalInsights: ClientInsight[];

  // Drawer state
  drawerTab: 'summary' | 'fields' | 'provenance' | 'insights' | 'ai' | 'work';
  setDrawerTab: (tab: 'summary' | 'fields' | 'provenance' | 'insights' | 'ai' | 'work') => void;

  // Timeline
  timelinePosition: number; // 0 = current, negative = past snapshots
  setTimelinePosition: (position: number) => void;
  availableSnapshots: number;

  // Company context
  companyId: string;
  companyName: string;

  // Graph data
  mapGraph: StrategicMapGraph;

  // Health score
  healthScore: ContextHealthScore;

  // Pinned nodes
  pinnedNodeIds: Set<string>;
  togglePinNode: (nodeId: string) => void;
}

// ============================================================================
// Mode Configurations
// ============================================================================

export const MODE_CONFIGS: ModeConfig[] = [
  {
    id: 'structure',
    label: 'Structure',
    description: 'View context completeness and data flow',
    icon: 'network',
    emphasis: 'completeness',
  },
  {
    id: 'insights',
    label: 'Insights',
    description: 'See AI-generated insights per node',
    icon: 'lightbulb',
    emphasis: 'insights',
  },
  {
    id: 'actions',
    label: 'Actions',
    description: 'Focus on actionable recommendations',
    icon: 'zap',
    emphasis: 'actions',
  },
  {
    id: 'signals',
    label: 'Signals',
    description: 'Monitor changes and activity',
    icon: 'radar',
    emphasis: 'signals',
  },
];

// ============================================================================
// Default Filter State
// ============================================================================

const DEFAULT_FILTERS: MapFilters = {
  domain: 'all',
  completeness: 'all',
  source: 'all',
  criticality: 'all',
  confidence: 'all',
  hasInsights: 'all',
  dependencies: 'all',
};

// ============================================================================
// Context
// ============================================================================

const StrategicMapContext = createContext<StrategicMapContextState | null>(null);

// ============================================================================
// Provider Props
// ============================================================================

interface StrategicMapProviderProps {
  children: ReactNode;
  companyId: string;
  companyName: string;
  mapGraph: StrategicMapGraph;
  healthScore: ContextHealthScore;
  ghostNodes: GhostNode[];
  globalInsights: ClientInsight[];
  availableSnapshots?: number;
  initialMode?: StrategicMapMode;
  initialNodeId?: string;
}

// ============================================================================
// Provider Component
// ============================================================================

export function StrategicMapProvider({
  children,
  companyId,
  companyName,
  mapGraph,
  healthScore,
  ghostNodes,
  globalInsights,
  availableSnapshots = 0,
  initialMode = 'structure',
  initialNodeId,
}: StrategicMapProviderProps) {
  // Mode state
  const [mode, setMode] = useState<StrategicMapMode>(initialMode);

  // Node selection state
  const [selectedNode, setSelectedNodeState] = useState<StrategicMapNode | null>(() => {
    if (initialNodeId) {
      return mapGraph.nodes.find(n => n.id === initialNodeId) || null;
    }
    return null;
  });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Ghost node visibility
  const [showGhostNodes, setShowGhostNodes] = useState(true);

  // Heatmap visibility
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Focus mode
  const [focusMode, setFocusMode] = useState<FocusModeState>({
    isActive: false,
    focusedNodeId: null,
    upstreamIds: [],
    downstreamIds: [],
    circuitExplanation: null,
  });

  // Filters
  const [filters, setFiltersState] = useState<MapFilters>(DEFAULT_FILTERS);

  // AI state
  const [isAILoading, setIsAILoading] = useState(false);
  const [nodeSummaries, setNodeSummaries] = useState<Record<string, NodeAISummary>>({});
  const [nodeInsights, setNodeInsightsState] = useState<Record<string, NodeInsight[]>>({});

  // Map-level AI analysis
  const [aiAnalysis, setAIAnalysis] = useState<AIAnalysisState>({
    isLoading: false,
    type: null,
    result: null,
    error: null,
  });

  // Drawer tab state
  const [drawerTab, setDrawerTab] = useState<'summary' | 'fields' | 'provenance' | 'insights' | 'ai' | 'work'>('summary');

  // Timeline state
  const [timelinePosition, setTimelinePosition] = useState(0);

  // Pinned nodes (persisted in localStorage)
  const [pinnedNodeIds, setPinnedNodeIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`map-pinned-${companyId}`);
        if (stored) {
          return new Set(JSON.parse(stored));
        }
      } catch {
        // Ignore localStorage errors - fall back to empty set
      }
    }
    return new Set();
  });

  // ===== Callbacks =====

  const setSelectedNode = useCallback((node: StrategicMapNode | null) => {
    setSelectedNodeState(node);
    // Reset drawer tab when selecting new node
    if (node) {
      setDrawerTab('summary');
    }
  }, []);

  const setNodeSummary = useCallback((nodeId: string, summary: NodeAISummary) => {
    setNodeSummaries(prev => ({ ...prev, [nodeId]: summary }));
  }, []);

  const setNodeInsights = useCallback((nodeId: string, insights: NodeInsight[]) => {
    setNodeInsightsState(prev => ({ ...prev, [nodeId]: insights }));
  }, []);

  const setFilters = useCallback((newFilters: MapFilters) => {
    setFiltersState(newFilters);
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
  }, []);

  const enterFocusMode = useCallback((nodeId: string) => {
    // Find upstream and downstream nodes
    const upstreamIds: string[] = [];
    const downstreamIds: string[] = [];

    for (const edge of mapGraph.edges) {
      if (edge.to === nodeId) {
        upstreamIds.push(edge.from);
      }
      if (edge.from === nodeId) {
        downstreamIds.push(edge.to);
      }
    }

    setFocusMode({
      isActive: true,
      focusedNodeId: nodeId,
      upstreamIds,
      downstreamIds,
      circuitExplanation: null, // Will be populated by AI
    });
  }, [mapGraph.edges]);

  const exitFocusMode = useCallback(() => {
    setFocusMode({
      isActive: false,
      focusedNodeId: null,
      upstreamIds: [],
      downstreamIds: [],
      circuitExplanation: null,
    });
  }, []);

  const runAIAnalysis = useCallback(async (type: 'explain' | 'gaps' | 'opportunities') => {
    setAIAnalysis({
      isLoading: true,
      type,
      result: null,
      error: null,
    });

    try {
      const response = await fetch(`/api/os/companies/${companyId}/map/ai/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to run analysis');
      }

      const result = await response.json();

      setAIAnalysis({
        isLoading: false,
        type,
        result,
        error: null,
      });
    } catch (error) {
      setAIAnalysis({
        isLoading: false,
        type,
        result: null,
        error: error instanceof Error ? error.message : 'Analysis failed',
      });
    }
  }, [companyId]);

  const clearAIAnalysis = useCallback(() => {
    setAIAnalysis({
      isLoading: false,
      type: null,
      result: null,
      error: null,
    });
  }, []);

  const togglePinNode = useCallback((nodeId: string) => {
    setPinnedNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      // Persist to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(`map-pinned-${companyId}`, JSON.stringify([...next]));
      }
      return next;
    });
  }, [companyId]);

  // ===== Context Value =====

  const value: StrategicMapContextState = useMemo(() => ({
    mode,
    setMode,
    modeConfigs: MODE_CONFIGS,
    selectedNode,
    setSelectedNode,
    hoveredNode,
    setHoveredNode,
    showGhostNodes,
    setShowGhostNodes,
    ghostNodes,
    showHeatmap,
    setShowHeatmap,
    focusMode,
    enterFocusMode,
    exitFocusMode,
    filters,
    setFilters,
    resetFilters,
    isAILoading,
    setIsAILoading,
    nodeSummaries,
    setNodeSummary,
    nodeInsights,
    setNodeInsights,
    aiAnalysis,
    runAIAnalysis,
    clearAIAnalysis,
    globalInsights,
    drawerTab,
    setDrawerTab,
    timelinePosition,
    setTimelinePosition,
    availableSnapshots,
    companyId,
    companyName,
    mapGraph,
    healthScore,
    pinnedNodeIds,
    togglePinNode,
  }), [
    mode,
    selectedNode,
    setSelectedNode,
    hoveredNode,
    showGhostNodes,
    ghostNodes,
    showHeatmap,
    focusMode,
    enterFocusMode,
    exitFocusMode,
    filters,
    setFilters,
    resetFilters,
    isAILoading,
    nodeSummaries,
    setNodeSummary,
    nodeInsights,
    setNodeInsights,
    aiAnalysis,
    runAIAnalysis,
    clearAIAnalysis,
    globalInsights,
    drawerTab,
    timelinePosition,
    availableSnapshots,
    companyId,
    companyName,
    mapGraph,
    healthScore,
    pinnedNodeIds,
    togglePinNode,
  ]);

  return (
    <StrategicMapContext.Provider value={value}>
      {children}
    </StrategicMapContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useStrategicMap() {
  const context = useContext(StrategicMapContext);
  if (!context) {
    throw new Error('useStrategicMap must be used within a StrategicMapProvider');
  }
  return context;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get mode-specific node style properties
 */
export function getModeNodeStyle(
  node: StrategicMapNode,
  mode: StrategicMapMode,
  nodeInsights: NodeInsight[]
): {
  opacity: number;
  glowIntensity: number;
  badgeCount: number;
  badgeColor: string;
} {
  switch (mode) {
    case 'structure':
      return {
        opacity: node.completeness === 'full' ? 1 : node.completeness === 'partial' ? 0.75 : 0.5,
        glowIntensity: 0,
        badgeCount: 0,
        badgeColor: '',
      };

    case 'insights': {
      const insightCount = nodeInsights.length || node.insightCount;
      const hasHighPriority = nodeInsights.some(i => i.priority === 'high') ||
        node.highestSeverity === 'high' || node.highestSeverity === 'critical';
      const hasCritical = node.highestSeverity === 'critical';
      return {
        opacity: insightCount > 0 ? 1 : 0.4,
        glowIntensity: hasCritical ? 1 : hasHighPriority ? 0.8 : insightCount > 0 ? 0.4 : 0,
        badgeCount: insightCount,
        badgeColor: hasCritical ? '#ef4444' :
          hasHighPriority ? '#f97316' :
          node.highestSeverity === 'medium' ? '#f59e0b' : '#64748b',
      };
    }

    case 'actions': {
      const actionableCount = nodeInsights.filter(i => i.actionable).length;
      const hasConflicts = node.conflictFlags.length > 0;
      return {
        opacity: actionableCount > 0 || hasConflicts ? 1 : 0.5,
        glowIntensity: actionableCount > 2 ? 0.8 : actionableCount > 0 ? 0.4 : 0,
        badgeCount: actionableCount + (hasConflicts ? 1 : 0),
        badgeColor: hasConflicts ? '#ef4444' : '#10b981',
      };
    }

    case 'signals': {
      // Base on freshness score
      const isFresh = node.freshnessScore >= 70;
      const isStale = node.freshnessScore < 40;
      return {
        opacity: isFresh ? 1 : isStale ? 0.5 : 0.75,
        glowIntensity: isFresh ? 0.3 : 0,
        badgeCount: 0,
        badgeColor: '',
      };
    }

    default:
      return {
        opacity: 1,
        glowIntensity: 0,
        badgeCount: 0,
        badgeColor: '',
      };
  }
}

/**
 * Apply filters to nodes
 */
export function filterNodes(
  nodes: StrategicMapNode[],
  filters: MapFilters,
  nodeInsights: Record<string, NodeInsight[]>
): StrategicMapNode[] {
  return nodes.filter(node => {
    // Domain filter
    if (filters.domain !== 'all' && node.domain !== filters.domain) {
      return false;
    }

    // Completeness filter
    if (filters.completeness !== 'all' && node.completeness !== filters.completeness) {
      return false;
    }

    // Source filter
    if (filters.source !== 'all' && node.provenanceKind !== filters.source) {
      return false;
    }

    // Criticality filter
    if (filters.criticality !== 'all' && node.criticality !== filters.criticality) {
      return false;
    }

    // Confidence filter
    if (filters.confidence !== 'all') {
      const conf = node.confidenceScore;
      if (filters.confidence === 'low' && conf >= 50) return false;
      if (filters.confidence === 'medium' && (conf < 50 || conf > 80)) return false;
      if (filters.confidence === 'high' && conf <= 80) return false;
    }

    // Insights filter
    if (filters.hasInsights !== 'all') {
      const hasInsights = (nodeInsights[node.id]?.length || node.insightCount) > 0;
      if (filters.hasInsights === 'yes' && !hasInsights) return false;
      if (filters.hasInsights === 'no' && hasInsights) return false;
    }

    // Dependencies filter
    if (filters.dependencies !== 'all') {
      if (filters.dependencies === 'high' && node.dependencyCount < 3) return false;
      if (filters.dependencies === 'low' && node.dependencyCount >= 3) return false;
    }

    return true;
  });
}
