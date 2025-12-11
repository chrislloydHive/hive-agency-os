// lib/os/context/graphIntegrity.ts
// Context Graph Accuracy and Freshness Engine

import type {
  ContextSource,
  FreshnessStatus,
  FieldProvenance,
  FieldConflict,
  FreshnessScore,
  MissingField,
  ContextHealth,
  IntegrityCheckResult,
  AutoResolutionRule,
} from './types';
import {
  DEFAULT_AUTO_RULES,
  FRESHNESS_THRESHOLDS,
  REQUIRED_FIELDS,
} from './types';

/**
 * Get a nested value from an object using a dot-notation path
 */
function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Set a nested value in an object using a dot-notation path
 */
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}

/**
 * Get all field paths from an object (flattened)
 */
function getAllFieldPaths(obj: unknown, prefix: string = ''): string[] {
  const paths: string[] = [];

  if (typeof obj !== 'object' || obj === null) {
    return paths;
  }

  for (const [key, value] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      paths.push(...getAllFieldPaths(value, fullPath));
    } else {
      paths.push(fullPath);
    }
  }

  return paths;
}

/**
 * Calculate days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor(Math.abs(date2.getTime() - date1.getTime()) / msPerDay);
}

/**
 * Match a field path against a pattern (supports * wildcard)
 */
