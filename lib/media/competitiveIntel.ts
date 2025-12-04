// lib/media/competitiveIntel.ts
// Competitive Intelligence Engine
//
// Tracks competitor activity across channels and generates strategic insights.
// Data sources are stubbed for future integration with real competitive intel APIs.

import type { MediaChannel } from './types';

// ============================================================================
// Types
// ============================================================================

export type CompetitorPresence = 'weak' | 'moderate' | 'strong';

export type CompetitorChannel =
  | 'search_ads'
  | 'local_search'
  | 'social_ads'
  | 'display_ads'
  | 'youtube_ads'
  | 'organic_search'
  | 'local_seo'
  | 'email'
  | 'radio'
  | 'tv';

export interface CompetitorSignal {
  competitor: string;
  channel: CompetitorChannel;
  presence: CompetitorPresence;
  examples?: string[];
  lastUpdated?: string;
  confidence: 'low' | 'medium' | 'high';
}

export interface CompetitorProfile {
  id: string;
  name: string;
  website?: string;
  description?: string;
  isPrimary: boolean;
  locations?: number;
  estimatedBudget?: 'low' | 'medium' | 'high' | 'enterprise';
  strengths: CompetitorChannel[];
  weaknesses: CompetitorChannel[];
  signals: CompetitorSignal[];
}

export interface CompetitorOfferTheme {
  competitor: string;
  theme: string;
  examples: string[];
  frequency: 'rare' | 'occasional' | 'frequent' | 'constant';
  channels: CompetitorChannel[];
  detectedAt: string;
}

export interface CompetitorLocationData {
  competitor: string;
  totalLocations: number;
  marketOverlap: number; // locations in same markets as company
  avgGoogleRating?: number;
  avgReviewCount?: number;
}

export interface CompetitiveGap {
  channel: CompetitorChannel;
  mediaChannel: MediaChannel;
  opportunity: 'high' | 'medium' | 'low';
  reason: string;
  competitors: string[];
  recommendation: string;
}

export interface CompetitiveLandscape {
  companyId: string;
  generatedAt: string;
  competitors: CompetitorProfile[];
  signals: CompetitorSignal[];
  offerThemes: CompetitorOfferTheme[];
  gaps: CompetitiveGap[];
  summary: CompetitiveSummary;
}

export interface CompetitiveSummary {
  totalCompetitors: number;
  primaryThreats: string[];
  channelDominance: Record<CompetitorChannel, string[]>;
  biggestOpportunity: CompetitiveGap | null;
  marketPosition: 'leader' | 'challenger' | 'follower' | 'niche';
  competitiveAdvantages: string[];
  vulnerabilities: string[];
}

// ============================================================================
// Channel Mapping
// ============================================================================

const COMPETITOR_TO_MEDIA_CHANNEL: Record<CompetitorChannel, MediaChannel> = {
  search_ads: 'search',
  local_search: 'maps',
  social_ads: 'social',
  display_ads: 'display',
  youtube_ads: 'youtube',
  organic_search: 'search',
  local_seo: 'maps',
  email: 'email',
  radio: 'radio',
  tv: 'display', // Map TV to display as closest equivalent
};

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Fetch competitor signals for a company
 * Currently returns stubbed data - integrate with real APIs later
 */
export async function fetchCompetitorSignals(
  companyId: string
): Promise<CompetitorSignal[]> {
  // TODO: Integrate with real competitive intel sources:
  // - Google Ads Auction Insights API
  // - SEMrush / SpyFu / Ahrefs APIs
  // - Social listening tools
  // - GBP competitor analysis

  // For now, return empty array (no signals detected)
  // Real implementation would query Airtable for configured competitors
  // and fetch data from various APIs

  console.log(`[CompetitiveIntel] Fetching signals for company: ${companyId}`);

  return [];
}

/**
 * Get full competitive landscape for a company
 */
export async function getCompetitiveLandscape(
  companyId: string
): Promise<CompetitiveLandscape> {
  const signals = await fetchCompetitorSignals(companyId);
  const competitors = await getCompetitorProfiles(companyId);
  const offerThemes = await detectOfferThemes(companyId, competitors);
  const gaps = analyzeCompetitiveGaps(competitors, signals);
  const summary = generateCompetitiveSummary(competitors, signals, gaps);

  return {
    companyId,
    generatedAt: new Date().toISOString(),
    competitors,
    signals,
    offerThemes,
    gaps,
    summary,
  };
}

/**
 * Get competitor profiles for a company
 * Stubbed - would query Airtable Competitors table
 */
export async function getCompetitorProfiles(
  companyId: string
): Promise<CompetitorProfile[]> {
  // TODO: Query Airtable for configured competitors
  // Each company can have competitors defined in their profile

  console.log(`[CompetitiveIntel] Getting competitor profiles for: ${companyId}`);

  return [];
}

