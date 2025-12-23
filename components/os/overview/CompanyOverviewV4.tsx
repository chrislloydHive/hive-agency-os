'use client';

// components/os/overview/CompanyOverviewV4.tsx
// Company Overview V4 - Engagement-Driven Entry Point
//
// State machine (Updated with Universal Start Mode):
// NO_ENGAGEMENT → EngagementTypeSelector
//     ↓ select type
// TYPE_SELECTED → ProjectTypeSelector (if project) OR InlineLabsSelector (if strategy)
//     ↓ select project type
// PROJECT_TYPE_SELECTED → ProjectStartModeSelector (universal for ALL project types)
//     ↓ select start mode
// START_MODE_SELECTED:
//     → use_existing: Route to execution (check readiness first)
//     → refresh_context: InlineLabsSelector → CONTEXT_GATHERING
//
// CONTEXT_GATHERING → EngagementProgressCard (GAP running)
//     ↓ complete + approve
// CONTEXT_APPROVED → Redirect to targetRoute

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CompanySnapshotHeader, deriveCompanyLifecycle, type SituationMetrics } from './CompanySnapshotHeader';
import { EngagementTypeSelector } from './EngagementTypeSelector';
import { ProjectTypeSelector } from './ProjectTypeSelector';
import { InlineLabsSelector } from './InlineLabsSelector';
import { EngagementProgressCard } from './EngagementProgressCard';
import { ProjectStartModeSelector } from './ProjectStartModeSelector';
import { StrategyDocCard } from './StrategyDocCard';
import { ArtifactsList } from './ArtifactsList';
import { useEngagement, useLabProgress } from '@/hooks/useEngagement';
import type { EngagementType, ProjectType, ProjectStartMode } from '@/lib/types/engagement';
import type { LabId } from '@/lib/contextGraph/labContext';
import {
  getRequiredLabs,
  getSuggestedLabs,
  getRefreshContextLabs,
  getExecutionRoute,
} from '@/lib/types/engagement';
import type { CompanyStrategy } from '@/lib/types/strategy';
import type { CompanyStrategicSnapshot } from '@/lib/airtable/companyStrategySnapshot';
import type { RecentDiagnostic } from '@/components/os/blueprint/types';
import type { CompanyAlert } from '@/lib/os/companies/alerts';
import { Loader2 } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type FlowStep =
  | 'loading'
  | 'select_type'
  | 'select_project_type'
  | 'select_start_mode'     // Universal start mode for ALL project types
  | 'select_labs'           // Only reached via refresh_context path
  | 'context_gathering'
  | 'context_approved';

export interface CompanyOverviewV4Props {
  companyId: string;
  companyName: string;

  // Strategy data (for lifecycle badge)
  strategy: CompanyStrategy | null;

  // Supporting data (for header lifecycle calculation)
  strategySnapshot: CompanyStrategicSnapshot | null;
  recentDiagnostics: RecentDiagnostic[];
  alerts: CompanyAlert[];

  // Company metadata for header
  industry?: string | null;
  stage?: string | null;

  // AI-generated snapshot (from server)
  aiSnapshot?: string | null;

  // Situation metrics for header
  metrics?: SituationMetrics | null;
}

// ============================================================================
// Component
// ============================================================================

