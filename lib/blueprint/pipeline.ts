// lib/blueprint/pipeline.ts
// Blueprint Data Pipeline
//
// This module fetches and synthesizes all company data needed for
// strategic Blueprint generation:
// - Diagnostics (GAP, Website Lab, Brand Lab, etc.)
// - Analytics (GA4, GSC, performance trends)
// - Brain (client insights, strategic notes)
// - Work status (in-progress, completed, overdue)

import {
  getRunsGroupedByTool,
  getLatestRunForCompanyAndTool,
  type DiagnosticRun,
  type DiagnosticToolId,
} from '@/lib/os/diagnostics/runs';
import { getWorkItemsForCompany, type WorkItemRecord } from '@/lib/airtable/workItems';
import { getPerformancePulse, type PerformancePulse } from '@/lib/os/analytics/performancePulse';
import {
  COMPANY_TOOL_DEFS,
  type CompanyToolDefinition,
} from '@/lib/tools/registry';

// ============================================================================
// Types
// ============================================================================

/**
 * Issue extracted from a diagnostic run
 */
export interface DiagnosticIssue {
  title: string;
  description?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  area: string;
  toolId: DiagnosticToolId;
  toolLabel: string;
}

/**
 * Recommendation extracted from a diagnostic run
 */
export interface DiagnosticRecommendation {
  title: string;
  description?: string;
  priority: 'high' | 'medium' | 'low';
  impact?: 'high' | 'medium' | 'low';
  effort?: 'low' | 'medium' | 'high';
  area: string;
  toolId: DiagnosticToolId;
  toolLabel: string;
}

/**
 * Tool run status for intelligence layer
 */
export interface ToolRunStatus {
  toolId: DiagnosticToolId;
  toolLabel: string;
  status: 'not-run' | 'stale' | 'recent' | 'running';
  lastRunAt: string | null;
  daysAgo: number | null;
  score: number | null;
  recommendation?: string;
}

/**
 * Aggregated diagnostics data
 */
export interface DiagnosticsData {
  runs: Record<DiagnosticToolId, DiagnosticRun[]>;
  latestByTool: Record<DiagnosticToolId, DiagnosticRun | null>;
  issues: DiagnosticIssue[];
  recommendations: DiagnosticRecommendation[];
  toolStatuses: ToolRunStatus[];
  overallScore: number | null;
  scores: {
    website: number | null;
    brand: number | null;
    seo: number | null;
    content: number | null;
    gap: number | null;
  };
}

/**
 * Analytics data for the pipeline
 */
export interface AnalyticsData {
  performancePulse: PerformancePulse | null;
  trafficTrend: 'up' | 'down' | 'stable' | 'unknown';
  conversionTrend: 'up' | 'down' | 'stable' | 'unknown';
  seoTrend: 'up' | 'down' | 'stable' | 'unknown';
  topIssues: string[];
  hasAnomalies: boolean;
  anomalySummary: string | null;
}

/**
 * Brain/insights data for the pipeline
 */
export interface BrainData {
  totalInsights: number;
  recentInsightsCount: number;
  byCategory: Record<string, number>;
  strategicNotes: string[];
  keyPriorities: string[];
  summary: string | null;
}

/**
 * Work status data for the pipeline
 */
export interface WorkData {
  total: number;
  inProgress: WorkItemRecord[];
  completed: WorkItemRecord[];
  overdue: WorkItemRecord[];
  backlog: WorkItemRecord[];
  recentlyCompleted: WorkItemRecord[];
  byArea: Record<string, number>;
}

/**
 * Complete pipeline output
 */
