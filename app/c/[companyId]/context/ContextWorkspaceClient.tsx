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
// - ?view=map|table|fields|review - Switch to specific view
// - ?focusKey=identity.businessModel - Focus on specific node
// - ?zone=identity - Focus on specific zone
// - ?filterStatus=proposed - Switch to Table view filtered to proposals

import { useCallback, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Map, FileText, Loader2, Play, Trash2, ListChecks, Database, RefreshCw, ClipboardCheck, PlusCircle, Search, AlertCircle } from 'lucide-react';
import type { CompanyContext } from '@/lib/types/context';
import type { DraftableState } from '@/lib/os/draft/types';
import type { DiagnosticsDebugInfo } from '@/lib/os/diagnostics/debugInfo';
import type { HydratedContextNode } from '@/lib/contextGraph/nodes/hydration';
import type { BaselineSignals } from '@/lib/os/context';
import { useDraftableResource } from '@/hooks/useDraftableResource';
import { DiagnosticsDebugDrawer, CanonicalFieldsPanel } from '@/components/context';
import { ContextMapClient, AddNodeModal } from '@/components/context-map';
import { useCanonicalFields } from '@/hooks/useCanonicalFields';
import type { ZoneId } from '@/components/context-map/types';
import { useProposals } from '@/hooks/useProposals';
import { ReviewQueueClient } from '@/components/context-v4/ReviewQueueClient';

// ============================================================================
// Types
// ============================================================================

type ViewMode = 'map' | 'table' | 'fields' | 'review';

const VALID_VIEW_MODES: ViewMode[] = ['map', 'table', 'fields', 'review'];

interface ContextWorkspaceClientProps {
  companyId: string;
  companyName: string;
  initialState: DraftableState<CompanyContext>;
  debugInfo?: DiagnosticsDebugInfo;
  hydratedNodes?: HydratedContextNode[];
  baselineSignals?: BaselineSignals;
  /** V4 feature enabled (passed from server to avoid client-side env issues) */
  v4Enabled?: boolean;
}

// ============================================================================
// View Mode Toggle Component (shared across all views)
// ============================================================================

interface ViewModeToggleProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  v4Enabled: boolean;
  v4ProposalCount: number;
}

// ============================================================================
// Empty State Banner Component
// ============================================================================

interface EmptyStateBannerProps {
  companyId: string;
  onAddKeyFacts: () => void;
  hasExistingData?: boolean;
  existingDataSummary?: string;
}

