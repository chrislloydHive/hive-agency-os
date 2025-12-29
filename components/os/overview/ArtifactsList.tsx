'use client';

// components/os/overview/ArtifactsList.tsx
// Artifacts List for Company Overview
//
// Shows all artifacts for a company when ARTIFACTS_ENABLED.
// Displays:
// - Stale artifacts banner (if any)
// - List of artifacts with type, status, stale badge, and Google link

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Presentation,
  Table,
  ExternalLink,
  AlertTriangle,
  Loader2,
  FileWarning,
  CheckCircle,
  Archive,
  PencilLine,
  Circle,
  Briefcase,
  Star,
  Lightbulb,
  Minus,
} from 'lucide-react';
import type { Artifact, ArtifactType, ArtifactStatus } from '@/lib/types/artifact';
import { getArtifactTypeLabel, getArtifactStatusLabel } from '@/lib/types/artifact';
import { getArtifactViewerHref } from '@/lib/os/artifacts/navigation';
import { deriveExecutionStatus, getExecutionStatusBadge } from '@/lib/os/artifacts/executionStatus';
import type { OutcomeSignal, OutcomeSignalType, ArtifactSignalContext } from '@/lib/types/outcomeSignal';
import { generateArtifactSignals } from '@/lib/os/outcomes/generateSignals';

// ============================================================================
// Types
// ============================================================================

interface ArtifactsListProps {
  companyId: string;
  /** Whether to show the stale banner at the top */
  showStaleBanner?: boolean;
  /** Maximum number of artifacts to show (default: 5) */
  maxItems?: number;
}

// ============================================================================
// Component
// ============================================================================

