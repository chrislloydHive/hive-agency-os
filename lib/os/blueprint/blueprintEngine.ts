// lib/os/blueprint/blueprintEngine.ts
// Blueprint v2 Strategic Layer Engine
// Handles blueprint generation, drift detection, and benchmarking

import { getCompanyStrategySnapshot, type CompanyStrategicSnapshot } from '@/lib/airtable/companyStrategySnapshot';
import { getCompanyFindings } from '@/lib/os/findings/companyFindings';
import type { DiagnosticDetailFinding } from '@/lib/airtable/diagnosticDetails';
import type {
  Blueprint,
  BlueprintDimension,
  BlueprintItem,
  BlueprintPhase,
  BlueprintStatus,
  DriftAnalysis,
  DimensionDrift,
  CorrectiveAction,
  CompanyBenchmarkPosition,
  DimensionPosition,
  IndustryBenchmark,
  ProgressSnapshot,
} from './blueprintTypes';
import {
  DEFAULT_DIMENSIONS,
  PHASE_THRESHOLDS,
  DEFAULT_BENCHMARKS,
} from './blueprintTypes';

// ============================================================================
// Blueprint Generation
// ============================================================================

/**
 * Generate or update a blueprint for a company
 */
export async function generateBlueprint(companyId: string): Promise<Blueprint> {
  console.log('[blueprintEngine] Generating blueprint for:', companyId);

  // 1. Get current snapshot and findings
  const [snapshot, findings] = await Promise.all([
    getCompanyStrategySnapshot(companyId),
    getCompanyFindings(companyId),
  ]);

  // 2. Build dimensions with current data
  const dimensions = buildDimensions(snapshot, findings);

  // 3. Calculate overall completion
  const completionPercent = calculateOverallCompletion(dimensions);

  // 4. Determine phase
  const currentPhase = determinePhase(completionPercent);

  // 5. Determine status
  const status = determineStatus(dimensions);

  const blueprint: Blueprint = {
    companyId,
    version: '2.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentPhase,
    status,
    completionPercent,
    dimensions,
    milestones: generateMilestones(snapshot),
    goals: generateGoals(dimensions, snapshot),
  };

  console.log('[blueprintEngine] Generated blueprint with', completionPercent, '% completion');
  return blueprint;
}

function buildDimensions(
  snapshot: CompanyStrategicSnapshot | null,
  findings: DiagnosticDetailFinding[]
): BlueprintDimension[] {
  const dimensions: BlueprintDimension[] = [];

  for (const dimTemplate of DEFAULT_DIMENSIONS) {
    // Get score from snapshot
    const currentScore = getScoreForDimension(dimTemplate.id, snapshot);

    // Get findings for this dimension
    const dimFindings = findings.filter(f =>
      f.labSlug === dimTemplate.labSlug ||
      f.category?.toLowerCase() === dimTemplate.id
    );

    // Build items from findings
    const items = dimFindings.slice(0, 10).map((f, index) =>
      buildItemFromFinding(f, index)
    );

    // Calculate completion based on score vs target
    const completionPercent = currentScore !== null
      ? Math.min(100, Math.round((currentScore / dimTemplate.targetScore) * 100))
      : 0;

    // Determine status
    const status = determineItemStatus(currentScore, dimTemplate.targetScore, completionPercent);

    dimensions.push({
      ...dimTemplate,
      currentScore,
      completionPercent,
      status,
      items,
    });
  }

  return dimensions;
}

function getScoreForDimension(
  _dimensionId: string,
  snapshot: CompanyStrategicSnapshot | null
): number | null {
  // CompanyStrategicSnapshot only has overallScore, not individual dimension scores
  // For now, we use the overall score as a proxy for all dimensions
  // TODO: Add individual dimension scores to the snapshot schema
  if (!snapshot) return null;
  return snapshot.overallScore ?? null;
}

function buildItemFromFinding(finding: DiagnosticDetailFinding, index: number): BlueprintItem {
  const priorityMap: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
    'critical': 'critical',
    'high': 'high',
    'medium': 'medium',
    'low': 'low',
  };

  return {
    id: finding.id || `item-${index}`,
    title: finding.description?.slice(0, 100) || 'Finding',
    description: finding.recommendation || finding.description || '',
    completed: false,
    priority: priorityMap[finding.severity || 'medium'] || 'medium',
    findingId: finding.id,
    effort: finding.severity === 'critical' || finding.severity === 'high' ? 'significant' : 'moderate',
  };
}

function calculateOverallCompletion(dimensions: BlueprintDimension[]): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const dim of dimensions) {
    weightedSum += dim.completionPercent * dim.weight;
    totalWeight += dim.weight;
  }

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

