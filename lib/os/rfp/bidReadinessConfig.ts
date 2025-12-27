// lib/os/rfp/bidReadinessConfig.ts
// Centralized configuration for Bid Readiness scoring
//
// This config allows the readiness calculation to be tuned based on
// outcome analysis insights. Currently read-only; future versions may
// support persisted customization.

// ============================================================================
// Types
// ============================================================================

/**
 * Weights for each component in the overall bid readiness score
 * All weights should sum to 1.0
 */
export interface BidReadinessWeights {
  /** Weight for Firm Brain data quality (0-1) */
  firmBrain: number;
  /** Weight for Win Strategy completeness (0-1) */
  strategy: number;
  /** Weight for Rubric/Criteria coverage (0-1) */
  coverage: number;
  /** Weight for Proof plan coverage (0-1) */
  proof: number;
  /** Weight for Persona alignment (0-1) */
  persona: number;
}

/**
 * Thresholds for recommendation determination
 */
export interface BidReadinessThresholds {
  /** Score >= this value = GO recommendation */
  go: number;
  /** Score >= this value (but < go) = CONDITIONAL recommendation */
  conditionalMin: number;
  // Score < conditionalMin = NO_GO
}

/**
 * Penalty multipliers for various risk conditions
 */
export interface BidReadinessPenalties {
  /** Multiplier applied to persona alignment when mismatch detected (0-1) */
  personaMismatchMultiplier: number;
  /** Score penalty applied when critical risks are present (points) */
  criticalRiskPenalty: number;
  /** Score penalty per proof gap (points per gap) */
  proofGapPenalty: number;
}

/**
 * Risk severity thresholds
 */
export interface RiskSeverityThresholds {
  /** Component score below this = critical risk */
  critical: number;
  /** Component score below this = high risk */
  high: number;
  /** Component score below this = medium risk */
  medium: number;
  // Score >= medium = low risk (acceptable)
}

/**
 * Complete bid readiness configuration
 */
export interface BidReadinessConfig {
  /** Component weights */
  weights: BidReadinessWeights;
  /** Recommendation thresholds */
  thresholds: BidReadinessThresholds;
  /** Penalty values */
  penalties: BidReadinessPenalties;
  /** Risk severity thresholds */
  riskThresholds: RiskSeverityThresholds;
  /** Config version for tracking changes */
  version: string;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default weights for bid readiness components
 */
export const DEFAULT_WEIGHTS: BidReadinessWeights = {
  firmBrain: 0.25,   // Foundation: Firm Brain data quality
  strategy: 0.20,    // Win strategy completeness
  coverage: 0.25,    // Rubric coverage across sections
  proof: 0.15,       // Proof plan coverage
  persona: 0.15,     // Persona alignment (no skew)
};

/**
 * Default thresholds for recommendations
 */
export const DEFAULT_THRESHOLDS: BidReadinessThresholds = {
  go: 70,            // Score >= 70 = GO
  conditionalMin: 45, // Score 45-69 = CONDITIONAL
  // Score < 45 = NO_GO
};

/**
 * Default penalties
 */
export const DEFAULT_PENALTIES: BidReadinessPenalties = {
  personaMismatchMultiplier: 0.8,  // 20% reduction for persona mismatch
  criticalRiskPenalty: 10,          // -10 points for critical risks
  proofGapPenalty: 2,               // -2 points per proof gap
};

/**
 * Default risk severity thresholds
 */
export const DEFAULT_RISK_THRESHOLDS: RiskSeverityThresholds = {
  critical: 20,      // Component score < 20 = critical risk
  high: 40,          // Component score < 40 = high risk
  medium: 60,        // Component score < 60 = medium risk
  // Score >= 60 = low risk
};

/**
 * The default bid readiness configuration
 */
export const DEFAULT_CONFIG: BidReadinessConfig = {
  weights: DEFAULT_WEIGHTS,
  thresholds: DEFAULT_THRESHOLDS,
  penalties: DEFAULT_PENALTIES,
  riskThresholds: DEFAULT_RISK_THRESHOLDS,
  version: '1.0.0',
};

// ============================================================================
// Config Access Functions
// ============================================================================

/**
 * Get the current bid readiness config
 * Currently returns defaults; future versions may load from storage
 */
export function getBidReadinessConfig(): BidReadinessConfig {
  return DEFAULT_CONFIG;
}

/**
 * Validate that weights sum to 1.0 (within tolerance)
 */
export function validateWeights(weights: BidReadinessWeights): boolean {
  const sum = weights.firmBrain + weights.strategy + weights.coverage + weights.proof + weights.persona;
  return Math.abs(sum - 1.0) < 0.001;
}

/**
 * Validate thresholds are sensible
 */
export function validateThresholds(thresholds: BidReadinessThresholds): boolean {
  return (
    thresholds.go > thresholds.conditionalMin &&
    thresholds.go >= 0 &&
    thresholds.go <= 100 &&
    thresholds.conditionalMin >= 0 &&
    thresholds.conditionalMin <= 100
  );
}

/**
 * Validate a complete config
 */
export function validateConfig(config: BidReadinessConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!validateWeights(config.weights)) {
    errors.push('Weights must sum to 1.0');
  }

  if (!validateThresholds(config.thresholds)) {
    errors.push('Thresholds must have go > conditionalMin, both in range 0-100');
  }

