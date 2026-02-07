// lib/intelligence/osIntelligence.ts
// OS Intelligence Layer - Computes workspace health and AI analysis

import { getCompaniesWithOsSummary } from '@/lib/airtable/companies';
import { getAllWorkItems } from '@/lib/airtable/workItems';
import { getAllFullReports } from '@/lib/airtable/fullReports';
import { isDmaConfigured, getDmaFunnelOsContribution } from '@/lib/os/analytics/dmaIntegration';
import { getAllInboundLeads } from '@/lib/airtable/inboundLeads';
import { buildSystemAnalysisPrompt } from './prompts';
import type {
  OSHealthSummary,
  OSMetrics,
  OSRisk,
  OSOpportunity,
  OSCluster,
  SystemAIAnalysis,
  NextBestAction,
} from './types';

// ============================================================================
// Cache
// ============================================================================

let osHealthCache: {
  data: OSHealthSummary | null;
  timestamp: number;
  ttlMs: number;
} = {
  data: null,
  timestamp: 0,
  ttlMs: 5 * 60 * 1000, // 5 minutes
};

export function invalidateOSHealthCache(): void {
  osHealthCache.data = null;
  osHealthCache.timestamp = 0;
  console.log('[OSIntelligence] Cache invalidated');
}

// ============================================================================
// Main Intelligence Function
// ============================================================================

