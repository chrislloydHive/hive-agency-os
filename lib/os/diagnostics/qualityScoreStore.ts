// lib/os/diagnostics/qualityScoreStore.ts
// Lab Quality Score Storage Layer
//
// Stores and retrieves quality scores for diagnostic runs.
// Uses the DiagnosticRuns table metadata field for storage.
// Quality scores are computed per run and stored alongside run data.

import type {
  LabQualityScore,
  LabQualityScoreRecord,
  LabQualityResponse,
  LabQualityInline,
} from '@/lib/types/labQualityScore';
import type { LabKey } from '@/lib/types/labSummary';
import {
  getLatestRunForCompanyAndTool,
  listDiagnosticRunsForCompany,
  updateDiagnosticRun,
  type DiagnosticRun,
  type DiagnosticToolId,
} from './runs';
import {
  computeLabQualityScore,
  extractQualityInputFromLabRaw,
} from './qualityScore';
import { getLatestCompetitionRunV3 } from '@/lib/competition-v3/store';

// ============================================================================
// Storage Keys
// ============================================================================

const QUALITY_SCORE_METADATA_KEY = 'labQualityScore';

// Map LabKey to DiagnosticToolId
const LAB_KEY_TO_TOOL_ID: Record<LabKey, DiagnosticToolId> = {
  websiteLab: 'websiteLab',
  competitionLab: 'competitionLab',
  brandLab: 'brandLab',
  gapPlan: 'gapPlan',
  audienceLab: 'audienceLab',
};

// ============================================================================
// Storage Functions
// ============================================================================

/**
 * Extract quality score from run metadata if stored
 */
