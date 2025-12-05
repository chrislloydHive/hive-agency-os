// lib/contextGraph/domains/identity.ts
// Identity & Business Context Domain

import { z } from 'zod';
import { WithMeta, WithMetaArray } from '../types';
import { BusinessModel, MarketMaturity } from '../enums';

/**
 * Identity domain captures core business identity and context.
 * This is the foundation for understanding who the company is.
 */
export const IdentityDomain = z.object({
  // Core Identity
  businessName: WithMeta(z.string()),
  industry: WithMeta(z.string()),
  businessModel: WithMeta(BusinessModel),
  revenueModel: WithMeta(z.string()),

  // ICP (Ideal Customer Profile) - Canonical definition
  // This is the PRIMARY constraint for Audience Lab and other Labs
  icpDescription: WithMeta(z.string()), // Full description of the ideal customer

  // Market Position
  marketMaturity: WithMeta(MarketMaturity),
  geographicFootprint: WithMeta(z.string()),
  serviceArea: WithMeta(z.string()),

  // Competitive Context
  competitiveLandscape: WithMeta(z.string()),
  marketPosition: WithMeta(z.string()),
  primaryCompetitors: WithMetaArray(z.string()),

  // Seasonality
  seasonalityNotes: WithMeta(z.string()),
  peakSeasons: WithMetaArray(z.string()),
  lowSeasons: WithMetaArray(z.string()),

  // Business Constraints
  profitCenters: WithMetaArray(z.string()),
  revenueStreams: WithMetaArray(z.string()),
});

export type IdentityDomain = z.infer<typeof IdentityDomain>;

/**
 * Create an empty Identity domain
 */
export function createEmptyIdentityDomain(): IdentityDomain {
  return {
    businessName: { value: null, provenance: [] },
    industry: { value: null, provenance: [] },
    businessModel: { value: null, provenance: [] },
    revenueModel: { value: null, provenance: [] },
    icpDescription: { value: null, provenance: [] },
    marketMaturity: { value: null, provenance: [] },
    geographicFootprint: { value: null, provenance: [] },
    serviceArea: { value: null, provenance: [] },
    competitiveLandscape: { value: null, provenance: [] },
    marketPosition: { value: null, provenance: [] },
    primaryCompetitors: { value: [], provenance: [] },
    seasonalityNotes: { value: null, provenance: [] },
    peakSeasons: { value: [], provenance: [] },
    lowSeasons: { value: [], provenance: [] },
    profitCenters: { value: [], provenance: [] },
    revenueStreams: { value: [], provenance: [] },
  };
}
