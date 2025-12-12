// lib/os/analyticsLite.ts
// Analytics Lite for MVP
//
// Provides lightweight analytics snapshots by aggregating data from
// existing analytics sources (GA4, GSC, Media).

import type {
  AnalyticsSnapshotLite,
  AnalyticsTimeframe,
  AnalyticsNarrative,
} from '@/lib/types/analyticsLite';

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Get analytics snapshot lite for a company
 * Aggregates data from GA4, GSC, and Media sources
 */
export async function getAnalyticsSnapshotLite(
  companyId: string,
  timeframe: AnalyticsTimeframe = 'last_28_days'
): Promise<AnalyticsSnapshotLite> {
  const now = new Date();
  const days = timeframeToDays(timeframe);
  const periodEnd = now.toISOString().split('T')[0];
  const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  try {
    // Try to get data from existing analytics infrastructure
    const [ga4Data, gscData, mediaData] = await Promise.all([
      fetchGa4DataLite(companyId, timeframe).catch(() => null),
      fetchGscDataLite(companyId, timeframe).catch(() => null),
      fetchMediaDataLite(companyId, timeframe).catch(() => null),
    ]);

    const dataSources: AnalyticsSnapshotLite['dataSources'] = [];
    if (ga4Data) dataSources.push('ga4');
    if (gscData) dataSources.push('gsc');
    if (mediaData) dataSources.push('media');

    // Calculate data completeness
    const dataCompleteness = calculateDataCompleteness(ga4Data, gscData, mediaData);

    return {
      companyId,
      timeframe,
      // GA4 metrics
      sessions: ga4Data?.sessions,
      sessionsChangePct: ga4Data?.sessionsChangePct,
      users: ga4Data?.users,
      usersChangePct: ga4Data?.usersChangePct,
      conversions: ga4Data?.conversions,
      conversionsChangePct: ga4Data?.conversionsChangePct,
      conversionRate: ga4Data?.conversionRate,
      // GSC metrics
      organicClicks: gscData?.clicks,
      organicClicksChangePct: gscData?.clicksChangePct,
      organicImpressions: gscData?.impressions,
      organicImpressionsChangePct: gscData?.impressionsChangePct,
      avgPosition: gscData?.avgPosition,
      // Media metrics
      spend: mediaData?.spend,
      spendChangePct: mediaData?.spendChangePct,
      roas: mediaData?.roas,
      roasChangePct: mediaData?.roasChangePct,
      cpa: mediaData?.cpa,
      cpaChangePct: mediaData?.cpaChangePct,
      // Meta
      dataCompleteness,
      dataSources,
      generatedAt: new Date().toISOString(),
      periodStart,
      periodEnd,
    };
  } catch (error) {
    console.error('[getAnalyticsSnapshotLite] Error:', error);

    // Return empty snapshot on error
    return {
      companyId,
      timeframe,
      dataCompleteness: 0,
      dataSources: [],
      generatedAt: new Date().toISOString(),
      periodStart,
      periodEnd,
    };
  }
}

// ============================================================================
// Data Source Fetchers
// ============================================================================

interface Ga4DataLite {
  sessions?: number;
  sessionsChangePct?: number;
  users?: number;
  usersChangePct?: number;
  conversions?: number;
  conversionsChangePct?: number;
  conversionRate?: number;
}

/**
 * Fetch GA4 data
 * TODO: Integrate with existing GA4 client
 */