function EmptyStateBanner({ companyId, onAddKeyFacts, hasExistingData, existingDataSummary }: EmptyStateBannerProps) {
  return (
    <div className="bg-gradient-to-r from-purple-500/5 to-indigo-500/5 border border-purple-500/20 rounded-xl p-5 mb-4">
      <div className="flex items-start gap-4">
        <div className="p-2.5 bg-purple-500/10 rounded-lg text-purple-400 shrink-0">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-white mb-1">
            No context yet
          </h3>
          <p className="text-sm text-slate-400 mb-4">
            Add what you know about this company, or run labs to extract context automatically.
            {hasExistingData && existingDataSummary && (
              <span className="block mt-1 text-xs text-slate-500">
                Existing data available: {existingDataSummary}
              </span>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onAddKeyFacts}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Add key facts
            </button>
            <Link
              href={`/c/${companyId}/diagnostics`}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-slate-700/50 text-slate-300 border border-slate-600/50 rounded-lg hover:bg-slate-700 transition-colors"
            >
              <Search className="w-4 h-4" />
              Run diagnostics
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// View Mode Toggle Component (shared across all views)
// ============================================================================

function ViewModeToggle({ currentView, onViewChange, v4Enabled, v4ProposalCount }: ViewModeToggleProps) {
  const views: Array<{ id: ViewMode; label: string; icon: React.ReactNode; requiresV4?: boolean }> = [
    { id: 'map', label: 'Map', icon: <Map className="w-3.5 h-3.5" /> },
    { id: 'table', label: 'Table', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'fields', label: 'Fields', icon: <ListChecks className="w-3.5 h-3.5" /> },
    { id: 'review', label: 'Review', icon: <ClipboardCheck className="w-3.5 h-3.5" />, requiresV4: true },
  ];

  return (
    <div className="flex items-center gap-1 p-0.5 bg-slate-800 rounded-lg">
      {views.map((view) => {
        // Skip V4-only views if V4 is not enabled
        if (view.requiresV4 && !v4Enabled) return null;

        const isActive = currentView === view.id;
        return (
          <button
            key={view.id}
            onClick={() => onViewChange(view.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              isActive
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            {view.icon}
            {view.label}
            {view.id === 'review' && v4ProposalCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded-full">
                {v4ProposalCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
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
  baselineSignals,
  v4Enabled = false,
}: ContextWorkspaceClientProps) {
  // Deep link URL parameters
  const searchParams = useSearchParams();
  const router = useRouter();
  const focusKey = searchParams.get('focusKey');
  const focusKeysParam = searchParams.get('focusKeys'); // Comma-separated list for Fix button
  const focusZone = searchParams.get('zone');
  const filterStatus = searchParams.get('filterStatus'); // 'proposed' | 'confirmed' | null
  const batchId = searchParams.get('batch'); // Deep link to a specific proposal batch
  const viewParam = searchParams.get('view'); // Deep link to specific view: 'review' | 'map' | 'table' | 'fields'

  // Parse focusKeys into an array (for Fix button navigation)
  const focusKeys = focusKeysParam ? focusKeysParam.split(',') : focusKey ? [focusKey] : [];

  // Coerce view param to valid ViewMode
  const coerceViewMode = useCallback((param: string | null): ViewMode => {
    if (param === 'review' && v4Enabled) return 'review';
    if (param && VALID_VIEW_MODES.includes(param as ViewMode) && param !== 'review') {
      return param as ViewMode;
    }
    // Default logic
    if (filterStatus === 'proposed' || focusKeys.length > 1) return 'table';
    return 'map';
  }, [v4Enabled, filterStatus, focusKeys.length]);

  // View mode state - synced with URL
  const [viewMode, setViewMode] = useState<ViewMode>(() => coerceViewMode(viewParam));

  // Sync state with URL params (for browser back/forward navigation)
  useEffect(() => {
    const newViewMode = coerceViewMode(viewParam);
    if (newViewMode !== viewMode) {
      setViewMode(newViewMode);
    }
  }, [viewParam, coerceViewMode, viewMode]);

  // Handle view mode change - updates both state and URL
  const handleViewModeChange = useCallback((newView: ViewMode) => {
    // Build new URL preserving existing params
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', newView);
    router.push(`?${params.toString()}`, { scroll: false });
    // State will update via the useEffect above when searchParams change
    setViewMode(newView);
  }, [searchParams, router]);

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

  // Canonical Fields (Strategy Frame fields)
  const {
    fields: canonicalFields,
    isLoading: isLoadingCanonicalFields,
    refresh: refreshCanonicalFields,
  } = useCanonicalFields(companyId);

  // Note: Form view has been deprecated - Context editing now happens through ContextMapClient

  // Node state - allows updating nodes after edits
  // Ensure we always have an array even if hydratedNodes is undefined
  // IMPORTANT: This must be defined before any early returns to maintain hook order
  const [nodes, setNodes] = useState<HydratedContextNode[]>(hydratedNodes || []);

  // AI suggestion state
  const [aiSuggestionLoading, setAiSuggestionLoading] = useState<string | null>(null);
  const [aiSuggestionError, setAiSuggestionError] = useState<string | null>(null);

  // Dev-only hard cleanup state
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  // Manual add node modal state
  const [addNodeModalOpen, setAddNodeModalOpen] = useState(false);
  const [addNodeZoneId, setAddNodeZoneId] = useState<ZoneId | null>(null);
  const [preSelectedFieldKey, setPreSelectedFieldKey] = useState<string | null>(null);

  // V4 Review Queue proposal count (for badge)
  const [v4ProposalCount, setV4ProposalCount] = useState<number>(0);

  // Fetch V4 proposal count for badge (only if V4 is enabled)
  useEffect(() => {
    if (!v4Enabled) return;

    const fetchV4Count = async () => {
      try {
        const response = await fetch(`/api/os/companies/${companyId}/context/v4/review`, {
          cache: 'no-store',
        });
        const data = await response.json();
        if (data.ok && typeof data.totalCount === 'number') {
          setV4ProposalCount(data.totalCount);
        }
      } catch (err) {
        console.error('[ContextWorkspace] Failed to fetch V4 proposal count:', err);
      }
    };

    fetchV4Count();
  }, [companyId, v4Enabled]);

  // ============================================================================
  // Context Map Handlers (all useCallback hooks must be before early returns)
  // ============================================================================

  // Get existing node keys for the modal (to filter out already-populated fields)
  const existingNodeKeys = new Set(nodes.filter(n => n.value !== null && n.value !== undefined).map(n => n.key));

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

        // Add new nodes or update existing ones with proposals
        setNodes((prevNodes) => {
          const existingKeys = new Set(prevNodes.map((n) => n.key));
          const newNodeKeys = new Set(newNodes.map((n) => n.key));

          // Update existing nodes that have new proposals
          const updatedPrevNodes = prevNodes.map((existingNode) => {
            const newProposal = newNodes.find((n) => n.key === existingNode.key);
            if (newProposal) {
              // Update existing node with the proposal
              return {
                ...existingNode,
                value: newProposal.value,
                status: 'proposed' as const,
                source: 'ai' as const,
                confidence: newProposal.confidence,
                lastUpdated: newProposal.lastUpdated,
                pendingProposal: newProposal.pendingProposal,
                proposalBatchId: newProposal.proposalBatchId,
              };
            }
            return existingNode;
          });

          // Add truly new nodes (keys that didn't exist before)
          const uniqueNewNodes = newNodes.filter((n) => !existingKeys.has(n.key));

          console.log(`[AI Suggest] Prev nodes: ${prevNodes.length}, Updated: ${newNodeKeys.size - uniqueNewNodes.length}, New: ${uniqueNewNodes.length}`);
          console.log('[AI Suggest] New/updated nodes:', newNodes.map(n => n.key));

          return [...updatedPrevNodes, ...uniqueNewNodes];
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
  const handleMapAddNode = useCallback((zoneId: string, mode: 'ai' | 'manual', fieldKey?: string) => {
    if (mode === 'ai') {
      // Trigger AI suggestion for this zone
      handleMapSuggestWithAI(zoneId);
    } else {
      // Open manual add modal, optionally with a pre-selected field
      setAddNodeZoneId(zoneId as ZoneId);
      setPreSelectedFieldKey(fieldKey || null);
      setAddNodeModalOpen(true);
    }
  }, [handleMapSuggestWithAI]);

  /**
   * Handle manual node creation submission
   * Creates a proposed node with source=user
   */
  const handleManualNodeSubmit = useCallback(async (fieldKey: string, value: unknown) => {
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
  // Render: No Context Graph - Check if existing data available
  // ============================================================================

  // Determine if we have existing data that could be used to build context
  const hasExistingData = baselineSignals && (
    baselineSignals.hasLabRuns ||
    baselineSignals.hasFullGap ||
    baselineSignals.hasCompetition ||
    baselineSignals.hasWebsiteMetadata
  );

  // Build a summary of what data is available
  const existingDataSummary = baselineSignals?.signalSources?.join(', ') || '';

  // V11+: Context is ALWAYS viewable/editable. No blocking early returns.
  // Instead, show an informational empty state banner ABOVE the context graph.
  const showEmptyBanner = nodes.length === 0 && !isGenerating;

  // Handler to open the quick add modal for "Add key facts" CTA
  const handleQuickAddKeyFacts = useCallback(() => {
    // Open the add node modal with identity zone (most common starting point)
    setAddNodeZoneId('identity' as ZoneId);
    setPreSelectedFieldKey(null);
    setAddNodeModalOpen(true);
  }, []);

  // ============================================================================
  // Render: Fields View (Canonical Context Fields)
  // ============================================================================

  if (viewMode === 'fields') {
    return (
      <div className="space-y-4">
        {/* Empty State Banner (shown when no context exists) */}
        {showEmptyBanner && (
          <EmptyStateBanner
            companyId={companyId}
            onAddKeyFacts={handleQuickAddKeyFacts}
            hasExistingData={hasExistingData}
            existingDataSummary={existingDataSummary}
          />
        )}

        {/* Header with View Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-cyan-400" />
              Context Fields
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Canonical fields for {companyName} (Strategy Frame)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleQuickAddKeyFacts}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors bg-purple-500/20 text-purple-300 hover:bg-purple-500/30"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Add key facts
            </button>
            <ViewModeToggle
              currentView={viewMode}
              onViewChange={handleViewModeChange}
              v4Enabled={v4Enabled}
              v4ProposalCount={v4ProposalCount}
            />
          </div>
        </div>

        {/* Canonical Fields Panel */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          {isLoadingCanonicalFields ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
              <span className="ml-3 text-slate-400">Loading fields...</span>
            </div>
          ) : (
            <CanonicalFieldsPanel
              companyId={companyId}
              records={canonicalFields}
              onRefresh={refreshCanonicalFields}
            />
          )}
        </div>

        {/* Add Node Modal */}
        {addNodeZoneId && (
          <AddNodeModal
            isOpen={addNodeModalOpen}
            zoneId={addNodeZoneId}
            existingNodeKeys={existingNodeKeys}
            preSelectedFieldKey={preSelectedFieldKey}
            onClose={() => {
              setAddNodeModalOpen(false);
              setAddNodeZoneId(null);
              setPreSelectedFieldKey(null);
            }}
            onSubmit={handleManualNodeSubmit}
          />
        )}
      </div>
    );
  }

  // ============================================================================
  // Render: Review View (V4 Review Queue)
  // ============================================================================

  if (viewMode === 'review') {
    return (
      <div className="space-y-4">
        {/* Empty State Banner (shown when no context exists) */}
        {showEmptyBanner && (
          <EmptyStateBanner
            companyId={companyId}
            onAddKeyFacts={handleQuickAddKeyFacts}
            hasExistingData={hasExistingData}
            existingDataSummary={existingDataSummary}
          />
        )}

        {/* Header with View Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-amber-400" />
              Review Queue
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Review proposed context for {companyName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleQuickAddKeyFacts}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors bg-purple-500/20 text-purple-300 hover:bg-purple-500/30"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Add key facts
            </button>
            <ViewModeToggle
              currentView={viewMode}
              onViewChange={handleViewModeChange}
              v4Enabled={v4Enabled}
              v4ProposalCount={v4ProposalCount}
            />
          </div>
        </div>

        {/* Review Queue Client */}
        <ReviewQueueClient
          companyId={companyId}
          companyName={companyName}
        />

        {/* Add Node Modal */}
        {addNodeZoneId && (
          <AddNodeModal
            isOpen={addNodeModalOpen}
            zoneId={addNodeZoneId}
            existingNodeKeys={existingNodeKeys}
            preSelectedFieldKey={preSelectedFieldKey}
            onClose={() => {
              setAddNodeModalOpen(false);
              setAddNodeZoneId(null);
              setPreSelectedFieldKey(null);
            }}
            onSubmit={handleManualNodeSubmit}
          />
        )}
      </div>
    );
  }

  // ============================================================================
  // Render: Map View
  // ============================================================================

  if (viewMode === 'map') {
    return (
      <div className="space-y-4">
        {/* Empty State Banner (shown when no context exists) */}
        {showEmptyBanner && (
          <EmptyStateBanner
            companyId={companyId}
            onAddKeyFacts={handleQuickAddKeyFacts}
            hasExistingData={hasExistingData}
            existingDataSummary={existingDataSummary}
          />
        )}

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
            <button
              onClick={handleQuickAddKeyFacts}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors bg-purple-500/20 text-purple-300 hover:bg-purple-500/30"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Add key facts
            </button>
            <ViewModeToggle
              currentView={viewMode}
              onViewChange={handleViewModeChange}
              v4Enabled={v4Enabled}
              v4ProposalCount={v4ProposalCount}
            />
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
            preSelectedFieldKey={preSelectedFieldKey}
            onClose={() => {
              setAddNodeModalOpen(false);
              setAddNodeZoneId(null);
              setPreSelectedFieldKey(null);
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
      {/* Empty State Banner (shown when no context exists) */}
      {showEmptyBanner && (
        <EmptyStateBanner
          companyId={companyId}
          onAddKeyFacts={handleQuickAddKeyFacts}
          hasExistingData={hasExistingData}
          existingDataSummary={existingDataSummary}
        />
      )}

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
          <button
            onClick={handleQuickAddKeyFacts}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors bg-purple-500/20 text-purple-300 hover:bg-purple-500/30"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Add key facts
          </button>
          <ViewModeToggle
            currentView={viewMode}
            onViewChange={handleViewModeChange}
            v4Enabled={v4Enabled}
            v4ProposalCount={v4ProposalCount}
          />
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
          preSelectedFieldKey={preSelectedFieldKey}
          onClose={() => {
            setAddNodeModalOpen(false);
            setAddNodeZoneId(null);
            setPreSelectedFieldKey(null);
          }}
          onSubmit={handleManualNodeSubmit}
        />
      )}
    </div>
  );
}