/**
 * Detect offer themes from competitor activity
 * Stubbed - would analyze competitor ads and messaging
 */
export async function detectOfferThemes(
  companyId: string,
  competitors: CompetitorProfile[]
): Promise<CompetitorOfferTheme[]> {
  // TODO: Implement offer theme detection
  // - Scrape competitor landing pages
  // - Analyze ad copy from auction insights
  // - Track seasonal promotions

  console.log(`[CompetitiveIntel] Detecting offer themes for ${competitors.length} competitors`);

  return [];
}

// ============================================================================
// Analysis Functions
// ============================================================================

/**
 * Analyze competitive gaps to find opportunities
 */
export function analyzeCompetitiveGaps(
  competitors: CompetitorProfile[],
  signals: CompetitorSignal[]
): CompetitiveGap[] {
  const gaps: CompetitiveGap[] = [];

  // Group signals by channel
  const channelStrength = new Map<CompetitorChannel, CompetitorSignal[]>();

  for (const signal of signals) {
    const existing = channelStrength.get(signal.channel) || [];
    channelStrength.set(signal.channel, [...existing, signal]);
  }

  // All possible competitor channels
  const allChannels: CompetitorChannel[] = [
    'search_ads',
    'local_search',
    'social_ads',
    'display_ads',
    'youtube_ads',
    'organic_search',
    'local_seo',
    'email',
    'radio',
  ];

  for (const channel of allChannels) {
    const channelSignals = channelStrength.get(channel) || [];
    const strongCompetitors = channelSignals.filter(s => s.presence === 'strong');
    const moderateCompetitors = channelSignals.filter(s => s.presence === 'moderate');

    // High opportunity: No strong competitors
    if (strongCompetitors.length === 0 && moderateCompetitors.length <= 1) {
      gaps.push({
        channel,
        mediaChannel: COMPETITOR_TO_MEDIA_CHANNEL[channel],
        opportunity: 'high',
        reason: 'Low competitor activity presents market opportunity',
        competitors: channelSignals.map(s => s.competitor),
        recommendation: getChannelRecommendation(channel, 'high'),
      });
    }
    // Medium opportunity: Some competition but not saturated
    else if (strongCompetitors.length <= 2) {
      gaps.push({
        channel,
        mediaChannel: COMPETITOR_TO_MEDIA_CHANNEL[channel],
        opportunity: 'medium',
        reason: 'Moderate competition with room for differentiation',
        competitors: strongCompetitors.map(s => s.competitor),
        recommendation: getChannelRecommendation(channel, 'medium'),
      });
    }
    // Low opportunity: Highly competitive
    else {
      gaps.push({
        channel,
        mediaChannel: COMPETITOR_TO_MEDIA_CHANNEL[channel],
        opportunity: 'low',
        reason: 'Heavy competition requires significant investment',
        competitors: strongCompetitors.map(s => s.competitor),
        recommendation: getChannelRecommendation(channel, 'low'),
      });
    }
  }

  // Sort by opportunity (high first)
  const opportunityOrder = { high: 0, medium: 1, low: 2 };
  return gaps.sort((a, b) => opportunityOrder[a.opportunity] - opportunityOrder[b.opportunity]);
}

/**
 * Get recommendation for a competitive gap
 */
function getChannelRecommendation(
  channel: CompetitorChannel,
  opportunity: 'high' | 'medium' | 'low'
): string {
  const recommendations: Record<CompetitorChannel, Record<string, string>> = {
    search_ads: {
      high: 'Capture search intent with aggressive bidding on core terms',
      medium: 'Focus on long-tail keywords and location-specific terms',
      low: 'Optimize Quality Score and focus on branded + high-intent terms',
    },
    local_search: {
      high: 'Dominate local pack with optimized GBP and local campaigns',
      medium: 'Strengthen GBP presence and local content strategy',
      low: 'Focus on review velocity and local authority building',
    },
    social_ads: {
      high: 'Establish social presence with consistent creative testing',
      medium: 'Differentiate with unique creative angles and audience targeting',
      low: 'Focus on retargeting and existing customer engagement',
    },
    display_ads: {
      high: 'Build brand awareness with programmatic display campaigns',
      medium: 'Target competitor audiences and in-market segments',
      low: 'Focus on remarketing and contextual placements',
    },
    youtube_ads: {
      high: 'Capture video audience with educational and promotional content',
      medium: 'Test video formats and competitor audience targeting',
      low: 'Focus on short-form content and targeted placements',
    },
    organic_search: {
      high: 'Build content authority with comprehensive topic coverage',
      medium: 'Target gap keywords competitors are missing',
      low: 'Focus on differentiating content and technical SEO',
    },
    local_seo: {
      high: 'Build local citation network and location pages',
      medium: 'Strengthen location-specific content and links',
      low: 'Focus on review strategy and local engagement',
    },
    email: {
      high: 'Build email list with lead magnets and nurture sequences',
      medium: 'Segment and personalize for higher engagement',
      low: 'Focus on retention and reactivation campaigns',
    },
    radio: {
      high: 'Establish radio presence in key markets',
      medium: 'Test targeted dayparts and formats',
      low: 'Consider digital audio alternatives like podcasts',
    },
    tv: {
      high: 'Test connected TV in key markets',
      medium: 'Focus on streaming platforms with targeting',
      low: 'Consider video alternatives with better attribution',
    },
  };

  return recommendations[channel]?.[opportunity] ||
    'Evaluate channel performance and competitive positioning';
}

