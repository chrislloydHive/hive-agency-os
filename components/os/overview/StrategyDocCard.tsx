'use client';

// components/os/overview/StrategyDocCard.tsx
// Strategy Document Card for Company Overview
//
// DUAL BACKEND SUPPORT:
// - When ARTIFACTS_ENABLED + ARTIFACTS_GOOGLE_ENABLED: use Artifacts system (preferred)
// - Otherwise: use company-field Strategy Doc system (fallback)
//
// Shows current state of Strategy Document:
// - Not created → "Create Strategy Doc" button
// - Up to date → "Open Doc" link
// - Out of date → show stale indicator + "Update" button

import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  ExternalLink,
  RefreshCw,
  Plus,
  AlertCircle,
  CheckCircle,
  Loader2,
  FileWarning,
} from 'lucide-react';
import type { StrategyDocStatusResponse } from '@/app/api/os/companies/[companyId]/documents/strategy/status/route';
import type { Artifact } from '@/lib/types/artifact';

// ============================================================================
// Types
// ============================================================================

interface StrategyDocCardProps {
  companyId: string;
  /** Strategy ID for artifacts mode (required for create) */
  strategyId?: string;
}

type DocStatus = 'not_created' | 'up_to_date' | 'out_of_date';

interface UnifiedDocState {
  status: DocStatus;
  docUrl: string | null;
  isStale: boolean;
  stalenessCount: number;
  lastSyncedAt: string | null;
  contextReady: boolean;
  confirmedFieldCount: number;
  minRequiredFields: number;
  /** True if using artifacts backend */
  usingArtifacts: boolean;
  /** Artifact record if using artifacts backend */
  artifact?: Artifact;
}

// ============================================================================
// Component
// ============================================================================

