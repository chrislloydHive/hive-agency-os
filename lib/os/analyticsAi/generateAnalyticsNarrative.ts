// lib/os/analyticsAi/generateAnalyticsNarrative.ts
// AI-generated narrative for Analytics Lab
//
// Creates executive summaries, opportunities, and risks
// from analytics snapshot data.

import OpenAI from 'openai';
import { env } from '@/lib/env';
import type { AnalyticsLabSnapshot, AnalyticsLabFinding, AnalyticsNarrative } from '@/lib/analytics/analyticsTypes';

// ============================================================================
// OpenAI Client (lazy initialization)
// ============================================================================

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

// ============================================================================
// Types
// ============================================================================

interface GenerateNarrativeInput {
  snapshot: AnalyticsLabSnapshot;
  findings?: AnalyticsLabFinding[];
}

// ============================================================================
// Prompts
// ============================================================================

const SYSTEM_PROMPT = `You are a marketing analytics expert for Hive OS.

You receive an analytics snapshot containing:
- Traffic metrics (sessions, conversions, conversion rate, channels)
- SEO metrics (organic clicks, impressions, CTR, top queries)
- GBP metrics (views, calls, directions)
- Media metrics (spend, CPA, ROAS)
- Period-over-period deltas

Your job is to create a concise, actionable narrative summary.

Return JSON with these exact fields:
- "executiveSummary": One compelling sentence (max 120 chars) summarizing the overall state
- "summary": 2-3 sentences providing context on performance
- "topOpportunities": Array of 2-4 bullet points (each <100 chars) describing growth opportunities
- "topRisks": Array of 2-4 bullet points (each <100 chars) describing risks or concerns

Guidelines:
- Be specific with numbers and percentages
- Focus on actionable insights, not just observations
- Prioritize the most significant changes (>15% swings)
- If no significant changes, note stability as a positive
- Write for a marketing manager audience
- Do NOT use jargon or overly technical language

Return ONLY valid JSON. No markdown, no extra text.`;

// ============================================================================
// Main Function
// ============================================================================

/**
 * Generate AI narrative for analytics snapshot
 */