/**
 * Generate competitive summary
 */
export function generateCompetitiveSummary(
  competitors: CompetitorProfile[],
  signals: CompetitorSignal[],
  gaps: CompetitiveGap[]
): CompetitiveSummary {
  // Find primary threats (competitors with strong presence in multiple channels)
  const competitorStrength = new Map<string, number>();

  for (const signal of signals) {
    const current = competitorStrength.get(signal.competitor) || 0;
    const points = signal.presence === 'strong' ? 3 : signal.presence === 'moderate' ? 2 : 1;
    competitorStrength.set(signal.competitor, current + points);
  }

  const sortedCompetitors = Array.from(competitorStrength.entries())
    .sort((a, b) => b[1] - a[1]);

  const primaryThreats = sortedCompetitors.slice(0, 3).map(([name]) => name);

  // Build channel dominance map
  const channelDominance: Record<CompetitorChannel, string[]> = {
    search_ads: [],
    local_search: [],
    social_ads: [],
    display_ads: [],
    youtube_ads: [],
    organic_search: [],
    local_seo: [],
    email: [],
    radio: [],
    tv: [],
  };

  for (const signal of signals) {
    if (signal.presence === 'strong') {
      channelDominance[signal.channel].push(signal.competitor);
    }
  }

  // Find biggest opportunity
  const biggestOpportunity = gaps.find(g => g.opportunity === 'high') || null;

  // Determine market position (simplified logic)
  let marketPosition: CompetitiveSummary['marketPosition'] = 'challenger';
  if (competitors.length === 0) {
    marketPosition = 'leader'; // No known competitors
  } else if (primaryThreats.length >= 3) {
    marketPosition = 'challenger'; // Many strong competitors
  } else if (primaryThreats.length === 0) {
    marketPosition = 'leader'; // No strong competitors
  }

  // Identify advantages and vulnerabilities
  const competitiveAdvantages: string[] = [];
  const vulnerabilities: string[] = [];

  const highOpportunityChannels = gaps.filter(g => g.opportunity === 'high');
  if (highOpportunityChannels.length >= 3) {
    competitiveAdvantages.push('Multiple underserved channels available');
  }

  const lowOpportunityChannels = gaps.filter(g => g.opportunity === 'low');
  if (lowOpportunityChannels.length >= 3) {
    vulnerabilities.push('Heavy competition in key channels');
  }

  return {
    totalCompetitors: competitors.length,
    primaryThreats,
    channelDominance,
    biggestOpportunity,
    marketPosition,
    competitiveAdvantages,
    vulnerabilities,
  };
}

// ============================================================================
// Competitive Alerts
// ============================================================================

export interface CompetitiveAlert {
  id: string;
  type: 'new_competitor' | 'increased_activity' | 'new_offer' | 'market_shift';
  severity: 'info' | 'warning' | 'critical';
  competitor?: string;
  channel?: CompetitorChannel;
  title: string;
  description: string;
  detectedAt: string;
  recommendation?: string;
}

/**
 * Check for competitive alerts based on recent signals
 */
export async function checkCompetitiveAlerts(
  companyId: string,
  previousSignals: CompetitorSignal[],
  currentSignals: CompetitorSignal[]
): Promise<CompetitiveAlert[]> {
  const alerts: CompetitiveAlert[] = [];

  // Detect new competitors
  const previousCompetitors = new Set(previousSignals.map(s => s.competitor));
  const newCompetitors = currentSignals.filter(
    s => !previousCompetitors.has(s.competitor)
  );

  for (const signal of newCompetitors) {
    alerts.push({
      id: `new-${signal.competitor}-${Date.now()}`,
      type: 'new_competitor',
      severity: signal.presence === 'strong' ? 'warning' : 'info',
      competitor: signal.competitor,
      channel: signal.channel,
      title: `New competitor detected: ${signal.competitor}`,
      description: `${signal.competitor} is now active in ${signal.channel} with ${signal.presence} presence`,
      detectedAt: new Date().toISOString(),
      recommendation: 'Review competitor positioning and adjust strategy',
    });
  }

  // Detect increased activity
  for (const current of currentSignals) {
    const previous = previousSignals.find(
      p => p.competitor === current.competitor && p.channel === current.channel
    );

    if (previous && presenceToNumber(current.presence) > presenceToNumber(previous.presence)) {
      alerts.push({
        id: `increase-${current.competitor}-${current.channel}-${Date.now()}`,
        type: 'increased_activity',
        severity: current.presence === 'strong' ? 'warning' : 'info',
        competitor: current.competitor,
        channel: current.channel,
        title: `${current.competitor} increased ${current.channel} activity`,
        description: `Presence changed from ${previous.presence} to ${current.presence}`,
        detectedAt: new Date().toISOString(),
        recommendation: `Monitor ${current.channel} performance and consider response`,
      });
    }
  }

  return alerts;
}

