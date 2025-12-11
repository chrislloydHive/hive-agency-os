// lib/os/impact/impactEngine.ts
// Main Impact & ROI Engine
// Orchestrates impact calculation, tracking, and summary generation

import { getCompanyFindings } from '@/lib/os/findings/companyFindings';
import { getCompanyStrategySnapshot } from '@/lib/airtable/companyStrategySnapshot';
import type { DiagnosticDetailFinding } from '@/lib/airtable/diagnosticDetails';
import type {
  WorkItemImpact,
  CompanyImpactSummary,
  ImpactCategory,
  AggregateROI,
  ScoreImpactSummary,
  ROIConfig,
} from './impactTypes';
import { DEFAULT_ROI_CONFIG } from './impactTypes';
import {
  buildWorkItemImpact,
  processFindings,
  sortByROIPotential,
  generateImpactStats,
} from './impactCalculator';

// ============================================================================
// Main Engine Functions
// ============================================================================

/**
 * Generate impact analysis for all findings in a company
 */
export async function analyzeCompanyImpact(
  companyId: string,
  config: ROIConfig = DEFAULT_ROI_CONFIG
): Promise<WorkItemImpact[]> {
  console.log('[impactEngine] Analyzing impact for company:', companyId);

  // 1. Load findings
  const findings = await getCompanyFindings(companyId);

  if (findings.length === 0) {
    console.log('[impactEngine] No findings found');
    return [];
  }

  // 2. Convert findings to input format
  const findingInputs = findings.map((f: DiagnosticDetailFinding) => ({
    id: f.id || 'unknown',
    title: f.description || 'Finding',
    description: f.description || '',
    labSlug: f.labSlug || 'unknown',
    category: f.category || 'general',
    severity: f.severity || 'medium',
    recommendation: f.recommendation,
  }));

  // 3. Process into work item impacts
  const impacts = processFindings(findingInputs, config);

  // 4. Sort by ROI potential
  const sorted = sortByROIPotential(impacts);

  console.log('[impactEngine] Generated', sorted.length, 'impact assessments');
  return sorted;
}

/**
 * Generate a comprehensive impact summary for a company
 */
export async function generateCompanyImpactSummary(
  companyId: string,
  periodDays: number = 30,
  config: ROIConfig = DEFAULT_ROI_CONFIG
): Promise<CompanyImpactSummary> {
  console.log('[impactEngine] Generating impact summary for:', companyId);

  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() - periodDays);

  // Get all impacts
  const workItems = await analyzeCompanyImpact(companyId, config);
  const stats = generateImpactStats(workItems);

  // Get current snapshot for score comparison
  const snapshot = await getCompanyStrategySnapshot(companyId);

  // Build category summaries
  const byCategory: Record<ImpactCategory, any> = {} as any;
  const categories: ImpactCategory[] = [
    'traffic', 'conversions', 'visibility', 'engagement',
    'brand_trust', 'local_presence', 'technical_health',
  ];

  for (const cat of categories) {
    const catItems = workItems.filter(w => w.primaryImpact === cat);
    byCategory[cat] = {
      category: cat,
      workItemCount: catItems.length,
      averageImpactLevel: catItems.length > 0
        ? getMostCommonLevel(catItems)
        : 'medium',
      totalEstimatedChange: catItems.reduce((sum, w) => {
        const firstEstimate = w.kpiEstimates[0];
        return sum + (firstEstimate?.estimatedChange || 0);
      }, 0),
    };
  }

  // Top performers (highest ROI)
  const topPerformers = workItems.slice(0, 5);

  // Aggregate ROI
  const aggregateROI: AggregateROI = {
    totalEstimatedCost: stats.totalEstimatedCost,
    totalEstimatedValue: stats.totalEstimatedValue,
    overallROIPercent: stats.averageROI,
    costPerPointImprovement: stats.totalEstimatedCost > 0
      ? Math.round(stats.totalEstimatedCost / Math.max(workItems.length, 1))
      : 0,
  };

  // Score impact summary
  const scoreImpact: ScoreImpactSummary = {
    startingScore: snapshot?.overallScore ?? null,
    currentScore: snapshot?.overallScore ?? null,
    scoreChange: null, // Would need historical data
    attributedWorkItems: topPerformers.map(w => w.workItemId),
  };

  return {
    companyId,
    period: {
      start: periodStart.toISOString(),
      end: now.toISOString(),
    },
    totalCompleted: 0, // Would need work tracking
    measuredCount: 0,  // Would need measurement tracking
    byCategory,
    topPerformers,
    aggregateROI,
    scoreImpact,
  };
}

