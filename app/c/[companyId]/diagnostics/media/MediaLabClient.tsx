'use client';

// app/c/[companyId]/diagnostics/media/MediaLabClient.tsx
// Client-side Media Lab with editable UI for plans, channels, and flights

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ContextHealthBadge } from '@/components/os/ContextHealthBadge';
import type { PerformanceSnapshot } from '@/lib/mediaLab/analytics';
import {
  type MediaPlanWithDetails,
  type MediaPlanChannel,
  type MediaPlanFlight,
  type MediaPlanStatus,
  type MediaObjective,
  type MediaChannelKey,
  type MediaChannelPriority,
  type MediaFlightSeason,
  type MediaFlightStatus,
  formatMediaBudget,
  formatDateRange,
  getChannelLabel,
  MEDIA_CHANNEL_LABELS,
  MEDIA_CHANNEL_COLORS,
  MEDIA_PLAN_STATUS_CONFIG,
  MEDIA_OBJECTIVE_CONFIG,
  MEDIA_PRIORITY_CONFIG,
  MEDIA_SEASON_CONFIG,
  MEDIA_FLIGHT_STATUS_CONFIG,
} from '@/lib/types/mediaLab';
import {
  type MediaProvider,
  type MediaDataSourceType,
  MEDIA_PROVIDER_OPTIONS,
  MEDIA_PROVIDER_CONFIG,
  MEDIA_DATASOURCE_OPTIONS,
  MEDIA_DATASOURCE_CONFIG,
} from '@/lib/types/media';
import { PlanningWorkspace } from '@/components/mediaLab/PlanningWorkspace';

// ============================================================================
// Types
// ============================================================================

interface MediaLabClientProps {
  companyId: string;
  companyName: string;
  initialPlans: MediaPlanWithDetails[];
  initialSelectedPlanId?: string;
}

interface Toast {
  message: string;
  type: 'success' | 'error';
}

// ============================================================================
// Main Component
// ============================================================================

