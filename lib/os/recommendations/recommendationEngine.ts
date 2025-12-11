// lib/os/recommendations/recommendationEngine.ts
// Transform findings into prioritized, sequenced recommendations

import type { Finding, FindingCategory, FindingSeverity } from '../findings/types';
import type {
  Action,
  ActionPriority,
  ActionEffort,
  ActionDependency,
  ActionSequence,
  ActionStatus,
  StrategicTheme,
  Quarter,
  QuarterlyPlan,
  RecommendationResult,
} from './types';
import { EFFORT_HOURS } from './types';

/**
 * Generate a unique action ID
 */
function generateActionId(category: FindingCategory, index: number): string {
  const timestamp = Date.now().toString(36);
  return `action-${category}-${index}-${timestamp}`;
}

/**
 * Map finding severity to action priority
 */
function severityToPriority(severity: FindingSeverity): ActionPriority {
  switch (severity) {
    case 'critical': return 'p0';
    case 'high': return 'p1';
    case 'medium': return 'p2';
    case 'low':
    case 'info':
    default: return 'p3';
  }
}

/**
 * Map finding effort to action effort
 */
function effortToActionEffort(effort: 'quick' | 'moderate' | 'significant'): ActionEffort {
  switch (effort) {
    case 'quick': return 'quick-win';
    case 'moderate': return 'moderate';
    case 'significant': return 'significant';
    default: return 'moderate';
  }
}

/**
 * Map finding category to strategic theme
 */
function categoryToTheme(category: FindingCategory, severity: FindingSeverity): StrategicTheme {
  // Critical/high severity items go to foundation
  if (severity === 'critical' || (severity === 'high' && category === 'technical')) {
    return 'foundation';
  }

  switch (category) {
    case 'technical':
      return 'foundation';
    case 'seo':
    case 'listings':
      return 'visibility';
    case 'reputation':
      return 'trust';
    case 'social':
      return 'engagement';
    case 'website':
    case 'content':
      return 'conversion';
    case 'competitive':
      return 'competitive';
    default:
      return 'maintenance';
  }
}

/**
 * Generate action title from finding
 */
function generateActionTitle(finding: Finding): string {
  // Clean up the issue key for a title
  const parts = finding.issueKey.split('-');
  const words = parts.map(p =>
    p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
  );

  // Create action-oriented title
  const prefix = finding.severity === 'critical' ? 'Fix' :
                 finding.dimension === 'presence' ? 'Add' :
                 finding.dimension === 'completeness' ? 'Complete' :
                 finding.dimension === 'accuracy' ? 'Update' :
                 finding.dimension === 'consistency' ? 'Align' :
                 finding.dimension === 'performance' ? 'Optimize' :
                 'Improve';

  return `${prefix} ${words.join(' ')}`;
}

/**
 * Generate expected impact text
 */
function generateExpectedImpact(finding: Finding): string {
  const metric = finding.estimatedImpact.metric || 'visibility';
  const level = finding.estimatedImpact.level;

  const impacts: Record<string, string> = {
    'local-visibility': 'Improve local search visibility and map rankings',
    'engagement': 'Increase audience engagement and interaction rates',
    'user-experience': 'Enhance user experience and reduce bounce rates',
    'trust': 'Build credibility and increase customer confidence',
    'indexability': 'Ensure proper search engine indexing and crawling',
    'rankings': 'Improve organic search rankings for target keywords',
    'market-position': 'Strengthen competitive positioning in the market',
    'visibility': 'Increase overall online visibility and discoverability',
  };

  const base = impacts[metric] || `Improve ${metric}`;

  switch (level) {
    case 'high':
      return `${base}. Expected to have significant positive impact.`;
    case 'medium':
      return `${base}. Should provide meaningful improvement.`;
    case 'low':
      return `${base}. Minor but worthwhile improvement.`;
    default:
      return base;
  }
}

/**
 * Generate success metrics for an action
 */
function generateSuccessMetrics(finding: Finding): string[] {
  const metrics: string[] = [];

  switch (finding.category) {
    case 'listings':
      metrics.push('GBP views increased');
      metrics.push('Local pack appearances improved');
      metrics.push('Direction requests increased');
      break;
    case 'social':
      metrics.push('Follower growth rate');
      metrics.push('Engagement rate per post');
      metrics.push('Click-through to website');
      break;
    case 'website':
      metrics.push('Page load time reduced');
      metrics.push('Bounce rate decreased');
      metrics.push('Time on site increased');
      break;
    case 'reputation':
      metrics.push('Average review rating improved');
      metrics.push('Review response rate');
      metrics.push('Positive review percentage');
      break;
    case 'technical':
      metrics.push('Pages indexed correctly');
      metrics.push('Technical errors resolved');
      metrics.push('Core Web Vitals passed');
      break;
    case 'content':
      metrics.push('Organic traffic increased');
      metrics.push('Keyword rankings improved');
      metrics.push('Content engagement metrics');
      break;
    case 'competitive':
      metrics.push('Market share improvement');
      metrics.push('Ranking position vs competitors');
      metrics.push('Share of voice increased');
      break;
    default:
      metrics.push('Issue resolved');
      metrics.push('No regression detected');
  }

  return metrics.slice(0, 3);
}

