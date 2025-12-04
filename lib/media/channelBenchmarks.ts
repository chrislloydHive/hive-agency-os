// lib/media/channelBenchmarks.ts
// Channel Benchmark Engine - Performance benchmarks by channel and industry
//
// This module provides CPA, CTR, CPM, and conversion benchmarks for media
// channels, with support for industry-specific overrides and historical learning.

import type { MediaChannel } from './types';
import type { MediaProfile } from './mediaProfile';
import { DEFAULT_BASELINE_CPA, DEFAULT_CTR_CPM } from './mediaProfile';

// ============================================================================
// Types
// ============================================================================

export interface ChannelPerformanceMetrics {
  cpa: number;          // Cost per acquisition
  ctr: number;          // Click-through rate (0-1)
  cpm: number;          // Cost per 1000 impressions
  cvr: number;          // Conversion rate (0-1)
  avgCpc?: number;      // Average cost per click
  impressionShare?: number; // Typical impression share (0-1)
}

export interface ChannelMetadata {
  name: string;
  displayName: string;
  category: 'performance' | 'awareness' | 'local' | 'traditional';
  description: string;
  bestFor: string[];
  limitations: string[];
  minMonthlyBudget: number;
  typicalRampUpWeeks: number;
}

// ============================================================================
// Channel Metadata
// ============================================================================

export const CHANNEL_METADATA: Partial<Record<MediaChannel, ChannelMetadata>> = {
  search: {
    name: 'search',
    displayName: 'Google Search',
    category: 'performance',
    description: 'Intent-driven search advertising on Google',
    bestFor: ['High-intent leads', 'Direct response', 'Measurable ROI'],
    limitations: ['Competitive CPCs', 'Limited reach', 'Keyword dependency'],
    minMonthlyBudget: 2000,
    typicalRampUpWeeks: 2,
  },
  maps: {
    name: 'maps',
    displayName: 'Google Maps/Local',
    category: 'local',
    description: 'Local business ads in Google Maps and Local Pack',
    bestFor: ['Local discovery', 'Store visits', 'Phone calls'],
    limitations: ['Location-dependent', 'Limited ad formats'],
    minMonthlyBudget: 500,
    typicalRampUpWeeks: 1,
  },
  lsa: {
    name: 'lsa',
    displayName: 'Local Services Ads',
    category: 'local',
    description: 'Pay-per-lead ads for local service businesses',
    bestFor: ['Phone leads', 'Service businesses', 'Trust signals'],
    limitations: ['Limited industries', 'Google screening required'],
    minMonthlyBudget: 500,
    typicalRampUpWeeks: 3,
  },
  social: {
    name: 'social',
    displayName: 'Meta Social',
    category: 'awareness',
    description: 'Facebook and Instagram advertising',
    bestFor: ['Brand awareness', 'Audience targeting', 'Visual products'],
    limitations: ['Privacy changes', 'Attribution complexity'],
    minMonthlyBudget: 1500,
    typicalRampUpWeeks: 3,
  },
  display: {
    name: 'display',
    displayName: 'Display/GDN',
    category: 'awareness',
    description: 'Banner ads across Google Display Network',
    bestFor: ['Retargeting', 'Brand visibility', 'Wide reach'],
    limitations: ['Low CTR', 'Banner blindness', 'Viewability'],
    minMonthlyBudget: 1000,
    typicalRampUpWeeks: 2,
  },
  youtube: {
    name: 'youtube',
    displayName: 'YouTube/Video',
    category: 'awareness',
    description: 'Video advertising on YouTube and partners',
    bestFor: ['Brand storytelling', 'Product demos', 'Engagement'],
    limitations: ['Creative requirements', 'Skip behavior'],
    minMonthlyBudget: 2000,
    typicalRampUpWeeks: 3,
  },
  radio: {
    name: 'radio',
    displayName: 'Radio/Audio',
    category: 'traditional',
    description: 'Terrestrial and streaming radio advertising',
    bestFor: ['Local reach', 'Commuters', 'Brand awareness'],
    limitations: ['No direct response', 'Attribution challenges'],
    minMonthlyBudget: 3000,
    typicalRampUpWeeks: 4,
  },
  email: {
    name: 'email',
    displayName: 'Email Marketing',
    category: 'performance',
    description: 'Direct email campaigns to owned/rented lists',
    bestFor: ['Existing customers', 'Low cost', 'Nurturing'],
    limitations: ['List quality', 'Deliverability', 'Fatigue'],
    minMonthlyBudget: 200,
    typicalRampUpWeeks: 1,
  },
  affiliate: {
    name: 'affiliate',
    displayName: 'Affiliate/Partner',
    category: 'performance',
    description: 'Performance-based partner marketing',
    bestFor: ['Pay for performance', 'Extended reach', 'Partnerships'],
    limitations: ['Quality control', 'Brand consistency'],
    minMonthlyBudget: 1000,
    typicalRampUpWeeks: 4,
  },
};

