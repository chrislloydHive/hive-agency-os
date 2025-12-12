// lib/os/reportsMvp.ts
// Report generation for MVP Monthly Report and QBR Lite
//
// Uses analytics, context, strategy, and work data to generate reports.

import { getOpenAI } from '@/lib/openai';
import type {
  MonthlyReport,
  QbrLiteReport,
  GenerateMonthlyReportRequest,
  GenerateQbrLiteRequest,
} from '@/lib/types/reports';
import { getPeriodLabel } from '@/lib/types/reports';
import type { AnalyticsSnapshotLite } from '@/lib/types/analyticsLite';
import { getAnalyticsSnapshotLite } from './analyticsLite';
import { getCompanyContext } from './context';
import { getActiveStrategy } from './strategy';
import { getWorkSummaryForCompany } from './work';

// ============================================================================
// Monthly Report Generation
// ============================================================================

/**
 * Generate a monthly report for a company
 */
export async function generateMonthlyReport(
  request: GenerateMonthlyReportRequest
): Promise<MonthlyReport> {
  const { companyId, month, year, period } = request;

  // Calculate period from month/year or use provided period
  let periodStart: string;
  let periodEnd: string;
  let periodLabel: string;

  if (period) {
    periodStart = period.start;
    periodEnd = period.end;
    periodLabel = getPeriodLabel(period.start, period.end, 'monthly');
  } else {
    // Calculate from month/year
    const now = new Date();
    const m = month ?? now.getMonth() + 1;
    const y = year ?? now.getFullYear();
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    periodStart = start.toISOString().split('T')[0];
    periodEnd = end.toISOString().split('T')[0];
    periodLabel = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  try {
    // Gather all required data in parallel
    const [analytics, context, strategy, workSummary] = await Promise.all([
      getAnalyticsSnapshotLite(companyId, 'last_28_days'),
      getCompanyContext(companyId),
      getActiveStrategy(companyId),
      getWorkSummaryForCompany(companyId),
    ]);

    // Generate AI content
    const aiContent = await generateMonthlyReportContent({
      analytics,
      context,
      strategy,
      workSummary,
      periodLabel,
    });

    const completedTasks = workSummary.tasksByStatus.complete;

    return {
      companyId,
      periodLabel,
      periodStart,
      periodEnd,
      executiveSummary: aiContent.executiveSummary,
      summary: aiContent.executiveSummary, // Alias for UI compatibility
      analyticsNarrative: aiContent.analyticsNarrative,
      kpis: analytics,
      topInsights: aiContent.topInsights,
      highlights: aiContent.topInsights, // Alias for UI compatibility
      topRisks: aiContent.topRisks,
      concerns: aiContent.topRisks, // Alias for UI compatibility
      recommendedNextSteps: aiContent.recommendedNextSteps,
      workSummary: {
        completedTasks,
        totalTasks: workSummary.totalTasks,
        completed: completedTasks, // Alias for UI compatibility
        inProgress: workSummary.tasksByStatus.in_progress,
        planned: workSummary.tasksByStatus.not_started,
        highlights: workSummary.recentlyCompleted.map(t => t.title).slice(0, 3),
        keyDeliverables: workSummary.recentlyCompleted.map(t => t.title).slice(0, 5),
      },
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[generateMonthlyReport] Error:', error);
    throw new Error(`Failed to generate monthly report: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

interface MonthlyReportInput {
  analytics: AnalyticsSnapshotLite;
  context: Awaited<ReturnType<typeof getCompanyContext>>;
  strategy: Awaited<ReturnType<typeof getActiveStrategy>>;
  workSummary: Awaited<ReturnType<typeof getWorkSummaryForCompany>>;
  periodLabel: string;
}

interface MonthlyReportContent {
  executiveSummary: string;
  analyticsNarrative: string;
  topInsights: string[];
  topRisks: string[];
  recommendedNextSteps: string[];
}

/**
 * Generate AI content for monthly report
 */
async function generateMonthlyReportContent(input: MonthlyReportInput): Promise<MonthlyReportContent> {
  try {
    const openai = getOpenAI();

    const prompt = buildMonthlyReportPrompt(input);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a senior marketing strategist generating a monthly report.
Be concise, data-driven, and actionable. Focus on what matters most.
Return your response in the exact JSON format specified.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return {
      executiveSummary: parsed.executiveSummary || 'Report generation in progress.',
      analyticsNarrative: parsed.analyticsNarrative || 'Analytics data being processed.',
      topInsights: parsed.topInsights || [],
      topRisks: parsed.topRisks || [],
      recommendedNextSteps: parsed.recommendedNextSteps || [],
    };
  } catch (error) {
    console.error('[generateMonthlyReportContent] Error:', error);

    // Return fallback content
    return {
      executiveSummary: 'Unable to generate executive summary. Please review analytics data manually.',
      analyticsNarrative: 'Analytics narrative generation failed.',
      topInsights: ['Review analytics dashboard for insights'],
      topRisks: ['Ensure data tracking is configured correctly'],
      recommendedNextSteps: ['Review this report with team', 'Identify quick wins'],
    };
  }
}

function buildMonthlyReportPrompt(input: MonthlyReportInput): string {
  const { analytics, context, strategy, workSummary, periodLabel } = input;

  const analyticsSection = analytics.dataCompleteness > 0
    ? `
Analytics (${analytics.timeframe}):
- Sessions: ${analytics.sessions?.toLocaleString() ?? 'N/A'} (${formatChange(analytics.sessionsChangePct)})
- Conversions: ${analytics.conversions ?? 'N/A'} (${formatChange(analytics.conversionsChangePct)})
- Organic Clicks: ${analytics.organicClicks?.toLocaleString() ?? 'N/A'} (${formatChange(analytics.organicClicksChangePct)})
- Media Spend: $${analytics.spend?.toLocaleString() ?? 'N/A'} (${formatChange(analytics.spendChangePct)})
- ROAS: ${analytics.roas?.toFixed(2) ?? 'N/A'}x (${formatChange(analytics.roasChangePct)})
`
    : 'Analytics: No data available for this period.';

  const strategySection = strategy
    ? `
Active Strategy: ${strategy.title}
Pillars: ${strategy.pillars.map(p => p.title).join(', ')}
`
    : 'Strategy: No active strategy defined.';

  const workSection = `
Work Progress:
- Completed tasks: ${workSummary.tasksByStatus.complete} of ${workSummary.totalTasks}
- In progress: ${workSummary.tasksByStatus.in_progress}
- Overall progress: ${workSummary.overallProgress}%
`;

  return `
Generate a monthly marketing report for ${periodLabel}.

${analyticsSection}

${strategySection}

${workSection}

Context:
- Business: ${context?.businessModel || 'Not specified'}
- Audience: ${context?.primaryAudience || 'Not specified'}
- Objectives: ${context?.objectives?.join(', ') || 'Not specified'}

Return a JSON object with these exact fields:
{
  "executiveSummary": "2-3 sentence executive summary of the month",
  "analyticsNarrative": "2-3 sentences analyzing the performance data",
  "topInsights": ["insight 1", "insight 2", "insight 3"],
  "topRisks": ["risk 1", "risk 2"],
  "recommendedNextSteps": ["step 1", "step 2", "step 3"]
}
`.trim();
}

// ============================================================================
// QBR Lite Generation
// ============================================================================

/**
 * Generate a QBR Lite report for a company
 */
export async function generateQbrLiteReport(
  request: GenerateQbrLiteRequest
): Promise<QbrLiteReport> {
  const { companyId, quarter, year, period, quarterLabel } = request;

  // Calculate period from quarter/year or use provided period
  let periodStart: string;
  let periodEnd: string;
  let periodLabelCalc: string;

  if (period) {
    periodStart = period.start;
    periodEnd = period.end;
    periodLabelCalc = quarterLabel || getPeriodLabel(period.start, period.end, 'quarterly');
  } else {
    // Calculate from quarter/year
    const now = new Date();
    const q = quarter ?? Math.ceil((now.getMonth() + 1) / 3);
    const y = year ?? now.getFullYear();
    const start = new Date(y, (q - 1) * 3, 1);
    const end = new Date(y, q * 3, 0);
    periodStart = start.toISOString().split('T')[0];
    periodEnd = end.toISOString().split('T')[0];
    periodLabelCalc = quarterLabel || `Q${q} ${y}`;
  }

  try {
    // Gather all required data
    const [analytics, context, strategy, workSummary] = await Promise.all([
      getAnalyticsSnapshotLite(companyId, 'last_90_days'),
      getCompanyContext(companyId),
      getActiveStrategy(companyId),
      getWorkSummaryForCompany(companyId),
    ]);

    // Generate AI content
    const aiContent = await generateQbrLiteContent({
      analytics,
      context,
      strategy,
      workSummary,
      periodLabel: periodLabelCalc,
    });

    // Calculate overall score (simple heuristic based on available data)
    const overallScore = calculateQbrScore(analytics, workSummary);

    return {
      companyId,
      periodLabel: periodLabelCalc,
      periodStart,
      periodEnd,
      executiveSummary: aiContent.executiveSummary,
      summary: aiContent.executiveSummary, // Alias for UI compatibility
      kpiSummary: analytics,
      overallScore,
      scoreBreakdown: [
        { area: 'Analytics', score: analytics.dataCompleteness, notes: `${analytics.dataSources.length} data sources` },
        { area: 'Work Progress', score: workSummary.overallProgress, notes: `${workSummary.tasksByStatus.complete} tasks completed` },
        { area: 'Strategy Execution', score: strategy ? 70 : 30, notes: strategy ? 'Active strategy' : 'No active strategy' },
      ],
      strategyReview: aiContent.strategyReview,
      keyLearnings: aiContent.keyLearnings,
      wins: aiContent.keyLearnings.slice(0, 2), // Use learnings as wins for now
      challenges: aiContent.keyLearnings.slice(2, 4).map(l => `Challenge: ${l}`),
      opportunities: [aiContent.nextQuarterStrategySummary],
      recommendations: aiContent.keyLearnings.slice(0, 3).map((l, i) => ({
        text: l,
        priority: i === 0 ? 'high' as const : i === 1 ? 'medium' as const : 'low' as const,
      })),
      nextQuarterStrategySummary: aiContent.nextQuarterStrategySummary,
      ninetyDayPlanSummary: aiContent.ninetyDayPlanSummary,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[generateQbrLiteReport] Error:', error);
    throw new Error(`Failed to generate QBR Lite: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function calculateQbrScore(
  analytics: AnalyticsSnapshotLite,
  workSummary: Awaited<ReturnType<typeof getWorkSummaryForCompany>>
): number {
  // Simple weighted average
  const analyticsWeight = 0.4;
  const workWeight = 0.6;

  const analyticsScore = analytics.dataCompleteness;
  const workScore = workSummary.overallProgress;

  return Math.round(analyticsScore * analyticsWeight + workScore * workWeight);
}

interface QbrLiteInput {
  analytics: AnalyticsSnapshotLite;
  context: Awaited<ReturnType<typeof getCompanyContext>>;
  strategy: Awaited<ReturnType<typeof getActiveStrategy>>;
  workSummary: Awaited<ReturnType<typeof getWorkSummaryForCompany>>;
  periodLabel: string;
}

interface QbrLiteContent {
  executiveSummary: string;
  strategyReview: string;
  keyLearnings: string[];
  nextQuarterStrategySummary: string;
  ninetyDayPlanSummary: string;
}

/**
 * Generate AI content for QBR Lite
 */
async function generateQbrLiteContent(input: QbrLiteInput): Promise<QbrLiteContent> {
  try {
    const openai = getOpenAI();

    const prompt = buildQbrLitePrompt(input);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a senior marketing strategist generating a Quarterly Business Review.
Be strategic, forward-looking, and actionable. Focus on learnings and next steps.
Return your response in the exact JSON format specified.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return {
      executiveSummary: parsed.executiveSummary || 'QBR generation in progress.',
      strategyReview: parsed.strategyReview || 'Strategy review pending.',
      keyLearnings: parsed.keyLearnings || [],
      nextQuarterStrategySummary: parsed.nextQuarterStrategySummary || 'Next quarter planning in progress.',
      ninetyDayPlanSummary: parsed.ninetyDayPlanSummary || '90-day plan being developed.',
    };
  } catch (error) {
    console.error('[generateQbrLiteContent] Error:', error);

    return {
      executiveSummary: 'Unable to generate QBR summary.',
      strategyReview: 'Strategy review requires manual input.',
      keyLearnings: ['Review quarter performance manually'],
      nextQuarterStrategySummary: 'Define next quarter strategy.',
      ninetyDayPlanSummary: 'Develop 90-day execution plan.',
    };
  }
}

function buildQbrLitePrompt(input: QbrLiteInput): string {
  const { analytics, context, strategy, workSummary, periodLabel } = input;

  return `
Generate a Quarterly Business Review for ${periodLabel}.

Performance Overview:
- Sessions: ${analytics.sessions?.toLocaleString() ?? 'N/A'} (${formatChange(analytics.sessionsChangePct)})
- Conversions: ${analytics.conversions ?? 'N/A'} (${formatChange(analytics.conversionsChangePct)})
- Organic Clicks: ${analytics.organicClicks?.toLocaleString() ?? 'N/A'}
- Media Spend: $${analytics.spend?.toLocaleString() ?? 'N/A'}
- ROAS: ${analytics.roas?.toFixed(2) ?? 'N/A'}x

Strategy: ${strategy?.title || 'No active strategy'}
Pillars: ${strategy?.pillars.map(p => `${p.title} (${p.priority})`).join(', ') || 'None defined'}

Work Completed: ${workSummary.tasksByStatus.complete} of ${workSummary.totalTasks} tasks (${workSummary.overallProgress}%)

Business Context:
- Model: ${context?.businessModel || 'Not specified'}
- Audience: ${context?.primaryAudience || 'Not specified'}
- Objectives: ${context?.objectives?.join(', ') || 'Not specified'}

Return a JSON object:
{
  "executiveSummary": "3-4 sentence strategic summary of the quarter",
  "strategyReview": "2-3 paragraphs reviewing what was planned vs what happened",
  "keyLearnings": ["learning 1", "learning 2", "learning 3", "learning 4"],
  "nextQuarterStrategySummary": "2-3 sentences on strategic focus for next quarter",
  "ninetyDayPlanSummary": "2-3 sentences on the 90-day execution priorities"
}
`.trim();
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatChange(pct?: number): string {
  if (pct === undefined) return 'N/A';
  return `${pct >= 0 ? '+' : ''}${pct}%`;
}