export async function computeOSIntelligence(): Promise<OSHealthSummary> {
  // Check cache
  const now = Date.now();
  if (osHealthCache.data && now - osHealthCache.timestamp < osHealthCache.ttlMs) {
    console.log('[OSIntelligence] Returning cached data');
    return osHealthCache.data;
  }

  console.log('[OSIntelligence] Computing fresh data...');

  try {
    // Fetch all data in parallel
    const nowDate = new Date();
    const thirtyDaysAgo = new Date(nowDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [companies, workItems, fullReports, dmaContribution, leads] = await Promise.all([
      getCompaniesWithOsSummary().catch(() => []),
      getAllWorkItems().catch(() => []),
      getAllFullReports().catch(() => []),
      isDmaConfigured() ? getDmaFunnelOsContribution({ start: thirtyDaysAgo, end: nowDate }).catch(() => null) : Promise.resolve(null),
      getAllInboundLeads().catch(() => []),
    ]);

    // Compute metrics
    const metrics = computeMetrics(companies, workItems, fullReports, dmaContribution, leads);

    // Derive risks
    const risks = deriveRisks(companies, workItems, metrics);

    // Derive opportunities
    const opportunities = deriveOpportunities(companies, workItems, metrics);

    // Derive clusters
    const clusters = deriveClusters(companies, fullReports);

    // Generate warnings
    const warnings = generateWarnings(metrics, risks);

    // Compute system health score
    const systemHealthScore = computeHealthScore(metrics);

    const result: OSHealthSummary = {
      systemHealthScore,
      risks,
      opportunities,
      clusters,
      warnings,
      metrics,
      generatedAt: new Date().toISOString(),
    };

    // Update cache
    osHealthCache = {
      data: result,
      timestamp: now,
      ttlMs: 5 * 60 * 1000,
    };

    console.log('[OSIntelligence] Computed:', {
      healthScore: systemHealthScore,
      risks: risks.length,
      opportunities: opportunities.length,
      clusters: clusters.length,
    });

    return result;
  } catch (error) {
    console.error('[OSIntelligence] Error computing intelligence:', error);
    throw error;
  }
}

// ============================================================================
// Compute Metrics
// ============================================================================

function computeMetrics(
  companies: any[],
  workItems: any[],
  fullReports: any[],
  dmaContribution: any | null,
  leads: any[]
): OSMetrics {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Company metrics
  const totalCompanies = companies.length;
  const companiesWithDiagnostics = companies.filter(c => c.fullReportId || c.snapshotId).length;
  const companiesWithPlans = fullReports.filter(r => r.planJson).length;
  const companiesAtRisk = companies.filter(c => c.health === 'at-risk' || c.health === 'critical').length;

  // Stage breakdown
  const companiesByStage: Record<string, number> = {};
  companies.forEach(c => {
    const stage = c.stage || 'unknown';
    companiesByStage[stage] = (companiesByStage[stage] || 0) + 1;
  });

  // Coverage percentages
  const diagnosticsCoverage = totalCompanies > 0 ? (companiesWithDiagnostics / totalCompanies) * 100 : 0;
  const plansCoverage = totalCompanies > 0 ? (companiesWithPlans / totalCompanies) * 100 : 0;
  const analyticsCoverage = 0; // TODO: Calculate from GA4/GSC integration data

  // Work metrics (last 30 days)
  const workCreated30d = workItems.filter(w => {
    const createdAt = w.createdAt ? new Date(w.createdAt) : null;
    return createdAt && createdAt >= thirtyDaysAgo;
  }).length;

  const workCompleted30d = workItems.filter(w => {
    const updatedAt = w.updatedAt ? new Date(w.updatedAt) : null;
    return w.status === 'Done' && updatedAt && updatedAt >= thirtyDaysAgo;
  }).length;

  const workCompletionRate = workCreated30d > 0 ? (workCompleted30d / workCreated30d) * 100 : 0;

  const workOverdue = workItems.filter(w => {
    if (w.status === 'Done') return false;
    const dueDate = w.dueDate ? new Date(w.dueDate) : null;
    return dueDate && dueDate < now;
  }).length;

  // Engagement metrics
  const companiesActiveLastWeek = companies.filter(c => {
    const lastActivity = c.updatedAt ? new Date(c.updatedAt) : null;
    return lastActivity && lastActivity >= sevenDaysAgo;
  }).length;

  const companiesInactiveOver14d = companies.filter(c => {
    const lastActivity = c.updatedAt ? new Date(c.updatedAt) : null;
    return !lastActivity || lastActivity < fourteenDaysAgo;
  }).length;

  const companiesInactiveOver30d = companies.filter(c => {
    const lastActivity = c.updatedAt ? new Date(c.updatedAt) : null;
    return !lastActivity || lastActivity < thirtyDaysAgo;
  }).length;

  // DMA Funnel metrics
  const dmaAuditsStarted30d = dmaContribution?.funnelStages?.diagnostics || 0;
  const dmaAuditsCompleted30d = dmaContribution?.funnelStages?.completedDiagnostics || 0;
  const dmaCompletionRate = dmaAuditsStarted30d > 0 ? (dmaAuditsCompleted30d / dmaAuditsStarted30d) * 100 : 0;
  const dmaLeads30d = dmaContribution?.funnelStages?.leads || 0;

  // Pipeline metrics
  const newLeads30d = leads.filter(l => {
    const createdAt = l.createdAt ? new Date(l.createdAt) : null;
    return createdAt && createdAt >= thirtyDaysAgo;
  }).length;
  const activeOpportunities = leads.filter(l => l.status === 'New' || l.status === 'Contacted').length;

  // Average GAP score
  const scoresFromReports = fullReports
    .map(r => r.scores?.overall)
    .filter((s): s is number => typeof s === 'number');
  const avgGapScore = scoresFromReports.length > 0
    ? scoresFromReports.reduce((a, b) => a + b, 0) / scoresFromReports.length
    : null;

  // Analytics coverage (placeholder)
  const companiesWithGa4 = 0; // TODO
  const companiesWithGsc = 0; // TODO

  return {
    totalCompanies,
    companiesWithDiagnostics,
    companiesWithPlans,
    companiesAtRisk,
    companiesByStage,
    diagnosticsCoverage,
    plansCoverage,
    analyticsCoverage,
    workCreated30d,
    workCompleted30d,
    workCompletionRate,
    workOverdue,
    companiesActiveLastWeek,
    companiesInactiveOver14d,
    companiesInactiveOver30d,
    dmaAuditsStarted30d,
    dmaAuditsCompleted30d,
    dmaCompletionRate,
    dmaLeads30d,
    newLeads30d,
    activeOpportunities,
    avgGapScore,
    companiesWithGa4,
    companiesWithGsc,
  };
}

// ============================================================================
// Derive Risks
// ============================================================================

function deriveRisks(companies: any[], workItems: any[], metrics: OSMetrics): OSRisk[] {
  const risks: OSRisk[] = [];

  // Risk: Companies at risk
  const atRiskCompanies = companies.filter(c => c.health === 'at-risk' || c.health === 'critical');
  if (atRiskCompanies.length > 0) {
    risks.push({
      id: 'at-risk-companies',
      title: 'Companies at Risk',
      description: `${atRiskCompanies.length} companies are flagged as at-risk or critical and need immediate attention.`,
      severity: atRiskCompanies.length >= 5 ? 'critical' : atRiskCompanies.length >= 3 ? 'high' : 'medium',
      count: atRiskCompanies.length,
      companies: atRiskCompanies.map(c => c.id),
      companyNames: atRiskCompanies.map(c => c.name),
      category: 'health',
    });
  }

  // Risk: Low diagnostics coverage
  if (metrics.diagnosticsCoverage < 50) {
    const withoutDiagnostics = companies.filter(c => !c.fullReportId && !c.snapshotId);
    risks.push({
      id: 'low-diagnostics-coverage',
      title: 'Low Diagnostics Coverage',
      description: `Only ${metrics.diagnosticsCoverage.toFixed(0)}% of companies have diagnostics. ${withoutDiagnostics.length} companies need assessment.`,
      severity: metrics.diagnosticsCoverage < 25 ? 'high' : 'medium',
      count: withoutDiagnostics.length,
      companies: withoutDiagnostics.slice(0, 10).map(c => c.id),
      companyNames: withoutDiagnostics.slice(0, 10).map(c => c.name),
      category: 'diagnostics',
    });
  }

  // Risk: High overdue work
  if (metrics.workOverdue >= 5) {
    const overdueItems = workItems.filter(w => {
      if (w.status === 'Done') return false;
      const dueDate = w.dueDate ? new Date(w.dueDate) : null;
      return dueDate && dueDate < new Date();
    });
    const affectedCompanyIds = [...new Set(overdueItems.map(w => w.companyId).filter(Boolean))];
    const affectedCompanies = companies.filter(c => affectedCompanyIds.includes(c.id));

    risks.push({
      id: 'high-overdue-work',
      title: 'High Overdue Work',
      description: `${metrics.workOverdue} work items are overdue across ${affectedCompanies.length} companies.`,
      severity: metrics.workOverdue >= 10 ? 'high' : 'medium',
      count: metrics.workOverdue,
      companies: affectedCompanies.slice(0, 10).map(c => c.id),
      companyNames: affectedCompanies.slice(0, 10).map(c => c.name),
      category: 'work',
    });
  }

  // Risk: Inactive companies
  if (metrics.companiesInactiveOver30d >= 5) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const inactiveCompanies = companies.filter(c => {
      const lastActivity = c.updatedAt ? new Date(c.updatedAt) : null;
      return !lastActivity || lastActivity < thirtyDaysAgo;
    });

    risks.push({
      id: 'inactive-companies',
      title: 'Inactive Companies',
      description: `${metrics.companiesInactiveOver30d} companies have had no activity in 30+ days.`,
      severity: metrics.companiesInactiveOver30d >= 10 ? 'high' : 'medium',
      count: metrics.companiesInactiveOver30d,
      companies: inactiveCompanies.slice(0, 10).map(c => c.id),
      companyNames: inactiveCompanies.slice(0, 10).map(c => c.name),
      category: 'engagement',
    });
  }

  // Risk: No owner assigned
  const noOwnerCompanies = companies.filter(c => !c.owner && (c.stage === 'client' || c.stage === 'prospect'));
  if (noOwnerCompanies.length >= 3) {
    risks.push({
      id: 'no-owner-assigned',
      title: 'Companies Without Owner',
      description: `${noOwnerCompanies.length} active companies have no owner assigned.`,
      severity: 'medium',
      count: noOwnerCompanies.length,
      companies: noOwnerCompanies.slice(0, 10).map(c => c.id),
      companyNames: noOwnerCompanies.slice(0, 10).map(c => c.name),
      category: 'owner',
    });
  }

  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  risks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return risks;
}

