// lib/os/reports/annualPlanData.ts
// Annual Plan Unified Data Loader
//
// This module aggregates all strategic data needed for Annual Plan generation.
// It provides a comprehensive 12-month view of:
// - Diagnostic trends and maturity
// - Strategic themes from findings
// - Work execution patterns
// - Audience & brand signals
// - Context graph data

import { getCompanyById, type CompanyRecord } from '@/lib/airtable/companies';
import { getWorkItemsForCompany, type WorkItemRecord } from '@/lib/airtable/workItems';
import { getCompanyFindings, type FindingsSummary } from '@/lib/os/findings/companyFindings';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { listDiagnosticRunsForCompany, type DiagnosticRun, type DiagnosticToolId, getLabSlugForToolId } from '@/lib/os/diagnostics/runs';
import type { DiagnosticDetailFinding } from '@/lib/airtable/diagnosticDetails';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import { clusterFindingsIntoThemes, type ThemeCluster } from './qbrData';

// ============================================================================
// Types
// ============================================================================

/**
 * Diagnostic module summary for annual view
 */
export interface DiagnosticModuleSummary {
  toolId: DiagnosticToolId;
  label: string;
  runs: {
    date: string;
    score: number | null;
    runId: string;
  }[];
  latestScore: number | null;
  averageScore: number | null;
  trend: 'improving' | 'declining' | 'stable' | 'new';
  runCount: number;
}

/**
 * Diagnostics trend summary for year
 */
export interface DiagnosticsTrendSummary {
  modules: DiagnosticModuleSummary[];
  overallTrend: 'improving' | 'declining' | 'stable' | 'insufficient-data';
  averageImprovement: number | null;
  strongestArea: string | null;
  weakestArea: string | null;
}

/**
 * Marketing maturity level based on diagnostics
 */
export type MaturityLevel = 'foundational' | 'developing' | 'established' | 'advanced' | 'leading';

/**
 * Audience model extracted from context graph
 */
export interface AudienceModel {
  primaryAudience: string | null;
  primaryBuyerRoles: string[];
  coreSegments: string[];
  painPoints: string[];
  motivations: string[];
  audienceNeeds: string[];
  demographics: string | null;
  geos: string | null;
  buyerJourney: string | null;
}

/**
 * Brand signals extracted from context graph
 */
export interface BrandSignals {
  positioning: string | null;
  tagline: string | null;
  missionStatement: string | null;
  valueProps: string[];
  differentiators: string[];
  toneOfVoice: string | null;
  brandPersonality: string | null;
  brandStrengths: string[];
  brandWeaknesses: string[];
  competitivePosition: string | null;
}

/**
 * Work execution summary
 */
export interface WorkExecutionSummary {
  completed: WorkItemRecord[];
  backlog: WorkItemRecord[];
  inProgress: WorkItemRecord[];
  totalCompleted: number;
  totalBacklog: number;
  completionRate: number;
  byArea: Record<string, number>;
  averageCompletionTime: number | null;
}

/**
 * Strategic pattern identified from data
 */
export interface StrategicPattern {
  type: 'repeated-issue' | 'cross-theme-dependency' | 'critical-failure' | 'strength' | 'opportunity';
  title: string;
  description: string;
  themes: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  evidence: string[];
}

/**
 * Complete Annual Plan data bundle
 */
