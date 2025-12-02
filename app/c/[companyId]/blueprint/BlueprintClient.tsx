'use client';

// app/c/[companyId]/blueprint/BlueprintClient.tsx
// Client component for the Blueprint page - the strategic hub
// Enhanced with Strategy Engine and full intelligence layer

import { useState, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import {
  COMPANY_TOOL_DEFS,
  getEnabledTools,
  getComingSoonTools,
  type CompanyToolDefinition,
  type CompanyToolId,
  type ToolIcon,
  type ToolCategory,
  type BlueprintToolMeta,
} from '@/lib/tools/registry';
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
import { BlueprintAnalyticsPanel } from '@/components/os/blueprint';

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

function getMaturityStageStyle(stage: string | undefined): string {
  switch (stage) {
    case 'World-Class':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    case 'Advanced':
      return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    case 'Good':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    case 'Developing':
      return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
    case 'Basic':
    default:
      return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  }
}

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return '';
  }
}

function getImpactStyle(impact: 'high' | 'medium' | 'low'): string {
  switch (impact) {
    case 'high':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    case 'medium':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    case 'low':
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
}

function getEffortStyle(effort: 'low' | 'medium' | 'high'): string {
  switch (effort) {
    case 'low':
      return 'bg-emerald-500/20 text-emerald-300';
    case 'medium':
      return 'bg-amber-500/20 text-amber-300';
    case 'high':
      return 'bg-red-500/20 text-red-300';
  }
}

function getUrgencyStyle(urgency: 'run-now' | 'stale' | 'not-run'): string {
  switch (urgency) {
    case 'run-now':
      return 'bg-red-500/20 text-red-300 border-red-500/30';
    case 'stale':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    case 'not-run':
      return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
  }
}

function getRecommendationUrgencyStyle(urgency: 'now' | 'next' | 'later'): { bg: string; text: string; border: string; label: string } {
  switch (urgency) {
    case 'now':
      return { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30', label: 'Run Now' };
    case 'next':
      return { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30', label: 'Run Next' };
    case 'later':
      return { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30', label: 'Later' };
  }
}

function getRecommendationImpactStyle(impact: 'high' | 'medium' | 'low'): { bg: string; text: string; label: string } {
  switch (impact) {
    case 'high':
      return { bg: 'bg-emerald-500/20', text: 'text-emerald-300', label: 'High Impact' };
    case 'medium':
      return { bg: 'bg-amber-500/20', text: 'text-amber-300', label: 'Medium Impact' };
    case 'low':
      return { bg: 'bg-slate-500/20', text: 'text-slate-400', label: 'Low Impact' };
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
        } else {
          console.error(`[Blueprint] Failed to run ${tool.label}:`, data.error);
        }
      } catch (error) {
        console.error(`[Blueprint] Error running ${tool.label}:`, error);
      } finally {
        setRunningTools((prev) => {
          const next = new Set(prev);
          next.delete(tool.id);
          return next;
        });
      }
    },
    [company.id, company.website, company.domain, router]
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
          setNewDataBanner(`${rec.toolLabel} started - strategy will update when complete`);
          setTimeout(() => setNewDataBanner(null), 5000);
        } else {
          console.error(`[Blueprint] Failed to run ${rec.toolLabel}:`, data.error);
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
    [company.id, company.website, company.domain]
  );

  // Handle creating work from a recommended tool (Part 3: Auto-Create Work)
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

  // Handle sending a focus area's suggested action to Work (Part 2: Micro-Actions)
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

  const hasSnapshot = !!strategySnapshot;
  const hasSynthesis = !!strategySynthesis;
  const hasGa4 = !!company.ga4PropertyId;
  const hasSearchConsole = !!company.searchConsoleSiteUrl;

  const enabledTools = getEnabledTools();
  const comingSoonTools = getComingSoonTools();

  // Get tool statuses from pipeline data
  const toolStatuses = pipelineData?.diagnostics?.toolStatuses || [];

  return (
    <div className="space-y-6">
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
      {/* Section 1: Strategic Narrative (from AI Synthesis) */}
      {/* ================================================================== */}
      {hasSynthesis && strategySynthesis.strategicNarrative && (
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-sm font-semibold text-blue-300 uppercase tracking-wide">
                  Strategic Narrative
                </h2>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  strategySynthesis.confidence === 'high'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : strategySynthesis.confidence === 'medium'
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-slate-500/20 text-slate-400'
                }`}>
                  {strategySynthesis.confidence} confidence
                </span>
              </div>
              <p className="text-base text-slate-200 leading-relaxed">
                {strategySynthesis.strategicNarrative}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* Section 2: Strategic Overview (Scores + Snapshot) */}
      {/* ================================================================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
          Strategic Overview
        </h2>

        {hasSnapshot || pipelineData?.diagnostics?.overallScore !== null ? (
          <div className="space-y-4">
            {/* Headline Recommendation */}
            {strategySnapshot?.headlineRecommendation && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <p className="text-sm text-blue-200 font-medium">{strategySnapshot.headlineRecommendation}</p>
              </div>
            )}

            <div className="flex flex-col lg:flex-row lg:items-center gap-6">
              {/* Overall Score + Maturity */}
              <div className="flex items-center gap-6">
                {(strategySnapshot?.overallScore ?? pipelineData?.diagnostics?.overallScore) !== null && (
                  <div className="text-center">
                    <div className={`text-5xl font-bold tabular-nums ${getScoreColor(strategySnapshot?.overallScore ?? pipelineData?.diagnostics?.overallScore ?? null)}`}>
                      {strategySnapshot?.overallScore ?? pipelineData?.diagnostics?.overallScore}
                    </div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mt-1">Health Score</p>
                  </div>
                )}

                {strategySnapshot?.maturityStage && (
                  <div className="text-center">
                    <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border ${getMaturityStageStyle(strategySnapshot.maturityStage)}`}>
                      {strategySnapshot.maturityStage}
                    </span>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mt-2">Maturity Stage</p>
                  </div>
                )}
              </div>

              {/* Score Breakdown */}
              {pipelineData?.diagnostics?.scores && (
                <div className="flex-1 lg:pl-6 lg:border-l lg:border-slate-800">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {pipelineData.diagnostics.scores.website !== null && (
                      <ScorePill label="Website" score={pipelineData.diagnostics.scores.website} />
                    )}
                    {pipelineData.diagnostics.scores.brand !== null && (
                      <ScorePill label="Brand" score={pipelineData.diagnostics.scores.brand} />
                    )}
                    {pipelineData.diagnostics.scores.seo !== null && (
                      <ScorePill label="SEO" score={pipelineData.diagnostics.scores.seo} />
                    )}
                    {pipelineData.diagnostics.scores.content !== null && (
                      <ScorePill label="Content" score={pipelineData.diagnostics.scores.content} />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <EmptyState
            icon="chart"
            title="No Strategic Snapshot Yet"
            description="Run GAP or Website Lab diagnostics to generate a strategic snapshot with scores, focus areas, and a 90-day plan."
          />
        )}
      </div>

      {/* ================================================================== */}
      {/* Section 3: Top Focus Areas (from AI Synthesis) */}
      {/* ================================================================== */}
      {hasSynthesis && strategySynthesis.topFocusAreas.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
            Top Focus Areas
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {strategySynthesis.topFocusAreas.slice(0, 5).map((area, index) => (
              <FocusAreaCard
                key={index}
                area={area}
                index={index}
                onSendToWork={() => handleSendFocusActionToWork(area, `focus-${index}`)}
                isSending={sendingFocusAction.has(`focus-${index}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* Section 4: Prioritized Actions (from AI Synthesis) */}
      {/* ================================================================== */}
      {hasSynthesis && strategySynthesis.prioritizedActions.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Prioritized Actions
            </h2>
            <Link
              href={`/c/${company.id}/work`}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              View all in Work
            </Link>
          </div>
          <div className="space-y-3">
            {strategySynthesis.prioritizedActions.slice(0, 8).map((action, index) => (
              <ActionCard
                key={index}
                action={action}
                onSendToWork={() => handleSendToWork(action, `action-${index}`)}
                isSending={sendingToWork.has(`action-${index}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* Section 5: 90-Day Plan (from AI Synthesis) */}
      {/* ================================================================== */}
      {hasSynthesis && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
            90-Day Plan
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <NinetyDayColumn
              title="Now"
              subtitle="Week 1-2"
              items={strategySynthesis.ninetyDayPlan.now}
              color="emerald"
              companyId={company.id}
            />
            <NinetyDayColumn
              title="Next"
              subtitle="Week 3-6"
              items={strategySynthesis.ninetyDayPlan.next}
              color="amber"
              companyId={company.id}
            />
            <NinetyDayColumn
              title="Later"
              subtitle="Week 7-12"
              items={strategySynthesis.ninetyDayPlan.later}
              color="blue"
              companyId={company.id}
            />
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* Section 6: Analytics & Performance (New Panel) */}
      {/* ================================================================== */}
      <BlueprintAnalyticsPanel
        companyId={company.id}
        summary={analyticsSummary ?? null}
        insights={analyticsInsights}
        onSendInsightToWork={handleSendInsightToWork}
      />

      {/* ================================================================== */}
      {/* Section 7: Recommended Tools to Run (Enhanced with BlueprintToolMeta) */}
      {/* ================================================================== */}
      {recommendedTools && recommendedTools.length > 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Recommended Tools to Run
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                AI-selected based on your diagnostic history and analytics trends
              </p>
            </div>
          </div>
          <div className="space-y-4">
            {recommendedTools.map((rec) => {
              const urgencyStyle = getRecommendationUrgencyStyle(rec.urgency);
              const impactStyle = getRecommendationImpactStyle(rec.scoreImpact);
              const isRunning = runningTools.has(rec.toolId);
              const isPlanning = planningWork.has(rec.toolId);
              const canRun = !rec.requiresWebsite || Boolean(company.website || company.domain);

              return (
                <div
                  key={rec.toolId}
                  className={`rounded-xl border p-4 ${urgencyStyle.border} ${urgencyStyle.bg}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Tool Icon */}
                    <div className="flex-shrink-0 p-2 rounded-lg bg-slate-800/50 text-amber-500">
                      {getToolIconSvg(rec.toolIcon)}
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                      {/* Header Row */}
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-sm font-semibold text-slate-100">{rec.toolLabel}</h3>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${urgencyStyle.bg} ${urgencyStyle.text} border ${urgencyStyle.border}`}>
                          {urgencyStyle.label}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${impactStyle.bg} ${impactStyle.text}`}>
                          {impactStyle.label}
                        </span>
                        {rec.estimatedMinutes && (
                          <span className="text-[10px] text-slate-500">
                            ~{rec.estimatedMinutes} min
                          </span>
                        )}
                      </div>

                      {/* Why run this tool */}
                      <p className="text-sm text-slate-300 mb-2">{rec.blueprintMeta.whyRun}</p>

                      {/* This helps answer */}
                      <p className="text-xs text-slate-400 mb-3">
                        <span className="text-slate-500">This helps answer:</span> {rec.blueprintMeta.answersQuestion}
                      </p>

                      {/* Influences pills */}
                      <div className="flex items-center gap-2 flex-wrap mb-3">
                        <span className="text-[10px] text-slate-500">Influences:</span>
                        {rec.blueprintMeta.influences.map((influence) => (
                          <span
                            key={influence}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400 border border-slate-600/50"
                          >
                            {influence}
                          </span>
                        ))}
                      </div>

                      {/* Status & Reason */}
                      <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                        {rec.hasRecentRun && rec.lastRunAt ? (
                          <>
                            <span>Last run: {formatRelativeTime(rec.lastRunAt)}</span>
                            {rec.lastScore !== null && rec.lastScore !== undefined && (
                              <span className={getScoreColor(rec.lastScore)}>Score: {rec.lastScore}</span>
                            )}
                          </>
                        ) : rec.daysSinceRun !== null ? (
                          <span className="text-amber-400">{rec.daysSinceRun} days since last run</span>
                        ) : (
                          <span className="text-blue-400">Never run</span>
                        )}
                      </div>

                      {/* Recommendation reason */}
                      <p className="text-xs text-slate-400 italic mb-3">{rec.reason}</p>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRunRecommendedTool(rec)}
                          disabled={!canRun || isRunning}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                            canRun && !isRunning
                              ? 'bg-amber-500 hover:bg-amber-400 text-slate-900'
                              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {isRunning ? (
                            <span className="flex items-center gap-1.5">
                              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Running...
                            </span>
                          ) : (
                            'Run Diagnostic'
                          )}
                        </button>

                        <button
                          onClick={() => handlePlanWorkFromTool(rec)}
                          disabled={isPlanning}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600 transition-colors disabled:opacity-50"
                        >
                          {isPlanning ? 'Adding...' : 'Plan this work'}
                        </button>

                        {rec.hasRecentRun && rec.urlSlug && (
                          <Link
                            href={`/c/${company.id}/diagnostics/${rec.urlSlug}`}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-slate-400 transition-colors"
                          >
                            View Report
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : hasSynthesis && strategySynthesis.suggestedTools.length > 0 ? (
        // Fallback to old suggested tools if no recommended tools available
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
            Recommended Tools to Run
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {strategySynthesis.suggestedTools.map((suggestion, index) => {
              const tool = enabledTools.find(t => t.diagnosticToolId === suggestion.toolId || t.id === suggestion.toolId);
              if (!tool) return null;

              return (
                <SuggestedToolCard
                  key={index}
                  suggestion={suggestion}
                  tool={tool}
                  isRunning={runningTools.has(tool.id)}
                  onRun={() => handleRunTool(tool)}
                  canRun={!tool.requiresWebsite || Boolean(company.website || company.domain)}
                />
              );
            })}
          </div>
        </div>
      ) : null}

      {/* ================================================================== */}
      {/* Section 8: Diagnostics & Tools (Full Grid) */}
      {/* ================================================================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Diagnostics & Tools
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Run tools to strengthen your strategy
            </p>
          </div>
        </div>

        {/* Tool Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {enabledTools.map((tool) => {
            const lastRun = getLastRunForTool(tool);
            const isRunning = runningTools.has(tool.id);
            const hasWebsite = Boolean(company.website || company.domain);
            const canRun = !tool.requiresWebsite || hasWebsite;

            // Get intelligence from pipeline data
            const toolStatus = toolStatuses.find(s => s.toolId === tool.diagnosticToolId);

            return (
              <ToolCardIntelligent
                key={tool.id}
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

        {/* Coming Soon */}
        {comingSoonTools.length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-800">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Coming Soon</p>
            <div className="flex flex-wrap gap-2">
              {comingSoonTools.map((tool) => (
                <span
                  key={tool.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/50 border border-slate-700/50 text-xs text-slate-500"
                >
                  {getToolIconSvg(tool.icon)}
                  {tool.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* Section 9: Legacy Analytics Summary (kept for backwards compat) */}
      {/* ================================================================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Analytics Summary
          </h2>
          {hasGa4 && (
            <Link
              href={`/c/${company.id}/analytics/deep-dive`}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              View Analytics Deep Dive
            </Link>
          )}
        </div>

        {hasGa4 || hasSearchConsole ? (
          <AnalyticsSummaryIntelligent
            performancePulse={performancePulse}
            analyticsData={pipelineData?.analytics}
            hasGa4={hasGa4}
            hasSearchConsole={hasSearchConsole}
            companyId={company.id}
          />
        ) : (
          <EmptyState
            icon="chart"
            title="Analytics Not Connected"
            description="Connect Google Analytics or Search Console in Settings to see performance data."
          />
        )}
      </div>

      {/* ================================================================== */}
      {/* Section 10: Insights (from Brain) */}
      {/* ================================================================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Insights
          </h2>
          <Link
            href={`/c/${company.id}/brain`}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            View all in Brain
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Key Strengths */}
          <div>
            <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Key Strengths
            </h3>
            {strategySnapshot?.keyStrengths && strategySnapshot.keyStrengths.length > 0 ? (
              <ul className="space-y-2">
                {strategySnapshot.keyStrengths.slice(0, 5).map((strength, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-slate-300">
                    <span className="text-emerald-400 flex-shrink-0 mt-1">+</span>
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No key strengths highlighted yet.</p>
            )}
          </div>

          {/* Key Gaps */}
          <div>
            <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Key Gaps
            </h3>
            {strategySnapshot?.keyGaps && strategySnapshot.keyGaps.length > 0 ? (
              <ul className="space-y-2">
                {strategySnapshot.keyGaps.slice(0, 5).map((gap, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-slate-300">
                    <span className="text-red-400 flex-shrink-0 mt-1">-</span>
                    <span>{gap}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No gaps identified yet.</p>
            )}
          </div>
        </div>

        {/* Brain Summary */}
        {brainSummary && brainSummary.total > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-800">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span className="text-sm text-slate-300">
                  <span className="font-semibold text-slate-100">{brainSummary.total}</span> insights in Brain
                </span>
              </div>
              {brainSummary.recentCount !== undefined && brainSummary.recentCount > 0 && (
                <span className="text-xs text-emerald-400">+{brainSummary.recentCount} this week</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* Quick Actions */}
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
// Sub-Components
// ============================================================================

function ScorePill({ label, score }: { label: string; score: number }) {
  return (
    <div className={`rounded-lg p-2 ${getScoreBgColor(score)}`}>
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${getScoreColor(score)}`}>
        {score}
      </p>
    </div>
  );
}

function FocusAreaCard({
  area,
  index,
  onSendToWork,
  isSending,
}: {
  area: StrategicFocusArea;
  index: number;
  onSendToWork?: () => void;
  isSending?: boolean;
}) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
      <div className="flex items-start gap-3 mb-2">
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-300 text-xs font-medium flex items-center justify-center border border-blue-500/30">
          {index + 1}
        </span>
        <h3 className="text-sm font-medium text-slate-100">{area.title}</h3>
      </div>
      <p className="text-xs text-slate-400 mb-3">{area.rationale}</p>

      {/* Suggested Action (Micro-Action) */}
      {area.suggestedAction && (
        <div className="bg-slate-700/30 rounded-lg p-3 mb-3 border border-slate-600/30">
          <div className="flex items-start gap-2 mb-2">
            <svg className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-200">{area.suggestedAction.title}</p>
              {area.suggestedAction.description && (
                <p className="text-[10px] text-slate-400 mt-0.5">{area.suggestedAction.description}</p>
              )}
            </div>
          </div>
          {onSendToWork && (
            <button
              onClick={onSendToWork}
              disabled={isSending}
              className="w-full px-2 py-1 text-[10px] font-medium rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors disabled:opacity-50"
            >
              {isSending ? 'Adding...' : 'Send to Work'}
            </button>
          )}
        </div>
      )}

      {area.supportingSignals.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {area.supportingSignals.slice(0, 3).map((signal, i) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400">
              {signal.length > 40 ? signal.slice(0, 37) + '...' : signal}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionCard({
  action,
  onSendToWork,
  isSending,
}: {
  action: PrioritizedAction;
  onSendToWork: () => void;
  isSending: boolean;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700/50 hover:border-slate-600 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-medium text-slate-100 truncate">{action.title}</h3>
          <span className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${getImpactStyle(action.impact)}`}>
            {action.impact} impact
          </span>
          <span className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded ${getEffortStyle(action.effort)}`}>
            {action.effort} effort
          </span>
        </div>
        {action.description && (
          <p className="text-xs text-slate-500 truncate">{action.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-slate-600">
            From: {action.source}
          </span>
          {action.area && (
            <span className="text-[10px] text-slate-600">
              | {action.area}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={onSendToWork}
        disabled={isSending}
        className="flex-shrink-0 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors disabled:opacity-50"
      >
        {isSending ? 'Adding...' : 'Send to Work'}
      </button>
    </div>
  );
}

function NinetyDayColumn({
  title,
  subtitle,
  items,
  color,
  companyId,
}: {
  title: string;
  subtitle: string;
  items: string[];
  color: 'emerald' | 'amber' | 'blue';
  companyId: string;
}) {
  const colorClasses = {
    emerald: 'border-emerald-500/30 bg-emerald-500/5',
    amber: 'border-amber-500/30 bg-amber-500/5',
    blue: 'border-blue-500/30 bg-blue-500/5',
  };
  const dotColor = {
    emerald: 'bg-emerald-400',
    amber: 'bg-amber-400',
    blue: 'bg-blue-400',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-2 text-sm text-slate-300">
            <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${dotColor[color]} mt-1.5`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SuggestedToolCard({
  suggestion,
  tool,
  isRunning,
  onRun,
  canRun,
}: {
  suggestion: SuggestedTool;
  tool: CompanyToolDefinition;
  isRunning: boolean;
  onRun: () => void;
  canRun: boolean;
}) {
  return (
    <div className={`rounded-xl p-4 border ${getUrgencyStyle(suggestion.urgency)}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="p-1.5 rounded-lg bg-slate-700/50 text-amber-500">
          {getToolIconSvg(tool.icon)}
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${getUrgencyStyle(suggestion.urgency)}`}>
          {suggestion.urgency === 'run-now' ? 'Run Now' : suggestion.urgency === 'stale' ? 'Stale' : 'Not Run'}
        </span>
      </div>
      <h3 className="text-sm font-medium text-slate-100 mb-1">{suggestion.toolLabel}</h3>
      <p className="text-xs text-slate-400 mb-3 line-clamp-2">{suggestion.reason}</p>
      <button
        onClick={onRun}
        disabled={!canRun || isRunning}
        className={`w-full px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
          canRun && !isRunning
            ? 'bg-amber-500 hover:bg-amber-400 text-slate-900'
            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
        }`}
      >
        {isRunning ? 'Running...' : 'Run'}
      </button>
    </div>
  );
}

function ToolCardIntelligent({
  tool,
  lastRun,
  isRunning,
  canRun,
  onRun,
  companyId,
  toolStatus,
}: {
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

  // Check if stale
  if (toolStatus?.status === 'stale') {
    statusColor = 'text-amber-400';
    showRecommendation = true;
  }

  return (
    <div className={`rounded-xl bg-slate-800/50 border p-4 flex flex-col justify-between hover:border-slate-600 transition-colors ${
      toolStatus?.status === 'stale' ? 'border-amber-500/30' : 'border-slate-700/50'
    }`}>
      <div>
        <div className="flex items-start justify-between mb-2">
          <div className="p-1.5 rounded-lg bg-slate-700/50 text-amber-500">
            {getToolIconSvg(tool.icon)}
          </div>
          {lastRun?.score !== null && lastRun?.score !== undefined && (
            <span className={`text-sm font-bold tabular-nums ${getScoreColor(lastRun.score)}`}>
              {lastRun.score}
            </span>
          )}
        </div>

        <h3 className="text-sm font-medium text-slate-100">{tool.label}</h3>
        <p className={`text-xs mt-1 ${statusColor}`}>
          {isRunning ? (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Running...
            </span>
          ) : (
            statusText
          )}
        </p>

        {/* Intelligent Recommendation */}
        {showRecommendation && toolStatus?.recommendation && (
          <p className="text-[10px] text-amber-300/80 mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/20">
            {toolStatus.recommendation}
          </p>
        )}
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={onRun}
          disabled={!canRun || isRunning}
          className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            canRun && !isRunning
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-900'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          }`}
        >
          {isRunning ? 'Running...' : tool.behavior === 'openRoute' ? 'Open' : 'Run'}
        </button>
        {tool.viewPath && lastRun && lastRun.status === 'complete' && (
          <Link
            href={lastRun.reportPath || tool.viewPath(companyId, lastRun.id)}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
          >
            View
          </Link>
        )}
      </div>
    </div>
  );
}

function AnalyticsSummaryIntelligent({
  performancePulse,
  analyticsData,
  hasGa4,
  hasSearchConsole,
  companyId,
}: {
  performancePulse: PerformancePulse | null | undefined;
  analyticsData?: BlueprintPipelineData['analytics'] | null;
  hasGa4: boolean;
  hasSearchConsole: boolean;
  companyId: string;
}) {
  const hasData = performancePulse && (
    performancePulse.trafficChange7d !== null ||
    performancePulse.conversionsChange7d !== null ||
    performancePulse.seoVisibilityChange7d !== null ||
    performancePulse.currentSessions !== null ||
    performancePulse.currentClicks !== null
  );

  const getChangeColor = (value: number | null) => {
    if (value === null) return 'text-slate-400';
    if (value > 0) return 'text-emerald-400';
    if (value < 0) return 'text-red-400';
    return 'text-slate-400';
  };

  const getChangeArrow = (value: number | null) => {
    if (value === null || value === 0) return '';
    return value > 0 ? ' ' : ' ';
  };

  const formatChange = (value: number | null) => {
    if (value === null) return '';
    if (value === 0) return '0%';
    return value > 0 ? `+${value}%` : `${value}%`;
  };

  // Generate AI pulse message
  let pulseMessage = '';
  if (analyticsData) {
    if (analyticsData.trafficTrend === 'down' && performancePulse?.trafficChange7d) {
      pulseMessage = `Traffic softened ${Math.abs(performancePulse.trafficChange7d)}% week-over-week.`;
    } else if (analyticsData.trafficTrend === 'up' && performancePulse?.trafficChange7d) {
      pulseMessage = `Traffic grew ${performancePulse.trafficChange7d}% week-over-week.`;
    }
    if (analyticsData.conversionTrend === 'down' && performancePulse?.conversionsChange7d) {
      pulseMessage += ` Conversions dropped ${Math.abs(performancePulse.conversionsChange7d)}%.`;
    }
    if (analyticsData.hasAnomalies && analyticsData.anomalySummary) {
      pulseMessage = analyticsData.anomalySummary;
    }
  }

  return (
    <div className="space-y-4">
      {/* AI Pulse Message */}
      {pulseMessage && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
            <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm text-blue-200">{pulseMessage}</p>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Traffic */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Traffic (7d)</p>
          {hasData && performancePulse ? (
            <div className="flex items-end justify-between">
              <span className="text-2xl font-bold tabular-nums text-slate-100">
                {performancePulse.currentSessions?.toLocaleString() ?? ''}
              </span>
              {performancePulse.trafficChange7d !== null && (
                <span className={`text-sm font-medium ${getChangeColor(performancePulse.trafficChange7d)}`}>
                  {getChangeArrow(performancePulse.trafficChange7d)} {formatChange(performancePulse.trafficChange7d)}
                </span>
              )}
            </div>
          ) : (
            <span className="text-sm text-slate-500">No data</span>
          )}
        </div>

        {/* Conversions */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Conversions (7d)</p>
          {hasData && performancePulse ? (
            <div className="flex items-end justify-between">
              <span className="text-2xl font-bold tabular-nums text-slate-100">
                {performancePulse.currentConversions?.toLocaleString() ?? ''}
              </span>
              {performancePulse.conversionsChange7d !== null && (
                <span className={`text-sm font-medium ${getChangeColor(performancePulse.conversionsChange7d)}`}>
                  {getChangeArrow(performancePulse.conversionsChange7d)} {formatChange(performancePulse.conversionsChange7d)}
                </span>
              )}
            </div>
          ) : (
            <span className="text-sm text-slate-500">No data</span>
          )}
        </div>

        {/* SEO Visibility */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Search Clicks (7d)</p>
          {hasData && performancePulse ? (
            <div className="flex items-end justify-between">
              <span className="text-2xl font-bold tabular-nums text-slate-100">
                {performancePulse.currentClicks?.toLocaleString() ?? ''}
              </span>
              {performancePulse.seoVisibilityChange7d !== null && (
                <span className={`text-sm font-medium ${getChangeColor(performancePulse.seoVisibilityChange7d)}`}>
                  {getChangeArrow(performancePulse.seoVisibilityChange7d)} {formatChange(performancePulse.seoVisibilityChange7d)}
                </span>
              )}
            </div>
          ) : (
            <span className="text-sm text-slate-500">No data</span>
          )}
        </div>
      </div>

      {/* Analytics Issues from Pipeline */}
      {analyticsData?.topIssues && analyticsData.topIssues.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <p className="text-xs text-red-400 font-medium mb-2">Analytics Issues</p>
          <ul className="space-y-1">
            {analyticsData.topIssues.map((issue, i) => (
              <li key={i} className="text-xs text-red-300 flex items-start gap-2">
                <span className="text-red-400"></span>
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}
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

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: 'chart' | 'brain' | 'work';
  title: string;
  description: string;
}) {
  return (
    <div className="text-center py-8">
      <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
        {icon === 'chart' && (
          <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        )}
        {icon === 'brain' && (
          <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        )}
        {icon === 'work' && (
          <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        )}
      </div>
      <h3 className="text-sm font-medium text-slate-200 mb-1">{title}</h3>
      <p className="text-xs text-slate-400 max-w-sm mx-auto">{description}</p>
    </div>
  );
}