// ============================================================================
// Derive Opportunities
// ============================================================================

function deriveOpportunities(companies: any[], workItems: any[], metrics: OSMetrics): OSOpportunity[] {
  const opportunities: OSOpportunity[] = [];

  // Opportunity: Companies ready for upsell (high scores, active engagement)
  const highScoreCompanies = companies.filter(c =>
    c.latestOverallScore && c.latestOverallScore >= 70 && c.stage === 'client'
  );
  if (highScoreCompanies.length >= 2) {
    opportunities.push({
      id: 'upsell-ready',
      title: 'Companies Ready for Upsell',
      description: `${highScoreCompanies.length} clients have high GAP scores (70+) and may be ready for additional services.`,
      impact: 'high',
      companies: highScoreCompanies.slice(0, 10).map(c => c.id),
      companyNames: highScoreCompanies.slice(0, 10).map(c => c.name),
      category: 'upsell',
      actionUrl: '/companies?filter=high-score',
    });
  }

  // Opportunity: Prospects with completed diagnostics (ready to convert)
  const qualifiedProspects = companies.filter(c =>
    c.stage === 'prospect' && (c.fullReportId || c.snapshotId)
  );
  if (qualifiedProspects.length >= 1) {
    opportunities.push({
      id: 'qualified-prospects',
      title: 'Qualified Prospects',
      description: `${qualifiedProspects.length} prospects have completed diagnostics and are ready for conversion discussions.`,
      impact: 'high',
      companies: qualifiedProspects.slice(0, 10).map(c => c.id),
      companyNames: qualifiedProspects.slice(0, 10).map(c => c.name),
      category: 'growth',
      actionUrl: '/companies?stage=prospect',
    });
  }

  // Opportunity: Companies needing diagnostics refresh
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const needsRefresh = companies.filter(c => {
    if (!c.lastSnapshotAt) return false;
    const lastSnapshot = new Date(c.lastSnapshotAt);
    return lastSnapshot < sixtyDaysAgo && c.stage === 'client';
  });
  if (needsRefresh.length >= 2) {
    opportunities.push({
      id: 'diagnostics-refresh',
      title: 'Diagnostics Refresh Needed',
      description: `${needsRefresh.length} clients haven't had diagnostics in 60+ days. Great opportunity for re-engagement.`,
      impact: 'medium',
      companies: needsRefresh.slice(0, 10).map(c => c.id),
      companyNames: needsRefresh.slice(0, 10).map(c => c.name),
      category: 'engagement',
    });
  }

  // Opportunity: Work completion momentum
  if (metrics.workCompletionRate >= 70) {
    opportunities.push({
      id: 'work-momentum',
      title: 'Strong Work Completion Rate',
      description: `${metrics.workCompletionRate.toFixed(0)}% work completion rate shows strong execution. Consider increasing capacity.`,
      impact: 'medium',
      companies: [],
      companyNames: [],
      category: 'growth',
    });
  }

  // Sort by impact
  const impactOrder = { high: 0, medium: 1, low: 2 };
  opportunities.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]);

  return opportunities;
}

