// lib/contextGraph/domains/seo.ts
// SEO & Organic Domain

import { z } from 'zod';
import { WithMeta, WithMetaArray } from '../types';
import { HealthStatus } from '../enums';

/**
 * Keyword Opportunity definition
 */
export const KeywordOpportunity = z.object({
  keyword: z.string(),
  searchVolume: z.number().nullable(),
  difficulty: z.number().nullable(),
  currentRank: z.number().nullable(),
  opportunityScore: z.number().nullable(),
  intent: z.enum(['informational', 'navigational', 'commercial', 'transactional']).nullable(),
});

export type KeywordOpportunity = z.infer<typeof KeywordOpportunity>;

/**
 * Technical SEO Issue definition
 */
export const TechnicalSeoIssue = z.object({
  title: z.string(),
  description: z.string().nullable(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  category: z.string().nullable(),
  affectedUrls: z.number().nullable(),
  recommendation: z.string().nullable(),
});

export type TechnicalSeoIssue = z.infer<typeof TechnicalSeoIssue>;

/**
 * SEO domain captures search visibility, organic performance, and keyword opportunities.
 * This informs SEO strategy and content priorities.
 */
export const SeoDomain = z.object({
  // Overall Health
  seoScore: WithMeta(z.number()),
  seoSummary: WithMeta(z.string()),

  // Visibility Metrics
  organicVisibility: WithMeta(z.number()),
  searchVisibilityTrend: WithMeta(z.string()),
  shareOfVoice: WithMeta(z.number()),

  // Ranking Data
  keywordsRanked: WithMeta(z.number()),
  keywordsTop10: WithMeta(z.number()),
  keywordsTop3: WithMeta(z.number()),
  avgPosition: WithMeta(z.number()),

  // Traffic
  organicTraffic: WithMeta(z.number()),
  organicTrafficTrend: WithMeta(z.string()),
  organicConversions: WithMeta(z.number()),

  // Keywords
  topKeywords: WithMetaArray(z.string()),
  brandedKeywords: WithMetaArray(z.string()),
  nonBrandedKeywords: WithMetaArray(z.string()),
  keywordOpportunities: WithMetaArray(KeywordOpportunity),

  // Backlinks
  backlinkProfile: WithMeta(z.string()),
  domainAuthority: WithMeta(z.number()),
  totalBacklinks: WithMeta(z.number()),
  referringDomains: WithMeta(z.number()),

  // Technical SEO
  technicalHealth: WithMeta(HealthStatus),
  technicalIssues: WithMetaArray(TechnicalSeoIssue),
  indexationStatus: WithMeta(z.string()),
  crawlability: WithMeta(z.string()),

  // Local SEO
  localSeoHealth: WithMeta(HealthStatus),
  localListings: WithMeta(z.string()),
  citationAccuracy: WithMeta(z.number()),

  // Content
  contentScore: WithMeta(z.number()),
  contentGaps: WithMetaArray(z.string()),
  contentOpportunities: WithMetaArray(z.string()),

  // Recommendations
  seoQuickWins: WithMetaArray(z.string()),
  seoRecommendations: WithMetaArray(z.string()),
});

export type SeoDomain = z.infer<typeof SeoDomain>;

/**
 * Create an empty SEO domain
 */
export function createEmptySeoDomain(): SeoDomain {
  return {
    seoScore: { value: null, provenance: [] },
    seoSummary: { value: null, provenance: [] },
    organicVisibility: { value: null, provenance: [] },
    searchVisibilityTrend: { value: null, provenance: [] },
    shareOfVoice: { value: null, provenance: [] },
    keywordsRanked: { value: null, provenance: [] },
    keywordsTop10: { value: null, provenance: [] },
    keywordsTop3: { value: null, provenance: [] },
    avgPosition: { value: null, provenance: [] },
    organicTraffic: { value: null, provenance: [] },
    organicTrafficTrend: { value: null, provenance: [] },
    organicConversions: { value: null, provenance: [] },
    topKeywords: { value: [], provenance: [] },
    brandedKeywords: { value: [], provenance: [] },
    nonBrandedKeywords: { value: [], provenance: [] },
    keywordOpportunities: { value: [], provenance: [] },
    backlinkProfile: { value: null, provenance: [] },
    domainAuthority: { value: null, provenance: [] },
    totalBacklinks: { value: null, provenance: [] },
    referringDomains: { value: null, provenance: [] },
    technicalHealth: { value: null, provenance: [] },
    technicalIssues: { value: [], provenance: [] },
    indexationStatus: { value: null, provenance: [] },
    crawlability: { value: null, provenance: [] },
    localSeoHealth: { value: null, provenance: [] },
    localListings: { value: null, provenance: [] },
    citationAccuracy: { value: null, provenance: [] },
    contentScore: { value: null, provenance: [] },
    contentGaps: { value: [], provenance: [] },
    contentOpportunities: { value: [], provenance: [] },
    seoQuickWins: { value: [], provenance: [] },
    seoRecommendations: { value: [], provenance: [] },
  };
}
