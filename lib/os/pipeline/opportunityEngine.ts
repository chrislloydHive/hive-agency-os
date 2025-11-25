// lib/os/pipeline/opportunityEngine.ts
// Opportunity Generation Engine
// Creates and manages opportunities from multiple data sources

import type {
  Company,
  CompanyId,
  Opportunity,
  OpportunityId,
  OpportunitySource,
  OpportunityArea,
  OpportunityStatus,
  OpportunityPriority,
  DiagnosticRun,
  WorkItem,
  WorkItemEffort,
  WorkItemImpact,
} from '@/lib/os/types';
import { getOSCompanies, getOSGrowthPlan } from '@/lib/os/mockData';
import { getWorkspaceAnalyticsLast30Days } from '@/lib/os/analytics/workspace';

// ============================================================================
// Configuration
// ============================================================================

const OPPORTUNITY_CONFIG = {
  // Time thresholds for generating opportunities
  noGapDays: 90, // No GAP run in N days triggers opportunity
  noActivePlanDays: 60, // No active plan in N days
  staleWorkDays: 30, // Work item stale after N days

  // Value estimation (in dollars)
  gapRunValue: 500,
  planRefreshValue: 2000,
  analyticsReviewValue: 1000,
  contentWorkValue: 1500,
  technicalWorkValue: 2500,
};

// ============================================================================
// ID Generator
// ============================================================================

function generateOpportunityId(): OpportunityId {
  return `opp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Opportunity Generators
// ============================================================================

interface OpportunityGeneratorContext {
  companies: Company[];
  diagnosticRuns?: DiagnosticRun[];
  workItems?: WorkItem[];
  analyticsAvailable?: boolean;
}

/**
 * Generate opportunities from companies that need GAP runs
 */
function generateGapRunOpportunities(ctx: OpportunityGeneratorContext): Opportunity[] {
  const opportunities: Opportunity[] = [];
  const now = new Date();
  const threshold = new Date(now.getTime() - OPPORTUNITY_CONFIG.noGapDays * 24 * 60 * 60 * 1000);

  for (const company of ctx.companies) {
    const lastSnapshotDate = company.lastSnapshotAt ? new Date(company.lastSnapshotAt) : null;
    const needsGap = !lastSnapshotDate || lastSnapshotDate < threshold;

    if (needsGap && company.status === 'active') {
      opportunities.push({
        id: generateOpportunityId(),
        companyId: company.id,
        companyName: company.name,
        title: `Run GAP analysis for ${company.name}`,
        description: lastSnapshotDate
          ? `Last analysis was ${Math.floor((now.getTime() - lastSnapshotDate.getTime()) / (24 * 60 * 60 * 1000))} days ago. Time for a refresh.`
          : `No GAP analysis on file. Run initial assessment.`,
        source: 'diagnostics',
        sourceDetail: 'Time-based trigger',
        area: 'Strategy',
        status: 'new',
        priority: lastSnapshotDate ? 'medium' : 'high',
        estimatedValue: OPPORTUNITY_CONFIG.gapRunValue,
        estimatedEffort: 'Low',
        estimatedImpact: 'Medium',
        createdAt: now.toISOString(),
      });
    }
  }

  return opportunities;
}

/**
 * Generate opportunities from companies with low scores
 */
function generateLowScoreOpportunities(ctx: OpportunityGeneratorContext): Opportunity[] {
  const opportunities: Opportunity[] = [];
  const now = new Date();

  for (const company of ctx.companies) {
    if (company.latestOverallScore && company.latestOverallScore < 60 && company.status === 'active') {
      const area: OpportunityArea = company.latestOverallScore < 40 ? 'Website UX' : 'Content';

      opportunities.push({
        id: generateOpportunityId(),
        companyId: company.id,
        companyName: company.name,
        title: `Improve ${company.name}'s digital presence`,
        description: `Score is ${company.latestOverallScore}/100. Significant opportunity for improvement.`,
        source: 'ai-suggested',
        sourceDetail: `Low score: ${company.latestOverallScore}`,
        area,
        status: 'new',
        priority: company.latestOverallScore < 40 ? 'critical' : 'high',
        estimatedValue: company.latestOverallScore < 40
          ? OPPORTUNITY_CONFIG.technicalWorkValue
          : OPPORTUNITY_CONFIG.contentWorkValue,
        estimatedEffort: company.latestOverallScore < 40 ? 'High' : 'Medium',
        estimatedImpact: 'High',
        createdAt: now.toISOString(),
      });
    }
  }

  return opportunities;
}