// ============================================================================
// Derive Clusters
// ============================================================================

function deriveClusters(companies: any[], fullReports: any[]): OSCluster[] {
  const clusters: OSCluster[] = [];

  // Cluster: Companies with low SEO scores
  const lowSeoCompanies = companies.filter(c => {
    // Check if they have a low SEO score from full reports
    const report = fullReports.find(r => r.companyId === c.id);
    return report?.scores?.seo && report.scores.seo < 50;
  });
  if (lowSeoCompanies.length >= 3) {
    clusters.push({
      id: 'low-seo-cluster',
      clusterName: 'SEO Improvement Needed',
      description: 'Companies with SEO scores below 50 that need focused attention.',
      companies: lowSeoCompanies.slice(0, 10).map(c => c.id),
      companyNames: lowSeoCompanies.slice(0, 10).map(c => c.name),
      symptom: 'Low SEO performance scores',
      suggestedAction: 'Run SEO Lab diagnostics and create improvement plans',
    });
  }

  // Cluster: Companies with low content scores
  const lowContentCompanies = companies.filter(c => {
    const report = fullReports.find(r => r.companyId === c.id);
    return report?.scores?.content && report.scores.content < 50;
  });
  if (lowContentCompanies.length >= 3) {
    clusters.push({
      id: 'low-content-cluster',
      clusterName: 'Content Strategy Gaps',
      description: 'Companies with content scores below 50 that need content strategy work.',
      companies: lowContentCompanies.slice(0, 10).map(c => c.id),
      companyNames: lowContentCompanies.slice(0, 10).map(c => c.name),
      symptom: 'Low content performance scores',
      suggestedAction: 'Run Content Lab diagnostics and develop content calendars',
    });
  }

  // Cluster: New companies needing onboarding
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const newCompanies = companies.filter(c => {
    const createdAt = c.createdAt ? new Date(c.createdAt) : null;
    return createdAt && createdAt >= thirtyDaysAgo && !c.fullReportId;
  });
  if (newCompanies.length >= 2) {
    clusters.push({
      id: 'new-onboarding-cluster',
      clusterName: 'New Companies Awaiting Onboarding',
      description: 'Recently added companies that need initial diagnostics and planning.',
      companies: newCompanies.slice(0, 10).map(c => c.id),
      companyNames: newCompanies.slice(0, 10).map(c => c.name),
      symptom: 'No diagnostics run yet',
      suggestedAction: 'Run GAP IA to establish baseline',
    });
  }

  return clusters;
}

