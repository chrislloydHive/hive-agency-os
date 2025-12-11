// lib/os/recommendations/planIntegration.ts
// Bridge recommendations engine to Plan + Work

import type { Finding } from '../findings/types';
import {
  generateRecommendations,
  getNextBestActions,
  getQuickWins,
  getRoadmapStats,
} from './recommendationEngine';
import {
  THEME_DESCRIPTIONS,
  PRIORITY_DESCRIPTIONS,
  type RecommendationResult,
  type Action,
  type QuarterlyPlan,
  type ActionSequence,
} from './types';

/**
 * Format for Plan synthesis API response
 */
export interface PlanSynthesisResult {
  /** Strategic themes with descriptions */
  themes: Array<{
    id: string;
    title: string;
    description: string;
    actionCount: number;
    totalHours: number;
    priority: string;
  }>;

  /** Next best actions (top 5-10) */
  nextBestActions: Array<{
    id: string;
    title: string;
    description: string;
    priority: string;
    effort: string;
    theme: string;
    category: string;
    expectedImpact: string;
    quarter: string | null;
    isQuickWin: boolean;
  }>;

  /** Quick wins (immediate actions) */
  quickWins: Array<{
    id: string;
    title: string;
    description: string;
    expectedImpact: string;
    estimatedHours: number;
  }>;

  /** Quarterly roadmap */
  quarterlyRoadmap: Array<{
    quarter: string;
    year: number;
    summary: string;
    actionCount: number;
    totalHours: number;
    themes: string[];
  }>;

  /** Strategic sequences */
  sequences: Array<{
    id: string;
    name: string;
    description: string;
    theme: string;
    actionCount: number;
    totalHours: number;
    priority: string;
  }>;

  /** Summary statistics */
  stats: {
    totalActions: number;
    quickWinsCount: number;
    totalHours: number;
    criticalCount: number;
    highPriorityCount: number;
    byTheme: Record<string, number>;
    byQuarter: Record<string, number>;
  };

  /** Raw recommendations (for advanced use) */
  raw: RecommendationResult;
}

/**
 * Map Action to API-friendly format
 */
function mapActionToApi(action: Action): PlanSynthesisResult['nextBestActions'][0] {
  return {
    id: action.id,
    title: action.title,
    description: action.description,
    priority: PRIORITY_DESCRIPTIONS[action.priority]?.label || action.priority,
    effort: action.effort,
    theme: THEME_DESCRIPTIONS[action.theme]?.title || action.theme,
    category: action.category,
    expectedImpact: action.expectedImpact,
    quarter: action.quarter,
    isQuickWin: action.effort === 'quick-win',
  };
}

/**
 * Generate plan synthesis from findings
 *
 * This is the main function that converts standardized findings
 * into a strategic plan with recommendations.
 */
export function synthesizePlan(
  findings: Finding[],
  options: {
    year?: number;
    maxNextBestActions?: number;
    maxQuickWins?: number;
  } = {}
): PlanSynthesisResult {
  const {
    year = new Date().getFullYear(),
    maxNextBestActions = 10,
    maxQuickWins = 5,
  } = options;

  // Generate recommendations
  const result = generateRecommendations(findings, { year });

  // Get next best actions
  const nextBest = getNextBestActions(result.actions, maxNextBestActions);

  // Get quick wins
  const quickWinActions = getQuickWins(result.actions).slice(0, maxQuickWins);

  // Get stats
  const stats = getRoadmapStats(result);

  // Format themes
  const themes = result.sequences.map(seq => ({
    id: seq.id,
    title: THEME_DESCRIPTIONS[seq.theme]?.title || seq.theme,
    description: THEME_DESCRIPTIONS[seq.theme]?.description || seq.description,
    actionCount: seq.actions.length,
    totalHours: seq.totalEstimatedHours,
    priority: PRIORITY_DESCRIPTIONS[seq.priority]?.label || seq.priority,
  }));

  // Format next best actions
  const nextBestActions = nextBest.map(mapActionToApi);

  // Format quick wins
  const quickWins = quickWinActions.map(action => ({
    id: action.id,
    title: action.title,
    description: action.description,
    expectedImpact: action.expectedImpact,
    estimatedHours: action.estimatedHours || 1,
  }));

  // Format quarterly roadmap
  const quarterlyRoadmap = result.quarterlyPlans.map(plan => ({
    quarter: plan.quarter,
    year: plan.year,
    summary: plan.summary,
    actionCount: plan.actions.length,
    totalHours: plan.totalHours,
    themes: [...plan.byTheme.keys()].map(t =>
      THEME_DESCRIPTIONS[t]?.title || t
    ),
  }));

  // Format sequences
  const sequences = result.sequences.map(seq => ({
    id: seq.id,
    name: seq.name,
    description: seq.description,
    theme: THEME_DESCRIPTIONS[seq.theme]?.title || seq.theme,
    actionCount: seq.actions.length,
    totalHours: seq.totalEstimatedHours,
    priority: PRIORITY_DESCRIPTIONS[seq.priority]?.label || seq.priority,
  }));

  return {
    themes,
    nextBestActions,
    quickWins,
    quarterlyRoadmap,
    sequences,
    stats: {
      totalActions: stats.totalActions,
      quickWinsCount: stats.quickWinsCount,
      totalHours: stats.totalHours,
      criticalCount: stats.byPriority.p0,
      highPriorityCount: stats.byPriority.p1,
      byTheme: stats.byTheme,
      byQuarter: stats.byQuarter,
    },
    raw: result,
  };
}

