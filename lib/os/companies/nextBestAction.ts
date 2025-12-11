// lib/os/companies/nextBestAction.ts
// Next Best Action Helper
//
// Derives a single practical next step based on alerts, snapshot, health data,
// and AI-generated recommendations from the recommendations engine.
// Displayed prominently on the Overview page to guide users.

import { getCompanyFindings } from '@/lib/os/findings/companyFindings';
import { synthesizePlan, type PlanSynthesisResult } from '@/lib/os/recommendations';
import type { Finding, FindingCategory, FindingDimension, FindingSeverity, LabSlug } from '@/lib/os/findings/types';
import type { DiagnosticDetailFinding } from '@/lib/airtable/diagnosticDetails';

// Re-export types and functions from client-safe types file
export type {
  NextBestAction,
  AIRecommendation,
  ExtendedNextBestAction,
  GetNextBestActionsOptions,
} from './nextBestAction.types';

export {
  deriveNextBestAction,
  getPriorityColorClasses,
} from './nextBestAction.types';

import type {
  NextBestAction,
  AIRecommendation,
  ExtendedNextBestAction,
  GetNextBestActionsOptions,
} from './nextBestAction.types';

// ============================================================================
// Finding Conversion (shared logic with plan synthesis)
// ============================================================================

/**
 * Convert Airtable finding to standardized Finding type
 */
function convertToStandardizedFinding(f: DiagnosticDetailFinding, index: number): Finding {
  const categoryMap: Record<string, FindingCategory> = {
    'Technical': 'technical',
    'UX': 'website',
    'Brand': 'content',
    'Content': 'content',
    'SEO': 'seo',
    'Analytics': 'technical',
    'Media': 'social',
    'Demand': 'content',
    'Ops': 'technical',
  };

  const dimensionMap: Record<string, FindingDimension> = {
    'Performance': 'performance',
    'Presence': 'presence',
    'Visibility': 'visibility',
    'Accuracy': 'accuracy',
    'Completeness': 'completeness',
    'Consistency': 'consistency',
    'Engagement': 'engagement',
    'Authority': 'authority',
    'Compliance': 'compliance',
    'General': 'presence',
    'Summary': 'presence',
  };

  const labSlugMap: Record<string, LabSlug> = {
    'website': 'website',
    'brand': 'brand',
    'seo': 'rankings',
    'content': 'content',
    'demand': 'audience',
    'ops': 'technical',
    'gap': 'gbp',
    'gbp': 'gbp',
    'social': 'social',
    'competition': 'competition',
  };

  const severityMap: Record<string, FindingSeverity> = {
    'critical': 'critical',
    'high': 'high',
    'medium': 'medium',
    'low': 'low',
    'info': 'info',
  };

  const impactLevelMap: Record<string, 'high' | 'medium' | 'low'> = {
    'critical': 'high',
    'high': 'high',
    'medium': 'medium',
    'low': 'low',
  };

  const category = categoryMap[f.category || ''] || 'technical';
  const dimension = dimensionMap[f.dimension || ''] || 'presence';
  const severity = severityMap[f.severity || 'medium'] || 'medium';
  const labSlug = labSlugMap[f.labSlug || 'website'] || 'website';

  return {
    id: f.id || `finding-${index}`,
    labSlug,
    category,
    dimension,
    severity,
    location: {
      url: f.location || undefined,
      platform: f.labSlug || undefined,
    },
    issueKey: `${category}-${dimension}-${index}`,
    description: f.description || 'No description',
    recommendation: f.recommendation || 'Review and address this finding',
    estimatedImpact: {
      level: impactLevelMap[f.severity || 'medium'] || 'medium',
      metric: category === 'seo' ? 'visibility' : category === 'website' ? 'conversions' : 'engagement',
      effort: severity === 'critical' || severity === 'high' ? 'moderate' : 'quick',
    },
    confidence: 80,
    detectedAt: f.createdAt || new Date().toISOString(),
    tags: [f.labSlug || 'unknown', f.category || 'unknown'].filter(Boolean),
  };
}

