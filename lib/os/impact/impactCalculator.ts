// lib/os/impact/impactCalculator.ts
// Impact calculation logic for mapping work items to KPI improvements

import type {
  WorkItemImpact,
  KPIEstimate,
  ROICalculation,
  ImpactCategory,
  ImpactLevel,
  EffortLevel,
  ROIConfig,
} from './impactTypes';
import { DEFAULT_ROI_CONFIG, IMPACT_MODELS } from './impactTypes';

// ============================================================================
// Finding to Impact Mapping
// ============================================================================

interface FindingInput {
  id: string;
  title?: string;
  description?: string;
  labSlug: string;
  category: string;
  severity: string;
  recommendation?: string;
}

/**
 * Map a finding to its expected impact category
 */
export function mapFindingToImpact(finding: FindingInput): {
  primaryImpact: ImpactCategory;
  secondaryImpacts: ImpactCategory[];
  impactLevel: ImpactLevel;
} {
  const labToImpact: Record<string, ImpactCategory> = {
    'website': 'technical_health',
    'brand': 'brand_trust',
    'rankings': 'visibility',
    'seo': 'visibility',
    'content': 'engagement',
    'audience': 'traffic',
    'gbp': 'local_presence',
    'social': 'engagement',
    'competition': 'visibility',
  };

  const categoryToImpact: Record<string, ImpactCategory> = {
    'technical': 'technical_health',
    'seo': 'visibility',
    'content': 'engagement',
    'brand': 'brand_trust',
    'website': 'technical_health',
    'local': 'local_presence',
    'social': 'engagement',
  };

  const severityToLevel: Record<string, ImpactLevel> = {
    'critical': 'high',
    'high': 'high',
    'medium': 'medium',
    'low': 'low',
    'info': 'minimal',
  };

  const primaryImpact = labToImpact[finding.labSlug] ||
    categoryToImpact[finding.category] ||
    'technical_health';

  // Determine secondary impacts based on cross-category effects
  const secondaryImpacts: ImpactCategory[] = [];

  if (primaryImpact === 'technical_health') {
    secondaryImpacts.push('visibility', 'engagement');
  } else if (primaryImpact === 'visibility') {
    secondaryImpacts.push('traffic');
  } else if (primaryImpact === 'local_presence') {
    secondaryImpacts.push('traffic', 'conversions');
  } else if (primaryImpact === 'engagement') {
    secondaryImpacts.push('conversions');
  }

  const impactLevel = severityToLevel[finding.severity] || 'medium';

  return { primaryImpact, secondaryImpacts, impactLevel };
}

/**
 * Map effort level from finding characteristics
 */
export function estimateEffort(finding: FindingInput): EffortLevel {
  const { severity, category, labSlug } = finding;

  // Quick wins are typically low-severity content/seo fixes
  if ((severity === 'low' || severity === 'medium') &&
      (category === 'content' || category === 'seo' || labSlug === 'gbp')) {
    return 'quick-win';
  }

  // Technical/critical issues are usually more significant
  if (severity === 'critical' || category === 'technical') {
    return 'significant';
  }

  // High severity but not critical
  if (severity === 'high') {
    return 'moderate';
  }

  return 'moderate';
}

// ============================================================================
// KPI Estimation
// ============================================================================

/**
 * Generate KPI estimates for a finding/work item
 */
export function generateKPIEstimates(
  finding: FindingInput,
  impactCategory: ImpactCategory,
  impactLevel: ImpactLevel
): KPIEstimate[] {
  const model = IMPACT_MODELS[impactCategory];
  if (!model) return [];

  const estimates: KPIEstimate[] = [];

  // Base improvement percentages by impact level
  const levelMultipliers: Record<ImpactLevel, number> = {
    'high': 15,
    'medium': 8,
    'low': 3,
    'minimal': 1,
  };

  const severityMultiplier = model.severityMultipliers[finding.severity] || 1.0;
  const baseImprovement = levelMultipliers[impactLevel] * severityMultiplier;

  // Generate estimates for typical KPIs
  for (const kpi of model.typicalKPIs.slice(0, 3)) {
    // Determine timeframe
    let timeframe = '1-3 months';
    if (model.timeframes.immediate.includes(kpi)) {
      timeframe = 'Immediate';
    } else if (model.timeframes.shortTerm.includes(kpi)) {
      timeframe = '1-2 weeks';
    } else if (model.timeframes.mediumTerm.includes(kpi)) {
      timeframe = '1-3 months';
    } else if (model.timeframes.longTerm.includes(kpi)) {
      timeframe = '3+ months';
    }

    // Add some variance to estimates
    const variance = 0.8 + Math.random() * 0.4; // 80-120%
    const estimated = Math.round(baseImprovement * variance * 10) / 10;

    estimates.push({
      kpi: formatKPIName(kpi),
      metric: kpi,
      estimatedChange: estimated,
      isPercentage: true,
      confidence: Math.round(60 + (impactLevel === 'high' ? 20 : impactLevel === 'medium' ? 10 : 0)),
      timeframe,
    });
  }

  return estimates;
}

