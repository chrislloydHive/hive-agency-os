// lib/media/planComposer.ts
// Media Plan Output Composer
//
// Generates narrative summaries and structured output for media plans.
// Uses AI to create exec summaries, channel reasoning, and strategic insights.
//
// Key Features:
// - Executive summary generation
// - Channel mix explanation
// - Seasonality insights
// - Regional considerations
// - Export-ready format

import { getMediaProfile, type MediaProfile } from './mediaProfile';
import { analyzeSeasonality, getMonthName } from './seasonality';
import { getChannelBenchmarks } from './channelBenchmarks';
import type { MediaChannel } from './types';
import type {
  MediaPlanOption,
  ChannelAllocation,
  PlanExpectedOutcomes,
  PlanObjective,
} from './aiPlanner';

// ============================================================================
// Types
// ============================================================================

export interface MediaPlanSummary {
  execSummary: string;
  channelMix: Array<{
    channel: MediaChannel;
    budget: number;
    percentage: number;
    reasoning: string;
  }>;
  forecast: {
    installs: number;
    calls: number;
    leads: number;
    spend: number;
    cpa: number;
    cpl: number;
  };
  seasonalityHighlights: string[];
  regionNotes?: string[];
  strategicRecommendations: string[];
}

export interface ComposePlanInput {
  companyId: string;
  planName: string;
  objective: PlanObjective;
  allocations: ChannelAllocation[];
  expected: PlanExpectedOutcomes;
  timeframe: {
    start: string;
    end: string;
  };
}

// ============================================================================
// Channel Reasoning Templates
// ============================================================================

const CHANNEL_REASONING: Partial<Record<MediaChannel, Record<PlanObjective, string>>> = {
  search: {
    max_installs: 'Search captures high-intent customers actively looking for solutions, driving quality install leads.',
    max_calls: 'Search drives phone calls from users seeking immediate service with commercial intent.',
    store_traffic: 'Search ads with location extensions guide customers to nearby stores.',
    blended: 'Search provides a reliable foundation for both lead generation and brand presence.',
  },
  maps: {
    max_installs: 'Maps visibility drives foot traffic from customers ready to visit your location.',
    max_calls: 'Google Business Profile optimizes for calls from users discovering your business.',
    store_traffic: 'Maps is essential for driving direction requests and in-store visits.',
    blended: 'Maps captures local intent across the customer journey from discovery to visit.',
  },
  lsa: {
    max_installs: 'Local Service Ads deliver pre-qualified leads with high conversion potential.',
    max_calls: 'LSAs are optimized for phone calls with pay-per-lead pricing efficiency.',
    store_traffic: 'LSAs build trust with Google Guarantee badge driving quality inquiries.',
    blended: 'LSAs provide cost-effective leads while building local credibility.',
  },
  social: {
    max_installs: 'Social builds awareness that nurtures future customers into installation decisions.',
    max_calls: 'Social advertising creates demand that drives phone inquiries and consultations.',
    store_traffic: 'Social drives discovery and store visits through local targeting and offers.',
    blended: 'Social expands reach and builds brand equity to support conversion channels.',
  },
  radio: {
    max_installs: 'Radio builds top-of-mind awareness that supports installation decisions.',
    max_calls: 'Radio spots with strong CTAs drive phone response during peak listening hours.',
    store_traffic: 'Radio reaches commuters and builds awareness for local store visits.',
    blended: 'Radio provides broad reach for brand awareness at competitive CPMs.',
  },
  display: {
    max_installs: 'Display retargeting keeps your brand visible through the consideration phase.',
    max_calls: 'Display builds awareness that supports phone inquiry volume over time.',
    store_traffic: 'Display with geo-targeting drives local awareness and store discovery.',
    blended: 'Display supports the full funnel with awareness and retargeting tactics.',
  },
  youtube: {
    max_installs: 'YouTube video demonstrates value propositions that drive installation decisions.',
    max_calls: 'YouTube video builds trust and credibility that increases call conversion rates.',
    store_traffic: 'YouTube showcases store experience and drives visit intent.',
    blended: 'YouTube delivers engaging brand content across awareness and consideration.',
  },
  email: {
    max_installs: 'Email nurtures existing contacts toward installation conversion.',
    max_calls: 'Email campaigns with click-to-call drive phone inquiries from warm leads.',
    store_traffic: 'Email delivers personalized offers that drive store visits.',
    blended: 'Email provides efficient CRM activation with strong conversion potential.',
  },
  affiliate: {
    max_installs: 'Affiliate partnerships drive performance-based installation leads.',
    max_calls: 'Affiliate networks deliver qualified calls on a pay-for-performance basis.',
    store_traffic: 'Affiliate content drives consideration and store discovery.',
    blended: 'Affiliates extend reach with accountable performance-based costs.',
  },
};

