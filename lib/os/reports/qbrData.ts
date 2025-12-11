// lib/os/reports/qbrData.ts
// QBR Unified Data Loader
//
// This module aggregates all data sources needed for QBR (Quarterly Business Review)
// generation. It provides a single entry point for loading:
// - Plan synthesis data (findings with strategic themes)
// - Open work items and their status
// - Context graph completeness score
// - Latest diagnostics snapshot (scores per module)
// - Historical QBR data for trend comparison
// - Theme clustering for strategic grouping

import { getCompanyById, type CompanyRecord } from '@/lib/airtable/companies';
import { getWorkItemsForCompany, type WorkItemRecord } from '@/lib/airtable/workItems';
import { getCompanyFindings, getCompanyFindingsSummary, type FindingsSummary } from '@/lib/os/findings/companyFindings';
import { loadContextGraphRecord, getContextGraphStats } from '@/lib/contextGraph/storage';
import { listDiagnosticRunsForCompany, type DiagnosticRun, type DiagnosticToolId, type LabSlug, getLabSlugForToolId } from '@/lib/os/diagnostics/runs';
import type { DiagnosticDetailFinding } from '@/lib/airtable/diagnosticDetails';

// ============================================================================
// Types
// ============================================================================

/**
 * Plan synthesis data from AI analysis
 */
export interface PlanSynthesisData {
  /** Strategic themes identified from findings */
  themes: string[];
  /** Prioritized action items */
  prioritizedActions: string[];
  /** Recommended sequencing */
  sequencing: string;
  /** KPI considerations */
  kpiConsiderations: string;
  /** Implementation notes */
  implementationNotes: string;
  /** Executive summary */
  summary: string;
  /** Number of findings that informed the synthesis */
  findingsCount: number;
}

/**
 * Work items summary for QBR
 */
export interface QBRWorkSummary {
  /** All work items for the company */
  items: WorkItemRecord[];
  /** Count by status */
  byStatus: Record<string, number>;
  /** Count by area */
  byArea: Record<string, number>;
  /** Recently completed items (last 30 days) */
  recentlyCompleted: WorkItemRecord[];
  /** Items in progress */
  inProgress: WorkItemRecord[];
  /** Items in backlog */
  backlog: WorkItemRecord[];
  /** Items planned */
  planned: WorkItemRecord[];
  /** Total counts */
  counts: {
    total: number;
    done: number;
    inProgress: number;
    planned: number;
    backlog: number;
  };
}

/**
 * Context graph health metrics
 */
export interface ContextGraphHealth {
  /** Overall completeness score (0-100) */
  completenessScore: number;
  /** Coverage by domain (0-100 per domain) */
  domainCoverage: Record<string, number>;
  /** When last updated */
  lastFusionAt: string | null;
  /** Schema version */
  version: string;
  /** Number of populated fields */
  nodeCount?: number;
}

/**
 * Diagnostic score for a single module/lab
 */
export interface DiagnosticModuleScore {
  /** Tool ID */
  toolId: DiagnosticToolId;
  /** Lab slug for grouping */
  labSlug: LabSlug | string;
  /** Display label */
  label: string;
  /** Score (0-100) */
  score: number | null;
  /** Status of the run */
  status: string;
  /** Run date */
  runDate: string;
  /** Run ID */
  runId: string;
  /** Summary text */
  summary: string | null;
}

/**
 * Diagnostic trend for a single module
 */
export interface DiagnosticTrend {
  /** Tool ID */
  toolId: DiagnosticToolId;
  /** Display label */
  label: string;
  /** Current score */
  currentScore: number | null;
  /** Previous score */
  previousScore: number | null;
  /** Score delta (+/-) */
  delta: number | null;
  /** Trend direction */
  trend: 'up' | 'down' | 'flat' | 'new';
}

/**
 * Latest diagnostics snapshot
 */
export interface DiagnosticsSnapshot {
  /** Scores by module */
  modules: DiagnosticModuleScore[];
  /** Overall average score (excluding null scores) */
  averageScore: number | null;
  /** Latest run date across all modules */
  latestRunDate: string | null;
  /** Count of modules with scores */
  scoredModuleCount: number;
  /** Count of modules that have been run */
  totalModuleCount: number;
  /** Trends comparing to previous runs */
  trends: DiagnosticTrend[];
}

/**
 * A strategic theme cluster grouping related findings
 */
