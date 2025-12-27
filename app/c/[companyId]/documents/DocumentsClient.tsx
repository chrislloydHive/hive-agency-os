'use client';

// app/c/[companyId]/documents/DocumentsClient.tsx
// Documents Client Component
//
// Displays all artifacts for a company with:
// - Pinned primary document at top
// - Grouped artifacts by type
// - Staleness warning with Insert Updates action
//
// UI state is derived from a single selector: getDocumentsUIState()

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
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
  ChevronRight,
  Star,
  RefreshCw,
  Plus,
  Filter,
} from 'lucide-react';
import type { Artifact, ArtifactType, ArtifactStatus } from '@/lib/types/artifact';
import { getArtifactTypeLabel, getArtifactStatusLabel, createDefaultUsage } from '@/lib/types/artifact';
import { ArtifactUsageBadge } from '@/components/os/artifacts/ArtifactUsageIndicators';
import {
  getDocumentsUIState,
  getUpdateRouteForArtifact,
  isUpdatableType,
  type DocumentsUIState,
  type DocumentsDataInput,
  type DocumentGroupKey,
} from '@/lib/os/ui/documentsUiState';
import { getArtifactViewerHref } from '@/lib/os/artifacts/navigation';

// ============================================================================
// Types
// ============================================================================

interface DocumentsClientProps {
  companyId: string;
  companyName: string;
  initialArtifacts: Artifact[];
}

type FilterType = 'all' | ArtifactType;
type FilterStatus = 'all' | 'active' | ArtifactStatus;
type FilterUsage = 'all' | 'used' | 'never_used' | 'high_impact';

// ============================================================================
// Main Component
// ============================================================================

