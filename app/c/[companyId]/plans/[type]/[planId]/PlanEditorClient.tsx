'use client';

// app/c/[companyId]/plans/[type]/[planId]/PlanEditorClient.tsx
// Plan Editor Client Component
//
// Handles editing for draft/in_review plans with autosave.
// Shows read-only view for approved/archived plans.

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  FileText,
  FileSpreadsheet,
  Check,
  Loader2,
  Send,
  AlertCircle,
  Clock,
  Archive,
  Sparkles,
  ArrowRightCircle,
  ExternalLink,
  RefreshCw,
  Package,
} from 'lucide-react';
import type { Plan, PlanType, MediaPlan, ContentPlan, MediaPlanSections, ContentPlanSections } from '@/lib/types/plan';
import { isPlanEditable, isPlanLocked, getStatusLabel, getStatusColor } from '@/lib/os/plans/planTransitions';
import { MediaPlanEditor } from '@/components/os/plans/editor/MediaPlanEditor';
import { ContentPlanEditor } from '@/components/os/plans/editor/ContentPlanEditor';
import { GenerateArtifactModal, type ArtifactSourceConfig } from '@/components/os/strategy/GenerateArtifactModal';
import { FEATURE_FLAGS } from '@/lib/config/featureFlags';

// ============================================================================
// Types
// ============================================================================

