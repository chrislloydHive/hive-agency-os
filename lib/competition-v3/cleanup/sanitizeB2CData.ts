// lib/competition-v3/cleanup/sanitizeB2CData.ts
// B2C Data Cleanup Utility
//
// Cleans existing competitor data to remove B2B-only competitor types
// from B2C company graphs. Should be run as a migration or on-demand cleanup.

import type { CompetitorProfileV3, QueryContext, CompetitorType } from '../types';
import {
  isB2CCompany,
  B2C_DISALLOWED_COMPETITOR_TYPES,
  cleanB2CCompetitorData,
  validateNoContextBleed,
} from '../b2cRetailClassifier';

// ============================================================================
// Types
// ============================================================================

export interface CleanupResult {
  companyId: string;
  companyName: string;
  isB2C: boolean;
  beforeCount: number;
  afterCount: number;
  removedCount: number;
  removedCompetitors: Array<{
    name: string;
    type: CompetitorType;
    reason: string;
  }>;
  warnings: string[];
}

export interface BatchCleanupResult {
  companiesProcessed: number;
  b2cCompaniesFound: number;
  totalCompetitorsRemoved: number;
  results: CleanupResult[];
}

// ============================================================================
// Single Company Cleanup
// ============================================================================

/**
 * Clean competitor data for a single company
 * Removes B2B-only competitor types if the company is B2C
 */
export function sanitizeCompanyCompetitors<T extends { classification?: { type: CompetitorType }; name?: string }>(
  competitors: T[],
  context: QueryContext
): CleanupResult {
  const isB2C = isB2CCompany(context);
  const result: CleanupResult = {
    companyId: context.domain || 'unknown',
    companyName: context.businessName,
    isB2C,
    beforeCount: competitors.length,
    afterCount: competitors.length,
    removedCount: 0,
    removedCompetitors: [],
    warnings: [],
  };

  if (!isB2C) {
    // B2B company - no cleanup needed
    return result;
  }

  const removedCompetitors: CleanupResult['removedCompetitors'] = [];

  // Identify competitors to remove
  for (const c of competitors) {
    const type = c.classification?.type;
    if (!type) continue;

    if (B2C_DISALLOWED_COMPETITOR_TYPES.includes(type)) {
      removedCompetitors.push({
        name: c.name || 'Unknown',
        type,
        reason: `${type} competitor type is not valid for B2C retail`,
      });
    }
  }

  // Use the cleanup function
  const { cleaned, removed } = cleanB2CCompetitorData(competitors, context);

  result.afterCount = cleaned.length;
  result.removedCount = removed.length;
  result.removedCompetitors = removedCompetitors;

  // Validate no context bleed in cleaned data
  const validation = validateNoContextBleed(
    context,
    cleaned.filter(c => c.classification && c.name).map(c => ({
      classification: c.classification!,
      name: c.name || 'Unknown',
    }))
  );

  if (!validation.isValid) {
    result.warnings = validation.issues;
  }

  return result;
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Check if a company's competitor data needs cleanup
 */
export function needsB2CCleanup<T extends { classification?: { type: CompetitorType } }>(
  competitors: T[],
  context: QueryContext
): boolean {
  if (!isB2CCompany(context)) return false;

  return competitors.some(c => {
    const type = c.classification?.type;
    return type && B2C_DISALLOWED_COMPETITOR_TYPES.includes(type);
  });
}

/**
 * Get list of competitor types that need removal for B2C
 */
export function getTypesToRemove<T extends { classification?: { type: CompetitorType }; name?: string }>(
  competitors: T[],
  context: QueryContext
): Array<{ name: string; type: CompetitorType }> {
  if (!isB2CCompany(context)) return [];

  return competitors
    .filter(c => {
      const type = c.classification?.type;
      return type && B2C_DISALLOWED_COMPETITOR_TYPES.includes(type);
    })
    .map(c => ({
      name: c.name || 'Unknown',
      type: c.classification!.type,
    }));
}

// ============================================================================
// Logging
// ============================================================================

/**
 * Generate a cleanup report
 */
export function generateCleanupReport(result: CleanupResult): string {
  const lines: string[] = [
    `=== B2C Data Cleanup Report ===`,
    `Company: ${result.companyName}`,
    `Is B2C: ${result.isB2C}`,
    `Competitors Before: ${result.beforeCount}`,
    `Competitors After: ${result.afterCount}`,
    `Removed: ${result.removedCount}`,
  ];

  if (result.removedCompetitors.length > 0) {
    lines.push(`\nRemoved Competitors:`);
    for (const removed of result.removedCompetitors) {
      lines.push(`  - ${removed.name} (${removed.type}): ${removed.reason}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push(`\nWarnings:`);
    for (const warning of result.warnings) {
      lines.push(`  ! ${warning}`);
    }
  }

  return lines.join('\n');
}

/**
 * Generate a batch cleanup summary
 */
export function generateBatchReport(result: BatchCleanupResult): string {
  const lines: string[] = [
    `=== B2C Batch Cleanup Summary ===`,
    `Companies Processed: ${result.companiesProcessed}`,
    `B2C Companies Found: ${result.b2cCompaniesFound}`,
    `Total Competitors Removed: ${result.totalCompetitorsRemoved}`,
  ];

  if (result.results.filter(r => r.removedCount > 0).length > 0) {
    lines.push(`\nCompanies with Removals:`);
    for (const r of result.results.filter(r => r.removedCount > 0)) {
      lines.push(`  - ${r.companyName}: removed ${r.removedCount} competitor(s)`);
    }
  }

  return lines.join('\n');
}

// ============================================================================
// Export index
// ============================================================================

export { isB2CCompany, B2C_DISALLOWED_COMPETITOR_TYPES };
