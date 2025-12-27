'use client';

// components/os/strategy/GenerateArtifactModal.tsx
// Generate Artifact Modal - Strategy-driven artifact generation
//
// Shows available artifact types and allows selection of tactics to include.
// Replaces the hardcoded "Generate Creative Brief" action.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  FileText,
  Target,
  Loader2,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Paintbrush,
  Radio,
  Search,
  BookOpen,
  BarChart,
  Users,
  Beaker,
  TrendingUp,
  Crosshair,
} from 'lucide-react';
import type { ArtifactTypeDefinition } from '@/lib/os/artifacts/registry';
import type { Tactic } from '@/lib/types/strategy';

// ============================================================================
// Types
// ============================================================================

export type ArtifactSourceConfig =
  | { type: 'strategy'; strategyId: string; tactics?: Tactic[] }
  | { type: 'plan:media'; planId: string }
  | { type: 'plan:content'; planId: string };

/** Launch mode for the modal */
export type GenerateArtifactLaunchMode = 'recommended' | 'all';

interface GenerateArtifactModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  /** New flexible source prop - prefer this over legacy props */
  source?: ArtifactSourceConfig;
  /** @deprecated Use source.strategyId instead */
  strategyId?: string;
  /** @deprecated Use source.tactics instead */
  tactics?: Tactic[];
  /** @deprecated Use launchMode + recommendedTypeIds instead */
  recommendedTypes?: ArtifactTypeDefinition[];
  /**
   * Launch mode: "recommended" shows only recommended types initially,
   * "all" shows the full categorized list (default behavior).
   */
  launchMode?: GenerateArtifactLaunchMode;
  /**
   * IDs of artifact types to show as recommended.
   * Order is preserved in the recommended section.
   */
  recommendedTypeIds?: string[];
  /**
   * Pre-select this artifact type when modal opens.
   */
  defaultSelectedTypeId?: string;
}

// Icon mapping for artifact types
const ARTIFACT_TYPE_ICONS: Record<string, React.ElementType> = {
  creative_brief: Paintbrush,
  media_brief: Radio,
  content_brief: FileText,
  campaign_brief: Target,
  seo_brief: Search,
  strategy_summary: FileText,
  stakeholder_summary: Users,
  acquisition_plan_summary: TrendingUp,
  execution_playbook: BookOpen,
  experiment_roadmap: Beaker,
  channel_analysis: BarChart,
  competitive_positioning: Crosshair,
};

// Category labels
const CATEGORY_LABELS: Record<string, string> = {
  brief: 'Briefs',
  summary: 'Summaries',
  playbook: 'Playbooks',
  report: 'Reports',
  plan: 'Plans',
};

// ============================================================================
// Main Component
// ============================================================================