export interface AnnualPlanData {
  /** Company information */
  company: CompanyRecord;
  /** Company ID */
  companyId: string;
  /** Diagnostics data */
  diagnostics: {
    all: DiagnosticModuleSummary[];
    trends: DiagnosticsTrendSummary;
    maturity: MaturityLevel;
    overallScore: number | null;
  };
  /** Strategic themes from findings */
  themes: ThemeCluster[];
  /** All findings */
  findings: DiagnosticDetailFinding[];
  /** Work execution data */
  work: WorkExecutionSummary;
  /** Audience model */
  audience: AudienceModel | null;
  /** Brand signals */
  brand: BrandSignals | null;
  /** Full context graph */
  context: CompanyContextGraph | null;
  /** Strategic patterns identified */
  strategicPatterns: StrategicPattern[];
  /** Data coverage metrics */
  coverage: {
    diagnosticsMonths: number;
    hasAudienceData: boolean;
    hasBrandData: boolean;
    hasContextGraph: boolean;
    hasWorkHistory: boolean;
    overallReadiness: number;
  };
  /** When data was loaded */
  loadedAt: string;
  /** Warnings during loading */
  warnings: string[];
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
 * Calculate maturity level from average score
 */
function calculateMaturityLevel(averageScore: number | null): MaturityLevel {
  if (averageScore === null) return 'foundational';
  if (averageScore >= 85) return 'leading';
  if (averageScore >= 70) return 'advanced';
  if (averageScore >= 55) return 'established';
  if (averageScore >= 40) return 'developing';
  return 'foundational';
}

/**
 * Get date 12 months ago
 */
function getTwelveMonthsAgo(): Date {
  const date = new Date();
  date.setMonth(date.getMonth() - 12);
  return date;
}

/**
 * Calculate trend from run scores
 */
function calculateModuleTrend(runs: { score: number | null }[]): 'improving' | 'declining' | 'stable' | 'new' {
  const scoredRuns = runs.filter(r => r.score !== null);
  if (scoredRuns.length < 2) return 'new';

  const firstHalf = scoredRuns.slice(Math.floor(scoredRuns.length / 2));
  const secondHalf = scoredRuns.slice(0, Math.floor(scoredRuns.length / 2));

  const firstAvg = firstHalf.reduce((sum, r) => sum + (r.score || 0), 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, r) => sum + (r.score || 0), 0) / secondHalf.length;

  const delta = secondAvg - firstAvg;
  if (delta > 5) return 'improving';
  if (delta < -5) return 'declining';
  return 'stable';
}

// ============================================================================
// Data Loaders
// ============================================================================

/**
 * Load 12 months of diagnostic runs and compute summaries
 */
async function loadDiagnosticsSummary(companyId: string): Promise<{
  all: DiagnosticModuleSummary[];
  trends: DiagnosticsTrendSummary;
  maturity: MaturityLevel;
  overallScore: number | null;
}> {
  const twelveMonthsAgo = getTwelveMonthsAgo();
  const runs = await listDiagnosticRunsForCompany(companyId, { limit: 500 });

  // Filter to last 12 months
  const recentRuns = runs.filter(r => new Date(r.createdAt) >= twelveMonthsAgo);

  // Group by tool
  const runsByTool = new Map<DiagnosticToolId, DiagnosticRun[]>();
  for (const run of recentRuns) {
    const existing = runsByTool.get(run.toolId) || [];
    existing.push(run);
    runsByTool.set(run.toolId, existing);
  }

  // Build module summaries
  const modules: DiagnosticModuleSummary[] = [];
  let totalScore = 0;
  let scoredCount = 0;
  let improvingCount = 0;
  let decliningCount = 0;

  for (const [toolId, toolRuns] of runsByTool) {
    // Sort by date (newest first)
    toolRuns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const runSummaries = toolRuns.map(r => ({
      date: r.createdAt,
      score: r.score,
      runId: r.id,
    }));

    const scoredRuns = runSummaries.filter(r => r.score !== null);
    const latestScore = scoredRuns[0]?.score ?? null;
    const averageScore = scoredRuns.length > 0
      ? Math.round(scoredRuns.reduce((sum, r) => sum + (r.score || 0), 0) / scoredRuns.length)
      : null;

    const trend = calculateModuleTrend(runSummaries);

    if (trend === 'improving') improvingCount++;
    if (trend === 'declining') decliningCount++;

    if (latestScore !== null) {
      totalScore += latestScore;
      scoredCount++;
    }

    modules.push({
      toolId,
      label: getToolLabel(toolId),
      runs: runSummaries,
      latestScore,
      averageScore,
      trend,
      runCount: toolRuns.length,
    });
  }

  // Sort modules by label
  modules.sort((a, b) => a.label.localeCompare(b.label));

  // Calculate overall metrics
  const overallScore = scoredCount > 0 ? Math.round(totalScore / scoredCount) : null;
  const maturity = calculateMaturityLevel(overallScore);

  // Find strongest/weakest
  const scoredModules = modules.filter(m => m.latestScore !== null);
  scoredModules.sort((a, b) => (b.latestScore || 0) - (a.latestScore || 0));

  const strongestArea = scoredModules[0]?.label ?? null;
  const weakestArea = scoredModules[scoredModules.length - 1]?.label ?? null;

  // Overall trend
  let overallTrend: 'improving' | 'declining' | 'stable' | 'insufficient-data' = 'insufficient-data';
  if (modules.length >= 2) {
    if (improvingCount > decliningCount + 1) {
      overallTrend = 'improving';
    } else if (decliningCount > improvingCount + 1) {
      overallTrend = 'declining';
    } else {
      overallTrend = 'stable';
    }
  }

  // Calculate average improvement
  let averageImprovement: number | null = null;
  const modulesWithTrend = modules.filter(m => m.runs.length >= 2);
  if (modulesWithTrend.length > 0) {
    const improvements = modulesWithTrend.map(m => {
      const first = m.runs[m.runs.length - 1]?.score || 0;
      const last = m.runs[0]?.score || 0;
      return last - first;
    });
    averageImprovement = Math.round(improvements.reduce((a, b) => a + b, 0) / improvements.length);
  }

  return {
    all: modules,
    trends: {
      modules,
      overallTrend,
      averageImprovement,
      strongestArea,
      weakestArea,
    },
    maturity,
    overallScore,
  };
}

