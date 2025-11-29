// lib/os/companies/alerts.ts
// Company Alerts helper for Overview page
//
// Aggregates alerts from diagnostics and analytics to surface important issues.

import { listDiagnosticRunsForCompany, type DiagnosticRun } from '@/lib/os/diagnostics/runs';

// ============================================================================
// Types
// ============================================================================

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertSource = 'Analytics' | 'SEO' | 'Website' | 'GAP' | 'Brand' | 'Content' | 'Ops' | 'System';

export interface CompanyAlert {
  id: string;
  severity: AlertSeverity;
  source: AlertSource;
  title: string;
  description?: string;
  createdAt?: string;
  linkPath?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function isWithinDays(dateStr: string | undefined, days: number): boolean {
  if (!dateStr) return false;
  try {
    const date = new Date(dateStr);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return date >= cutoff;
  } catch {
    return false;
  }
}

function scoreToSeverity(score: number | null): AlertSeverity {
  if (score === null) return 'info';
  if (score < 40) return 'critical';
  if (score < 60) return 'warning';
  return 'info';
}

function toolIdToSource(toolId: string): AlertSource {
  const map: Record<string, AlertSource> = {
    gapSnapshot: 'GAP',
    gapPlan: 'GAP',
    gapHeavy: 'GAP',
    websiteLab: 'Website',
    brandLab: 'Brand',
    contentLab: 'Content',
    seoLab: 'SEO',
    demandLab: 'Analytics',
    opsLab: 'Ops',
  };
  return map[toolId] || 'System';
}

// ============================================================================
// Alert Generators
// ============================================================================

/**
 * Generate alerts from diagnostic runs
 */
function generateDiagnosticAlerts(runs: DiagnosticRun[], companyId: string): CompanyAlert[] {
  const alerts: CompanyAlert[] = [];

  // Check for failed runs in the last 7 days
  const recentFailedRuns = runs.filter(
    r => r.status === 'failed' && isWithinDays(r.createdAt, 7)
  );

  for (const run of recentFailedRuns.slice(0, 2)) {
    alerts.push({
      id: `failed-${run.id}`,
      severity: 'warning',
      source: toolIdToSource(run.toolId),
      title: `${toolIdToSource(run.toolId)} diagnostic failed`,
      description: run.summary || 'The diagnostic run encountered an error. Try running it again.',
      createdAt: run.createdAt,
      linkPath: `/c/${companyId}/tools`,
    });
  }

  // Check for low scores on recent runs
  const recentCompletedRuns = runs.filter(
    r => r.status === 'complete' && r.score !== null && isWithinDays(r.createdAt, 30)
  );

  for (const run of recentCompletedRuns) {
    if (run.score !== null && run.score < 40) {
      alerts.push({
        id: `lowscore-${run.id}`,
        severity: 'critical',
        source: toolIdToSource(run.toolId),
        title: `Critical issues in ${toolIdToSource(run.toolId)}`,
        description: `Score: ${run.score}/100. Immediate attention recommended.`,
        createdAt: run.createdAt,
        linkPath: `/c/${companyId}/diagnostics/${run.toolId}/${run.id}`,
      });
    } else if (run.score !== null && run.score < 50) {
      alerts.push({
        id: `medscore-${run.id}`,
        severity: 'warning',
        source: toolIdToSource(run.toolId),
        title: `${toolIdToSource(run.toolId)} needs improvement`,
        description: `Score: ${run.score}/100. Consider prioritizing these issues.`,
        createdAt: run.createdAt,
        linkPath: `/c/${companyId}/diagnostics/${run.toolId}/${run.id}`,
      });
    }
  }

  // Check for stale diagnostics (no runs in 60+ days)
  const hasRecentRun = runs.some(r => isWithinDays(r.createdAt, 60));
  if (!hasRecentRun && runs.length > 0) {
    alerts.push({
      id: 'stale-diagnostics',
      severity: 'info',
      source: 'System',
      title: 'Diagnostics may be outdated',
      description: 'No diagnostic runs in the last 60 days. Consider running a fresh assessment.',
      linkPath: `/c/${companyId}/tools`,
    });
  }

  return alerts;
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Get alerts for a company
 *
 * Aggregates alerts from:
 * - Diagnostic runs (failed runs, low scores, stale data)
 * - Analytics (future: traffic drops, conversion issues)
 *
 * Returns top 5 alerts sorted by severity (critical > warning > info) and recency.
 */
export async function getCompanyAlerts(companyId: string): Promise<CompanyAlert[]> {
  console.log('[Alerts] Getting alerts for company:', companyId);

  try {
    const allAlerts: CompanyAlert[] = [];

    // Get diagnostic runs
    const runs = await listDiagnosticRunsForCompany(companyId, { limit: 50 });

    // Generate diagnostic alerts
    const diagnosticAlerts = generateDiagnosticAlerts(runs, companyId);
    allAlerts.push(...diagnosticAlerts);

    // TODO: Add analytics alerts when analytics data is available
    // const analyticsAlerts = await generateAnalyticsAlerts(companyId);
    // allAlerts.push(...analyticsAlerts);

    // Sort by severity (critical > warning > info) then by date (newest first)
    const severityOrder: Record<AlertSeverity, number> = {
      critical: 1,
      warning: 2,
      info: 3,
    };

    allAlerts.sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;

      // Sort by date, newest first
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate;
    });

    // Return top 5 alerts
    const result = allAlerts.slice(0, 5);

    console.log('[Alerts] Alerts found:', {
      total: allAlerts.length,
      returned: result.length,
      bySeverity: {
        critical: result.filter(a => a.severity === 'critical').length,
        warning: result.filter(a => a.severity === 'warning').length,
        info: result.filter(a => a.severity === 'info').length,
      },
    });

    return result;
  } catch (error) {
    console.error('[Alerts] Error getting alerts:', error);
    return [];
  }
}
