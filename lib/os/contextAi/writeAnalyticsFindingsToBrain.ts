// lib/os/contextAi/writeAnalyticsFindingsToBrain.ts
// Service for writing AI-generated analytics findings to Brain/diagnostics
//
// This service takes AnalyticsFinding objects from generateAnalyticsFindings
// and writes them to the Diagnostic Details table in Airtable.

import type { AnalyticsFinding } from './generateAnalyticsFindings';
import {
  saveDiagnosticFindings,
  deleteUnconvertedFindingsForCompanyLab,
  type CreateDiagnosticFindingInput,
  type DiagnosticFindingCategory,
} from '@/lib/airtable/diagnosticDetails';

// ============================================================================
// Types
// ============================================================================

export interface WriteAnalyticsFindingsInput {
  companyId: string;
  findings: AnalyticsFinding[];
  /** Optional: synthetic run ID to link findings to. If not provided, uses a sentinel value. */
  runId?: string;
  /** Whether to delete existing unconverted analytics findings first (default: true) */
  replaceExisting?: boolean;
}

export interface WriteAnalyticsFindingsResult {
  success: boolean;
  createdCount: number;
  deletedCount: number;
  createdIds: string[];
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Sentinel run ID for analytics-derived findings
 * These findings don't come from a traditional diagnostic run,
 * so we use a synthetic ID pattern.
 */
const ANALYTICS_AI_RUN_PREFIX = 'analytics-ai-';

/**
 * Map lab slugs to diagnostic categories
 */
const LAB_TO_CATEGORY: Record<string, DiagnosticFindingCategory> = {
  analytics: 'Analytics',
  media: 'Media',
  seo: 'SEO',
};

// ============================================================================
// Main Function
// ============================================================================

/**
 * Write analytics-derived findings to Brain/diagnostics
 *
 * This function:
 * 1. Optionally deletes existing unconverted analytics findings (to avoid duplicates)
 * 2. Converts AnalyticsFinding objects to CreateDiagnosticFindingInput
 * 3. Saves them to the Diagnostic Details table
 *
 * @param input - Company ID, findings, and options
 * @returns Result with success status and counts
 */
export async function writeAnalyticsFindingsToBrain(
  input: WriteAnalyticsFindingsInput
): Promise<WriteAnalyticsFindingsResult> {
  const { companyId, findings, runId, replaceExisting = true } = input;

  console.log('[contextAi/writer] Writing analytics findings to Brain:', {
    companyId,
    findingsCount: findings.length,
    replaceExisting,
  });

  if (findings.length === 0) {
    return {
      success: true,
      createdCount: 0,
      deletedCount: 0,
      createdIds: [],
    };
  }

  try {
    let deletedCount = 0;

    // Optionally delete existing unconverted analytics findings
    if (replaceExisting) {
      // Delete findings for each lab slug we're about to write
      const labSlugs = [...new Set(findings.map((f) => f.labSlug))];
      for (const labSlug of labSlugs) {
        const deleted = await deleteUnconvertedFindingsForCompanyLab(companyId, labSlug);
        deletedCount += deleted;
      }
      console.log('[contextAi/writer] Deleted existing findings:', { deletedCount });
    }

    // Generate synthetic run ID if not provided
    const effectiveRunId = runId || `${ANALYTICS_AI_RUN_PREFIX}${companyId}-${Date.now()}`;

    // Convert to CreateDiagnosticFindingInput format
    const findingInputs: CreateDiagnosticFindingInput[] = findings.map((f) => ({
      labRunId: effectiveRunId,
      companyId,
      labSlug: f.labSlug,
      category: LAB_TO_CATEGORY[f.labSlug] || 'Analytics',
      dimension: 'Performance Trend',
      severity: f.severity,
      description: f.title,
      recommendation: f.recommendedAction,
      location: f.description, // Use description as location for context
      issueKey: generateIssueKey(companyId, f),
      estimatedImpact: getImpactEstimate(f.severity),
      isConvertedToWorkItem: false,
    }));

    // Save to Airtable
    const createdIds = await saveDiagnosticFindings(findingInputs);

    console.log('[contextAi/writer] Findings saved successfully:', {
      companyId,
      createdCount: createdIds.length,
      deletedCount,
    });

    return {
      success: true,
      createdCount: createdIds.length,
      deletedCount,
      createdIds,
    };
  } catch (error) {
    console.error('[contextAi/writer] Error writing findings:', error);
    return {
      success: false,
      createdCount: 0,
      deletedCount: 0,
      createdIds: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique issue key for deduplication
 */
function generateIssueKey(companyId: string, finding: AnalyticsFinding): string {
  // Create a key based on lab, severity, and a hash of the title
  const titleHash = simpleHash(finding.title);
  return `${finding.labSlug}-${finding.severity}-${titleHash}`;
}

/**
 * Simple hash function for generating short unique identifiers
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36).substring(0, 8);
}

/**
 * Get estimated impact text based on severity
 */
function getImpactEstimate(severity: string): string {
  switch (severity) {
    case 'high':
      return 'High - Significant impact on performance or revenue';
    case 'medium':
      return 'Medium - Moderate impact, should be addressed soon';
    case 'low':
      return 'Low - Minor impact, optimization opportunity';
    default:
      return 'Unknown';
  }
}

// ============================================================================
// Export Index Entry
// ============================================================================

export { generateIssueKey, simpleHash, getImpactEstimate };
