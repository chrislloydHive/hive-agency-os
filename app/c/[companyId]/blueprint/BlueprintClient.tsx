'use client';

// app/c/[companyId]/blueprint/BlueprintClient.tsx
// Client component for the Blueprint page - the strategic hub
// Two-column layout: Left = Diagnostics/Findings, Right = Actions/Roadmap

import { useState, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import {
  COMPANY_TOOL_DEFS,
  getEnabledTools,
  getComingSoonTools,
  getToolById,
  type CompanyToolDefinition,
  type CompanyToolId,
  type ToolIcon,
  type ToolCategory,
  type BlueprintToolMeta,
} from '@/lib/tools/registry';
import {
  OS_TOOL_DEFINITIONS,
  getAvailableOsTools,
  getComingSoonOsTools,
  osToolIdToCompanyToolId,
  getToolIconName,
  type OsToolDefinition,
} from '@/lib/os/tools/definitions';
import type { CompanyStrategicSnapshot } from '@/lib/airtable/companyStrategySnapshot';
import type { DiagnosticRunStatus, DiagnosticToolId } from '@/lib/os/diagnostics/runs';
import type { CompanyAlert } from '@/lib/os/companies/alerts';
import type { PerformancePulse } from '@/lib/os/analytics/performancePulse';
import type {
  BlueprintPipelineData,
  ToolRunStatus,
  DiagnosticIssue,
  DiagnosticRecommendation,
} from '@/lib/blueprint/pipeline';
import type {
  StrategySynthesis,
  StrategicFocusArea,
  PrioritizedAction,
  SuggestedTool,
} from '@/lib/blueprint/synthesizer';
import type {
  BlueprintAnalyticsSummary,
  AnalyticsStrategicInsight,
} from '@/lib/os/analytics/blueprintDataFetcher';
import type { MediaLabSummary } from '@/lib/types/mediaLab';
import { MediaBlueprintEmptyState } from '@/components/os/media';
import {
  formatMediaBudget,
  getObjectiveLabel,
  COMPANY_MEDIA_STATUS_CONFIG,
} from '@/lib/types/mediaLab';

// Import new two-column layout components
import {
  BlueprintHeaderSummary,
  BlueprintDiagnosticsColumn,
  BlueprintActionsColumn,
  BlueprintMiniNav,
} from '@/components/os/blueprint';

// ============================================================================
// Types
// ============================================================================

interface CompanyData {
  id: string;
  name: string;
  website?: string | null;
  domain?: string;
  industry?: string | null;
  ga4PropertyId?: string | null;
  searchConsoleSiteUrl?: string | null;
  hasMediaProgram?: boolean;
}

interface RecentDiagnostic {
  id: string;
  toolId: DiagnosticToolId;
  toolLabel: string;
  status: DiagnosticRunStatus;
  score: number | null;
  completedAt?: string | null;
  reportPath?: string | null;
  createdAt: string;
}

interface BrainSummary {
  total: number;
  recentCount?: number;
  byCategory: Record<string, number>;
}

// Serialized version of RecommendedTool from lib/blueprint/recommendations.ts
export interface SerializedRecommendedTool {
  toolId: CompanyToolId;
  scoreImpact: 'high' | 'medium' | 'low';
  urgency: 'now' | 'next' | 'later';
  reason: string;
  blueprintMeta: BlueprintToolMeta;
  hasRecentRun: boolean;
  lastRunAt?: string;
  lastScore?: number | null;
  lastRunId?: string;
  daysSinceRun: number | null;
  // Tool definition fields (serialized)
  toolLabel: string;
  toolDescription: string;
  toolCategory: ToolCategory;
  toolIcon: ToolIcon;
  runApiPath?: string;
  urlSlug?: string;
  requiresWebsite?: boolean;
  estimatedMinutes?: number;
}

export interface BlueprintClientProps {
  company: CompanyData;
  strategySnapshot: CompanyStrategicSnapshot | null;
  recentDiagnostics: RecentDiagnostic[];
  alerts: CompanyAlert[];
  performancePulse?: PerformancePulse | null;
  brainSummary: BrainSummary | null;
  pipelineData?: BlueprintPipelineData | null;
  strategySynthesis?: StrategySynthesis | null;
  analyticsSummary?: BlueprintAnalyticsSummary | null;
  analyticsInsights?: AnalyticsStrategicInsight[];
  recommendedTools?: SerializedRecommendedTool[];
  mediaLabSummary?: MediaLabSummary | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getScoreColor(score: number | null): string {
  if (score === null) return 'text-slate-400';
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
}

function getScoreBgColor(score: number | null): string {
  if (score === null) return 'bg-slate-500/20';
  if (score >= 80) return 'bg-emerald-500/20';
  if (score >= 60) return 'bg-amber-500/20';
  return 'bg-red-500/20';
}

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return '';
  }
}

