// lib/os/qbr/qbrFindings.ts
// QBR Findings Integration
//
// Helper functions to pull diagnostic findings into QBR reports and narratives.
// Provides:
// - Top findings for QBR "Key Issues" section
// - Category/dimension patterns for "Focus Areas"
// - Severity distribution for executive summary

import {
  getDiagnosticFindingsForCompany,
  type DiagnosticDetailFinding,
  type DiagnosticFindingCategory,
  type DiagnosticFindingSeverity,
} from '@/lib/airtable/diagnosticDetails';

// ============================================================================
// Types
// ============================================================================

export interface QbrFindingsSummary {
  /** Total findings count */
  total: number;
  /** Counts by severity */
  bySeverity: Record<DiagnosticFindingSeverity, number>;
  /** Counts by lab */
  byLab: Record<string, number>;
  /** Counts by category */
  byCategory: Record<string, number>;
  /** Critical/high findings that need immediate attention */
  urgentCount: number;
  /** Findings not yet converted to work items */
  unconvertedCount: number;
}

export interface QbrTopFinding {
  id: string;
  severity: DiagnosticFindingSeverity;
  category: DiagnosticFindingCategory | string;
  dimension: string;
  labSlug: string;
  description: string;
  recommendation: string | undefined;
  location: string | undefined;
  isConverted: boolean;
}

export interface QbrFocusArea {
  category: string;
  findingsCount: number;
  urgentCount: number;
  topIssues: string[];
  recommendation: string;
}

