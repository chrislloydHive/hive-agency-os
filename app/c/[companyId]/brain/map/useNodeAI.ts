'use client';

// app/c/[companyId]/brain/map/useNodeAI.ts
// React hooks for AI-powered node features in Strategic Map 2.0

import { useState, useCallback } from 'react';
import type { StrategicMapNode } from '@/lib/contextGraph/strategicMap';
import type { NodeAISummary, NodeInsight } from './StrategicMapContext';

// ============================================================================
// Types
// ============================================================================

interface UseNodeSummaryOptions {
  companyId: string;
  onSuccess?: (summary: NodeAISummary) => void;
  onError?: (error: Error) => void;
}

interface UseNodeInsightsOptions {
  companyId: string;
  onSuccess?: (insights: NodeInsight[]) => void;
  onError?: (error: Error) => void;
}

// ============================================================================
// useNodeSummary Hook
// ============================================================================

export function useNodeSummary({ companyId, onSuccess, onError }: UseNodeSummaryOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const generateSummary = useCallback(
    async (node: StrategicMapNode): Promise<NodeAISummary | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/os/companies/${companyId}/map/node-summary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nodeId: node.id,
            nodeLabel: node.label,
            nodeDomain: node.domain,
            fieldPaths: node.fieldPaths,
            completeness: node.completeness,
            confidence: node.confidence,
            provenanceKind: node.provenanceKind,
            valuePreview: node.valuePreview,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const summary: NodeAISummary = await response.json();
        onSuccess?.(summary);
        return summary;

      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to generate summary');
        setError(error);
        onError?.(error);
        return null;

      } finally {
        setIsLoading(false);
      }
    },
    [companyId, onSuccess, onError]
  );

  return {
    generateSummary,
    isLoading,
    error,
  };
}

// ============================================================================
// useNodeInsights Hook
// ============================================================================

export function useNodeInsights({ companyId, onSuccess, onError }: UseNodeInsightsOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const generateInsights = useCallback(
    async (node: StrategicMapNode): Promise<NodeInsight[] | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/os/companies/${companyId}/map/node-insights`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nodeId: node.id,
            nodeLabel: node.label,
            nodeDomain: node.domain,
            fieldPaths: node.fieldPaths,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        const insights: NodeInsight[] = data.insights || [];
        onSuccess?.(insights);
        return insights;

      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to generate insights');
        setError(error);
        onError?.(error);
        return null;

      } finally {
        setIsLoading(false);
      }
    },
    [companyId, onSuccess, onError]
  );

  return {
    generateInsights,
    isLoading,
    error,
  };
}

// ============================================================================
// Combined useNodeAI Hook
// ============================================================================

interface UseNodeAIOptions {
  companyId: string;
  onSummaryGenerated?: (nodeId: string, summary: NodeAISummary) => void;
  onInsightsGenerated?: (nodeId: string, insights: NodeInsight[]) => void;
}

export function useNodeAI({ companyId, onSummaryGenerated, onInsightsGenerated }: UseNodeAIOptions) {
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set());

  const { generateSummary, isLoading: isSummaryLoading } = useNodeSummary({
    companyId,
  });

  const { generateInsights, isLoading: isInsightsLoading } = useNodeInsights({
    companyId,
  });

  const loadNodeAI = useCallback(
    async (node: StrategicMapNode) => {
      // Mark node as loading
      setLoadingNodes(prev => new Set([...prev, node.id]));

      try {
        // Generate summary and insights in parallel
        const [summary, insights] = await Promise.all([
          generateSummary(node),
          generateInsights(node),
        ]);

        if (summary) {
          onSummaryGenerated?.(node.id, summary);
        }

        if (insights) {
          onInsightsGenerated?.(node.id, insights);
        }

        return { summary, insights };

      } finally {
        // Remove from loading set
        setLoadingNodes(prev => {
          const next = new Set(prev);
          next.delete(node.id);
          return next;
        });
      }
    },
    [generateSummary, generateInsights, onSummaryGenerated, onInsightsGenerated]
  );

  const isNodeLoading = useCallback(
    (nodeId: string) => loadingNodes.has(nodeId),
    [loadingNodes]
  );

  return {
    loadNodeAI,
    isNodeLoading,
    isLoading: isSummaryLoading || isInsightsLoading,
    loadingNodes: Array.from(loadingNodes),
  };
}

// ============================================================================
// Prefetch Hook for Visible Nodes
// ============================================================================

interface UsePrefetchNodeAIOptions {
  companyId: string;
  enabled?: boolean;
  maxConcurrent?: number;
}

export function usePrefetchNodeAI({
  companyId,
  enabled = true,
  maxConcurrent = 2,
}: UsePrefetchNodeAIOptions) {
  const [prefetchedNodes, setPrefetchedNodes] = useState<Set<string>>(new Set());
  const [prefetchQueue, setPrefetchQueue] = useState<StrategicMapNode[]>([]);

  const { loadNodeAI, isLoading, loadingNodes } = useNodeAI({
    companyId,
    onSummaryGenerated: (nodeId) => {
      setPrefetchedNodes(prev => new Set([...prev, nodeId]));
    },
  });

  const queuePrefetch = useCallback(
    (nodes: StrategicMapNode[]) => {
      if (!enabled) return;

      // Filter out already prefetched or currently loading nodes
      const newNodes = nodes.filter(
        n => !prefetchedNodes.has(n.id) && !loadingNodes.includes(n.id)
      );

      if (newNodes.length > 0) {
        setPrefetchQueue(prev => [...prev, ...newNodes.slice(0, maxConcurrent)]);
      }
    },
    [enabled, prefetchedNodes, loadingNodes, maxConcurrent]
  );

  // Process prefetch queue
  // Note: In production, this would use useEffect with proper cleanup

  return {
    queuePrefetch,
    prefetchedNodes: Array.from(prefetchedNodes),
    isPrefetching: isLoading,
  };
}