function formatKPIName(kpi: string): string {
  return kpi
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ============================================================================
// ROI Calculation
// ============================================================================

/**
 * Calculate ROI for a work item
 */
export function calculateROI(
  workItem: Partial<WorkItemImpact>,
  config: ROIConfig = DEFAULT_ROI_CONFIG
): ROICalculation {
  const effort = workItem.effort || 'moderate';
  const impactLevel = workItem.estimatedLevel || 'medium';

  // Calculate cost
  const hours = config.effortHours[effort];
  const estimatedCost = hours * config.hourlyRate;

  // Estimate value based on impact
  const levelValueMultipliers: Record<ImpactLevel, number> = {
    'high': 4,
    'medium': 2,
    'low': 1,
    'minimal': 0.5,
  };

  // Base value per work item (adjusted by impact level)
  const baseValue = config.valuePerScorePoint * 2; // Assume average 2 score points
  const estimatedValue = baseValue * levelValueMultipliers[impactLevel];

  // Calculate ROI
  const roiPercent = estimatedCost > 0
    ? Math.round(((estimatedValue - estimatedCost) / estimatedCost) * 100)
    : 0;

  return {
    estimatedCost,
    estimatedValue,
    roiPercent,
    paybackPeriod: roiPercent > 100 ? '< 1 month' : roiPercent > 50 ? '1-2 months' : '2-3 months',
    methodology: 'Standard impact-based estimation',
  };
}

// ============================================================================
// Work Item Impact Builder
// ============================================================================

/**
 * Build a complete WorkItemImpact from a finding
 */
export function buildWorkItemImpact(
  finding: FindingInput,
  config: ROIConfig = DEFAULT_ROI_CONFIG
): WorkItemImpact {
  const { primaryImpact, secondaryImpacts, impactLevel } = mapFindingToImpact(finding);
  const effort = estimateEffort(finding);
  const kpiEstimates = generateKPIEstimates(finding, primaryImpact, impactLevel);

  const workItem: WorkItemImpact = {
    workItemId: finding.id || `impact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    workItemTitle: finding.title || finding.description || 'Work Item',
    source: finding.labSlug || 'unknown',
    primaryImpact,
    secondaryImpacts,
    estimatedLevel: impactLevel,
    effort,
    kpiEstimates,
  };

  // Calculate ROI
  workItem.roi = calculateROI(workItem, config);

  return workItem;
}

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Process multiple findings into work item impacts
 */
export function processFindings(
  findings: FindingInput[],
  config: ROIConfig = DEFAULT_ROI_CONFIG
): WorkItemImpact[] {
  return findings.map(finding => buildWorkItemImpact(finding, config));
}

/**
 * Sort work items by ROI potential
 */
export function sortByROIPotential(workItems: WorkItemImpact[]): WorkItemImpact[] {
  return [...workItems].sort((a, b) => {
    // Prioritize quick wins with high impact
    const aScore = getROIScore(a);
    const bScore = getROIScore(b);
    return bScore - aScore;
  });
}

function getROIScore(workItem: WorkItemImpact): number {
  const effortWeights: Record<EffortLevel, number> = {
    'quick-win': 4,
    'moderate': 2,
    'significant': 1,
    'major': 0.5,
  };

  const levelWeights: Record<ImpactLevel, number> = {
    'high': 4,
    'medium': 2,
    'low': 1,
    'minimal': 0.5,
  };

  return effortWeights[workItem.effort] * levelWeights[workItem.estimatedLevel];
}

// ============================================================================
// Summary Generation
// ============================================================================

/**
 * Generate aggregate statistics for a set of work items
 */
export function generateImpactStats(workItems: WorkItemImpact[]): {
  totalItems: number;
  byCategory: Record<ImpactCategory, number>;
  byEffort: Record<EffortLevel, number>;
  byLevel: Record<ImpactLevel, number>;
  totalEstimatedCost: number;
  totalEstimatedValue: number;
  averageROI: number;
} {
  const stats = {
    totalItems: workItems.length,
    byCategory: {} as Record<ImpactCategory, number>,
    byEffort: {} as Record<EffortLevel, number>,
    byLevel: {} as Record<ImpactLevel, number>,
    totalEstimatedCost: 0,
    totalEstimatedValue: 0,
    averageROI: 0,
  };

  for (const item of workItems) {
    // Count by category
    stats.byCategory[item.primaryImpact] = (stats.byCategory[item.primaryImpact] || 0) + 1;

    // Count by effort
    stats.byEffort[item.effort] = (stats.byEffort[item.effort] || 0) + 1;

    // Count by level
    stats.byLevel[item.estimatedLevel] = (stats.byLevel[item.estimatedLevel] || 0) + 1;

    // Sum financials
    if (item.roi) {
      stats.totalEstimatedCost += item.roi.estimatedCost;
      stats.totalEstimatedValue += item.roi.estimatedValue;
    }
  }

  // Calculate average ROI
  if (stats.totalEstimatedCost > 0) {
    stats.averageROI = Math.round(
      ((stats.totalEstimatedValue - stats.totalEstimatedCost) / stats.totalEstimatedCost) * 100
    );
  }

  return stats;
}