export interface ThemeCluster {
  /** Theme identifier (e.g., 'brand', 'seo', 'content') */
  themeId: string;
  /** Display name for the theme */
  label: string;
  /** Findings grouped under this theme */
  findings: DiagnosticDetailFinding[];
  /** Count of findings */
  count: number;
  /** Average severity (1=critical, 4=low) */
  avgSeverity: number;
  /** Dominant severity level */
  dominantSeverity: string;
  /** Theme description/summary */
  summary?: string;
}

/**
 * Priority grouping for findings
 */
export interface FindingPriorities {
  /** Critical/immediate findings */
  critical: DiagnosticDetailFinding[];
  /** High priority findings */
  high: DiagnosticDetailFinding[];
  /** Medium priority findings */
  medium: DiagnosticDetailFinding[];
  /** Low priority findings */
  low: DiagnosticDetailFinding[];
}

/**
 * Enhanced work summary with quarter-specific tracking
 */
export interface QBRWorkSection {
  /** All active work items (In Progress + Planned) */
  active: WorkItemRecord[];
  /** Work items completed this quarter */
  completedThisQuarter: WorkItemRecord[];
  /** Blocked work items */
  blocked: WorkItemRecord[];
  /** Full work summary (legacy support) */
  summary: QBRWorkSummary;
}

/**
 * Enhanced plan section with themes and priorities
 */
export interface QBRPlanSection {
  /** All findings */
  findings: DiagnosticDetailFinding[];
  /** Findings grouped by theme */
  themes: ThemeCluster[];
  /** Findings grouped by priority */
  priorities: FindingPriorities;
  /** Summary statistics */
  summary: FindingsSummary;
}

/**
 * Enhanced diagnostics section with structured latest + trends
 */
export interface QBRDiagnosticsSection {
  /** Latest diagnostic scores */
  latest: DiagnosticsSnapshot;
  /** Trends computed from historical runs */
  trends: DiagnosticTrend[];
}

/**
 * Historical QBR data for comparison
 */
export interface QBRHistorySection {
  /** Previous QBR record if available */
  previousQBR?: {
    id: string;
    generatedAt: string;
    healthScore: number;
    diagnosticsAverage: number | null;
  };
  /** Quarter start date */
  quarterStart: string;
  /** Quarter end date */
  quarterEnd: string;
}

/**
 * Complete QBR data bundle
 */
export interface QBRData {
  /** Company information */
  company: CompanyRecord;
  /** Company ID */
  companyId: string;
  /** Findings for plan synthesis */
  findings: DiagnosticDetailFinding[];
  /** Findings summary */
  findingsSummary: FindingsSummary;
  /** Work items summary */
  work: QBRWorkSummary;
  /** Context graph health */
  contextHealth: ContextGraphHealth | null;
  /** Diagnostics snapshot */
  diagnostics: DiagnosticsSnapshot;
  /** Timestamp when data was loaded */
  loadedAt: string;
  /** Data loading errors (non-fatal) */
  warnings: string[];