export function DocumentsClient({
  companyId,
  companyName,
  initialArtifacts,
}: DocumentsClientProps) {
  const [artifacts, setArtifacts] = useState<Artifact[]>(initialArtifacts);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('active');
  const [filterUsage, setFilterUsage] = useState<FilterUsage>('all');

  // Derive UI state from selector
  const dataInput: DocumentsDataInput = { artifacts };
  const uiState: DocumentsUIState = getDocumentsUIState(dataInput, companyId);

  // Refresh artifacts
  const refreshArtifacts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/os/companies/${companyId}/artifacts`);
      if (response.ok) {
        const data = await response.json();
        setArtifacts(data.artifacts || []);
      }
    } catch (err) {
      console.error('[DocumentsClient] Refresh error:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // Apply filters to groups
  const getFilteredArtifacts = (groupArtifacts: Artifact[]): Artifact[] => {
    return groupArtifacts.filter(a => {
      // Type filter
      if (filterType !== 'all' && a.type !== filterType) return false;
      // Status filter
      if (filterStatus === 'active' && a.status === 'archived') return false;
      if (filterStatus !== 'all' && filterStatus !== 'active' && a.status !== filterStatus) return false;
      // Usage filter
      if (filterUsage !== 'all') {
        const usage = a.usage ?? createDefaultUsage();
        const isUsed = usage.attachedWorkCount > 0;
        const isHighImpact = usage.completedWorkCount > 0 || usage.attachedWorkCount >= 3;
        if (filterUsage === 'used' && !isUsed) return false;
        if (filterUsage === 'never_used' && isUsed) return false;
        if (filterUsage === 'high_impact' && !isHighImpact) return false;
      }
      return true;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Documents</h1>
        <p className="text-sm text-slate-400 mt-1">
          All generated deliverables for {companyName}.
        </p>
      </div>

      {/* Dev-only UI state debug indicator */}
      {process.env.NODE_ENV !== 'production' && (
        <div className="text-[10px] font-mono text-slate-500 bg-slate-900/50 border border-slate-800/50 rounded px-2 py-1">
          <span className="text-cyan-400">{uiState.state}</span>
          <span className="mx-2">|</span>
          primary: {uiState.debug.preferredPrimaryType ?? 'none'}
          <span className="mx-2">|</span>
          groups: {uiState.groups.length}
          <span className="mx-2">|</span>
          stale: {uiState.staleCount}
          <span className="mx-2">|</span>
          CTA: &quot;{uiState.primaryCTA.label}&quot;
        </div>
      )}

      {/* Staleness Warning Banner */}
      {uiState.showStaleWarning && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileWarning className="w-5 h-5 text-amber-400" />
              <div>
                <p className="text-sm font-medium text-amber-300">
                  {uiState.staleCount} document{uiState.staleCount === 1 ? '' : 's'} may be out of date
                </p>
                <p className="text-xs text-amber-400/70 mt-0.5">
                  Context or strategy has changed since these were created.
                </p>
              </div>
            </div>
            {uiState.staleUpdatableArtifact && (
              <Link
                href={uiState.primaryCTA.href}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-sm transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                {uiState.primaryCTA.label}
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {uiState.state === 'empty' && (
        <div className="bg-slate-900/50 border border-slate-800 border-dashed rounded-xl p-12 text-center">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-lg font-medium text-slate-400">No documents yet</p>
          <p className="text-sm text-slate-500 mt-1 mb-6">
            Create deliverables in the Deliver phase to see them here.
          </p>
          <Link
            href={uiState.primaryCTA.href}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-purple-500 hover:bg-purple-400 text-white font-semibold text-sm transition-colors"
          >
            {uiState.primaryCTA.label}
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Has Documents */}
      {uiState.state !== 'empty' && (
        <>
          {/* Pinned Primary Card */}
          {uiState.primaryArtifact && (
            <div className="bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-500/30 rounded-xl p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-500/20 rounded-lg">
                    <Star className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-xs text-purple-400/80 uppercase tracking-wider mb-1">
                      Primary Document
                    </p>
                    <h3 className="text-lg font-semibold text-white">
                      {uiState.primaryArtifact.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-400">
                        {getArtifactTypeLabel(uiState.primaryArtifact.type)}
                      </span>
                      <StatusBadge status={uiState.primaryArtifact.status} />
                      {uiState.primaryArtifact.isStale && (
                        <span className="px-1.5 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded">
                          Stale
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {uiState.secondaryCTA && (
                    uiState.secondaryCTA.external ? (
                      <a
                        href={uiState.secondaryCTA.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm transition-colors border border-slate-700"
                      >
                        {uiState.secondaryCTA.label}
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    ) : (
                      <Link
                        href={uiState.secondaryCTA.href}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm transition-colors border border-slate-700"
                      >
                        {uiState.secondaryCTA.label}
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    )
                  )}
                  {uiState.primaryCTA.external ? (
                    <a
                      href={uiState.primaryCTA.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-400 text-white font-semibold text-sm transition-colors"
                    >
                      {uiState.primaryCTA.label}
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  ) : (
                    <Link
                      href={uiState.primaryCTA.href}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-400 text-white font-semibold text-sm transition-colors"
                    >
                      {uiState.primaryCTA.label}
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Filter className="w-4 h-4 text-slate-500" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                <option value="active">Active</option>
                <option value="all">All statuses</option>
                <option value="draft">Draft only</option>
                <option value="final">Final only</option>
                <option value="archived">Archived only</option>
              </select>
              <select
                value={filterUsage}
                onChange={(e) => setFilterUsage(e.target.value as FilterUsage)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                <option value="all">All usage</option>
                <option value="used">Used</option>
                <option value="high_impact">High impact</option>
                <option value="never_used">Never used</option>
              </select>
            </div>
            <button
              onClick={refreshArtifacts}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-slate-300 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Grouped Artifacts */}
          <div className="space-y-6">
            {uiState.groups.map(group => {
              const filtered = getFilteredArtifacts(group.artifacts);
              if (filtered.length === 0) return null;

              return (
                <div key={group.key}>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                      <GroupIcon groupKey={group.key} />
                      {group.label}
                    </h2>
                    <span className="text-xs text-slate-500">
                      {filtered.length} document{filtered.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {filtered.map(artifact => (
                      <ArtifactRow
                        key={artifact.id}
                        artifact={artifact}
                        companyId={companyId}
                        isPrimary={artifact.id === uiState.primaryArtifact?.id}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Create New CTA */}
          <div className="pt-4 border-t border-slate-800">
            <Link
              href={`/c/${companyId}/deliver`}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create new deliverable
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Artifact Row
// ============================================================================

function ArtifactRow({
  artifact,
  companyId,
  isPrimary,
}: {
  artifact: Artifact;
  companyId: string;
  isPrimary: boolean;
}) {
  const router = useRouter();
  const updateRoute = getUpdateRouteForArtifact(artifact, companyId);
  const viewerHref = getArtifactViewerHref(companyId, artifact.id);

  const handleRowClick = () => {
    router.push(viewerHref);
  };

  const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      onClick={handleRowClick}
      className={`bg-slate-900/50 border rounded-lg p-4 flex items-center justify-between cursor-pointer ${
        isPrimary
          ? 'border-purple-500/30 bg-purple-500/5 hover:border-purple-500/50'
          : 'border-slate-800 hover:border-slate-700'
      } transition-colors`}
    >
      <div className="flex items-center gap-3">
        {/* Type icon */}
        <div className={`p-2 rounded-lg ${getTypeIconStyle(artifact.type)}`}>
          {getTypeIcon(artifact.type)}
        </div>

        {/* Title and metadata */}
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-300">
              {artifact.title}
            </p>
            {isPrimary && (
              <Star className="w-3.5 h-3.5 text-purple-400" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-slate-500">
              {getArtifactTypeLabel(artifact.type)}
            </span>
            <StatusBadge status={artifact.status} />
            <ArtifactUsageBadge usage={artifact.usage ?? createDefaultUsage()} />
            {artifact.isStale && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded">
                Stale
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2" onClick={stopPropagation}>
        {/* Insert Updates action for stale updatable artifacts */}
        {artifact.isStale && updateRoute && (
          <Link
            href={updateRoute}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Update
          </Link>
        )}

        {/* Open in Drive */}
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
  );
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
// Group Icon
// ============================================================================

function GroupIcon({ groupKey }: { groupKey: DocumentGroupKey }) {
  switch (groupKey) {
    case 'strategy':
      return <FileText className="w-4 h-4 text-purple-400" />;
    case 'rfp':
      return <FileText className="w-4 h-4 text-cyan-400" />;
    case 'slides':
      return <Presentation className="w-4 h-4 text-blue-400" />;
    case 'sheets':
      return <Table className="w-4 h-4 text-green-400" />;
    case 'other':
    default:
      return <FileText className="w-4 h-4 text-slate-400" />;
  }
}

// ============================================================================
// Helpers
// ============================================================================

function getTypeIcon(type: ArtifactType) {
  switch (type) {
    case 'strategy_doc':
    case 'brief_doc':
    case 'rfp_response_doc':
    case 'custom':
      return <FileText className="w-4 h-4" />;
    case 'qbr_slides':
    case 'proposal_slides':
      return <Presentation className="w-4 h-4" />;
    case 'media_plan':
    case 'pricing_sheet':
      return <Table className="w-4 h-4" />;
    default:
      return <FileText className="w-4 h-4" />;
  }
}

function getTypeIconStyle(type: ArtifactType) {
  switch (type) {
    case 'strategy_doc':
      return 'bg-purple-500/10 text-purple-400';
    case 'rfp_response_doc':
      return 'bg-cyan-500/10 text-cyan-400';
    case 'qbr_slides':
    case 'proposal_slides':
      return 'bg-blue-500/10 text-blue-400';
    case 'media_plan':
    case 'pricing_sheet':
      return 'bg-green-500/10 text-green-400';
    case 'brief_doc':
      return 'bg-amber-500/10 text-amber-400';
    case 'custom':
    default:
      return 'bg-slate-500/10 text-slate-400';
  }
}

export default DocumentsClient;
