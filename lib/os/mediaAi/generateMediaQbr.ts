// lib/os/mediaAi/generateMediaQbr.ts
// AI helper for generating Media QBR presentations
//
// Uses OpenAI to generate structured quarterly business reviews from media
// analytics data, campaign performance, and diagnostic findings.

import OpenAI from 'openai';
import { env } from '@/lib/env';
import type { MediaQbrInput, MediaQbrOutput } from '@/lib/types/mediaQbr';
import { getEmptyMediaQbrOutput } from '@/lib/types/mediaQbr';
import { formatCurrency, formatCompactNumber } from '@/lib/types/companyAnalytics';
import {
  getProgramHealthLabel,
  getMediaNetworkLabel,
  getCampaignStatusLabel,
} from '@/lib/types/mediaAnalytics';

// ============================================================================
// OpenAI Client (lazy initialization)
// ============================================================================

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
    }
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

// ============================================================================
// Prompts
// ============================================================================

const SYSTEM_PROMPT = `You are a senior marketing strategist at a performance marketing agency preparing a Quarterly Business Review (QBR) for a client's media program.

You receive structured data about a company's media performance including:
- Analytics snapshot (sessions, conversions, CPL, ROAS, trends)
- Media program summary (spend, leads, campaign counts, health status)
- Campaign-level performance data
- Diagnostic findings (issues and opportunities)
- Optional status narrative

Your job is to generate a professional QBR presentation as a JSON object with these exact fields:

- "executiveSummary": 2-3 paragraphs summarizing overall performance, key wins, concerns, and strategic direction. Executive-level tone.

- "performanceOverview": 2-3 paragraphs covering spend vs goals, lead generation, CPL trends, ROAS performance. Include specific numbers.

- "channelMix": 2 paragraphs analyzing channel distribution (Google vs Meta vs other), efficiency by channel, and recommendations for reallocation if needed.

- "keyTrends": Array of 4-6 bullet points describing important month-over-month or quarter-over-quarter trends. Be specific with numbers and percentages.

- "topCampaigns": Array of 3-5 bullet points highlighting the best performing campaigns with metrics.

- "underperformingCampaigns": Array of 2-4 bullet points identifying campaigns needing attention or optimization, with specific issues.

- "issuesAndOpportunities": Array of 4-6 bullet points derived from the diagnostic findings. Each should be actionable.

- "recommendedActions": Array of 5-8 numbered recommendations prioritized by impact. Be specific and actionable.

- "nextQuarterFocus": Array of 3-5 strategic focus areas for the upcoming quarter with rationale.

Guidelines:
- Write for a CMO-level audience: strategic, data-driven, actionable
- Reference specific numbers, percentages, and trends from the data provided
- If CPL is increasing, highlight it as a concern with recommendations
- If ROAS is improving, celebrate it but identify how to sustain
- Ground all recommendations in the actual data
- If data is limited, acknowledge it and focus on what's available
- Keep bullet points concise (<120 chars each) but substantive
- Use professional business language, no marketing fluff

Return ONLY valid JSON matching the requested schema. No markdown, no extra text, no code blocks.`;

// ============================================================================
// Main Function
// ============================================================================

/**
 * Generate a Media QBR using AI
 *
 * This function:
 * 1. Validates input data sufficiency
 * 2. Builds a comprehensive payload for the AI model
 * 3. Calls OpenAI with structured JSON output
 * 4. Parses and validates the response
 * 5. Generates the final slide-ready markdown
 *
 * @param input - Media QBR input data
 * @returns MediaQbrOutput with all sections and markdown
 */
