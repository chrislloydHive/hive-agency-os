// lib/contextGraph/domains/performanceMedia.ts
// Performance Media Domain

import { z } from 'zod';
import { WithMeta, WithMetaArray } from '../types';
import { MediaChannelId, HealthStatus } from '../enums';

/**
 * Channel Performance definition
 */
export const ChannelPerformance = z.object({
  channel: MediaChannelId,
  status: z.enum(['active', 'paused', 'inactive', 'planned']),
  monthlySpend: z.number().nullable(),
  cpa: z.number().nullable(),
  roas: z.number().nullable(),
  conversions: z.number().nullable(),
  impressions: z.number().nullable(),
  clicks: z.number().nullable(),
  ctr: z.number().nullable(),
  cpc: z.number().nullable(),
  qualityScore: z.number().nullable(),
  notes: z.string().nullable(),
});

export type ChannelPerformance = z.infer<typeof ChannelPerformance>;

/**
 * Campaign definition
 */
export const Campaign = z.object({
  name: z.string(),
  channel: MediaChannelId,
  objective: z.string().nullable(),
  status: z.enum(['active', 'paused', 'completed', 'planned']),
  budget: z.number().nullable(),
  spend: z.number().nullable(),
  performance: z.string().nullable(),
});

export type Campaign = z.infer<typeof Campaign>;

/**
 * PerformanceMedia domain captures paid media performance and channel health.
 * This informs media planning and budget allocation.
 */
export const PerformanceMediaDomain = z.object({
  // Overall Performance
  mediaScore: WithMeta(z.number()),
  mediaSummary: WithMeta(z.string()),
  overallHealth: WithMeta(HealthStatus),

  // Spend & Efficiency
  totalMonthlySpend: WithMeta(z.number()),
  blendedCpa: WithMeta(z.number()),
  blendedRoas: WithMeta(z.number()),
  blendedCtr: WithMeta(z.number()),

  // Channel Performance
  channelPerformance: WithMetaArray(ChannelPerformance),
  activeChannels: WithMetaArray(MediaChannelId),
  topPerformingChannel: WithMeta(MediaChannelId),
  underperformingChannels: WithMetaArray(MediaChannelId),

  // Campaign Data
  activeCampaigns: WithMetaArray(Campaign),
  campaignCount: WithMeta(z.number()),

  // Attribution
  attributionModel: WithMeta(z.string()),
  conversionWindow: WithMeta(z.string()),
  crossChannelAttribution: WithMeta(z.string()),

  // Audience & Targeting
  audienceTargeting: WithMeta(z.string()),
  remarketingStatus: WithMeta(z.string()),
  lookalikeAudiences: WithMeta(z.string()),
  firstPartyData: WithMeta(z.string()),

  // Creative Performance
  creativeRotation: WithMeta(z.string()),
  topCreatives: WithMetaArray(z.string()),
  creativeWearout: WithMeta(z.string()),
  creativeTesting: WithMeta(z.string()),

  // Platform Health
  googleAdsHealth: WithMeta(HealthStatus),
  metaAdsHealth: WithMeta(HealthStatus),
  linkedInAdsHealth: WithMeta(HealthStatus),
  microsoftAdsHealth: WithMeta(HealthStatus),

  // Optimization
  biddingStrategy: WithMeta(z.string()),
  automationLevel: WithMeta(z.string()),
  optimizationCadence: WithMeta(z.string()),
  testingRoadmap: WithMeta(z.string()),

  // Issues & Opportunities
  mediaIssues: WithMetaArray(z.string()),
  mediaOpportunities: WithMetaArray(z.string()),
  quickWins: WithMetaArray(z.string()),
});

export type PerformanceMediaDomain = z.infer<typeof PerformanceMediaDomain>;

/**
 * Create an empty PerformanceMedia domain
 */
export function createEmptyPerformanceMediaDomain(): PerformanceMediaDomain {
  return {
    mediaScore: { value: null, provenance: [] },
    mediaSummary: { value: null, provenance: [] },
    overallHealth: { value: null, provenance: [] },
    totalMonthlySpend: { value: null, provenance: [] },
    blendedCpa: { value: null, provenance: [] },
    blendedRoas: { value: null, provenance: [] },
    blendedCtr: { value: null, provenance: [] },
    channelPerformance: { value: [], provenance: [] },
    activeChannels: { value: [], provenance: [] },
    topPerformingChannel: { value: null, provenance: [] },
    underperformingChannels: { value: [], provenance: [] },
    activeCampaigns: { value: [], provenance: [] },
    campaignCount: { value: null, provenance: [] },
    attributionModel: { value: null, provenance: [] },
    conversionWindow: { value: null, provenance: [] },
    crossChannelAttribution: { value: null, provenance: [] },
    audienceTargeting: { value: null, provenance: [] },
    remarketingStatus: { value: null, provenance: [] },
    lookalikeAudiences: { value: null, provenance: [] },
    firstPartyData: { value: null, provenance: [] },
    creativeRotation: { value: null, provenance: [] },
    topCreatives: { value: [], provenance: [] },
    creativeWearout: { value: null, provenance: [] },
    creativeTesting: { value: null, provenance: [] },
    googleAdsHealth: { value: null, provenance: [] },
    metaAdsHealth: { value: null, provenance: [] },
    linkedInAdsHealth: { value: null, provenance: [] },
    microsoftAdsHealth: { value: null, provenance: [] },
    biddingStrategy: { value: null, provenance: [] },
    automationLevel: { value: null, provenance: [] },
    optimizationCadence: { value: null, provenance: [] },
    testingRoadmap: { value: null, provenance: [] },
    mediaIssues: { value: [], provenance: [] },
    mediaOpportunities: { value: [], provenance: [] },
    quickWins: { value: [], provenance: [] },
  };
}