// ============================================================================
// Generate Warnings
// ============================================================================

function generateWarnings(metrics: OSMetrics, risks: OSRisk[]): string[] {
  const warnings: string[] = [];

  if (metrics.diagnosticsCoverage < 30) {
    warnings.push(`${(100 - metrics.diagnosticsCoverage).toFixed(0)}% of companies have no diagnostics`);
  }

  if (metrics.plansCoverage < 20) {
    warnings.push('Low analytics adoption across workspace');
  }

  const noOwnerRisk = risks.find(r => r.id === 'no-owner-assigned');
  if (noOwnerRisk) {
    warnings.push(`${noOwnerRisk.count} companies without owner assigned`);
  }

  if (metrics.workOverdue >= 10) {
    warnings.push(`${metrics.workOverdue} overdue work items need attention`);
  }

  if (metrics.companiesInactiveOver30d >= 10) {
    warnings.push(`${metrics.companiesInactiveOver30d} companies inactive for 30+ days`);
  }

  return warnings;
}

// ============================================================================
// Compute Health Score
// ============================================================================

function computeHealthScore(metrics: OSMetrics): number {
  // Weights for different factors
  const weights = {
    diagnosticsCoverage: 0.25,
    atRiskRatio: 0.20,
    workThroughput: 0.20,
    engagementRate: 0.15,
    plansCoverage: 0.10,
    overdueWork: 0.10,
  };

  // Calculate component scores (0-100)
  const diagnosticsScore = metrics.diagnosticsCoverage;

  const atRiskRatio = metrics.totalCompanies > 0
    ? (1 - metrics.companiesAtRisk / metrics.totalCompanies) * 100
    : 100;

  const workScore = Math.min(100, metrics.workCompletionRate);

  const engagementScore = metrics.totalCompanies > 0
    ? (metrics.companiesActiveLastWeek / metrics.totalCompanies) * 100
    : 0;

  const plansScore = metrics.plansCoverage;

  const overdueScore = Math.max(0, 100 - metrics.workOverdue * 5);

  // Weighted average
  const healthScore =
    diagnosticsScore * weights.diagnosticsCoverage +
    atRiskRatio * weights.atRiskRatio +
    workScore * weights.workThroughput +
    engagementScore * weights.engagementRate +
    plansScore * weights.plansCoverage +
    overdueScore * weights.overdueWork;

  return Math.round(Math.max(0, Math.min(100, healthScore)));
}

// ============================================================================
// Generate System AI Analysis
// ============================================================================

export async function generateSystemAIAnalysis(input: {
  metrics: OSMetrics;
  risks: OSRisk[];
  opportunities: OSOpportunity[];
  clusters: OSCluster[];
}): Promise<SystemAIAnalysis> {
  const prompt = buildSystemAnalysisPrompt(input);

  try {
    // Call OpenAI
    const response = await fetch('/api/ai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error('AI analysis failed');
    }

    const data = await response.json();
    const parsed = JSON.parse(data.content);

    return {
      executiveSummary: parsed.executiveSummary || 'Unable to generate summary.',
      nextBestAction: parsed.nextBestAction || {
        title: 'Review at-risk companies',
        description: 'Check on companies flagged as at-risk to prevent churn.',
        priority: 'high',
      },
      systemRisks: parsed.systemRisks || [],
      systemOpportunities: parsed.systemOpportunities || [],
    };
  } catch (error) {
    console.error('[OSIntelligence] AI analysis error:', error);

    // Return fallback analysis based on data
    return generateFallbackAnalysis(input);
  }
}

function generateFallbackAnalysis(input: {
  metrics: OSMetrics;
  risks: OSRisk[];
  opportunities: OSOpportunity[];
}): SystemAIAnalysis {
  const { metrics, risks, opportunities } = input;

  const topRisk = risks[0];
  const topOpportunity = opportunities[0];

  return {
    executiveSummary: `Workspace health score is ${metrics.diagnosticsCoverage >= 50 ? 'healthy' : 'needs attention'}. ` +
      `${metrics.companiesAtRisk} companies are at risk. ` +
      `Work completion rate is ${metrics.workCompletionRate.toFixed(0)}%.`,
    nextBestAction: topRisk ? {
      title: `Address: ${topRisk.title}`,
      description: topRisk.description,
      priority: topRisk.severity === 'critical' ? 'critical' : 'high',
    } : {
      title: 'Review workspace metrics',
      description: 'Check overall workspace health and identify areas for improvement.',
      priority: 'medium',
    },
    systemRisks: risks.slice(0, 3).map(r => r.description),
    systemOpportunities: opportunities.slice(0, 3).map(o => o.description),
  };
}

