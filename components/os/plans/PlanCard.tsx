'use client';

// components/os/plans/PlanCard.tsx
// Generic Plan Card for Media Plan and Content Plan display
//
// States:
// - not_created: Shows "Create Plan" button
// - draft: Shows "Continue Editing" + draft badge
// - in_review: Shows "Review" + awaiting approval badge
// - approved: Shows "Open" + up-to-date badge
// - stale: Shows "Open" + "Updates Available" badge + "Insert Updates" button

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  Plus,
  AlertCircle,
  CheckCircle,
  Loader2,
  Clock,
  Send,
  Edit3,
  ArrowRightCircle,
  Sparkles,
  Package,
} from 'lucide-react';
import type { PlanStatus, PlanType } from '@/lib/types/plan';
import type { PlanSummary } from '@/lib/os/ui/plansUiState';
import { GenerateArtifactModal, type ArtifactSourceConfig } from '@/components/os/strategy/GenerateArtifactModal';
import { ConvertToWorkModal } from '@/components/os/plans/ConvertToWorkModal';
import { FEATURE_FLAGS } from '@/lib/config/featureFlags';

// ============================================================================
// Types
// ============================================================================

interface PlanCardProps {
  companyId: string;
  planType: PlanType;
  /** Plan summary from selector, null if no plan exists */
  plan: PlanSummary | null;
  /** Callback when create button is clicked (if not using href) */
  onCreateClick?: () => void;
  /** Direct href for plan page */
  href?: string;
  /** Whether creation is allowed */
  canCreate?: boolean;
  /** Reason creation is blocked */
  blockedReason?: string;
  /** Loading state override */
  loading?: boolean;
  /** Callback when user wants to view the superseding plan */
  onViewSupersedingPlan?: (planId: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export function PlanCard({
  companyId,
  planType,
  plan,
  onCreateClick,
  href,
  canCreate = true,
  blockedReason,
  loading: loadingProp,
  onViewSupersedingPlan,
}: PlanCardProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showArtifactModal, setShowArtifactModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);

  const isLoading = loadingProp || creating || generating || updating;

  // Build artifact source config for this plan
  const artifactSource: ArtifactSourceConfig | undefined = plan
    ? planType === 'media'
      ? { type: 'plan:media', planId: plan.id }
      : { type: 'plan:content', planId: plan.id }
    : undefined;

  // Plan type display info
  const typeInfo = planType === 'media'
    ? { label: 'Media Plan', icon: FileSpreadsheet, description: 'Channel mix, budgets & campaigns' }
    : { label: 'Content Plan', icon: FileText, description: 'Content calendar & pillars' };

  const planHref = href ?? `/c/${companyId}/deliver/${planType}-plan`;

  // Derive card status - now includes archived for proper display
  const status: CardStatus = plan
    ? plan.status === 'archived'
      ? 'archived'
      : plan.isStale
        ? 'stale'
        : plan.status
    : 'not_created';

  // Handle create (manual - navigate to editor)
  const handleCreate = useCallback(async () => {
    if (onCreateClick) {
      onCreateClick();
      return;
    }

    setCreating(true);
    setError(null);
    try {
      // Navigate to plan builder (which will create if needed)
      router.push(planHref);
    } catch (err) {
      console.error(`[PlanCard] Error navigating to create:`, err);
      setError(err instanceof Error ? err.message : 'Failed to create');
      setCreating(false);
    }
  }, [onCreateClick, router, planHref]);

  // Handle AI generation
  const handleGenerateWithAI = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/plans/${planType}/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'create' }),
        }
      );
      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || data.message || 'Failed to generate plan');
      }

      // Navigate to the newly created plan
      if (data.plan?.id) {
        router.push(`/c/${companyId}/plans/${planType}/${data.plan.id}`);
      } else {
        router.push(planHref);
      }
    } catch (err) {
      console.error(`[PlanCard] Error generating plan:`, err);
      setError(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setGenerating(false);
    }
  }, [companyId, planType, planHref, router]);

  // Handle insert updates (regenerate proposal)
  const handleInsertUpdates = useCallback(async () => {
    if (!plan) return;

    setUpdating(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/plans/${planType}/${plan.id}/propose-updates`,
        { method: 'POST' }
      );
      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to generate updates');
      }

      // Navigate to plan with proposals to review
      router.push(`${planHref}?reviewProposals=true`);
    } catch (err) {
      console.error(`[PlanCard] Error generating proposals:`, err);
      setError(err instanceof Error ? err.message : 'Failed to generate updates');
    } finally {
      setUpdating(false);
    }
  }, [companyId, planType, plan, planHref, router]);

  // Handle convert to work items - opens modal for preview + artifact selection
  const handleConvertToWork = useCallback(() => {
    if (!plan) return;
    setShowConvertModal(true);
  }, [plan]);

  // Loading state
  if (loadingProp) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-800 rounded-lg">
            <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-300">{typeInfo.label}</p>
            <p className="text-xs text-slate-500">Loading...</p>
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
          <div className={`p-2 rounded-lg ${getIconStyle(status)}`}>
            {getStatusIcon(status, typeInfo.icon)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-slate-300">{typeInfo.label}</p>
              {plan && <StatusBadge status={status} version={plan.version} />}
            </div>
            <p className="text-xs text-slate-500">
              {getSubtitle(status, plan, typeInfo.description)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Error display */}
          {error && (
            <span className="text-xs text-red-400 mr-2">{error}</span>
          )}

          {/* Action buttons based on status */}
          {status === 'not_created' && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleGenerateWithAI}
                disabled={generating || !canCreate}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded-lg hover:bg-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title={canCreate ? `Generate ${typeInfo.label} with AI` : blockedReason}
              >
                {generating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                Generate
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !canCreate}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-700/50 text-slate-300 border border-slate-600/30 rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title={canCreate ? `Create blank ${typeInfo.label}` : blockedReason}
              >
                {creating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                Blank
              </button>
            </div>
          )}

          {status === 'draft' && (
            <a
              href={planHref}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-700/50 text-slate-300 border border-slate-600/30 rounded-lg hover:bg-slate-700 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Continue
            </a>
          )}

          {status === 'in_review' && (
            <a
              href={planHref}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              Review
            </a>
          )}

          {status === 'approved' && (
            <div className="flex items-center gap-2">
              <a
                href={planHref}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-700/50 text-slate-300 border border-slate-600/30 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open
              </a>
              {FEATURE_FLAGS.ARTIFACTS_ENABLED && (
                <button
                  onClick={() => setShowArtifactModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded-lg hover:bg-purple-500/20 transition-colors"
                  title="Generate artifacts from this plan"
                >
                  <Package className="w-3.5 h-3.5" />
                  Artifacts
                </button>
              )}
              <button
                onClick={handleConvertToWork}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/20 transition-colors"
                title="Create work items from this plan"
              >
                <ArrowRightCircle className="w-3.5 h-3.5" />
                To Work
              </button>
            </div>
          )}

          {status === 'stale' && (
            <div className="flex items-center gap-2">
              <a
                href={planHref}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-700/50 text-slate-300 border border-slate-600/30 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open
              </a>
              <button
                onClick={handleInsertUpdates}
                disabled={updating}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
              >
                {updating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Update
              </button>
            </div>
          )}

          {status === 'archived' && (
            <a
              href={planHref}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-700/50 text-slate-400 border border-slate-600/30 rounded-lg hover:bg-slate-700 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View
            </a>
          )}
        </div>
      </div>

      {/* Helper text - shows when not created */}
      {status === 'not_created' && (
        <p className="mt-3 text-xs text-slate-500">
          {typeInfo.description}
        </p>
      )}

      {/* Blocked reason */}
      {status === 'not_created' && !canCreate && blockedReason && (
        <div className="mt-2 flex items-start gap-2 text-xs text-amber-400/80">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{blockedReason}</span>
        </div>
      )}

      {/* Staleness reason */}
      {status === 'stale' && plan?.stalenessReason && (
        <div className="mt-2 flex items-start gap-2 text-xs text-amber-400/80">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{plan.stalenessReason}</span>
        </div>
      )}

      {/* Archived info - supersession link */}
      {status === 'archived' && plan && (
        <div className="mt-2 space-y-1">
          {plan.archivedReason && (
            <p className="text-xs text-slate-500">{plan.archivedReason}</p>
          )}
          {plan.supersededByPlanId && onViewSupersedingPlan && (
            <button
              onClick={() => onViewSupersedingPlan(plan.supersededByPlanId!)}
              className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
            >
              View current version
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Pending proposals badge */}
      {plan && plan.pendingProposalCount > 0 && (
        <div className="mt-2 flex items-center gap-2 text-xs text-blue-400">
          <Clock className="w-3.5 h-3.5" />
          <span>{plan.pendingProposalCount} pending proposal{plan.pendingProposalCount !== 1 ? 's' : ''}</span>
        </div>
      )}


      {/* Generate Artifact Modal */}
      {FEATURE_FLAGS.ARTIFACTS_ENABLED && artifactSource && (
        <GenerateArtifactModal
          isOpen={showArtifactModal}
          onClose={() => setShowArtifactModal(false)}
          companyId={companyId}
          source={artifactSource}
        />
      )}

      {/* Convert to Work Modal */}
      {plan && (
        <ConvertToWorkModal
          isOpen={showConvertModal}
          onClose={() => setShowConvertModal(false)}
          companyId={companyId}
          planId={plan.id}
          planType={planType}
          planVersion={plan.version}
        />
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface StatusBadgeProps {
  status: 'not_created' | 'draft' | 'in_review' | 'approved' | 'stale' | 'archived';
  version?: number;
}

function StatusBadge({ status, version }: StatusBadgeProps) {
  const config = {
    draft: { label: 'Draft', className: 'bg-slate-700/50 text-slate-300 border-slate-600/30' },
    in_review: { label: 'In Review', className: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
    approved: { label: version ? `v${version}` : 'Approved', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    stale: { label: 'Updates Available', className: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
    archived: { label: 'Archived', className: 'bg-slate-600/10 text-slate-500 border-slate-600/30' },
    not_created: null,
  };

  const badgeConfig = config[status];
  if (!badgeConfig) return null;

  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${badgeConfig.className}`}>
      {badgeConfig.label}
    </span>
  );
}