/**
 * Load work execution summary
 */
async function loadWorkSummary(companyId: string): Promise<WorkExecutionSummary> {
  const items = await getWorkItemsForCompany(companyId);

  const completed: WorkItemRecord[] = [];
  const backlog: WorkItemRecord[] = [];
  const inProgress: WorkItemRecord[] = [];
  const byArea: Record<string, number> = {};

  for (const item of items) {
    const status = String(item.status || 'Backlog');
    const area = item.area || 'Other';

    byArea[area] = (byArea[area] || 0) + 1;

    if (status === 'Done') {
      completed.push(item);
    } else if (status === 'In Progress') {
      inProgress.push(item);
    } else {
      backlog.push(item);
    }
  }

  // Sort completed by date
  completed.sort((a, b) => {
    const aDate = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bDate = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bDate - aDate;
  });

  const completionRate = items.length > 0
    ? Math.round((completed.length / items.length) * 100)
    : 0;

  return {
    completed,
    backlog,
    inProgress,
    totalCompleted: completed.length,
    totalBacklog: backlog.length,
    completionRate,
    byArea,
    averageCompletionTime: null, // Would need created/completed dates to calculate
  };
}

/**
 * Extract audience model from context graph
 */
function extractAudienceModel(context: CompanyContextGraph | null): AudienceModel | null {
  if (!context?.audience) return null;

  const audience = context.audience;

  return {
    primaryAudience: audience.primaryAudience?.value ?? null,
    primaryBuyerRoles: audience.primaryBuyerRoles?.value ?? [],
    coreSegments: audience.coreSegments?.value ?? [],
    painPoints: audience.painPoints?.value ?? [],
    motivations: audience.motivations?.value ?? [],
    audienceNeeds: audience.audienceNeeds?.value ?? [],
    demographics: audience.demographics?.value ?? null,
    geos: audience.geos?.value ?? null,
    buyerJourney: audience.buyerJourney?.value ?? null,
  };
}

/**
 * Extract brand signals from context graph
 */
function extractBrandSignals(context: CompanyContextGraph | null): BrandSignals | null {
  if (!context?.brand) return null;

  const brand = context.brand;

  return {
    positioning: brand.positioning?.value ?? null,
    tagline: brand.tagline?.value ?? null,
    missionStatement: brand.missionStatement?.value ?? null,
    valueProps: brand.valueProps?.value ?? [],
    differentiators: brand.differentiators?.value ?? [],
    toneOfVoice: brand.toneOfVoice?.value ?? null,
    brandPersonality: brand.brandPersonality?.value ?? null,
    brandStrengths: brand.brandStrengths?.value ?? [],
    brandWeaknesses: brand.brandWeaknesses?.value ?? [],
    competitivePosition: brand.competitivePosition?.value ?? null,
  };
}