// ============================================================================
// Objective Descriptions
// ============================================================================

const OBJECTIVE_DESCRIPTIONS: Record<PlanObjective, string> = {
  max_installs: 'maximize new customer installations',
  max_calls: 'drive inbound phone leads',
  store_traffic: 'increase foot traffic and local visibility',
  blended: 'balance growth across all key metrics',
};

// ============================================================================
// Composer Functions
// ============================================================================

/**
 * Compose a complete media plan summary
 */
export async function composeMediaPlanSummary(
  input: ComposePlanInput
): Promise<MediaPlanSummary> {
  const { companyId, planName, objective, allocations, expected, timeframe } = input;

  // Load media profile
  const profile = await getMediaProfile(companyId);

  // Analyze seasonality
  const seasonalityAnalysis = analyzeSeasonality(profile.seasonality);

  // Build exec summary
  const execSummary = buildExecSummary(
    planName,
    objective,
    expected,
    allocations,
    timeframe
  );

  // Build channel mix with reasoning
  const channelMix = allocations.map(alloc => ({
    channel: alloc.channel,
    budget: alloc.budget,
    percentage: alloc.percentage,
    reasoning: getChannelReasoning(alloc.channel, objective, alloc, profile),
  }));

  // Build seasonality highlights
  const seasonalityHighlights = buildSeasonalityHighlights(
    profile,
    seasonalityAnalysis,
    timeframe
  );

  // Build regional notes if applicable
  const regionNotes = profile.regions?.length
    ? buildRegionNotes(profile)
    : undefined;

  // Build strategic recommendations
  const strategicRecommendations = buildStrategicRecommendations(
    objective,
    allocations,
    expected,
    profile
  );

  return {
    execSummary,
    channelMix,
    forecast: {
      installs: expected.installs,
      calls: expected.calls,
      leads: expected.leads,
      spend: expected.spend,
      cpa: expected.cpa,
      cpl: expected.cpl,
    },
    seasonalityHighlights,
    regionNotes,
    strategicRecommendations,
  };
}

/**
 * Build executive summary paragraph
 */
function buildExecSummary(
  planName: string,
  objective: PlanObjective,
  expected: PlanExpectedOutcomes,
  allocations: ChannelAllocation[],
  timeframe: { start: string; end: string }
): string {
  const objectiveDesc = OBJECTIVE_DESCRIPTIONS[objective];
  const topChannels = [...allocations]
    .sort((a, b) => b.budget - a.budget)
    .slice(0, 3)
    .map(a => getChannelLabel(a.channel));

  const startDate = new Date(timeframe.start).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  const endDate = new Date(timeframe.end).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return `${planName} is designed to ${objectiveDesc} from ${startDate} through ${endDate}. ` +
    `With a monthly investment of $${expected.spend.toLocaleString()}, this plan focuses on ` +
    `${topChannels.join(', ')} to deliver an estimated ${expected.installs.toLocaleString()} installs ` +
    `and ${expected.calls.toLocaleString()} calls at a target CPA of $${expected.cpa}. ` +
    `The channel mix is optimized for your business profile and seasonal patterns.`;
}

/**
 * Get reasoning for a specific channel allocation
 */
function getChannelReasoning(
  channel: MediaChannel,
  objective: PlanObjective,
  allocation: ChannelAllocation,
  profile: MediaProfile
): string {
  const baseReasoning = CHANNEL_REASONING[channel]?.[objective] ||
    CHANNEL_REASONING[channel]?.blended ||
    `${getChannelLabel(channel)} supports your marketing objectives.`;

  // Add profile-specific context
  const benchmarks = getChannelBenchmarks(channel, profile);
  const budgetNote = allocation.isRequired
    ? ' This is a required channel for your media profile.'
    : '';

  return `${baseReasoning} Expected CPA: $${benchmarks.cpa}.${budgetNote}`;
}