function presenceToNumber(presence: CompetitorPresence): number {
  return { weak: 1, moderate: 2, strong: 3 }[presence];
}

// ============================================================================
// Competitive Response Suggestions
// ============================================================================

export interface CompetitiveResponse {
  trigger: string;
  responseType: 'defensive' | 'offensive' | 'strategic';
  actions: string[];
  channels: MediaChannel[];
  urgency: 'immediate' | 'short_term' | 'long_term';
  estimatedImpact: 'high' | 'medium' | 'low';
}

/**
 * Generate suggested responses to competitive threats
 */
export function suggestCompetitiveResponses(
  landscape: CompetitiveLandscape
): CompetitiveResponse[] {
  const responses: CompetitiveResponse[] = [];

  // Response to high-opportunity gaps
  for (const gap of landscape.gaps.filter(g => g.opportunity === 'high')) {
    responses.push({
      trigger: `Low competition in ${gap.channel}`,
      responseType: 'offensive',
      actions: [
        gap.recommendation,
        'Allocate additional budget to capture market share',
        'Develop channel-specific creative and messaging',
      ],
      channels: [gap.mediaChannel],
      urgency: 'short_term',
      estimatedImpact: 'high',
    });
  }

  // Response to primary threats
  for (const threat of landscape.summary.primaryThreats) {
    const threatSignals = landscape.signals.filter(
      s => s.competitor === threat && s.presence === 'strong'
    );

    if (threatSignals.length > 0) {
      responses.push({
        trigger: `${threat} dominates ${threatSignals.length} channels`,
        responseType: 'defensive',
        actions: [
          'Differentiate messaging to avoid direct competition',
          'Focus on unique value propositions',
          'Consider alternative channels with less competition',
        ],
        channels: threatSignals.map(s => COMPETITOR_TO_MEDIA_CHANNEL[s.channel]),
        urgency: 'immediate',
        estimatedImpact: 'medium',
      });
    }
  }

  // Response to detected offer themes
  for (const theme of landscape.offerThemes.filter(t => t.frequency === 'constant')) {
    responses.push({
      trigger: `${theme.competitor} constantly promotes "${theme.theme}"`,
      responseType: 'strategic',
      actions: [
        'Evaluate if matching offer is viable',
        'Develop counter-positioning messaging',
        'Focus on different value drivers',
      ],
      channels: theme.channels.map(c => COMPETITOR_TO_MEDIA_CHANNEL[c]),
      urgency: 'long_term',
      estimatedImpact: 'medium',
    });
  }

  return responses;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get competitor presence level as a display label
 */
export function getPresenceLabel(presence: CompetitorPresence): string {
  return {
    weak: 'Minimal Activity',
    moderate: 'Active',
    strong: 'Dominant',
  }[presence];
}

/**
 * Get competitor channel display name
 */
export function getChannelDisplayName(channel: CompetitorChannel): string {
  return {
    search_ads: 'Search Ads',
    local_search: 'Local Search',
    social_ads: 'Social Ads',
    display_ads: 'Display Ads',
    youtube_ads: 'YouTube Ads',
    organic_search: 'Organic Search',
    local_seo: 'Local SEO',
    email: 'Email Marketing',
    radio: 'Radio',
    tv: 'TV/Video',
  }[channel];
}

/**
 * Map media channel to competitor channel
 */
export function mediaToCompetitorChannel(
  mediaChannel: MediaChannel
): CompetitorChannel[] {
  const mapping: Partial<Record<MediaChannel, CompetitorChannel[]>> = {
    search: ['search_ads', 'organic_search'],
    maps: ['local_search', 'local_seo'],
    lsa: ['local_search'],
    social: ['social_ads'],
    display: ['display_ads'],
    youtube: ['youtube_ads'],
    email: ['email'],
    radio: ['radio'],
    tv: ['tv'],
    affiliate: [],
    direct_mail: [],
  };

  return mapping[mediaChannel] || [];
}