export interface BlueprintPipelineData {
  companyId: string;
  fetchedAt: string;
  diagnostics: DiagnosticsData;
  analytics: AnalyticsData;
  brain: BrainData;
  work: WorkData;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getToolLabel(toolId: DiagnosticToolId): string {
  const tool = COMPANY_TOOL_DEFS.find(t => t.diagnosticToolId === toolId);
  return tool?.label || toolId;
}

function extractIssuesFromRun(run: DiagnosticRun): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];
  const raw = run.rawJson as Record<string, unknown> | undefined;

  if (!raw) return issues;

  // Extract from siteAssessment (Website Lab)
  const siteAssessment = raw.siteAssessment as Record<string, unknown> | undefined;
  if (siteAssessment?.issues && Array.isArray(siteAssessment.issues)) {
    for (const issue of siteAssessment.issues.slice(0, 5)) {
      const i = issue as Record<string, unknown>;
      issues.push({
        title: String(i.title || i.issue || 'Unknown issue'),
        description: i.description ? String(i.description) : undefined,
        severity: normalizeSeverity(i.severity || i.priority),
        area: String(i.area || i.category || 'Website'),
        toolId: run.toolId,
        toolLabel: getToolLabel(run.toolId),
      });
    }
  }

  // Extract from rawEvidence.labResultV4 (Website Lab V4)
  const rawEvidence = raw.rawEvidence as Record<string, unknown> | undefined;
  if (rawEvidence?.labResultV4) {
    const labResult = rawEvidence.labResultV4 as Record<string, unknown>;
    const labSiteAssessment = labResult.siteAssessment as Record<string, unknown> | undefined;
    if (labSiteAssessment?.criticalIssues && Array.isArray(labSiteAssessment.criticalIssues)) {
      for (const issue of labSiteAssessment.criticalIssues.slice(0, 3)) {
        const i = issue as Record<string, unknown>;
        issues.push({
          title: String(i.title || i.issue || 'Critical issue'),
          description: i.description ? String(i.description) : undefined,
          severity: 'critical',
          area: 'Website',
          toolId: run.toolId,
          toolLabel: getToolLabel(run.toolId),
        });
      }
    }
  }

  // Extract from initialAssessment (GAP-IA)
  const initialAssessment = raw.initialAssessment as Record<string, unknown> | undefined;
  if (initialAssessment?.dimensions && Array.isArray(initialAssessment.dimensions)) {
    for (const dim of initialAssessment.dimensions) {
      const d = dim as Record<string, unknown>;
      if (d.score !== undefined && typeof d.score === 'number' && d.score < 50) {
        const gaps = d.gaps as string[] | undefined;
        if (gaps && gaps.length > 0) {
          issues.push({
            title: `Low ${String(d.name || d.dimension)} score (${d.score}/100)`,
            description: gaps.slice(0, 2).join('; '),
            severity: d.score < 30 ? 'critical' : 'high',
            area: String(d.name || d.dimension || 'Strategy'),
            toolId: run.toolId,
            toolLabel: getToolLabel(run.toolId),
          });
        }
      }
    }
  }

  // Extract from modules (GAP Heavy)
  if (raw.modules && Array.isArray(raw.modules)) {
    for (const mod of raw.modules) {
      const m = mod as Record<string, unknown>;
      if (m.issues && Array.isArray(m.issues)) {
        for (const issue of (m.issues as Array<Record<string, unknown>>).slice(0, 3)) {
          issues.push({
            title: String(issue.title || issue.issue || 'Issue'),
            description: issue.description ? String(issue.description) : undefined,
            severity: normalizeSeverity(issue.severity || issue.priority),
            area: String(m.module || m.area || 'Marketing'),
            toolId: run.toolId,
            toolLabel: getToolLabel(run.toolId),
          });
        }
      }
    }
  }

  return issues;
}

