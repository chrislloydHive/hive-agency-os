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
} from 'lucide-react';
import type { ProgramArtifactLink } from '@/lib/types/program';

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

  const { data, error, isLoading } = useSWR<GetArtifactsResponse>(
    `/api/os/programs/${programId}/artifacts`,
    fetcher,
    { refreshInterval: 30000 }
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
              <ArtifactRow key={artifact.artifactId} artifact={artifact} companyId={companyId} />
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
              <ArtifactRow key={artifact.artifactId} artifact={artifact} companyId={companyId} />
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
              <ArtifactRow key={artifact.artifactId} artifact={artifact} companyId={companyId} />
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
}: {
  artifact: ProgramArtifactLink;
  companyId: string;
}) {
  // TODO: Link to actual artifact viewer when available
  const artifactUrl = `/c/${companyId}/artifacts/${artifact.artifactId}`;

  return (
    <li className="flex items-center gap-2 py-1.5 group">
      <ArtifactStatusIcon status={artifact.artifactStatus} />
      <span className="text-sm text-slate-300 truncate flex-1">
        {artifact.artifactTitle}
      </span>
      <ArtifactTypeBadge type={artifact.artifactType} />
      <a
        href={artifactUrl}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-slate-300"
        title="View artifact"
      >
        <ExternalLink className="w-3 h-3" />
      </a>
    </li>
  );
}