/**
 * Convert a finding to an action
 */
function findingToAction(finding: Finding, index: number): Action {
  const priority = severityToPriority(finding.severity);
  const effort = effortToActionEffort(finding.estimatedImpact.effort);
  const theme = categoryToTheme(finding.category, finding.severity);
  const effortHours = EFFORT_HOURS[effort];

  return {
    id: generateActionId(finding.category, index),
    title: generateActionTitle(finding),
    description: finding.recommendation,
    priority,
    effort,
    theme,
    category: finding.category,
    quarter: null, // Will be assigned later
    status: 'pending' as ActionStatus,
    dependencies: [],
    findingIds: [finding.id],
    expectedImpact: generateExpectedImpact(finding),
    successMetrics: generateSuccessMetrics(finding),
    estimatedHours: effortHours.typical,
    tags: finding.tags,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Merge similar actions
 */
function mergeRelatedActions(actions: Action[]): Action[] {
  const merged: Action[] = [];
  const usedIds = new Set<string>();

  // Sort by priority and category
  const sorted = [...actions].sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority.localeCompare(b.priority);
    }
    return a.category.localeCompare(b.category);
  });

  for (const action of sorted) {
    if (usedIds.has(action.id)) continue;

    // Find similar actions to merge
    const similar = sorted.filter(a =>
      !usedIds.has(a.id) &&
      a.id !== action.id &&
      a.category === action.category &&
      a.theme === action.theme &&
      a.effort === action.effort
    );

    if (similar.length > 0 && similar.length <= 3) {
      // Merge into a combined action
      const allFindingIds = [
        ...action.findingIds,
        ...similar.flatMap(s => s.findingIds),
      ];

      const mergedAction: Action = {
        ...action,
        findingIds: [...new Set(allFindingIds)],
        description: [
          action.description,
          ...similar.map(s => s.description),
        ].join('\n\n'),
        estimatedHours: (action.estimatedHours || 0) +
          similar.reduce((sum, s) => sum + (s.estimatedHours || 0), 0),
        tags: [...new Set([
          ...(action.tags || []),
          ...similar.flatMap(s => s.tags || []),
        ])],
      };

      merged.push(mergedAction);
      usedIds.add(action.id);
      similar.forEach(s => usedIds.add(s.id));
    } else {
      merged.push(action);
      usedIds.add(action.id);
    }
  }

  return merged;
}

/**
 * Identify dependencies between actions
 */
function identifyDependencies(actions: Action[]): Action[] {
  // Define dependency rules
  const dependencyRules: Array<{
    blocker: { theme?: StrategicTheme; category?: FindingCategory; priority?: ActionPriority };
    blocked: { theme?: StrategicTheme; category?: FindingCategory };
  }> = [
    // Foundation must come before visibility
    { blocker: { theme: 'foundation' }, blocked: { theme: 'visibility' } },
    // Foundation must come before engagement
    { blocker: { theme: 'foundation' }, blocked: { theme: 'engagement' } },
    // Visibility should come before conversion
    { blocker: { theme: 'visibility' }, blocked: { theme: 'conversion' } },
    // Trust should come before conversion
    { blocker: { theme: 'trust' }, blocked: { theme: 'conversion' } },
    // P0 actions block P2/P3 in same category
    { blocker: { priority: 'p0' }, blocked: { theme: 'maintenance' } },
  ];

  return actions.map(action => {
    const dependencies: ActionDependency[] = [];

    for (const rule of dependencyRules) {
      // Check if action matches the blocked criteria
      const matchesBlocked =
        (!rule.blocked.theme || action.theme === rule.blocked.theme) &&
        (!rule.blocked.category || action.category === rule.blocked.category);

      if (!matchesBlocked) continue;

      // Find potential blockers
      const blockers = actions.filter(a =>
        a.id !== action.id &&
        (!rule.blocker.theme || a.theme === rule.blocker.theme) &&
        (!rule.blocker.category || a.category === rule.blocker.category) &&
        (!rule.blocker.priority || a.priority === rule.blocker.priority)
      );

      for (const blocker of blockers) {
        // Don't add duplicate dependencies
        if (!dependencies.some(d => d.actionId === blocker.id)) {
          dependencies.push({
            actionId: blocker.id,
            type: 'blocks',
            required: rule.blocker.priority === 'p0',
          });
        }
      }
    }

    return { ...action, dependencies };
  });
}

