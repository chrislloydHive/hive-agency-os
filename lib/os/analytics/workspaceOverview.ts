// lib/os/analytics/workspaceOverview.ts
// Workspace Operator Dashboard - OS-Level Analytics
//
// This module provides workspace-level aggregations focused on OS operator needs:
// - Overall workspace health
// - System-wide risks and opportunities
// - OS funnel performance (Diagnostics → Work)
// - Companies requiring attention
// - AI workspace insights

import { listCompaniesForOsDirectory, type CompanyListItem } from '@/lib/os/companies/list';
import { getCompanyAlerts, type CompanyAlert } from '@/lib/os/companies/alerts';
import { aiSimple } from '@/lib/ai-gateway';
import { base } from '@/lib/airtable/client';
import {
  getDmaFunnelOsContribution,
  isDmaConfigured,
  type DmaFunnelOsContribution,
} from './dmaIntegration';

// ============================================================================
// Types
// ============================================================================

export type WorkspaceHealthStatus = 'healthy' | 'watching' | 'at_risk';

export interface WorkspaceHealthSummary {
  status: WorkspaceHealthStatus;
  averageScore: number | null;
  companiesWithData: number;
  companiesTotal: number;
  improvingCompanies: number;
  decliningCompanies: number;
  criticalAlertCount: number;
  warningAlertCount: number;
  healthyCompanies: number;
  atRiskCompanies: number;
  unknownCompanies: number;
}

export interface WorkspaceRiskItem {
  id: string;
  label: string;
  description?: string;
  severity: 'critical' | 'high' | 'medium';
  companiesAffected: number;
  exampleCompanyIds: string[];
  exampleCompanyNames: string[];
}

export interface WorkspaceOpportunityItem {
  id: string;
  label: string;
  description?: string;
  impact: 'high' | 'medium' | 'low';
  companiesAffected: number;
  exampleCompanyIds: string[];
  exampleCompanyNames: string[];
}

export interface WorkspaceFunnelStage {
  id: string;
  label: string;
  count: number;
}

export interface WorkspaceFunnelOverview {
  stages: WorkspaceFunnelStage[];
  conversionRates: Record<string, number>;
  periodLabel: string;
  // DMA-specific funnel data
  dma?: {
    auditsStarted: number;
    auditsCompleted: number;
    completionRate: number;
    leadsGenerated: number;
  };
}

export interface WorkspaceCompanyAttentionItem {
  companyId: string;
  name: string;
  url?: string | null;
  overallScore: number | null;
  health: WorkspaceHealthStatus;
  criticalAlerts: number;
  warningAlerts: number;
  latestDiagnosticsAt?: string | null;
  primaryReason: string;
}

export interface WorkspaceAiInsights {
  summary: string;
  topOpportunities: string[];
  topRisks: string[];
  nextBestAction: string;
}