function extractQualityScoreFromMetadata(
  metadata: Record<string, unknown> | undefined | null
): LabQualityScore | null {
  if (!metadata || !metadata[QUALITY_SCORE_METADATA_KEY]) {
    return null;
  }

  try {
    const stored = metadata[QUALITY_SCORE_METADATA_KEY] as LabQualityScoreRecord;

    // Reconstruct LabQualityScore from stored record
    return {
      id: stored.id || '',
      companyId: stored.companyId,
      labKey: stored.labKey,
      runId: stored.runId,
      computedAt: stored.computedAt,
      score: stored.score,
      qualityBand: stored.qualityBand,
      metrics: JSON.parse(stored.metricsJson),
      weights: JSON.parse(stored.weightsJson),
      warnings: JSON.parse(stored.warningsJson),
      regression: stored.regressionDiff !== null
        ? {
            isRegression: stored.regressionDiff <= -10,
            pointDifference: stored.regressionDiff,
            previousScore: stored.score - stored.regressionDiff,
            previousRunId: stored.previousRunId || '',
            previousRunAt: '', // Will be populated from history
          }
        : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Create storage record from quality score
 */
function createStorageRecord(score: LabQualityScore): LabQualityScoreRecord {
  return {
    id: score.id,
    companyId: score.companyId,
    labKey: score.labKey,
    runId: score.runId,
    computedAt: score.computedAt,
    score: score.score,
    qualityBand: score.qualityBand,
    metricsJson: JSON.stringify(score.metrics),
    warningsJson: JSON.stringify(score.warnings),
    weightsJson: JSON.stringify(score.weights),
    regressionDiff: score.regression?.pointDifference ?? null,
    previousRunId: score.regression?.previousRunId ?? null,
  };
}

/**
 * Save quality score to diagnostic run metadata
 */
export async function saveQualityScore(
  runId: string,
  qualityScore: LabQualityScore
): Promise<void> {
  const record = createStorageRecord(qualityScore);

  await updateDiagnosticRun(runId, {
    metadata: {
      [QUALITY_SCORE_METADATA_KEY]: record,
    },
  });
}

/**
 * Get quality score for a specific run
 */
export async function getQualityScoreForRun(
  runId: string
): Promise<LabQualityScore | null> {
  // Import dynamically to avoid circular dependency
  const { getDiagnosticRun } = await import('./runs');
  const run = await getDiagnosticRun(runId);

  if (!run) {
    return null;
  }

  return extractQualityScoreFromMetadata(run.metadata);
}

/**
 * Compute and store quality score for a diagnostic run
 *
 * Returns null if there's insufficient data to compute a quality score.
 */
export async function computeAndStoreQualityScore(
  run: DiagnosticRun,
  previousScore?: LabQualityScore
): Promise<LabQualityScore | null> {
  const labKey = run.toolId as LabKey;

  // Extract quality input from raw JSON
  const input = extractQualityInputFromLabRaw(
    labKey,
    run.id,
    run.companyId,
    run.rawJson
  );

  // Add previous score for regression detection
  input.previousScore = previousScore;

  // Compute quality score - may be null if insufficient data
  const qualityScore = computeLabQualityScore(input);

  // Don't store anything if we couldn't compute a score
  if (!qualityScore) {
    console.log(`[LabQualityScore] No score computed for ${labKey} run ${run.id} - insufficient data`);
    return null;
  }

  // Store in run metadata
  await saveQualityScore(run.id, qualityScore);

  // Log regression if detected
  if (qualityScore.regression?.isRegression) {
    console.log('[LabQualityScore] Regression detected:', {
      labKey,
      runId: run.id,
      currentScore: qualityScore.score,
      previousScore: qualityScore.regression.previousScore,
      drop: qualityScore.regression.pointDifference,
    });

    // Could emit an event here for operational monitoring
    // await emitEvent('lab_quality_regressed', { ... });
  }

  return qualityScore;
}

/**
 * Get current quality scores for all labs for a company
 */
export async function getCurrentQualityScores(
  companyId: string
): Promise<Record<LabKey, LabQualityScore | null>> {
  const scores: Record<LabKey, LabQualityScore | null> = {
    websiteLab: null,
    competitionLab: null,
    brandLab: null,
    gapPlan: null,
    audienceLab: null,
  };

  // Fetch latest runs for each lab in parallel
  const [websiteRun, brandRun, gapRun, competitionRun, audienceRun] = await Promise.all([
    getLatestRunForCompanyAndTool(companyId, 'websiteLab'),
    getLatestRunForCompanyAndTool(companyId, 'brandLab'),
    getLatestRunForCompanyAndTool(companyId, 'gapPlan'),
    getLatestCompetitionRunV3(companyId),
    getLatestRunForCompanyAndTool(companyId, 'audienceLab'),
  ]);

  // Extract or compute quality scores
  if (websiteRun?.status === 'complete') {
    scores.websiteLab = await getOrComputeQualityScore(websiteRun, companyId, 'websiteLab');
  }

  if (brandRun?.status === 'complete') {
    scores.brandLab = await getOrComputeQualityScore(brandRun, companyId, 'brandLab');
  }

  if (gapRun?.status === 'complete') {
    scores.gapPlan = await getOrComputeQualityScore(gapRun, companyId, 'gapPlan');
  }

  if (audienceRun?.status === 'complete') {
    scores.audienceLab = await getOrComputeQualityScore(audienceRun, companyId, 'audienceLab');
  }

  // Competition Lab uses different storage - compute on-the-fly
  if (competitionRun?.status === 'completed') {
    const input = extractQualityInputFromLabRaw(
      'competitionLab',
      competitionRun.runId,
      companyId,
      competitionRun
    );
    scores.competitionLab = computeLabQualityScore(input);
  }

  return scores;
}

/**
 * Get or compute quality score for a run
 */
async function getOrComputeQualityScore(
  run: DiagnosticRun,
  companyId: string,
  labKey: LabKey
): Promise<LabQualityScore | null> {
  // Check if score already exists in metadata
  const existingScore = extractQualityScoreFromMetadata(run.metadata);
  if (existingScore) {
    return existingScore;
  }

  // Get previous score for regression detection
  const previousScore = await getPreviousQualityScore(companyId, labKey, run.id);

  // Compute and store
  return computeAndStoreQualityScore(run, previousScore ?? undefined);
}

/**
 * Get historical quality scores for a lab
 */
export async function getQualityScoreHistory(
  companyId: string,
  labKey: LabKey,
  limit: number = 10
): Promise<LabQualityScore[]> {
  const toolId = LAB_KEY_TO_TOOL_ID[labKey];
  const runs = await listDiagnosticRunsForCompany(companyId, {
    toolId,
    limit,
    status: 'complete',
  });

  const scores: LabQualityScore[] = [];

  for (const run of runs) {
    const score = extractQualityScoreFromMetadata(run.metadata);
    if (score) {
      scores.push(score);
    }
  }

  // Sort by computed date, most recent first
  scores.sort((a, b) =>
    new Date(b.computedAt).getTime() - new Date(a.computedAt).getTime()
  );

  return scores.slice(0, limit);
}

/**
 * Get previous quality score for regression comparison
 */
async function getPreviousQualityScore(
  companyId: string,
  labKey: LabKey,
  currentRunId: string
): Promise<LabQualityScore | null> {
  const toolId = LAB_KEY_TO_TOOL_ID[labKey];
  const runs = await listDiagnosticRunsForCompany(companyId, {
    toolId,
    limit: 5,
    status: 'complete',
  });

  // Find the run before the current one
  for (const run of runs) {
    if (run.id !== currentRunId) {
      const score = extractQualityScoreFromMetadata(run.metadata);
      if (score) {
        return score;
      }
    }
  }

  return null;
}

// ============================================================================
// API Response Builders
// ============================================================================

/**
 * Build full quality response for API
 */
export async function buildLabQualityResponse(
  companyId: string
): Promise<LabQualityResponse> {
  const current = await getCurrentQualityScores(companyId);

  // Get history for each lab
  const history: Record<LabKey, LabQualityScore[]> = {
    websiteLab: await getQualityScoreHistory(companyId, 'websiteLab'),
    competitionLab: await getQualityScoreHistory(companyId, 'competitionLab'),
    brandLab: await getQualityScoreHistory(companyId, 'brandLab'),
    gapPlan: await getQualityScoreHistory(companyId, 'gapPlan'),
    audienceLab: await getQualityScoreHistory(companyId, 'audienceLab'),
  };

  // Find regressions
  const regressions: LabKey[] = [];
  for (const [key, score] of Object.entries(current)) {
    if (score?.regression?.isRegression) {
      regressions.push(key as LabKey);
    }
  }

  // Calculate summary stats
  const scores = Object.values(current).filter((s): s is LabQualityScore => s !== null);
  const averageScore = scores.length > 0
    ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length)
    : 0;

  const labsWithWarnings = scores
    .filter(s => s.warnings.length > 0)
    .map(s => s.labKey);

  let lowestLab: LabKey | null = null;
  let highestLab: LabKey | null = null;

  if (scores.length > 0) {
    const sorted = [...scores].sort((a, b) => a.score - b.score);
    lowestLab = sorted[0].labKey;
    highestLab = sorted[sorted.length - 1].labKey;
  }

  return {
    ok: true,
    companyId,
    current,
    history,
    regressions,
    summary: {
      averageScore,
      lowestLab,
      highestLab,
      labsWithWarnings,
    },
  };
}

/**
 * Build inline quality summary for lab summary response
 */
export function buildQualityInline(
  qualityScore: LabQualityScore | null
): LabQualityInline | null {
  if (!qualityScore) {
    return null;
  }

  return {
    score: qualityScore.score,
    qualityBand: qualityScore.qualityBand,
    hasWarnings: qualityScore.warnings.length > 0,
    warningCount: qualityScore.warnings.length,
    regression: qualityScore.regression
      ? {
          isRegression: qualityScore.regression.isRegression,
          pointDifference: qualityScore.regression.pointDifference,
        }
      : undefined,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a lab has quality issues (Poor or Weak band)
 */
export function hasQualityIssues(score: LabQualityScore | null): boolean {
  if (!score) return false;
  return score.qualityBand === 'Poor' || score.qualityBand === 'Weak';
}

/**
 * Check if there's a regression for a lab
 */
export function hasRegression(score: LabQualityScore | null): boolean {
  return score?.regression?.isRegression ?? false;
}

/**
 * Get formatted quality message for UI
 */
export function getQualityMessage(score: LabQualityScore | null): string | null {
  if (!score) return null;

  if (score.qualityBand === 'Poor') {
    return 'Low-quality output - findings may be generic or under-evidenced';
  }

  if (score.qualityBand === 'Weak') {
    return 'Some quality issues detected - review findings carefully';
  }

  if (score.warnings.length > 0) {
    return `${score.warnings.length} quality warning${score.warnings.length > 1 ? 's' : ''} detected`;
  }

  return null;
}