/**
 * Organize actions into sequences
 */
function organizeIntoSequences(actions: Action[]): ActionSequence[] {
  const sequences: ActionSequence[] = [];
  const usedActionIds = new Set<string>();

  // Group by theme
  const byTheme = new Map<StrategicTheme, Action[]>();
  for (const action of actions) {
    const existing = byTheme.get(action.theme) || [];
    existing.push(action);
    byTheme.set(action.theme, existing);
  }

  // Create sequences per theme
  for (const [theme, themeActions] of byTheme) {
    // Sort by priority then effort
    const sorted = themeActions.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority.localeCompare(b.priority);
      }
      const effortOrder: Record<ActionEffort, number> = {
        'quick-win': 0,
        'moderate': 1,
        'significant': 2,
        'project': 3,
      };
      return effortOrder[a.effort] - effortOrder[b.effort];
    });

    // Create sequence
    const sequence: ActionSequence = {
      id: `seq-${theme}-${Date.now().toString(36)}`,
      name: `${theme.charAt(0).toUpperCase() + theme.slice(1)} Improvements`,
      description: `Strategic sequence for ${theme} improvements`,
      theme,
      actions: sorted,
      totalEstimatedHours: sorted.reduce((sum, a) => sum + (a.estimatedHours || 0), 0),
      priority: sorted[0]?.priority || 'p2',
    };

    sequences.push(sequence);
    sorted.forEach(a => usedActionIds.add(a.id));
  }

  return sequences;
}

/**
 * Distribute actions across quarters
 */
function distributeToQuarters(
  actions: Action[],
  year: number = new Date().getFullYear()
): QuarterlyPlan[] {
  const quarters: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];
  const plans: QuarterlyPlan[] = [];

  // Calculate capacity per quarter (rough estimate: 160 hours)
  const hoursPerQuarter = 160;

  // Sort actions by priority
  const sorted = [...actions].sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority.localeCompare(b.priority);
    }
    // Then by dependencies (fewer dependencies first)
    return a.dependencies.length - b.dependencies.length;
  });

  // Track hours allocated per quarter
  const quarterHours: Record<Quarter, number> = {
    Q1: 0, Q2: 0, Q3: 0, Q4: 0,
  };

  // Track actions assigned per quarter
  const quarterActions: Record<Quarter, Action[]> = {
    Q1: [], Q2: [], Q3: [], Q4: [],
  };

  // Assign P0 actions to Q1
  for (const action of sorted.filter(a => a.priority === 'p0')) {
    action.quarter = 'Q1';
    quarterActions.Q1.push(action);
    quarterHours.Q1 += action.estimatedHours || 0;
  }

  // Assign remaining actions based on capacity
  for (const action of sorted.filter(a => a.priority !== 'p0')) {
    // Find earliest quarter with capacity
    for (const quarter of quarters) {
      const currentHours = quarterHours[quarter];
      const actionHours = action.estimatedHours || 0;

      if (currentHours + actionHours <= hoursPerQuarter) {
        action.quarter = quarter;
        quarterActions[quarter].push(action);
        quarterHours[quarter] += actionHours;
        break;
      }
    }

    // If no quarter has capacity, add to Q4
    if (!action.quarter) {
      action.quarter = 'Q4';
      quarterActions.Q4.push(action);
      quarterHours.Q4 += action.estimatedHours || 0;
    }
  }

  // Create plans
  for (const quarter of quarters) {
    const quarterActionList = quarterActions[quarter];

    // Group by theme
    const byTheme = new Map<StrategicTheme, Action[]>();
    for (const action of quarterActionList) {
      const existing = byTheme.get(action.theme) || [];
      existing.push(action);
      byTheme.set(action.theme, existing);
    }

    plans.push({
      quarter,
      year,
      actions: quarterActionList,
      byTheme,
      totalHours: quarterHours[quarter],
      summary: generateQuarterSummary(quarter, quarterActionList),
    });
  }

  return plans;
}

/**
 * Generate a quarter summary
 */