export function GenerateArtifactModal({
  isOpen,
  onClose,
  companyId,
  source,
  strategyId: legacyStrategyId,
  tactics: legacyTactics,
  recommendedTypes = [],
  launchMode = 'recommended',
  recommendedTypeIds = [],
  defaultSelectedTypeId,
}: GenerateArtifactModalProps) {
  const router = useRouter();
  const [artifactTypes, setArtifactTypes] = useState<ArtifactTypeDefinition[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [selectedTacticIds, setSelectedTacticIds] = useState<Set<string>>(new Set());
  const [promptHint, setPromptHint] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingTypes, setLoadingTypes] = useState(true);

  // Determine if we're in "recommended-first" mode
  // Use new launchMode prop, or fallback to legacy recommendedTypes behavior
  const hasRecommendedTypes = recommendedTypeIds.length > 0 || recommendedTypes.length > 0;
  const isRecommendedFirst = launchMode === 'recommended' && hasRecommendedTypes;

  // In recommended-first mode, start with all types hidden; otherwise show all
  const [showAllTypes, setShowAllTypes] = useState(!isRecommendedFirst);

  // Reset showAllTypes when modal opens (to handle reopening with different launchMode)
  useEffect(() => {
    if (isOpen) {
      setShowAllTypes(!isRecommendedFirst);
    }
  }, [isOpen, isRecommendedFirst]);

  // Derive source type and related values
  const sourceType = source?.type ?? 'strategy';
  const strategyId = source?.type === 'strategy' ? source.strategyId : legacyStrategyId;
  const planId = source?.type === 'plan:media' || source?.type === 'plan:content' ? source.planId : undefined;
  const tactics = source?.type === 'strategy' ? (source.tactics ?? legacyTactics ?? []) : [];
  const isPlanSource = sourceType === 'plan:media' || sourceType === 'plan:content';

  // Load artifact types from registry on mount
  useEffect(() => {
    if (!isOpen) return;

    async function loadTypes() {
      setLoadingTypes(true);
      try {
        // Import from registry (client-side import)
        const { getArtifactTypesForSource } = await import(
          '@/lib/os/artifacts/registry'
        );

        // Get types that support the current source type
        const types = getArtifactTypesForSource(sourceType);
        setArtifactTypes(types);

        // Handle pre-selection:
        // 1. If defaultSelectedTypeId is provided, use it
        // 2. Otherwise, if we have recommended types/IDs and no selection, auto-select first
        if (defaultSelectedTypeId) {
          setSelectedTypeId(defaultSelectedTypeId);
        } else if (!selectedTypeId) {
          if (recommendedTypeIds.length > 0) {
            setSelectedTypeId(recommendedTypeIds[0]);
          } else if (recommendedTypes.length > 0) {
            setSelectedTypeId(recommendedTypes[0].id);
          }
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('[GenerateArtifactModal] Failed to load artifact types:', errMsg, err);
      } finally {
        setLoadingTypes(false);
      }
    }

    loadTypes();
  }, [isOpen, sourceType, recommendedTypes, recommendedTypeIds, selectedTypeId, defaultSelectedTypeId]);

  // Initialize selected tactics to active ones (only for strategy source)
  useEffect(() => {
    if (!tactics || tactics.length === 0) return;
    const activeTacticIds = tactics
      .filter(t => t.status === 'active' || t.status === 'proposed')
      .map(t => t.id);
    setSelectedTacticIds(new Set(activeTacticIds));
  }, [tactics]);

  // Compute recommended types from IDs (preserving order)
  // Falls back to legacy recommendedTypes if recommendedTypeIds is empty
  const resolvedRecommendedTypes = useMemo((): ArtifactTypeDefinition[] => {
    if (recommendedTypeIds.length > 0) {
      // Map IDs to full type definitions, preserving order
      return recommendedTypeIds
        .map(id => artifactTypes.find(t => t.id === id))
        .filter((t): t is ArtifactTypeDefinition => t !== undefined);
    }
    // Fallback to legacy recommendedTypes
    return recommendedTypes;
  }, [artifactTypes, recommendedTypeIds, recommendedTypes]);

  // Group artifact types by category
  const groupedTypes = useMemo(() => {
    const groups: Record<string, ArtifactTypeDefinition[]> = {};

    for (const type of artifactTypes) {
      const category = type.category || 'other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(type);
    }

    return groups;
  }, [artifactTypes]);

  // Toggle tactic selection
  const toggleTactic = useCallback((tacticId: string) => {
    setSelectedTacticIds(prev => {
      const next = new Set(prev);
      if (next.has(tacticId)) {
        next.delete(tacticId);
      } else {
        next.add(tacticId);
      }
      return next;
    });
  }, []);

  // Select/deselect all tactics
  const toggleAllTactics = useCallback((select: boolean) => {
    if (select) {
      const allIds = tactics.map(t => t.id);
      setSelectedTacticIds(new Set(allIds));
    } else {
      setSelectedTacticIds(new Set());
    }
  }, [tactics]);

  // Generate artifact
  const handleGenerate = async () => {
    if (!selectedTypeId) {
      setError('Please select an artifact type');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Build source object based on source type
      const sourcePayload = isPlanSource
        ? {
            sourceType: sourceType,
            sourceId: planId,
          }
        : {
            sourceType: 'strategy',
            sourceId: strategyId,
            includedTacticIds: selectedTacticIds.size > 0 ? Array.from(selectedTacticIds) : undefined,
          };

      const response = await fetch(`/api/os/companies/${companyId}/artifacts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artifactTypeId: selectedTypeId,
          source: sourcePayload,
          mode: 'create',
          promptHint: promptHint || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate artifact');
      }

      const data = await response.json();

      // Show warnings if any
      if (data.warnings?.length > 0) {
        console.warn('[GenerateArtifactModal] Generation warnings:', data.warnings);
      }

      // Navigate to the new artifact
      router.push(`/c/${companyId}/artifacts/${data.artifact.id}`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  const selectedType = artifactTypes.find(t => t.id === selectedTypeId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <Sparkles className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Generate Artifact</h2>
              <p className="text-xs text-slate-400">
                Create a deliverable from your {
                  isPlanSource
                    ? sourceType === 'plan:media' ? 'media plan' : 'content plan'
                    : 'strategy'
                }
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loadingTypes ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <>
              {/* Artifact Type Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  Artifact Type
                </label>

                {/* Recommended Types Section */}
                {resolvedRecommendedTypes.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-slate-500 mb-2">Recommended for your strategy</p>
                    <div className="grid gap-2">
                      {resolvedRecommendedTypes.map(type => (
                        <TypeButton
                          key={type.id}
                          type={type}
                          isSelected={selectedTypeId === type.id}
                          onClick={() => setSelectedTypeId(type.id)}
                          recommended
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* All Types Toggle - shown when there are recommended types */}
                {resolvedRecommendedTypes.length > 0 && (
                  <button
                    onClick={() => setShowAllTypes(!showAllTypes)}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300 transition-colors mb-3"
                  >
                    {showAllTypes ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    {showAllTypes ? 'Hide' : 'Show'} all artifact types
                  </button>
                )}

                {/* All Types by Category - shown when toggle is on OR when no recommendations */}
                {(showAllTypes || resolvedRecommendedTypes.length === 0) && (
                  <div className="space-y-4">
                    {Object.entries(groupedTypes).map(([category, types]) => (
                      <div key={category}>
                        <p className="text-xs text-slate-500 mb-2">
                          {CATEGORY_LABELS[category] || category}
                        </p>
                        <div className="grid gap-2">
                          {types.map(type => (
                            <TypeButton
                              key={type.id}
                              type={type}
                              isSelected={selectedTypeId === type.id}
                              onClick={() => setSelectedTypeId(type.id)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Type Info */}
              {selectedType && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <TypeIcon typeId={selectedType.id} className="w-5 h-5 text-purple-400 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-slate-200">
                        {selectedType.label}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1">
                        {selectedType.description}
                      </p>
                      {selectedType.defaultSections && (
                        <p className="text-xs text-slate-500 mt-2">
                          Sections: {selectedType.defaultSections.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tactics Selection */}
              {tactics.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-slate-300">
                      Include Tactics ({selectedTacticIds.size} of {tactics.length})
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleAllTactics(true)}
                        className="text-xs text-slate-400 hover:text-slate-300"
                      >
                        Select all
                      </button>
                      <span className="text-slate-600">|</span>
                      <button
                        onClick={() => toggleAllTactics(false)}
                        className="text-xs text-slate-400 hover:text-slate-300"
                      >
                        Deselect all
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {tactics.map(tactic => (
                      <label
                        key={tactic.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTacticIds.has(tactic.id)}
                          onChange={() => toggleTactic(tactic.id)}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500/30"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-300 truncate">
                            {tactic.title}
                          </p>
                          {tactic.channels && tactic.channels.length > 0 && (
                            <p className="text-xs text-slate-500">
                              {tactic.channels.join(', ')}
                            </p>
                          )}
                        </div>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          tactic.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : tactic.status === 'proposed'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-slate-500/10 text-slate-400'
                        }`}>
                          {tactic.status}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional Context */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Additional Context (Optional)
                </label>
                <textarea
                  value={promptHint}
                  onChange={(e) => setPromptHint(e.target.value)}
                  placeholder="Any specific focus areas or requirements for this artifact..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 resize-none"
                  rows={3}
                />
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={!selectedTypeId || isGenerating}
            className="px-5 py-2 text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Artifact
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Type Button
// ============================================================================

function TypeButton({
  type,
  isSelected,
  onClick,
  recommended = false,
}: {
  type: ArtifactTypeDefinition;
  isSelected: boolean;
  onClick: () => void;
  recommended?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
        isSelected
          ? 'bg-purple-500/20 border border-purple-500/40'
          : 'bg-slate-800/50 border border-slate-700 hover:border-slate-600'
      }`}
    >
      <TypeIcon
        typeId={type.id}
        className={`w-5 h-5 ${isSelected ? 'text-purple-400' : 'text-slate-400'}`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-medium ${isSelected ? 'text-purple-200' : 'text-slate-300'}`}>
            {type.label}
          </p>
          {recommended && (
            <span className="px-1.5 py-0.5 text-[10px] bg-purple-500/20 text-purple-400 rounded">
              Recommended
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 truncate">{type.description}</p>
      </div>
      {isSelected && (
        <CheckCircle className="w-5 h-5 text-purple-400 flex-shrink-0" />
      )}
    </button>
  );
}

// ============================================================================
// Type Icon
// ============================================================================

function TypeIcon({ typeId, className }: { typeId: string; className?: string }) {
  const Icon = ARTIFACT_TYPE_ICONS[typeId] || FileText;
  return <Icon className={className} />;
}

export default GenerateArtifactModal;