/**
 * Generate opportunities from prospects that could become clients
 */
function generateProspectOpportunities(ctx: OpportunityGeneratorContext): Opportunity[] {
  const opportunities: Opportunity[] = [];
  const now = new Date();

  for (const company of ctx.companies) {
    if (company.stage === 'Prospect' || company.stage === 'Lead') {
      const isProspect = company.stage === 'Prospect';

      opportunities.push({
        id: generateOpportunityId(),
        companyId: company.id,
        companyName: company.name,
        title: isProspect
          ? `Convert ${company.name} to client`
          : `Qualify ${company.name} as prospect`,
        description: isProspect
          ? `${company.name} is a qualified prospect. Schedule a proposal meeting.`
          : `${company.name} is a lead. Run initial assessment and discovery call.`,
        source: 'client-health',
        sourceDetail: `Stage: ${company.stage}`,
        area: 'Strategy',
        status: 'new',
        priority: isProspect ? 'high' : 'medium',
        estimatedValue: isProspect
          ? OPPORTUNITY_CONFIG.planRefreshValue * 3
          : OPPORTUNITY_CONFIG.gapRunValue,
        estimatedEffort: 'Medium',
        estimatedImpact: isProspect ? 'High' : 'Medium',
        createdAt: now.toISOString(),
      });
    }
  }

  return opportunities;
}

/**
 * Generate opportunities from analytics insights
 */
async function generateAnalyticsOpportunities(): Promise<Opportunity[]> {
  const opportunities: Opportunity[] = [];
  const now = new Date();

  try {
    const analytics = await getWorkspaceAnalyticsLast30Days();

    // Opportunities from anomalies
    for (const anomaly of analytics.anomalies) {
      if (anomaly.severity === 'high') {
        opportunities.push({
          id: generateOpportunityId(),
          title: `Address ${anomaly.metric} issue`,
          description: anomaly.description,
          source: 'analytics',
          sourceDetail: `Metric: ${anomaly.metric}`,
          area: anomaly.metric.includes('search') ? 'SEO' : 'Analytics',
          status: 'new',
          priority: 'high',
          estimatedValue: OPPORTUNITY_CONFIG.analyticsReviewValue,
          estimatedEffort: 'Medium',
          estimatedImpact: 'High',
          createdAt: now.toISOString(),
        });
      }
    }

    // Opportunities from insights
    for (const insight of analytics.insights.filter((i) => i.impact === 'high')) {
      // Map insight area to OpportunityArea
      let area: OpportunityArea = 'Strategy';
      if (insight.area === 'seo') area = 'SEO';
      else if (insight.area === 'content') area = 'Content';
      else if (insight.area === 'traffic') area = 'Analytics';
      else if (insight.area === 'conversion') area = 'Funnel';

      opportunities.push({
        id: generateOpportunityId(),
        title: insight.title,
        description: insight.description,
        source: 'ai-suggested',
        sourceDetail: `Area: ${insight.area}`,
        area,
        status: 'new',
        priority: 'medium',
        estimatedValue: OPPORTUNITY_CONFIG.contentWorkValue,
        estimatedEffort: 'Medium',
        estimatedImpact: 'High',
        metadata: {
          recommendation: insight.recommendation,
        },
        createdAt: now.toISOString(),
      });
    }
  } catch (error) {
    console.warn('[Opportunity Engine] Analytics fetch failed:', error);
  }

  return opportunities;
}

/**
 * Generate opportunities from growth plans
 */
