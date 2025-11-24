import { NextResponse } from 'next/server';
import type { DashboardSummary } from '@/lib/os/dashboardSummary';

/**
 * POST /api/os/dashboard/ai-briefing
 *
 * Generates an AI briefing based on dashboard summary data.
 * For now, this is a rule-based stub that can be enhanced with actual AI later.
 *
 * Body: { summary: DashboardSummary }
 * Response: { summary: string, bullets: string[] }
 */
export async function POST(request: Request) {
  try {
    const { summary } = (await request.json()) as { summary: DashboardSummary };

    if (!summary) {
      return NextResponse.json(
        { error: 'Missing summary in request body' },
        { status: 400 }
      );
    }

    // Generate briefing based on heuristics
    const briefing = generateBriefing(summary);

    return NextResponse.json(briefing);
  } catch (error) {
    console.error('[AI Briefing] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate briefing' },
      { status: 500 }
    );
  }
}

/**
 * Generate a briefing from dashboard summary using rule-based logic.
 * This can be replaced with actual AI (e.g., Claude) in the future.
 *
 * Structured to prioritize:
 * 1. At-risk clients (client health)
 * 2. DMA funnel health (lead generation)
 * 3. Growth Analytics insight (traffic/engagement)
 */
function generateBriefing(summary: DashboardSummary): {
  summary: string;
  bullets: string[];
} {
  const bullets: string[] = [];
  const insights: string[] = [];

  // ========== BULLET 1: Client Health (At-Risk) ==========
  if (summary.clientHealth.atRisk.length > 0) {
    const atRiskCount = summary.clientHealth.atRisk.length;
    const topAtRisk = summary.clientHealth.atRisk[0];
    if (atRiskCount === 1) {
      bullets.push(
        `**Client attention needed:** ${topAtRisk.name} is at risk (${topAtRisk.reason.toLowerCase()}). Reach out today.`
      );
    } else {
      bullets.push(
        `**${atRiskCount} clients at risk.** Top priority: ${topAtRisk.name} (${topAtRisk.reason.toLowerCase()}).`
      );
    }
    insights.push('at-risk clients');
  } else {
    bullets.push(
      `**Client health is strong.** No at-risk clients requiring immediate attention.`
    );
  }

  // ========== BULLET 2: DMA Funnel Health ==========
  if (summary.pipeline.newLeads30d > 0) {
    const avgPerWeek = Math.round(summary.pipeline.newLeads30d / 4);
    if (summary.pipeline.newLeads30d >= 10) {
      bullets.push(
        `**DMA funnel healthy:** ${summary.pipeline.newLeads30d} new leads in 30 days (~${avgPerWeek}/week). Pipeline is fed.`
      );
    } else {
      bullets.push(
        `**DMA funnel needs attention:** Only ${summary.pipeline.newLeads30d} new leads in 30 days. Consider optimizing the audit flow or running campaigns.`
      );
      insights.push('weak funnel');
    }
  } else {
    bullets.push(
      `**DMA funnel dry:** No new leads in 30 days. Prioritize running DMA campaigns or optimizing the audit experience.`
    );
    insights.push('weak funnel');
  }

  // ========== BULLET 3: Growth Analytics Insight ==========
  if (summary.growth.sessions30d && summary.growth.sessions30d > 0) {
    const sessionsPerDay = Math.round(summary.growth.sessions30d / 30);
    const searchClicks = summary.growth.searchClicks30d;

    if (sessionsPerDay >= 100) {
      if (searchClicks && searchClicks > 100) {
        bullets.push(
          `**Growth is solid:** ${summary.growth.sessions30d.toLocaleString()} sessions and ${searchClicks.toLocaleString()} search clicks in 30 days. Organic visibility is working.`
        );
      } else {
        bullets.push(
          `**Traffic healthy:** ${summary.growth.sessions30d.toLocaleString()} sessions (${sessionsPerDay}/day avg). Check Growth Analytics for channel breakdown.`
        );
      }
    } else if (sessionsPerDay >= 30) {
      bullets.push(
        `**Traffic moderate:** ${summary.growth.sessions30d.toLocaleString()} sessions in 30 days. Room to grow—review top pages in Growth Analytics.`
      );
      insights.push('moderate traffic');
    } else {
      bullets.push(
        `**Traffic low:** Only ${summary.growth.sessions30d.toLocaleString()} sessions in 30 days. SEO or content investment may be needed.`
      );
      insights.push('low traffic');
    }
  } else {
    bullets.push(
      `**Growth Analytics pending.** Connect GA4 to see traffic and engagement insights.`
    );
  }

  // ========== Additional context bullets ==========
  // Work items (if urgent)
  if (summary.work.overdue > 0) {
    bullets.push(
      `**Delivery alert:** ${summary.work.overdue} overdue work item${summary.work.overdue > 1 ? 's' : ''}. Clear the backlog to maintain client trust.`
    );
    insights.push('overdue work');
  } else if (summary.work.today > 0) {
    bullets.push(
      `**Due today:** ${summary.work.today} deliverable${summary.work.today > 1 ? 's' : ''} scheduled.`
    );
  }

  // Pipeline opportunity
  if (summary.pipeline.activeOpportunities > 0 && summary.pipeline.pipelineValue) {
    bullets.push(
      `**Pipeline snapshot:** ${summary.pipeline.activeOpportunities} active opportunit${summary.pipeline.activeOpportunities > 1 ? 'ies' : 'y'} worth ${formatCurrency(summary.pipeline.pipelineValue)}.`
    );
  }

  // New clients welcome
  if (summary.clientHealth.newClients.length > 0) {
    bullets.push(
      `**Welcome aboard:** ${summary.clientHealth.newClients.length} new client${summary.clientHealth.newClients.length > 1 ? 's' : ''} this week. Schedule kickoff calls.`
    );
  }

  // ========== Build summary ==========
  let summaryText = '';

  if (insights.includes('at-risk clients') && insights.includes('overdue work')) {
    summaryText = `Attention needed on client delivery. You have at-risk clients and overdue work—focus on relationship repair today.`;
  } else if (insights.includes('at-risk clients')) {
    summaryText = `Client health needs attention. Reach out to at-risk accounts before small issues become big ones.`;
  } else if (insights.includes('weak funnel')) {
    summaryText = `Lead generation is slow. Invest time in DMA campaigns or funnel optimization today.`;
  } else if (insights.includes('overdue work')) {
    summaryText = `Delivery backlog detected. Clear overdue items to maintain trust with your clients.`;
  } else if (insights.includes('low traffic')) {
    summaryText = `Traffic is below target. Review Growth Analytics and consider content or SEO investments.`;
  } else if (summary.work.today > 0) {
    summaryText = `Delivery day: ${summary.work.today} item${summary.work.today > 1 ? 's' : ''} due. Stay focused and execute.`;
  } else {
    summaryText = `Systems nominal. A good day for strategic work, business development, or process improvements.`;
  }

  return {
    summary: summaryText,
    bullets: bullets.slice(0, 5), // Max 5 bullets
  };
}

function formatCurrency(num: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}