// ============================================================================
// Industry Benchmarks
// ============================================================================

export type IndustryVertical =
  | 'home_services'
  | 'automotive'
  | 'retail'
  | 'healthcare'
  | 'legal'
  | 'finance'
  | 'technology'
  | 'education'
  | 'travel'
  | 'real_estate'
  | 'default';

/**
 * Industry-specific CPA benchmarks by channel
 */
export const INDUSTRY_CPA_BENCHMARKS: Record<IndustryVertical, Record<string, number>> = {
  home_services: {
    search: 65,
    maps: 35,
    lsa: 45,
    social: 90,
    display: 150,
    radio: 180,
    video: 120,
    email: 20,
    affiliate: 55,
  },
  automotive: {
    search: 120,
    maps: 80,
    lsa: 0, // Not applicable
    social: 150,
    display: 200,
    radio: 180,
    video: 130,
    email: 40,
    affiliate: 100,
  },
  retail: {
    search: 45,
    maps: 30,
    lsa: 0,
    social: 55,
    display: 80,
    radio: 120,
    video: 70,
    email: 15,
    affiliate: 35,
  },
  healthcare: {
    search: 95,
    maps: 60,
    lsa: 80,
    social: 120,
    display: 180,
    radio: 200,
    video: 140,
    email: 35,
    affiliate: 70,
  },
  legal: {
    search: 200,
    maps: 150,
    lsa: 180,
    social: 250,
    display: 300,
    radio: 280,
    video: 220,
    email: 60,
    affiliate: 150,
  },
  finance: {
    search: 180,
    maps: 100,
    lsa: 150,
    social: 200,
    display: 250,
    radio: 220,
    video: 180,
    email: 45,
    affiliate: 120,
  },
  technology: {
    search: 150,
    maps: 80,
    lsa: 0,
    social: 180,
    display: 220,
    radio: 0,
    video: 160,
    email: 50,
    affiliate: 100,
  },
  education: {
    search: 80,
    maps: 50,
    lsa: 60,
    social: 100,
    display: 140,
    radio: 150,
    video: 110,
    email: 25,
    affiliate: 60,
  },
  travel: {
    search: 55,
    maps: 40,
    lsa: 0,
    social: 70,
    display: 100,
    radio: 130,
    video: 85,
    email: 20,
    affiliate: 45,
  },
  real_estate: {
    search: 140,
    maps: 90,
    lsa: 120,
    social: 160,
    display: 200,
    radio: 180,
    video: 150,
    email: 40,
    affiliate: 90,
  },
  default: { ...DEFAULT_BASELINE_CPA },
};

/**
 * Industry-specific CTR benchmarks by channel
 */
export const INDUSTRY_CTR_BENCHMARKS: Record<IndustryVertical, Record<string, number>> = {
  home_services: {
    search: 0.05,
    maps: 0.03,
    lsa: 0.10,
    social: 0.015,
    display: 0.006,
    video: 0.02,
  },
  automotive: {
    search: 0.04,
    maps: 0.025,
    lsa: 0,
    social: 0.012,
    display: 0.004,
    video: 0.015,
  },
  retail: {
    search: 0.055,
    maps: 0.035,
    lsa: 0,
    social: 0.018,
    display: 0.007,
    video: 0.022,
  },
  healthcare: {
    search: 0.04,
    maps: 0.022,
    lsa: 0.08,
    social: 0.01,
    display: 0.004,
    video: 0.012,
  },
  legal: {
    search: 0.03,
    maps: 0.02,
    lsa: 0.07,
    social: 0.008,
    display: 0.003,
    video: 0.01,
  },
  finance: {
    search: 0.035,
    maps: 0.018,
    lsa: 0.06,
    social: 0.009,
    display: 0.0035,
    video: 0.011,
  },
  technology: {
    search: 0.038,
    maps: 0.02,
    lsa: 0,
    social: 0.011,
    display: 0.004,
    video: 0.014,
  },
  education: {
    search: 0.042,
    maps: 0.025,
    lsa: 0.075,
    social: 0.013,
    display: 0.005,
    video: 0.016,
  },
  travel: {
    search: 0.048,
    maps: 0.03,
    lsa: 0,
    social: 0.016,
    display: 0.006,
    video: 0.019,
  },
  real_estate: {
    search: 0.036,
    maps: 0.022,
    lsa: 0.065,
    social: 0.01,
    display: 0.0038,
    video: 0.012,
  },
  default: {
    search: 0.045,
    maps: 0.025,
    lsa: 0.08,
    social: 0.012,
    display: 0.005,
    video: 0.015,
  },
};

