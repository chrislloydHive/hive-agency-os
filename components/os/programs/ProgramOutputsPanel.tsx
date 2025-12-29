'use client';

// components/os/programs/ProgramOutputsPanel.tsx
// Shows linked artifacts (outputs) for a committed program
//
// Displays:
// - List of linked artifacts grouped by type
// - "Link artifact" button to attach existing artifacts
// - "Sync to work" button to propagate artifacts to work items
// - Quick status indicators for each artifact

import React, { useState, useCallback } from 'react';
import useSWR from 'swr';
import {
  FileText,
  Loader2,
  AlertCircle,
  Package,
  Link as LinkIcon,
  ExternalLink,
  Plus,
  CheckCircle2,
  Edit3,
  Archive,
  RefreshCw,
  Paperclip,
} from 'lucide-react';
import type { ProgramArtifactLink } from '@/lib/types/program';
import { mapProgramLinkToCanonical } from '@/lib/types/program';

// ============================================================================
// Types
// ============================================================================

interface ArtifactsByType {
  outputs: ProgramArtifactLink[];
  inputs: ProgramArtifactLink[];
  references: ProgramArtifactLink[];
}

interface GetArtifactsResponse {
  success: boolean;
  programId: string;
  artifacts: ProgramArtifactLink[];
  byType: ArtifactsByType;
  total: number;
  error?: string;
}

interface PropagateResponse {
  success: boolean;
  programId: string;
  attempted: number;
  attached: number;
  updated: number;
  unchanged: number;
  errors: Array<{ artifactId: string; error: string }>;
  error?: string;
}

interface WorkItemSummary {
  id: string;
  title: string;
  status: string | undefined;
}

interface ExecutionStatusData {
  success: boolean;
  workItems: WorkItemSummary[];
}

interface ProgramOutputsPanelProps {
  programId: string;
  companyId: string;
  onLinkArtifact?: () => void;
}

// ============================================================================
// Fetcher
// ============================================================================

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// ============================================================================
// Status Icon Helper
// ============================================================================

function ArtifactStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'final':
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    case 'draft':
      return <Edit3 className="w-3.5 h-3.5 text-amber-400" />;
    case 'archived':
      return <Archive className="w-3.5 h-3.5 text-slate-500" />;
    default:
      return <FileText className="w-3.5 h-3.5 text-slate-400" />;
  }
}

// ============================================================================
// Artifact Type Badge
// ============================================================================

function ArtifactTypeBadge({ type }: { type: string }) {
  const displayType = type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded">
      {displayType}
    </span>
  );
}

// ============================================================================
// Component
// ============================================================================