// ============================================================================
// Async Fetcher for Next Best Actions
// ============================================================================

/**
 * Get multiple next best actions for a company
 *
 * This is the main async function to fetch recommended actions.
 * It loads findings, runs the recommendations engine, and returns prioritized actions.
 *
 * @param companyId - Company ID
 * @param options - Filter and limit options
 * @returns Array of ExtendedNextBestAction
 */
export async function getNextBestActionsForCompany(
  companyId: string,
  options: GetNextBestActionsOptions = {}
): Promise<ExtendedNextBestAction[]> {
  const { limit = 5, theme, labSlug, quickWinsOnly = false } = options;

  console.log('[nextBestAction] getNextBestActionsForCompany:', { companyId, options });

  // 1. Load findings for company
  const findings = await getCompanyFindings(companyId, {
    labs: labSlug ? [labSlug] : undefined,
  });

  if (findings.length === 0) {
    console.log('[nextBestAction] No findings found for company');
    return [];
  }

  // 2. Convert to standardized Finding type
  const standardizedFindings: Finding[] = findings.map((f, i) =>
    convertToStandardizedFinding(f, i)
  );

  // 3. Generate plan synthesis
  const synthesis: PlanSynthesisResult = synthesizePlan(standardizedFindings, {
    maxNextBestActions: Math.max(limit * 2, 10), // Get more to filter
    maxQuickWins: quickWinsOnly ? limit : 5,
  });

  // 4. Convert to ExtendedNextBestAction format
  let actions: ExtendedNextBestAction[] = [];

  // Add quick wins first if requested or if available
  for (const qw of synthesis.quickWins) {
    actions.push({
      id: qw.id,
      action: qw.title,
      reason: qw.description,
      priority: 'medium',
      linkPath: `/c/${companyId}/findings`,
      source: 'recommendation',
      isQuickWin: true,
      expectedImpact: qw.expectedImpact,
      effort: 'quick-win',
      estimatedHours: qw.estimatedHours,
    });
  }

  // Add next best actions
  for (const nba of synthesis.nextBestActions) {
    // Skip if already added as quick win
    if (actions.some(a => a.id === nba.id)) continue;

    // Map priority
    const priorityMap: Record<string, 'high' | 'medium' | 'low'> = {
      'Critical': 'high',
      'High': 'high',
      'Medium': 'medium',
      'Low': 'low',
    };

    // Map effort
    const effortMap: Record<string, 'quick-win' | 'moderate' | 'significant'> = {
      'quick-win': 'quick-win',
      'moderate': 'moderate',
      'significant': 'significant',
    };

    actions.push({
      id: nba.id,
      action: nba.title,
      reason: nba.description,
      priority: priorityMap[nba.priority] || 'medium',
      linkPath: `/c/${companyId}/findings`,
      source: 'recommendation',
      theme: nba.theme,
      isQuickWin: nba.isQuickWin,
      expectedImpact: nba.expectedImpact,
      effort: effortMap[nba.effort] || 'moderate',
      category: nba.category,
      quarter: nba.quarter,
    });
  }

  // 5. Apply filters
  if (quickWinsOnly) {
    actions = actions.filter(a => a.isQuickWin);
  }

  if (theme) {
    actions = actions.filter(a => a.theme?.toLowerCase().includes(theme.toLowerCase()));
  }

  // 6. Limit results
  actions = actions.slice(0, limit);

  console.log('[nextBestAction] Returning', actions.length, 'actions');
  return actions;
}

/**
 * Get the single top action for a company
 * Convenience wrapper around getNextBestActionsForCompany
 */
export async function getTopActionForCompany(
  companyId: string,
  options?: Omit<GetNextBestActionsOptions, 'limit'>
): Promise<ExtendedNextBestAction | null> {
  const actions = await getNextBestActionsForCompany(companyId, { ...options, limit: 1 });
  return actions[0] || null;
}