export interface WorkspaceOperatorOverview {
  health: WorkspaceHealthSummary;
  risks: WorkspaceRiskItem[];
  opportunities: WorkspaceOpportunityItem[];
  funnel: WorkspaceFunnelOverview;
  attentionList: WorkspaceCompanyAttentionItem[];
  aiInsights: WorkspaceAiInsights | null;
  dmaContribution: DmaFunnelOsContribution | null;
  fetchedAt: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function mapCompanyHealthToWorkspaceHealth(health: string): WorkspaceHealthStatus {
  if (health === 'Healthy') return 'healthy';
  if (health === 'At Risk') return 'at_risk';
  return 'watching';
}

function isWithinDays(dateStr: string | null | undefined, days: number): boolean {
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

// ============================================================================
// 1. Workspace Health Summary
// ============================================================================

export async function getWorkspaceHealthSummary(): Promise<WorkspaceHealthSummary> {
  console.log('[WorkspaceOverview] Computing workspace health summary...');

  try {
    // Get all companies
    const companies = await listCompaniesForOsDirectory();

    // Compute metrics
    const companiesTotal = companies.length;
    const companiesWithScore = companies.filter((c) => c.latestGapScore !== null);
    const companiesWithData = companiesWithScore.length;

    // Calculate average score
    const averageScore =
      companiesWithData > 0
        ? Math.round(
            companiesWithScore.reduce((sum, c) => sum + (c.latestGapScore ?? 0), 0) /
              companiesWithData
          )
        : null;

    // Count by health status
    const healthyCompanies = companies.filter((c) => c.health === 'Healthy').length;
    const atRiskCompanies = companies.filter((c) => c.health === 'At Risk').length;
    const unknownCompanies = companies.filter((c) => c.health === 'Unknown').length;

    // Get alerts for all companies (sample first 20 for performance)
    let criticalAlertCount = 0;
    let warningAlertCount = 0;

    // For now, estimate based on company health and scores
    // A more thorough implementation would fetch alerts for all companies
    criticalAlertCount = companies.filter(
      (c) => c.health === 'At Risk' && (c.latestGapScore ?? 100) < 40
    ).length;
    warningAlertCount = companies.filter(
      (c) => c.health === 'At Risk' && (c.latestGapScore ?? 100) >= 40
    ).length;

    // Determine workspace status
    let status: WorkspaceHealthStatus = 'healthy';
    if (criticalAlertCount > 2 || (averageScore !== null && averageScore < 40)) {
      status = 'at_risk';
    } else if (
      warningAlertCount > 3 ||
      (averageScore !== null && averageScore < 60) ||
      atRiskCompanies > companiesTotal * 0.3
    ) {
      status = 'watching';
    }

    // TODO: Track improving/declining companies via score trends
    // For now, return placeholder values
    const improvingCompanies = 0;
    const decliningCompanies = 0;

    console.log('[WorkspaceOverview] Health summary computed:', {
      status,
      averageScore,
      companiesTotal,
      healthyCompanies,
      atRiskCompanies,
    });

    return {
      status,
      averageScore,
      companiesWithData,
      companiesTotal,
      improvingCompanies,
      decliningCompanies,
      criticalAlertCount,
      warningAlertCount,
      healthyCompanies,
      atRiskCompanies,
      unknownCompanies,
    };
  } catch (error) {
    console.error('[WorkspaceOverview] Error computing health summary:', error);
    return {
      status: 'watching',
      averageScore: null,
      companiesWithData: 0,
      companiesTotal: 0,
      improvingCompanies: 0,
      decliningCompanies: 0,
      criticalAlertCount: 0,
      warningAlertCount: 0,
      healthyCompanies: 0,
      atRiskCompanies: 0,
      unknownCompanies: 0,
    };
  }
}

// ============================================================================
// 2. Risks and Opportunities
// ============================================================================

export async function getWorkspaceRisksAndOpportunities(): Promise<{
  risks: WorkspaceRiskItem[];
  opportunities: WorkspaceOpportunityItem[];
}> {
  console.log('[WorkspaceOverview] Computing risks and opportunities...');

  try {
    const companies = await listCompaniesForOsDirectory();

    const risks: WorkspaceRiskItem[] = [];
    const opportunities: WorkspaceOpportunityItem[] = [];

    // ========================================
    // Risk: Companies with no diagnostics
    // ========================================
    const noAssessment = companies.filter(
      (c) => !c.lastActivityAt && c.stage !== 'Dormant' && c.stage !== 'Lost'
    );
    if (noAssessment.length > 0) {
      risks.push({
        id: 'no-diagnostics',
        label: 'Companies with no diagnostics',
        description:
          'These companies have never had a GAP assessment or diagnostic run.',
        severity: noAssessment.length > 5 ? 'high' : 'medium',
        companiesAffected: noAssessment.length,
        exampleCompanyIds: noAssessment.slice(0, 3).map((c) => c.id),
        exampleCompanyNames: noAssessment.slice(0, 3).map((c) => c.name),
      });
    }

    // ========================================
    // Risk: Stale diagnostics (> 60 days)
    // ========================================
    const staleDiagnostics = companies.filter((c) => {
      if (!c.lastActivityAt) return false;
      return !isWithinDays(c.lastActivityAt, 60);
    });
    if (staleDiagnostics.length > 0) {
      risks.push({
        id: 'stale-diagnostics',
        label: 'Outdated diagnostics',
        description:
          'These companies have not had a diagnostic run in 60+ days.',
        severity: staleDiagnostics.length > 3 ? 'high' : 'medium',
        companiesAffected: staleDiagnostics.length,
        exampleCompanyIds: staleDiagnostics.slice(0, 3).map((c) => c.id),
        exampleCompanyNames: staleDiagnostics.slice(0, 3).map((c) => c.name),
      });
    }

    // ========================================
    // Risk: Low GAP scores (< 40)
    // ========================================
    const lowScores = companies.filter(
      (c) => c.latestGapScore != null && c.latestGapScore < 40
    );
    if (lowScores.length > 0) {
      risks.push({
        id: 'low-scores',
        label: 'Critical GAP scores',
        description:
          'Companies scoring below 40 need immediate attention.',
        severity: 'critical',
        companiesAffected: lowScores.length,
        exampleCompanyIds: lowScores.slice(0, 3).map((c) => c.id),
        exampleCompanyNames: lowScores.slice(0, 3).map((c) => c.name),
      });
    }

    // ========================================
    // Risk: At Risk clients
    // ========================================
    const atRiskClients = companies.filter(
      (c) => c.health === 'At Risk' && c.stage === 'Client'
    );
    if (atRiskClients.length > 0) {
      risks.push({
        id: 'at-risk-clients',
        label: 'At-risk clients',
        description:
          'Active clients flagged as at-risk based on inactivity or low scores.',
        severity: 'critical',
        companiesAffected: atRiskClients.length,
        exampleCompanyIds: atRiskClients.slice(0, 3).map((c) => c.id),
        exampleCompanyNames: atRiskClients.slice(0, 3).map((c) => c.name),
      });
    }

    // ========================================
    // Risk: No active work
    // ========================================
    const noWork = companies.filter(
      (c) =>
        c.stage === 'Client' &&
        c.openWorkCount === 0 &&
        c.health !== 'Unknown'
    );
    if (noWork.length > 0) {
      risks.push({
        id: 'no-active-work',
        label: 'Clients with no active work',
        description:
          'Active clients with no open work items. May indicate stalled engagement.',
        severity: 'medium',
        companiesAffected: noWork.length,
        exampleCompanyIds: noWork.slice(0, 3).map((c) => c.id),
        exampleCompanyNames: noWork.slice(0, 3).map((c) => c.name),
      });
    }

    // ========================================
    // Opportunity: High scores ready for case study
    // ========================================
    const highScores = companies.filter(
      (c) => c.latestGapScore != null && c.latestGapScore >= 80
    );
    if (highScores.length > 0) {
      opportunities.push({
        id: 'case-study-ready',
        label: 'Case study candidates',
        description:
          'High-performing companies (80+ score) could be case studies.',
        impact: 'high',
        companiesAffected: highScores.length,
        exampleCompanyIds: highScores.slice(0, 3).map((c) => c.id),
        exampleCompanyNames: highScores.slice(0, 3).map((c) => c.name),
      });
    }

    // ========================================
    // Opportunity: Prospects ready for conversion
    // ========================================
    const hotProspects = companies.filter(
      (c) =>
        c.stage === 'Prospect' &&
        c.latestGapScore != null &&
        c.health === 'Healthy' &&
        isWithinDays(c.lastActivityAt, 30)
    );
    if (hotProspects.length > 0) {
      opportunities.push({
        id: 'hot-prospects',
        label: 'Active prospects',
        description:
          'Engaged prospects with recent activity. Ready for follow-up.',
        impact: 'high',
        companiesAffected: hotProspects.length,
        exampleCompanyIds: hotProspects.slice(0, 3).map((c) => c.id),
        exampleCompanyNames: hotProspects.slice(0, 3).map((c) => c.name),
      });
    }

    // ========================================
    // Opportunity: Mid-score improvement potential
    // ========================================
    const improvementCandidates = companies.filter(
      (c) =>
        c.latestGapScore != null &&
        c.latestGapScore >= 50 &&
        c.latestGapScore < 70 &&
        c.stage === 'Client'
    );
    if (improvementCandidates.length > 0) {
      opportunities.push({
        id: 'improvement-potential',
        label: 'Improvement potential',
        description:
          'Clients with moderate scores (50-70) that could quickly improve.',
        impact: 'medium',
        companiesAffected: improvementCandidates.length,
        exampleCompanyIds: improvementCandidates.slice(0, 3).map((c) => c.id),
        exampleCompanyNames: improvementCandidates.slice(0, 3).map((c) => c.name),
      });
    }

    // ========================================
    // Opportunity: Re-engagement candidates
    // ========================================
    const dormantWithScore = companies.filter(
      (c) =>
        c.stage === 'Dormant' &&
        c.latestGapScore != null &&
        c.latestGapScore >= 50
    );
    if (dormantWithScore.length > 0) {
      opportunities.push({
        id: 'reengagement',
        label: 'Re-engagement candidates',
        description:
          'Dormant companies with decent scores worth reaching out to.',
        impact: 'medium',
        companiesAffected: dormantWithScore.length,
        exampleCompanyIds: dormantWithScore.slice(0, 3).map((c) => c.id),
        exampleCompanyNames: dormantWithScore.slice(0, 3).map((c) => c.name),
      });
    }

    // Sort risks by severity
    const severityOrder = { critical: 0, high: 1, medium: 2 };
    risks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // Sort opportunities by impact
    const impactOrder = { high: 0, medium: 1, low: 2 };
    opportunities.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]);

    console.log('[WorkspaceOverview] Risks and opportunities computed:', {
      risks: risks.length,
      opportunities: opportunities.length,
    });

    return { risks: risks.slice(0, 7), opportunities: opportunities.slice(0, 7) };
  } catch (error) {
    console.error('[WorkspaceOverview] Error computing risks/opportunities:', error);
    return { risks: [], opportunities: [] };
  }
}

