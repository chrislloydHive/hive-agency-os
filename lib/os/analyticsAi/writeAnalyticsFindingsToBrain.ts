// lib/os/analyticsAi/writeAnalyticsFindingsToBrain.ts
// Write analytics findings to the Brain/diagnostics system
//
// Persists AI-generated findings to DiagnosticDetails for
// retrieval by the Analytics Lab and other UI components.

import { getBase } from '@/lib/airtable';
import type { AnalyticsLabFinding } from '@/lib/analytics/analyticsTypes';

// ============================================================================
// Airtable Setup
// ============================================================================

const DIAGNOSTIC_DETAILS_TABLE = 'DiagnosticDetails';

// ============================================================================
// Main Function
// ============================================================================

/**
 * Write analytics findings to the Brain/diagnostics system
 *
 * Inserts or updates findings in the DiagnosticDetails Airtable table.
 * Findings are tagged with labSlug for filtering.
 */
export async function writeAnalyticsFindingsToBrain(
  companyId: string,
  findings: AnalyticsLabFinding[]
): Promise<{ written: number; errors: number }> {
  console.log('[writeAnalyticsFindingsToBrain] Writing findings:', {
    companyId,
    count: findings.length,
  });

  if (findings.length === 0) {
    console.log('[writeAnalyticsFindingsToBrain] No findings to write');
    return { written: 0, errors: 0 };
  }

  let written = 0;
  let errors = 0;

  try {
    // First, delete existing analytics findings for this company
    // to avoid duplicates on refresh
    await deleteExistingAnalyticsFindings(companyId);

    // Prepare records for batch creation
    const records = findings.map((finding) => ({
      fields: {
        CompanyID: companyId,
        Title: finding.title,
        Description: finding.description,
        RecommendedAction: finding.recommendedAction,
        Severity: mapSeverityToAirtable(finding.severity),
        LabSlug: finding.labSlug,
        Source: finding.source,
        Metric: finding.metric || '',
        CurrentValue: finding.currentValue?.toString() || '',
        PreviousValue: finding.previousValue?.toString() || '',
        ChangePercent: finding.changePercent,
        CreatedAt: new Date().toISOString(),
      },
    }));

    // Batch create in chunks of 10 (Airtable limit)
    const base = getBase();
    const chunkSize = 10;
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);

      try {
        await base(DIAGNOSTIC_DETAILS_TABLE).create(chunk);
        written += chunk.length;
      } catch (error) {
        console.error('[writeAnalyticsFindingsToBrain] Batch create error:', error);
        errors += chunk.length;
      }
    }

    console.log('[writeAnalyticsFindingsToBrain] Complete:', { written, errors });
    return { written, errors };
  } catch (error) {
    console.error('[writeAnalyticsFindingsToBrain] Error:', error);
    return { written, errors: findings.length };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Delete existing analytics findings for a company
 * Called before writing new findings to avoid duplicates
 */
async function deleteExistingAnalyticsFindings(companyId: string): Promise<void> {
  try {
    const base = getBase();
    const records = await base(DIAGNOSTIC_DETAILS_TABLE)
      .select({
        filterByFormula: `AND({CompanyID} = '${companyId}', OR({LabSlug} = 'analytics', {Source} = 'analytics_ai'))`,
        maxRecords: 100,
      })
      .firstPage();

    if (records.length === 0) {
      return;
    }

    const recordIds = records.map((r) => r.id);

    // Delete in batches of 10
    const chunkSize = 10;
    for (let i = 0; i < recordIds.length; i += chunkSize) {
      const chunk = recordIds.slice(i, i + chunkSize);
      await base(DIAGNOSTIC_DETAILS_TABLE).destroy(chunk);
    }

    console.log('[writeAnalyticsFindingsToBrain] Deleted existing findings:', recordIds.length);
  } catch (error) {
    console.error('[writeAnalyticsFindingsToBrain] Error deleting existing findings:', error);
    // Continue anyway - new findings will still be created
  }
}

/**
 * Map severity to Airtable format
 */
function mapSeverityToAirtable(severity: AnalyticsLabFinding['severity']): string {
  const mapping: Record<AnalyticsLabFinding['severity'], string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };
  return mapping[severity] || 'Medium';
}

/**
 * Map lab slug to friendly name
 */
export function getLabSlugDisplayName(labSlug: AnalyticsLabFinding['labSlug']): string {
  const names: Record<AnalyticsLabFinding['labSlug'], string> = {
    analytics: 'Analytics',
    media: 'Media',
    seo: 'SEO',
    gbp: 'Local / GBP',
  };
  return names[labSlug] || labSlug;
}