export function StrategyDocCard({ companyId, strategyId }: StrategyDocCardProps) {
  const [state, setState] = useState<UnifiedDocState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Fetch status - tries artifacts first, falls back to company-field approach
  const fetchStatus = useCallback(async () => {
    try {
      // First, try to fetch artifacts (will 403 if disabled)
      const artifactsResponse = await fetch(
        `/api/os/companies/${companyId}/artifacts?type=strategy_doc`
      );

      if (artifactsResponse.ok) {
        const artifactsData = await artifactsResponse.json();
        const artifacts: Artifact[] = artifactsData.artifacts || [];

        // Find active strategy_doc artifact (prefer published, else draft; ignore archived)
        const activeArtifact = findActiveStrategyDoc(artifacts);

        if (activeArtifact) {
          // Artifact exists - derive status from it
          setState({
            status: activeArtifact.isStale ? 'out_of_date' : 'up_to_date',
            docUrl: activeArtifact.googleFileUrl,
            isStale: activeArtifact.isStale,
            stalenessCount: activeArtifact.isStale ? 1 : 0, // Artifacts use boolean flag
            lastSyncedAt: activeArtifact.updatedAt,
            contextReady: true, // If artifact exists, context was ready
            confirmedFieldCount: 3,
            minRequiredFields: 3,
            usingArtifacts: true,
            artifact: activeArtifact,
          });
          setError(null);
          return;
        }

        // No active artifact - check if we can create one
        // Fetch context readiness from fallback status endpoint
        const fallbackResponse = await fetch(
          `/api/os/companies/${companyId}/documents/strategy/status`
        );
        const fallbackData: StrategyDocStatusResponse = await fallbackResponse.json();

        setState({
          status: 'not_created',
          docUrl: null,
          isStale: false,
          stalenessCount: 0,
          lastSyncedAt: null,
          contextReady: fallbackData.contextReady,
          confirmedFieldCount: fallbackData.confirmedFieldCount,
          minRequiredFields: fallbackData.minRequiredFields,
          usingArtifacts: true,
        });
        setError(null);
        return;
      }

      // Artifacts not available (403 or error) - use fallback
      const fallbackResponse = await fetch(
        `/api/os/companies/${companyId}/documents/strategy/status`
      );
      const fallbackData: StrategyDocStatusResponse = await fallbackResponse.json();

      setState({
        status: fallbackData.status,
        docUrl: fallbackData.docUrl,
        isStale: fallbackData.status === 'out_of_date',
        stalenessCount: fallbackData.stalenessCount,
        lastSyncedAt: fallbackData.lastSyncedAt,
        contextReady: fallbackData.contextReady,
        confirmedFieldCount: fallbackData.confirmedFieldCount,
        minRequiredFields: fallbackData.minRequiredFields,
        usingArtifacts: false,
      });
      setError(null);
    } catch (err) {
      console.error('[StrategyDocCard] Error fetching status:', err);
      setError('Failed to load status');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Create Strategy Doc
  const handleCreate = useCallback(async () => {
    setCreating(true);
    setError(null);
    try {
      if (state?.usingArtifacts) {
        // Use artifacts API - requires strategyId
        if (!strategyId) {
          throw new Error('Strategy ID required to create artifact');
        }

        const response = await fetch(
          `/api/os/companies/${companyId}/artifacts/create-strategy-doc`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ strategyId }),
          }
        );
        const data = await response.json();

        if (!response.ok || data.error) {
          throw new Error(data.error || 'Failed to create Strategy Document');
        }
      } else {
        // Use fallback company-field API
        const response = await fetch(
          `/api/os/companies/${companyId}/documents/strategy/create`,
          { method: 'POST' }
        );
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to create Strategy Document');
        }
      }

      // Refresh status
      await fetchStatus();
    } catch (err) {
      console.error('[StrategyDocCard] Error creating doc:', err);
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setCreating(false);
    }
  }, [companyId, strategyId, state?.usingArtifacts, fetchStatus]);

  // Insert updates / refresh
  const handleUpdate = useCallback(async () => {
    setUpdating(true);
    setError(null);
    try {
      // Always use the fallback update endpoint for inserting updates
      // (Artifacts system doesn't have a dedicated update endpoint yet)
      const response = await fetch(
        `/api/os/companies/${companyId}/documents/strategy/update`,
        { method: 'POST' }
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update Strategy Document');
      }

      // If using artifacts and we have an artifact, also mark it fresh
      if (state?.usingArtifacts && state.artifact) {
        await fetch(
          `/api/os/companies/${companyId}/artifacts/${state.artifact.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isStale: false, stalenessReason: null }),
          }
        ).catch(() => {
          // Ignore errors marking artifact fresh - the update still succeeded
        });
      }

      // Refresh status
      await fetchStatus();
    } catch (err) {
      console.error('[StrategyDocCard] Error updating doc:', err);
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setUpdating(false);
    }
  }, [companyId, state, fetchStatus]);

  // Loading state
  if (loading) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-800 rounded-lg">
            <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-300">Strategy Document</p>
            <p className="text-xs text-slate-500">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  // No state loaded
  if (!state) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-800 rounded-lg">
            <FileText className="w-4 h-4 text-slate-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-300">Strategy Document</p>
            <p className="text-xs text-slate-500">Feature not available</p>
          </div>
        </div>
      </div>
    );
  }

  // Render based on status
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${getIconStyle(state.status)}`}>
            {getIcon(state.status)}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-300">Strategy Document</p>
            <p className="text-xs text-slate-500">{getSubtitle(state)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Error display */}
          {error && (
            <span className="text-xs text-red-400 mr-2">{error}</span>
          )}

          {/* Action buttons based on status */}
          {state.status === 'not_created' && (
            <button
              onClick={handleCreate}
              disabled={creating || !state.contextReady || (state.usingArtifacts && !strategyId)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded-lg hover:bg-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title={
                !state.contextReady
                  ? `Need ${state.minRequiredFields - state.confirmedFieldCount} more confirmed fields`
                  : state.usingArtifacts && !strategyId
                  ? 'Strategy required to create document'
                  : 'Create Strategy Document'
              }
            >
              {creating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              Create
            </button>
          )}

          {state.status === 'up_to_date' && state.docUrl && (
            <a
              href={state.docUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/20 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open
            </a>
          )}

          {state.status === 'out_of_date' && (
            <div className="flex items-center gap-2">
              {state.docUrl && (
                <a
                  href={state.docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-700/50 text-slate-300 border border-slate-600/30 rounded-lg hover:bg-slate-700 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open
                </a>
              )}
              <button
                onClick={handleUpdate}
                disabled={updating}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
              >
                {updating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Update{state.stalenessCount > 0 ? ` (${state.stalenessCount})` : ''}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Context readiness warning */}
      {state.status === 'not_created' && !state.contextReady && (
        <div className="mt-3 flex items-start gap-2 text-xs text-amber-400/80">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            Need {state.minRequiredFields - state.confirmedFieldCount} more confirmed
            Context V4 fields before creating.
          </span>
        </div>
      )}

      {/* Strategy ID warning for artifacts mode */}
      {state.status === 'not_created' && state.contextReady && state.usingArtifacts && !strategyId && (
        <div className="mt-3 flex items-start gap-2 text-xs text-amber-400/80">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            Create a strategy first to generate this document.
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Find the active strategy_doc artifact (prefer published, then draft, ignore archived)
 */
function findActiveStrategyDoc(artifacts: Artifact[]): Artifact | null {
  const strategyDocs = artifacts.filter(a => a.type === 'strategy_doc' && a.status !== 'archived');

  // Prefer published
  const published = strategyDocs.find(a => a.status === 'published');
  if (published) return published;

  // Fall back to draft
  const draft = strategyDocs.find(a => a.status === 'draft');
  if (draft) return draft;

  return null;
}

function getIcon(status: DocStatus) {
  switch (status) {
    case 'up_to_date':
      return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    case 'out_of_date':
      return <FileWarning className="w-4 h-4 text-amber-400" />;
    default:
      return <FileText className="w-4 h-4 text-slate-400" />;
  }
}

function getIconStyle(status: DocStatus) {
  switch (status) {
    case 'up_to_date':
      return 'bg-emerald-500/10';
    case 'out_of_date':
      return 'bg-amber-500/10';
    default:
      return 'bg-slate-800';
  }
}

function getSubtitle(state: UnifiedDocState) {
  switch (state.status) {
    case 'not_created':
      return state.contextReady
        ? 'Ready to create'
        : `${state.confirmedFieldCount}/${state.minRequiredFields} fields confirmed`;
    case 'up_to_date':
      return state.lastSyncedAt
        ? `Synced ${formatRelativeTime(state.lastSyncedAt)}`
        : 'Up to date';
    case 'out_of_date':
      if (state.usingArtifacts) {
        return 'Updates available';
      }
      return `${state.stalenessCount} update${state.stalenessCount === 1 ? '' : 's'} pending`;
    default:
      return 'Unknown status';
  }
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

export default StrategyDocCard;