async function fetchGa4DataLite(
  companyId: string,
  timeframe: AnalyticsTimeframe
): Promise<Ga4DataLite | null> {
  try {
    // Try to use existing analytics infrastructure
    const { getAnalyticsSnapshot } = await import('@/lib/analytics/getAnalyticsSnapshot');

    const range = timeframeToRange(timeframe);
    const result = await getAnalyticsSnapshot({
      companyId,
      range,
      includeTrends: false,
    });

    if (!result.snapshot.hasGa4 || !result.snapshot.sourceGa4) {
      return null;
    }

    const ga4 = result.snapshot.sourceGa4;
    const delta = result.snapshot.delta;

    return {
      sessions: ga4.totalSessions,
      sessionsChangePct: delta.sessionsMoM ?? undefined,
      users: ga4.newUsers + ga4.returningUsers,
      conversions: ga4.conversions,
      conversionsChangePct: delta.conversionsMoM ?? undefined,
      conversionRate: ga4.conversionRate,
    };
  } catch (error) {
    console.log('[fetchGa4DataLite] GA4 not available:', error);
    return null;
  }
}

interface GscDataLite {
  clicks?: number;
  clicksChangePct?: number;
  impressions?: number;
  impressionsChangePct?: number;
  avgPosition?: number;
}

/**
 * Fetch GSC data
 * TODO: Integrate with existing GSC client
 */
async function fetchGscDataLite(
  companyId: string,
  timeframe: AnalyticsTimeframe
): Promise<GscDataLite | null> {
  try {
    const { getAnalyticsSnapshot } = await import('@/lib/analytics/getAnalyticsSnapshot');

    const range = timeframeToRange(timeframe);
    const result = await getAnalyticsSnapshot({
      companyId,
      range,
      includeTrends: false,
    });

    if (!result.snapshot.hasGsc || !result.snapshot.sourceSearchConsole) {
      return null;
    }

    const gsc = result.snapshot.sourceSearchConsole;
    const delta = result.snapshot.delta;

    return {
      clicks: gsc.clicks,
      clicksChangePct: delta.organicClicksMoM ?? undefined,
      impressions: gsc.impressions,
      avgPosition: gsc.avgPosition,
    };
  } catch (error) {
    console.log('[fetchGscDataLite] GSC not available:', error);
    return null;
  }
}

interface MediaDataLite {
  spend?: number;
  spendChangePct?: number;
  roas?: number;
  roasChangePct?: number;
  cpa?: number;
  cpaChangePct?: number;
}

/**
 * Fetch Media data
 * TODO: Integrate with existing media program helpers
 */
async function fetchMediaDataLite(
  companyId: string,
  timeframe: AnalyticsTimeframe
): Promise<MediaDataLite | null> {
  try {
    const { getAnalyticsSnapshot } = await import('@/lib/analytics/getAnalyticsSnapshot');

    const range = timeframeToRange(timeframe);
    const result = await getAnalyticsSnapshot({
      companyId,
      range,
      includeTrends: false,
    });

    if (!result.snapshot.hasMedia || !result.snapshot.sourcePaidMedia) {
      return null;
    }

    const media = result.snapshot.sourcePaidMedia;
    const delta = result.snapshot.delta;

    return {
      spend: media.spend,
      spendChangePct: delta.spendMoM ?? undefined,
      roas: media.roas,
      roasChangePct: delta.roasMoM ?? undefined,
      cpa: media.cpa,
      cpaChangePct: delta.cpaMoM ?? undefined,
    };
  } catch (error) {
    console.log('[fetchMediaDataLite] Media not available:', error);
    return null;
  }
}

// ============================================================================
// AI Narrative Generation
// ============================================================================

/**
 * Generate AI narrative for analytics snapshot
 */