// ============================================================================
// Benchmark Lookup Functions
// ============================================================================

/**
 * Get channel performance metrics with fallback chain:
 * 1. MediaProfile custom benchmarks
 * 2. Industry benchmarks
 * 3. Default benchmarks
 */
export function getChannelBenchmarks(
  channel: MediaChannel,
  profile?: MediaProfile,
  industry?: IndustryVertical
): ChannelPerformanceMetrics {
  // Start with defaults
  const defaultCtrCpm = DEFAULT_CTR_CPM[channel] ?? { ctr: 0.02, cpm: 15 };

  // Industry benchmarks
  const industryKey = industry ?? 'default';
  const industryCpa = INDUSTRY_CPA_BENCHMARKS[industryKey]?.[channel] ??
    INDUSTRY_CPA_BENCHMARKS.default[channel] ?? 100;
  const industryCtr = INDUSTRY_CTR_BENCHMARKS[industryKey]?.[channel] ??
    INDUSTRY_CTR_BENCHMARKS.default[channel] ?? 0.02;

  // Profile overrides (highest priority)
  const profileCpa = profile?.baselineCpa?.[channel];
  const profileCtrCpm = profile?.baselineCtrCpm?.[channel];

  const cpa = profileCpa ?? industryCpa;
  const ctr = profileCtrCpm?.ctr ?? industryCtr;
  const cpm = profileCtrCpm?.cpm ?? defaultCtrCpm.cpm;

  // Calculate derived metrics
  const avgCpc = cpm > 0 ? cpm / 1000 / ctr : cpa / 10;
  const cvr = ctr > 0 ? (cpm / 1000) / (cpa * ctr) : 0.02;

  return {
    cpa,
    ctr,
    cpm,
    cvr: Math.min(cvr, 1), // Cap at 100%
    avgCpc,
  };
}

/**
 * Get CPA for a channel with fallbacks
 */
export function getChannelCpa(
  channel: MediaChannel,
  profile?: MediaProfile,
  industry?: IndustryVertical
): number {
  return getChannelBenchmarks(channel, profile, industry).cpa;
}

/**
 * Get CTR for a channel with fallbacks
 */
export function getChannelCtr(
  channel: MediaChannel,
  profile?: MediaProfile,
  industry?: IndustryVertical
): number {
  return getChannelBenchmarks(channel, profile, industry).ctr;
}

/**
 * Get CPM for a channel with fallbacks
 */
export function getChannelCpm(
  channel: MediaChannel,
  profile?: MediaProfile,
  industry?: IndustryVertical
): number {
  return getChannelBenchmarks(channel, profile, industry).cpm;
}

// ============================================================================
// Channel Selection Helpers
// ============================================================================

/**
 * Get recommended channels based on budget and objectives
 */
export function getRecommendedChannels(
  monthlyBudget: number,
  objective: MediaProfile['primaryObjective'],
  profile?: MediaProfile
): MediaChannel[] {
  const channels: MediaChannel[] = [];
  const availableChannels = Object.keys(CHANNEL_METADATA) as MediaChannel[];

  // Filter by minimum budget requirements
  const affordableChannels = availableChannels.filter(ch => {
    const metadata = CHANNEL_METADATA[ch];
    return metadata && metadata.minMonthlyBudget <= monthlyBudget * 0.3; // 30% of budget minimum
  });

  // Prioritize by objective
  const priorityMap: Record<string, MediaChannel[]> = {
    installs: ['search', 'lsa', 'maps', 'social'],
    calls: ['lsa', 'search', 'maps'],
    traffic: ['search', 'display', 'social', 'youtube'],
    awareness: ['youtube', 'display', 'social', 'radio'],
    blended: ['search', 'maps', 'social', 'display'],
  };

  const priorityChannels = priorityMap[objective ?? 'blended'] || priorityMap.blended;

  // Add priority channels that are affordable and not excluded
  for (const channel of priorityChannels) {
    if (
      affordableChannels.includes(channel) &&
      !profile?.excludedChannels?.includes(channel)
    ) {
      channels.push(channel);
    }
  }

  // Add required channels from profile
  if (profile?.requiredChannels) {
    for (const ch of profile.requiredChannels) {
      if (!channels.includes(ch)) {
        channels.push(ch);
      }
    }
  }

  return channels;
}

/**
 * Get channel metadata
 */