function getMostCommonLevel(items: WorkItemImpact[]): 'high' | 'medium' | 'low' | 'minimal' {
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.estimatedLevel] = (counts[item.estimatedLevel] || 0) + 1;
  }
  let maxLevel = 'medium';
  let maxCount = 0;
  for (const [level, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      maxLevel = level;
    }
  }
  return maxLevel as any;
}

// ============================================================================
// Filtered Queries
// ============================================================================

/**
 * Get high-ROI quick wins
 */
export async function getQuickWins(
  companyId: string,
  limit: number = 5
): Promise<WorkItemImpact[]> {
  const impacts = await analyzeCompanyImpact(companyId);
  return impacts
    .filter(w => w.effort === 'quick-win')
    .slice(0, limit);
}

/**
 * Get impacts by category
 */
export async function getImpactsByCategory(
  companyId: string,
  category: ImpactCategory
): Promise<WorkItemImpact[]> {
  const impacts = await analyzeCompanyImpact(companyId);
  return impacts.filter(w => w.primaryImpact === category);
}

/**
 * Get highest impact opportunities
 */
export async function getHighImpactOpportunities(
  companyId: string,
  limit: number = 10
): Promise<WorkItemImpact[]> {
  const impacts = await analyzeCompanyImpact(companyId);
  return impacts
    .filter(w => w.estimatedLevel === 'high')
    .slice(0, limit);
}

// ============================================================================
// ROI Projections
// ============================================================================

/**
 * Project ROI for completing a set of work items
 */
export function projectROI(
  workItems: WorkItemImpact[],
  config: ROIConfig = DEFAULT_ROI_CONFIG
): {
  totalCost: number;
  projectedValue: number;
  projectedROI: number;
  breakEvenPoint: string;
  confidenceLevel: number;
} {
  let totalCost = 0;
  let projectedValue = 0;
  let confidenceSum = 0;

  for (const item of workItems) {
    if (item.roi) {
      totalCost += item.roi.estimatedCost;
      projectedValue += item.roi.estimatedValue;
    }
    // Average confidence from KPI estimates
    const avgConfidence = item.kpiEstimates.length > 0
      ? item.kpiEstimates.reduce((sum, e) => sum + e.confidence, 0) / item.kpiEstimates.length
      : 50;
    confidenceSum += avgConfidence;
  }

  const projectedROI = totalCost > 0
    ? Math.round(((projectedValue - totalCost) / totalCost) * 100)
    : 0;

  const confidenceLevel = workItems.length > 0
    ? Math.round(confidenceSum / workItems.length)
    : 0;

  let breakEvenPoint = 'Unknown';
  if (projectedROI > 200) breakEvenPoint = '< 1 month';
  else if (projectedROI > 100) breakEvenPoint = '1-2 months';
  else if (projectedROI > 50) breakEvenPoint = '2-3 months';
  else if (projectedROI > 0) breakEvenPoint = '3-6 months';
  else breakEvenPoint = '> 6 months';

  return {
    totalCost,
    projectedValue,
    projectedROI,
    breakEvenPoint,
    confidenceLevel,
  };
}

// ============================================================================
// Re-exports
// ============================================================================

export * from './impactTypes';
export {
  buildWorkItemImpact,
  processFindings,
  sortByROIPotential,
  generateImpactStats,
  mapFindingToImpact,
  calculateROI,
} from './impactCalculator';