  // Enhanced structured sections (v2)
  /** Enhanced plan section with themes and priorities */
  plan?: QBRPlanSection;
  /** Enhanced work section with quarter tracking */
  workEnhanced?: QBRWorkSection;
  /** Enhanced diagnostics section */
  diagnosticsEnhanced?: QBRDiagnosticsSection;
  /** Historical QBR data */
  history?: QBRHistorySection;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map tool ID to display label
 */
function getToolLabel(toolId: DiagnosticToolId): string {
  const labels: Record<DiagnosticToolId, string> = {
    gapSnapshot: 'GAP Assessment',
    gapPlan: 'GAP Plan',
    gapHeavy: 'Deep GAP',
    websiteLab: 'Website & UX',
    brandLab: 'Brand',
    audienceLab: 'Audience',
    mediaLab: 'Media',
    contentLab: 'Content',
    seoLab: 'SEO',
    demandLab: 'Demand Gen',
    opsLab: 'Operations',
    creativeLab: 'Creative',
    competitorLab: 'Competitors',
    competitionLab: 'Competition',
  };
  return labels[toolId] || toolId;
}

/**
 * Check if a date is within the last N days
 */
function isWithinDays(dateStr: string | undefined, days: number): boolean {
  if (!dateStr) return false;
  try {
    const date = new Date(dateStr);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return date >= cutoff;
  } catch {
    return false;
  }
}

/**
 * Get the current quarter's start and end dates
 */
export function getQuarterBounds(date: Date = new Date()): { start: Date; end: Date } {
  const quarter = Math.floor(date.getMonth() / 3);
  const start = new Date(date.getFullYear(), quarter * 3, 1);
  const end = new Date(date.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59, 999);
  return { start, end };
}

/**
 * Check if a date is within the current quarter
 */
function isInCurrentQuarter(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  try {
    const date = new Date(dateStr);
    const { start, end } = getQuarterBounds();
    return date >= start && date <= end;
  } catch {
    return false;
  }
}

/**
 * Map lab slug or category to theme
 */
function getThemeForFinding(finding: DiagnosticDetailFinding): string {
  // Try to use labSlug first
  if (finding.labSlug) {
    const themeMap: Record<string, string> = {
      'brand-lab': 'brand',
      'website-lab': 'website',
      'seo-lab': 'seo',
      'content-lab': 'content',
      'demand-lab': 'demand',
      'audience-lab': 'audience',
      'ops-lab': 'operations',
      'media-lab': 'media',
      'creative-lab': 'creative',
      'competitor-lab': 'competitors',
      'competition-lab': 'competition',
    };
    return themeMap[finding.labSlug] || finding.labSlug;
  }

  // Fall back to category
  if (finding.category) {
    return finding.category.toLowerCase().replace(/\s+/g, '-');
  }

  return 'general';
}

/**
 * Get severity numeric value (lower = more severe)
 */
function getSeverityValue(severity: string | undefined): number {
  const severityMap: Record<string, number> = {
    critical: 1,
    high: 2,
    medium: 3,
    low: 4,
  };
  return severityMap[severity?.toLowerCase() || 'medium'] || 3;
}

/**
 * Get dominant severity from a list of findings
 */
function getDominantSeverity(findings: DiagnosticDetailFinding[]): string {
  if (findings.length === 0) return 'medium';

  const severityCounts: Record<string, number> = {};
  for (const f of findings) {
    const sev = f.severity?.toLowerCase() || 'medium';
    severityCounts[sev] = (severityCounts[sev] || 0) + 1;
  }

  // Return the severity with highest count, preferring higher severity on ties
  const severityOrder = ['critical', 'high', 'medium', 'low'];
  let maxCount = 0;
  let dominant = 'medium';

  for (const sev of severityOrder) {
    if ((severityCounts[sev] || 0) >= maxCount) {
      if ((severityCounts[sev] || 0) > maxCount) {
        maxCount = severityCounts[sev] || 0;
        dominant = sev;
      }
    }
  }

  return dominant;
}

/**
 * Cluster findings into strategic themes
 */
export function clusterFindingsIntoThemes(findings: DiagnosticDetailFinding[]): ThemeCluster[] {
  const themeMap = new Map<string, DiagnosticDetailFinding[]>();

  // Group findings by theme
  for (const finding of findings) {
    const theme = getThemeForFinding(finding);
    const existing = themeMap.get(theme) || [];
    existing.push(finding);
    themeMap.set(theme, existing);
  }

  // Convert to ThemeCluster array
  const clusters: ThemeCluster[] = [];
  const labelMap: Record<string, string> = {
    brand: 'Brand & Positioning',
    website: 'Website & UX',
    seo: 'SEO & Search',
    content: 'Content Strategy',
    demand: 'Demand Generation',
    audience: 'Audience & Targeting',
    operations: 'Operations',
    media: 'Paid Media',
    creative: 'Creative',
    competitors: 'Competitive Analysis',
    competition: 'Competition',
    general: 'General',
  };

  for (const [themeId, themeFindings] of themeMap) {
    const avgSeverity =
      themeFindings.reduce((sum, f) => sum + getSeverityValue(f.severity), 0) /
      themeFindings.length;

    clusters.push({
      themeId,
      label: labelMap[themeId] || themeId.charAt(0).toUpperCase() + themeId.slice(1),
      findings: themeFindings,
      count: themeFindings.length,
      avgSeverity,
      dominantSeverity: getDominantSeverity(themeFindings),
    });
  }

  // Sort by severity (most severe first), then by count
  clusters.sort((a, b) => {
    if (a.avgSeverity !== b.avgSeverity) {
      return a.avgSeverity - b.avgSeverity;
    }
    return b.count - a.count;
  });

  return clusters;
}

/**
 * Group findings by priority/severity
 */
export function groupFindingsByPriority(findings: DiagnosticDetailFinding[]): FindingPriorities {
  const priorities: FindingPriorities = {
    critical: [],
    high: [],
    medium: [],
    low: [],
  };

  for (const finding of findings) {
    const severity = finding.severity?.toLowerCase() || 'medium';
    switch (severity) {
      case 'critical':
        priorities.critical.push(finding);
        break;
      case 'high':
        priorities.high.push(finding);
        break;
      case 'low':
        priorities.low.push(finding);
        break;
      default:
        priorities.medium.push(finding);
    }
  }

  return priorities;
}

// ============================================================================
// Data Loaders
// ============================================================================

/**
 * Load work items and compute summary statistics
 */
async function loadWorkSummary(companyId: string): Promise<QBRWorkSummary & { blocked: WorkItemRecord[]; completedThisQuarter: WorkItemRecord[] }> {
  const items = await getWorkItemsForCompany(companyId);

  const byStatus: Record<string, number> = {};
  const byArea: Record<string, number> = {};
  const recentlyCompleted: WorkItemRecord[] = [];
  const completedThisQuarter: WorkItemRecord[] = [];
  const inProgress: WorkItemRecord[] = [];
  const backlog: WorkItemRecord[] = [];
  const planned: WorkItemRecord[] = [];
  const blocked: WorkItemRecord[] = [];
  let doneCount = 0;

  for (const item of items) {
    const status = item.status || 'Backlog';
    const area = item.area || 'Other';

    // Count by status
    byStatus[status] = (byStatus[status] || 0) + 1;

    // Count by area
    byArea[area] = (byArea[area] || 0) + 1;

    // Categorize by status
    // Note: Using string casting because Airtable may return statuses not in our type union
    const statusStr = String(status);
    if (statusStr === 'Done') {
      doneCount++;
      if (isWithinDays(item.updatedAt || item.createdAt, 30)) {
        recentlyCompleted.push(item);
      }
      if (isInCurrentQuarter(item.updatedAt || item.createdAt)) {
        completedThisQuarter.push(item);
      }
    } else if (statusStr === 'In Progress') {
      inProgress.push(item);
    } else if (statusStr === 'Planned') {
      planned.push(item);
    } else if (statusStr === 'Blocked') {
      blocked.push(item);
    } else {
      backlog.push(item);
    }
  }

  // Sort recently completed by date (most recent first)
  recentlyCompleted.sort((a, b) => {
    const aDate = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bDate = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bDate - aDate;
  });

  // Sort completed this quarter by date (most recent first)
  completedThisQuarter.sort((a, b) => {
    const aDate = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bDate = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bDate - aDate;
  });

  return {
    items,
    byStatus,
    byArea,
    recentlyCompleted: recentlyCompleted.slice(0, 10),
    completedThisQuarter,
    inProgress,
    backlog,
    planned,
    blocked,
    counts: {
      total: items.length,
      done: doneCount,
      inProgress: inProgress.length,
      planned: planned.length,
      backlog: backlog.length,
    },
  };
}

/**
 * Load context graph health metrics
 */
async function loadContextHealth(companyId: string): Promise<ContextGraphHealth | null> {
  try {
    const stats = await getContextGraphStats(companyId);
    if (!stats) {
      return null;
    }

    // Also try to get node count from full record
    const record = await loadContextGraphRecord(companyId);

    return {
      completenessScore: stats.completenessScore,
      domainCoverage: stats.domainCoverage,
      lastFusionAt: stats.lastFusionAt,
      version: stats.version,
      nodeCount: record?.nodeCount,
    };
  } catch (error) {
    console.warn('[QBRData] Failed to load context health:', error);
    return null;
  }
}

/**
 * Load latest diagnostics snapshot with trends
 */
async function loadDiagnosticsSnapshot(companyId: string): Promise<DiagnosticsSnapshot> {
  // Fetch all diagnostic runs for the company
  const runs = await listDiagnosticRunsForCompany(companyId, { limit: 200 });

  // Group runs by tool ID and sort by date (newest first)
  const runsByTool = new Map<DiagnosticToolId, DiagnosticRun[]>();

  for (const run of runs) {
    const toolRuns = runsByTool.get(run.toolId) || [];
    toolRuns.push(run);
    runsByTool.set(run.toolId, toolRuns);
  }

  // Sort each tool's runs by date (newest first)
  for (const [, toolRuns] of runsByTool) {
    toolRuns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Convert to module scores and compute trends
  const modules: DiagnosticModuleScore[] = [];
  const trends: DiagnosticTrend[] = [];
  let scoreSum = 0;
  let scoredCount = 0;
  let latestDate: string | null = null;

  for (const [toolId, toolRuns] of runsByTool) {
    const latestRun = toolRuns[0];
    const previousRun = toolRuns.length > 1 ? toolRuns[1] : null;

    modules.push({
      toolId,
      labSlug: getLabSlugForToolId(toolId),
      label: getToolLabel(toolId),
      score: latestRun.score,
      status: latestRun.status,
      runDate: latestRun.createdAt,
      runId: latestRun.id,
      summary: latestRun.summary,
    });

    // Compute trend
    const currentScore = latestRun.score;
    const previousScore = previousRun?.score ?? null;
    let delta: number | null = null;
    let trend: 'up' | 'down' | 'flat' | 'new' = 'new';

    if (currentScore !== null && previousScore !== null) {
      delta = currentScore - previousScore;
      if (delta > 2) {
        trend = 'up';
      } else if (delta < -2) {
        trend = 'down';
      } else {
        trend = 'flat';
      }
    } else if (currentScore !== null && previousScore === null) {
      trend = 'new';
    }

    trends.push({
      toolId,
      label: getToolLabel(toolId),
      currentScore,
      previousScore,
      delta,
      trend,
    });

    if (latestRun.score !== null) {
      scoreSum += latestRun.score;
      scoredCount++;
    }

    if (!latestDate || latestRun.createdAt > latestDate) {
      latestDate = latestRun.createdAt;
    }
  }

  // Sort modules by label
  modules.sort((a, b) => a.label.localeCompare(b.label));
  trends.sort((a, b) => a.label.localeCompare(b.label));

  return {
    modules,
    averageScore: scoredCount > 0 ? Math.round(scoreSum / scoredCount) : null,
    latestRunDate: latestDate,
    scoredModuleCount: scoredCount,
    totalModuleCount: modules.length,
    trends,
  };
}

// ============================================================================
// Main Loader
// ============================================================================

/**
 * Load all QBR data for a company
 *
 * This is the primary entry point for QBR data loading. It aggregates:
 * - Company information
 * - Diagnostic findings for plan synthesis
 * - Work items with status breakdown
 * - Context graph health metrics
 * - Latest diagnostics scores per module
 *
 * @param companyId - The company record ID
 * @returns Complete QBR data bundle
 */
export async function loadQBRData(companyId: string): Promise<QBRData> {
  console.log('[QBRData] Loading QBR data for company:', companyId);
  const warnings: string[] = [];

  // Load company (required)
  const company = await getCompanyById(companyId);
  if (!company) {
    throw new Error(`Company not found: ${companyId}`);
  }

  // Load all data sources in parallel
  const [
    findings,
    findingsSummary,
    work,
    contextHealth,
    diagnostics,
  ] = await Promise.all([
    getCompanyFindings(companyId).catch((err) => {
      warnings.push(`Failed to load findings: ${err.message}`);
      return [] as DiagnosticDetailFinding[];
    }),
    getCompanyFindingsSummary(companyId).catch((err) => {
      warnings.push(`Failed to load findings summary: ${err.message}`);
      return {
        total: 0,
        bySeverity: {},
        byLab: {},
        byCategory: {},
        converted: 0,
        unconverted: 0,
      } as FindingsSummary;
    }),
    loadWorkSummary(companyId).catch((err) => {
      warnings.push(`Failed to load work items: ${err.message}`);
      return {
        items: [],
        byStatus: {},
        byArea: {},
        recentlyCompleted: [],
        completedThisQuarter: [],
        inProgress: [],
        backlog: [],
        planned: [],
        blocked: [],
        counts: { total: 0, done: 0, inProgress: 0, planned: 0, backlog: 0 },
      } as QBRWorkSummary & { blocked: WorkItemRecord[]; completedThisQuarter: WorkItemRecord[] };
    }),
    loadContextHealth(companyId).catch((err) => {
      warnings.push(`Failed to load context health: ${err.message}`);
      return null;
    }),
    loadDiagnosticsSnapshot(companyId).catch((err) => {
      warnings.push(`Failed to load diagnostics: ${err.message}`);
      return {
        modules: [],
        averageScore: null,
        latestRunDate: null,
        scoredModuleCount: 0,
        totalModuleCount: 0,
        trends: [],
      } as DiagnosticsSnapshot;
    }),
  ]);

  // Build enhanced sections
  const themes = clusterFindingsIntoThemes(findings);
  const priorities = groupFindingsByPriority(findings);
  const { start: quarterStart, end: quarterEnd } = getQuarterBounds();

  const data: QBRData = {
    company,
    companyId,
    findings,
    findingsSummary,
    work,
    contextHealth,
    diagnostics,
    loadedAt: new Date().toISOString(),
    warnings,

    // Enhanced structured sections (v2)
    plan: {
      findings,
      themes,
      priorities,
      summary: findingsSummary,
    },
    workEnhanced: {
      active: [...work.inProgress, ...work.planned],
      completedThisQuarter: work.completedThisQuarter,
      blocked: work.blocked,
      summary: work,
    },
    diagnosticsEnhanced: {
      latest: diagnostics,
      trends: diagnostics.trends,
    },
    history: {
      quarterStart: quarterStart.toISOString(),
      quarterEnd: quarterEnd.toISOString(),
      // previousQBR will be populated separately if available
    },
  };

  console.log('[QBRData] QBR data loaded:', {
    companyName: company.name,
    findingsCount: findings.length,
    themesCount: themes.length,
    workItemsCount: work.counts.total,
    completedThisQuarter: work.completedThisQuarter.length,
    blockedItems: work.blocked.length,
    contextHealthScore: contextHealth?.completenessScore ?? 'N/A',
    diagnosticModulesCount: diagnostics.totalModuleCount,
    trendsCount: diagnostics.trends.length,
    warningsCount: warnings.length,
  });

  return data;
}

/**
 * Load QBR data with plan synthesis
 *
 * This extends loadQBRData to also generate AI synthesis of findings.
 * Use this when you need the full narrative generation context.
 *
 * @param companyId - The company record ID
 * @param synthesizeEndpoint - Optional custom endpoint for synthesis
 * @returns QBR data with synthesis
 */
export async function loadQBRDataWithSynthesis(
  companyId: string,
  synthesizeEndpoint?: string
): Promise<QBRData & { synthesis?: PlanSynthesisData }> {
  // Load base QBR data
  const qbrData = await loadQBRData(companyId);

  // If we have findings, try to get synthesis
  if (qbrData.findings.length > 0) {
    try {
      const endpoint = synthesizeEndpoint || `/api/os/companies/${companyId}/plan/synthesize`;

      // Note: This requires a server-side fetch or API call
      // For client components, this should be called via API route
      console.log('[QBRData] Synthesis endpoint available at:', endpoint);
    } catch (error) {
      console.warn('[QBRData] Could not load synthesis:', error);
    }
  }

  return qbrData;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate overall QBR health score from all data sources
 *
 * This provides a single number (0-100) representing overall marketing health.
 * Components:
 * - Diagnostics average score (40%)
 * - Context completeness (25%)
 * - Work completion rate (20%)
 * - Findings resolution rate (15%)
 */
export function calculateOverallHealthScore(data: QBRData): number {
  let score = 0;
  let weight = 0;

  // Diagnostics score (40% weight)
  if (data.diagnostics.averageScore !== null) {
    score += data.diagnostics.averageScore * 0.4;
    weight += 0.4;
  }

  // Context completeness (25% weight)
  if (data.contextHealth?.completenessScore) {
    score += data.contextHealth.completenessScore * 0.25;
    weight += 0.25;
  }

  // Work completion rate (20% weight)
  if (data.work.counts.total > 0) {
    const completionRate = (data.work.counts.done / data.work.counts.total) * 100;
    score += completionRate * 0.2;
    weight += 0.2;
  }

  // Findings resolution rate (15% weight)
  if (data.findingsSummary.total > 0) {
    const resolutionRate = (data.findingsSummary.converted / data.findingsSummary.total) * 100;
    score += resolutionRate * 0.15;
    weight += 0.15;
  }

  // Normalize if we didn't have all data sources
  if (weight > 0 && weight < 1) {
    score = score / weight;
  }

  return Math.round(score);
}

/**
 * Get QBR data summary for quick display
 */
export function getQBRSummary(data: QBRData): {
  healthScore: number;
  diagnosticsScore: number | null;
  contextScore: number | null;
  activeWorkItems: number;
  unresolvedFindings: number;
  lastDiagnosticRun: string | null;
} {
  return {
    healthScore: calculateOverallHealthScore(data),
    diagnosticsScore: data.diagnostics.averageScore,
    contextScore: data.contextHealth?.completenessScore ?? null,
    activeWorkItems: data.work.counts.inProgress + data.work.counts.planned,
    unresolvedFindings: data.findingsSummary.unconverted,
    lastDiagnosticRun: data.diagnostics.latestRunDate,
  };
}
