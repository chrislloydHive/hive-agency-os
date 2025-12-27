'use client';

// components/os/work/WorkItemArtifactsSection.tsx
// Displays attached artifacts on a work item with detach action
//
// Features:
// - Shows list of attached artifact snapshots
// - Open artifact link
// - Detach action with confirmation
// - Empty state

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Presentation,
  Table,
  ExternalLink,
  X,
  AlertCircle,
  CheckCircle,
  Loader2,
  Package,
} from 'lucide-react';
import type { WorkItemArtifact } from '@/lib/types/work';
import { getArtifactTypeLabel } from '@/lib/types/artifact';
import { getArtifactViewerHref } from '@/lib/os/artifacts/navigation';

// ============================================================================
// Types
// ============================================================================

interface WorkItemArtifactsSectionProps {
  companyId: string;
  workItemId: string;
  artifacts: WorkItemArtifact[];
  onArtifactsChange?: (artifacts: WorkItemArtifact[]) => void;
  readonly?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function WorkItemArtifactsSection({
  companyId,
  workItemId,
  artifacts,
  onArtifactsChange,
  readonly = false,
}: WorkItemArtifactsSectionProps) {
  const [detaching, setDetaching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDetach = useCallback(async (artifactId: string) => {
    if (detaching) return;

    setDetaching(artifactId);
    setError(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/work-items/${workItemId}/artifacts/detach`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ artifactId }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to detach artifact');
      }

      // Update local state
      if (onArtifactsChange) {
        const updated = artifacts.filter(a => a.artifactId !== artifactId);
        onArtifactsChange(updated);
      }
    } catch (err) {
      console.error('[WorkItemArtifactsSection] Detach error:', err);
      setError(err instanceof Error ? err.message : 'Failed to detach');
    } finally {
      setDetaching(null);
    }
  }, [companyId, workItemId, artifacts, onArtifactsChange, detaching]);

  // Empty state
  if (artifacts.length === 0) {
    return (
      <div className="border-t border-slate-700 pt-4 mt-4">
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-4 h-4 text-slate-500" />
          <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Attached Artifacts
          </h4>
        </div>
        <div className="text-center py-6 bg-slate-800/30 rounded-lg border border-dashed border-slate-700">
          <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500">No artifacts attached.</p>
          <p className="text-xs text-slate-600 mt-1">
            Attach an artifact to provide supporting inputs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-slate-700 pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-slate-500" />
          <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Attached Artifacts ({artifacts.length})
          </h4>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-xs text-red-400">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-2">
        {artifacts.map((artifact) => (
          <ArtifactRow
            key={artifact.artifactId}
            artifact={artifact}
            companyId={companyId}
            isDetaching={detaching === artifact.artifactId}
            onDetach={() => handleDetach(artifact.artifactId)}
            readonly={readonly}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Artifact Row
// ============================================================================

interface ArtifactRowProps {
  artifact: WorkItemArtifact;
  companyId: string;
  isDetaching: boolean;
  onDetach: () => void;
  readonly: boolean;
}

function ArtifactRow({
  artifact,
  companyId,
  isDetaching,
  onDetach,
  readonly,
}: ArtifactRowProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const viewerHref = getArtifactViewerHref(companyId, artifact.artifactId);

  const handleRowClick = () => {
    router.push(viewerHref);
  };

  const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleDetachClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showConfirm) {
      onDetach();
      setShowConfirm(false);
    } else {
      setShowConfirm(true);
    }
  };

  return (
    <div
      onClick={handleRowClick}
      className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:border-slate-600/50 group cursor-pointer transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`p-1.5 rounded ${getTypeIconStyle(artifact.artifactTypeId)}`}>
          {getTypeIcon(artifact.artifactTypeId)}
        </div>
        <div className="min-w-0">
          <span className="text-sm font-medium text-slate-200 hover:text-white truncate block">
            {artifact.artifactTitle}
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-slate-500">
              {getArtifactTypeLabel(artifact.artifactTypeId as any) || artifact.artifactTypeId}
            </span>
            <StatusBadge status={artifact.artifactStatus} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0" onClick={stopPropagation}>
        {!readonly && (
          showConfirm ? (
            <div className="flex items-center gap-1">
              <button
                onClick={handleDetachClick}
                disabled={isDetaching}
                className="px-2 py-1 text-[10px] font-medium bg-red-500/20 text-red-400 border border-red-500/30 rounded hover:bg-red-500/30 transition-colors disabled:opacity-50"
              >
                {isDetaching ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  'Confirm'
                )}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setShowConfirm(false); }}
                className="px-2 py-1 text-[10px] font-medium text-slate-400 hover:text-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={handleDetachClick}
              className="p-1.5 text-slate-500 hover:text-red-400 rounded hover:bg-slate-700/50 transition-colors opacity-0 group-hover:opacity-100"
              title="Detach artifact"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Status Badge
// ============================================================================

function StatusBadge({ status }: { status: WorkItemArtifact['artifactStatus'] }) {
  switch (status) {
    case 'final':
      return (
        <span className="flex items-center gap-0.5 px-1 py-0.5 text-[9px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded">
          <CheckCircle className="w-2.5 h-2.5" />
          Final
        </span>
      );
    case 'draft':
      return (
        <span className="px-1 py-0.5 text-[9px] font-medium bg-slate-500/10 text-slate-400 border border-slate-500/30 rounded">
          Draft
        </span>
      );
    case 'archived':
      return (
        <span className="px-1 py-0.5 text-[9px] font-medium bg-slate-600/10 text-slate-500 border border-slate-600/30 rounded">
          Archived
        </span>
      );
    default:
      return null;
  }
}

// ============================================================================
// Helpers
// ============================================================================

function getTypeIcon(type: string) {
  switch (type) {
    case 'qbr_slides':
    case 'proposal_slides':
      return <Presentation className="w-3.5 h-3.5" />;
    case 'media_plan':
    case 'pricing_sheet':
      return <Table className="w-3.5 h-3.5" />;
    default:
      return <FileText className="w-3.5 h-3.5" />;
  }
}

function getTypeIconStyle(type: string) {
  switch (type) {
    case 'strategy_doc':
    case 'strategy_summary':
      return 'bg-purple-500/10 text-purple-400';
    case 'rfp_response_doc':
      return 'bg-cyan-500/10 text-cyan-400';
    case 'qbr_slides':
    case 'proposal_slides':
      return 'bg-blue-500/10 text-blue-400';
    case 'media_plan':
    case 'pricing_sheet':
    case 'media_brief':
      return 'bg-green-500/10 text-green-400';
    case 'brief_doc':
    case 'creative_brief':
    case 'content_brief':
      return 'bg-amber-500/10 text-amber-400';
    default:
      return 'bg-slate-500/10 text-slate-400';
  }
}

export default WorkItemArtifactsSection;