// ============================================================================
// 3. OS Funnel Overview
// ============================================================================

export async function getWorkspaceFunnelOverview(
  periodDays: number = 30
): Promise<WorkspaceFunnelOverview> {
  console.log('[WorkspaceOverview] Computing funnel overview for', periodDays, 'days...');

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - periodDays);
  const cutoffIso = cutoffDate.toISOString();

  try {
    // Count diagnostic runs in period
    let diagnosticRuns = 0;
    try {
      const diagnosticRecords = await base('Diagnostic Runs')
        .select({
          filterByFormula: `IS_AFTER({Created At}, '${cutoffIso}')`,
          fields: ['Created At'],
        })
        .all();
      diagnosticRuns = diagnosticRecords.length;
    } catch {
      console.warn('[WorkspaceFunnel] Could not fetch diagnostic runs');
    }

    // Count work items created in period
    let workItemsCreated = 0;
    try {
      const workRecords = await base('Work Items')
        .select({
          filterByFormula: `IS_AFTER(CREATED_TIME(), '${cutoffIso}')`,
          fields: ['Status'],
        })
        .all();
      workItemsCreated = workRecords.length;
    } catch {
      console.warn('[WorkspaceFunnel] Could not fetch work items');
    }

    // Count work items completed in period
    let workItemsCompleted = 0;
    try {
      const completedRecords = await base('Work Items')
        .select({
          filterByFormula: `AND({Status} = 'Done', IS_AFTER({Completed At}, '${cutoffIso}'))`,
          fields: ['Completed At'],
        })
        .all();
      workItemsCompleted = completedRecords.length;
    } catch {
      console.warn('[WorkspaceFunnel] Could not fetch completed work items');
    }

    // Count new companies (prospects) in period
    let newCompanies = 0;
    try {
      const companyRecords = await base('Companies')
        .select({
          filterByFormula: `IS_AFTER(CREATED_TIME(), '${cutoffIso}')`,
          fields: ['Name'],
        })
        .all();
      newCompanies = companyRecords.length;
    } catch {
      console.warn('[WorkspaceFunnel] Could not fetch new companies');
    }

    const stages: WorkspaceFunnelStage[] = [
      { id: 'companies', label: 'New Companies', count: newCompanies },
      { id: 'diagnostics', label: 'Diagnostics Run', count: diagnosticRuns },
      { id: 'work-created', label: 'Work Created', count: workItemsCreated },
      { id: 'work-completed', label: 'Work Completed', count: workItemsCompleted },
    ];

    // Calculate conversion rates
    const conversionRates: Record<string, number> = {};
    if (newCompanies > 0 && diagnosticRuns > 0) {
      conversionRates['companies→diagnostics'] = Math.round(
        (diagnosticRuns / newCompanies) * 100
      );
    }
    if (diagnosticRuns > 0 && workItemsCreated > 0) {
      conversionRates['diagnostics→work'] = Math.round(
        (workItemsCreated / diagnosticRuns) * 100
      );
    }
    if (workItemsCreated > 0 && workItemsCompleted > 0) {
      conversionRates['work→completed'] = Math.round(
        (workItemsCompleted / workItemsCreated) * 100
      );
    }

    console.log('[WorkspaceOverview] Funnel computed:', stages);

    return {
      stages,
      conversionRates,
      periodLabel: `Last ${periodDays} days`,
    };
  } catch (error) {
    console.error('[WorkspaceOverview] Error computing funnel:', error);
    return {
      stages: [],
      conversionRates: {},
      periodLabel: `Last ${periodDays} days`,
    };
  }
}