/**
 * Identify strategic patterns from data
 */
function identifyStrategicPatterns(
  themes: ThemeCluster[],
  diagnostics: DiagnosticModuleSummary[],
  work: WorkExecutionSummary
): StrategicPattern[] {
  const patterns: StrategicPattern[] = [];

  // Find critical failures (themes with critical/high findings)
  for (const theme of themes) {
    if (theme.dominantSeverity === 'critical') {
      patterns.push({
        type: 'critical-failure',
        title: `Critical ${theme.label} Issues`,
        description: `${theme.count} findings in ${theme.label} require immediate attention`,
        themes: [theme.themeId],
        severity: 'critical',
        evidence: theme.findings.slice(0, 3).map(f => f.description || 'Finding'),
      });
    }
  }

  // Find repeated issues (themes with many findings)
  const largeThemes = themes.filter(t => t.count >= 5);
  for (const theme of largeThemes) {
    patterns.push({
      type: 'repeated-issue',
      title: `Persistent ${theme.label} Challenges`,
      description: `${theme.count} recurring findings suggest systemic issues in ${theme.label}`,
      themes: [theme.themeId],
      severity: theme.avgSeverity <= 2 ? 'high' : 'medium',
      evidence: [`${theme.count} findings identified`, `Average severity: ${theme.dominantSeverity}`],
    });
  }

  // Find strengths (high-scoring diagnostic areas)
  const strengths = diagnostics.filter(d => (d.latestScore || 0) >= 75);
  for (const strength of strengths) {
    patterns.push({
      type: 'strength',
      title: `Strong ${strength.label} Foundation`,
      description: `${strength.label} scores ${strength.latestScore}% - a competitive advantage`,
      themes: [strength.toolId],
      severity: 'low',
      evidence: [`Latest score: ${strength.latestScore}%`, `Trend: ${strength.trend}`],
    });
  }

  // Find opportunities (areas with declining or low scores that could be improved)
  const opportunities = diagnostics.filter(d =>
    (d.latestScore || 0) < 50 || d.trend === 'declining'
  );
  for (const opp of opportunities) {
    patterns.push({
      type: 'opportunity',
      title: `${opp.label} Improvement Opportunity`,
      description: `${opp.label} has room for growth with current score of ${opp.latestScore ?? 'N/A'}%`,
      themes: [opp.toolId],
      severity: opp.trend === 'declining' ? 'high' : 'medium',
      evidence: [
        `Current score: ${opp.latestScore ?? 'N/A'}%`,
        `Trend: ${opp.trend}`,
        `${opp.runCount} diagnostic runs`,
      ],
    });
  }

  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  patterns.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return patterns;
}

// ============================================================================
// Main Loader
// ============================================================================

/**
 * Load all data needed for Annual Plan generation
 *
 * This is the primary entry point for annual plan data loading. It aggregates:
 * - 12 months of diagnostic runs and trends
 * - Strategic themes from findings
 * - Work execution history
 * - Audience and brand signals from context graph
 * - Strategic patterns identification
 *
 * @param companyId - The company record ID
 * @returns Complete Annual Plan data bundle
 */