function extractRecommendationsFromRun(run: DiagnosticRun): DiagnosticRecommendation[] {
  const recs: DiagnosticRecommendation[] = [];
  const raw = run.rawJson as Record<string, unknown> | undefined;

  if (!raw) return recs;

  // Extract from siteAssessment (Website Lab)
  const siteAssessment = raw.siteAssessment as Record<string, unknown> | undefined;
  if (siteAssessment?.recommendations && Array.isArray(siteAssessment.recommendations)) {
    for (const rec of siteAssessment.recommendations.slice(0, 5)) {
      const r = rec as Record<string, unknown>;
      recs.push({
        title: String(r.title || r.recommendation || 'Recommendation'),
        description: r.description ? String(r.description) : undefined,
        priority: normalizePriority(r.priority),
        impact: normalizeImpactEffort(r.impact),
        effort: normalizeImpactEffort(r.effort),
        area: String(r.area || r.category || 'Website'),
        toolId: run.toolId,
        toolLabel: getToolLabel(run.toolId),
      });
    }
  }

  // Extract quickWins
  if (siteAssessment?.quickWins && Array.isArray(siteAssessment.quickWins)) {
    for (const win of siteAssessment.quickWins.slice(0, 3)) {
      const w = win as Record<string, unknown>;
      recs.push({
        title: String(w.title || w.win || 'Quick Win'),
        description: w.description ? String(w.description) : undefined,
        priority: 'high',
        impact: 'high',
        effort: 'low',
        area: 'Website',
        toolId: run.toolId,
        toolLabel: getToolLabel(run.toolId),
      });
    }
  }

  // Extract from initialAssessment.dimensions (GAP-IA)
  const initialAssessment = raw.initialAssessment as Record<string, unknown> | undefined;
  if (initialAssessment?.dimensions && Array.isArray(initialAssessment.dimensions)) {
    for (const dim of initialAssessment.dimensions) {
      const d = dim as Record<string, unknown>;
      const recommendations = d.recommendations as string[] | undefined;
      if (recommendations && recommendations.length > 0) {
        for (const recText of recommendations.slice(0, 2)) {
          recs.push({
            title: recText,
            priority: typeof d.score === 'number' && d.score < 50 ? 'high' : 'medium',
            area: String(d.name || d.dimension || 'Strategy'),
            toolId: run.toolId,
            toolLabel: getToolLabel(run.toolId),
          });
        }
      }
    }
  }

  return recs;
}

function normalizeSeverity(value: unknown): 'critical' | 'high' | 'medium' | 'low' {
  if (!value) return 'medium';
  const str = String(value).toLowerCase();
  if (str.includes('critical') || str === 'p0') return 'critical';
  if (str.includes('high') || str === 'p1') return 'high';
  if (str.includes('low') || str === 'p3') return 'low';
  return 'medium';
}

function normalizePriority(value: unknown): 'high' | 'medium' | 'low' {
  if (!value) return 'medium';
  const str = String(value).toLowerCase();
  if (str.includes('high') || str === 'p0' || str === 'p1') return 'high';
  if (str.includes('low') || str === 'p3') return 'low';
  return 'medium';
}

function normalizeImpactEffort(value: unknown): 'high' | 'medium' | 'low' | undefined {
  if (!value) return undefined;
  const str = String(value).toLowerCase();
  if (str.includes('high') || str === 'h' || str === 'l') return 'high';
  if (str.includes('low') || str === 'l' || str === 'xs' || str === 's') return 'low';
  return 'medium';
}

function calculateDaysAgo(dateStr: string | null): number | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

function getToolRunStatus(
  toolId: DiagnosticToolId,
  runs: DiagnosticRun[],
  analyticsData: AnalyticsData | null,
  diagnosticsData: Partial<DiagnosticsData>
): ToolRunStatus {
  const toolLabel = getToolLabel(toolId);
  const latestRun = runs
    .filter(r => r.status === 'complete' || r.status === 'running')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  if (!latestRun) {
    return {
      toolId,
      toolLabel,
      status: 'not-run',
      lastRunAt: null,
      daysAgo: null,
      score: null,
      recommendation: `Run ${toolLabel} to get initial baseline data`,
    };
  }

  if (latestRun.status === 'running') {
    return {
      toolId,
      toolLabel,
      status: 'running',
      lastRunAt: latestRun.createdAt,
      daysAgo: calculateDaysAgo(latestRun.createdAt),
      score: null,
    };
  }

  const daysAgo = calculateDaysAgo(latestRun.createdAt);
  const isStale = daysAgo !== null && daysAgo > 30;

  // Generate contextual recommendations
  let recommendation: string | undefined;
  if (isStale) {
    recommendation = `${toolLabel} is ${daysAgo} days old - consider re-running for fresh data`;

    // Add context from analytics if available
    if (analyticsData) {
      if (toolId === 'websiteLab' && analyticsData.conversionTrend === 'down') {
        recommendation = `Conversions are down - re-run ${toolLabel} to identify UX issues`;
      }
      if (toolId === 'seoLab' && analyticsData.seoTrend === 'down') {
        recommendation = `SEO visibility dropped - re-run ${toolLabel} to investigate`;
      }
    }
  }

  return {
    toolId,
    toolLabel,
    status: isStale ? 'stale' : 'recent',
    lastRunAt: latestRun.createdAt,
    daysAgo,
    score: latestRun.score,
    recommendation,
  };
}