// ============================================================================
// 4. Companies Requiring Attention
// ============================================================================

export async function getWorkspaceCompanyAttentionList(): Promise<
  WorkspaceCompanyAttentionItem[]
> {
  console.log('[WorkspaceOverview] Building attention list...');

  try {
    const companies = await listCompaniesForOsDirectory({ atRiskOnly: false });

    // Get alerts for at-risk and unknown companies (sample for performance)
    const attentionCandidates = companies
      .filter((c) => c.health !== 'Healthy' || c.stage === 'Client')
      .slice(0, 30);

    const attentionItems: WorkspaceCompanyAttentionItem[] = [];

    for (const company of attentionCandidates) {
      // Determine if this company needs attention
      const needsAttention =
        company.health === 'At Risk' ||
        (company.stage === 'Client' && company.health === 'Unknown') ||
        (company.latestGapScore != null && company.latestGapScore < 50);

      if (!needsAttention) continue;

      // Get alerts for this company
      let criticalAlerts = 0;
      let warningAlerts = 0;
      try {
        const alerts = await getCompanyAlerts(company.id);
        criticalAlerts = alerts.filter((a) => a.severity === 'critical').length;
        warningAlerts = alerts.filter((a) => a.severity === 'warning').length;
      } catch {
        // Estimate from health reasons
        criticalAlerts = company.health === 'At Risk' ? 1 : 0;
      }

      // Determine primary reason
      let primaryReason = company.healthReasons?.[0] || 'Needs review';
      if (company.latestGapScore != null && company.latestGapScore < 40) {
        primaryReason = `Low GAP score: ${company.latestGapScore}/100`;
      }

      attentionItems.push({
        companyId: company.id,
        name: company.name,
        url: company.website,
        overallScore: company.latestGapScore ?? null,
        health: mapCompanyHealthToWorkspaceHealth(company.health),
        criticalAlerts,
        warningAlerts,
        latestDiagnosticsAt: company.lastActivityAt,
        primaryReason,
      });
    }

    // Sort by priority: critical alerts first, then by score (lowest first)
    attentionItems.sort((a, b) => {
      // Critical alerts first
      if (a.criticalAlerts !== b.criticalAlerts) {
        return b.criticalAlerts - a.criticalAlerts;
      }
      // Then at_risk before watching
      if (a.health !== b.health) {
        const order = { at_risk: 0, watching: 1, healthy: 2 };
        return order[a.health] - order[b.health];
      }
      // Then by score (lowest first)
      const scoreA = a.overallScore ?? 100;
      const scoreB = b.overallScore ?? 100;
      return scoreA - scoreB;
    });

    console.log('[WorkspaceOverview] Attention list built:', attentionItems.length);

    return attentionItems.slice(0, 10);
  } catch (error) {
    console.error('[WorkspaceOverview] Error building attention list:', error);
    return [];
  }
}

