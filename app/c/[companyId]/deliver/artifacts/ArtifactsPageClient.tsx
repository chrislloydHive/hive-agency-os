'use client';

// app/c/[companyId]/deliver/artifacts/ArtifactsPageClient.tsx
// Artifacts Page Client Component
//
// Lists all artifacts for a company with:
// - Type and status filtering
// - Stale artifact warnings
// - Generate new artifact CTA
// - Actions (open in Google, archive, delete)

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FileText,
  Presentation,
  Table,
  ExternalLink,
  Loader2,
  FileWarning,
  CheckCircle,
  Archive,
  PencilLine,
  Plus,
  Filter,
  Trash2,
  MoreVertical,
  Sparkles,
  ArrowLeft,
  BookOpen,
  ChevronRight,
  X,
  Star,
  AlertCircle,
} from 'lucide-react';
import type { Artifact, ArtifactType, ArtifactStatus } from '@/lib/types/artifact';
import { getArtifactTypeLabel, getArtifactStatusLabel } from '@/lib/types/artifact';
import { GenerateArtifactModal } from '@/components/os/strategy/GenerateArtifactModal';
import { FEATURE_FLAGS } from '@/lib/config/featureFlags';
import {
  getArtifactRecommendations,
  type ScoredRecommendation,
} from '@/lib/os/artifacts/recommendations';
import { findExistingArtifact } from '@/lib/os/artifacts/findExistingArtifact';

// ============================================================================
// Types
// ============================================================================

interface ArtifactsPageClientProps {
  companyId: string;
  companyName: string;
  initialArtifacts: Artifact[];
  strategyId: string | null;
}

type FilterType = 'all' | ArtifactType;
type FilterStatus = 'all' | 'active' | ArtifactStatus;

// ============================================================================
// Main Component
// ============================================================================