function determinePhase(completionPercent: number): BlueprintPhase {
  for (const [phase, thresholds] of Object.entries(PHASE_THRESHOLDS)) {
    if (completionPercent >= thresholds.min && completionPercent < thresholds.max) {
      return phase as BlueprintPhase;
    }
  }
  return completionPercent >= 85 ? 'excellence' : 'foundation';
}

function determineStatus(dimensions: BlueprintDimension[]): BlueprintStatus {
  const atRisk = dimensions.filter(d => d.status === 'at_risk').length;
  const completed = dimensions.filter(d => d.status === 'completed').length;
  const inProgress = dimensions.filter(d => d.status === 'in_progress').length;

  if (completed === dimensions.length) return 'completed';
  if (atRisk >= 2) return 'at_risk';
  if (inProgress > 0) return 'in_progress';
  return 'on_track';
}

function determineItemStatus(
  current: number | null,
  target: number,
  completion: number
): BlueprintStatus {
  if (current === null) return 'not_started';
  if (current >= target) return 'completed';
  if (completion >= 80) return 'on_track';
  if (completion >= 50) return 'in_progress';
  if (completion < 30) return 'at_risk';
  return 'in_progress';
}

function generateMilestones(snapshot: CompanyStrategicSnapshot | null) {
  const milestones = [
    {
      id: 'baseline',
      title: 'Baseline Established',
      description: 'Complete initial diagnostic and establish baseline scores',
      targetDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      achieved: !!snapshot?.overallScore,
      scoreThreshold: 1,
    },
    {
      id: 'foundation',
      title: 'Foundation Complete',
      description: 'Reach 40% overall completion',
      targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      achieved: (snapshot?.overallScore || 0) >= 40,
      scoreThreshold: 40,
    },
    {
      id: 'optimization',
      title: 'Optimization Phase',
      description: 'Reach 65% overall completion',
      targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      achieved: (snapshot?.overallScore || 0) >= 65,
      scoreThreshold: 65,
    },
    {
      id: 'excellence',
      title: 'Excellence Achieved',
      description: 'Reach 85% overall completion',
      targetDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      achieved: (snapshot?.overallScore || 0) >= 85,
      scoreThreshold: 85,
    },
  ];

  return milestones;
}

function generateGoals(dimensions: BlueprintDimension[], snapshot: CompanyStrategicSnapshot | null) {
  const goals = [];

  for (const dim of dimensions) {
    if (dim.currentScore !== null && dim.currentScore < dim.targetScore) {
      const gap = dim.targetScore - dim.currentScore;
      goals.push({
        id: `goal-${dim.id}`,
        title: `Improve ${dim.name}`,
        description: `Raise ${dim.name} score from ${dim.currentScore} to ${dim.targetScore}`,
        dimensionId: dim.id,
        targetMetric: `${dim.id}_score`,
        currentValue: dim.currentScore,
        targetValue: dim.targetScore,
        progress: Math.round((dim.currentScore / dim.targetScore) * 100),
      });
    }
  }

  return goals;
}

// ============================================================================
// Drift Detection
// ============================================================================

/**
 * Analyze drift from blueprint targets
 */
export async function analyzeDrift(
  companyId: string,
  previousSnapshot?: CompanyStrategicSnapshot | null
): Promise<DriftAnalysis> {
  console.log('[blueprintEngine] Analyzing drift for:', companyId);

  const currentSnapshot = await getCompanyStrategySnapshot(companyId);

  const dimensionDrifts: DimensionDrift[] = [];
  const correctiveActions: CorrectiveAction[] = [];

  for (const dimTemplate of DEFAULT_DIMENSIONS) {
    const currentScore = getScoreForDimension(dimTemplate.id, currentSnapshot);
    const previousScore = previousSnapshot
      ? getScoreForDimension(dimTemplate.id, previousSnapshot)
      : null;

    if (currentScore !== null && previousScore !== null) {
      const scoreChange = currentScore - previousScore;
      const percentChange = previousScore > 0
        ? Math.round((scoreChange / previousScore) * 100)
        : 0;

      const direction = scoreChange > 2 ? 'positive' :
                       scoreChange < -2 ? 'negative' : 'neutral';
      const severity = scoreChange < -10 ? 'critical' :
                      scoreChange < -5 ? 'warning' :
                      scoreChange < -2 ? 'minor' : 'none';

      const drift: DimensionDrift = {
        dimensionId: dimTemplate.id,
        dimensionName: dimTemplate.name,
        direction,
        severity,
        scoreChange,
        percentChange,
        previousScore,
        currentScore,
        factors: [],
      };

      dimensionDrifts.push(drift);

      // Generate corrective action if needed
      if (severity !== 'none') {
        correctiveActions.push({
          id: `action-${dimTemplate.id}`,
          title: `Address ${dimTemplate.name} decline`,
          description: `${dimTemplate.name} dropped ${Math.abs(scoreChange)} points. Review recent changes and run diagnostics.`,
          dimensionId: dimTemplate.id,
          priority: severity === 'critical' ? 'immediate' : 'soon',
          expectedImpact: `Restore ${Math.abs(scoreChange)} points`,
          actionLink: `/c/${companyId}/brain/labs/${dimTemplate.labSlug || 'website'}`,
        });
      }
    }
  }

  // Calculate overall severity
  const criticalCount = dimensionDrifts.filter(d => d.severity === 'critical').length;
  const warningCount = dimensionDrifts.filter(d => d.severity === 'warning').length;

  let overallSeverity: DriftAnalysis['overallSeverity'] = 'none';
  if (criticalCount > 0) overallSeverity = 'critical';
  else if (warningCount > 0) overallSeverity = 'warning';
  else if (dimensionDrifts.some(d => d.severity === 'minor')) overallSeverity = 'minor';

  return {
    companyId,
    analyzedAt: new Date().toISOString(),
    overallSeverity,
    hasSignificantDrift: criticalCount > 0 || warningCount >= 2,
    dimensionDrifts,
    correctiveActions,
    daysSinceLastCheck: 0, // Would need historical tracking
  };
}