export function ArtifactsList({
  companyId,
  showStaleBanner = true,
  maxItems = 5,
}: ArtifactsListProps) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [featureEnabled, setFeatureEnabled] = useState(true);

  // Fetch artifacts
  const fetchArtifacts = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/artifacts`
      );

      if (response.status === 403) {
        // Feature disabled
        setFeatureEnabled(false);
        setArtifacts([]);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch artifacts');
      }

      const data = await response.json();
      setArtifacts(data.artifacts || []);
      setFeatureEnabled(true);
      setError(null);
    } catch (err) {
      console.error('[ArtifactsList] Error fetching artifacts:', err);
      setError('Failed to load artifacts');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchArtifacts();
  }, [fetchArtifacts]);

  // Don't render if feature is disabled
  if (!featureEnabled) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
          <span className="text-sm text-slate-400">Loading artifacts...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertTriangle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  // No artifacts
  if (artifacts.length === 0) {
    return null; // Don't show empty list
  }

  // Filter out archived and limit to maxItems
  const activeArtifacts = artifacts
    .filter(a => a.status !== 'archived')
    .slice(0, maxItems);

  const staleArtifacts = activeArtifacts.filter(a => a.isStale);
  const hasStale = staleArtifacts.length > 0;

  return (
    <div className="space-y-3">
      {/* Stale banner */}
      {showStaleBanner && hasStale && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
          <div className="flex items-center gap-2">
            <FileWarning className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-amber-400">
              {staleArtifacts.length} deliverable{staleArtifacts.length === 1 ? '' : 's'} may be out of date
            </span>
          </div>
        </div>
      )}

      {/* Artifacts list */}
      <div className="space-y-2">
        {activeArtifacts.map(artifact => (
          <ArtifactRow key={artifact.id} artifact={artifact} companyId={companyId} />
        ))}
      </div>

      {/* Show more link if there are more */}
      {artifacts.filter(a => a.status !== 'archived').length > maxItems && (
        <div className="text-center">
          <a
            href={`/c/${companyId}/deliver/artifacts`}
            className="text-xs text-slate-500 hover:text-slate-400 transition-colors"
          >
            View all {artifacts.filter(a => a.status !== 'archived').length} artifacts →
          </a>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Artifact Row
// ============================================================================

function ArtifactRow({ artifact, companyId }: { artifact: Artifact; companyId: string }) {
  const router = useRouter();
  const viewerHref = getArtifactViewerHref(companyId, artifact.id);

  const handleRowClick = () => {
    router.push(viewerHref);
  };

  const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // Derive execution status from artifact usage
  const executionStatus = deriveExecutionStatus(artifact.usage, null);
  const executionBadge = getExecutionStatusBadge(executionStatus.state);

  // Generate outcome signals for this artifact
  const outcomeSignals = deriveArtifactOutcomeSignals(artifact);
  const primarySignal = outcomeSignals.length > 0 ? outcomeSignals[0] : null;

  return (
    <div
      onClick={handleRowClick}
      className="bg-slate-900/50 border border-slate-800 hover:border-slate-700 rounded-lg p-3 flex items-center justify-between cursor-pointer transition-colors"
    >
      <div className="flex items-center gap-3">
        {/* Type icon */}
        <div className={`p-1.5 rounded-lg ${getTypeIconStyle(artifact.type)}`}>
          {getTypeIcon(artifact.type)}
        </div>

        {/* Title and type */}
        <div>
          <p className="text-sm font-medium text-slate-300 line-clamp-1">
            {artifact.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-slate-500">
              {getArtifactTypeLabel(artifact.type)}
            </span>
            {/* Status badge */}
            <StatusBadge status={artifact.status} />
            {/* Stale badge */}
            {artifact.isStale && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded">
                Stale
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right side: Outcome badge + Execution status + Actions */}
      <div className="flex items-center gap-3">
        {/* Outcome badge (only if signal exists) */}
        {primarySignal && (
          <OutcomeBadge signal={primarySignal} />
        )}

        {/* Execution status chip */}
        <ExecutionStatusChip state={executionStatus.state} workCount={executionStatus.workItemsCreated} />

        {/* Actions */}
        <div className="flex items-center gap-2" onClick={stopPropagation}>
          {artifact.googleFileUrl && (
            <a
              href={artifact.googleFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-slate-400 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
              title="Open in Google Drive"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Outcome Badge
// ============================================================================

function OutcomeBadge({ signal }: { signal: OutcomeSignal }) {
  const config = getOutcomeBadgeConfig(signal.signalType);

  if (!config) return null;

  return (
    <div className="group relative">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${config.className}`}>
        {config.icon}
        {config.label}
      </span>

      {/* Tooltip */}
      <div className="absolute z-10 hidden group-hover:block bottom-full right-0 mb-1 w-64 p-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl">
        <p className="text-xs text-slate-300 mb-1">{signal.summary}</p>
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <span className={`capitalize ${
            signal.confidence === 'high' ? 'text-emerald-400' :
            signal.confidence === 'medium' ? 'text-amber-400' : 'text-slate-500'
          }`}>
            {signal.confidence} confidence
          </span>
          {signal.evidence && (
            <span>{signal.evidence.length} evidence point{signal.evidence.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function getOutcomeBadgeConfig(signalType: OutcomeSignalType): {
  label: string;
  icon: React.ReactNode;
  className: string;
} | null {
  switch (signalType) {
    case 'high-impact':
      return {
        label: 'High Impact',
        icon: <Star className="w-3 h-3" />,
        className: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      };
    case 'learning':
      return {
        label: 'Learning',
        icon: <Lightbulb className="w-3 h-3" />,
        className: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      };
    case 'low-impact':
      return {
        label: 'Low Impact',
        icon: <Minus className="w-3 h-3" />,
        className: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      };
    case 'abandoned':
      return {
        label: 'Abandoned',
        icon: <Circle className="w-3 h-3" />,
        className: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
      };
    case 'completed':
      // Don't show badge for just completed - execution status already shows this
      return null;
    default:
      return null;
  }
}

/**
 * Derive outcome signals from artifact data
 * This is a client-side derivation for display purposes
 */
function deriveArtifactOutcomeSignals(artifact: Artifact): OutcomeSignal[] {
  // Skip draft artifacts
  if (artifact.status === 'draft') return [];

  const usage = artifact.usage;
  if (!usage) return [];

  // Build context for signal generation
  const daysSinceCreation = Math.floor(
    (Date.now() - new Date(artifact.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Count feedback ratings
  const feedbackRatings = { helpful: 0, neutral: 0, not_helpful: 0 };
  if (artifact.feedback) {
    for (const entry of artifact.feedback) {
      if (entry.rating === 'helpful') feedbackRatings.helpful++;
      else if (entry.rating === 'neutral') feedbackRatings.neutral++;
      else if (entry.rating === 'not_helpful') feedbackRatings.not_helpful++;
    }
  }

  const context: ArtifactSignalContext = {
    artifactId: artifact.id,
    artifactType: artifact.type,
    artifactTitle: artifact.title,
    artifactStatus: artifact.status,
    workItemsCreated: usage.attachedWorkCount,
    workItemsCompleted: usage.completedWorkCount,
    daysSinceCreation,
    feedbackRatings,
    strategyId: artifact.sourceStrategyId ?? undefined,
    tacticIds: artifact.includedTacticIds ?? undefined,
  };

  return generateArtifactSignals(context);
}

// ============================================================================
// Execution Status Chip
// ============================================================================

function ExecutionStatusChip({ state, workCount }: { state: 'not_started' | 'in_progress' | 'completed'; workCount: number }) {
  switch (state) {
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded">
          <CheckCircle className="w-3 h-3" />
          Executed
        </span>
      );
    case 'in_progress':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded">
          <Briefcase className="w-3 h-3" />
          In execution
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/30 rounded">
          <Circle className="w-3 h-3" />
          Not started
        </span>
      );
  }
}

// ============================================================================
// Status Badge
// ============================================================================

function StatusBadge({ status }: { status: ArtifactStatus }) {
  switch (status) {
    case 'final':
      return (
        <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded">
          <CheckCircle className="w-3 h-3" />
          {getArtifactStatusLabel(status)}
        </span>
      );
    case 'draft':
      return (
        <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/30 rounded">
          <PencilLine className="w-3 h-3" />
          {getArtifactStatusLabel(status)}
        </span>
      );
    case 'archived':
      return (
        <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-slate-600/10 text-slate-500 border border-slate-600/30 rounded">
          <Archive className="w-3 h-3" />
          {getArtifactStatusLabel(status)}
        </span>
      );
    default:
      return null;
  }
}

// ============================================================================
// Helpers
// ============================================================================

function getTypeIcon(type: ArtifactType) {
  switch (type) {
    case 'strategy_doc':
    case 'brief_doc':
    case 'custom':
      return <FileText className="w-3.5 h-3.5" />;
    case 'qbr_slides':
      return <Presentation className="w-3.5 h-3.5" />;
    case 'media_plan':
      return <Table className="w-3.5 h-3.5" />;
    default:
      return <FileText className="w-3.5 h-3.5" />;
  }
}

function getTypeIconStyle(type: ArtifactType) {
  switch (type) {
    case 'strategy_doc':
      return 'bg-purple-500/10 text-purple-400';
    case 'qbr_slides':
      return 'bg-blue-500/10 text-blue-400';
    case 'brief_doc':
      return 'bg-cyan-500/10 text-cyan-400';
    case 'media_plan':
      return 'bg-green-500/10 text-green-400';
    case 'custom':
    default:
      return 'bg-slate-500/10 text-slate-400';
  }
}

export default ArtifactsList;