// ============================================================================
// 5. AI Workspace Insights
// ============================================================================

export async function getWorkspaceAiInsights(
  health: WorkspaceHealthSummary,
  risks: WorkspaceRiskItem[],
  opportunities: WorkspaceOpportunityItem[],
  funnel: WorkspaceFunnelOverview
): Promise<WorkspaceAiInsights> {
  console.log('[WorkspaceOverview] Generating AI insights...');

  try {
    const systemPrompt = `You are a marketing operations lead analyzing a Hive OS workspace.
Given workspace health stats, systemic risks, opportunities, and OS funnel metrics, provide concise actionable insights.

Output JSON with this exact structure:
{
  "summary": "2-3 sentence high-level overview of workspace health",
  "topOpportunities": ["opportunity 1", "opportunity 2", "opportunity 3"],
  "topRisks": ["risk 1", "risk 2", "risk 3"],
  "nextBestAction": "One clear, specific next step for the workspace operator"
}

Be specific and actionable. Reference actual numbers. Focus on what matters most.`;

    const taskPrompt = `Analyze this workspace data:

## Health Summary
- Status: ${health.status}
- Average Score: ${health.averageScore ?? 'N/A'}/100
- Total Companies: ${health.companiesTotal}
- Healthy: ${health.healthyCompanies}
- At Risk: ${health.atRiskCompanies}
- Unknown: ${health.unknownCompanies}
- Critical Alerts: ${health.criticalAlertCount}
- Warning Alerts: ${health.warningAlertCount}

## System Risks (${risks.length} total)
${risks
  .slice(0, 5)
  .map((r) => `- ${r.label} (${r.severity}): ${r.companiesAffected} companies`)
  .join('\n')}

## Opportunities (${opportunities.length} total)
${opportunities
  .slice(0, 5)
  .map((o) => `- ${o.label} (${o.impact} impact): ${o.companiesAffected} companies`)
  .join('\n')}

## OS Funnel (${funnel.periodLabel})
${funnel.stages.map((s) => `- ${s.label}: ${s.count}`).join('\n')}

Provide insights focused on what the operator should do next.`;

    const response = await aiSimple({
      systemPrompt,
      taskPrompt,
      model: 'gpt-4o-mini',
      temperature: 0.3,
      maxTokens: 800,
      jsonMode: true,
    });

    const parsed = JSON.parse(response);

    console.log('[WorkspaceOverview] AI insights generated');

    return {
      summary: parsed.summary || 'Unable to generate summary.',
      topOpportunities: parsed.topOpportunities || [],
      topRisks: parsed.topRisks || [],
      nextBestAction: parsed.nextBestAction || 'Review at-risk companies.',
    };
  } catch (error) {
    console.error('[WorkspaceOverview] Error generating AI insights:', error);
    return {
      summary: `Workspace has ${health.companiesTotal} companies with an average score of ${health.averageScore ?? 'N/A'}.`,
      topOpportunities: opportunities.slice(0, 3).map((o) => o.label),
      topRisks: risks.slice(0, 3).map((r) => r.label),
      nextBestAction:
        health.criticalAlertCount > 0
          ? 'Address critical alerts in at-risk companies.'
          : 'Run diagnostics for companies without recent assessments.',
    };
  }
}