// ============================================================================
// Daily Briefing
// ============================================================================

let dailyBriefingCache: {
  data: DailyBriefing | null;
  timestamp: number;
  ttlMs: number;
} = {
  data: null,
  timestamp: 0,
  ttlMs: 5 * 60 * 1000, // 5 minutes
};

export function invalidateDailyBriefingCache(): void {
  dailyBriefingCache.data = null;
  dailyBriefingCache.timestamp = 0;
  console.log('[OSIntelligence] Daily briefing cache invalidated');
}

import type {
  DailyBriefing,
  OvernightSummary,
  DailyFocusPlan,
  FocusItem,
  PriorityCompanyItem,
  DiagnosticReviewItem,
  YesterdayActivity,
  OwnerIssue,
} from './types';

export async function computeDailyBriefing(): Promise<DailyBriefing> {
  // Check cache
  const now = Date.now();
  if (dailyBriefingCache.data && now - dailyBriefingCache.timestamp < dailyBriefingCache.ttlMs) {
    console.log('[OSIntelligence] Returning cached daily briefing');
    return dailyBriefingCache.data;
  }

  console.log('[OSIntelligence] Computing fresh daily briefing...');

  try {
    // Fetch all data in parallel
    const [companies, workItems, fullReports] = await Promise.all([
      getCompaniesWithOsSummary().catch(() => []),
      getAllWorkItems().catch(() => []),
      getAllFullReports().catch(() => []),
    ]);

    // Generate overnight summary
    const overnightSummary = computeOvernightSummary(companies, workItems, fullReports);

    // Generate focus plan
    const focusPlan = computeFocusPlan(companies, workItems, fullReports);

    // Generate priority queue
    const priorityQueue = computePriorityQueue(companies, workItems);

    // Generate diagnostic review queue
    const diagnosticReviewQueue = computeDiagnosticReviewQueue(fullReports, companies);

    // Generate yesterday activity
    const yesterdayActivity = computeYesterdayActivity(workItems, fullReports);

    // Generate owner issues
    const ownerIssues = computeOwnerIssues(companies);

    const result: DailyBriefing = {
      generatedAt: new Date().toISOString(),
      overnightSummary,
      focusPlan,
      priorityQueue,
      diagnosticReviewQueue,
      yesterdayActivity,
      ownerIssues,
    };

    // Update cache
    dailyBriefingCache = {
      data: result,
      timestamp: now,
      ttlMs: 5 * 60 * 1000,
    };

    console.log('[OSIntelligence] Daily briefing computed:', {
      priorityQueue: priorityQueue.length,
      diagnosticReviewQueue: diagnosticReviewQueue.length,
      ownerIssues: ownerIssues.length,
    });

    return result;
  } catch (error) {
    console.error('[OSIntelligence] Error computing daily briefing:', error);
    throw error;
  }
}

