// lib/os/analyticsAi/getAnalyticsFindings.ts
// Fetch analytics findings from the diagnostics system
//
// Retrieves findings with labSlug = 'analytics' from the
// DiagnosticDetails Airtable table.

import { getDiagnosticFindingsForCompany } from '@/lib/airtable/diagnosticDetails';
import type { AnalyticsLabFinding } from '@/lib/analytics/analyticsTypes';

/**
 * Get analytics findings for a company
 *
 * Retrieves findings from the DiagnosticDetails table that are
 * categorized under the 'analytics' lab.
 */
export async function getAnalyticsFindings(companyId: string): Promise<AnalyticsLabFinding[]> {
  console.log('[getAnalyticsFindings] Fetching findings for company:', companyId);

  try {
    const details = await getDiagnosticFindingsForCompany(companyId);

    if (!details || details.length === 0) {
      console.log('[getAnalyticsFindings] No diagnostic details found');
      return [];
    }

    // Filter for analytics-related findings
    const analyticsFindings = details.filter((detail) => {
      const labSlug = detail.labSlug;
      return labSlug === 'analytics' || labSlug === 'media' || labSlug === 'seo' || labSlug === 'gbp';
    });

    // Map to AnalyticsLabFinding format
    const findings: AnalyticsLabFinding[] = analyticsFindings.map((detail) => ({
      id: detail.id || detail.issueKey || crypto.randomUUID(),
      labSlug: normalizeLabSlug(detail.labSlug),
      severity: normalizeSeverity(detail.severity as string),
      title: detail.description || 'Untitled Finding',
      description: detail.description || '',
      recommendedAction: detail.recommendation || '',
      metric: undefined,
      currentValue: undefined,
      previousValue: undefined,
      changePercent: undefined,
      source: 'rule_based',
      createdAt: detail.createdAt,
    }));

    // Sort by severity (critical first)
    const severityOrder: Record<AnalyticsLabFinding['severity'], number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    console.log('[getAnalyticsFindings] Found findings:', {
      total: findings.length,
      bySeverity: {
        critical: findings.filter((f) => f.severity === 'critical').length,
        high: findings.filter((f) => f.severity === 'high').length,
        medium: findings.filter((f) => f.severity === 'medium').length,
        low: findings.filter((f) => f.severity === 'low').length,
      },
    });

    return findings;
  } catch (error) {
    console.error('[getAnalyticsFindings] Error:', error);
    return [];
  }
}

/**
 * Normalize lab slug to valid values
 */
function normalizeLabSlug(
  slug: string | undefined | null
): AnalyticsLabFinding['labSlug'] {
  if (!slug) return 'analytics';

  const normalized = slug.toLowerCase().trim();

  switch (normalized) {
    case 'media':
      return 'media';
    case 'seo':
      return 'seo';
    case 'gbp':
    case 'local':
      return 'gbp';
    default:
      return 'analytics';
  }
}

/**
 * Normalize severity to valid values
 */
function normalizeSeverity(
  severity: string | undefined | null
): AnalyticsLabFinding['severity'] {
  if (!severity) return 'medium';

  const normalized = severity.toLowerCase().trim();

  switch (normalized) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'high';
    case 'low':
      return 'low';
    default:
      return 'medium';
  }
}
