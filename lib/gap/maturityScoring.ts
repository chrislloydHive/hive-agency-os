/**
 * Shared maturity scoring utilities
 * Used across both IA and Full GAP for consistent scoring and labeling
 */

export type MaturityStage =
  | 'Foundational'
  | 'Emerging'
  | 'Established'
  | 'Advanced'
  | 'Category Leader';

/**
 * Get maturity stage from a 0-100 score
 * Unified ladder used across IA and Full GAP
 */
export function getMaturityStageFromScore(score: number): MaturityStage {
  if (score < 40) return 'Foundational';
  if (score < 55) return 'Emerging';
  if (score < 70) return 'Established';
  if (score < 85) return 'Advanced';
  return 'Category Leader';
}

/**
 * Get a description for a maturity stage
 */
export function getMaturityDescription(stage: MaturityStage): string {
  switch (stage) {
    case 'Foundational':
      return 'Early stage with significant opportunity for improvement';
    case 'Emerging':
      return 'Building momentum with key systems taking shape';
    case 'Established':
      return 'Solid foundation with room for optimization';
    case 'Advanced':
      return 'Strong performance across most areas';
    case 'Category Leader':
      return 'Best-in-class execution and positioning';
  }
}

/**
 * Format a score display string
 * Example: "Growth Score: 42/100 (Emerging)"
 */
export function formatGrowthScore(score: number, options: { includeLabel?: boolean } = {}): string {
  const maturity = getMaturityStageFromScore(score);
  const scoreText = `${Math.round(score)}/100`;

  if (options.includeLabel) {
    return `Growth Score: ${scoreText} (${maturity})`;
  }

  return `${scoreText} (${maturity})`;
}