// ============================================================================
// Helpers
// ============================================================================

type CardStatus = 'not_created' | 'draft' | 'in_review' | 'approved' | 'stale' | 'archived';

function getStatusIcon(status: CardStatus, DefaultIcon: React.ComponentType<{ className?: string }>) {
  switch (status) {
    case 'approved':
      return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    case 'stale':
      return <AlertCircle className="w-4 h-4 text-amber-400" />;
    case 'in_review':
      return <Clock className="w-4 h-4 text-amber-400" />;
    case 'draft':
      return <Edit3 className="w-4 h-4 text-slate-400" />;
    case 'archived':
      return <FileText className="w-4 h-4 text-slate-500" />;
    default:
      return <DefaultIcon className="w-4 h-4 text-slate-400" />;
  }
}

function getIconStyle(status: CardStatus) {
  switch (status) {
    case 'approved':
      return 'bg-emerald-500/10';
    case 'stale':
    case 'in_review':
      return 'bg-amber-500/10';
    case 'archived':
      return 'bg-slate-600/10';
    default:
      return 'bg-slate-800';
  }
}

function getSubtitle(
  status: CardStatus,
  plan: PlanSummary | null,
  defaultDescription: string
): string {
  switch (status) {
    case 'not_created':
      return defaultDescription;
    case 'draft':
      return 'Draft in progress';
    case 'in_review':
      return 'Awaiting approval';
    case 'approved':
      return plan?.updatedAt
        ? `Approved ${formatRelativeTime(plan.updatedAt)}`
        : 'Approved';
    case 'stale':
      return 'Strategy or context has changed';
    case 'archived':
      return plan?.archivedAt
        ? `Archived ${formatRelativeTime(plan.archivedAt)}`
        : 'Archived';
    default:
      return defaultDescription;
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

export default PlanCard;