function getTrendFromChange(change: number | null): 'up' | 'down' | 'stable' | 'unknown' {
  if (change === null) return 'unknown';
  if (change > 5) return 'up';
  if (change < -5) return 'down';
  return 'stable';
}

// ============================================================================
// Main Pipeline Functions
// ============================================================================

/**
 * Fetch all diagnostics data for a company
 */
export async function fetchDiagnosticsData(companyId: string): Promise<DiagnosticsData> {
  console.log('[BlueprintPipeline] Fetching diagnostics for:', companyId);

  const runs = await getRunsGroupedByTool(companyId);

  // Get latest complete run for each tool
  const latestByTool: Record<DiagnosticToolId, DiagnosticRun | null> = {
    gapSnapshot: null,
    gapPlan: null,
    gapHeavy: null,
    websiteLab: null,
    brandLab: null,
    contentLab: null,
    seoLab: null,
    demandLab: null,
    opsLab: null,
    creativeLab: null,
  };

  for (const toolId of Object.keys(runs) as DiagnosticToolId[]) {
    const toolRuns = runs[toolId];
    const completedRuns = toolRuns.filter(r => r.status === 'complete');
    if (completedRuns.length > 0) {
      completedRuns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      latestByTool[toolId] = completedRuns[0];
    }
  }

  // Extract issues and recommendations from all latest runs
  const issues: DiagnosticIssue[] = [];
  const recommendations: DiagnosticRecommendation[] = [];

  for (const toolId of Object.keys(latestByTool) as DiagnosticToolId[]) {
    const run = latestByTool[toolId];
    if (run) {
      issues.push(...extractIssuesFromRun(run));
      recommendations.push(...extractRecommendationsFromRun(run));
    }
  }

  // Sort issues by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Sort recommendations by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Calculate scores
  const scores = {
    website: latestByTool.websiteLab?.score ?? null,
    brand: latestByTool.brandLab?.score ?? null,
    seo: latestByTool.seoLab?.score ?? null,
    content: latestByTool.contentLab?.score ?? null,
    gap: latestByTool.gapSnapshot?.score ?? latestByTool.gapPlan?.score ?? latestByTool.gapHeavy?.score ?? null,
  };

  // Calculate overall score (weighted average of available scores)
  const availableScores = Object.values(scores).filter((s): s is number => s !== null);
  const overallScore = availableScores.length > 0
    ? Math.round(availableScores.reduce((sum, s) => sum + s, 0) / availableScores.length)
    : null;

  // Build tool statuses (will be updated with analytics context later)
  const toolStatuses: ToolRunStatus[] = [];
  for (const toolId of Object.keys(runs) as DiagnosticToolId[]) {
    toolStatuses.push(getToolRunStatus(toolId, runs[toolId], null, { scores }));
  }

  return {
    runs,
    latestByTool,
    issues: issues.slice(0, 15), // Top 15 issues
    recommendations: recommendations.slice(0, 15), // Top 15 recommendations
    toolStatuses,
    overallScore,
    scores,
  };
}

/**
 * Fetch analytics data for a company
 */
