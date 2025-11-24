/**
 * GAP V2 Scoring Calibration
 *
 * Applies scoring intelligence layer to ensure consistent, benchmarked scores
 */

import { calibrateScore, isCategoryLeader } from './scoringAnchors';

/**
 * Score block interface matching the GAP scorecard schema
 */
export interface ScoreBlock {
  overall: number;
  website: number;
  content: number;
  seo: number;
  brand: number;
  authority: number;
}

/**
 * Calibrate all scores in a score block
 *
 * Applies intelligent calibration to each score category:
 * - Detects category leaders and enforces appropriate minimums
 * - Blends with snapshot data when available
 * - Prevents over-scoring of weak sites
 * - Normalizes to consistent anchor points
 *
 * @param rawScores - Raw scores from LLM or initial calculation
 * @param snapshotScores - Optional snapshot scores for blending
 * @param opts - Additional options
 * @returns Fully calibrated score block
 */
export function calibrateScoresBlock(
  rawScores: Partial<ScoreBlock>,
  snapshotScores?: Partial<ScoreBlock>,
  opts?: { domain?: string }
): ScoreBlock {
  // Detect if this is a category leader
  const isLeader = opts?.domain ? isCategoryLeader(opts.domain) : false;

  // Calibrate each score category
  const calibrated: ScoreBlock = {
    overall: calibrateScore(rawScores.overall, {
      snapshot: snapshotScores?.overall,
      isCategoryLeader: isLeader,
    }),
    website: calibrateScore(rawScores.website, {
      snapshot: snapshotScores?.website,
      isCategoryLeader: isLeader,
    }),
    content: calibrateScore(rawScores.content, {
      snapshot: snapshotScores?.content,
      isCategoryLeader: isLeader,
    }),
    seo: calibrateScore(rawScores.seo, {
      snapshot: snapshotScores?.seo,
      isCategoryLeader: isLeader,
    }),
    brand: calibrateScore(rawScores.brand, {
      snapshot: snapshotScores?.brand,
      isCategoryLeader: isLeader,
    }),
    authority: calibrateScore(rawScores.authority, {
      snapshot: snapshotScores?.authority,
      isCategoryLeader: isLeader,
    }),
  };

  // Recalculate overall score as weighted average if not explicitly set
  // This ensures overall aligns with category scores
  const categoryScores = [
    calibrated.website,
    calibrated.content,
    calibrated.seo,
    calibrated.brand,
    calibrated.authority,
  ];

  const calculatedOverall = Math.round(
    categoryScores.reduce((sum, score) => sum + score, 0) / categoryScores.length
  );

  // Use calculated overall if raw overall wasn't provided or is far from average
  if (
    !rawScores.overall ||
    Math.abs(calibrated.overall - calculatedOverall) > 15
  ) {
    calibrated.overall = calibrateScore(calculatedOverall, {
      snapshot: snapshotScores?.overall,
      isCategoryLeader: isLeader,
    });
  }

  return calibrated;
}