export function getChannelMetadata(channel: MediaChannel): ChannelMetadata | undefined {
  return CHANNEL_METADATA[channel];
}

/**
 * Get all channels in a category
 */
export function getChannelsByCategory(
  category: ChannelMetadata['category']
): MediaChannel[] {
  return (Object.entries(CHANNEL_METADATA) as [MediaChannel, ChannelMetadata][])
    .filter(([, meta]) => meta.category === category)
    .map(([ch]) => ch);
}

// ============================================================================
// Benchmark Comparison
// ============================================================================

/**
 * Compare actual performance to benchmarks
 */
export function compareToBenchmarks(
  channel: MediaChannel,
  actualCpa: number,
  actualCtr?: number,
  profile?: MediaProfile,
  industry?: IndustryVertical
): {
  cpaVsBenchmark: number;      // % difference (negative = better)
  ctrVsBenchmark?: number;     // % difference (positive = better)
  performance: 'excellent' | 'good' | 'average' | 'below_average' | 'poor';
  recommendation: string;
} {
  const benchmarks = getChannelBenchmarks(channel, profile, industry);

  const cpaVsBenchmark = ((actualCpa - benchmarks.cpa) / benchmarks.cpa) * 100;

  let ctrVsBenchmark: number | undefined;
  if (actualCtr !== undefined) {
    ctrVsBenchmark = ((actualCtr - benchmarks.ctr) / benchmarks.ctr) * 100;
  }

  // Determine overall performance
  let performance: 'excellent' | 'good' | 'average' | 'below_average' | 'poor';
  if (cpaVsBenchmark <= -20) performance = 'excellent';
  else if (cpaVsBenchmark <= -5) performance = 'good';
  else if (cpaVsBenchmark <= 10) performance = 'average';
  else if (cpaVsBenchmark <= 25) performance = 'below_average';
  else performance = 'poor';

  // Generate recommendation
  let recommendation: string;
  switch (performance) {
    case 'excellent':
      recommendation = 'Performance is exceptional. Consider increasing budget allocation.';
      break;
    case 'good':
      recommendation = 'Performance is above average. Maintain current strategy.';
      break;
    case 'average':
      recommendation = 'Performance is on par with benchmarks. Look for optimization opportunities.';
      break;
    case 'below_average':
      recommendation = 'Performance is below benchmarks. Review targeting and creative.';
      break;
    case 'poor':
      recommendation = 'Performance is significantly below benchmarks. Consider pausing and restructuring.';
      break;
  }

  return {
    cpaVsBenchmark,
    ctrVsBenchmark,
    performance,
    recommendation,
  };
}

// ============================================================================
// Budget Efficiency Scoring
// ============================================================================

/**
 * Calculate efficiency score for a channel allocation
 */
export function calculateChannelEfficiencyScore(
  channel: MediaChannel,
  budget: number,
  profile?: MediaProfile,
  industry?: IndustryVertical
): {
  score: number;           // 0-100
  expectedAcquisitions: number;
  costEfficiency: 'high' | 'medium' | 'low';
} {
  const benchmarks = getChannelBenchmarks(channel, profile, industry);
  const metadata = CHANNEL_METADATA[channel];

  // Calculate expected acquisitions
  const expectedAcquisitions = Math.floor(budget / benchmarks.cpa);

  // If no metadata available for this channel, return baseline scores
  if (!metadata) {
    return {
      score: 50,
      expectedAcquisitions,
      costEfficiency: 'medium',
    };
  }

  // Score based on:
  // 1. Budget vs minimum (is budget adequate?)
  // 2. CPA relative to other channels
  // 3. Channel category fit

  let score = 50; // Start at baseline

  // Budget adequacy (0-20 points)
  const budgetRatio = budget / metadata.minMonthlyBudget;
  if (budgetRatio >= 3) score += 20;
  else if (budgetRatio >= 1.5) score += 15;
  else if (budgetRatio >= 1) score += 10;
  else score -= 10; // Penalty for under-budget

  // CPA efficiency (0-30 points)
  const avgCpa = Object.values(DEFAULT_BASELINE_CPA).reduce((a, b) => a + b) /
    Object.values(DEFAULT_BASELINE_CPA).length;
  if (benchmarks.cpa < avgCpa * 0.6) score += 30;
  else if (benchmarks.cpa < avgCpa * 0.8) score += 20;
  else if (benchmarks.cpa < avgCpa) score += 10;
  else if (benchmarks.cpa > avgCpa * 1.5) score -= 10;

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  const costEfficiency: 'high' | 'medium' | 'low' =
    score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';

  return {
    score,
    expectedAcquisitions,
    costEfficiency,
  };
}