function computeOvernightSummary(companies: any[], workItems: any[], fullReports: any[]): OvernightSummary {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Work completed overnight
  const workCompleted = workItems.filter(w => {
    if (w.status !== 'Done') return false;
    const updatedAt = w.updatedAt ? new Date(w.updatedAt) : null;
    return updatedAt && updatedAt >= yesterday;
  }).length;

  // Work created overnight
  const newWorkCreated = workItems.filter(w => {
    const createdAt = w.createdAt ? new Date(w.createdAt) : null;
    return createdAt && createdAt >= yesterday;
  }).length;

  // Diagnostics run overnight
  const diagnosticsRun = fullReports.filter(r => {
    const createdAt = r.createdAt ? new Date(r.createdAt) : null;
    return createdAt && createdAt >= yesterday;
  }).length;

  // At-risk changes
  const atRiskCompanies = companies.filter(c => c.health === 'at-risk' || c.health === 'critical');
  const atRiskChanges = atRiskCompanies.slice(0, 3).map(c => `${c.name} is at risk`);

  // Generate headline
  let headline = '';
  if (workCompleted > 0) {
    headline = `${workCompleted} work item${workCompleted > 1 ? 's' : ''} completed`;
  } else if (newWorkCreated > 0) {
    headline = `${newWorkCreated} new work item${newWorkCreated > 1 ? 's' : ''} created`;
  } else if (diagnosticsRun > 0) {
    headline = `${diagnosticsRun} diagnostic${diagnosticsRun > 1 ? 's' : ''} run`;
  } else {
    headline = 'Quiet night - no significant activity';
  }

  // Generate highlights
  const highlights: string[] = [];
  if (workCompleted > 0) highlights.push(`${workCompleted} tasks completed`);
  if (newWorkCreated > 0) highlights.push(`${newWorkCreated} new tasks created`);
  if (diagnosticsRun > 0) highlights.push(`${diagnosticsRun} diagnostics completed`);
  if (atRiskCompanies.length > 0) highlights.push(`${atRiskCompanies.length} companies at risk`);

  return {
    headline,
    highlights,
    newWorkCreated,
    workCompleted,
    diagnosticsRun,
    newOpportunities: 0, // TODO: Track opportunities
    ga4Shifts: [], // TODO: Integrate with GA4
    gscSignals: [], // TODO: Integrate with GSC
    atRiskChanges,
  };
}

function computeFocusPlan(companies: any[], workItems: any[], fullReports: any[]): DailyFocusPlan {
  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  // Key Actions: High priority work due today or overdue
  const keyActions: FocusItem[] = workItems
    .filter(w => {
      if (w.status === 'Done') return false;
      const dueDate = w.dueDate ? new Date(w.dueDate) : null;
      return dueDate && dueDate <= todayEnd;
    })
    .slice(0, 3)
    .map((w, idx) => ({
      id: `key-${idx}`,
      title: w.title || 'Untitled work item',
      description: `Due ${w.dueDate ? new Date(w.dueDate).toLocaleDateString() : 'today'}`,
      priority: 'high' as const,
      companyId: w.companyId,
      companyName: companies.find(c => c.id === w.companyId)?.name,
      linkType: 'work' as const,
      linkHref: w.companyId ? `/c/${w.companyId}?tab=work` : '/work',
    }));

  // Quick Wins: Simple tasks or recently started diagnostics
  const quickWins: FocusItem[] = workItems
    .filter(w => w.status === 'In Progress')
    .slice(0, 3)
    .map((w, idx) => ({
      id: `win-${idx}`,
      title: w.title || 'In progress task',
      description: 'Already in progress - push to completion',
      priority: 'medium' as const,
      companyId: w.companyId,
      companyName: companies.find(c => c.id === w.companyId)?.name,
      linkType: 'work' as const,
      linkHref: w.companyId ? `/c/${w.companyId}?tab=work` : '/work',
    }));

  // Risks: At-risk companies needing attention
  const atRiskCompanies = companies.filter(c => c.health === 'at-risk' || c.health === 'critical');
  const risks: FocusItem[] = atRiskCompanies.slice(0, 3).map((c, idx) => ({
    id: `risk-${idx}`,
    title: `Check on ${c.name}`,
    description: 'Company flagged as at-risk - review status',
    priority: 'high' as const,
    companyId: c.id,
    companyName: c.name,
    linkType: 'company' as const,
    linkHref: `/c/${c.id}`,
  }));

  // Outreach: Inactive companies needing follow-up
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const inactiveCompanies = companies.filter(c => {
    const lastActivity = c.updatedAt ? new Date(c.updatedAt) : null;
    return c.stage === 'client' && (!lastActivity || lastActivity < fourteenDaysAgo);
  });
  const outreachTasks: FocusItem[] = inactiveCompanies.slice(0, 3).map((c, idx) => ({
    id: `outreach-${idx}`,
    title: `Follow up with ${c.name}`,
    description: 'No activity in 14+ days - check in',
    priority: 'medium' as const,
    companyId: c.id,
    companyName: c.name,
    linkType: 'company' as const,
    linkHref: `/c/${c.id}`,
  }));

  return {
    keyActions,
    quickWins,
    risks,
    outreachTasks,
  };
}