/**
 * Build seasonality highlights
 */
function buildSeasonalityHighlights(
  profile: MediaProfile,
  analysis: ReturnType<typeof analyzeSeasonality>,
  timeframe: { start: string; end: string }
): string[] {
  const highlights: string[] = [];

  // Add peak period note
  if (analysis.peakMonths.length > 0) {
    highlights.push(
      `Peak performance expected in ${analysis.peakMonths.join(', ')} when demand multipliers are highest.`
    );
  }

  // Add slow period note
  if (analysis.lowMonths.length > 0) {
    highlights.push(
      `Lower demand expected in ${analysis.lowMonths.join(', ')}. Consider efficiency optimization during these periods.`
    );
  }

  // Check if timeframe includes peak or low periods
  const startMonth = getMonthName(new Date(timeframe.start).getMonth());
  const endMonth = getMonthName(new Date(timeframe.end).getMonth());

  const timeframeMonths = getMonthsInRange(
    new Date(timeframe.start),
    new Date(timeframe.end)
  );

  const peakInTimeframe = analysis.peakMonths.some(m => timeframeMonths.includes(m));
  const lowInTimeframe = analysis.lowMonths.some(m => timeframeMonths.includes(m));

  if (peakInTimeframe) {
    highlights.push('Your plan period includes peak season. Budget is allocated to capitalize on higher demand.');
  }

  if (lowInTimeframe && !peakInTimeframe) {
    highlights.push('Your plan period includes slower months. Focus on efficiency and building pipeline for peak season.');
  }

  // Add general recommendation
  highlights.push(analysis.recommendation);

  return highlights;
}

/**
 * Build region notes for multi-location businesses
 */
function buildRegionNotes(profile: MediaProfile): string[] {
  if (!profile.regions || profile.regions.length === 0) {
    return [];
  }

  const notes: string[] = [];

  notes.push(
    `This plan covers ${profile.regions.length} regions with ${profile.regions.reduce((sum, r) => sum + r.storeIds.length, 0)} total locations.`
  );

  // Note regions with weight adjustments
  const weightedRegions = profile.regions.filter(r => r.weight && r.weight !== 1);
  if (weightedRegions.length > 0) {
    const adjustments = weightedRegions.map(r => {
      const direction = (r.weight || 1) > 1 ? 'increased' : 'reduced';
      return `${r.name} (${direction} allocation)`;
    });
    notes.push(`Budget allocation adjusted for: ${adjustments.join(', ')}.`);
  }

  // Note regions with seasonal overrides
  const seasonalRegions = profile.regions.filter(r => r.seasonalityOverride);
  if (seasonalRegions.length > 0) {
    notes.push(
      `Custom seasonality patterns applied for: ${seasonalRegions.map(r => r.name).join(', ')}.`
    );
  }

  return notes;
}

/**
 * Build strategic recommendations
 */
