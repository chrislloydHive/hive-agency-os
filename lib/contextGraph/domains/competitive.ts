// lib/contextGraph/domains/competitive.ts
// Competitive Context Domain

import { z } from 'zod';
import { WithMeta, WithMetaArray } from '../types';

/**
 * Competitor profile
 */
export const CompetitorProfile = z.object({
  name: z.string(),
  website: z.string().nullable(),
  estimatedBudget: z.number().nullable(),
  primaryChannels: z.array(z.string()).default([]),
  strengths: z.string().nullable(),
  weaknesses: z.string().nullable(),
  notes: z.string().nullable(),
});

export type CompetitorProfile = z.infer<typeof CompetitorProfile>;

/**
 * Competitive domain captures competitive intelligence and market positioning.
 * This informs competitive strategy and differentiation.
 */
export const CompetitiveDomain = z.object({
  // Market Position
  shareOfVoice: WithMeta(z.string()),
  marketPosition: WithMeta(z.string()),
  competitiveAdvantages: WithMetaArray(z.string()),

  // Competitor Analysis
  primaryCompetitors: WithMetaArray(CompetitorProfile),
  competitorMediaMix: WithMeta(z.string()),
  competitorBudgets: WithMeta(z.string()),
  competitorSearchStrategy: WithMeta(z.string()),
  competitorCreativeThemes: WithMetaArray(z.string()),

  // Benchmarks
  categoryBenchmarks: WithMeta(z.string()),
  categoryCpa: WithMeta(z.number()),
  categoryRoas: WithMeta(z.number()),
  categoryCtr: WithMeta(z.number()),

  // Threats & Opportunities
  competitiveThreats: WithMetaArray(z.string()),
  competitiveOpportunities: WithMetaArray(z.string()),
  marketTrends: WithMetaArray(z.string()),

  // Differentiation
  differentiationStrategy: WithMeta(z.string()),
  uniqueValueProps: WithMetaArray(z.string()),
});

export type CompetitiveDomain = z.infer<typeof CompetitiveDomain>;

/**
 * Create an empty Competitive domain
 */
export function createEmptyCompetitiveDomain(): CompetitiveDomain {
  return {
    shareOfVoice: { value: null, provenance: [] },
    marketPosition: { value: null, provenance: [] },
    competitiveAdvantages: { value: [], provenance: [] },
    primaryCompetitors: { value: [], provenance: [] },
    competitorMediaMix: { value: null, provenance: [] },
    competitorBudgets: { value: null, provenance: [] },
    competitorSearchStrategy: { value: null, provenance: [] },
    competitorCreativeThemes: { value: [], provenance: [] },
    categoryBenchmarks: { value: null, provenance: [] },
    categoryCpa: { value: null, provenance: [] },
    categoryRoas: { value: null, provenance: [] },
    categoryCtr: { value: null, provenance: [] },
    competitiveThreats: { value: [], provenance: [] },
    competitiveOpportunities: { value: [], provenance: [] },
    marketTrends: { value: [], provenance: [] },
    differentiationStrategy: { value: null, provenance: [] },
    uniqueValueProps: { value: [], provenance: [] },
  };
}
