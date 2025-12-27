'use client';

// components/os/plans/PlansSection.tsx
// Combined Plans Section for Deliver page
//
// Displays Media Plan and Content Plan cards together with proper
// visibility rules and CTAs based on plansUiState selector.

import { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { PlanCard } from './PlanCard';
import {
  getPlansUIState,
  derivePlansState,
  type PlansDataInput,
  type PlansUIState,
} from '@/lib/os/ui/plansUiState';
import type { MediaPlan, ContentPlan } from '@/lib/types/plan';

// ============================================================================
// Types
// ============================================================================

interface PlansSectionProps {
  companyId: string;
  strategyId: string | null;
  /** Optional pre-loaded data (for SSR or parent-managed state) */
  initialData?: PlansDataInput;
  /** Show header with title */
  showHeader?: boolean;
}

interface FetchedPlansData {
  mediaPlan: MediaPlan | null;
  contentPlan: ContentPlan | null;
  mediaPlanStale: boolean;
  contentPlanStale: boolean;
  mediaPlanStalenessReason: string | null;
  contentPlanStalenessReason: string | null;
  mediaPlanPendingProposals: number;
  contentPlanPendingProposals: number;
}

// ============================================================================
// Component
// ============================================================================

export function PlansSection({
  companyId,
  strategyId,
  initialData,
  showHeader = true,
}: PlansSectionProps) {
  const [data, setData] = useState<PlansDataInput | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

  // Fetch plans data
  const fetchPlans = useCallback(async () => {
    if (!strategyId) {
      setData({
        strategyId: null,
        mediaPlan: null,
        contentPlan: null,
      });
      setLoading(false);
      return;
    }

    try {
      // Fetch both plans in parallel
      const [mediaResponse, contentResponse] = await Promise.all([
        fetch(`/api/os/companies/${companyId}/plans/media?strategyId=${strategyId}`),
        fetch(`/api/os/companies/${companyId}/plans/content?strategyId=${strategyId}`),
      ]);

      const mediaData = await mediaResponse.json();
      const contentData = await contentResponse.json();

      // Get the active plan from each list (first non-archived)
      const mediaPlan: MediaPlan | null = (mediaData.plans || []).find(
        (p: MediaPlan) => p.status !== 'archived'
      ) ?? null;
      const contentPlan: ContentPlan | null = (contentData.plans || []).find(
        (p: ContentPlan) => p.status !== 'archived'
      ) ?? null;

      // If we have plans, fetch their individual staleness info
      let fetchedData: FetchedPlansData = {
        mediaPlan,
        contentPlan,
        mediaPlanStale: false,
        contentPlanStale: false,
        mediaPlanStalenessReason: null,
        contentPlanStalenessReason: null,
        mediaPlanPendingProposals: 0,
        contentPlanPendingProposals: 0,
      };

      // Fetch staleness for each existing plan
      const stalenessPromises: Promise<void>[] = [];

      if (mediaPlan) {
        stalenessPromises.push(
          fetch(`/api/os/companies/${companyId}/plans/media/${mediaPlan.id}`)
            .then(r => r.json())
            .then(data => {
              fetchedData.mediaPlanStale = data.staleness?.isStale ?? false;
              fetchedData.mediaPlanStalenessReason = data.staleness?.reason ?? null;
              fetchedData.mediaPlanPendingProposals = data.pendingProposalCount ?? 0;
            })
            .catch(() => { /* ignore individual fetch errors */ })
        );
      }

      if (contentPlan) {
        stalenessPromises.push(
          fetch(`/api/os/companies/${companyId}/plans/content/${contentPlan.id}`)
            .then(r => r.json())
            .then(data => {
              fetchedData.contentPlanStale = data.staleness?.isStale ?? false;
              fetchedData.contentPlanStalenessReason = data.staleness?.reason ?? null;
              fetchedData.contentPlanPendingProposals = data.pendingProposalCount ?? 0;
            })
            .catch(() => { /* ignore individual fetch errors */ })
        );
      }

      await Promise.all(stalenessPromises);

      setData({
        strategyId,
        ...fetchedData,
      });
      setError(null);
    } catch (err) {
      console.error('[PlansSection] Error fetching plans:', err);
      setError(err instanceof Error ? err.message : 'Failed to load plans');
      setData({
        strategyId,
        mediaPlan: null,
        contentPlan: null,
      });
    } finally {
      setLoading(false);
    }
  }, [companyId, strategyId]);

  // Initial fetch
  useEffect(() => {
    if (!initialData) {
      fetchPlans();
    }
  }, [fetchPlans, initialData]);

  // Update when strategyId changes
  useEffect(() => {
    if (initialData) return; // Skip if controlled
    setLoading(true);
    fetchPlans();
  }, [strategyId, fetchPlans, initialData]);

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        {showHeader && (
          <h2 className="text-sm font-medium text-slate-400">Plans</h2>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-800 rounded-lg" />
              <div className="space-y-2">
                <div className="w-24 h-4 bg-slate-800 rounded" />
                <div className="w-32 h-3 bg-slate-800 rounded" />
              </div>
            </div>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-800 rounded-lg" />
              <div className="space-y-2">
                <div className="w-24 h-4 bg-slate-800 rounded" />
                <div className="w-32 h-3 bg-slate-800 rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-4">
        {showHeader && (
          <h2 className="text-sm font-medium text-slate-400">Plans</h2>
        )}
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      </div>
    );
  }

  // No data yet
  if (!data) {
    return null;
  }

  // Derive UI state
  const uiState = getPlansUIState(data, companyId);

  // Don't show section when blocked (no strategy)
  if (!uiState.showPlanCards) {
    return null;
  }

  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-400">Plans</h2>
          {/* Banner message when applicable */}
          {uiState.banner.tone !== 'status' && (
            <span className={`text-xs ${getBannerTextColor(uiState.banner.tone)}`}>
              {uiState.banner.title}
            </span>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <PlanCard
          companyId={companyId}
          planType="media"
          plan={uiState.mediaPlan}
          canCreate={uiState.showCreateMediaPlan}
          blockedReason={!uiState.showCreateMediaPlan ? 'Complete strategy first' : undefined}
        />
        <PlanCard
          companyId={companyId}
          planType="content"
          plan={uiState.contentPlan}
          canCreate={uiState.showCreateContentPlan}
          blockedReason={!uiState.showCreateContentPlan ? 'Complete strategy first' : undefined}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getBannerTextColor(tone: 'blocked' | 'ready' | 'warning' | 'status'): string {
  switch (tone) {
    case 'blocked':
      return 'text-red-400';
    case 'warning':
      return 'text-amber-400';
    case 'ready':
      return 'text-emerald-400';
    default:
      return 'text-slate-400';
  }
}

export default PlansSection;