function computePriorityQueue(companies: any[], workItems: any[]): PriorityCompanyItem[] {
  const now = new Date();

  return companies
    .filter(c => c.health === 'at-risk' || c.health === 'critical' || c.stage === 'client')
    .map(c => {
      const issues: string[] = [];
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
      let reason = '';

      // Check health status
      if (c.health === 'critical') {
        issues.push('Critical health status');
        severity = 'critical';
        reason = 'Critical health status requires immediate attention';
      } else if (c.health === 'at-risk') {
        issues.push('At-risk status');
        severity = 'high';
        reason = 'At-risk - needs review';
      }

      // Check overdue work
      const companyWork = workItems.filter(w => w.companyId === c.id && w.status !== 'Done');
      const overdueWork = companyWork.filter(w => {
        const dueDate = w.dueDate ? new Date(w.dueDate) : null;
        return dueDate && dueDate < now;
      });
      if (overdueWork.length > 0) {
        issues.push(`${overdueWork.length} overdue work items`);
        if (severity === 'low') severity = 'medium';
        if (!reason) reason = `${overdueWork.length} overdue work items`;
      }

      // Check no owner
      if (!c.owner && c.stage === 'client') {
        issues.push('No owner assigned');
        if (severity === 'low') severity = 'medium';
        if (!reason) reason = 'No owner assigned';
      }

      // Check inactivity
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const lastActivity = c.updatedAt ? new Date(c.updatedAt) : null;
      if (!lastActivity || lastActivity < thirtyDaysAgo) {
        issues.push('Inactive 30+ days');
        if (severity === 'low') severity = 'medium';
        if (!reason) reason = 'No activity in 30+ days';
      }

      return {
        companyId: c.id,
        companyName: c.name,
        reason: reason || 'Needs review',
        severity,
        lastActivity: c.updatedAt,
        issues,
      };
    })
    .filter(item => item.issues.length > 0)
    .sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    })
    .slice(0, 10);
}

function computeDiagnosticReviewQueue(fullReports: any[], companies: any[]): DiagnosticReviewItem[] {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  return fullReports
    .filter(r => {
      const createdAt = r.createdAt ? new Date(r.createdAt) : null;
      return createdAt && createdAt >= sevenDaysAgo;
    })
    .slice(0, 5)
    .map(r => {
      const company = companies.find(c => c.id === r.companyId);
      return {
        id: r.id,
        companyId: r.companyId || '',
        companyName: company?.name || r.companyName || 'Unknown',
        toolName: 'GAP IA',
        score: r.scores?.overall,
        createdAt: r.createdAt,
        status: 'Pending Review',
      };
    });
}

function computeYesterdayActivity(workItems: any[], fullReports: any[]): YesterdayActivity {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const dayBeforeYesterday = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const isYesterday = (dateStr: string) => {
    const date = new Date(dateStr);
    return date >= dayBeforeYesterday && date < yesterday;
  };

  return {
    workCreated: workItems.filter(w => w.createdAt && isYesterday(w.createdAt)).length,
    workCompleted: workItems.filter(w => w.status === 'Done' && w.updatedAt && isYesterday(w.updatedAt)).length,
    diagnosticsRun: fullReports.filter(r => r.createdAt && isYesterday(r.createdAt)).length,
    plansGenerated: fullReports.filter(r => r.planJson && r.createdAt && isYesterday(r.createdAt)).length,
    notesAdded: 0, // TODO: Track notes
    opportunitiesCreated: 0, // TODO: Track opportunities
  };
}

function computeOwnerIssues(companies: any[]): OwnerIssue[] {
  const issues: OwnerIssue[] = [];

  // No owner assigned
  companies
    .filter(c => !c.owner && (c.stage === 'client' || c.stage === 'prospect'))
    .slice(0, 5)
    .forEach(c => {
      issues.push({
        type: 'no_owner',
        companyId: c.id,
        companyName: c.name,
        description: 'No owner assigned to this company',
      });
    });

  // Stalled companies (no activity in 60+ days)
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  companies
    .filter(c => {
      const lastActivity = c.updatedAt ? new Date(c.updatedAt) : null;
      return c.stage === 'client' && (!lastActivity || lastActivity < sixtyDaysAgo);
    })
    .slice(0, 5)
    .forEach(c => {
      issues.push({
        type: 'stalled',
        companyId: c.id,
        companyName: c.name,
        description: 'No activity in 60+ days',
      });
    });

  return issues;
}

// ============================================================================
// Exports
// ============================================================================

export type { OSHealthSummary, OSMetrics, OSRisk, OSOpportunity, OSCluster, SystemAIAnalysis, DailyBriefing };
