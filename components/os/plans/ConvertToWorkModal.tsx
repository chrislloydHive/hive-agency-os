'use client';

// components/os/plans/ConvertToWorkModal.tsx
// Modal for converting an approved plan to work items with optional artifact selection
//
// Features:
// - Dry-run preview showing work items to be created
// - Optional artifact picker (final artifacts by default, toggle for draft)
// - Conversion with selected artifact IDs
// - Success feedback with stats

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Loader2,
  AlertTriangle,
  CheckCircle,
  ArrowRightCircle,
  Package,
  FileText,
  Presentation,
  Table,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import type { PlanType } from '@/lib/types/plan';
import type { Artifact } from '@/lib/types/artifact';
import { getArtifactTypeLabel } from '@/lib/types/artifact';

// ============================================================================
// Types
// ============================================================================

interface ConvertToWorkModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  planId: string;
  planType: PlanType;
  planVersion: number;
}

interface DryRunResult {
  stats: {
    total: number;
    new: number;
    skipped: number;
  };
  breakdown: {
    campaigns?: number;
    calendarItems?: number;
  };
  skippedWorkKeys: string[];
}

interface ConvertResult {
  created: number;
  skipped: number;
  artifactsAttached: number;
}

// ============================================================================
// Component
// ============================================================================

