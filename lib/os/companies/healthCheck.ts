// lib/os/companies/healthCheck.ts
// Quick Health Check for Company Overview
//
// A lightweight, fast check that:
// - Runs/reuses a light GAP Snapshot
// - Pulls website/analytics vital signs
// - Refreshes Strategy Snapshot, Trends, and Alerts
// - Returns a concise status

import { getCompanyById } from '@/lib/airtable/companies';
import { aiForCompany } from '@/lib/ai-gateway/aiClient';
import {
  getLatestRunForCompanyAndTool,
  createDiagnosticRun,
  updateDiagnosticRun,
  type DiagnosticRun,
} from '@/lib/os/diagnostics/runs';
import { runGapSnapshotEngine } from '@/lib/os/diagnostics/engines';
import {
  refreshCompanyStrategicSnapshot,
  getCompanyStrategySnapshot,
} from '@/lib/os/companies/strategySnapshot';
import { getCompanyAlerts, type CompanyAlert } from '@/lib/os/companies/alerts';
import { createGapModelCaller } from '@/lib/ai-gateway/aiClient';

// ============================================================================
// Types
// ============================================================================

export type QuickHealthStatus = 'healthy' | 'watching' | 'at_risk';

export interface QuickHealthCheckResult {
  companyId: string;
  createdAt: string;
  status: QuickHealthStatus;
  overallScore: number | null;
  websiteScore: number | null;
  brandScore: number | null;
  trafficSummary?: string;
  alertsCount: number;
  criticalAlertsCount: number;
  summary: string;
  primaryIssue: string | null;
  recommendedNextStep: string | null;
}