export async function generateAnalyticsNarrative(
  companyId: string,
  snapshot: AnalyticsSnapshotLite
): Promise<AnalyticsNarrative> {
  // companyId reserved for future company-specific customization
  void companyId;
  try {
    const { getOpenAI } = await import('@/lib/openai');
    const openai = getOpenAI();

    const prompt = buildNarrativePrompt(snapshot);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a marketing analyst providing concise analytics summaries. Be direct and actionable.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || '';
    const lines = content.split('\n').filter(l => l.trim());

    return {
      summary: lines[0] || 'Analytics data unavailable.',
      topInsight: lines[1],
      topRisk: lines[2],
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[generateAnalyticsNarrative] Error:', error);

    // Return fallback narrative
    return {
      summary: snapshot.dataCompleteness > 0
        ? 'Analytics data available but narrative generation failed.'
        : 'No analytics data available for this period.',
      generatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Build prompt for narrative generation
 */
function buildNarrativePrompt(snapshot: AnalyticsSnapshotLite): string {
  const metrics: string[] = [];

  if (snapshot.sessions !== undefined) {
    metrics.push(`Sessions: ${snapshot.sessions.toLocaleString()}${snapshot.sessionsChangePct !== undefined ? ` (${snapshot.sessionsChangePct > 0 ? '+' : ''}${snapshot.sessionsChangePct}% vs prev)` : ''}`);
  }

  if (snapshot.conversions !== undefined) {
    metrics.push(`Conversions: ${snapshot.conversions}${snapshot.conversionsChangePct !== undefined ? ` (${snapshot.conversionsChangePct > 0 ? '+' : ''}${snapshot.conversionsChangePct}%)` : ''}`);
  }

  if (snapshot.organicClicks !== undefined) {
    metrics.push(`Organic Clicks: ${snapshot.organicClicks.toLocaleString()}${snapshot.organicClicksChangePct !== undefined ? ` (${snapshot.organicClicksChangePct > 0 ? '+' : ''}${snapshot.organicClicksChangePct}%)` : ''}`);
  }

  if (snapshot.spend !== undefined) {
    metrics.push(`Media Spend: $${snapshot.spend.toLocaleString()}${snapshot.spendChangePct !== undefined ? ` (${snapshot.spendChangePct > 0 ? '+' : ''}${snapshot.spendChangePct}%)` : ''}`);
  }

  if (snapshot.roas !== undefined) {
    metrics.push(`ROAS: ${snapshot.roas.toFixed(2)}x${snapshot.roasChangePct !== undefined ? ` (${snapshot.roasChangePct > 0 ? '+' : ''}${snapshot.roasChangePct}%)` : ''}`);
  }

  if (metrics.length === 0) {
    return 'No analytics data available. Provide a brief note about the lack of data.';
  }

  return `
Analyze these marketing metrics for ${snapshot.timeframe.replace('_', ' ')}:

${metrics.join('\n')}

Provide exactly 3 lines:
1. A 2-3 sentence executive summary of overall performance
2. The top positive insight or opportunity (start with "Top Insight:")
3. The top concern or risk (start with "Top Risk:")
`.trim();
}

// ============================================================================
// Helper Functions
// ============================================================================

function timeframeToDays(timeframe: AnalyticsTimeframe): number {
  switch (timeframe) {
    case 'last_7_days':
      return 7;
    case 'last_28_days':
      return 28;
    case 'last_90_days':
      return 90;
    default:
      return 28;
  }
}

function timeframeToRange(timeframe: AnalyticsTimeframe): '7d' | '28d' | '90d' {
  switch (timeframe) {
    case 'last_7_days':
      return '7d';
    case 'last_28_days':
      return '28d';
    case 'last_90_days':
      return '90d';
    default:
      return '28d';
  }
}

function calculateDataCompleteness(
  ga4Data: Ga4DataLite | null,
  gscData: GscDataLite | null,
  mediaData: MediaDataLite | null
): number {
  let score = 0;
  let maxScore = 0;

  // GA4 contributes 40%
  maxScore += 40;
  if (ga4Data) {
    if (ga4Data.sessions !== undefined) score += 20;
    if (ga4Data.conversions !== undefined) score += 20;
  }

  // GSC contributes 30%
  maxScore += 30;
  if (gscData) {
    if (gscData.clicks !== undefined) score += 15;
    if (gscData.impressions !== undefined) score += 15;
  }

  // Media contributes 30%
  maxScore += 30;
  if (mediaData) {
    if (mediaData.spend !== undefined) score += 15;
    if (mediaData.roas !== undefined) score += 15;
  }

  return Math.round((score / maxScore) * 100);
}
