'use client';

// app/c/[companyId]/context/ContextWorkspaceClient.tsx
// Context Workspace Client Component
//
// Uses Map view (default) and Table view for context management.
// - Map View: Visual node diagram with AI-first proposal workflow
// - Table View: Searchable, sortable list with bulk actions
//
// DEPRECATED: Form view has been removed (Dec 2025).
// - Users can now do everything via Map or Table view
// - All context edits persist to ContextNodes/ContextGraphs
// - For admin form editing, see /brain/context/components/ContextFormView.tsx
//
// Deep links supported:
// - ?focusKey=identity.businessModel - Focus on specific node
// - ?zone=identity - Focus on specific zone
// - ?filterStatus=proposed - Switch to Table view filtered to proposals

import { useCallback, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { BookOpen, Map, FileText, Loader2, Play, Trash2 } from 'lucide-react';
import type { CompanyContext } from '@/lib/types/context';
import type { DraftableState } from '@/lib/os/draft/types';
import type { DiagnosticsDebugInfo } from '@/lib/os/diagnostics/debugInfo';
import type { HydratedContextNode } from '@/lib/contextGraph/nodes/hydration';
import { useDraftableResource } from '@/hooks/useDraftableResource';
import { DiagnosticsDebugDrawer } from '@/components/context';
import { ContextMapClient, AddNodeModal } from '@/components/context-map';
import type { ZoneId } from '@/components/context-map/types';
import { useProposals } from '@/hooks/useProposals';

// ============================================================================
// Types
// ============================================================================

type ViewMode = 'map' | 'table';

interface ContextWorkspaceClientProps {
  companyId: string;
  companyName: string;
  initialState: DraftableState<CompanyContext>;
  debugInfo?: DiagnosticsDebugInfo;
  hydratedNodes?: HydratedContextNode[];
}

// ============================================================================
// Main Component
// ============================================================================

export function ContextWorkspaceClient({
  companyId,
  companyName,
  initialState,
  debugInfo,
  hydratedNodes = [],
}: ContextWorkspaceClientProps) {
  // Deep link URL parameters
  const searchParams = useSearchParams();
  const router = useRouter();
  const focusKey = searchParams.get('focusKey');
  const focusKeysParam = searchParams.get('focusKeys'); // Comma-separated list for Fix button
  const focusZone = searchParams.get('zone');
  const filterStatus = searchParams.get('filterStatus'); // 'proposed' | 'confirmed' | null
  const batchId = searchParams.get('batch'); // Deep link to a specific proposal batch

  // Parse focusKeys into an array (for Fix button navigation)
  const focusKeys = focusKeysParam ? focusKeysParam.split(',') : focusKey ? [focusKey] : [];

  // View mode state - default to Map, switch to Table if filtering by status or multiple focusKeys
  // Table view is for bulk review/filtering, Map is for spatial understanding
  const [viewMode, setViewMode] = useState<ViewMode>(
    filterStatus === 'proposed' || focusKeys.length > 1 ? 'table' : 'map'
  );

  // Use the draftable resource hook for generating initial context
  const {
    formValues: context,
    shouldShowGenerateButton,
    isGenerating,
    isRegenerating,
    error,
    handleGenerate,
  } = useDraftableResource<CompanyContext>({
    companyId,
    kind: 'context',
    initialState,
  });

  // AI-First Context: Load pending proposals
  const {
    acceptProposal,
    rejectProposal,
    loadProposals: refreshProposals,
  } = useProposals({ companyId });

  // Note: Form view has been deprecated - Context editing now happens through ContextMapClient

  // ============================================================================
  // Render: No Prerequisites - Show Run Diagnostics button
  // ============================================================================

  if (shouldShowGenerateButton) {
    return (
      <div className="space-y-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center">
          <h1 className="text-xl font-semibold text-white mb-2">
            Context for {companyName}
          </h1>
          <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
            Run diagnostics to analyze your digital footprint, competitors, and auto-generate context.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-left max-w-md mx-auto">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-cyan-500 text-slate-900 rounded-lg hover:bg-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-wait"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Running Diagnostics...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Diagnostics
              </>
            )}
          </button>

          {isGenerating && (
            <p className="text-xs text-slate-500 mt-3">
              This may take 1-2 minutes...
            </p>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // Render: Loading state (auto-generating or regenerating without content)
  // ============================================================================

  if ((isRegenerating || isGenerating) && !context.businessModel && !context.primaryAudience) {
    return (
      <div className="space-y-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">
            Generating Context...
          </h1>
          <p className="text-sm text-slate-400">
            Analyzing baseline data and building your context draft.
          </p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Context Map Handlers
  // ============================================================================

  // Node state - allows updating nodes after edits
  // Ensure we always have an array even if hydratedNodes is undefined
  const [nodes, setNodes] = useState<HydratedContextNode[]>(hydratedNodes || []);

  // Map view handlers for proposal actions
  const handleMapAcceptProposal = useCallback(async (proposalId: string, batchId: string) => {
    console.log(`[Context Map] Accept proposal called:`, { proposalId, batchId });

    // Find the node with this pending proposal
    const node = nodes.find(n =>
      n.pendingProposal?.id === proposalId || n.proposalBatchId === batchId
    );

    console.log(`[Context Map] Found node for accept:`, node ? {
      key: node.key,
      status: node.status,
      pendingProposalId: node.pendingProposal?.id,
      proposalBatchId: node.proposalBatchId,
      proposedValue: node.pendingProposal?.proposedValue,
    } : 'NOT FOUND');

    // Pass proposal details so server can apply value even if batch isn't in Airtable
    await acceptProposal(proposalId, batchId, {
      fieldPath: node?.key,
      proposedValue: node?.pendingProposal?.proposedValue ?? node?.value,
      companyId,
    });

    // Update local node state to mark as confirmed
    if (node) {
      setNodes((prevNodes) =>
        prevNodes.map((n) =>
          n.key === node.key
            ? {
                ...n,
                status: 'confirmed' as const,
                source: 'user' as const,
                lastUpdated: new Date().toISOString(),
                pendingProposal: undefined,
                proposalBatchId: undefined,
              }
            : n
        )
      );
      console.log(`[Context Map] Accepted proposal, confirmed node: ${node.key}`);
    }

    // Refresh proposals after accept
    await refreshProposals();
  }, [acceptProposal, refreshProposals, nodes, companyId]);

  const handleMapRejectProposal = useCallback(async (proposalId: string, batchId: string) => {
    // Find the node with this pending proposal
    const node = nodes.find(n =>
      n.pendingProposal?.id === proposalId || n.proposalBatchId === batchId
    );

    await rejectProposal(proposalId, batchId);

    // Remove the node from local state (rejected proposals are removed)
    if (node) {
      setNodes((prevNodes) => prevNodes.filter((n) => n.key !== node.key));
      console.log(`[Context Map] Rejected proposal, removed node: ${node.key}`);
    }

    // Refresh proposals after reject
    await refreshProposals();
  }, [rejectProposal, refreshProposals, nodes]);

  const handleMapEditProposal = useCallback(async (proposalId: string, batchId: string, value: unknown) => {
    console.log(`[Context Map] Edit proposal called:`, { proposalId, batchId, value });

    // Find the node with this pending proposal
    const node = nodes.find(n =>
      n.pendingProposal?.id === proposalId || n.proposalBatchId === batchId
    );

    // Edit is handled through the resolve API with action='edit'
    const response = await fetch('/api/os/context/proposals/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchId,
        proposalId,
        action: 'edit',
        editedValue: value,
        userId: 'user', // TODO: Get actual user ID
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to edit proposal');
    }

    // Update local node state - edited and accepted means confirmed
    if (node) {
      setNodes((prevNodes) =>
        prevNodes.map((n) =>
          n.key === node.key
            ? {
                ...n,
                value,
                status: 'confirmed' as const,
                source: 'user' as const,
                lastUpdated: new Date().toISOString(),
                pendingProposal: undefined,
                proposalBatchId: undefined,
              }
            : n
        )
      );
      console.log(`[Context Map] Edited proposal, confirmed node: ${node.key} with value:`, value);
    }

    // Refresh proposals after edit
    await refreshProposals();
  }, [refreshProposals, nodes]);

  /**
   * Handle updating a confirmed node value
   * This calls the API and updates local state
   */
  const handleMapUpdateNode = useCallback(async (nodeKey: string, value: unknown) => {
    const response = await fetch('/api/os/context/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        nodeKey,
        value,
        source: 'user',
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error || 'Failed to update context');
    }

    // Update local node state - mark as confirmed after save
    setNodes((prevNodes) => {
      const updatedNodes = prevNodes.map((node) =>
        node.key === nodeKey
          ? {
              ...node,
              value,
              status: 'confirmed' as const,
              lastUpdated: new Date().toISOString(),
              source: 'user' as const,
              pendingProposal: undefined,
              proposalBatchId: undefined,
            }
          : node
      );
      const updatedNode = updatedNodes.find(n => n.key === nodeKey);
      console.log(`[Context Map] Updated node state:`, {
        key: nodeKey,
        status: updatedNode?.status,
        hadPendingProposal: prevNodes.find(n => n.key === nodeKey)?.pendingProposal !== undefined,
        nowHasPendingProposal: updatedNode?.pendingProposal !== undefined,
      });
      return updatedNodes;
    });

    console.log(`[Context Map] Saved node: ${nodeKey} =`, value);
  }, [companyId]);

  /**
   * Handle deleting a node value
   * This calls the API with delete action and updates local state
   */
  const handleMapDeleteNode = useCallback(async (nodeKey: string) => {
    const response = await fetch('/api/os/context/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        nodeKey,
        action: 'delete',
        source: 'user',
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error || 'Failed to delete context');
    }

    // Update local node state - remove the value but keep the node structure
    setNodes((prevNodes) =>
      prevNodes.map((node) =>
        node.key === nodeKey
          ? {
              ...node,
              value: null,
              status: 'confirmed' as const,
              lastUpdated: new Date().toISOString(),
              source: 'user' as const,
              pendingProposal: undefined,
              proposalBatchId: undefined,
            }
          : node
      )
    );

    console.log(`[Context Map] Deleted node value: ${nodeKey}`);
  }, [companyId]);

  // AI suggestion state
  const [aiSuggestionLoading, setAiSuggestionLoading] = useState<string | null>(null);
  const [aiSuggestionError, setAiSuggestionError] = useState<string | null>(null);

  // Dev-only hard cleanup state
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  /**
   * DEV ONLY: Hard cleanup of non-canonical fields
   * Calls the canonicalize API with mode=hard to delete deprecated fields from storage
   */
  const handleHardCleanup = useCallback(async () => {
    if (!confirm('Hard delete all deprecated fields (brand.healthScore, brand.dimensionScores, etc.) from storage?')) {
      return;
    }

    setIsCleaningUp(true);
    try {
      const response = await fetch('/api/os/context/canonicalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          mode: 'hard',
        }),
      });

      const data = await response.json();
      console.log('[Hard Cleanup] Result:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Hard cleanup failed');
      }

      alert(`Cleaned up ${data.totalAffected} deprecated fields. Reloading...`);
      router.refresh();
    } catch (error) {
      console.error('[Hard Cleanup] Error:', error);
      alert(`Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCleaningUp(false);
    }
  }, [companyId, router]);

  // Manual add node modal state
  const [addNodeModalOpen, setAddNodeModalOpen] = useState(false);
  const [addNodeZoneId, setAddNodeZoneId] = useState<ZoneId | null>(null);

  // Get existing node keys for the modal (to filter out already-populated fields)
  const existingNodeKeys = new Set(nodes.filter(n => n.value !== null && n.value !== undefined).map(n => n.key));

  /**
   * Handle AI suggestion for a zone
   * This calls the suggest-zone API and adds proposals to local state
   */
  const handleMapSuggestWithAI = useCallback(async (zoneId: string) => {
    setAiSuggestionLoading(zoneId);
    setAiSuggestionError(null);

    try {
      const response = await fetch('/api/os/context/suggest-zone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          zoneId,
          force: true, // Ghost card clicked = force generate even if legacy context has values
        }),
      });

      const data = await response.json();
      console.log('[AI Suggest] API Response:', data);

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to generate suggestions');
      }

      // Convert proposals to HydratedContextNode format and add to local state
      if (data.proposals && data.proposals.length > 0) {
        const newNodes: HydratedContextNode[] = data.proposals.map((p: {
          fieldPath: string;
          fieldLabel: string;
          proposedValue: unknown;
          confidence: number;
          reasoning: string;
        }) => ({
          key: p.fieldPath,
          category: p.fieldPath.split('.')[0] || zoneId,
          value: p.proposedValue,
          status: 'proposed' as const,
          source: 'ai' as const,
          confidence: p.confidence,
          lastUpdated: new Date().toISOString(),
          pendingProposal: {
            id: `proposal-${Date.now()}-${p.fieldPath}`,
            fieldPath: p.fieldPath,
            fieldLabel: p.fieldLabel,
            proposedValue: p.proposedValue,
            currentValue: null,
            reasoning: p.reasoning,
            confidence: p.confidence,
            status: 'pending' as const,
            createdAt: new Date().toISOString(),
          },
          proposalBatchId: data.batch?.id,
        }));

        // Add new nodes to state (filter out duplicates by key)
        setNodes((prevNodes) => {
          const existingKeys = new Set(prevNodes.map((n) => n.key));
          const uniqueNewNodes = newNodes.filter((n) => !existingKeys.has(n.key));
          console.log(`[AI Suggest] Prev nodes: ${prevNodes.length}, New unique: ${uniqueNewNodes.length}`);
          console.log('[AI Suggest] New nodes:', uniqueNewNodes);
          return [...prevNodes, ...uniqueNewNodes];
        });

        console.log(`[AI Suggest] Added ${newNodes.length} proposed nodes for zone ${zoneId}`);
      } else {
        console.log(`[AI Suggest] No suggestions generated for zone ${zoneId}`);
      }

      // Also try to refresh proposals from server (in case they were persisted)
      await refreshProposals();
    } catch (error) {
      console.error('[AI Suggest] Error:', error);
      setAiSuggestionError(error instanceof Error ? error.message : 'Failed to generate suggestions');
    } finally {
      setAiSuggestionLoading(null);
    }
  }, [companyId, refreshProposals]);

  /**
   * Handle add node action from zone header
   * Routes to AI suggestion or opens manual add flow
   */
  const handleMapAddNode = useCallback((zoneId: string, mode: 'ai' | 'manual') => {
    if (mode === 'ai') {
      // Trigger AI suggestion for this zone
      handleMapSuggestWithAI(zoneId);
    } else {
      // Open manual add modal
      setAddNodeZoneId(zoneId as ZoneId);
      setAddNodeModalOpen(true);
    }
  }, [handleMapSuggestWithAI]);

  /**
   * Handle manual node creation submission
   * Creates a proposed node with source=user
   */
  const handleManualNodeSubmit = useCallback(async (fieldKey: string, value: string) => {
    // Call the update API to create a proposed node
    const response = await fetch('/api/os/context/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        nodeKey: fieldKey,
        value,
        source: 'user',
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error || 'Failed to add context');
    }

    // Add the new node to local state as proposed (source=user means it needs confirmation)
    const newNode: HydratedContextNode = {
      key: fieldKey,
      category: fieldKey.split('.')[0] || 'other',
      value,
      status: 'proposed', // User-entered values start as proposed
      source: 'user',
      confidence: 1.0,
      lastUpdated: new Date().toISOString(),
      provenance: [{
        source: 'user',
        confidence: 1.0,
        updatedAt: new Date().toISOString(),
      }],
    };

    setNodes((prevNodes) => {
      // Check if node exists
      const existingIndex = prevNodes.findIndex(n => n.key === fieldKey);
      if (existingIndex >= 0) {
        // Update existing node
        const updated = [...prevNodes];
        updated[existingIndex] = newNode;
        return updated;
      }
      // Add new node
      return [...prevNodes, newNode];
    });

    console.log(`[Context Map] Added manual node: ${fieldKey} = ${value}`);
  }, [companyId]);

  // ============================================================================
  // Render: Map View
  // ============================================================================

  if (viewMode === 'map') {
    return (
      <div className="space-y-4">
        {/* Header with View Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-cyan-400" />
              Context Map
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {nodes.length} fields for {companyName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* DEV ONLY: Hard Cleanup Button */}
            {process.env.NODE_ENV === 'development' && (
              <button
                onClick={handleHardCleanup}
                disabled={isCleaningUp}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors bg-red-900/50 text-red-300 hover:bg-red-800/50 disabled:opacity-50"
                title="Hard delete deprecated fields from storage"
              >
                {isCleaningUp ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                Cleanup
              </button>
            )}
            {/* View Mode Toggle - Map is active in this view */}
            <div className="flex items-center gap-1 p-0.5 bg-slate-800 rounded-lg">
              <button
                onClick={() => setViewMode('map')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors bg-slate-700 text-white"
              >
                <Map className="w-3.5 h-3.5" />
                Map
              </button>
              <button
                onClick={() => setViewMode('table')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors text-slate-400 hover:text-slate-300"
              >
                <FileText className="w-3.5 h-3.5" />
                Table
              </button>
            </div>
          </div>
        </div>

        {/* AI Suggestion Error */}
        {aiSuggestionError && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between">
            <p className="text-sm text-red-400">{aiSuggestionError}</p>
            <button
              onClick={() => setAiSuggestionError(null)}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Context Map */}
        <div className="h-[calc(100vh-200px)] min-h-[600px] bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <ContextMapClient
            nodes={nodes}
            companyId={companyId}
            onAcceptProposal={handleMapAcceptProposal}
            onRejectProposal={handleMapRejectProposal}
            onEditProposal={handleMapEditProposal}
            onUpdateNode={handleMapUpdateNode}
            onDeleteNode={handleMapDeleteNode}
            onSuggestWithAI={handleMapSuggestWithAI}
            onAddNode={handleMapAddNode}
            loadingZoneId={aiSuggestionLoading}
            focusKey={focusKey || undefined}
            focusKeys={focusKeys.length > 0 ? focusKeys : undefined}
            focusZone={focusZone || undefined}
            initialStatusFilter={filterStatus as 'all' | 'confirmed' | 'proposed' | undefined}
            focusBatchId={batchId || undefined}
          />
        </div>

        {/* Add Node Modal */}
        {addNodeZoneId && (
          <AddNodeModal
            isOpen={addNodeModalOpen}
            zoneId={addNodeZoneId}
            existingNodeKeys={existingNodeKeys}
            onClose={() => {
              setAddNodeModalOpen(false);
              setAddNodeZoneId(null);
            }}
            onSubmit={handleManualNodeSubmit}
          />
        )}
      </div>
    );
  }

  // ============================================================================
  // Render: Table View
  // ============================================================================

  return (
    <div className="space-y-4">
      {/* Header with View Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            Context Table
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {nodes.length} fields for {companyName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* DEV ONLY: Hard Cleanup Button */}
          {process.env.NODE_ENV === 'development' && (
            <button
              onClick={handleHardCleanup}
              disabled={isCleaningUp}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors bg-red-900/50 text-red-300 hover:bg-red-800/50 disabled:opacity-50"
              title="Hard delete deprecated fields from storage"
            >
              {isCleaningUp ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              Cleanup
            </button>
          )}
          {/* View Mode Toggle - Table is active in this view */}
          <div className="flex items-center gap-1 p-0.5 bg-slate-800 rounded-lg">
            <button
              onClick={() => setViewMode('map')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors text-slate-400 hover:text-slate-300"
            >
              <Map className="w-3.5 h-3.5" />
              Map
            </button>
            <button
              onClick={() => setViewMode('table')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors bg-slate-700 text-white"
            >
              <FileText className="w-3.5 h-3.5" />
              Table
            </button>
          </div>
        </div>
      </div>

      {/* AI Suggestion Error */}
      {aiSuggestionError && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between">
          <p className="text-sm text-red-400">{aiSuggestionError}</p>
          <button
            onClick={() => setAiSuggestionError(null)}
            className="text-xs text-red-400 hover:text-red-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Context Table (ContextMapClient in list mode) */}
      <div className="h-[calc(100vh-200px)] min-h-[600px] bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <ContextMapClient
          nodes={nodes}
          companyId={companyId}
          onAcceptProposal={handleMapAcceptProposal}
          onRejectProposal={handleMapRejectProposal}
          onEditProposal={handleMapEditProposal}
          onUpdateNode={handleMapUpdateNode}
          onDeleteNode={handleMapDeleteNode}
          onSuggestWithAI={handleMapSuggestWithAI}
          onAddNode={handleMapAddNode}
          loadingZoneId={aiSuggestionLoading}
          focusKey={focusKey || undefined}
          focusKeys={focusKeys.length > 0 ? focusKeys : undefined}
          focusZone={focusZone || undefined}
          externalViewMode="list"
          hideHeader
          initialStatusFilter={filterStatus as 'all' | 'confirmed' | 'proposed' | undefined}
          focusBatchId={batchId || undefined}
        />
      </div>

      {/* Debug Drawer */}
      {debugInfo && <DiagnosticsDebugDrawer debugInfo={debugInfo} />}

      {/* Add Node Modal */}
      {addNodeZoneId && (
        <AddNodeModal
          isOpen={addNodeModalOpen}
          zoneId={addNodeZoneId}
          existingNodeKeys={existingNodeKeys}
          onClose={() => {
            setAddNodeModalOpen(false);
            setAddNodeZoneId(null);
          }}
          onSubmit={handleManualNodeSubmit}
        />
      )}
    </div>
  );
}