export async function generateMediaQbr(input: MediaQbrInput): Promise<MediaQbrOutput> {
  const { companyId, companyName, analytics, mediaSummary, campaigns, findings, narrative } = input;

  console.log('[mediaAi/qbr] Generating Media QBR:', {
    companyId,
    companyName,
    hasAnalytics: analytics.hasAnalytics,
    hasMediaProgram: mediaSummary.hasMediaProgram,
    campaignCount: campaigns.length,
    findingsCount: findings.length,
  });

  // Validate: need at least media program or analytics
  if (!mediaSummary.hasMediaProgram) {
    console.log('[mediaAi/qbr] No media program, returning fallback');
    return getEmptyMediaQbrOutput(
      'This company does not have an active media program. QBR generation requires an active media program with performance data.'
    );
  }

  // Check for minimum viable data
  const hasMediaKpis = mediaSummary.primaryKpis?.mediaSpend !== undefined;
  const hasAnalyticsData = analytics.hasAnalytics;

  if (!hasMediaKpis && !hasAnalyticsData && campaigns.length === 0) {
    console.log('[mediaAi/qbr] Insufficient data for QBR');
    return getEmptyMediaQbrOutput(
      'Insufficient data for QBR generation. Please ensure media spend, campaigns, or analytics data is available.'
    );
  }

  try {
    // Build compact payload for AI
    const userPayload = buildUserPayload(input);

    const openai = getOpenAI();
    const startTime = Date.now();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(userPayload) },
      ],
      temperature: 0.4, // Slightly higher for more creative writing
      response_format: { type: 'json_object' },
      max_tokens: 4000,
    });

    const elapsed = Date.now() - startTime;
    console.log('[mediaAi/qbr] OpenAI response received:', { elapsed, companyId });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      console.error('[mediaAi/qbr] No content from OpenAI');
      return getEmptyMediaQbrOutput('AI generation failed. Please try again.');
    }

    // Parse response
    const parsed = JSON.parse(content) as Record<string, unknown>;

    // Extract and validate fields
    const qbrData = {
      executiveSummary: extractString(parsed.executiveSummary, ''),
      performanceOverview: extractString(parsed.performanceOverview, ''),
      channelMix: extractString(parsed.channelMix, ''),
      keyTrends: extractStringArray(parsed.keyTrends),
      topCampaigns: extractStringArray(parsed.topCampaigns),
      underperformingCampaigns: extractStringArray(parsed.underperformingCampaigns),
      issuesAndOpportunities: extractStringArray(parsed.issuesAndOpportunities),
      recommendedActions: extractStringArray(parsed.recommendedActions),
      nextQuarterFocus: extractStringArray(parsed.nextQuarterFocus),
    };

    // Generate slide-ready markdown
    const slideMarkdown = generateSlideMarkdown(companyName || 'Company', qbrData, input);

    const output: MediaQbrOutput = {
      ...qbrData,
      slideMarkdown,
      generatedAt: new Date().toISOString(),
      modelUsed: 'gpt-4o-mini',
    };

    console.log('[mediaAi/qbr] QBR generated successfully:', {
      companyId,
      executiveSummaryLength: output.executiveSummary.length,
      keyTrendsCount: output.keyTrends.length,
      recommendedActionsCount: output.recommendedActions.length,
      markdownLength: output.slideMarkdown.length,
    });

    return output;
  } catch (error) {
    console.error('[mediaAi/qbr] Error generating QBR:', error);
    return getEmptyMediaQbrOutput(
      `QBR generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build a compact payload for the AI model
 */
function buildUserPayload(input: MediaQbrInput): Record<string, unknown> {
  const { companyId, companyName, range, analytics, mediaSummary, campaigns, findings, narrative } =
    input;

  const payload: Record<string, unknown> = {
    companyId,
    companyName: companyName || 'Client',
    reportingPeriod: range === '28d' ? 'Last 28 Days' : 'Last 90 Days (Quarter)',
  };

  // Media program summary
  payload.mediaProgram = {
    hasMediaProgram: mediaSummary.hasMediaProgram,
    programHealth: mediaSummary.programHealth,
    programHealthLabel: getProgramHealthLabel(mediaSummary.programHealth),
    statusMessage: mediaSummary.programStatusMessage,
    activeCampaigns: mediaSummary.activeCampaignCount,
    markets: mediaSummary.marketCount,
    stores: mediaSummary.storeCount,
    totalBudget: mediaSummary.totalMonthlyBudget,
    primaryChannels: mediaSummary.primaryChannels,
  };

  // KPIs
  if (mediaSummary.primaryKpis) {
    payload.kpis = {
      spend: mediaSummary.primaryKpis.mediaSpend,
      installsOrLeads: mediaSummary.primaryKpis.installsOrLeads,
      calls: mediaSummary.primaryKpis.calls,
      cpl: mediaSummary.primaryKpis.cpl,
      roas: mediaSummary.primaryKpis.roas,
      impressions: mediaSummary.primaryKpis.impressions,
    };
  }

  // Analytics data
  if (analytics.hasAnalytics) {
    payload.analytics = {
      sessions: analytics.sessions,
      sessionsChange: analytics.sessionsChangePct,
      conversions: analytics.conversions,
      conversionsChange: analytics.conversionsChangePct,
      conversionRate: analytics.conversionRate,
      organicClicks: analytics.organicClicks,
      organicClicksChange: analytics.organicClicksChangePct,
      cpl: analytics.cpl,
      cplChange: analytics.cplChangePct,
      roas: analytics.roas,
      mediaSpend: analytics.mediaSpend,
      mediaSpendChange: analytics.mediaSpendChangePct,
      trend: analytics.trend,
      keyAlerts: analytics.keyAlerts,
    };
  }

  // Campaign performance (top 10 by spend)
  if (campaigns.length > 0) {
    const sortedCampaigns = [...campaigns]
      .sort((a, b) => (b.spend || 0) - (a.spend || 0))
      .slice(0, 10);

    payload.campaigns = sortedCampaigns.map((c) => ({
      name: c.name,
      network: c.network,
      networkLabel: getMediaNetworkLabel(c.network),
      status: c.status,
      statusLabel: getCampaignStatusLabel(c.status),
      market: c.market,
      spend: c.spend,
      impressions: c.impressions,
      clicks: c.clicks,
      conversions: c.conversions,
      calls: c.calls,
      cpl: c.cpl,
      roas: c.roas,
      ctr: c.ctr,
      conversionRate: c.conversionRate,
    }));
  }

  // Findings (issues & opportunities)
  if (findings.length > 0) {
    payload.findings = findings.slice(0, 10).map((f) => ({
      description: f.description,
      severity: f.severity,
      category: f.category,
      recommendation: f.recommendation,
      labSlug: f.labSlug,
    }));
  }

  // Narrative context (if available)
  if (narrative?.isAiGenerated) {
    payload.narrativeContext = {
      summary: narrative.summary,
      whatsWorking: narrative.whatsWorking,
      whatsNotWorking: narrative.whatsNotWorking,
      priorityFocus: narrative.priorityFocus,
    };
  }

  return payload;
}

/**
 * Generate slide-ready markdown from QBR data
 */
function generateSlideMarkdown(
  companyName: string,
  data: Omit<MediaQbrOutput, 'slideMarkdown' | 'generatedAt' | 'modelUsed'>,
  input: MediaQbrInput
): string {
  const lines: string[] = [];
  const date = new Date().toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  const period = input.range === '28d' ? 'Monthly' : 'Quarterly';

  // Title slide
  lines.push(`# MEDIA QBR — ${companyName}`);
  lines.push(`### ${period} Business Review | ${date}`);
  lines.push('');

  // Executive Summary
  lines.push('---');
  lines.push('');
  lines.push('## Executive Summary');
  lines.push('');
  lines.push(data.executiveSummary);
  lines.push('');

  // KPI Snapshot (if available)
  if (input.mediaSummary.primaryKpis) {
    const kpis = input.mediaSummary.primaryKpis;
    lines.push('---');
    lines.push('');
    lines.push('## KPI Snapshot');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    if (kpis.mediaSpend !== undefined) {
      lines.push(`| **Media Spend** | ${formatCurrency(kpis.mediaSpend)} |`);
    }
    if (kpis.installsOrLeads !== undefined) {
      lines.push(`| **Leads/Installs** | ${formatCompactNumber(kpis.installsOrLeads)} |`);
    }
    if (kpis.calls !== undefined) {
      lines.push(`| **Calls** | ${formatCompactNumber(kpis.calls)} |`);
    }
    if (kpis.cpl !== undefined) {
      lines.push(`| **CPL** | ${formatCurrency(kpis.cpl)} |`);
    }
    if (kpis.roas !== undefined) {
      lines.push(`| **ROAS** | ${kpis.roas.toFixed(1)}x |`);
    }
    lines.push('');
  }

  // Media Performance
  lines.push('---');
  lines.push('');
  lines.push('## Media Program Performance');
  lines.push('');
  lines.push(data.performanceOverview);
  lines.push('');

  // Channel Mix
  lines.push('---');
  lines.push('');
  lines.push('## Channel Mix');
  lines.push('');
  lines.push(data.channelMix);
  lines.push('');

  // Key Trends
  if (data.keyTrends.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## Key Trends');
    lines.push('');
    for (const trend of data.keyTrends) {
      lines.push(`- ${trend}`);
    }
    lines.push('');
  }

  // Top Performing Campaigns
  if (data.topCampaigns.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## Top Performing Campaigns');
    lines.push('');
    for (const campaign of data.topCampaigns) {
      lines.push(`- ${campaign}`);
    }
    lines.push('');
  }

  // Underperforming Campaigns
  if (data.underperformingCampaigns.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## Campaigns Needing Attention');
    lines.push('');
    for (const campaign of data.underperformingCampaigns) {
      lines.push(`- ${campaign}`);
    }
    lines.push('');
  }

  // Issues & Opportunities
  if (data.issuesAndOpportunities.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## Issues & Opportunities');
    lines.push('');
    for (const issue of data.issuesAndOpportunities) {
      lines.push(`- ${issue}`);
    }
    lines.push('');
  }

  // Recommended Actions
  if (data.recommendedActions.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## Recommended Actions');
    lines.push('');
    data.recommendedActions.forEach((action, index) => {
      lines.push(`${index + 1}. ${action}`);
    });
    lines.push('');
  }

  // Next Quarter Focus
  if (data.nextQuarterFocus.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## Next Quarter Strategic Focus');
    lines.push('');
    data.nextQuarterFocus.forEach((focus, index) => {
      lines.push(`${index + 1}. ${focus}`);
    });
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push('');
  lines.push(`*Generated by Hive OS Media Lab | ${new Date().toISOString()}*`);

  return lines.join('\n');
}

/**
 * Extract string from unknown value
 */
function extractString(value: unknown, fallback: string): string {
  if (typeof value === 'string') return value;
  return fallback;
}

/**
 * Extract string array from unknown value
 */
function extractStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string').slice(0, 10);
}