  if (config.penalties.personaMismatchMultiplier < 0 || config.penalties.personaMismatchMultiplier > 1) {
    errors.push('personaMismatchMultiplier must be between 0 and 1');
  }

  if (config.penalties.criticalRiskPenalty < 0 || config.penalties.criticalRiskPenalty > 50) {
    errors.push('criticalRiskPenalty must be between 0 and 50');
  }

  if (config.penalties.proofGapPenalty < 0 || config.penalties.proofGapPenalty > 10) {
    errors.push('proofGapPenalty must be between 0 and 10');
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// Config Diff Functions (for tuning suggestions)
// ============================================================================

/**
 * A single config change
 */
export interface ConfigChange {
  /** Path to the changed value (e.g., "thresholds.go") */
  path: string;
  /** Previous value */
  from: number;
  /** New value */
  to: number;
  /** Human-readable description of the change */
  description: string;
}

/**
 * Create a diff between two configs
 */
export function diffConfigs(
  oldConfig: BidReadinessConfig,
  newConfig: BidReadinessConfig
): ConfigChange[] {
  const changes: ConfigChange[] = [];

  // Check weights
  const weightKeys = ['firmBrain', 'strategy', 'coverage', 'proof', 'persona'] as const;
  for (const key of weightKeys) {
    if (oldConfig.weights[key] !== newConfig.weights[key]) {
      changes.push({
        path: `weights.${key}`,
        from: oldConfig.weights[key],
        to: newConfig.weights[key],
        description: `${key} weight: ${(oldConfig.weights[key] * 100).toFixed(0)}% → ${(newConfig.weights[key] * 100).toFixed(0)}%`,
      });
    }
  }

  // Check thresholds
  if (oldConfig.thresholds.go !== newConfig.thresholds.go) {
    changes.push({
      path: 'thresholds.go',
      from: oldConfig.thresholds.go,
      to: newConfig.thresholds.go,
      description: `GO threshold: ${oldConfig.thresholds.go} → ${newConfig.thresholds.go}`,
    });
  }

  if (oldConfig.thresholds.conditionalMin !== newConfig.thresholds.conditionalMin) {
    changes.push({
      path: 'thresholds.conditionalMin',
      from: oldConfig.thresholds.conditionalMin,
      to: newConfig.thresholds.conditionalMin,
      description: `Conditional minimum: ${oldConfig.thresholds.conditionalMin} → ${newConfig.thresholds.conditionalMin}`,
    });
  }

  // Check penalties
  if (oldConfig.penalties.personaMismatchMultiplier !== newConfig.penalties.personaMismatchMultiplier) {
    changes.push({
      path: 'penalties.personaMismatchMultiplier',
      from: oldConfig.penalties.personaMismatchMultiplier,
      to: newConfig.penalties.personaMismatchMultiplier,
      description: `Persona mismatch penalty: ${((1 - oldConfig.penalties.personaMismatchMultiplier) * 100).toFixed(0)}% → ${((1 - newConfig.penalties.personaMismatchMultiplier) * 100).toFixed(0)}%`,
    });
  }

  if (oldConfig.penalties.criticalRiskPenalty !== newConfig.penalties.criticalRiskPenalty) {
    changes.push({
      path: 'penalties.criticalRiskPenalty',
      from: oldConfig.penalties.criticalRiskPenalty,
      to: newConfig.penalties.criticalRiskPenalty,
      description: `Critical risk penalty: -${oldConfig.penalties.criticalRiskPenalty}pts → -${newConfig.penalties.criticalRiskPenalty}pts`,
    });
  }

  if (oldConfig.penalties.proofGapPenalty !== newConfig.penalties.proofGapPenalty) {
    changes.push({
      path: 'penalties.proofGapPenalty',
      from: oldConfig.penalties.proofGapPenalty,
      to: newConfig.penalties.proofGapPenalty,
      description: `Proof gap penalty: -${oldConfig.penalties.proofGapPenalty}pts/gap → -${newConfig.penalties.proofGapPenalty}pts/gap`,
    });
  }

  return changes;
}

/**
 * Apply changes to create a new config
 */
export function applyChanges(
  baseConfig: BidReadinessConfig,
  changes: ConfigChange[]
): BidReadinessConfig {
  const newConfig: BidReadinessConfig = JSON.parse(JSON.stringify(baseConfig));

  for (const change of changes) {
    const parts = change.path.split('.');
    if (parts.length === 2) {
      const [section, key] = parts;
      if (section === 'weights' && key in newConfig.weights) {
        (newConfig.weights as any)[key] = change.to;
      } else if (section === 'thresholds' && key in newConfig.thresholds) {
        (newConfig.thresholds as any)[key] = change.to;
      } else if (section === 'penalties' && key in newConfig.penalties) {
        (newConfig.penalties as any)[key] = change.to;
      } else if (section === 'riskThresholds' && key in newConfig.riskThresholds) {
        (newConfig.riskThresholds as any)[key] = change.to;
      }
    }
  }

  return newConfig;
}

/**
 * Generate a JSON patch representation of changes
 */
export function generateConfigPatch(changes: ConfigChange[]): Record<string, number> {
  const patch: Record<string, number> = {};
  for (const change of changes) {
    patch[change.path] = change.to;
  }
  return patch;
}