export function ProgramOutputsPanel({
  programId,
  companyId,
  onLinkArtifact,
}: ProgramOutputsPanelProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<PropagateResponse | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [attachingArtifactId, setAttachingArtifactId] = useState<string | null>(null);
  const [showWorkSelector, setShowWorkSelector] = useState<string | null>(null);

  const { data, error, isLoading } = useSWR<GetArtifactsResponse>(
    `/api/os/programs/${programId}/artifacts`,
    fetcher,
    { refreshInterval: 30000 }
  );

  // Fetch work items for this program
  const { data: workData } = useSWR<ExecutionStatusData>(
    `/api/os/programs/${programId}/work`,
    fetcher
  );

  // Handle sync artifacts to work items
  const handleSyncToWork = useCallback(async () => {
    setIsSyncing(true);
    setSyncError(null);
    setSyncResult(null);

    try {
      const response = await fetch(`/api/os/programs/${programId}/artifacts/propagate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const result: PropagateResponse = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to sync artifacts');
      }

      setSyncResult(result);

      // Clear result after 3 seconds
      setTimeout(() => setSyncResult(null), 3000);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed');
      setTimeout(() => setSyncError(null), 5000);
    } finally {
      setIsSyncing(false);
    }
  }, [programId]);

  // Handle attaching an artifact to a specific work item
  const handleAttachToWork = useCallback(async (
    artifact: ProgramArtifactLink,
    workItemId: string
  ) => {
    setAttachingArtifactId(artifact.artifactId);
    setShowWorkSelector(null);

    try {
      const canonicalRelation = mapProgramLinkToCanonical(artifact.linkType);

      const response = await fetch(
        `/api/os/companies/${companyId}/work-items/${workItemId}/artifacts/attach`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            artifactId: artifact.artifactId,
            artifactType: artifact.artifactType,
            artifactTitle: artifact.artifactTitle,
            artifactStatus: artifact.artifactStatus,
            relation: canonicalRelation,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to attach artifact');
      }

      // Show success briefly
      setSyncResult({
        success: true,
        programId,
        attempted: 1,
        attached: 1,
        updated: 0,
        unchanged: 0,
        errors: [],
      });
      setTimeout(() => setSyncResult(null), 3000);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Failed to attach');
      setTimeout(() => setSyncError(null), 5000);
    } finally {
      setAttachingArtifactId(null);
    }
  }, [companyId, programId]);

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-4">
        <div className="flex items-center gap-2 text-purple-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading outputs...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data?.success) {
    return (
      <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">Failed to load outputs</span>
        </div>
      </div>
    );
  }

  const { byType, total } = data;
  const hasOutputs = byType.outputs.length > 0;
  const hasInputs = byType.inputs.length > 0;
  const hasReferences = byType.references.length > 0;

  return (
    <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-purple-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-purple-400" />
            <h4 className="text-sm font-medium text-white">
              Outputs {total > 0 && <span className="text-slate-400">({total})</span>}
            </h4>
          </div>
          <div className="flex items-center gap-2">
            {/* Sync to work button */}
            {total > 0 && (
              <button
                onClick={handleSyncToWork}
                disabled={isSyncing}
                className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50"
                title="Sync linked artifacts to work items"
              >
                {isSyncing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                Sync to work
              </button>
            )}
            {onLinkArtifact && (
              <button
                onClick={onLinkArtifact}
                className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Link artifact
              </button>
            )}
          </div>
        </div>

        {/* Sync result feedback */}
        {syncResult && (
          <div className="mt-2 px-2 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-xs text-emerald-400">
            <CheckCircle2 className="w-3 h-3 inline mr-1" />
            Synced {syncResult.attached} attached, {syncResult.updated} updated, {syncResult.unchanged} unchanged
          </div>
        )}

        {/* Sync error feedback */}
        {syncError && (
          <div className="mt-2 px-2 py-1.5 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
            <AlertCircle className="w-3 h-3 inline mr-1" />
            {syncError}
          </div>
        )}
      </div>

      {/* Empty state */}
      {total === 0 && (
        <div className="px-4 py-6 text-center">
          <LinkIcon className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400 mb-3">No artifacts linked yet</p>
          {onLinkArtifact && (
            <button
              onClick={onLinkArtifact}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-500/10 text-purple-400 rounded hover:bg-purple-500/20 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Link your first artifact
            </button>
          )}
        </div>
      )}

      {/* Outputs section */}
      {hasOutputs && (
        <div className="px-4 py-2 border-b border-purple-500/10">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">
            Outputs
          </p>
          <ul className="space-y-1">
            {byType.outputs.map((artifact) => (
              <ArtifactRow
                key={artifact.artifactId}
                artifact={artifact}
                companyId={companyId}
                workItems={workData?.workItems || []}
                showWorkSelector={showWorkSelector === artifact.artifactId}
                onToggleWorkSelector={() =>
                  setShowWorkSelector(
                    showWorkSelector === artifact.artifactId ? null : artifact.artifactId
                  )
                }
                onAttachToWork={(workItemId) => handleAttachToWork(artifact, workItemId)}
                isAttaching={attachingArtifactId === artifact.artifactId}
              />
            ))}
          </ul>
        </div>
      )}

      {/* Inputs section */}
      {hasInputs && (
        <div className="px-4 py-2 border-b border-purple-500/10">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">
            Inputs
          </p>
          <ul className="space-y-1">
            {byType.inputs.map((artifact) => (
              <ArtifactRow
                key={artifact.artifactId}
                artifact={artifact}
                companyId={companyId}
                workItems={workData?.workItems || []}
                showWorkSelector={showWorkSelector === artifact.artifactId}
                onToggleWorkSelector={() =>
                  setShowWorkSelector(
                    showWorkSelector === artifact.artifactId ? null : artifact.artifactId
                  )
                }
                onAttachToWork={(workItemId) => handleAttachToWork(artifact, workItemId)}
                isAttaching={attachingArtifactId === artifact.artifactId}
              />
            ))}
          </ul>
        </div>
      )}

      {/* References section */}
      {hasReferences && (
        <div className="px-4 py-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">
            References
          </p>
          <ul className="space-y-1">
            {byType.references.map((artifact) => (
              <ArtifactRow
                key={artifact.artifactId}
                artifact={artifact}
                companyId={companyId}
                workItems={workData?.workItems || []}
                showWorkSelector={showWorkSelector === artifact.artifactId}
                onToggleWorkSelector={() =>
                  setShowWorkSelector(
                    showWorkSelector === artifact.artifactId ? null : artifact.artifactId
                  )
                }
                onAttachToWork={(workItemId) => handleAttachToWork(artifact, workItemId)}
                isAttaching={attachingArtifactId === artifact.artifactId}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Artifact Row Component
// ============================================================================

function ArtifactRow({
  artifact,
  companyId,
  workItems,
  showWorkSelector,
  onToggleWorkSelector,
  onAttachToWork,
  isAttaching,
}: {
  artifact: ProgramArtifactLink;
  companyId: string;
  workItems: WorkItemSummary[];
  showWorkSelector: boolean;
  onToggleWorkSelector: () => void;
  onAttachToWork: (workItemId: string) => void;
  isAttaching: boolean;
}) {
  const artifactUrl = `/c/${companyId}/artifacts/${artifact.artifactId}`;
  const hasWorkItems = workItems.length > 0;

  return (
    <li className="py-1.5 group">
      <div className="flex items-center gap-2">
        <ArtifactStatusIcon status={artifact.artifactStatus} />
        <span className="text-sm text-slate-300 truncate flex-1">
          {artifact.artifactTitle}
        </span>
        <ArtifactTypeBadge type={artifact.artifactType} />

        {/* Attach to work button */}
        {hasWorkItems && (
          <button
            onClick={onToggleWorkSelector}
            disabled={isAttaching}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-cyan-400 disabled:opacity-50"
            title="Attach to work item"
          >
            {isAttaching ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Paperclip className="w-3 h-3" />
            )}
          </button>
        )}

        <a
          href={artifactUrl}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-slate-300"
          title="View artifact"
        >
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Work item selector dropdown */}
      {showWorkSelector && hasWorkItems && (
        <div className="mt-2 ml-6 p-2 bg-slate-800/80 border border-slate-700 rounded-lg">
          <p className="text-[10px] text-slate-400 mb-1.5">Attach to work item:</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {workItems.map((work) => (
              <button
                key={work.id}
                onClick={() => onAttachToWork(work.id)}
                className="w-full text-left px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 rounded transition-colors truncate"
              >
                {work.title}
                {work.status && (
                  <span className="ml-1 text-[10px] text-slate-500">
                    ({work.status})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </li>
  );
}