interface PlanEditorClientProps {
  companyId: string;
  companyName: string;
  planType: PlanType;
  plan: Plan;
  isStale: boolean;
  stalenessReason: string | null;
  pendingProposalCount: number;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// ============================================================================
// Main Component
// ============================================================================

export function PlanEditorClient({
  companyId,
  companyName,
  planType,
  plan: initialPlan,
  isStale,
  stalenessReason,
  pendingProposalCount,
}: PlanEditorClientProps) {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan>(initialPlan);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [converting, setConverting] = useState(false);
  const [showArtifactModal, setShowArtifactModal] = useState(false);

  // Track last saved snapshot to avoid unnecessary patches
  const lastSavedRef = useRef<string>(JSON.stringify(initialPlan.sections));
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isEditable = isPlanEditable(plan.status);
  const isLocked = isPlanLocked(plan.status);

  const typeLabel = planType === 'media' ? 'Media Plan' : 'Content Plan';
  const TypeIcon = planType === 'media' ? FileSpreadsheet : FileText;

  // Build artifact source config for this plan
  const artifactSource: ArtifactSourceConfig = planType === 'media'
    ? { type: 'plan:media', planId: plan.id }
    : { type: 'plan:content', planId: plan.id };

  // ============================================================================
  // Autosave
  // ============================================================================

  const saveSections = useCallback(async (sections: MediaPlanSections | ContentPlanSections) => {
    const newSnapshot = JSON.stringify(sections);

    // Skip if no changes
    if (newSnapshot === lastSavedRef.current) {
      return;
    }

    setSaveStatus('saving');
    setError(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/plans/${planType}/${plan.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sections }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      const data = await response.json();
      lastSavedRef.current = newSnapshot;
      setPlan(data.plan);
      setSaveStatus('saved');

      // Reset to idle after a bit
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('[PlanEditor] Save error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSaveStatus('error');
    }
  }, [companyId, planType, plan.id]);

  const debouncedSave = useCallback((sections: MediaPlanSections | ContentPlanSections) => {
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for debounced save
    saveTimeoutRef.current = setTimeout(() => {
      saveSections(sections);
    }, 800);
  }, [saveSections]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // ============================================================================
  // Section Change Handler
  // ============================================================================

  const handleSectionsChange = useCallback((sections: MediaPlanSections | ContentPlanSections) => {
    if (!isEditable) return;

    // Update local state immediately
    setPlan((prev) => ({ ...prev, sections } as Plan));

    // Trigger debounced save
    debouncedSave(sections);
  }, [isEditable, debouncedSave]);

  // ============================================================================
  // Actions
  // ============================================================================

  const handleSubmitForReview = useCallback(async () => {
    if (plan.status !== 'draft') return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/plans/${planType}/${plan.id}/submit`,
        { method: 'POST' }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || data.issues?.join(', ') || 'Failed to submit');
      }

      const data = await response.json();
      setPlan(data.plan);
      router.refresh();
    } catch (err) {
      console.error('[PlanEditor] Submit error:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  }, [companyId, planType, plan.id, plan.status, router]);

  const handleBackToDraft = useCallback(async () => {
    if (plan.status !== 'in_review') return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/plans/${planType}/${plan.id}/back-to-draft`,
        { method: 'POST' }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to return to draft');
      }

      const data = await response.json();
      setPlan(data.plan);
      router.refresh();
    } catch (err) {
      console.error('[PlanEditor] Back to draft error:', err);
      setError(err instanceof Error ? err.message : 'Failed to return to draft');
    } finally {
      setSubmitting(false);
    }
  }, [companyId, planType, plan.id, plan.status, router]);

  const handleGenerateUpdatedDraft = useCallback(async () => {
    if (plan.status !== 'approved') return;

    setGenerating(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/plans/${planType}/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'refresh',
            basePlanId: plan.id,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate updated draft');
      }

      const data = await response.json();

      // Navigate to the new draft plan
      router.push(`/c/${companyId}/plans/${planType}/${data.planId}`);
    } catch (err) {
      console.error('[PlanEditor] Generate error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setGenerating(false);
    }
  }, [companyId, planType, plan.id, plan.status, router]);

  const handleConvertToWork = useCallback(async () => {
    if (plan.status !== 'approved') return;

    setConverting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/plans/${planType}/${plan.id}/convert-to-work`,
        { method: 'POST' }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to convert to work');
      }

      // Navigate to work page
      router.push(`/c/${companyId}/work?source=heavy_plan&planId=${plan.id}`);
    } catch (err) {
      console.error('[PlanEditor] Convert error:', err);
      setError(err instanceof Error ? err.message : 'Failed to convert');
    } finally {
      setConverting(false);
    }
  }, [companyId, planType, plan.id, plan.status, router]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        {/* Back link */}
        <Link
          href={`/c/${companyId}/deliver`}
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-300 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Deliver
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          {/* Title + badges */}
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${plan.status === 'approved' ? 'bg-emerald-500/10' : plan.status === 'archived' ? 'bg-slate-600/10' : 'bg-slate-800'}`}>
              <TypeIcon className={`w-5 h-5 ${plan.status === 'approved' ? 'text-emerald-400' : plan.status === 'archived' ? 'text-slate-500' : 'text-slate-400'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-semibold text-slate-100">{typeLabel}</h1>
                <StatusBadge status={plan.status} version={plan.version} />
                {isStale && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium rounded border bg-amber-500/10 text-amber-400 border-amber-500/30">
                    Stale
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-400">
                {companyName} &middot; Updated {formatRelativeTime(plan.updatedAt)}
              </p>
            </div>
          </div>

          {/* Save status */}
          <div className="flex items-center gap-2">
            <SaveStatusIndicator status={saveStatus} />
          </div>
        </div>

        {/* Staleness warning */}
        {isStale && stalenessReason && (
          <div className="mt-4 flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-amber-300">{stalenessReason}</p>
              <p className="text-xs text-slate-400 mt-1">
                Consider generating an updated draft to reflect recent changes.
              </p>
            </div>
          </div>
        )}

        {/* Archived info */}
        {plan.status === 'archived' && (
          <div className="mt-4 flex items-start gap-2 p-3 bg-slate-700/30 border border-slate-600/50 rounded-lg">
            <Archive className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-slate-300">This plan is archived and cannot be edited.</p>
              {plan.archivedReason && (
                <p className="text-xs text-slate-500 mt-1">{plan.archivedReason}</p>
              )}
              {plan.supersededByPlanId && (
                <Link
                  href={`/c/${companyId}/plans/${planType}/${plan.supersededByPlanId}`}
                  className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 mt-1"
                >
                  View current version <ExternalLink className="w-3 h-3" />
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Read-only notice for approved */}
        {plan.status === 'approved' && (
          <div className="mt-4 flex items-start gap-2 p-3 bg-slate-700/30 border border-slate-600/50 rounded-lg">
            <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-slate-300">This plan is approved and locked.</p>
              <p className="text-xs text-slate-500 mt-1">
                To make changes, generate an updated draft for review.
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-2">
          {/* Pending proposals link */}
          {pendingProposalCount > 0 && (
            <Link
              href={`/c/${companyId}/deliver/proposals`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/10 transition-colors"
            >
              <Clock className="w-3.5 h-3.5" />
              {pendingProposalCount} proposal{pendingProposalCount !== 1 ? 's' : ''}
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Draft actions */}
          {plan.status === 'draft' && (
            <button
              onClick={handleSubmitForReview}
              disabled={submitting}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 rounded-lg transition-colors disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Submit for Review
            </button>
          )}

          {/* In review actions */}
          {plan.status === 'in_review' && (
            <button
              onClick={handleBackToDraft}
              disabled={submitting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 border border-slate-600/50 rounded-lg hover:bg-slate-700/50 transition-colors disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ArrowLeft className="w-3.5 h-3.5" />
              )}
              Back to Draft
            </button>
          )}

          {/* Approved actions */}
          {plan.status === 'approved' && (
            <>
              <button
                onClick={handleGenerateUpdatedDraft}
                disabled={generating}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                  isStale
                    ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                    : 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30'
                }`}
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isStale ? (
                  <RefreshCw className="w-4 h-4" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {isStale ? 'Update from Changes' : 'Generate Updated Draft'}
              </button>
              {FEATURE_FLAGS.ARTIFACTS_ENABLED && (
                <button
                  onClick={() => setShowArtifactModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 rounded-lg transition-colors"
                  title="Generate artifacts from this plan"
                >
                  <Package className="w-4 h-4" />
                  Artifacts
                </button>
              )}
              <button
                onClick={handleConvertToWork}
                disabled={converting}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 rounded-lg transition-colors disabled:opacity-50"
              >
                {converting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRightCircle className="w-4 h-4" />
                )}
                Convert to Work
              </button>
            </>
          )}
        </div>
      </div>

      {/* Plan Editor */}
      <div className="space-y-6">
        {planType === 'media' ? (
          <MediaPlanEditor
            sections={(plan as MediaPlan).sections}
            onChange={handleSectionsChange as (sections: MediaPlanSections) => void}
            readOnly={!isEditable}
          />
        ) : (
          <ContentPlanEditor
            sections={(plan as ContentPlan).sections}
            onChange={handleSectionsChange as (sections: ContentPlanSections) => void}
            readOnly={!isEditable}
          />
        )}
      </div>

      {/* Generate Artifact Modal */}
      {FEATURE_FLAGS.ARTIFACTS_ENABLED && (
        <GenerateArtifactModal
          isOpen={showArtifactModal}
          onClose={() => setShowArtifactModal(false)}
          companyId={companyId}
          source={artifactSource}
        />
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function StatusBadge({ status, version }: { status: string; version?: number }) {
  const label = status === 'approved' && version ? `v${version}` : getStatusLabel(status as any);
  const colorClass = getStatusColor(status as any);

  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${colorClass}`}>
      {label}
    </span>
  );
}

function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null;

  return (
    <div className="flex items-center gap-1.5 text-xs">
      {status === 'saving' && (
        <>
          <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
          <span className="text-slate-400">Saving...</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-emerald-400">Saved</span>
        </>
      )}
      {status === 'error' && (
        <>
          <AlertCircle className="w-3.5 h-3.5 text-red-400" />
          <span className="text-red-400">Save failed</span>
        </>
      )}
    </div>
  );
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

export default PlanEditorClient;