export function ArtifactsPageClient({
  companyId,
  companyName,
  initialArtifacts,
  strategyId,
}: ArtifactsPageClientProps) {
  const router = useRouter();
  const [artifacts, setArtifacts] = useState<Artifact[]>(initialArtifacts);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('active');
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [modalDefaultTypeId, setModalDefaultTypeId] = useState<string | undefined>(undefined);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  // State for inline generation from recommended starters
  const [generatingTypeId, setGeneratingTypeId] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

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
      console.error('[ArtifactsPageClient] Refresh error:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // Filter artifacts
  const filteredArtifacts = useMemo(() => {
    return artifacts.filter(a => {
      // Type filter
      if (filterType !== 'all' && a.type !== filterType) return false;
      // Status filter
      if (filterStatus === 'active') return a.status !== 'archived';
      if (filterStatus !== 'all' && a.status !== filterStatus) return false;
      return true;
    });
  }, [artifacts, filterType, filterStatus]);

  // Count stale artifacts
  const staleCount = useMemo(() => {
    return filteredArtifacts.filter(a => a.isStale && a.status !== 'archived').length;
  }, [filteredArtifacts]);

  // Detect empty state type
  const isTrulyEmpty = artifacts.length === 0;
  const isFilterEmpty = artifacts.length > 0 && filteredArtifacts.length === 0;
  const hasActiveFilters = filterType !== 'all' || filterStatus !== 'active';

  // Get recommendations for the on-ramp
  const recommendations = useMemo<ScoredRecommendation[]>(() => {
    if (!isTrulyEmpty || !strategyId) return [];
    return getArtifactRecommendations({
      sourceType: 'strategy',
      existingArtifacts: [],
    }).slice(0, 3); // Top 3
  }, [isTrulyEmpty, strategyId]);

  // Extract recommended type IDs for the modal
  const recommendedTypeIds = useMemo(() => {
    return recommendations.map(r => r.type.id);
  }, [recommendations]);

  // Open modal handler - optionally with a pre-selected type
  const openGenerateModal = useCallback((defaultTypeId?: string) => {
    setModalDefaultTypeId(defaultTypeId);
    setIsGenerateModalOpen(true);
  }, []);

  // Handle recommended starter click - open existing or generate new
  const handleRecommendedStarterClick = useCallback(async (artifactTypeId: string) => {
    console.log('[ArtifactsPageClient] Starter clicked:', { artifactTypeId, strategyId });

    if (!strategyId) {
      console.error('[ArtifactsPageClient] No strategyId - cannot generate');
      setGenerationError('No strategy found. Please complete your strategy first.');
      return;
    }

    setGenerationError(null);

    // Check if an artifact of this type already exists
    const result = findExistingArtifact({
      artifactTypeId,
      sourceType: 'strategy',
      sourceId: strategyId,
      artifacts,
    });

    if (result.artifact) {
      // Navigate directly to existing artifact
      router.push(`/c/${companyId}/artifacts/${result.artifact.id}`);
      return;
    }

    // Generate new artifact
    setGeneratingTypeId(artifactTypeId);

    try {
      // Use AbortController with 2 minute timeout (matches API maxDuration)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      console.log('[ArtifactsPageClient] Generating artifact:', { artifactTypeId, strategyId });

      const response = await fetch(`/api/os/companies/${companyId}/artifacts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artifactTypeId,
          source: {
            sourceType: 'strategy',
            sourceId: strategyId,
          },
          mode: 'create',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Try to parse error, but handle non-JSON responses
        let errorMessage = 'Failed to generate artifact';
        try {
          const data = await response.json();
          errorMessage = data.error || errorMessage;
        } catch {
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('[ArtifactsPageClient] Generated artifact:', data.artifact.id);

      // Navigate directly to the new artifact
      router.push(`/c/${companyId}/artifacts/${data.artifact.id}`);
    } catch (err) {
      console.error('[ArtifactsPageClient] Generation error:', err);

      if (err instanceof Error && err.name === 'AbortError') {
        setGenerationError('Generation timed out. Please try again.');
      } else {
        setGenerationError(err instanceof Error ? err.message : 'Generation failed');
      }
    } finally {
      setGeneratingTypeId(null);
    }
  }, [strategyId, artifacts, companyId, router]);

  // Clear filters handler
  const clearFilters = useCallback(() => {
    setFilterType('all');
    setFilterStatus('active');
  }, []);

  // Get unique types for filter dropdown
  const uniqueTypes = useMemo(() => {
    const types = new Set(artifacts.map(a => a.type));
    return Array.from(types);
  }, [artifacts]);

  // Archive artifact
  const handleArchive = useCallback(async (artifactId: string) => {
    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/artifacts/${artifactId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'archived' }),
        }
      );
      if (response.ok) {
        await refreshArtifacts();
      }
    } catch (err) {
      console.error('[ArtifactsPageClient] Archive error:', err);
    }
    setActionMenuId(null);
  }, [companyId, refreshArtifacts]);

  // Delete artifact
  const handleDelete = useCallback(async (artifactId: string) => {
    if (!confirm('Are you sure you want to delete this artifact? This cannot be undone.')) {
      return;
    }
    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/artifacts/${artifactId}`,
        { method: 'DELETE' }
      );
      if (response.ok) {
        await refreshArtifacts();
      }
    } catch (err) {
      console.error('[ArtifactsPageClient] Delete error:', err);
    }
    setActionMenuId(null);
  }, [companyId, refreshArtifacts]);

  // Check if artifacts feature is enabled
  if (!FEATURE_FLAGS.ARTIFACTS_ENABLED) {
    return (
      <div className="space-y-6">
        <Header companyId={companyId} />
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
          <p className="text-slate-400">Artifacts feature is not enabled.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Header companyId={companyId} />

      {/* Actions Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as FilterType)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:border-purple-500 focus:outline-none"
            >
              <option value="all">All Types</option>
              {uniqueTypes.map(type => (
                <option key={type} value={type}>
                  {getArtifactTypeLabel(type)}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:border-purple-500 focus:outline-none"
          >
            <option value="active">Active</option>
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="final">Final</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* Generate New Button */}
        {strategyId && (
          <button
            onClick={() => openGenerateModal()}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Generate Artifact
          </button>
        )}
      </div>

      {/* Stale Warning */}
      {staleCount > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <FileWarning className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-sm font-medium text-amber-300">
                {staleCount} artifact{staleCount === 1 ? '' : 's'} may be out of date
              </p>
              <p className="text-xs text-amber-400/70 mt-0.5">
                Context or strategy has changed since these were generated.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Artifacts List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
        </div>
      ) : isTrulyEmpty ? (
        /* Contextual empty state for first-time users */
        <ArtifactsEmptyOnramp
          companyId={companyId}
          strategyId={strategyId}
          recommendations={recommendations}
          artifacts={artifacts}
          onStarterClick={handleRecommendedStarterClick}
          onGenerateClick={() => openGenerateModal()}
          generatingTypeId={generatingTypeId}
          generationError={generationError}
          onDismissError={() => setGenerationError(null)}
        />
      ) : isFilterEmpty ? (
        /* Filter empty state - artifacts exist but filters hide them */
        <FilterEmptyState onClearFilters={clearFilters} />
      ) : (
        <div className="space-y-2">
          {filteredArtifacts.map(artifact => (
            <ArtifactRow
              key={artifact.id}
              artifact={artifact}
              companyId={companyId}
              isMenuOpen={actionMenuId === artifact.id}
              onToggleMenu={() => setActionMenuId(actionMenuId === artifact.id ? null : artifact.id)}
              onArchive={() => handleArchive(artifact.id)}
              onDelete={() => handleDelete(artifact.id)}
            />
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="text-xs text-slate-500 text-center">
        Showing {filteredArtifacts.length} of {artifacts.length} artifacts
      </div>

      {/* Generate Artifact Modal */}
      {strategyId && (
        <GenerateArtifactModal
          isOpen={isGenerateModalOpen}
          onClose={() => {
            setIsGenerateModalOpen(false);
            setModalDefaultTypeId(undefined);
            refreshArtifacts();
          }}
          companyId={companyId}
          strategyId={strategyId}
          tactics={[]}
          launchMode={isTrulyEmpty ? 'recommended' : 'all'}
          recommendedTypeIds={recommendedTypeIds}
          defaultSelectedTypeId={modalDefaultTypeId}
        />
      )}
    </div>
  );
}

// ============================================================================
// Header Component
// ============================================================================

function Header({ companyId }: { companyId: string }) {
  return (
    <div className="flex items-center gap-4">
      <Link
        href={`/c/${companyId}/deliver`}
        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
      </Link>
      <div>
        <h1 className="text-xl font-semibold text-white">Artifacts</h1>
        <p className="text-sm text-slate-400">
          Generated deliverables and documents
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Artifacts Empty Onramp
// ============================================================================

interface ArtifactsEmptyOnrampProps {
  companyId: string;
  strategyId: string | null;
  recommendations: ScoredRecommendation[];
  artifacts: Artifact[];
  /** Called when user clicks a recommended starter */
  onStarterClick: (artifactTypeId: string) => void;
  /** Called when user clicks the generic "Generate Artifact" button */
  onGenerateClick: () => void;
  /** Currently generating artifact type ID (for loading state) */
  generatingTypeId: string | null;
  /** Error message from generation failure */
  generationError: string | null;
  /** Called to dismiss the error */
  onDismissError: () => void;
}

function ArtifactsEmptyOnramp({
  companyId,
  strategyId,
  recommendations,
  artifacts,
  onStarterClick,
  onGenerateClick,
  generatingTypeId,
  generationError,
  onDismissError,
}: ArtifactsEmptyOnrampProps) {
  // Memoize existing artifact lookup to avoid render-time issues
  const existingArtifactMap = useMemo(() => {
    const map = new Map<string, Artifact | null>();
    if (!strategyId || !artifacts || artifacts.length === 0) return map;

    for (const rec of recommendations) {
      try {
        const result = findExistingArtifact({
          artifactTypeId: rec.type.id,
          sourceType: 'strategy',
          sourceId: strategyId,
          artifacts,
        });
        map.set(rec.type.id, result.artifact);
      } catch {
        map.set(rec.type.id, null);
      }
    }
    return map;
  }, [strategyId, artifacts, recommendations]);

  const getExistingArtifact = (typeId: string): Artifact | null => {
    return existingArtifactMap.get(typeId) ?? null;
  };

  return (
    <div className="bg-gradient-to-br from-slate-900/80 to-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-700/50">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-purple-500/10 rounded-xl">
            <BookOpen className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">
              Create artifacts from your confirmed strategy
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-xl">
              Artifacts are briefs, summaries, playbooks, and reports derived from your strategy or plans.
              They guide execution and can be attached to work items later.
            </p>
          </div>
        </div>
      </div>

      {/* Error Toast */}
      {generationError && (
        <div className="mx-6 mt-6 flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300 flex-1">{generationError}</p>
          <button
            onClick={onDismissError}
            className="p-1 text-red-400 hover:text-red-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Recommended Starters */}
      {recommendations.length > 0 && (
        <div className="p-6 border-b border-slate-700/50">
          <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
            Recommended starters
          </h3>
          <div className="grid gap-2">
            {recommendations.map((rec) => {
              const existingArtifact = getExistingArtifact(rec.type.id);
              const isGenerating = generatingTypeId === rec.type.id;
              const hasExisting = existingArtifact !== null;

              return (
                <button
                  key={rec.type.id}
                  onClick={() => onStarterClick(rec.type.id)}
                  disabled={isGenerating || generatingTypeId !== null}
                  className={`flex items-center justify-between p-3 bg-slate-800/50 border rounded-lg text-left w-full group transition-colors ${
                    isGenerating
                      ? 'border-purple-500/50 bg-purple-500/5'
                      : generatingTypeId !== null
                      ? 'opacity-50 cursor-not-allowed border-slate-700/50'
                      : 'border-slate-700/50 hover:border-purple-500/50 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${getTypeIconStyle(rec.type.id as ArtifactType)}`}>
                      {isGenerating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        getTypeIcon(rec.type.id as ArtifactType)
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-200 group-hover:text-white">
                          {rec.type.label}
                        </span>
                        {hasExisting && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded">
                            Ready
                          </span>
                        )}
                        {rec.priority === 'high' && !hasExisting && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded">
                            <Star className="w-3 h-3" />
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {isGenerating
                          ? 'Generating with AI... this may take up to a minute'
                          : hasExisting
                          ? `${existingArtifact.status === 'draft' ? 'Draft' : 'Final'} artifact available`
                          : rec.type.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isGenerating && (
                      <span className={`text-xs font-medium ${hasExisting ? 'text-emerald-400' : 'text-purple-400'}`}>
                        {hasExisting ? 'Open' : 'Generate'}
                      </span>
                    )}
                    <ChevronRight className={`w-4 h-4 transition-colors ${
                      isGenerating
                        ? 'text-purple-400'
                        : hasExisting
                        ? 'text-emerald-600 group-hover:text-emerald-400'
                        : 'text-slate-600 group-hover:text-purple-400'
                    }`} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="p-6 flex items-center justify-between">
        <Link
          href={`/c/${companyId}/deliver#plans`}
          className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
        >
          View Plans
        </Link>
        {strategyId ? (
          <button
            onClick={onGenerateClick}
            disabled={generatingTypeId !== null}
            className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Generate Artifact
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <Link
            href={`/c/${companyId}/strategy`}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Complete Strategy First
            <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Filter Empty State
// ============================================================================

interface FilterEmptyStateProps {
  onClearFilters: () => void;
}

function FilterEmptyState({ onClearFilters }: FilterEmptyStateProps) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center">
      <Filter className="w-8 h-8 text-slate-600 mx-auto mb-3" />
      <p className="text-slate-400">No artifacts match your filters</p>
      <button
        onClick={onClearFilters}
        className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
      >
        <X className="w-4 h-4" />
        Clear filters
      </button>
    </div>
  );
}

// ============================================================================
// Artifact Row Component
// ============================================================================

interface ArtifactRowProps {
  artifact: Artifact;
  companyId: string;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

function ArtifactRow({
  artifact,
  companyId,
  isMenuOpen,
  onToggleMenu,
  onArchive,
  onDelete,
}: ArtifactRowProps) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Type Icon */}
          <div className={`p-2 rounded-lg ${getTypeIconStyle(artifact.type)}`}>
            {getTypeIcon(artifact.type)}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link
                href={`/c/${companyId}/artifacts/${artifact.id}`}
                className="text-sm font-medium text-slate-200 hover:text-white truncate transition-colors"
              >
                {artifact.title}
              </Link>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-500">
                {getArtifactTypeLabel(artifact.type)}
              </span>
              <StatusBadge status={artifact.status} />
              {artifact.isStale && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded">
                  Stale
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {artifact.googleFileUrl && (
            <a
              href={artifact.googleFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Open in Google Drive"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}

          {/* More Actions Menu */}
          <div className="relative">
            <button
              onClick={onToggleMenu}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 mt-1 w-36 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-10">
                {artifact.status !== 'archived' && (
                  <button
                    onClick={onArchive}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    <Archive className="w-4 h-4" />
                    Archive
                  </button>
                )}
                <button
                  onClick={onDelete}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-slate-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metadata row */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-800/50 text-xs text-slate-500">
        <span>Created {formatDate(artifact.createdAt)}</span>
        {artifact.updatedAt !== artifact.createdAt && (
          <span>Updated {formatDate(artifact.updatedAt)}</span>
        )}
        {artifact.source && (
          <span className="capitalize">{artifact.source.replace('_', ' ')}</span>
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
        <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded">
          <CheckCircle className="w-3 h-3" />
          {getArtifactStatusLabel(status)}
        </span>
      );
    case 'draft':
      return (
        <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-slate-500/10 text-slate-400 border border-slate-500/30 rounded">
          <PencilLine className="w-3 h-3" />
          {getArtifactStatusLabel(status)}
        </span>
      );
    case 'archived':
      return (
        <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-slate-600/10 text-slate-500 border border-slate-600/30 rounded">
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
    case 'strategy_summary':
      return 'bg-purple-500/10 text-purple-400';
    case 'qbr_slides':
    case 'proposal_slides':
      return 'bg-blue-500/10 text-blue-400';
    case 'brief_doc':
    case 'creative_brief':
    case 'media_brief':
    case 'content_brief':
    case 'campaign_brief':
    case 'seo_brief':
      return 'bg-cyan-500/10 text-cyan-400';
    case 'media_plan':
    case 'pricing_sheet':
      return 'bg-green-500/10 text-green-400';
    case 'execution_playbook':
      return 'bg-orange-500/10 text-orange-400';
    default:
      return 'bg-slate-500/10 text-slate-400';
  }
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return 'Unknown';
  }
}

export default ArtifactsPageClient;