export async function generateAnalyticsNarrative(
  input: GenerateNarrativeInput
): Promise<AnalyticsNarrative> {
  const { snapshot, findings = [] } = input;

  console.log('[generateAnalyticsNarrative] Generating narrative:', {
    companyId: snapshot.companyId,
    hasGa4: snapshot.hasGa4,
    hasGsc: snapshot.hasGsc,
    findingsCount: findings.length,
  });

  // Check if we have any meaningful data
  const hasData = snapshot.hasGa4 || snapshot.hasGsc || snapshot.hasMedia || snapshot.hasGbp;

  if (!hasData) {
    console.log('[generateAnalyticsNarrative] No data, returning fallback');
    return getFallbackNarrative('no_data');
  }

  try {
    const userPayload = buildUserPayload(snapshot, findings);
    const openai = getOpenAI();
    const startTime = Date.now();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(userPayload) },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
      max_tokens: 1000,
    });

    const elapsed = Date.now() - startTime;
    console.log('[generateAnalyticsNarrative] OpenAI response received:', { elapsed });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      console.error('[generateAnalyticsNarrative] No content from OpenAI');
      return getFallbackNarrative('error');
    }

    const parsed = JSON.parse(content);

    // Validate and normalize response
    const narrative: AnalyticsNarrative = {
      executiveSummary: typeof parsed.executiveSummary === 'string'
        ? parsed.executiveSummary.slice(0, 150)
        : 'Analytics data collected.',
      summary: typeof parsed.summary === 'string'
        ? parsed.summary
        : 'Review the metrics below for detailed insights.',
      topOpportunities: Array.isArray(parsed.topOpportunities)
        ? parsed.topOpportunities.slice(0, 4).map(String)
        : [],
      topRisks: Array.isArray(parsed.topRisks)
        ? parsed.topRisks.slice(0, 4).map(String)
        : [],
      updatedAt: new Date().toISOString(),
      isAiGenerated: true,
    };

    console.log('[generateAnalyticsNarrative] Narrative generated:', {
      summaryLength: narrative.summary.length,
      opportunities: narrative.topOpportunities.length,
      risks: narrative.topRisks.length,
    });

    return narrative;
  } catch (error) {
    console.error('[generateAnalyticsNarrative] Error:', error);
    return getFallbackNarrative('error');
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build compact payload for AI model
 */
function buildUserPayload(
  snapshot: AnalyticsLabSnapshot,
  findings: AnalyticsLabFinding[]
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    companyId: snapshot.companyId,
    range: snapshot.range,
  };

  // GA4 metrics
  if (snapshot.hasGa4 && snapshot.sourceGa4) {
    payload.traffic = {
      sessions: snapshot.sourceGa4.totalSessions,
      conversions: snapshot.sourceGa4.conversions,
      conversionRate: snapshot.sourceGa4.conversionRate,
      newUsers: snapshot.sourceGa4.newUsers,
      topChannels: Object.entries(snapshot.sourceGa4.channelBreakdown)
        .slice(0, 5)
        .map(([channel, sessions]) => ({ channel, sessions })),
      sessionsChangePct: snapshot.delta.sessionsMoM,
      conversionsChangePct: snapshot.delta.conversionsMoM,
    };
  }

  // GSC metrics
  if (snapshot.hasGsc && snapshot.sourceSearchConsole) {
    payload.seo = {
      clicks: snapshot.sourceSearchConsole.clicks,
      impressions: snapshot.sourceSearchConsole.impressions,
      ctr: snapshot.sourceSearchConsole.ctr,
      avgPosition: snapshot.sourceSearchConsole.avgPosition,
      topQueries: snapshot.sourceSearchConsole.topQueries.slice(0, 5),
      clicksChangePct: snapshot.delta.organicClicksMoM,
    };
  }

  // GBP metrics
  if (snapshot.hasGbp && snapshot.sourceGbp) {
    payload.gbp = {
      views: snapshot.sourceGbp.views,
      calls: snapshot.sourceGbp.calls,
      directions: snapshot.sourceGbp.directionRequests,
      websiteClicks: snapshot.sourceGbp.websiteClicks,
      actionsChangePct: snapshot.delta.gbpActionsMoM,
    };
  }

  // Media metrics
  if (snapshot.hasMedia && snapshot.sourcePaidMedia) {
    payload.media = {
      spend: snapshot.sourcePaidMedia.spend,
      conversions: snapshot.sourcePaidMedia.conversions,
      cpa: snapshot.sourcePaidMedia.cpa,
      roas: snapshot.sourcePaidMedia.roas,
      spendChangePct: snapshot.delta.spendMoM,
      cpaChangePct: snapshot.delta.cpaMoM,
    };
  }

  // Existing findings (top 5)
  if (findings.length > 0) {
    payload.existingFindings = findings.slice(0, 5).map((f) => ({
      severity: f.severity,
      title: f.title,
      labSlug: f.labSlug,
    }));
  }

  return payload;
}

/**
 * Get fallback narrative when AI is unavailable
 */
function getFallbackNarrative(
  reason: 'no_data' | 'error'
): AnalyticsNarrative {
  if (reason === 'no_data') {
    return {
      executiveSummary: 'No analytics data available yet.',
      summary: 'Connect GA4, Search Console, or other analytics sources to see performance insights. Once connected, we\'ll provide AI-powered analysis of your marketing performance.',
      topOpportunities: [
        'Connect Google Analytics 4 to track website traffic',
        'Connect Search Console for SEO insights',
        'Set up conversion tracking for ROI measurement',
      ],
      topRisks: [
        'No visibility into current performance',
        'Cannot identify optimization opportunities',
      ],
      updatedAt: new Date().toISOString(),
      isAiGenerated: false,
    };
  }

  return {
    executiveSummary: 'Analytics data collected.',
    summary: 'Review the metrics below for detailed performance insights. AI narrative temporarily unavailable.',
    topOpportunities: [],
    topRisks: [],
    updatedAt: new Date().toISOString(),
    isAiGenerated: false,
  };
}
