// lib/diagnostics/mappers/demandMapper.ts
// Demand Lab → Action Board Mapper
//
// Converts DemandLabResult into a generic DiagnosticActionBoard
// for Blueprint and Work integration.

import type { DemandLabResult, DemandLabDimension, DemandLabIssue, DemandLabQuickWin, DemandLabProject, DemandDimensionKey } from '../demand-lab';
import { mapCategoryToDimensionKey } from '../demand-lab';
import type {
  DiagnosticActionBoard,
  DiagnosticAction,
  DiagnosticTheme,
  StrategicProject,
  ServiceArea,
  ActionBucket,
} from '../types';

// ============================================================================
// MAIN MAPPER FUNCTION
// ============================================================================

/**
 * Convert Demand Lab result to generic Diagnostic Action Board
 */
export function mapDemandToActionBoard(
  result: DemandLabResult,
  companyId: string,
  options?: {
    companyName?: string;
    companyUrl?: string;
    runId?: string;
  }
): DiagnosticActionBoard {
  const { companyName, companyUrl, runId } = options || {};

  // Map dimension issues to themes
  const themes: DiagnosticTheme[] = result.dimensions
    .filter((dim) => dim.status !== 'strong')
    .map((dim) => ({
      id: `theme-${dim.key}`,
      label: dim.label,
      description: dim.summary,
      priority: dim.status === 'weak' ? 'critical' : 'important',
      linkedDimensions: [dim.key],
      expectedImpactSummary: `Improving ${dim.label.toLowerCase()} could significantly impact demand generation effectiveness.`,
    }));

  // Convert issues to actions by bucket
  const { now, next, later } = mapIssuesToActions(result.issues, result.dimensions);

  // Convert quick wins to actions (add to now bucket)
  const quickWinActions = mapQuickWinsToActions(result.quickWins);
  now.push(...quickWinActions);

  // Convert projects to strategic projects
  const strategicProjects = mapProjectsToStrategic(result.projects);

  // Extract filter options
  const allActions = [...now, ...next, ...later];
  const filterOptions = extractFilterOptions(allActions);

  return {
    diagnosticType: 'demand',
    companyId,
    companyName,
    targetUrl: companyUrl,
    overallScore: result.overallScore,
    gradeLabel: result.maturityStage,
    summary: result.narrativeSummary,
    themes,
    now,
    next,
    later,
    strategicProjects,
    filterOptions,
    metadata: {
      runDate: result.generatedAt,
      runId,
      custom: {
        maturityStage: result.maturityStage,
        dataConfidence: result.dataConfidence,
        dimensionScores: result.dimensions.map((d) => ({
          key: d.key,
          score: d.score,
          status: d.status,
        })),
        analyticsSnapshot: result.analyticsSnapshot,
      },
    },
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Map dimension key to service area
 */
function dimensionKeyToServiceArea(keyOrCategory: string): ServiceArea {
  // First try to convert category to key
  const key = mapCategoryToDimensionKey(keyOrCategory) || keyOrCategory;

  const mapping: Record<string, ServiceArea> = {
    channelMix: 'analytics',
    targeting: 'website',
    creative: 'content',
    funnel: 'website',
    measurement: 'analytics',
    // Also support the human-readable categories
    'Channel Mix': 'analytics',
    'Targeting': 'website',
    'Creative': 'content',
    'Funnel': 'website',
    'Measurement': 'analytics',
  };
  return mapping[key] || 'cross_cutting';
}

/**
 * Map issues to actions and bucket them by severity
 */
function mapIssuesToActions(
  issues: DemandLabIssue[],
  dimensions: DemandLabDimension[]
): { now: DiagnosticAction[]; next: DiagnosticAction[]; later: DiagnosticAction[] } {
  const now: DiagnosticAction[] = [];
  const next: DiagnosticAction[] = [];
  const later: DiagnosticAction[] = [];

  for (const issue of issues) {
    // Find the dimension for context - category is human-readable, key is camelCase
    const dimensionKey = mapCategoryToDimensionKey(issue.category);
    const dimension = dimensionKey
      ? dimensions.find((d) => d.key === dimensionKey)
      : undefined;

    const action: DiagnosticAction = {
      id: issue.id,
      title: issue.title,
      description: issue.description,
      rationale: `This issue affects ${dimension?.label || issue.category} performance and is rated as ${issue.severity} severity.`,
      dimension: issue.category,
      serviceArea: dimensionKeyToServiceArea(issue.category),
      impactScore: severityToImpact(issue.severity),
      effortScore: 3, // Default medium effort
      bucket: severityToBucket(issue.severity),
      tags: [issue.category, `severity-${issue.severity}`],
      status: 'backlog',
    };

    // Bucket by severity
    if (issue.severity === 'high') {
      action.bucket = 'now';
      now.push(action);
    } else if (issue.severity === 'medium') {
      action.bucket = 'next';
      next.push(action);
    } else {
      action.bucket = 'later';
      later.push(action);
    }
  }

  return { now, next, later };
}

/**
 * Map quick wins to actions
 */
function mapQuickWinsToActions(quickWins: DemandLabQuickWin[]): DiagnosticAction[] {
  return quickWins.map((win, idx) => ({
    id: `qw-${idx + 1}`,
    title: win.action,
    description: win.action,
    rationale: `Quick win with ${win.expectedImpact} expected impact and ${win.effortLevel} effort.`,
    dimension: win.category || 'cross_cutting',
    serviceArea: dimensionKeyToServiceArea(win.category || 'cross_cutting'),
    impactScore: impactLevelToScore(win.expectedImpact),
    effortScore: effortLevelToScore(win.effortLevel),
    bucket: 'now' as ActionBucket,
    tags: ['quick-win', win.category || 'general', `impact-${win.expectedImpact}`],
    playbook: 'Quick Wins',
    status: 'backlog',
  }));
}

/**
 * Map projects to strategic projects
 */
function mapProjectsToStrategic(projects: DemandLabProject[]): StrategicProject[] {
  return projects.map((project, idx) => ({
    id: `proj-${idx + 1}`,
    title: project.title,
    description: project.description,
    reasoning: `Strategic project with ${project.impact} impact.`,
    timeHorizon: project.timeHorizon,
    expectedImpact: `${project.impact} impact`,
    serviceAreas: project.category
      ? [dimensionKeyToServiceArea(project.category)]
      : undefined,
    linkedFindings: [],
  }));
}

/**
 * Convert severity to impact score (1-5)
 */
function severityToImpact(severity: 'high' | 'medium' | 'low'): number {
  const mapping = { high: 5, medium: 3, low: 2 };
  return mapping[severity];
}

/**
 * Convert severity to action bucket
 */
function severityToBucket(severity: 'high' | 'medium' | 'low'): ActionBucket {
  const mapping: Record<string, ActionBucket> = {
    high: 'now',
    medium: 'next',
    low: 'later',
  };
  return mapping[severity];
}

/**
 * Convert impact level to score (1-5)
 */
function impactLevelToScore(impact: 'high' | 'medium' | 'low'): number {
  const mapping = { high: 5, medium: 3, low: 2 };
  return mapping[impact];
}

/**
 * Convert effort level to score (1-5)
 */
function effortLevelToScore(effort: 'high' | 'medium' | 'low'): number {
  const mapping = { high: 5, medium: 3, low: 1 };
  return mapping[effort];
}

/**
 * Extract filter options from actions
 */
function extractFilterOptions(actions: DiagnosticAction[]) {
  const tags = new Set<string>();
  const serviceAreas = new Set<ServiceArea>();
  const playbooks = new Set<string>();

  for (const action of actions) {
    if (action.tags) {
      action.tags.forEach((tag) => tags.add(tag));
    }
    serviceAreas.add(action.serviceArea);
    if (action.playbook) {
      playbooks.add(action.playbook);
    }
  }

  return {
    tags: Array.from(tags).sort(),
    personas: [], // Demand Lab doesn't have persona analysis
    serviceAreas: Array.from(serviceAreas).sort(),
    playbooks: Array.from(playbooks).sort(),
  };
}