// ============================================================================
// 6. Full Overview Aggregator
// ============================================================================

export async function getWorkspaceOperatorOverview(options?: {
  periodDays?: number;
  includeAi?: boolean;
  includeDma?: boolean;
}): Promise<WorkspaceOperatorOverview> {
  const periodDays = options?.periodDays ?? 30;
  const includeAi = options?.includeAi ?? true;
  const includeDma = options?.includeDma ?? true;

  console.log('[WorkspaceOverview] Fetching full operator overview...');

  // Calculate period dates for DMA
  const periodEnd = new Date();
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - periodDays);

  // Fetch core data in parallel (including DMA if configured)
  const corePromises: [
    Promise<WorkspaceHealthSummary>,
    Promise<{ risks: WorkspaceRiskItem[]; opportunities: WorkspaceOpportunityItem[] }>,
    Promise<WorkspaceFunnelOverview>,
    Promise<WorkspaceCompanyAttentionItem[]>,
    Promise<DmaFunnelOsContribution | null>
  ] = [
    getWorkspaceHealthSummary(),
    getWorkspaceRisksAndOpportunities(),
    getWorkspaceFunnelOverview(periodDays),
    getWorkspaceCompanyAttentionList(),
    includeDma && isDmaConfigured()
      ? getDmaFunnelOsContribution({ start: periodStart, end: periodEnd })
      : Promise.resolve(null),
  ];

  const [health, risksAndOpps, funnel, attentionList, dmaContribution] =
    await Promise.all(corePromises);

  const { risks, opportunities } = risksAndOpps;

  // Merge DMA risks and opportunities if available
  if (dmaContribution) {
    console.log('[WorkspaceOverview] Merging DMA contribution...');

    // Add DMA risks to workspace risks
    for (const dmaRisk of dmaContribution.risks) {
      risks.push({
        id: `dma-${dmaRisk.id}`,
        label: dmaRisk.label,
        description: dmaRisk.description,
        severity: dmaRisk.severity,
        companiesAffected: 1, // DMA is workspace-level
        exampleCompanyIds: [],
        exampleCompanyNames: [],
      });
    }

    // Add DMA opportunities to workspace opportunities
    for (const dmaOpp of dmaContribution.opportunities) {
      opportunities.push({
        id: `dma-${dmaOpp.id}`,
        label: dmaOpp.label,
        description: dmaOpp.description,
        impact: dmaOpp.impact,
        companiesAffected: 1, // DMA is workspace-level
        exampleCompanyIds: [],
        exampleCompanyNames: [],
      });
    }

    // Re-sort risks by severity
    const severityOrder = { critical: 0, high: 1, medium: 2 };
    risks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // Re-sort opportunities by impact
    const impactOrder = { high: 0, medium: 1, low: 2 };
    opportunities.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]);

    // Add DMA data to funnel
    funnel.dma = {
      auditsStarted: dmaContribution.funnelStages.diagnostics,
      auditsCompleted: dmaContribution.funnelStages.completedDiagnostics,
      completionRate: dmaContribution.summary.completionRate,
      leadsGenerated: dmaContribution.funnelStages.leads,
    };

    // Update funnel stages to include DMA diagnostics count
    const diagnosticsStage = funnel.stages.find((s) => s.id === 'diagnostics');
    if (diagnosticsStage) {
      diagnosticsStage.count += dmaContribution.funnelStages.diagnostics;
    }
  }

  // Generate AI insights (optional, can be slow)
  let aiInsights: WorkspaceAiInsights | null = null;
  if (includeAi) {
    aiInsights = await getWorkspaceAiInsights(health, risks, opportunities, funnel);
  }

  console.log('[WorkspaceOverview] Full overview complete');

  return {
    health,
    risks,
    opportunities,
    funnel,
    attentionList,
    aiInsights,
    dmaContribution,
    fetchedAt: new Date().toISOString(),
  };
}