export function CompanyOverviewV4({
  companyId,
  companyName,
  strategy,
  strategySnapshot,
  recentDiagnostics,
  alerts,
  industry,
  stage,
  aiSnapshot,
  metrics,
}: CompanyOverviewV4Props) {
  const router = useRouter();

  // Engagement state from hook
  const {
    engagement,
    loading: engagementLoading,
    error: engagementError,
    createEngagement,
    startContextGathering,
    approveContext,
    cancelEngagement,
    refreshEngagement,
    creating,
    approving,
    cancelling,
  } = useEngagement(companyId);

  // Local flow state
  const [selectedType, setSelectedType] = useState<EngagementType | null>(null);
  const [selectedProjectType, setSelectedProjectType] = useState<ProjectType | null>(null);
  const [startMode, setStartMode] = useState<ProjectStartMode | null>(null);
  const [projectName, setProjectName] = useState<string>('');
  const [selectedLabs, setSelectedLabs] = useState<LabId[]>([]);
  const [startingGap, setStartingGap] = useState(false);
  const [navigating, setNavigating] = useState(false);

  // Lab progress (only during context gathering)
  const { labProgress } = useLabProgress(
    engagement?.gapRunId,
    engagement?.selectedLabs || []
  );

  // Determine current flow step
  const getFlowStep = (): FlowStep => {
    if (engagementLoading || navigating) return 'loading';

    // If we have an existing engagement, show appropriate step
    if (engagement) {
      switch (engagement.status) {
        case 'context_gathering':
          return 'context_gathering';
        case 'context_approved':
          return 'context_approved';
        case 'draft':
          // Draft engagement - continue where they left off
          if (engagement.selectedLabs.length > 0) {
            return 'select_labs';
          }
          return 'select_type';
        default:
          // in_progress or completed - redirect to target
          if (engagement.status === 'in_progress' || engagement.status === 'completed') {
            router.push(engagement.targetRoute);
            return 'loading';
          }
          return 'select_type';
      }
    }

    // No engagement - use local state
    if (!selectedType) return 'select_type';

    // Strategy path goes directly to labs
    if (selectedType === 'strategy') return 'select_labs';

    // Project path: type → start mode → (labs if refresh) or (execution if use_existing)
    if (selectedType === 'project') {
      if (!selectedProjectType) return 'select_project_type';
      if (!startMode) return 'select_start_mode';
      // Only show labs for refresh_context path
      if (startMode === 'refresh_context') return 'select_labs';
      // use_existing stays on start_mode until Continue is clicked, then shows loading
      // The navigating flag is set by handleStartModeContinue before router.push
      if (startMode === 'use_existing') return 'select_start_mode';
    }

    return 'select_labs';
  };

  const flowStep = getFlowStep();

  // Initialize labs when type is selected
  useEffect(() => {
    if (selectedType && !engagement) {
      const required = getRequiredLabs(selectedType);
      const suggested = getSuggestedLabs(selectedType, selectedProjectType ?? undefined);
      setSelectedLabs([...new Set([...required, ...suggested])]);
    }
  }, [selectedType, selectedProjectType, engagement]);

  // Update labs when project type changes
  useEffect(() => {
    if (selectedType === 'project' && selectedProjectType) {
      const required = getRequiredLabs(selectedType);
      const suggested = getSuggestedLabs(selectedType, selectedProjectType);
      setSelectedLabs([...new Set([...required, ...suggested])]);
    }
  }, [selectedType, selectedProjectType]);

  // Handle type selection
  const handleTypeSelect = useCallback((type: EngagementType) => {
    setSelectedType(type);
    setSelectedProjectType(null);
    setStartMode(null);
    setProjectName('');
  }, []);

  // Handle project type selection
  const handleProjectTypeSelect = useCallback((type: ProjectType) => {
    setSelectedProjectType(type);
    // Reset start mode when project type changes
    setStartMode(null);
  }, []);

  // Handle start mode selection (universal for all project types)
  const handleStartModeSelect = useCallback((mode: ProjectStartMode) => {
    setStartMode(mode);
  }, []);

  // Handle start mode continue (universal routing logic)
  const handleStartModeContinue = useCallback(() => {
    if (!selectedProjectType) return;

    if (startMode === 'use_existing') {
      // Set navigating to show loading state while routing
      setNavigating(true);
      // Route directly to execution - bypass context gathering
      // Readiness checks happen on the destination page
      const executionRoute = getExecutionRoute(companyId, selectedProjectType);
      router.push(executionRoute);
    }
    // If 'refresh_context', the flow will naturally continue to select_labs
    // because startMode is set and getFlowStep() will return 'select_labs'
  }, [startMode, selectedProjectType, companyId, router]);

  // Initialize labs for refresh_context path
  useEffect(() => {
    if (startMode === 'refresh_context' && selectedProjectType) {
      const labs = getRefreshContextLabs(selectedProjectType);
      setSelectedLabs(labs);
    }
  }, [startMode, selectedProjectType]);

  // Handle starting context gathering
  const handleStartContextGathering = useCallback(async () => {
    setStartingGap(true);
    try {
      // Create engagement if we don't have one
      let currentEngagement = engagement;
      if (!currentEngagement) {
        currentEngagement = await createEngagement({
          type: selectedType!,
          projectType: selectedProjectType ?? undefined,
          projectName: projectName || undefined,
          selectedLabs,
        });
      }

      // Generate a run ID for tracking
      const gapRunId = `inngest_${Date.now()}`;

      // Update engagement status to context_gathering directly via API
      // (Can't use hook's startContextGathering because state hasn't updated yet)
      const actionRes = await fetch(
        `/api/os/companies/${companyId}/engagements/${currentEngagement.id}/actions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'start-context-gathering',
            gapRunId,
          }),
        }
      );

      if (!actionRes.ok) {
        const data = await actionRes.json();
        throw new Error(data.error || 'Failed to start context gathering');
      }

      // Trigger Inngest event for background processing via dedicated endpoint
      const inngestResponse = await fetch(
        `/api/os/companies/${companyId}/engagements/${currentEngagement.id}/start-context`,
        { method: 'POST' }
      );

      if (!inngestResponse.ok) {
        console.warn('[CompanyOverviewV4] Inngest trigger failed, status:', inngestResponse.status);
        // Don't throw - engagement is already in context_gathering state
      } else {
        console.log('[CompanyOverviewV4] Inngest event triggered successfully');
      }

      // Refresh engagement to get updated state
      await refreshEngagement();
    } catch (err) {
      console.error('[CompanyOverviewV4] Error starting context gathering:', err);
    } finally {
      setStartingGap(false);
    }
  }, [
    engagement,
    createEngagement,
    selectedType,
    selectedProjectType,
    projectName,
    selectedLabs,
    companyId,
    refreshEngagement,
  ]);

  // Handle context approval
  const handleApproveContext = useCallback(async () => {
    try {
      await approveContext();

      // Redirect to Context page for review
      router.push(`/c/${companyId}/context`);
    } catch (err) {
      console.error('[CompanyOverviewV4] Error approving context:', err);
    }
  }, [approveContext, companyId, router]);

  // Handle cancellation
  const handleCancel = useCallback(async () => {
    try {
      await cancelEngagement();
      // Reset local state
      setSelectedType(null);
      setSelectedProjectType(null);
      setStartMode(null);
      setProjectName('');
      setSelectedLabs([]);
    } catch (err) {
      console.error('[CompanyOverviewV4] Error cancelling:', err);
    }
  }, [cancelEngagement]);

  // Calculate lifecycle for header
  const hasDiagnostics = recentDiagnostics.some(d => d.status === 'complete');
  const latestDiagnostic = recentDiagnostics.find(d => d.status === 'complete');
  const latestScore = latestDiagnostic?.score ?? null;
  const hasStrategy = strategy !== null && (strategy.objectives?.length > 0 || strategy.pillars?.length > 0);

  const lifecycle = deriveCompanyLifecycle({
    hasStrategy,
    hasDiagnostics,
    latestScore,
    alertCount: alerts.length,
    criticalAlertCount: alerts.filter(a => a.severity === 'critical').length,
  });

  return (
    <div className="space-y-6">
      {/* ================================================================== */}
      {/* 1. SITUATION BRIEFING HEADER */}
      {/* ================================================================== */}
      <section id="situation-briefing">
        <CompanySnapshotHeader
          companyId={companyId}
          companyName={companyName}
          aiSnapshot={aiSnapshot}
          lifecycle={lifecycle}
          industry={industry}
          stage={stage}
          metrics={metrics}
        />
      </section>

      {/* ================================================================== */}
      {/* 2. ENGAGEMENT FLOW */}
      {/* ================================================================== */}
      <section id="engagement-flow">
        {/* Error display */}
        {engagementError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
            <p className="text-sm text-red-400">{engagementError}</p>
          </div>
        )}

        {/* Loading */}
        {flowStep === 'loading' && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          </div>
        )}

        {/* Step 1: Select engagement type */}
        {flowStep === 'select_type' && (
          <EngagementTypeSelector
            selectedType={selectedType}
            onSelectType={handleTypeSelect}
            disabled={creating}
          />
        )}

        {/* Step 2: Select project type (if project engagement) */}
        {flowStep === 'select_project_type' && (
          <ProjectTypeSelector
            selectedType={selectedProjectType}
            onSelectType={handleProjectTypeSelect}
            onBack={() => setSelectedType(null)}
            projectName={projectName}
            onProjectNameChange={setProjectName}
            disabled={creating}
          />
        )}

        {/* Step 2b: Select start mode (universal for ALL project types) */}
        {flowStep === 'select_start_mode' && selectedProjectType && (
          <ProjectStartModeSelector
            projectType={selectedProjectType}
            selectedMode={startMode}
            onSelectMode={handleStartModeSelect}
            onBack={() => setSelectedProjectType(null)}
            onContinue={handleStartModeContinue}
            projectName={projectName}
            disabled={creating}
          />
        )}

        {/* Step 3: Configure and start labs (only for refresh_context or strategy) */}
        {flowStep === 'select_labs' && (
          <InlineLabsSelector
            engagementType={selectedType ?? engagement?.type ?? 'strategy'}
            projectType={selectedProjectType ?? engagement?.projectType ?? undefined}
            selectedLabs={selectedLabs.length > 0 ? selectedLabs : (engagement?.selectedLabs ?? [])}
            onSelectedLabsChange={setSelectedLabs}
            onBack={() => {
              // For projects with refresh_context, go back to start mode
              if (selectedType === 'project' && startMode === 'refresh_context') {
                setStartMode(null);
              } else if (selectedType === 'project') {
                setSelectedProjectType(null);
              } else {
                setSelectedType(null);
              }
            }}
            onConfirm={handleStartContextGathering}
            confirming={startingGap || creating}
            disabled={creating}
          />
        )}

        {/* Step 4: Context gathering in progress */}
        {flowStep === 'context_gathering' && engagement && (
          <EngagementProgressCard
            engagement={engagement}
            labProgress={labProgress}
            onApproveContext={handleApproveContext}
            onCancel={handleCancel}
            onRefresh={refreshEngagement}
            approving={approving}
            cancelling={cancelling}
          />
        )}

        {/* Step 5: Context approved - show redirect */}
        {flowStep === 'context_approved' && engagement && (
          <EngagementProgressCard
            engagement={engagement}
            labProgress={labProgress}
            onApproveContext={handleApproveContext}
            onCancel={handleCancel}
            approving={approving}
            cancelling={cancelling}
          />
        )}
      </section>

      {/* ================================================================== */}
      {/* 3. DELIVERABLES */}
      {/* ================================================================== */}
      <section id="deliverables">
        <h2 className="text-sm font-medium text-slate-400 mb-3">Deliverables</h2>
        <div className="space-y-4">
          {/* Strategy Doc Card - uses artifacts or fallback */}
          <StrategyDocCard
            companyId={companyId}
            strategyId={strategy?.id}
          />

          {/* Artifacts List - only shows if ARTIFACTS_ENABLED */}
          <ArtifactsList
            companyId={companyId}
            showStaleBanner={true}
            maxItems={5}
          />
        </div>
      </section>
    </div>
  );
}

export default CompanyOverviewV4;