// ============================================================================
// Benchmarking
// ============================================================================

/**
 * Compare company against industry benchmarks
 */
export async function benchmarkCompany(
  companyId: string,
  benchmark: IndustryBenchmark = DEFAULT_BENCHMARKS
): Promise<CompanyBenchmarkPosition> {
  console.log('[blueprintEngine] Benchmarking company:', companyId);

  const snapshot = await getCompanyStrategySnapshot(companyId);

  const byDimension: DimensionPosition[] = [];
  let totalPercentile = 0;
  let dimensionsWithScore = 0;

  for (const dimBenchmark of benchmark.dimensions) {
    const score = getScoreForDimension(dimBenchmark.dimension, snapshot);

    if (score !== null) {
      // Calculate percentile based on score position
      let percentile = 50; // Default to median
      if (score >= dimBenchmark.top10Percent) percentile = 95;
      else if (score >= dimBenchmark.top25Percent) percentile = 85;
      else if (score >= dimBenchmark.median) percentile = 60;
      else if (score >= dimBenchmark.bottom25Percent) percentile = 35;
      else percentile = 15;

      const vsAverage = score - dimBenchmark.average;

      byDimension.push({
        dimension: dimBenchmark.dimension,
        score,
        percentile,
        vsAverage,
        positionLabel: getPositionLabel(percentile),
      });

      totalPercentile += percentile;
      dimensionsWithScore++;
    } else {
      byDimension.push({
        dimension: dimBenchmark.dimension,
        score: null,
        percentile: 0,
        vsAverage: 0,
        positionLabel: 'no_data',
      });
    }
  }

  const overallPercentile = dimensionsWithScore > 0
    ? Math.round(totalPercentile / dimensionsWithScore)
    : 0;

  return {
    companyId,
    industryId: benchmark.industryId,
    overallPercentile,
    positionLabel: getPositionLabel(overallPercentile),
    vsAverage: snapshot?.overallScore
      ? snapshot.overallScore - 55 // General average
      : 0,
    byDimension,
    comparedAt: new Date().toISOString(),
  };
}

function getPositionLabel(percentile: number): 'excellent' | 'good' | 'average' | 'below_average' | 'needs_improvement' {
  if (percentile >= 85) return 'excellent';
  if (percentile >= 70) return 'good';
  if (percentile >= 50) return 'average';
  if (percentile >= 30) return 'below_average';
  return 'needs_improvement';
}

// ============================================================================
// Progress Tracking
// ============================================================================

/**
 * Get a progress snapshot for the current state
 */
export async function getProgressSnapshot(companyId: string): Promise<ProgressSnapshot> {
  const blueprint = await generateBlueprint(companyId);
  const snapshot = await getCompanyStrategySnapshot(companyId);

  return {
    date: new Date().toISOString(),
    completionPercent: blueprint.completionPercent,
    overallScore: snapshot?.overallScore ?? null,
    dimensions: blueprint.dimensions.map(d => ({
      id: d.id,
      completion: d.completionPercent,
      score: d.currentScore,
    })),
    itemsCompleted: blueprint.dimensions.reduce(
      (sum, d) => sum + d.items.filter(i => i.completed).length,
      0
    ),
    milestonesAchieved: blueprint.milestones
      .filter(m => m.achieved)
      .map(m => m.id),
  };
}

// ============================================================================
// Re-exports
// ============================================================================

export * from './blueprintTypes';