export async function loadAnnualPlanData(companyId: string): Promise<AnnualPlanData> {
  console.log('[AnnualPlanData] Loading data for company:', companyId);
  const warnings: string[] = [];

  // Load company (required)
  const company = await getCompanyById(companyId);
  if (!company) {
    throw new Error(`Company not found: ${companyId}`);
  }

  // Load all data sources in parallel
  const [
    diagnostics,
    findings,
    workSummary,
    contextGraph,
  ] = await Promise.all([
    loadDiagnosticsSummary(companyId).catch((err) => {
      warnings.push(`Failed to load diagnostics: ${err.message}`);
      return {
        all: [],
        trends: {
          modules: [],
          overallTrend: 'insufficient-data' as const,
          averageImprovement: null,
          strongestArea: null,
          weakestArea: null,
        },
        maturity: 'foundational' as const,
        overallScore: null,
      };
    }),
    getCompanyFindings(companyId).catch((err) => {
      warnings.push(`Failed to load findings: ${err.message}`);
      return [] as DiagnosticDetailFinding[];
    }),
    loadWorkSummary(companyId).catch((err) => {
      warnings.push(`Failed to load work items: ${err.message}`);
      return {
        completed: [],
        backlog: [],
        inProgress: [],
        totalCompleted: 0,
        totalBacklog: 0,
        completionRate: 0,
        byArea: {},
        averageCompletionTime: null,
      } as WorkExecutionSummary;
    }),
    loadContextGraph(companyId).catch((err) => {
      warnings.push(`Failed to load context graph: ${err.message}`);
      return null;
    }),
  ]);

  // Cluster findings into themes
  const themes = clusterFindingsIntoThemes(findings);

  // Extract audience and brand signals
  const audience = extractAudienceModel(contextGraph);
  const brand = extractBrandSignals(contextGraph);

  // Identify strategic patterns
  const strategicPatterns = identifyStrategicPatterns(themes, diagnostics.all, workSummary);

  // Calculate coverage metrics
  const diagnosticsMonths = diagnostics.all.length > 0
    ? Math.min(12, Math.max(...diagnostics.all.map(d => d.runCount)))
    : 0;

  const hasAudienceData = audience !== null && (
    audience.primaryAudience !== null ||
    audience.coreSegments.length > 0 ||
    audience.painPoints.length > 0
  );

  const hasBrandData = brand !== null && (
    brand.positioning !== null ||
    brand.valueProps.length > 0
  );

  const hasContextGraph = contextGraph !== null;
  const hasWorkHistory = workSummary.totalCompleted > 0 || workSummary.totalBacklog > 0;

  // Overall readiness score (0-100)
  let readinessPoints = 0;
  if (diagnostics.all.length >= 3) readinessPoints += 30;
  else if (diagnostics.all.length >= 1) readinessPoints += 15;
  if (hasAudienceData) readinessPoints += 20;
  if (hasBrandData) readinessPoints += 20;
  if (hasContextGraph) readinessPoints += 15;
  if (hasWorkHistory) readinessPoints += 15;

  const data: AnnualPlanData = {
    company,
    companyId,
    diagnostics,
    themes,
    findings,
    work: workSummary,
    audience,
    brand,
    context: contextGraph,
    strategicPatterns,
    coverage: {
      diagnosticsMonths,
      hasAudienceData,
      hasBrandData,
      hasContextGraph,
      hasWorkHistory,
      overallReadiness: readinessPoints,
    },
    loadedAt: new Date().toISOString(),
    warnings,
  };

  console.log('[AnnualPlanData] Data loaded:', {
    companyName: company.name,
    diagnosticModules: diagnostics.all.length,
    themes: themes.length,
    findings: findings.length,
    workCompleted: workSummary.totalCompleted,
    workBacklog: workSummary.totalBacklog,
    hasAudienceData,
    hasBrandData,
    overallReadiness: readinessPoints,
    warnings: warnings.length,
  });

  return data;
}

/**
 * Get a summary of annual plan readiness
 */
export function getAnnualPlanReadiness(data: AnnualPlanData): {
  ready: boolean;
  score: number;
  missing: string[];
  recommendations: string[];
} {
  const missing: string[] = [];
  const recommendations: string[] = [];

  if (data.diagnostics.all.length < 2) {
    missing.push('Diagnostic data');
    recommendations.push('Run at least 2-3 diagnostic labs to establish baseline');
  }

  if (!data.coverage.hasAudienceData) {
    missing.push('Audience data');
    recommendations.push('Complete Audience Lab to define target segments');
  }

  if (!data.coverage.hasBrandData) {
    missing.push('Brand data');
    recommendations.push('Run Brand Lab to establish positioning');
  }

  if (!data.coverage.hasWorkHistory) {
    missing.push('Work history');
    recommendations.push('Create work items from plan to track execution');
  }

  return {
    ready: data.coverage.overallReadiness >= 50,
    score: data.coverage.overallReadiness,
    missing,
    recommendations,
  };
}