function generateQuarterSummary(quarter: Quarter, actions: Action[]): string {
  if (actions.length === 0) {
    return `No actions planned for ${quarter}`;
  }

  const p0Count = actions.filter(a => a.priority === 'p0').length;
  const p1Count = actions.filter(a => a.priority === 'p1').length;
  const themes = [...new Set(actions.map(a => a.theme))];

  const parts: string[] = [];

  if (p0Count > 0) {
    parts.push(`${p0Count} critical fix${p0Count > 1 ? 'es' : ''}`);
  }
  if (p1Count > 0) {
    parts.push(`${p1Count} high-priority item${p1Count > 1 ? 's' : ''}`);
  }

  parts.push(`Focus areas: ${themes.join(', ')}`);

  return parts.join('. ');
}

/**
 * Main recommendation generation function
 *
 * Input: Array<Finding> from standardization
 * Output: RecommendationResult with actions, sequences, and quarterly plans
 */
export function generateRecommendations(
  findings: Finding[],
  options: {
    year?: number;
    maxActionsPerQuarter?: number;
  } = {}
): RecommendationResult {
  const { year = new Date().getFullYear() } = options;
  const warnings: string[] = [];

  // Step 1: Convert findings to actions
  let actions = findings.map((finding, index) => findingToAction(finding, index));

  // Step 2: Merge related actions
  actions = mergeRelatedActions(actions);
  if (actions.length < findings.length) {
    warnings.push(`Merged ${findings.length - actions.length} similar actions`);
  }

  // Step 3: Identify dependencies
  actions = identifyDependencies(actions);

  // Step 4: Organize into sequences
  const sequences = organizeIntoSequences(actions);

  // Step 5: Distribute to quarters
  const quarterlyPlans = distributeToQuarters(actions, year);

  return {
    actions,
    sequences,
    quarterlyPlans,
    warnings,
    metadata: {
      findingsProcessed: findings.length,
      actionsGenerated: actions.length,
      sequencesCreated: sequences.length,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Get the next best actions (top N by priority and readiness)
 */
export function getNextBestActions(
  actions: Action[],
  count: number = 5
): Action[] {
  // Filter to pending actions
  const pending = actions.filter(a => a.status === 'pending');

  // Check which actions have unmet dependencies
  const pendingIds = new Set(pending.map(a => a.id));
  const ready = pending.filter(action => {
    const requiredDeps = action.dependencies.filter(d => d.required);
    return requiredDeps.every(dep => !pendingIds.has(dep.actionId));
  });

  // Sort by priority, then by effort (quick wins first)
  const sorted = ready.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority.localeCompare(b.priority);
    }
    const effortOrder: Record<ActionEffort, number> = {
      'quick-win': 0,
      'moderate': 1,
      'significant': 2,
      'project': 3,
    };
    return effortOrder[a.effort] - effortOrder[b.effort];
  });

  return sorted.slice(0, count);
}

/**
 * Get quick wins (low effort, ready to execute)
 */
export function getQuickWins(actions: Action[]): Action[] {
  return actions.filter(a =>
    a.status === 'pending' &&
    a.effort === 'quick-win' &&
    a.dependencies.filter(d => d.required).length === 0
  );
}

/**
 * Update action status
 */
export function updateActionStatus(
  actions: Action[],
  actionId: string,
  status: ActionStatus
): Action[] {
  return actions.map(action => {
    if (action.id === actionId) {
      return {
        ...action,
        status,
        updatedAt: new Date().toISOString(),
      };
    }
    return action;
  });
}

/**
 * Get roadmap statistics
 */
export function getRoadmapStats(result: RecommendationResult): {
  totalActions: number;
  byPriority: Record<ActionPriority, number>;
  byTheme: Record<StrategicTheme, number>;
  byQuarter: Record<Quarter, number>;
  totalHours: number;
  quickWinsCount: number;
} {
  const byPriority: Record<ActionPriority, number> = {
    p0: 0, p1: 0, p2: 0, p3: 0,
  };

  const byTheme: Record<StrategicTheme, number> = {
    foundation: 0, visibility: 0, trust: 0,
    engagement: 0, conversion: 0, competitive: 0, maintenance: 0,
  };

  const byQuarter: Record<Quarter, number> = {
    Q1: 0, Q2: 0, Q3: 0, Q4: 0,
  };

  let totalHours = 0;
  let quickWinsCount = 0;

  for (const action of result.actions) {
    byPriority[action.priority]++;
    byTheme[action.theme]++;
    if (action.quarter) {
      byQuarter[action.quarter]++;
    }
    totalHours += action.estimatedHours || 0;
    if (action.effort === 'quick-win') {
      quickWinsCount++;
    }
  }

  return {
    totalActions: result.actions.length,
    byPriority,
    byTheme,
    byQuarter,
    totalHours,
    quickWinsCount,
  };
}