function matchesPattern(fieldPath: string, pattern: string): boolean {
  if (pattern === '*') return true;

  const patternParts = pattern.split('.');
  const pathParts = fieldPath.split('.');

  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i] === '*') {
      // Wildcard matches any single segment
      if (i >= pathParts.length) return false;
      continue;
    }
    if (patternParts[i] !== pathParts[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Get freshness threshold for a field
 */
function getFreshnessThreshold(fieldPath: string): { fresh: number; stale: number; expired: number } {
  // Check for exact match first
  if (FRESHNESS_THRESHOLDS[fieldPath]) {
    return FRESHNESS_THRESHOLDS[fieldPath];
  }

  // Check for pattern matches
  for (const [pattern, thresholds] of Object.entries(FRESHNESS_THRESHOLDS)) {
    if (pattern !== '*' && matchesPattern(fieldPath, pattern)) {
      return thresholds;
    }
  }

  // Default thresholds
  return FRESHNESS_THRESHOLDS['*'];
}

/**
 * Calculate freshness score for a field
 */
export function calculateFreshnessScore(
  fieldPath: string,
  setAt: string,
  verifiedAt?: string
): FreshnessScore {
  const referenceDate = verifiedAt || setAt;
  const ageInDays = daysBetween(new Date(referenceDate), new Date());
  const thresholds = getFreshnessThreshold(fieldPath);

  let status: FreshnessStatus;
  let score: number;

  if (ageInDays <= thresholds.fresh) {
    status = 'fresh';
    score = 100 - (ageInDays / thresholds.fresh) * 20; // 80-100
  } else if (ageInDays <= thresholds.stale) {
    status = 'stale';
    const staleRange = thresholds.stale - thresholds.fresh;
    const staleAge = ageInDays - thresholds.fresh;
    score = 80 - (staleAge / staleRange) * 40; // 40-80
  } else if (ageInDays <= thresholds.expired) {
    status = 'expired';
    const expiredRange = thresholds.expired - thresholds.stale;
    const expiredAge = ageInDays - thresholds.stale;
    score = 40 - (expiredAge / expiredRange) * 30; // 10-40
  } else {
    status = 'expired';
    score = Math.max(0, 10 - (ageInDays - thresholds.expired) / 30);
  }

  // Determine refresh method
  let refreshMethod: 'scrape' | 'api' | 'manual' | undefined;
  if (fieldPath.startsWith('website.')) {
    refreshMethod = 'scrape';
  } else if (fieldPath.startsWith('socials.') || fieldPath.startsWith('gbp.')) {
    refreshMethod = 'api';
  } else if (status !== 'fresh') {
    refreshMethod = 'manual';
  }

  // Calculate recommended refresh date
  const refreshBy = status !== 'fresh'
    ? new Date().toISOString()
    : new Date(Date.now() + (thresholds.fresh - ageInDays) * 24 * 60 * 60 * 1000).toISOString();

  return {
    fieldPath,
    ageInDays,
    status,
    score: Math.round(score),
    refreshBy,
    refreshMethod,
  };
}

/**
 * Detect conflicts between two values for the same field
 */
export function detectConflict(
  fieldPath: string,
  currentProvenance: FieldProvenance,
  newValue: unknown,
  newSource: ContextSource
): FieldConflict | null {
  // Skip if values are equal
  if (JSON.stringify(currentProvenance.value) === JSON.stringify(newValue)) {
    return null;
  }

  // Skip if locked
  if (currentProvenance.locked) {
    return null;
  }

  // Determine recommended resolution
  let recommendedResolution: FieldConflict['recommendedResolution'];

  // User always wins
  if (currentProvenance.source === 'user' || newSource === 'user') {
    recommendedResolution = 'user-wins';
  }
  // Newer wins for AI-inferred
  else if (currentProvenance.source === 'ai-inferred' || newSource === 'ai-inferred') {
    recommendedResolution = 'newer-wins';
  }
  // API typically more authoritative than scrape
  else if (newSource === 'api' && currentProvenance.source === 'scrape') {
    recommendedResolution = 'source-wins';
  }
  // Default to manual
  else {
    recommendedResolution = 'manual';
  }

  return {
    fieldPath,
    currentValue: currentProvenance.value,
    currentSource: currentProvenance.source,
    conflictingValue: newValue,
    conflictingSource: newSource,
    detectedAt: new Date().toISOString(),
    recommendedResolution,
    resolved: false,
  };
}

/**
 * Resolve a conflict using auto-resolution rules
 */
export function autoResolveConflict(
  conflict: FieldConflict,
  rules: AutoResolutionRule[] = DEFAULT_AUTO_RULES
): FieldConflict {
  // Find applicable rule
  const applicableRule = rules.find(rule =>
    rule.enabled && matchesPattern(conflict.fieldPath, rule.fieldPattern)
  );

  if (!applicableRule) {
    return conflict;
  }

  // Determine winner based on source priority
  const currentPriority = applicableRule.sourcePriority.indexOf(conflict.currentSource);
  const conflictingPriority = applicableRule.sourcePriority.indexOf(conflict.conflictingSource);

  // If neither source is in the priority list, don't auto-resolve
  if (currentPriority === -1 && conflictingPriority === -1) {
    return conflict;
  }

  // Lower index = higher priority
  const winningSource = (conflictingPriority !== -1 &&
    (currentPriority === -1 || conflictingPriority < currentPriority))
    ? conflict.conflictingSource
    : conflict.currentSource;

  const winningValue = winningSource === conflict.conflictingSource
    ? conflict.conflictingValue
    : conflict.currentValue;

  return {
    ...conflict,
    resolved: true,
    resolution: {
      chosenValue: winningValue,
      chosenSource: winningSource,
      resolvedAt: new Date().toISOString(),
      resolvedBy: 'auto',
    },
  };
}

/**
 * Check for missing required fields
 */
export function checkMissingFields(contextData: unknown): MissingField[] {
  const missing: MissingField[] = [];

  for (const required of REQUIRED_FIELDS) {
    const value = getNestedValue(contextData, required.path);

    // Check if field is missing or empty
    const isMissing = value === undefined ||
                      value === null ||
                      value === '' ||
                      (Array.isArray(value) && value.length === 0);

    if (isMissing) {
      // Determine suggested sources
      const suggestedSources: ContextSource[] = [];
      if (required.path.startsWith('socials.')) {
        suggestedSources.push('api', 'scrape');
      } else if (required.path.startsWith('gbp.')) {
        suggestedSources.push('api');
      } else if (required.path.startsWith('website.')) {
        suggestedSources.push('scrape');
      } else {
        suggestedSources.push('user');
      }

      missing.push({
        fieldPath: required.path,
        displayName: required.displayName,
        importance: required.importance,
        reason: required.reason,
        suggestedSources,
      });
    }
  }

  return missing;
}

/**
 * Calculate overall context health
 */
export function calculateContextHealth(
  provenance: Map<string, FieldProvenance>,
  conflicts: FieldConflict[],
  freshness: FreshnessScore[],
  missingFields: MissingField[]
): ContextHealth {
  // Completeness: ratio of filled to total required fields
  const totalRequired = REQUIRED_FIELDS.length;
  const filledRequired = totalRequired - missingFields.length;
  const completenessScore = totalRequired > 0
    ? Math.round((filledRequired / totalRequired) * 100)
    : 100;

  // Freshness: average freshness score
  const freshnessSum = freshness.reduce((sum, f) => sum + f.score, 0);
  const freshnessScore = freshness.length > 0
    ? Math.round(freshnessSum / freshness.length)
    : 100;

  // Consistency: penalize unresolved conflicts
  const unresolvedConflicts = conflicts.filter(c => !c.resolved);
  const consistencyScore = Math.max(0, 100 - unresolvedConflicts.length * 20);

  // Confidence: average confidence across provenance
  const confidenceSum = Array.from(provenance.values())
    .reduce((sum, p) => sum + p.confidence, 0);
  const confidenceScore = provenance.size > 0
    ? Math.round(confidenceSum / provenance.size)
    : 100;

  // Overall: weighted average
  const overallScore = Math.round(
    completenessScore * 0.3 +
    freshnessScore * 0.25 +
    consistencyScore * 0.25 +
    confidenceScore * 0.2
  );

  // Count stale fields
  const staleFieldCount = freshness.filter(f =>
    f.status === 'stale' || f.status === 'expired'
  ).length;

  // Count missing critical fields
  const missingCriticalCount = missingFields.filter(f =>
    f.importance === 'critical'
  ).length;

  return {
    overallScore,
    completenessScore,
    freshnessScore,
    consistencyScore,
    confidenceScore,
    conflictCount: unresolvedConflicts.length,
    staleFieldCount,
    missingCriticalCount,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Generate recommendations based on health check
 */
function generateRecommendations(
  health: ContextHealth,
  missingFields: MissingField[],
  conflicts: FieldConflict[],
  freshness: FreshnessScore[]
): string[] {
  const recommendations: string[] = [];

  // Critical missing fields
  const criticalMissing = missingFields.filter(f => f.importance === 'critical');
  if (criticalMissing.length > 0) {
    recommendations.push(
      `Add ${criticalMissing.length} critical missing field(s): ${criticalMissing.map(f => f.displayName).join(', ')}`
    );
  }

  // Unresolved conflicts
  const unresolvedConflicts = conflicts.filter(c => !c.resolved);
  if (unresolvedConflicts.length > 0) {
    recommendations.push(
      `Resolve ${unresolvedConflicts.length} data conflict(s) to ensure consistency`
    );
  }

  // Expired fields
  const expiredFields = freshness.filter(f => f.status === 'expired');
  if (expiredFields.length > 0) {
    recommendations.push(
      `Refresh ${expiredFields.length} expired field(s) to maintain accuracy`
    );
  }

  // Stale fields
  const staleFields = freshness.filter(f => f.status === 'stale');
  if (staleFields.length > 0) {
    recommendations.push(
      `Consider refreshing ${staleFields.length} stale field(s) soon`
    );
  }

  // High importance missing
  const highMissing = missingFields.filter(f => f.importance === 'high');
  if (highMissing.length > 0) {
    recommendations.push(
      `Add ${highMissing.length} high-importance field(s): ${highMissing.map(f => f.displayName).join(', ')}`
    );
  }

  // Overall health suggestions
  if (health.completenessScore < 50) {
    recommendations.push('Focus on filling in basic business information first');
  }
  if (health.freshnessScore < 50) {
    recommendations.push('Many fields are outdated - consider a comprehensive data refresh');
  }
  if (health.confidenceScore < 50) {
    recommendations.push('Many fields have low confidence - consider verifying with authoritative sources');
  }

  return recommendations;
}

/**
 * Main integrity check function
 *
 * Input: context data object + provenance map
 * Output: full integrity check result with health, conflicts, freshness, recommendations
 */
export function checkContextIntegrity(
  contextData: unknown,
  provenanceData: Record<string, Omit<FieldProvenance, 'fieldPath'>>
): IntegrityCheckResult {
  // Build provenance map
  const provenance = new Map<string, FieldProvenance>();
  for (const [fieldPath, data] of Object.entries(provenanceData)) {
    provenance.set(fieldPath, { ...data, fieldPath });
  }

  // Calculate freshness for all fields with provenance
  const freshness: FreshnessScore[] = [];
  for (const [fieldPath, prov] of provenance) {
    const score = calculateFreshnessScore(fieldPath, prov.setAt, prov.verifiedAt);
    freshness.push(score);
  }

  // Check for missing fields
  const missingFields = checkMissingFields(contextData);

  // Active conflicts are stored externally - we return empty here
  // In real usage, conflicts would be passed in or stored in a separate system
  const conflicts: FieldConflict[] = [];

  // Calculate health
  const health = calculateContextHealth(provenance, conflicts, freshness, missingFields);

  // Generate recommendations
  const recommendations = generateRecommendations(health, missingFields, conflicts, freshness);

  return {
    health,
    provenance,
    conflicts,
    freshness,
    missingFields,
    recommendations,
  };
}

/**
 * Update provenance when a field value changes
 */
export function updateProvenance(
  existingProvenance: FieldProvenance | undefined,
  fieldPath: string,
  newValue: unknown,
  source: ContextSource,
  confidence: number = 80
): FieldProvenance {
  const now = new Date().toISOString();

  if (!existingProvenance) {
    return {
      fieldPath,
      value: newValue,
      source,
      setAt: now,
      confidence,
      locked: false,
      history: [],
    };
  }

  // Add current value to history
  const history = [
    ...(existingProvenance.history || []),
    {
      value: existingProvenance.value,
      source: existingProvenance.source,
      setAt: existingProvenance.setAt,
      replacedAt: now,
    },
  ].slice(-10); // Keep last 10 entries

  return {
    fieldPath,
    value: newValue,
    source,
    setAt: now,
    confidence,
    locked: existingProvenance.locked,
    lockReason: existingProvenance.lockReason,
    history,
  };
}

/**
 * Lock a field to prevent auto-updates
 */
export function lockField(
  provenance: FieldProvenance,
  reason: string
): FieldProvenance {
  return {
    ...provenance,
    locked: true,
    lockReason: reason,
  };
}

/**
 * Unlock a field to allow auto-updates
 */
export function unlockField(provenance: FieldProvenance): FieldProvenance {
  return {
    ...provenance,
    locked: false,
    lockReason: undefined,
  };
}

/**
 * Verify a field value (refresh verifiedAt timestamp)
 */
export function verifyField(provenance: FieldProvenance): FieldProvenance {
  return {
    ...provenance,
    verifiedAt: new Date().toISOString(),
  };
}

/**
 * Get fields that need attention (missing, stale, or conflicted)
 */
export function getFieldsNeedingAttention(result: IntegrityCheckResult): {
  critical: string[];
  high: string[];
  medium: string[];
  low: string[];
} {
  const critical: string[] = [];
  const high: string[] = [];
  const medium: string[] = [];
  const low: string[] = [];

  // Missing critical fields
  for (const field of result.missingFields) {
    switch (field.importance) {
      case 'critical':
        critical.push(field.fieldPath);
        break;
      case 'high':
        high.push(field.fieldPath);
        break;
      case 'medium':
        medium.push(field.fieldPath);
        break;
      case 'low':
        low.push(field.fieldPath);
        break;
    }
  }

  // Expired fields are high priority
  for (const field of result.freshness) {
    if (field.status === 'expired') {
      if (!high.includes(field.fieldPath)) {
        high.push(field.fieldPath);
      }
    } else if (field.status === 'stale') {
      if (!medium.includes(field.fieldPath)) {
        medium.push(field.fieldPath);
      }
    }
  }

  // Unresolved conflicts are high priority
  for (const conflict of result.conflicts) {
    if (!conflict.resolved && !high.includes(conflict.fieldPath)) {
      high.push(conflict.fieldPath);
    }
  }

  return { critical, high, medium, low };
}
