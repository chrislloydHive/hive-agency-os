// lib/contextGraph/domains/storeRisk.ts
// Store/Location & Risk Domain

import { z } from 'zod';
import { WithMeta, WithMetaArray } from '../types';
import { HealthStatus } from '../enums';

/**
 * Store Location definition
 */
export const StoreLocation = z.object({
  name: z.string(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zip: z.string().nullable(),
  storeId: z.string().nullable(),
  gbpStatus: HealthStatus.nullable(),
  gbpRating: z.number().nullable(),
  reviewCount: z.number().nullable(),
  isActive: z.boolean().default(true),
  performance: z.enum(['strong', 'average', 'weak']).nullable(),
  notes: z.string().nullable(),
});

export type StoreLocation = z.infer<typeof StoreLocation>;

/**
 * Risk Factor definition
 */
export const RiskFactor = z.object({
  category: z.enum(['market', 'operational', 'competitive', 'regulatory', 'financial', 'reputational', 'other']),
  title: z.string(),
  description: z.string().nullable(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  likelihood: z.enum(['high', 'medium', 'low']).nullable(),
  mitigation: z.string().nullable(),
});

export type RiskFactor = z.infer<typeof RiskFactor>;

/**
 * Competitor definition
 */
export const Competitor = z.object({
  name: z.string(),
  website: z.string().nullable(),
  threatLevel: z.enum(['primary', 'secondary', 'emerging']).nullable(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  estimatedSpend: z.string().nullable(),
  notes: z.string().nullable(),
});

export type Competitor = z.infer<typeof Competitor>;

/**
 * StoreRisk domain captures location health, competitive landscape, and risk factors.
 * This informs local strategy and risk mitigation.
 */
export const StoreRiskDomain = z.object({
  // Store Locations
  storeLocations: WithMetaArray(StoreLocation),
  storeCount: WithMeta(z.number()),
  avgStoreRating: WithMeta(z.number()),
  totalReviews: WithMeta(z.number()),

  // GBP Health
  gbpOverallHealth: WithMeta(HealthStatus),
  gbpCoverage: WithMeta(z.number()),
  gbpOptimization: WithMeta(z.string()),
  gbpIssues: WithMetaArray(z.string()),

  // Local Performance
  localSearchVisibility: WithMeta(z.number()),
  localPackRankings: WithMeta(z.string()),
  citationHealth: WithMeta(HealthStatus),
  reviewStrategy: WithMeta(z.string()),

  // Competitive Landscape
  competitors: WithMetaArray(Competitor),
  primaryCompetitors: WithMetaArray(z.string()),
  competitivePosition: WithMeta(z.string()),
  marketShare: WithMeta(z.number()),
  competitiveAdvantages: WithMetaArray(z.string()),
  competitiveDisadvantages: WithMetaArray(z.string()),

  // Market Context
  marketSize: WithMeta(z.string()),
  marketGrowth: WithMeta(z.string()),
  marketTrends: WithMetaArray(z.string()),
  marketOpportunities: WithMetaArray(z.string()),
  marketThreats: WithMetaArray(z.string()),

  // Risk Factors
  riskFactors: WithMetaArray(RiskFactor),
  overallRiskLevel: WithMeta(z.enum(['low', 'medium', 'high', 'critical'])),
  riskMitigation: WithMeta(z.string()),

  // Regulatory
  regulatoryConsiderations: WithMetaArray(z.string()),
  complianceStatus: WithMeta(z.string()),
  industryRegulations: WithMetaArray(z.string()),

  // Reputation
  reputationScore: WithMeta(z.number()),
  reputationSummary: WithMeta(z.string()),
  sentimentAnalysis: WithMeta(z.string()),
  reputationRisks: WithMetaArray(z.string()),
});

export type StoreRiskDomain = z.infer<typeof StoreRiskDomain>;

/**
 * Create an empty StoreRisk domain
 */
export function createEmptyStoreRiskDomain(): StoreRiskDomain {
  return {
    storeLocations: { value: [], provenance: [] },
    storeCount: { value: null, provenance: [] },
    avgStoreRating: { value: null, provenance: [] },
    totalReviews: { value: null, provenance: [] },
    gbpOverallHealth: { value: null, provenance: [] },
    gbpCoverage: { value: null, provenance: [] },
    gbpOptimization: { value: null, provenance: [] },
    gbpIssues: { value: [], provenance: [] },
    localSearchVisibility: { value: null, provenance: [] },
    localPackRankings: { value: null, provenance: [] },
    citationHealth: { value: null, provenance: [] },
    reviewStrategy: { value: null, provenance: [] },
    competitors: { value: [], provenance: [] },
    primaryCompetitors: { value: [], provenance: [] },
    competitivePosition: { value: null, provenance: [] },
    marketShare: { value: null, provenance: [] },
    competitiveAdvantages: { value: [], provenance: [] },
    competitiveDisadvantages: { value: [], provenance: [] },
    marketSize: { value: null, provenance: [] },
    marketGrowth: { value: null, provenance: [] },
    marketTrends: { value: [], provenance: [] },
    marketOpportunities: { value: [], provenance: [] },
    marketThreats: { value: [], provenance: [] },
    riskFactors: { value: [], provenance: [] },
    overallRiskLevel: { value: null, provenance: [] },
    riskMitigation: { value: null, provenance: [] },
    regulatoryConsiderations: { value: [], provenance: [] },
    complianceStatus: { value: null, provenance: [] },
    industryRegulations: { value: [], provenance: [] },
    reputationScore: { value: null, provenance: [] },
    reputationSummary: { value: null, provenance: [] },
    sentimentAnalysis: { value: null, provenance: [] },
    reputationRisks: { value: [], provenance: [] },
  };
}