export function ConvertToWorkModal({
  isOpen,
  onClose,
  companyId,
  planId,
  planType,
  planVersion,
}: ConvertToWorkModalProps) {
  const router = useRouter();

  // State
  const [step, setStep] = useState<'preview' | 'converting' | 'success'>('preview');
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Artifacts state
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loadingArtifacts, setLoadingArtifacts] = useState(true);
  const [selectedArtifactIds, setSelectedArtifactIds] = useState<Set<string>>(new Set());
  const [includeDrafts, setIncludeDrafts] = useState(false);

  // Result state
  const [result, setResult] = useState<ConvertResult | null>(null);

  // Fetch dry-run preview
  useEffect(() => {
    if (!isOpen) return;

    const fetchPreview = async () => {
      setLoadingPreview(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/os/companies/${companyId}/plans/${planType}/${planId}/convert-to-work`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dryRun: true }),
          }
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || data.reason || 'Failed to preview conversion');
        }

        setDryRun({
          stats: data.stats || { total: 0, new: 0, skipped: 0 },
          breakdown: data.breakdown || {},
          skippedWorkKeys: data.skippedWorkKeys || [],
        });
      } catch (err) {
        console.error('[ConvertToWorkModal] Preview error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load preview');
      } finally {
        setLoadingPreview(false);
      }
    };

    fetchPreview();
  }, [isOpen, companyId, planType, planId]);

  // Fetch artifacts
  useEffect(() => {
    if (!isOpen) return;

    const fetchArtifacts = async () => {
      setLoadingArtifacts(true);
      try {
        const response = await fetch(`/api/os/companies/${companyId}/artifacts`);
        const data = await response.json();

        if (response.ok && data.artifacts) {
          // Filter to relevant artifacts
          const relevant = (data.artifacts as Artifact[]).filter((a) => {
            // Exclude archived
            if (a.status === 'archived') return false;

            // Include plan-specific artifacts
            if (planType === 'media' && a.sourceMediaPlanId === planId) return true;
            if (planType === 'content' && a.sourceContentPlanId === planId) return true;

            // Include strategy-level artifacts
            if (a.sourceStrategyId && !a.sourceMediaPlanId && !a.sourceContentPlanId) return true;

            return false;
          });

          setArtifacts(relevant);
        }
      } catch (err) {
        console.error('[ConvertToWorkModal] Artifacts fetch error:', err);
      } finally {
        setLoadingArtifacts(false);
      }
    };

    fetchArtifacts();
  }, [isOpen, companyId, planType, planId]);

  // Filter artifacts by draft toggle
  const displayedArtifacts = useMemo(() => {
    if (includeDrafts) return artifacts;
    return artifacts.filter((a) => a.status === 'final');
  }, [artifacts, includeDrafts]);

  // Toggle artifact selection
  const toggleArtifact = useCallback((artifactId: string) => {
    setSelectedArtifactIds((prev) => {
      const next = new Set(prev);
      if (next.has(artifactId)) {
        next.delete(artifactId);
      } else {
        next.add(artifactId);
      }
      return next;
    });
  }, []);

  // Handle convert
  const handleConvert = useCallback(async () => {
    setStep('converting');
    setError(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/plans/${planType}/${planId}/convert-to-work`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dryRun: false,
            attachArtifactIds: Array.from(selectedArtifactIds),
          }),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.reason || 'Failed to convert');
      }

      setResult({
        created: data.stats?.created ?? 0,
        skipped: data.stats?.skipped ?? 0,
        artifactsAttached: data.stats?.artifactsAttached ?? 0,
      });
      setStep('success');

      // Navigate after delay
      setTimeout(() => {
        router.push(`/c/${companyId}/work?source=heavy_plan&planId=${planId}`);
        onClose();
      }, 2000);
    } catch (err) {
      console.error('[ConvertToWorkModal] Convert error:', err);
      setError(err instanceof Error ? err.message : 'Failed to convert');
      setStep('preview');
    }
  }, [companyId, planType, planId, selectedArtifactIds, router, onClose]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setStep('preview');
      setDryRun(null);
      setError(null);
      setSelectedArtifactIds(new Set());
      setIncludeDrafts(false);
      setResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const draftArtifactsSelected = Array.from(selectedArtifactIds).some((id) =>
    artifacts.find((a) => a.id === id && a.status === 'draft')
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={step === 'converting' ? undefined : onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-white">Convert to Work Items</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {planType === 'media' ? 'Media Plan' : 'Content Plan'} v{planVersion}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={step === 'converting'}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Preview Step */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Preview Section */}
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <h3 className="text-sm font-medium text-slate-300 mb-3">Preview</h3>

                {loadingPreview ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                  </div>
                ) : error ? (
                  <div className="flex items-center gap-2 text-sm text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                    {error}
                  </div>
                ) : dryRun ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Work items to create</span>
                      <span className="font-medium text-white">{dryRun.stats.new}</span>
                    </div>
                    {dryRun.stats.skipped > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Already exists (skipped)</span>
                        <span className="font-medium text-slate-500">{dryRun.stats.skipped}</span>
                      </div>
                    )}
                    {dryRun.breakdown.campaigns && (
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>From campaigns</span>
                        <span>{dryRun.breakdown.campaigns}</span>
                      </div>
                    )}
                    {dryRun.breakdown.calendarItems && (
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>From calendar items</span>
                        <span>{dryRun.breakdown.calendarItems}</span>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Artifact Selection */}
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-slate-500" />
                    <h3 className="text-sm font-medium text-slate-300">Attach Artifacts</h3>
                    <span className="text-xs text-slate-500">(optional)</span>
                  </div>

                  {/* Draft toggle */}
                  <button
                    onClick={() => setIncludeDrafts(!includeDrafts)}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300 transition-colors"
                  >
                    {includeDrafts ? (
                      <ToggleRight className="w-4 h-4 text-purple-400" />
                    ) : (
                      <ToggleLeft className="w-4 h-4" />
                    )}
                    Include drafts
                  </button>
                </div>

                {loadingArtifacts ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                  </div>
                ) : displayedArtifacts.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">
                    {artifacts.length > 0
                      ? 'No final artifacts. Toggle to include drafts.'
                      : 'No related artifacts found.'}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {displayedArtifacts.map((artifact) => (
                      <ArtifactCheckbox
                        key={artifact.id}
                        artifact={artifact}
                        selected={selectedArtifactIds.has(artifact.id)}
                        onToggle={() => toggleArtifact(artifact.id)}
                      />
                    ))}
                  </div>
                )}

                {/* Draft warning */}
                {draftArtifactsSelected && (
                  <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-400">
                      Selected draft artifacts may change. Finalize for stability.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Converting Step */}
          {step === 'converting' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-4" />
              <p className="text-sm text-slate-300">Creating work items...</p>
            </div>
          )}

          {/* Success Step */}
          {step === 'success' && result && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              </div>
              <p className="text-lg font-medium text-white mb-2">Conversion Complete</p>
              <div className="text-sm text-slate-400 text-center space-y-1">
                <p>Created {result.created} work item{result.created !== 1 ? 's' : ''}</p>
                {result.artifactsAttached > 0 && (
                  <p className="text-purple-400">
                    Attached {result.artifactsAttached} artifact{result.artifactsAttached !== 1 ? 's' : ''}
                  </p>
                )}
                {result.skipped > 0 && (
                  <p className="text-slate-500">({result.skipped} skipped)</p>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-4">Redirecting to Work...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'preview' && (
          <div className="p-4 border-t border-slate-800 flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConvert}
              disabled={loadingPreview || !dryRun || dryRun.stats.new === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-500 hover:bg-blue-400 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowRightCircle className="w-4 h-4" />
              Create {dryRun?.stats.new || 0} Work Item{(dryRun?.stats.new ?? 0) !== 1 ? 's' : ''}
              {selectedArtifactIds.size > 0 && (
                <span className="text-blue-200">+ {selectedArtifactIds.size} artifact{selectedArtifactIds.size !== 1 ? 's' : ''}</span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Artifact Checkbox
// ============================================================================

interface ArtifactCheckboxProps {
  artifact: Artifact;
  selected: boolean;
  onToggle: () => void;
}

function ArtifactCheckbox({ artifact, selected, onToggle }: ArtifactCheckboxProps) {
  return (
    <label
      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
        selected
          ? 'bg-purple-500/10 border border-purple-500/30'
          : 'bg-slate-900/50 border border-slate-700/50 hover:border-slate-600'
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
      />
      <div className={`p-1 rounded ${getTypeIconStyle(artifact.type)}`}>
        {getTypeIcon(artifact.type)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-200 truncate">{artifact.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-slate-500">
            {getArtifactTypeLabel(artifact.type)}
          </span>
          <span className={`px-1 py-0.5 text-[9px] font-medium rounded ${
            artifact.status === 'final'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'bg-slate-500/10 text-slate-400 border border-slate-500/30'
          }`}>
            {artifact.status === 'final' ? 'Final' : 'Draft'}
          </span>
          {artifact.isStale && (
            <span className="px-1 py-0.5 text-[9px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded">
              Stale
            </span>
          )}
        </div>
      </div>
    </label>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getTypeIcon(type: string) {
  switch (type) {
    case 'qbr_slides':
    case 'proposal_slides':
      return <Presentation className="w-3 h-3" />;
    case 'media_plan':
    case 'pricing_sheet':
      return <Table className="w-3 h-3" />;
    default:
      return <FileText className="w-3 h-3" />;
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

export default ConvertToWorkModal;