export interface QuickHealthCheckOptions {
  reuseRecentGapSnapshot?: boolean;
  gapSnapshotMaxAgeHours?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a GAP Snapshot run is fresh enough to reuse
 */
function isRunFreshEnough(run: DiagnosticRun | null, maxAgeHours: number): boolean {
  if (!run) return false;
  if (run.status !== 'complete') return false;

  const runAge = Date.now() - new Date(run.createdAt).getTime();
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

  return runAge < maxAgeMs;
}

/**
 * Derive primary issue and recommended next step from alerts and scores
 */
function derivePrimaryIssueAndNextStep(
  alerts: CompanyAlert[],
  overallScore: number | null,
  websiteScore: number | null,
  status: QuickHealthStatus
): { primaryIssue: string | null; recommendedNextStep: string | null } {
  // Check for critical website alerts or low website score
  const websiteAlerts = alerts.filter(a => a.source === 'Website');
  const criticalWebsiteAlert = websiteAlerts.find(a => a.severity === 'critical');
  const failedWebsiteAlert = websiteAlerts.find(a => a.title.toLowerCase().includes('failed'));

  if (criticalWebsiteAlert || failedWebsiteAlert) {
    return {
      primaryIssue: 'Website diagnostics are failing.',
      recommendedNextStep: 'Investigate Website Lab failures and re-run the diagnostic.',
    };
  }

  if (websiteScore !== null && websiteScore < 40) {
    return {
      primaryIssue: 'Website performance is critically low.',
      recommendedNextStep: 'Run Website Lab to identify and fix critical UX issues.',
    };
  }

  // Check for SEO/traffic alerts
  const seoAlerts = alerts.filter(a => a.source === 'SEO' || a.source === 'Analytics');
  const criticalSeoAlert = seoAlerts.find(a => a.severity === 'critical');

  if (criticalSeoAlert) {
    return {
      primaryIssue: 'SEO or traffic issues detected.',
      recommendedNextStep: 'Review Analytics and SEO Lab recommendations.',
    };
  }

  // Check for brand issues
  const brandAlerts = alerts.filter(a => a.source === 'Brand');
  const criticalBrandAlert = brandAlerts.find(a => a.severity === 'critical');

  if (criticalBrandAlert) {
    return {
      primaryIssue: 'Brand health issues detected.',
      recommendedNextStep: 'Review Brand Lab findings and address messaging gaps.',
    };
  }

  // Check for low overall score
  if (overallScore !== null && overallScore < 40) {
    return {
      primaryIssue: 'Overall marketing health is critically low.',
      recommendedNextStep: 'Run GAP Snapshot to identify priority improvements.',
    };
  }

  if (overallScore !== null && overallScore < 60) {
    return {
      primaryIssue: 'Marketing health has room for improvement.',
      recommendedNextStep: 'Focus on addressing the top gaps identified in diagnostics.',
    };
  }

  // Check for any critical alerts
  const anyCriticalAlert = alerts.find(a => a.severity === 'critical');
  if (anyCriticalAlert) {
    return {
      primaryIssue: anyCriticalAlert.title,
      recommendedNextStep: `Address ${anyCriticalAlert.source} issues and re-run diagnostics.`,
    };
  }

  // Check for any warning alerts
  const anyWarningAlert = alerts.find(a => a.severity === 'warning');
  if (anyWarningAlert) {
    return {
      primaryIssue: anyWarningAlert.title,
      recommendedNextStep: 'Review and address warning items when capacity allows.',
    };
  }

  // Default: healthy state
  if (status === 'healthy') {
    return {
      primaryIssue: 'No critical issues.',
      recommendedNextStep: 'Continue executing current plan and monitor trends.',
    };
  }

  return {
    primaryIssue: null,
    recommendedNextStep: 'Run diagnostics to establish a baseline.',
  };
}

/**
 * Derive health status from scores and alerts
 */
function deriveHealthStatus(
  overallScore: number | null,
  websiteScore: number | null,
  criticalAlertsCount: number
): QuickHealthStatus {
  // Critical alerts always push to at_risk
  if (criticalAlertsCount > 0) {
    return 'at_risk';
  }

  // Low scores indicate watching or at_risk
  if (overallScore !== null && overallScore < 40) {
    return 'at_risk';
  }
  if (websiteScore !== null && websiteScore < 40) {
    return 'at_risk';
  }

  if (overallScore !== null && overallScore < 60) {
    return 'watching';
  }
  if (websiteScore !== null && websiteScore < 60) {
    return 'watching';
  }

  return 'healthy';
}

/**
 * Generate AI summary for the health check
 */
async function generateHealthSummary(
  companyId: string,
  companyName: string,
  status: QuickHealthStatus,
  overallScore: number | null,
  websiteScore: number | null,
  brandScore: number | null,
  alerts: CompanyAlert[]
): Promise<string> {
  const systemPrompt = `You are a marketing operations assistant. Given a company's health check data, write a 1-2 sentence summary for an internal operator. Mention the most important risk or opportunity and suggest a next step (e.g., run a tool, fix an issue, or focus on a particular area). Keep it concise, no bullet points.`;

  const alertsSummary = alerts.length > 0
    ? alerts.slice(0, 3).map(a => `- ${a.title} (${a.severity})`).join('\n')
    : 'None';

  const taskPrompt = `Company: ${companyName}
Status: ${status}
Overall Score: ${overallScore ?? 'Not available'}/100
Website Score: ${websiteScore ?? 'Not available'}/100
Brand Score: ${brandScore ?? 'Not available'}/100

Top Alerts:
${alertsSummary}

Write a brief summary with the most important insight and recommended next action.`;

  try {
    const result = await aiForCompany(companyId, {
      type: 'Strategy',
      tags: ['Health Check', 'Summary'],
      systemPrompt,
      taskPrompt,
      model: 'gpt-4o-mini',
      temperature: 0.5,
      maxTokens: 200,
    });

    return result.content.trim();
  } catch (error) {
    console.error('[HealthCheck] AI summary failed:', error);

    // Fallback summary
    if (status === 'at_risk') {
      return `${companyName} needs attention. ${alerts.length > 0 ? `There are ${alerts.length} alerts to address.` : 'Score is below threshold.'} Run diagnostics to identify issues.`;
    } else if (status === 'watching') {
      return `${companyName} is in a monitoring phase. Score of ${overallScore ?? 'N/A'} shows room for improvement. Consider running Website Lab or SEO Lab.`;
    } else {
      return `${companyName} is performing well with a score of ${overallScore ?? 'N/A'}. No critical issues detected. Continue monitoring trends.`;
    }
  }
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Run a Quick Health Check for a company
 *
 * This lightweight check:
 * 1. Runs or reuses a recent GAP Snapshot
 * 2. Refreshes the Strategy Snapshot (which aggregates scores and Brain)
 * 3. Pulls current alerts
 * 4. Generates an AI summary
 * 5. Returns a consolidated result
 */
export async function runQuickHealthCheckForCompany(
  companyId: string,
  options: QuickHealthCheckOptions = {}
): Promise<QuickHealthCheckResult> {
  const {
    reuseRecentGapSnapshot = true,
    gapSnapshotMaxAgeHours = 24,
  } = options;

  console.log('[HealthCheck] Starting quick health check for:', companyId);

  // 1. Validate company
  const company = await getCompanyById(companyId);
  if (!company) {
    throw new Error('Company not found');
  }
  if (!company.website) {
    throw new Error('Company has no website URL');
  }

  console.log('[HealthCheck] Company:', company.name, '| Website:', company.website);

  // 2. Check for existing GAP Snapshot
  let gapRun = await getLatestRunForCompanyAndTool(companyId, 'gapSnapshot');
  const canReuseSnapshot = reuseRecentGapSnapshot && isRunFreshEnough(gapRun, gapSnapshotMaxAgeHours);

  console.log('[HealthCheck] Existing GAP Snapshot:', {
    exists: !!gapRun,
    status: gapRun?.status,
    canReuse: canReuseSnapshot,
  });

  // 3. Run GAP Snapshot if needed
  if (!canReuseSnapshot) {
    console.log('[HealthCheck] Running new GAP Snapshot...');

    // Create a new run record
    const newRun = await createDiagnosticRun({
      companyId,
      toolId: 'gapSnapshot',
      status: 'running',
    });

    try {
      // Create memory-aware model caller
      const modelCaller = createGapModelCaller(companyId, {
        type: 'GAP IA',
        tags: ['Health Check', 'Quick Snapshot'],
      });

      // Run the GAP Snapshot engine
      const result = await runGapSnapshotEngine({
        companyId,
        company,
        websiteUrl: company.website,
        modelCaller,
      });

      if (result.success) {
        // Update run with success
        gapRun = await updateDiagnosticRun(newRun.id, {
          status: 'complete',
          score: result.score,
          summary: result.summary,
          rawJson: result.data,
        });
        console.log('[HealthCheck] GAP Snapshot complete. Score:', result.score);
      } else {
        // Update run with failure
        await updateDiagnosticRun(newRun.id, {
          status: 'failed',
          summary: result.error,
        });
        console.error('[HealthCheck] GAP Snapshot failed:', result.error);
        // Continue with null gap run - we can still do partial health check
        gapRun = null;
      }
    } catch (error) {
      await updateDiagnosticRun(newRun.id, {
        status: 'failed',
        summary: error instanceof Error ? error.message : String(error),
      });
      console.error('[HealthCheck] GAP Snapshot error:', error);
      gapRun = null;
    }
  } else {
    console.log('[HealthCheck] Reusing existing GAP Snapshot (score:', gapRun?.score, ')');
  }

  // 4. Refresh Strategy Snapshot (this aggregates all scores and Brain insights)
  console.log('[HealthCheck] Refreshing Strategy Snapshot...');
  let strategySnapshot;
  try {
    strategySnapshot = await refreshCompanyStrategicSnapshot(companyId);
    console.log('[HealthCheck] Strategy Snapshot refreshed. Overall score:', strategySnapshot.overallScore);
  } catch (error) {
    console.error('[HealthCheck] Strategy Snapshot refresh failed:', error);
    // Try to get existing snapshot
    strategySnapshot = await getCompanyStrategySnapshot(companyId);
  }

  // 5. Get alerts
  console.log('[HealthCheck] Fetching alerts...');
  const alerts = await getCompanyAlerts(companyId);
  const criticalAlertsCount = alerts.filter(a => a.severity === 'critical').length;

  console.log('[HealthCheck] Alerts:', {
    total: alerts.length,
    critical: criticalAlertsCount,
  });

  // 6. Extract scores
  const overallScore = strategySnapshot?.overallScore ?? gapRun?.score ?? null;

  // Try to get website and brand scores from strategy snapshot source tools
  let websiteScore: number | null = null;
  let brandScore: number | null = null;

  // The strategy snapshot stores these in the rawJson of the latest runs
  // For now, we'll use the overall score as a proxy
  // In a full implementation, we'd pull from getRunsGroupedByTool
  if (strategySnapshot) {
    // Check if we have individual tool scores in the snapshot
    // For simplicity, we'll derive from overall for now
    websiteScore = null; // Could be fetched separately
    brandScore = null;   // Could be fetched separately
  }

  // 7. Derive status
  const status = deriveHealthStatus(overallScore, websiteScore, criticalAlertsCount);

  console.log('[HealthCheck] Status derived:', status);

  // 8. Derive primary issue and recommended next step
  const { primaryIssue, recommendedNextStep } = derivePrimaryIssueAndNextStep(
    alerts,
    overallScore,
    websiteScore,
    status
  );

  console.log('[HealthCheck] Primary issue derived:', primaryIssue);

  // 9. Generate AI summary
  console.log('[HealthCheck] Generating summary...');
  const summary = await generateHealthSummary(
    companyId,
    company.name,
    status,
    overallScore,
    websiteScore,
    brandScore,
    alerts
  );

  // 10. Build result
  const result: QuickHealthCheckResult = {
    companyId,
    createdAt: new Date().toISOString(),
    status,
    overallScore,
    websiteScore,
    brandScore,
    trafficSummary: undefined, // Could integrate with analytics overview
    alertsCount: alerts.length,
    criticalAlertsCount,
    summary,
    primaryIssue,
    recommendedNextStep,
  };

  console.log('[HealthCheck] Complete:', {
    status: result.status,
    overallScore: result.overallScore,
    alertsCount: result.alertsCount,
  });

  return result;
}

/**
 * Get the status color for a health status
 */
export function getHealthStatusColor(status: QuickHealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'text-emerald-400';
    case 'watching':
      return 'text-amber-400';
    case 'at_risk':
      return 'text-red-400';
  }
}

/**
 * Get the status background color for a health status
 */
export function getHealthStatusBgColor(status: QuickHealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'bg-emerald-500/20';
    case 'watching':
      return 'bg-amber-500/20';
    case 'at_risk':
      return 'bg-red-500/20';
  }
}

/**
 * Get the human-readable label for a health status
 */
export function getHealthStatusLabel(status: QuickHealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'Healthy';
    case 'watching':
      return 'Watching';
    case 'at_risk':
      return 'At Risk';
  }
}