export interface QbrFindingsData {
  summary: QbrFindingsSummary;
  topFindings: QbrTopFinding[];
  focusAreas: QbrFocusArea[];
  narrativeBlocks: {
    keyIssues: string;
    whereToFocus: string;
    progressSummary: string;
  };
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Get top findings for QBR from a company
 *
 * Returns the most critical/high severity findings that should be
 * highlighted in a QBR report, prioritized by:
 * 1. Severity (critical > high > medium > low)
 * 2. Not yet converted to work items
 * 3. Recency (most recent first)
 *
 * @param companyId - Company ID
 * @param limit - Max findings to return (default 10)
 */
export async function getTopFindingsForQBR(
  companyId: string,
  limit: number = 10
): Promise<QbrTopFinding[]> {
  console.log('[qbrFindings] getTopFindingsForQBR:', { companyId, limit });

  const allFindings = await getDiagnosticFindingsForCompany(companyId);

  // Sort by severity, then by unconverted status, then by recency
  const severityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  const sorted = allFindings.sort((a, b) => {
    // First by severity
    const sevA = severityOrder[a.severity || 'medium'] ?? 2;
    const sevB = severityOrder[b.severity || 'medium'] ?? 2;
    if (sevA !== sevB) return sevA - sevB;

    // Then by unconverted (unconverted first)
    if (a.isConvertedToWorkItem !== b.isConvertedToWorkItem) {
      return a.isConvertedToWorkItem ? 1 : -1;
    }

    // Then by recency (most recent first)
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });

  return sorted.slice(0, limit).map((f) => ({
    id: f.id || '',
    severity: (f.severity as DiagnosticFindingSeverity) || 'medium',
    category: f.category || 'Other',
    dimension: f.dimension || 'General',
    labSlug: f.labSlug || 'unknown',
    description: f.description || '',
    recommendation: f.recommendation,
    location: f.location,
    isConverted: f.isConvertedToWorkItem || false,
  }));
}

/**
 * Get findings summary for QBR dashboard
 */
export async function getQbrFindingsSummary(companyId: string): Promise<QbrFindingsSummary> {
  console.log('[qbrFindings] getQbrFindingsSummary:', companyId);

  const findings = await getDiagnosticFindingsForCompany(companyId);

  const summary: QbrFindingsSummary = {
    total: findings.length,
    bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
    byLab: {},
    byCategory: {},
    urgentCount: 0,
    unconvertedCount: 0,
  };

  for (const f of findings) {
    // Count by severity
    const sev = (f.severity as DiagnosticFindingSeverity) || 'medium';
    summary.bySeverity[sev] = (summary.bySeverity[sev] || 0) + 1;

    // Count urgent
    if (sev === 'critical' || sev === 'high') {
      summary.urgentCount++;
    }

    // Count unconverted
    if (!f.isConvertedToWorkItem) {
      summary.unconvertedCount++;
    }

    // Count by lab
    const lab = f.labSlug || 'unknown';
    summary.byLab[lab] = (summary.byLab[lab] || 0) + 1;

    // Count by category
    const cat = f.category || 'Other';
    summary.byCategory[cat] = (summary.byCategory[cat] || 0) + 1;
  }

  return summary;
}

/**
 * Get focus areas derived from findings
 *
 * Groups findings by category and identifies key patterns
 */
export async function getQbrFocusAreas(companyId: string): Promise<QbrFocusArea[]> {
  console.log('[qbrFindings] getQbrFocusAreas:', companyId);

  const findings = await getDiagnosticFindingsForCompany(companyId);

  // Group by category
  const byCategory = new Map<string, DiagnosticDetailFinding[]>();
  for (const f of findings) {
    const cat = f.category || 'Other';
    if (!byCategory.has(cat)) {
      byCategory.set(cat, []);
    }
    byCategory.get(cat)!.push(f);
  }

  // Build focus areas
  const focusAreas: QbrFocusArea[] = [];

  for (const [category, catFindings] of byCategory.entries()) {
    const urgentCount = catFindings.filter(
      (f) => f.severity === 'critical' || f.severity === 'high'
    ).length;

    // Get top 3 issues by severity
    const topIssues = catFindings
      .sort((a, b) => {
        const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        return (sevOrder[a.severity || 'medium'] ?? 2) - (sevOrder[b.severity || 'medium'] ?? 2);
      })
      .slice(0, 3)
      .map((f) => f.description || 'No description')
      .filter(Boolean);

    // Generate recommendation based on findings
    const recommendation = generateCategoryRecommendation(category, catFindings);

    focusAreas.push({
      category,
      findingsCount: catFindings.length,
      urgentCount,
      topIssues,
      recommendation,
    });
  }

  // Sort by urgent count, then by total count
  return focusAreas.sort((a, b) => {
    if (b.urgentCount !== a.urgentCount) return b.urgentCount - a.urgentCount;
    return b.findingsCount - a.findingsCount;
  });
}

/**
 * Generate a recommendation for a category based on findings
 */
function generateCategoryRecommendation(
  category: string,
  findings: DiagnosticDetailFinding[]
): string {
  const urgentCount = findings.filter(
    (f) => f.severity === 'critical' || f.severity === 'high'
  ).length;

  const unconvertedCount = findings.filter((f) => !f.isConvertedToWorkItem).length;

  if (urgentCount > 3) {
    return `${category} has ${urgentCount} urgent issues requiring immediate attention. Prioritize addressing critical items first.`;
  }

  if (urgentCount > 0) {
    return `Address the ${urgentCount} high-priority ${category} issues in the next sprint cycle.`;
  }

  if (unconvertedCount > 0) {
    return `${unconvertedCount} ${category} findings are pending work item conversion. Review and prioritize.`;
  }

  return `${category} is in good shape. Continue monitoring and maintain current practices.`;
}

/**
 * Get complete QBR findings data including narrative blocks
 */
export async function getQbrFindingsData(companyId: string): Promise<QbrFindingsData> {
  console.log('[qbrFindings] getQbrFindingsData:', companyId);

  const [summary, topFindings, focusAreas] = await Promise.all([
    getQbrFindingsSummary(companyId),
    getTopFindingsForQBR(companyId, 10),
    getQbrFocusAreas(companyId),
  ]);

  // Generate narrative blocks
  const keyIssues = generateKeyIssuesNarrative(topFindings, summary);
  const whereToFocus = generateWhereToFocusNarrative(focusAreas);
  const progressSummary = generateProgressNarrative(summary);

  return {
    summary,
    topFindings,
    focusAreas,
    narrativeBlocks: {
      keyIssues,
      whereToFocus,
      progressSummary,
    },
  };
}

// ============================================================================
// Narrative Generation Helpers
// ============================================================================

function generateKeyIssuesNarrative(
  topFindings: QbrTopFinding[],
  summary: QbrFindingsSummary
): string {
  if (topFindings.length === 0) {
    return 'No diagnostic findings have been recorded. Run Labs to discover issues and opportunities.';
  }

  const criticalCount = summary.bySeverity.critical || 0;
  const highCount = summary.bySeverity.high || 0;

  let intro = '';
  if (criticalCount > 0) {
    intro = `We've identified ${criticalCount} critical issue${criticalCount > 1 ? 's' : ''} requiring immediate attention. `;
  } else if (highCount > 0) {
    intro = `There are ${highCount} high-priority item${highCount > 1 ? 's' : ''} to address. `;
  } else {
    intro = 'No critical issues were found, but there are opportunities for improvement. ';
  }

  // List top 3 issues
  const topIssueList = topFindings
    .slice(0, 3)
    .map((f) => `• **${f.category}**: ${f.description}`)
    .join('\n');

  return `${intro}\n\n**Top Issues:**\n${topIssueList}`;
}

function generateWhereToFocusNarrative(focusAreas: QbrFocusArea[]): string {
  if (focusAreas.length === 0) {
    return 'Run diagnostic Labs to identify focus areas.';
  }

  const topAreas = focusAreas.slice(0, 3);

  const areaList = topAreas
    .map((area) => {
      const urgentLabel = area.urgentCount > 0 ? ` (${area.urgentCount} urgent)` : '';
      return `• **${area.category}**${urgentLabel}: ${area.recommendation}`;
    })
    .join('\n');

  return `**Recommended Focus Areas:**\n${areaList}`;
}

function generateProgressNarrative(summary: QbrFindingsSummary): string {
  const convertedCount = summary.total - summary.unconvertedCount;
  const conversionRate = summary.total > 0 ? Math.round((convertedCount / summary.total) * 100) : 0;

  if (summary.total === 0) {
    return 'No findings to report. Run Labs to generate diagnostics.';
  }

  return `Of ${summary.total} total findings, ${convertedCount} (${conversionRate}%) have been converted to work items. ${summary.unconvertedCount} findings are pending review.`;
}

// ============================================================================
// Export for QBR Story View integration
// ============================================================================

export { generateKeyIssuesNarrative, generateWhereToFocusNarrative, generateProgressNarrative };
