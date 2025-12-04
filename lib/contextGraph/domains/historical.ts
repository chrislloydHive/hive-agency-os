// lib/contextGraph/domains/historical.ts
// Historical Performance Domain

import { z } from 'zod';
import { WithMeta, WithMetaArray } from '../types';
import { MediaChannelId } from '../enums';

/**
 * Channel performance summary
 */
export const ChannelPerformanceSummary = z.object({
  channelId: MediaChannelId,
  spend: z.number().nullable(),
  revenue: z.number().nullable(),
  conversions: z.number().nullable(),
  cpa: z.number().nullable(),
  roas: z.number().nullable(),
  notes: z.string().nullable(),
});

export type ChannelPerformanceSummary = z.infer<typeof ChannelPerformanceSummary>;

/**
 * Historical Performance domain captures past media performance and learnings.
 * This informs future planning and optimization decisions.
 */
export const HistoricalDomain = z.object({
  // Spend History
  pastSpendByChannelSummary: WithMeta(z.string()),
  pastPerformanceSummary: WithMeta(z.string()),

  // Channel Contributions
  channelContributionSummary: WithMeta(z.string()),
  channelPerformanceHistory: WithMetaArray(ChannelPerformanceSummary),

  // Seasonal & Geographic
  seasonalityOverlays: WithMeta(z.string()),
  storeOrGeoPerformance: WithMeta(z.string()),

  // Measurement & Attribution
  incrementalityNotes: WithMeta(z.string()),
  attributionModelHistory: WithMeta(z.string()),
  measurementNotes: WithMeta(z.string()),

  // Performance Benchmarks
  historicalCpa: WithMeta(z.number()),
  historicalRoas: WithMeta(z.number()),
  historicalConversionRate: WithMeta(z.number()),

  // Learnings
  keyLearnings: WithMetaArray(z.string()),
  failedExperiments: WithMetaArray(z.string()),
  successfulTactics: WithMetaArray(z.string()),
});

export type HistoricalDomain = z.infer<typeof HistoricalDomain>;

/**
 * Create an empty Historical domain
 */
export function createEmptyHistoricalDomain(): HistoricalDomain {
  return {
    pastSpendByChannelSummary: { value: null, provenance: [] },
    pastPerformanceSummary: { value: null, provenance: [] },
    channelContributionSummary: { value: null, provenance: [] },
    channelPerformanceHistory: { value: [], provenance: [] },
    seasonalityOverlays: { value: null, provenance: [] },
    storeOrGeoPerformance: { value: null, provenance: [] },
    incrementalityNotes: { value: null, provenance: [] },
    attributionModelHistory: { value: null, provenance: [] },
    measurementNotes: { value: null, provenance: [] },
    historicalCpa: { value: null, provenance: [] },
    historicalRoas: { value: null, provenance: [] },
    historicalConversionRate: { value: null, provenance: [] },
    keyLearnings: { value: [], provenance: [] },
    failedExperiments: { value: [], provenance: [] },
    successfulTactics: { value: [], provenance: [] },
  };
}