function getToolIconSvg(icon: ToolIcon): ReactNode {
  switch (icon) {
    case 'zap':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case 'fileText':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case 'layers':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      );
    case 'globe':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
        </svg>
      );
    case 'sparkles':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      );
    case 'search':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      );
    case 'fileEdit':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      );
    case 'trendingUp':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      );
    case 'settings':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case 'barChart':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function BlueprintClient({
  company,
  strategySnapshot,
  recentDiagnostics,
  alerts,
  performancePulse,
  brainSummary,
  pipelineData,
  strategySynthesis,
  analyticsSummary,
  analyticsInsights,
  recommendedTools,
  mediaLabSummary,
}: BlueprintClientProps) {
  const router = useRouter();
  const [runningTools, setRunningTools] = useState<Set<CompanyToolId>>(new Set());
  const [newDataBanner, setNewDataBanner] = useState<string | null>(null);
  const [sendingToWork, setSendingToWork] = useState<Set<string>>(new Set());
  const [planningWork, setPlanningWork] = useState<Set<string>>(new Set());
  const [sendingFocusAction, setSendingFocusAction] = useState<Set<string>>(new Set());

  // Get the latest run for each tool
  const getLastRunForTool = (tool: CompanyToolDefinition): RecentDiagnostic | null => {
    if (!tool.diagnosticToolId) return null;
    const toolRuns = recentDiagnostics
      .filter((run) => run.toolId === tool.diagnosticToolId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return toolRuns[0] || null;
  };

  // Poll for async tool completion
  const pollForCompletion = useCallback(
    async (toolId: CompanyToolId, runId: string, toolLabel: string) => {
      // Use generic status endpoint for all diagnostic tools
      const statusEndpoint = `/api/os/diagnostics/status/${toolId}?companyId=${company.id}`;

      let attempts = 0;
      const maxAttempts = 60;

      const poll = async () => {
        attempts++;
        try {
          const response = await fetch(statusEndpoint);
          const data = await response.json();

          if (data.status === 'completed' || data.status === 'complete') {
            setRunningTools((prev) => {
              const next = new Set(prev);
              next.delete(toolId);
              return next;
            });
            setNewDataBanner(`${toolLabel} completed! Refreshing...`);
            setTimeout(() => {
              setNewDataBanner(null);
              router.refresh();
            }, 2000);
            return;
          }

          if (data.status === 'failed') {
            setRunningTools((prev) => {
              const next = new Set(prev);
              next.delete(toolId);
              return next;
            });
            setNewDataBanner(`${toolLabel} failed: ${data.error || 'Unknown error'}`);
            setTimeout(() => setNewDataBanner(null), 5000);
            return;
          }

          if (attempts < maxAttempts) {
            setTimeout(poll, 5000);
          } else {
            console.warn(`[Blueprint] Polling timeout for ${toolLabel}`);
            setRunningTools((prev) => {
              const next = new Set(prev);
              next.delete(toolId);
              return next;
            });
          }
        } catch (error) {
          console.error(`[Blueprint] Error polling ${toolLabel} status:`, error);
          if (attempts < maxAttempts) {
            setTimeout(poll, 5000);
          }
        }
      };

      setTimeout(poll, 3000);
    },
    [company.id, router]
  );

  // Handle running a tool
  const handleRunTool = useCallback(
    async (tool: CompanyToolDefinition) => {
      if (tool.behavior === 'openRoute' && tool.openPath) {
        router.push(tool.openPath(company.id));
        return;
      }

      if (tool.behavior !== 'diagnosticRun' || !tool.runApiPath) return;

      setRunningTools((prev) => new Set(prev).add(tool.id));

      try {
        const response = await fetch(tool.runApiPath, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: company.id,
            url: company.website || company.domain,
          }),
        });

        const data = await response.json();

        if (response.ok && data.run) {
          setNewDataBanner(`${tool.label} started - strategy will update when complete`);
          setTimeout(() => setNewDataBanner(null), 5000);

          // Poll for completion on all diagnostic tools
          pollForCompletion(tool.id, data.run.id, tool.label);
        } else {
          console.error(`[Blueprint] Failed to run ${tool.label}:`, data.error);
          setRunningTools((prev) => {
            const next = new Set(prev);
            next.delete(tool.id);
            return next;
          });
        }
      } catch (error) {
        console.error(`[Blueprint] Error running ${tool.label}:`, error);
        setRunningTools((prev) => {
          const next = new Set(prev);
          next.delete(tool.id);
          return next;
        });
      }
    },
    [company.id, company.website, company.domain, router, pollForCompletion]
  );

  // Handle sending an action to Work
  const handleSendToWork = useCallback(
    async (action: PrioritizedAction, actionId: string) => {
      setSendingToWork((prev) => new Set(prev).add(actionId));

      try {
        const response = await fetch('/api/os/work/from-analytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: company.id,
            title: action.title,
            description: action.description || `From Blueprint: ${action.title}`,
            area: action.area || 'Strategy',
            severity: action.impact === 'high' ? 'High' : action.impact === 'medium' ? 'Medium' : 'Low',
            source: {
              sourceType: 'blueprint',
              synthesisSource: action.source,
            },
          }),
        });

        if (response.ok) {
          setNewDataBanner(`"${action.title}" added to Work`);
          setTimeout(() => setNewDataBanner(null), 3000);
        }
      } catch (error) {
        console.error('[Blueprint] Failed to send to work:', error);
      } finally {
        setSendingToWork((prev) => {
          const next = new Set(prev);
          next.delete(actionId);
          return next;
        });
      }
    },
    [company.id]
  );

  // Handle sending an analytics insight to Work
  const handleSendInsightToWork = useCallback(
    async (insight: AnalyticsStrategicInsight) => {
      const response = await fetch('/api/os/work/from-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: company.id,
          suggestion: {
            title: insight.title,
            description: insight.description,
            area: insight.type === 'opportunity' ? 'demand' : insight.type === 'warning' ? 'general' : 'other',
            priority: insight.type === 'warning' ? 'high' : insight.type === 'opportunity' ? 'medium' : 'low',
            reason: `Analytics insight: ${insight.description}`,
            impact: insight.value || undefined,
          },
        }),
      });

      if (response.ok) {
        setNewDataBanner(`"${insight.title}" added to Work`);
        setTimeout(() => setNewDataBanner(null), 3000);
      } else {
        throw new Error('Failed to create work item');
      }
    },
    [company.id]
  );

  // Handle running a recommended tool
  const handleRunRecommendedTool = useCallback(
    async (rec: SerializedRecommendedTool) => {
      if (!rec.runApiPath) return;

      setRunningTools((prev) => new Set(prev).add(rec.toolId));

      try {
        const response = await fetch(rec.runApiPath, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: company.id,
            url: company.website || company.domain,
          }),
        });

        const data = await response.json();

        if (response.ok && data.run) {
          const run = data.run;
          const isComplete = run.status === 'complete';
          const score = run.score !== null ? ` (Score: ${run.score}/100)` : '';

          if (isComplete) {
            const slugMap: Record<string, string> = {
              gapSnapshot: 'gap-ia',
              gapPlan: 'gap-plan',
              gapHeavy: 'gap-heavy',
              websiteLab: 'website-lab',
              brandLab: 'brand-lab',
              contentLab: 'content-lab',
              seoLab: 'seo-lab',
              demandLab: 'demand-lab',
              opsLab: 'ops-lab',
            };
            const slug = slugMap[rec.toolId] || rec.toolId;
            const reportUrl = `/c/${company.id}/diagnostics/${slug}/${run.id}`;

            setNewDataBanner(`${rec.toolLabel} complete${score} - View Report`);
            setTimeout(() => {
              router.push(reportUrl);
            }, 1500);
          } else {
            setNewDataBanner(`${rec.toolLabel} started - strategy will update when complete`);
          }
          setTimeout(() => setNewDataBanner(null), 5000);
        } else {
          console.error(`[Blueprint] Failed to run ${rec.toolLabel}:`, data.error);
          setNewDataBanner(`${rec.toolLabel} failed: ${data.error || 'Unknown error'}`);
          setTimeout(() => setNewDataBanner(null), 8000);
        }
      } catch (error) {
        console.error(`[Blueprint] Error running ${rec.toolLabel}:`, error);
      } finally {
        setRunningTools((prev) => {
          const next = new Set(prev);
          next.delete(rec.toolId);
          return next;
        });
      }
    },
    [company.id, company.website, company.domain, router]
  );

  // Handle creating work from a recommended tool
  const handlePlanWorkFromTool = useCallback(
    async (rec: SerializedRecommendedTool) => {
      setPlanningWork((prev) => new Set(prev).add(rec.toolId));

      try {
        const areaMapping: Record<string, string> = {
          'Strategic Assessment': 'Strategy',
          'Website & UX': 'Website UX',
          'Brand & Positioning': 'Brand',
          'Content & Messaging': 'Content',
          'SEO & Search': 'SEO',
          'Demand Generation': 'Funnel',
          'Marketing Ops': 'Other',
          'Analytics': 'Funnel',
        };

        const priorityMapping: Record<string, string> = {
          high: 'High',
          medium: 'Medium',
          low: 'Low',
        };

        const title = `Run ${rec.toolLabel}`;
        const description = [
          rec.reason,
          '',
          `**Why this matters:** ${rec.blueprintMeta.whyRun}`,
          '',
          `**This helps answer:** ${rec.blueprintMeta.answersQuestion}`,
          '',
          `**Best time to run:** ${rec.blueprintMeta.typicalUseWhen}`,
        ].join('\n');

        const response = await fetch('/api/os/work', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            notes: description,
            companyId: company.id,
            area: areaMapping[rec.toolCategory] || 'Other',
            severity: priorityMapping[rec.scoreImpact] || 'Medium',
            status: 'Planned',
            source: {
              sourceType: 'blueprint_tool_recommendation',
              toolId: rec.toolId,
              toolLabel: rec.toolLabel,
              urgency: rec.urgency,
            },
          }),
        });

        if (response.ok) {
          setNewDataBanner(`"${title}" added to Work`);
          setTimeout(() => setNewDataBanner(null), 3000);
        } else {
          const data = await response.json();
          console.error('[Blueprint] Failed to create work item:', data.error);
        }
      } catch (error) {
        console.error('[Blueprint] Error creating work item:', error);
      } finally {
        setPlanningWork((prev) => {
          const next = new Set(prev);
          next.delete(rec.toolId);
          return next;
        });
      }
    },
    [company.id]
  );

  // Handle sending a focus area's suggested action to Work
  const handleSendFocusActionToWork = useCallback(
    async (area: StrategicFocusArea, focusId: string) => {
      if (!area.suggestedAction) return;

      setSendingFocusAction((prev) => new Set(prev).add(focusId));

      try {
        const response = await fetch('/api/os/work', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: area.suggestedAction.title,
            notes: [
              area.suggestedAction.description || '',
              '',
              `**Focus Area:** ${area.title}`,
              `**Rationale:** ${area.rationale}`,
            ].join('\n'),
            companyId: company.id,
            area: area.suggestedAction.area || 'Strategy',
            severity: area.suggestedAction.priority === 'high' ? 'High' : area.suggestedAction.priority === 'medium' ? 'Medium' : 'Low',
            status: 'Planned',
            source: {
              sourceType: 'blueprint_focus_area',
              focusAreaTitle: area.title,
            },
          }),
        });

        if (response.ok) {
          setNewDataBanner(`"${area.suggestedAction.title}" added to Work`);
          setTimeout(() => setNewDataBanner(null), 3000);
        } else {
          const data = await response.json();
          console.error('[Blueprint] Failed to create work item:', data.error);
        }
      } catch (error) {
        console.error('[Blueprint] Error creating work item:', error);
      } finally {
        setSendingFocusAction((prev) => {
          const next = new Set(prev);
          next.delete(focusId);
          return next;
        });
      }
    },
    [company.id]
  );

  const hasGa4 = !!company.ga4PropertyId;
  const enabledTools = getEnabledTools();
  const toolStatuses = pipelineData?.diagnostics?.toolStatuses || [];

  // Find last updated timestamp from recent diagnostics
  const lastUpdated = recentDiagnostics.length > 0 ? recentDiagnostics[0].createdAt : null;

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* New Data Banner */}
      {newDataBanner && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-emerald-300">{newDataBanner}</p>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* Header Summary - Full Width */}
      {/* ================================================================== */}
      <BlueprintHeaderSummary
        company={company}
        strategySnapshot={strategySnapshot}
        strategySynthesis={strategySynthesis}
        pipelineData={pipelineData}
        lastUpdated={lastUpdated}
      />

      {/* ================================================================== */}
      {/* Sticky Mini Navigation */}
      {/* ================================================================== */}
      <BlueprintMiniNav />

      {/* ================================================================== */}
      {/* Two Column Layout */}
      {/* ================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-6 items-start">
        {/* Left Column: Diagnostics / Findings / Evidence */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <BlueprintDiagnosticsColumn
            company={company}
            strategySnapshot={strategySnapshot}
            strategySynthesis={strategySynthesis}
            pipelineData={pipelineData}
            brainSummary={brainSummary}
            analyticsSummary={analyticsSummary}
            analyticsInsights={analyticsInsights}
            performancePulse={performancePulse}
            onSendInsightToWork={handleSendInsightToWork}
          />
        </div>

        {/* Right Column: Actions / Priorities / Roadmap - Sticky on desktop */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 xl:sticky xl:top-[calc(4rem+3rem)] xl:self-start xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto">
          <BlueprintActionsColumn
            company={company}
            strategySynthesis={strategySynthesis}
            recommendedTools={recommendedTools}
            onSendActionToWork={handleSendToWork}
            onSendFocusActionToWork={handleSendFocusActionToWork}
            onRunTool={handleRunRecommendedTool}
            onPlanWork={handlePlanWorkFromTool}
            sendingActions={sendingToWork}
            sendingFocusActions={sendingFocusAction}
            runningTools={runningTools}
            planningWork={planningWork}
          />
        </div>
      </div>

      {/* ================================================================== */}
      {/* Media & Demand Engine - Full Width Below Columns */}
      {/* ================================================================== */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Media & Demand Engine</h3>
            <p className="text-xs text-zinc-400">
              How reliably paid media and demand programs are driving installs, leads, or pipeline.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {(mediaLabSummary?.hasMediaProgram || mediaLabSummary?.activePlanCount) && (
              <Link
                href={`/c/${company.id}/diagnostics/media`}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Media Lab
              </Link>
            )}
            <Link
              href={`/c/${company.id}/media`}
              className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              View Media
            </Link>
          </div>
        </div>

        {/* Show Media Lab summary if there are plans */}
        {mediaLabSummary && (mediaLabSummary.hasMediaProgram || mediaLabSummary.activePlanCount > 0) ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-slate-200">Media Program</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                    mediaLabSummary.mediaStatus === 'running'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : mediaLabSummary.mediaStatus === 'planning'
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                      : mediaLabSummary.mediaStatus === 'paused'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                  }`}>
                    {COMPANY_MEDIA_STATUS_CONFIG[mediaLabSummary.mediaStatus]?.label || 'Unknown'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  {mediaLabSummary.primaryObjective && (
                    <span>
                      <span className="text-slate-500">Objective:</span>{' '}
                      <span className="text-slate-300">{getObjectiveLabel(mediaLabSummary.primaryObjective)}</span>
                    </span>
                  )}
                  {mediaLabSummary.totalActiveBudget != null && (
                    <span>
                      <span className="text-slate-500">Budget:</span>{' '}
                      <span className="text-emerald-400">{formatMediaBudget(mediaLabSummary.totalActiveBudget)}</span>
                    </span>
                  )}
                  {mediaLabSummary.primaryMarkets && (
                    <span>
                      <span className="text-slate-500">Markets:</span>{' '}
                      <span className="text-slate-300 truncate max-w-[200px] inline-block align-bottom">{mediaLabSummary.primaryMarkets}</span>
                    </span>
                  )}
                  {mediaLabSummary.activePlanCount > 0 && (
                    <span className="text-slate-500">
                      {mediaLabSummary.activePlanCount} active plan{mediaLabSummary.activePlanCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link
                  href={`/c/${company.id}/diagnostics/media`}
                  className="inline-flex items-center rounded-lg border border-blue-700/50 bg-blue-900/30 px-3 py-1.5 text-xs font-medium text-blue-300 hover:border-blue-500 hover:bg-blue-800/30 transition-colors"
                >
                  View Plan in Media Lab
                </Link>
                {company.hasMediaProgram && (
                  <Link
                    href={`/c/${company.id}/media`}
                    className="inline-flex items-center rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:border-zinc-500 hover:bg-zinc-800 transition-colors"
                  >
                    Performance
                  </Link>
                )}
              </div>
            </div>
          </div>
        ) : company.hasMediaProgram ? (
          /* Operational media program active but no Media Lab plans */
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-200">Media Program Active</p>
                <p className="text-xs text-slate-400">
                  Performance media channels, store scorecards, and demand metrics are available.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/c/${company.id}/diagnostics/media`}
                  className="inline-flex items-center rounded-lg border border-dashed border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-slate-500 hover:text-slate-300 transition-colors"
                >
                  Create Plan
                </Link>
                <Link
                  href={`/c/${company.id}/media`}
                  className="inline-flex items-center rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:border-zinc-500 hover:bg-zinc-800 transition-colors"
                >
                  Open Media Dashboard
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <MediaBlueprintEmptyState companyId={company.id} />
        )}
      </section>

      {/* ================================================================== */}
      {/* Diagnostics & Tools Grid - Full Width */}
      {/* ================================================================== */}
      <div id="tools" className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Deep-dive diagnostics</p>
            <h2 className="text-sm font-semibold text-slate-200">
              All Diagnostics & Tools
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Run tools to strengthen your strategy
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {getAvailableOsTools().map((osTool) => {
            const companyToolId = osToolIdToCompanyToolId(osTool.id) as CompanyToolId | undefined;
            const tool = companyToolId ? getToolById(companyToolId) : undefined;
            if (!tool) return null;

            const lastRun = getLastRunForTool(tool);
            const isRunning = runningTools.has(tool.id);
            const hasWebsite = Boolean(company.website || company.domain);
            const canRun = osTool.status === 'available' && (!tool.requiresWebsite || hasWebsite);
            const toolStatus = toolStatuses.find(s => s.toolId === tool.diagnosticToolId);

            return (
              <OsToolCard
                key={osTool.id}
                osTool={osTool}
                tool={tool}
                lastRun={lastRun}
                isRunning={isRunning}
                canRun={canRun}
                onRun={() => handleRunTool(tool)}
                companyId={company.id}
                toolStatus={toolStatus}
              />
            );
          })}
        </div>

        {getComingSoonOsTools().length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-800">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Coming Soon</p>
            <div className="flex flex-wrap gap-2">
              {getComingSoonOsTools().map((osTool) => (
                <span
                  key={osTool.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/50 border border-slate-700/50 text-xs text-slate-500"
                >
                  {getToolIconSvg(getToolIconName(osTool.id) as ToolIcon)}
                  {osTool.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* Quick Actions Footer */}
      {/* ================================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <QuickActionLink
          href={`/c/${company.id}`}
          icon="home"
          title="Overview"
          subtitle="Quick check"
          color="slate"
        />
        <QuickActionLink
          href={`/c/${company.id}/brain`}
          icon="brain"
          title="Brain"
          subtitle="AI memory"
          color="amber"
        />
        <QuickActionLink
          href={`/c/${company.id}/work`}
          icon="work"
          title="Work"
          subtitle="Tasks & experiments"
          color="emerald"
        />
        {hasGa4 && (
          <QuickActionLink
            href={`/c/${company.id}/analytics/deep-dive`}
            icon="chart"
            title="Analytics"
            subtitle="Deep dive"
            color="blue"
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Sub-Components (kept for tool grid compatibility)
// ============================================================================

function OsToolCard({
  osTool,
  tool,
  lastRun,
  isRunning,
  canRun,
  onRun,
  companyId,
  toolStatus,
}: {
  osTool: OsToolDefinition;
  tool: CompanyToolDefinition;
  lastRun: RecentDiagnostic | null;
  isRunning: boolean;
  canRun: boolean;
  onRun: () => void;
  companyId: string;
  toolStatus?: ToolRunStatus;
}) {
  let statusText = 'Not run yet';
  let statusColor = 'text-slate-500';
  let showRecommendation = false;

  if (lastRun) {
    if (lastRun.status === 'running') {
      statusText = 'Running...';
      statusColor = 'text-blue-400';
    } else if (lastRun.status === 'complete') {
      statusText = formatRelativeTime(lastRun.completedAt);
      statusColor = 'text-slate-400';
    } else if (lastRun.status === 'failed') {
      statusText = 'Failed';
      statusColor = 'text-red-400';
    }
  }

  if (tool.behavior === 'openRoute') {
    statusText = 'Live data';
    statusColor = 'text-emerald-400';
  }

  if (toolStatus?.status === 'stale') {
    statusColor = 'text-amber-400';
    showRecommendation = true;
  }

  const getImpactBadgeStyle = (impact: string) => {
    switch (impact) {
      case 'foundational':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'high':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'medium':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const isLocked = osTool.status === 'locked';

  return (
    <div className={`rounded-lg bg-slate-800/50 border p-3 flex flex-col justify-between hover:border-slate-600 transition-colors ${
      toolStatus?.status === 'stale' ? 'border-amber-500/30' : isLocked ? 'border-slate-700/30 opacity-75' : 'border-slate-700/50'
    }`}>
      <div>
        {/* Header row: Icon, Name, Score */}
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1 rounded bg-slate-700/50 text-amber-500">
            {getToolIconSvg(getToolIconName(osTool.id) as ToolIcon)}
          </div>
          <h3 className="text-sm font-medium text-slate-100 flex-1 truncate">{osTool.name}</h3>
          {lastRun?.score !== null && lastRun?.score !== undefined && (
            <span className={`text-sm font-bold tabular-nums ${getScoreColor(lastRun.score)}`}>
              {lastRun.score}
            </span>
          )}
          {isLocked && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Locked
            </span>
          )}
        </div>

        {/* Chip row: Impact, Est. Time, Last Run */}
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getImpactBadgeStyle(osTool.impact)}`}>
            {osTool.impact}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400">
            ~{osTool.estimatedRunTime}
          </span>
          <span className={`text-[10px] ${statusColor}`}>
            {isRunning ? (
              <span className="flex items-center gap-1">
                <svg className="w-2.5 h-2.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Running
              </span>
            ) : (
              statusText
            )}
          </span>
        </div>

        {/* Stale recommendation (only if stale) */}
        {showRecommendation && toolStatus?.recommendation && (
          <p className="text-[10px] text-amber-300/80 mb-2 p-1.5 rounded bg-amber-500/10 border border-amber-500/20 line-clamp-2">
            {toolStatus.recommendation}
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={onRun}
          disabled={!canRun || isRunning || isLocked}
          className={`flex-1 px-2 py-1.5 text-xs font-medium rounded transition-colors ${
            canRun && !isRunning && !isLocked
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-900'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          }`}
        >
          {isRunning ? 'Running...' : tool.behavior === 'openRoute' ? 'Open' : 'Run'}
        </button>
        {tool.viewPath && lastRun && lastRun.status === 'complete' && (
          <Link
            href={lastRun.reportPath || tool.viewPath(companyId, lastRun.id)}
            className="px-2 py-1.5 text-xs font-medium rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
          >
            View
          </Link>
        )}
      </div>
    </div>
  );
}

function QuickActionLink({
  href,
  icon,
  title,
  subtitle,
  color,
}: {
  href: string;
  icon: 'home' | 'brain' | 'work' | 'chart';
  title: string;
  subtitle: string;
  color: 'slate' | 'amber' | 'emerald' | 'blue';
}) {
  const colorClasses = {
    slate: 'bg-slate-500/10 border-slate-500/30 group-hover:bg-slate-500/20',
    amber: 'bg-amber-500/10 border-amber-500/30 group-hover:bg-amber-500/20',
    emerald: 'bg-emerald-500/10 border-emerald-500/30 group-hover:bg-emerald-500/20',
    blue: 'bg-blue-500/10 border-blue-500/30 group-hover:bg-blue-500/20',
  };
  const iconColorClasses = {
    slate: 'text-slate-400',
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
  };

  const iconSvg = {
    home: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    brain: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    work: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    chart: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  };

  return (
    <Link
      href={href}
      className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 hover:bg-slate-800/50 transition-all group"
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-colors ${colorClasses[color]}`}>
          <span className={iconColorClasses[color]}>{iconSvg[icon]}</span>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-100">{title}</p>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>
    </Link>
  );
}