export function MediaLabClient({
  companyId,
  companyName,
  initialPlans,
  initialSelectedPlanId,
}: MediaLabClientProps) {
  const router = useRouter();

  // State
  const [plans, setPlans] = useState<MediaPlanWithDetails[]>(initialPlans);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(
    initialSelectedPlanId || (initialPlans.length > 0 ? initialPlans[0].id : null)
  );
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingWork, setIsGeneratingWork] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [performanceSnapshot, setPerformanceSnapshot] = useState<PerformanceSnapshot | null>(null);
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false);
  const [showPlanningWorkspace, setShowPlanningWorkspace] = useState(false);
  const [showNewPlanMenu, setShowNewPlanMenu] = useState(false);

  // Derived state
  const selectedPlan = plans.find(p => p.id === selectedPlanId) || null;

  // Toast helper
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  // Fetch performance snapshot
  useEffect(() => {
    const fetchSnapshot = async () => {
      setIsLoadingSnapshot(true);
      try {
        const res = await fetch(`/api/os/media-lab/analytics?companyId=${companyId}&mode=snapshot`);
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setPerformanceSnapshot(data.snapshot);
          }
        }
      } catch (error) {
        console.error('Failed to fetch performance snapshot:', error);
      } finally {
        setIsLoadingSnapshot(false);
      }
    };
    fetchSnapshot();
  }, [companyId]);

  // ============================================================================
  // Plan CRUD
  // ============================================================================

  const handleCreatePlan = async () => {
    setIsCreatingPlan(true);
    try {
      const res = await fetch('/api/os/media-lab/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          name: `${companyName} Media Plan`,
          objective: 'leads',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create plan');
      }

      const data = await res.json();
      const newPlan: MediaPlanWithDetails = {
        ...data.plan,
        channels: [],
        flights: [],
      };

      setPlans(prev => [...prev, newPlan]);
      setSelectedPlanId(newPlan.id);
      showToast('Media plan created', 'success');
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to create plan', 'error');
    } finally {
      setIsCreatingPlan(false);
    }
  };

  const handleUpdatePlan = async (planId: string, updates: Partial<MediaPlanWithDetails>) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/os/media-lab/plans/${planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update plan');
      }

      const data = await res.json();
      setPlans(prev =>
        prev.map(p =>
          p.id === planId ? { ...p, ...data.plan } : p
        )
      );
      showToast('Plan updated', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update plan', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm('Delete this media plan? This cannot be undone.')) return;

    try {
      const res = await fetch(`/api/os/media-lab/plans/${planId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete plan');
      }

      setPlans(prev => prev.filter(p => p.id !== planId));
      if (selectedPlanId === planId) {
        setSelectedPlanId(plans[0]?.id || null);
      }
      showToast('Plan deleted', 'success');
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to delete plan', 'error');
    }
  };

  // ============================================================================
  // Channel CRUD
  // ============================================================================

  const handleAddChannel = async (planId: string, channel: MediaChannelKey) => {
    try {
      const res = await fetch('/api/os/media-lab/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaPlanId: planId, channel }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add channel');
      }

      const data = await res.json();
      setPlans(prev =>
        prev.map(p =>
          p.id === planId
            ? { ...p, channels: [...p.channels, data.channel] }
            : p
        )
      );
      showToast('Channel added', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to add channel', 'error');
    }
  };

  const handleUpdateChannel = async (
    planId: string,
    channelId: string,
    updates: Partial<MediaPlanChannel>
  ) => {
    try {
      const res = await fetch(`/api/os/media-lab/channels/${channelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update channel');
      }

      const data = await res.json();
      setPlans(prev =>
        prev.map(p =>
          p.id === planId
            ? {
                ...p,
                channels: p.channels.map(ch =>
                  ch.id === channelId ? { ...ch, ...data.channel } : ch
                ),
              }
            : p
        )
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update channel', 'error');
    }
  };

  const handleDeleteChannel = async (planId: string, channelId: string) => {
    try {
      const res = await fetch(`/api/os/media-lab/channels/${channelId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete channel');
      }

      setPlans(prev =>
        prev.map(p =>
          p.id === planId
            ? { ...p, channels: p.channels.filter(ch => ch.id !== channelId) }
            : p
        )
      );
      showToast('Channel removed', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to delete channel', 'error');
    }
  };

  // ============================================================================
  // Flight CRUD
  // ============================================================================

  const handleAddFlight = async (planId: string) => {
    try {
      const res = await fetch('/api/os/media-lab/flights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaPlanId: planId,
          name: 'New Flight',
          season: 'other',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add flight');
      }

      const data = await res.json();
      setPlans(prev =>
        prev.map(p =>
          p.id === planId
            ? { ...p, flights: [...p.flights, data.flight] }
            : p
        )
      );
      showToast('Flight added', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to add flight', 'error');
    }
  };

  const handleUpdateFlight = async (
    planId: string,
    flightId: string,
    updates: Partial<MediaPlanFlight>
  ) => {
    try {
      const res = await fetch(`/api/os/media-lab/flights/${flightId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update flight');
      }

      const data = await res.json();
      setPlans(prev =>
        prev.map(p =>
          p.id === planId
            ? {
                ...p,
                flights: p.flights.map(fl =>
                  fl.id === flightId ? { ...fl, ...data.flight } : fl
                ),
              }
            : p
        )
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update flight', 'error');
    }
  };

  const handleDeleteFlight = async (planId: string, flightId: string) => {
    try {
      const res = await fetch(`/api/os/media-lab/flights/${flightId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete flight');
      }

      setPlans(prev =>
        prev.map(p =>
          p.id === planId
            ? { ...p, flights: p.flights.filter(fl => fl.id !== flightId) }
            : p
        )
      );
      showToast('Flight removed', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to delete flight', 'error');
    }
  };

  // ============================================================================
  // Work Item Generation
  // ============================================================================

  const handleGenerateWorkItems = async () => {
    if (!selectedPlan) return;

    setIsGeneratingWork(true);
    try {
      const res = await fetch(`/api/os/media-lab/plans/${selectedPlan.id}/generate-work`, {
        method: 'POST',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to generate work items');
      }

      const data = await res.json();
      showToast(`Created ${data.count} work items`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to generate work items', 'error');
    } finally {
      setIsGeneratingWork(false);
    }
  };

  // ============================================================================
  // Plan Promotion
  // ============================================================================

  const handlePromoteToProgram = async () => {
    if (!selectedPlan) return;

    setIsPromoting(true);
    try {
      const { promotePlanToProgramAction } = await import('./actions');
      const result = await promotePlanToProgramAction({
        companyId,
        mediaPlanId: selectedPlan.id,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      showToast('Plan promoted to program!', 'success');
      // Redirect to the review & activate page
      router.push(`/c/${companyId}/media/program?programId=${result.programId}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to promote plan', 'error');
    } finally {
      setIsPromoting(false);
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="min-h-screen bg-[#050509]">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border ${
            toast.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          {toast.message}
        </div>
      )}

      <PageHeader companyId={companyId} companyName={companyName} />

      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* Top Bar: Plan Selector + New Plan Button */}
        <div className="flex items-center justify-between mb-6">
          {plans.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {plans.map(plan => {
                const isSelected = plan.id === selectedPlanId;
                const statusConfig = MEDIA_PLAN_STATUS_CONFIG[plan.status];
                return (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-sm
                      ${isSelected
                        ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                        : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                      }
                    `}
                  >
                    <span className="font-medium">{plan.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusConfig.bgColor} ${statusConfig.color} ${statusConfig.borderColor} border`}>
                      {statusConfig.label}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div />
          )}

          <div className="relative">
            <button
              onClick={() => setShowNewPlanMenu(!showNewPlanMenu)}
              disabled={isCreatingPlan}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium text-sm transition-colors disabled:opacity-50"
            >
              {isCreatingPlan ? (
                <span>Creating...</span>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Media Plan
                  <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </>
              )}
            </button>
            {showNewPlanMenu && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl bg-slate-800 border border-slate-700 shadow-xl z-20 overflow-hidden">
                <button
                  onClick={() => {
                    setShowNewPlanMenu(false);
                    setShowPlanningWorkspace(true);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-slate-700/50 transition-colors border-b border-slate-700/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                      <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">Planning Assistant</p>
                      <p className="text-xs text-slate-500">Use playbooks & AI recommendations</p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setShowNewPlanMenu(false);
                    handleCreatePlan();
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center">
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">Blank Plan</p>
                      <p className="text-xs text-slate-500">Start from scratch</p>
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Empty State */}
        {plans.length === 0 && (
          <EmptyState companyName={companyName} />
        )}

        {/* Selected Plan */}
        {selectedPlan && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* LEFT COLUMN */}
            <div className="space-y-6">
              <PlanOverviewCard
                plan={selectedPlan}
                onUpdate={(updates) => handleUpdatePlan(selectedPlan.id, updates)}
                onDelete={() => handleDeletePlan(selectedPlan.id)}
                isSaving={isSaving}
              />
              <ChannelMixCard
                plan={selectedPlan}
                onAddChannel={(channel) => handleAddChannel(selectedPlan.id, channel)}
                onUpdateChannel={(channelId, updates) =>
                  handleUpdateChannel(selectedPlan.id, channelId, updates)
                }
                onDeleteChannel={(channelId) =>
                  handleDeleteChannel(selectedPlan.id, channelId)
                }
              />
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-6">
              <SeasonalFlightsCard
                plan={selectedPlan}
                onAddFlight={() => handleAddFlight(selectedPlan.id)}
                onUpdateFlight={(flightId, updates) =>
                  handleUpdateFlight(selectedPlan.id, flightId, updates)
                }
                onDeleteFlight={(flightId) =>
                  handleDeleteFlight(selectedPlan.id, flightId)
                }
              />
              <MarketsCard
                plan={selectedPlan}
                onUpdate={(markets) =>
                  handleUpdatePlan(selectedPlan.id, { primaryMarkets: markets })
                }
              />
              <PerformanceSnapshotCard
                companyId={companyId}
                snapshot={performanceSnapshot}
                isLoading={isLoadingSnapshot}
              />
              <CompareAgainstPlanCard
                plan={selectedPlan}
                snapshot={performanceSnapshot}
              />
              <NextStepsCard
                companyId={companyId}
                plan={selectedPlan}
              />
              <ActionsCard
                companyId={companyId}
                plan={selectedPlan}
                onGenerateWork={handleGenerateWorkItems}
                isGeneratingWork={isGeneratingWork}
                onPromoteToProgram={handlePromoteToProgram}
                isPromoting={isPromoting}
              />
            </div>
          </div>
        )}
      </div>

      {/* Planning Workspace Modal */}
      {showPlanningWorkspace && (
        <div className="fixed inset-0 bg-black/80 z-50 overflow-auto">
          <div className="min-h-screen py-8 px-4">
            <div className="mx-auto max-w-5xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-200">
                  Media Planning Assistant
                </h2>
                <button
                  onClick={() => setShowPlanningWorkspace(false)}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <PlanningWorkspace
                companyId={companyId}
                companyName={companyName}
                onSavePlan={async () => {
                  showToast('Media plan created from playbook', 'success');
                  setShowPlanningWorkspace(false);
                  router.refresh();
                }}
                onClose={() => setShowPlanningWorkspace(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Header Component
// ============================================================================

function PageHeader({ companyId, companyName: _companyName }: { companyId: string; companyName: string }) {
  return (
    <div className="border-b border-slate-800 bg-slate-900/50">
      <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/c/${companyId}/blueprint`}
            className="text-sm text-slate-400 hover:text-slate-300"
          >
            ← Back to Blueprint
          </Link>
          <span className="text-slate-600">|</span>
          <h1 className="text-sm font-medium text-slate-300">
            Media Lab
          </h1>
          <span className="text-slate-600">|</span>
          <ContextHealthBadge companyId={companyId} />
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/c/${companyId}/diagnostics/media?mode=planner`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            AI Planner
          </Link>
          <Link
            href={`/c/${companyId}/diagnostics/media?mode=creative`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-400 bg-purple-500/10 border border-purple-500/30 rounded-lg hover:bg-purple-500/20 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
            Creative Lab
          </Link>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState({ companyName }: { companyName: string }) {
  return (
    <div className="text-center py-16">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 mb-6">
        <svg className="h-8 w-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-slate-200 mb-2">
        No Media Plans for {companyName}
      </h2>
      <p className="text-sm text-slate-400 max-w-md mx-auto mb-8">
        Click "New Media Plan" above to create your first media plan and define objectives, budget, and channel mix.
      </p>
    </div>
  );
}

// ============================================================================
// Plan Overview Card (Editable)
// ============================================================================

function PlanOverviewCard({
  plan,
  onUpdate,
  onDelete,
  isSaving,
}: {
  plan: MediaPlanWithDetails;
  onUpdate: (updates: Partial<MediaPlanWithDetails>) => void;
  onDelete: () => void;
  isSaving: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(plan.name);
  const [editedStatus, setEditedStatus] = useState(plan.status);
  const [editedObjective, setEditedObjective] = useState(plan.objective);
  const [editedBudget, setEditedBudget] = useState(plan.totalBudget?.toString() || '');
  const [editedStartDate, setEditedStartDate] = useState(plan.timeframeStart || '');
  const [editedEndDate, setEditedEndDate] = useState(plan.timeframeEnd || '');
  const [editedNotes, setEditedNotes] = useState(plan.notes || '');

  const statusConfig = MEDIA_PLAN_STATUS_CONFIG[plan.status];
  const objectiveConfig = MEDIA_OBJECTIVE_CONFIG[plan.objective];

  const handleSave = () => {
    onUpdate({
      name: editedName,
      status: editedStatus,
      objective: editedObjective,
      totalBudget: editedBudget ? parseFloat(editedBudget) : null,
      timeframeStart: editedStartDate || null,
      timeframeEnd: editedEndDate || null,
      notes: editedNotes || null,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedName(plan.name);
    setEditedStatus(plan.status);
    setEditedObjective(plan.objective);
    setEditedBudget(plan.totalBudget?.toString() || '');
    setEditedStartDate(plan.timeframeStart || '');
    setEditedEndDate(plan.timeframeEnd || '');
    setEditedNotes(plan.notes || '');
    setIsEditing(false);
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Media Plan Overview
          </p>
          {isEditing ? (
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              className="text-lg font-semibold text-slate-100 bg-slate-800 border border-slate-700 rounded px-2 py-1 w-full"
            />
          ) : (
            <h2 className="text-lg font-semibold text-slate-100">{plan.name}</h2>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <select
              value={editedStatus}
              onChange={(e) => setEditedStatus(e.target.value as MediaPlanStatus)}
              className="text-xs px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300"
            >
              {Object.entries(MEDIA_PLAN_STATUS_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          ) : (
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusConfig.bgColor} ${statusConfig.color} ${statusConfig.borderColor}`}>
              {statusConfig.label}
            </span>
          )}
        </div>
      </div>

      {/* Objective */}
      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Objective</p>
        {isEditing ? (
          <select
            value={editedObjective}
            onChange={(e) => setEditedObjective(e.target.value as MediaObjective)}
            className="text-sm px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300"
          >
            {Object.entries(MEDIA_OBJECTIVE_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
        ) : (
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-slate-700 bg-slate-800/50 ${objectiveConfig.color}`}>
            {objectiveConfig.label}
          </span>
        )}
      </div>

      {/* Markets (read-only in this card, editable in MarketsCard) */}
      {plan.primaryMarkets && !isEditing && (
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Primary Markets</p>
          <p className="text-sm text-slate-300">{plan.primaryMarkets}</p>
        </div>
      )}

      {/* Budget & Timeframe */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Total Budget</p>
          {isEditing ? (
            <input
              type="number"
              value={editedBudget}
              onChange={(e) => setEditedBudget(e.target.value)}
              placeholder="0"
              className="w-full text-sm px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300"
            />
          ) : (
            <p className="text-xl font-bold text-emerald-400 tabular-nums">
              {formatMediaBudget(plan.totalBudget)}
            </p>
          )}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Timeframe</p>
          {isEditing ? (
            <div className="flex gap-2">
              <input
                type="date"
                value={editedStartDate}
                onChange={(e) => setEditedStartDate(e.target.value)}
                className="text-xs px-1 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300"
              />
              <input
                type="date"
                value={editedEndDate}
                onChange={(e) => setEditedEndDate(e.target.value)}
                className="text-xs px-1 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300"
              />
            </div>
          ) : (
            <p className="text-sm text-slate-300">
              {formatDateRange(plan.timeframeStart, plan.timeframeEnd)}
            </p>
          )}
        </div>
      </div>

      {/* Notes */}
      {(plan.notes || isEditing) && (
        <div className="mt-4 pt-4 border-t border-slate-800">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Strategy Notes</p>
          {isEditing ? (
            <textarea
              value={editedNotes}
              onChange={(e) => setEditedNotes(e.target.value)}
              rows={3}
              className="w-full text-xs px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-400"
            />
          ) : (
            <p className="text-xs text-slate-400 whitespace-pre-wrap">{plan.notes}</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
        {isEditing ? (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-3 py-1.5 text-xs font-medium rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-xs font-medium rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="px-3 py-1.5 text-xs font-medium rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
          >
            Edit Plan
          </button>
        )}
        <button
          onClick={onDelete}
          className="px-3 py-1.5 text-xs font-medium rounded text-red-400 hover:bg-red-500/10"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Channel Mix Card (Editable)
// ============================================================================

function ChannelMixCard({
  plan,
  onAddChannel,
  onUpdateChannel,
  onDeleteChannel,
}: {
  plan: MediaPlanWithDetails;
  onAddChannel: (channel: MediaChannelKey) => void;
  onUpdateChannel: (channelId: string, updates: Partial<MediaPlanChannel>) => void;
  onDeleteChannel: (channelId: string) => void;
}) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const { channels } = plan;

  // Channels not yet in the plan
  const availableChannels = (Object.keys(MEDIA_CHANNEL_LABELS) as MediaChannelKey[]).filter(
    ch => !channels.some(c => c.channel === ch)
  );

  // Calculate total for percentage display
  const totalBudget = plan.totalBudget || channels.reduce((sum, ch) => sum + (ch.budgetAmount || 0), 0);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Channel Mix & Budget
        </p>
        <div className="relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Channel
          </button>
          {showAddMenu && availableChannels.length > 0 && (
            <div className="absolute right-0 mt-1 w-48 rounded-lg bg-slate-800 border border-slate-700 shadow-lg z-10">
              {availableChannels.map(ch => {
                const colors = MEDIA_CHANNEL_COLORS[ch];
                return (
                  <button
                    key={ch}
                    onClick={() => {
                      onAddChannel(ch);
                      setShowAddMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-700 first:rounded-t-lg last:rounded-b-lg"
                  >
                    <span className={colors.text}>{getChannelLabel(ch)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {channels.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-slate-400">No channels defined yet.</p>
          <p className="text-xs text-slate-500 mt-1">Click "Add Channel" to get started</p>
        </div>
      ) : (
        <>
          {/* Visual Bar */}
          {totalBudget > 0 && (
            <div className="h-6 rounded-lg overflow-hidden flex mb-4 bg-slate-800">
              {channels.map(ch => {
                const pct = ch.budgetAmount ? (ch.budgetAmount / totalBudget) * 100 : (ch.budgetSharePct || 0);
                if (pct < 1) return null;
                const colors = MEDIA_CHANNEL_COLORS[ch.channel];
                return (
                  <div
                    key={ch.id}
                    className={`${colors.bg.replace('/10', '/50')} flex items-center justify-center transition-all border-r border-slate-900/50 last:border-r-0`}
                    style={{ width: `${pct}%` }}
                    title={`${getChannelLabel(ch.channel)}: ${formatMediaBudget(ch.budgetAmount)} (${pct.toFixed(1)}%)`}
                  >
                    {pct > 15 && (
                      <span className="text-[10px] font-medium text-white/80 truncate px-1">
                        {getChannelLabel(ch.channel).split(' ')[0]}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Channel Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left py-2 text-[10px] uppercase tracking-wider text-slate-500 font-medium">Channel</th>
                  <th className="text-left py-2 text-[10px] uppercase tracking-wider text-slate-500 font-medium">Provider</th>
                  <th className="text-left py-2 text-[10px] uppercase tracking-wider text-slate-500 font-medium">Source</th>
                  <th className="text-right py-2 text-[10px] uppercase tracking-wider text-slate-500 font-medium">Budget %</th>
                  <th className="text-right py-2 text-[10px] uppercase tracking-wider text-slate-500 font-medium">$ Budget</th>
                  <th className="text-right py-2 text-[10px] uppercase tracking-wider text-slate-500 font-medium">Expected Vol</th>
                  <th className="text-right py-2 text-[10px] uppercase tracking-wider text-slate-500 font-medium">Est. CPL</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {channels.map(ch => (
                  <EditableChannelRow
                    key={ch.id}
                    channel={ch}
                    onUpdate={(updates) => onUpdateChannel(ch.id, updates)}
                    onDelete={() => onDeleteChannel(ch.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function EditableChannelRow({
  channel,
  onUpdate,
  onDelete,
}: {
  channel: MediaPlanChannel;
  onUpdate: (updates: Partial<MediaPlanChannel>) => void;
  onDelete: () => void;
}) {
  const colors = MEDIA_CHANNEL_COLORS[channel.channel];
  const priorityConfig = channel.priority ? MEDIA_PRIORITY_CONFIG[channel.priority] : null;
  const providerConfig = channel.provider ? MEDIA_PROVIDER_CONFIG[channel.provider] : null;
  const dataSourceConfig = channel.dataSourceType ? MEDIA_DATASOURCE_CONFIG[channel.dataSourceType] : null;

  const [_isEditing, setIsEditing] = useState(false);
  const [budgetPct, setBudgetPct] = useState(channel.budgetSharePct?.toString() || '');
  const [budgetAmt, setBudgetAmt] = useState(channel.budgetAmount?.toString() || '');
  const [expectedVol, setExpectedVol] = useState(channel.expectedVolume?.toString() || '');
  const [expectedCpl, setExpectedCpl] = useState(channel.expectedCpl?.toString() || '');

  const handleBlur = () => {
    onUpdate({
      budgetSharePct: budgetPct ? parseFloat(budgetPct) : null,
      budgetAmount: budgetAmt ? parseFloat(budgetAmt) : null,
      expectedVolume: expectedVol ? parseInt(expectedVol, 10) : null,
      expectedCpl: expectedCpl ? parseFloat(expectedCpl) : null,
    });
    setIsEditing(false);
  };

  return (
    <tr className="hover:bg-slate-800/30 transition-colors group">
      {/* Channel name with priority */}
      <td className="py-2.5">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors.text} ${colors.bg} border ${colors.border}`}>
            {getChannelLabel(channel.channel)}
          </span>
          {priorityConfig && (
            <select
              value={channel.priority || ''}
              onChange={(e) => onUpdate({ priority: e.target.value as MediaChannelPriority || null })}
              className="text-[10px] bg-transparent border-none text-slate-400 cursor-pointer hover:text-slate-300"
            >
              <option value="">—</option>
              {Object.entries(MEDIA_PRIORITY_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          )}
          {!priorityConfig && (
            <select
              value=""
              onChange={(e) => onUpdate({ priority: e.target.value as MediaChannelPriority })}
              className="text-[10px] bg-transparent border-none text-slate-500 cursor-pointer hover:text-slate-400 opacity-0 group-hover:opacity-100"
            >
              <option value="">Set priority</option>
              {Object.entries(MEDIA_PRIORITY_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          )}
        </div>
      </td>
      {/* Provider selector */}
      <td className="py-2.5">
        <select
          value={channel.provider || ''}
          onChange={(e) => onUpdate({ provider: (e.target.value || undefined) as MediaProvider | undefined })}
          className={`text-[10px] bg-transparent border-none cursor-pointer ${providerConfig ? providerConfig.color : 'text-slate-500'}`}
        >
          <option value="">—</option>
          {MEDIA_PROVIDER_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </td>
      {/* Data source type selector */}
      <td className="py-2.5">
        <select
          value={channel.dataSourceType || ''}
          onChange={(e) => onUpdate({ dataSourceType: (e.target.value || undefined) as MediaDataSourceType | undefined })}
          className={`text-[10px] bg-transparent border-none cursor-pointer ${dataSourceConfig ? dataSourceConfig.color : 'text-slate-500'}`}
        >
          <option value="">—</option>
          {MEDIA_DATASOURCE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </td>
      {/* Budget % */}
      <td className="py-2.5 text-right">
        <input
          type="number"
          value={budgetPct}
          onChange={(e) => setBudgetPct(e.target.value)}
          onBlur={handleBlur}
          onFocus={() => setIsEditing(true)}
          placeholder="—"
          className="w-16 text-right text-slate-300 tabular-nums bg-transparent border-b border-transparent hover:border-slate-600 focus:border-slate-500 focus:outline-none"
        />
        {budgetPct && <span className="text-slate-500">%</span>}
      </td>
      {/* Budget $ */}
      <td className="py-2.5 text-right">
        <input
          type="number"
          value={budgetAmt}
          onChange={(e) => setBudgetAmt(e.target.value)}
          onBlur={handleBlur}
          onFocus={() => setIsEditing(true)}
          placeholder="—"
          className="w-24 text-right text-slate-200 tabular-nums font-medium bg-transparent border-b border-transparent hover:border-slate-600 focus:border-slate-500 focus:outline-none"
        />
      </td>
      {/* Expected volume */}
      <td className="py-2.5 text-right">
        <input
          type="number"
          value={expectedVol}
          onChange={(e) => setExpectedVol(e.target.value)}
          onBlur={handleBlur}
          onFocus={() => setIsEditing(true)}
          placeholder="—"
          className="w-20 text-right text-slate-400 tabular-nums bg-transparent border-b border-transparent hover:border-slate-600 focus:border-slate-500 focus:outline-none"
        />
      </td>
      {/* Est. CPL */}
      <td className="py-2.5 text-right">
        <input
          type="number"
          value={expectedCpl}
          onChange={(e) => setExpectedCpl(e.target.value)}
          onBlur={handleBlur}
          onFocus={() => setIsEditing(true)}
          placeholder="—"
          className="w-16 text-right text-slate-400 tabular-nums bg-transparent border-b border-transparent hover:border-slate-600 focus:border-slate-500 focus:outline-none"
        />
      </td>
      {/* Delete button */}
      <td className="py-2.5">
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 p-1"
          title="Remove channel"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </td>
    </tr>
  );
}

// ============================================================================
// Seasonal Flights Card (Editable)
// ============================================================================

function SeasonalFlightsCard({
  plan,
  onAddFlight,
  onUpdateFlight,
  onDeleteFlight,
}: {
  plan: MediaPlanWithDetails;
  onAddFlight: () => void;
  onUpdateFlight: (flightId: string, updates: Partial<MediaPlanFlight>) => void;
  onDeleteFlight: (flightId: string) => void;
}) {
  const { flights } = plan;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Seasonal Flights
        </p>
        <button
          onClick={onAddFlight}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Flight
        </button>
      </div>

      {flights.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-slate-400">No seasonal flights defined.</p>
          <p className="text-xs text-slate-500 mt-1">Add flights for seasonal campaigns</p>
        </div>
      ) : (
        <div className="space-y-3">
          {flights.map(flight => (
            <EditableFlightRow
              key={flight.id}
              flight={flight}
              plan={plan}
              onUpdate={(updates) => onUpdateFlight(flight.id, updates)}
              onDelete={() => onDeleteFlight(flight.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EditableFlightRow({
  flight,
  plan: _plan,
  onUpdate,
  onDelete,
}: {
  flight: MediaPlanFlight;
  plan: MediaPlanWithDetails;
  onUpdate: (updates: Partial<MediaPlanFlight>) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(flight.name);
  const [status, setStatus] = useState<MediaFlightStatus>(flight.status || 'upcoming');
  const [season, setSeason] = useState(flight.season || 'other');
  const [startDate, setStartDate] = useState(flight.startDate || '');
  const [endDate, setEndDate] = useState(flight.endDate || '');
  const [budget, setBudget] = useState(flight.budget?.toString() || '');
  const [actualSpent, setActualSpent] = useState(flight.actualBudgetSpent?.toString() || '');
  const [actualLeads, setActualLeads] = useState(flight.actualLeads?.toString() || '');
  const [leadGoal, setLeadGoal] = useState(flight.leadGoal?.toString() || '');
  const [markets, setMarkets] = useState(flight.marketsStores || '');

  const seasonConfig = flight.season ? MEDIA_SEASON_CONFIG[flight.season] : null;
  const statusConfig = flight.status ? MEDIA_FLIGHT_STATUS_CONFIG[flight.status] : MEDIA_FLIGHT_STATUS_CONFIG.upcoming;

  const handleSave = () => {
    onUpdate({
      name,
      status,
      season: season as MediaFlightSeason,
      startDate: startDate || null,
      endDate: endDate || null,
      budget: budget ? parseFloat(budget) : null,
      actualBudgetSpent: actualSpent ? parseFloat(actualSpent) : null,
      actualLeads: actualLeads ? parseInt(actualLeads, 10) : null,
      leadGoal: leadGoal ? parseInt(leadGoal, 10) : null,
      marketsStores: markets || null,
    });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-sm px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as MediaFlightStatus)}
              className="w-full text-sm px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300"
            >
              {Object.entries(MEDIA_FLIGHT_STATUS_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Season</label>
            <select
              value={season}
              onChange={(e) => setSeason(e.target.value as MediaFlightSeason)}
              className="w-full text-sm px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300"
            >
              {Object.entries(MEDIA_SEASON_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-sm px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-sm px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Budget (Planned)</label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="w-full text-sm px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Actual Spent</label>
            <input
              type="number"
              value={actualSpent}
              onChange={(e) => setActualSpent(e.target.value)}
              placeholder="0"
              className="w-full text-sm px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Lead Goal</label>
            <input
              type="number"
              value={leadGoal}
              onChange={(e) => setLeadGoal(e.target.value)}
              placeholder="0"
              className="w-full text-sm px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Actual Leads</label>
            <input
              type="number"
              value={actualLeads}
              onChange={(e) => setActualLeads(e.target.value)}
              placeholder="0"
              className="w-full text-sm px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Markets/Stores</label>
            <input
              type="text"
              value={markets}
              onChange={(e) => setMarkets(e.target.value)}
              className="w-full text-sm px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="px-3 py-1.5 text-xs font-medium rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30"
          >
            Save
          </button>
          <button
            onClick={() => setIsEditing(false)}
            className="px-3 py-1.5 text-xs font-medium rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
          >
            Cancel
          </button>
          <button
            onClick={onDelete}
            className="ml-auto px-3 py-1.5 text-xs font-medium rounded text-red-400 hover:bg-red-500/10"
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  // Calculate pacing if we have budget and actuals
  const pacingPct = flight.budget && flight.actualBudgetSpent
    ? (flight.actualBudgetSpent / flight.budget) * 100
    : null;
  const leadPacingPct = flight.leadGoal && flight.actualLeads
    ? (flight.actualLeads / flight.leadGoal) * 100
    : null;

  return (
    <div
      className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3 cursor-pointer hover:border-slate-600 transition-colors"
      onClick={() => setIsEditing(true)}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-slate-200">{flight.name}</h4>
            <span className={`text-[9px] px-1.5 py-0.5 rounded ${statusConfig.bgColor} ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
          </div>
          {seasonConfig && (
            <span className={`text-[10px] ${seasonConfig.color}`}>
              {seasonConfig.label} ({seasonConfig.months})
            </span>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-medium text-slate-200 tabular-nums">
            {formatMediaBudget(flight.budget)}
          </p>
          <p className="text-[10px] text-slate-500">
            {formatDateRange(flight.startDate, flight.endDate)}
          </p>
        </div>
      </div>

      {/* Actuals tracking if we have data */}
      {(flight.actualBudgetSpent != null || flight.actualLeads != null) && (
        <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-700/30">
          {flight.actualBudgetSpent != null && (
            <div>
              <span className="text-[10px] text-slate-500">Spent: </span>
              <span className="text-[10px] text-emerald-400 tabular-nums">{formatMediaBudget(flight.actualBudgetSpent)}</span>
              {pacingPct !== null && (
                <span className={`text-[9px] ml-1 ${pacingPct > 100 ? 'text-red-400' : 'text-slate-500'}`}>
                  ({pacingPct.toFixed(0)}%)
                </span>
              )}
            </div>
          )}
          {flight.actualLeads != null && (
            <div>
              <span className="text-[10px] text-slate-500">Leads: </span>
              <span className="text-[10px] text-amber-400 tabular-nums">{flight.actualLeads}</span>
              {leadPacingPct !== null && (
                <span className={`text-[9px] ml-1 ${leadPacingPct < 80 ? 'text-red-400' : 'text-slate-500'}`}>
                  ({leadPacingPct.toFixed(0)}%)
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {flight.primaryChannels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {flight.primaryChannels.map(ch => {
            const colors = MEDIA_CHANNEL_COLORS[ch];
            return (
              <span key={ch} className={`text-[10px] px-1.5 py-0.5 rounded ${colors.bg} ${colors.text} border ${colors.border}`}>
                {getChannelLabel(ch).split(' ')[0]}
              </span>
            );
          })}
        </div>
      )}

      {flight.marketsStores && (
        <p className="text-xs text-slate-500 mt-2">{flight.marketsStores}</p>
      )}
    </div>
  );
}

// ============================================================================
// Markets Card (Editable)
// ============================================================================

function MarketsCard({
  plan,
  onUpdate,
}: {
  plan: MediaPlanWithDetails;
  onUpdate: (markets: string | null) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [markets, setMarkets] = useState(plan.primaryMarkets || '');

  const handleSave = () => {
    onUpdate(markets || null);
    setIsEditing(false);
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
        Markets / Stores Coverage
      </p>

      {isEditing ? (
        <div className="space-y-3">
          <textarea
            value={markets}
            onChange={(e) => setMarkets(e.target.value)}
            rows={3}
            placeholder="e.g., Dallas-Fort Worth, Houston, San Antonio..."
            className="w-full text-sm px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-300"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="px-3 py-1.5 text-xs font-medium rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30"
            >
              Save
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 text-xs font-medium rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : plan.primaryMarkets ? (
        <div>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">{plan.primaryMarkets}</p>
          <button
            onClick={() => setIsEditing(true)}
            className="mt-3 text-xs text-slate-500 hover:text-slate-400"
          >
            Edit markets
          </button>
        </div>
      ) : (
        <div className="text-center py-6">
          <p className="text-sm text-slate-400">No markets specified</p>
          <button
            onClick={() => setIsEditing(true)}
            className="mt-2 text-xs text-amber-400 hover:text-amber-300"
          >
            Add markets
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Performance Snapshot Card
// ============================================================================

function PerformanceSnapshotCard({
  companyId,
  snapshot,
  isLoading,
}: {
  companyId: string;
  snapshot: PerformanceSnapshot | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
          Performance Snapshot
        </p>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-slate-700 rounded w-3/4" />
          <div className="h-4 bg-slate-700 rounded w-1/2" />
          <div className="h-4 bg-slate-700 rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (!snapshot || !snapshot.hasData) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
          Performance Snapshot
        </p>
        <div className="text-center py-4">
          <p className="text-sm text-slate-400">No performance data yet</p>
          <p className="text-xs text-slate-500 mt-1">Connect integrations to see metrics</p>
        </div>
        <Link
          href={`/c/${companyId}/analytics?view=media`}
          className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 transition-colors text-xs font-medium text-slate-300"
        >
          Open Media Analytics
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    );
  }

  const formatCurrency = (n: number | null) => {
    if (n === null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Performance Snapshot
        </p>
        <span className="text-[10px] text-slate-600">Last 30 days</span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-lg font-bold text-amber-400 tabular-nums">
            {snapshot.totalLeads.toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Total Leads</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-lg font-bold text-emerald-400 tabular-nums">
            {formatCurrency(snapshot.totalSpend)}
          </p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Spend</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-lg font-bold text-purple-400 tabular-nums">
            {snapshot.cpl ? `$${snapshot.cpl.toFixed(2)}` : '—'}
          </p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">CPL</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-lg font-bold text-slate-200 tabular-nums">
            {snapshot.storeCount}
          </p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Active Stores</p>
        </div>
      </div>

      {snapshot.topChannel && (
        <div className="flex items-center justify-between py-2 border-t border-slate-700/50 mb-3">
          <span className="text-xs text-slate-500">Top Channel</span>
          <span className="text-xs text-slate-300 font-medium">{snapshot.topChannel}</span>
        </div>
      )}

      {snapshot.lowPerformingStores > 0 && (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-red-500/10 border border-red-500/20 mb-3">
          <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-xs text-red-300">
            {snapshot.lowPerformingStores} store{snapshot.lowPerformingStores > 1 ? 's' : ''} need attention
          </span>
        </div>
      )}

      <Link
        href={`/c/${companyId}/analytics?view=media`}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 transition-colors text-xs font-medium text-blue-300"
      >
        View Full Analytics
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}

// ============================================================================
// Actions Card
// ============================================================================

function ActionsCard({
  companyId,
  plan,
  onGenerateWork,
  isGeneratingWork,
  onPromoteToProgram,
  isPromoting,
}: {
  companyId: string;
  plan: MediaPlanWithDetails;
  onGenerateWork: () => void;
  isGeneratingWork: boolean;
  onPromoteToProgram: () => void;
  isPromoting: boolean;
}) {
  // Check if plan can be promoted (active or proposed status)
  const canPromote = ['active', 'proposed'].includes(plan.status.toLowerCase());
  const hasChannels = plan.channels.length > 0;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
        Actions
      </p>

      <div className="space-y-3">
        {/* Promote to Active Program - Primary CTA */}
        <button
          onClick={onPromoteToProgram}
          disabled={isPromoting || !canPromote || !hasChannels}
          className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-colors text-left group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div>
            <p className="text-sm font-medium text-amber-300 group-hover:text-amber-200">
              {isPromoting ? 'Promoting...' : 'Promote to Active Program'}
            </p>
            <p className="text-xs text-slate-500">
              {!hasChannels
                ? 'Add channels to the plan first'
                : !canPromote
                ? 'Plan must be Active or Proposed'
                : 'Create program from this plan & start tracking'}
            </p>
          </div>
          <svg className="h-5 w-5 text-amber-400 group-hover:text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </button>

        {/* Generate Work Items */}
        <button
          onClick={onGenerateWork}
          disabled={isGeneratingWork}
          className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors text-left group disabled:opacity-50"
        >
          <div>
            <p className="text-sm font-medium text-emerald-300 group-hover:text-emerald-200">
              {isGeneratingWork ? 'Generating...' : 'Create Work Items from Plan'}
            </p>
            <p className="text-xs text-slate-500">Generate campaign setup tasks in Ops Lab</p>
          </div>
          <svg className="h-5 w-5 text-emerald-400 group-hover:text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Open Media Analytics */}
        <Link
          href={`/c/${companyId}/analytics?view=media`}
          className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 transition-colors text-left group"
        >
          <div>
            <p className="text-sm font-medium text-slate-200 group-hover:text-slate-100">
              Open Media Analytics
            </p>
            <p className="text-xs text-slate-500">View performance data & store scorecards</p>
          </div>
          <svg className="h-5 w-5 text-slate-400 group-hover:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// Compare Against Plan Card
// ============================================================================

function CompareAgainstPlanCard({
  plan,
  snapshot,
}: {
  plan: MediaPlanWithDetails;
  snapshot: PerformanceSnapshot | null;
}) {
  // Calculate planned totals from plan
  const plannedBudget = plan.totalBudget || 0;
  const plannedLeads = plan.channels.reduce((sum, ch) => sum + (ch.expectedVolume || 0), 0);

  // Get actuals from snapshot (placeholders for now)
  const actualSpend = snapshot?.totalSpend || 0;
  const actualLeads = snapshot?.totalLeads || 0;

  // Calculate variances
  const spendVariance = plannedBudget > 0 ? ((actualSpend - plannedBudget) / plannedBudget) * 100 : 0;
  const leadsVariance = plannedLeads > 0 ? ((actualLeads - plannedLeads) / plannedLeads) * 100 : 0;

  // Determine seasonal pacing
  const currentFlight = plan.flights.find(f => {
    if (!f.startDate || !f.endDate) return false;
    const now = new Date();
    const start = new Date(f.startDate);
    const end = new Date(f.endDate);
    return now >= start && now <= end;
  });

  let pacingStatus: 'on-track' | 'ahead' | 'behind' | 'no-data' = 'no-data';
  let pacingPct: number | null = null;

  if (currentFlight && currentFlight.startDate && currentFlight.endDate) {
    const now = new Date();
    const start = new Date(currentFlight.startDate);
    const end = new Date(currentFlight.endDate);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const expectedPct = (daysElapsed / totalDays) * 100;
    const flightBudget = currentFlight.budget || 0;
    const actualPct = flightBudget > 0 ? (actualSpend / flightBudget) * 100 : 0;
    pacingPct = actualPct - expectedPct;

    if (Math.abs(pacingPct) < 10) pacingStatus = 'on-track';
    else if (pacingPct > 0) pacingStatus = 'ahead';
    else pacingStatus = 'behind';
  }

  const getVarianceColor = (variance: number) => {
    if (Math.abs(variance) < 5) return 'text-slate-400';
    return variance > 0 ? 'text-emerald-400' : 'text-red-400';
  };

  const getVarianceIcon = (variance: number) => {
    if (Math.abs(variance) < 5) return '—';
    return variance > 0 ? '▲' : '▼';
  };

  const formatCurrency = (n: number | null) => {
    if (n === null || n === 0) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
        Compare Against Plan
      </p>

      <div className="space-y-4">
        {/* Spend vs Plan */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Spend vs Plan</p>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-emerald-400 tabular-nums">
                {formatCurrency(actualSpend)}
              </span>
              <span className="text-xs text-slate-500">
                / {formatCurrency(plannedBudget)}
              </span>
            </div>
          </div>
          {plannedBudget > 0 && (
            <span className={`text-sm font-medium tabular-nums ${getVarianceColor(spendVariance)}`}>
              {getVarianceIcon(spendVariance)} {Math.abs(spendVariance).toFixed(0)}%
            </span>
          )}
        </div>

        {/* Leads vs Plan */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Leads vs Plan</p>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-amber-400 tabular-nums">
                {actualLeads.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500">
                / {plannedLeads > 0 ? plannedLeads.toLocaleString() : '—'}
              </span>
            </div>
          </div>
          {plannedLeads > 0 && (
            <span className={`text-sm font-medium tabular-nums ${getVarianceColor(leadsVariance)}`}>
              {getVarianceIcon(leadsVariance)} {Math.abs(leadsVariance).toFixed(0)}%
            </span>
          )}
        </div>

        {/* Seasonal Pacing */}
        <div className="pt-3 border-t border-slate-700/50">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">Seasonal Pacing</p>
            {pacingStatus === 'no-data' ? (
              <span className="text-xs text-slate-500">No active flight</span>
            ) : (
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                pacingStatus === 'on-track'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : pacingStatus === 'ahead'
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                  : 'bg-red-500/10 text-red-400 border border-red-500/30'
              }`}>
                {pacingStatus === 'on-track' ? 'On Track' : pacingStatus === 'ahead' ? 'Ahead of Plan' : 'Behind Plan'}
              </span>
            )}
          </div>
          {currentFlight && (
            <p className="text-[10px] text-slate-600 mt-1">
              Current: {currentFlight.name}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Next Steps Card
// ============================================================================

function NextStepsCard({
  companyId,
  plan,
}: {
  companyId: string;
  plan: MediaPlanWithDetails;
}) {
  const [mediaWorkItems, setMediaWorkItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState('');

  // Fetch media-related work items
  useEffect(() => {
    const fetchWorkItems = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/os/companies/${companyId}/work?area=Funnel&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setMediaWorkItems(data.items || []);
        }
      } catch (error) {
        console.error('Failed to fetch work items:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchWorkItems();
  }, [companyId]);

  const handleAddWorkItem = async () => {
    if (!newItemTitle.trim()) return;

    setIsAddingItem(true);
    try {
      const res = await fetch('/api/os/work-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          title: newItemTitle,
          area: 'Funnel',
          status: 'Backlog',
          source: {
            sourceType: 'media_lab',
            planId: plan.id,
            planName: plan.name,
          },
        }),
      });

      if (res.ok) {
        const newItem = await res.json();
        setMediaWorkItems(prev => [newItem, ...prev].slice(0, 5));
        setNewItemTitle('');
      }
    } catch (error) {
      console.error('Failed to add work item:', error);
    } finally {
      setIsAddingItem(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In Progress':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'Planned':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'Done':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Next Steps
        </p>
        <Link
          href={`/c/${companyId}/work?area=Funnel`}
          className="text-[10px] text-blue-400 hover:text-blue-300"
        >
          View all
        </Link>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-8 bg-slate-700 rounded" />
          <div className="h-8 bg-slate-700 rounded" />
        </div>
      ) : (
        <div className="space-y-2">
          {mediaWorkItems.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-2">
              No media tasks yet
            </p>
          ) : (
            mediaWorkItems.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
              >
                <span className="text-xs text-slate-300 truncate flex-1 mr-2">
                  {item.title}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getStatusColor(item.status)}`}>
                  {item.status}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add Work Item */}
      <div className="mt-4 pt-3 border-t border-slate-700/50">
        <div className="flex gap-2">
          <input
            type="text"
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddWorkItem()}
            placeholder="Add work item..."
            className="flex-1 text-xs bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-600"
          />
          <button
            onClick={handleAddWorkItem}
            disabled={isAddingItem || !newItemTitle.trim()}
            className="px-3 py-2 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs font-medium hover:bg-blue-500/30 transition-colors disabled:opacity-50"
          >
            {isAddingItem ? '...' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