export async function fetchAnalyticsData(companyId: string): Promise<AnalyticsData> {
  console.log('[BlueprintPipeline] Fetching analytics for:', companyId);

  let performancePulse: PerformancePulse | null = null;

  try {
    performancePulse = await getPerformancePulse();
  } catch (error) {
    console.warn('[BlueprintPipeline] Failed to fetch performance pulse:', error);
  }

  const trafficTrend = getTrendFromChange(performancePulse?.trafficChange7d ?? null);
  const conversionTrend = getTrendFromChange(performancePulse?.conversionsChange7d ?? null);
  const seoTrend = getTrendFromChange(performancePulse?.seoVisibilityChange7d ?? null);

  // Generate top issues from analytics
  const topIssues: string[] = [];
  if (trafficTrend === 'down' && performancePulse?.trafficChange7d) {
    topIssues.push(`Traffic dropped ${Math.abs(performancePulse.trafficChange7d)}% week-over-week`);
  }
  if (conversionTrend === 'down' && performancePulse?.conversionsChange7d) {
    topIssues.push(`Conversions dropped ${Math.abs(performancePulse.conversionsChange7d)}% week-over-week`);
  }
  if (seoTrend === 'down' && performancePulse?.seoVisibilityChange7d) {
    topIssues.push(`SEO visibility dropped ${Math.abs(performancePulse.seoVisibilityChange7d)}% week-over-week`);
  }

  return {
    performancePulse,
    trafficTrend,
    conversionTrend,
    seoTrend,
    topIssues,
    hasAnomalies: performancePulse?.hasAnomalies ?? false,
    anomalySummary: performancePulse?.anomalySummary ?? null,
  };
}

/**
 * Fetch Brain/insights data for a company
 */
export async function fetchBrainData(companyId: string): Promise<BrainData> {
  console.log('[BlueprintPipeline] Fetching brain data for:', companyId);

  // For now, return placeholder data
  // This will be enhanced when Brain APIs are fully implemented
  return {
    totalInsights: 0,
    recentInsightsCount: 0,
    byCategory: {},
    strategicNotes: [],
    keyPriorities: [],
    summary: null,
  };
}

/**
 * Fetch work items data for a company
 */
export async function fetchWorkData(companyId: string): Promise<WorkData> {
  console.log('[BlueprintPipeline] Fetching work data for:', companyId);

  const workItems = await getWorkItemsForCompany(companyId);
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const inProgress = workItems.filter(w => w.status === 'In Progress');
  const completed = workItems.filter(w => w.status === 'Done');
  const backlog = workItems.filter(w => w.status === 'Backlog');
  const planned = workItems.filter(w => w.status === 'Planned');

  // Find overdue items (has due date in the past, not done)
  const overdue = workItems.filter(w => {
    if (w.status === 'Done') return false;
    if (!w.dueDate) return false;
    return new Date(w.dueDate) < now;
  });

  // Recently completed (within last week)
  const recentlyCompleted = completed.filter(w => {
    if (!w.updatedAt) return false;
    return new Date(w.updatedAt) >= oneWeekAgo;
  });

  // Group by area
  const byArea: Record<string, number> = {};
  for (const item of workItems) {
    const area = item.area || 'Other';
    byArea[area] = (byArea[area] || 0) + 1;
  }

  return {
    total: workItems.length,
    inProgress,
    completed,
    overdue,
    backlog: [...backlog, ...planned],
    recentlyCompleted,
    byArea,
  };
}

/**
 * Run the complete Blueprint pipeline
 */
export async function runBlueprintPipeline(companyId: string): Promise<BlueprintPipelineData> {
  console.log('[BlueprintPipeline] Running full pipeline for:', companyId);

  const [diagnostics, analytics, brain, work] = await Promise.all([
    fetchDiagnosticsData(companyId),
    fetchAnalyticsData(companyId),
    fetchBrainData(companyId),
    fetchWorkData(companyId),
  ]);

  // Update tool statuses with analytics context
  for (const status of diagnostics.toolStatuses) {
    if (status.status === 'stale') {
      // Add analytics-aware recommendations
      if (status.toolId === 'websiteLab' && analytics.conversionTrend === 'down') {
        status.recommendation = `Conversions are down ${Math.abs(analytics.performancePulse?.conversionsChange7d || 0)}% - re-run Website Lab to identify UX issues`;
      }
      if (status.toolId === 'seoLab' && analytics.seoTrend === 'down') {
        status.recommendation = `SEO visibility dropped ${Math.abs(analytics.performancePulse?.seoVisibilityChange7d || 0)}% - re-run SEO Lab to investigate`;
      }
    }
  }

  return {
    companyId,
    fetchedAt: new Date().toISOString(),
    diagnostics,
    analytics,
    brain,
    work,
  };
}

// ============================================================================
// Convenience Exports
// ============================================================================

export type {
  DiagnosticRun,
  DiagnosticToolId,
  WorkItemRecord,
  PerformancePulse,
};