function buildStrategicRecommendations(
  objective: PlanObjective,
  allocations: ChannelAllocation[],
  expected: PlanExpectedOutcomes,
  profile: MediaProfile
): string[] {
  const recommendations: string[] = [];

  // CPA vs target recommendation
  if (profile.maxCpa && expected.cpa > profile.maxCpa) {
    recommendations.push(
      `Current projected CPA ($${expected.cpa}) exceeds your target ($${profile.maxCpa}). Consider shifting budget to higher-efficiency channels.`
    );
  } else if (profile.maxCpa && expected.cpa <= profile.maxCpa * 0.8) {
    recommendations.push(
      `Projected CPA is well under target. Consider testing increased spend to capture additional volume.`
    );
  }

  // Channel diversity recommendation
  const activeChannels = allocations.filter(a => a.budget > 0).length;
  if (activeChannels < 3) {
    recommendations.push(
      'Consider adding an additional channel to diversify risk and capture customers at different journey stages.'
    );
  } else if (activeChannels > 5) {
    recommendations.push(
      'Consider consolidating spend across fewer channels for deeper optimization and clearer attribution.'
    );
  }

  // Objective-specific recommendations
  if (objective === 'max_installs' && !allocations.some(a => a.channel === 'search' && a.percentage >= 30)) {
    recommendations.push(
      'For maximum installs, consider increasing search allocation to capture high-intent demand.'
    );
  }

  if (objective === 'max_calls' && !allocations.some(a => a.channel === 'lsa' && a.percentage >= 25)) {
    recommendations.push(
      'Local Service Ads are highly effective for call generation. Consider increasing LSA allocation.'
    );
  }

  if (objective === 'store_traffic' && !allocations.some(a => a.channel === 'maps' && a.percentage >= 30)) {
    recommendations.push(
      'Google Maps visibility is critical for store traffic. Consider increasing maps allocation.'
    );
  }

  // Add general best practice
  recommendations.push(
    'Monitor performance weekly and rebalance budget toward top-performing channels after the first 2-4 weeks.'
  );

  return recommendations;
}

// ============================================================================
// Helper Functions
// ============================================================================

const CHANNEL_LABELS: Record<MediaChannel, string> = {
  search: 'Paid Search',
  maps: 'Google Maps',
  lsa: 'Local Service Ads',
  social: 'Social Media',
  radio: 'Radio',
  display: 'Display',
  youtube: 'YouTube/Video',
  microsoft_search: 'Microsoft Search',
  tiktok: 'TikTok',
  email: 'Email',
  affiliate: 'Affiliate',
  tv: 'Television',
  streaming_audio: 'Streaming Audio',
  out_of_home: 'Out-of-Home',
  print: 'Print',
  direct_mail: 'Direct Mail',
};

function getChannelLabel(channel: MediaChannel): string {
  return CHANNEL_LABELS[channel] || channel;
}

function getMonthsInRange(start: Date, end: Date): string[] {
  const months: string[] = [];
  const current = new Date(start);

  while (current <= end) {
    months.push(getMonthName(current.getMonth()));
    current.setMonth(current.getMonth() + 1);
  }

  return [...new Set(months)];
}

// ============================================================================
// Export Formatting
// ============================================================================

/**
 * Format plan summary as markdown
 */
export function formatPlanAsMarkdown(summary: MediaPlanSummary): string {
  const lines: string[] = [];

  lines.push('# Media Plan Summary');
  lines.push('');
  lines.push('## Executive Summary');
  lines.push(summary.execSummary);
  lines.push('');

  lines.push('## Projected Results');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Spend | $${summary.forecast.spend.toLocaleString()} |`);
  lines.push(`| Installs | ${summary.forecast.installs.toLocaleString()} |`);
  lines.push(`| Calls | ${summary.forecast.calls.toLocaleString()} |`);
  lines.push(`| CPA | $${summary.forecast.cpa} |`);
  lines.push(`| CPL | $${summary.forecast.cpl} |`);
  lines.push('');

  lines.push('## Channel Allocation');
  lines.push('');
  for (const channel of summary.channelMix) {
    lines.push(`### ${getChannelLabel(channel.channel)} (${channel.percentage}%)`);
    lines.push(`- **Budget:** $${channel.budget.toLocaleString()}`);
    lines.push(`- **Rationale:** ${channel.reasoning}`);
    lines.push('');
  }

  lines.push('## Seasonality Insights');
  lines.push('');
  for (const highlight of summary.seasonalityHighlights) {
    lines.push(`- ${highlight}`);
  }
  lines.push('');

  if (summary.regionNotes && summary.regionNotes.length > 0) {
    lines.push('## Regional Considerations');
    lines.push('');
    for (const note of summary.regionNotes) {
      lines.push(`- ${note}`);
    }
    lines.push('');
  }

  lines.push('## Strategic Recommendations');
  lines.push('');
  for (const rec of summary.strategicRecommendations) {
    lines.push(`- ${rec}`);
  }

  return lines.join('\n');
}

/**
 * Format plan summary as JSON for API responses
 */
export function formatPlanAsJson(summary: MediaPlanSummary): string {
  return JSON.stringify(summary, null, 2);
}