/**
 * Convert recommendation action to Work Item input format
 */
export function actionToWorkItem(action: Action, companyId: string): {
  companyId: string;
  title: string;
  description: string;
  area: string;
  priority: 'high' | 'medium' | 'low';
  status: string;
  sourceType: string;
  sourceId: string;
} {
  // Map theme to area
  const areaMapping: Record<string, string> = {
    'foundation': 'Strategy',
    'visibility': 'SEO',
    'trust': 'Brand',
    'engagement': 'Content',
    'conversion': 'Website UX',
    'competitive': 'Strategy',
    'maintenance': 'Other',
  };

  // Map priority
  const priorityMapping: Record<string, 'high' | 'medium' | 'low'> = {
    'p0': 'high',
    'p1': 'high',
    'p2': 'medium',
    'p3': 'low',
  };

  return {
    companyId,
    title: action.title,
    description: `${action.description}

**Expected Impact:** ${action.expectedImpact}

**Success Metrics:**
${action.successMetrics.map(m => `- ${m}`).join('\n')}

**Theme:** ${THEME_DESCRIPTIONS[action.theme]?.title || action.theme}
**Effort:** ${action.effort}
**Estimated Hours:** ${action.estimatedHours || 'TBD'}

_Source: AI Recommendation from ${action.findingIds.length} finding(s)_`,
    area: areaMapping[action.theme] || 'Other',
    priority: priorityMapping[action.priority] || 'medium',
    status: 'Backlog',
    sourceType: 'AI Recommendation',
    sourceId: action.id,
  };
}

/**
 * Get the single next best action for display on Overview
 */
export function getTopRecommendation(findings: Finding[]): {
  title: string;
  description: string;
  theme: string;
  priority: string;
  isQuickWin: boolean;
} | null {
  if (findings.length === 0) return null;

  const result = generateRecommendations(findings);
  const nextBest = getNextBestActions(result.actions, 1);

  if (nextBest.length === 0) return null;

  const action = nextBest[0];
  return {
    title: action.title,
    description: action.description,
    theme: THEME_DESCRIPTIONS[action.theme]?.title || action.theme,
    priority: PRIORITY_DESCRIPTIONS[action.priority]?.label || action.priority,
    isQuickWin: action.effort === 'quick-win',
  };
}

/**
 * Serialize plan synthesis for storage/caching
 */
export function serializePlanSynthesis(synthesis: PlanSynthesisResult): string {
  // Remove the raw field for storage
  const { raw, ...serializable } = synthesis;
  return JSON.stringify(serializable);
}

/**
 * Generate a text summary for display
 */
export function generatePlanSummaryText(synthesis: PlanSynthesisResult): string {
  const parts: string[] = [];

  // Overview
  parts.push(`## Strategic Plan Summary`);
  parts.push('');
  parts.push(`**${synthesis.stats.totalActions} actions** identified across **${synthesis.themes.length} themes**.`);

  if (synthesis.stats.criticalCount > 0) {
    parts.push(`${synthesis.stats.criticalCount} critical items require immediate attention.`);
  }

  parts.push('');

  // Quick wins
  if (synthesis.quickWins.length > 0) {
    parts.push(`### Quick Wins (${synthesis.quickWins.length})`);
    for (const qw of synthesis.quickWins.slice(0, 3)) {
      parts.push(`- ${qw.title}`);
    }
    parts.push('');
  }

  // Next best actions
  if (synthesis.nextBestActions.length > 0) {
    parts.push(`### Priority Actions`);
    for (const action of synthesis.nextBestActions.slice(0, 5)) {
      parts.push(`- **[${action.priority}]** ${action.title}`);
    }
    parts.push('');
  }

  // Quarterly summary
  if (synthesis.quarterlyRoadmap.length > 0) {
    const q1 = synthesis.quarterlyRoadmap.find(q => q.quarter === 'Q1');
    if (q1 && q1.actionCount > 0) {
      parts.push(`### This Quarter (Q1)`);
      parts.push(`${q1.actionCount} actions · ${q1.totalHours} hours · Focus: ${q1.themes.slice(0, 2).join(', ')}`);
    }
  }

  return parts.join('\n');
}