async function generateGrowthPlanOpportunities(ctx: OpportunityGeneratorContext): Promise<Opportunity[]> {
  const opportunities: Opportunity[] = [];
  const now = new Date();

  for (const company of ctx.companies) {
    if (company.status !== 'active') continue;

    try {
      const plan = await getOSGrowthPlan(company.id);
      if (!plan || !plan.planSections || plan.planSections.length === 0) continue;

      // Create opportunities from top recommended actions in the first section
      const topSection = plan.planSections[0];
      const topActions = topSection.recommendedActions?.slice(0, 2) || [];

      for (const action of topActions) {
        opportunities.push({
          id: generateOpportunityId(),
          companyId: company.id,
          companyName: company.name,
          title: `${company.name}: ${action.length > 50 ? action.slice(0, 47) + '...' : action}`,
          description: action,
          source: 'expired-plan',
          sourceDetail: `Section: ${topSection.title}`,
          area: 'Strategy',
          status: 'new',
          priority: 'medium',
          estimatedValue: OPPORTUNITY_CONFIG.planRefreshValue,
          estimatedEffort: 'Medium',
          estimatedImpact: 'Medium',
          createdAt: now.toISOString(),
        });
      }
    } catch {
      // Ignore errors for individual companies
    }
  }

  return opportunities;
}

// ============================================================================
// Main Functions
// ============================================================================

export interface GenerateOpportunitiesOptions {
  includeAnalytics?: boolean;
  includeGrowthPlans?: boolean;
  companyFilter?: CompanyId[];
}

/**
 * Generate all opportunities from various sources
 */
export async function generateOpportunities(
  options: GenerateOpportunitiesOptions = {}
): Promise<Opportunity[]> {
  const { includeAnalytics = true, includeGrowthPlans = false, companyFilter } = options;

  console.log('[Opportunity Engine] Generating opportunities...', options);

  // Get companies
  let companies = await getOSCompanies();

  // Apply filter if provided
  if (companyFilter && companyFilter.length > 0) {
    companies = companies.filter((c) => companyFilter.includes(c.id));
  }

  const ctx: OpportunityGeneratorContext = {
    companies,
  };

  // Generate opportunities from different sources
  const allOpportunities: Opportunity[] = [
    ...generateGapRunOpportunities(ctx),
    ...generateLowScoreOpportunities(ctx),
    ...generateProspectOpportunities(ctx),
  ];

  // Optionally include analytics-based opportunities
  if (includeAnalytics) {
    const analyticsOpps = await generateAnalyticsOpportunities();
    allOpportunities.push(...analyticsOpps);
  }

  // Optionally include growth plan opportunities
  if (includeGrowthPlans) {
    const planOpps = await generateGrowthPlanOpportunities(ctx);
    allOpportunities.push(...planOpps);
  }

  // Deduplicate by similar titles for same company
  const seen = new Set<string>();
  const dedupedOpportunities = allOpportunities.filter((opp) => {
    const key = `${opp.companyId || 'workspace'}-${opp.title.toLowerCase().slice(0, 30)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by priority
  const priorityOrder: Record<OpportunityPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  dedupedOpportunities.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  console.log('[Opportunity Engine] Generated', dedupedOpportunities.length, 'opportunities');

  return dedupedOpportunities;
}

/**
 * Get opportunities for a specific company
 */
export async function getOpportunitiesForCompany(companyId: CompanyId): Promise<Opportunity[]> {
  const allOpportunities = await generateOpportunities({
    companyFilter: [companyId],
    includeAnalytics: false,
    includeGrowthPlans: true,
  });

  return allOpportunities.filter((opp) => opp.companyId === companyId);
}

/**
 * Get summary stats for opportunities
 */
export function getOpportunitySummary(opportunities: Opportunity[]): {
  total: number;
  byPriority: Record<OpportunityPriority, number>;
  byArea: Record<string, number>;
  bySource: Record<string, number>;
  estimatedTotalValue: number;
} {
  const byPriority: Record<OpportunityPriority, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  const byArea: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  let estimatedTotalValue = 0;

  for (const opp of opportunities) {
    byPriority[opp.priority]++;
    byArea[opp.area] = (byArea[opp.area] || 0) + 1;
    bySource[opp.source] = (bySource[opp.source] || 0) + 1;
    estimatedTotalValue += opp.estimatedValue || 0;
  }

  return {
    total: opportunities.length,
    byPriority,
    byArea,
    bySource,
    estimatedTotalValue,
  };
}
