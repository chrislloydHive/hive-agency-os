// lib/contextGraph/domains/website.ts
// Website & Conversion Domain

import { z } from 'zod';
import { WithMeta, WithMetaArray } from '../types';
import { HealthStatus } from '../enums';

/**
 * Funnel Issue definition
 */
export const FunnelIssue = z.object({
  title: z.string(),
  description: z.string().nullable(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  impact: z.string().nullable(),
  recommendation: z.string().nullable(),
});

export type FunnelIssue = z.infer<typeof FunnelIssue>;

/**
 * Page Assessment definition
 */
export const PageAssessment = z.object({
  url: z.string(),
  pageType: z.string().nullable(),
  score: z.number().nullable(),
  issues: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export type PageAssessment = z.infer<typeof PageAssessment>;

/**
 * Website domain captures website health, UX, and conversion insights.
 * This informs landing page strategy and creative requirements.
 */
export const WebsiteDomain = z.object({
  // Overall Health
  websiteScore: WithMeta(z.number()),
  websiteSummary: WithMeta(z.string()),
  executiveSummary: WithMeta(z.string()),

  // Core Web Vitals
  coreWebVitals: WithMeta(z.object({
    lcp: z.number().nullable(),
    fid: z.number().nullable(),
    cls: z.number().nullable(),
    overall: HealthStatus.nullable(),
  })),
  pageSpeedScore: WithMeta(z.number()),
  mobileScore: WithMeta(z.number()),

  // Funnel Analysis
  funnelIssues: WithMetaArray(FunnelIssue),
  conversionBlocks: WithMetaArray(z.string()),
  conversionOpportunities: WithMetaArray(z.string()),

  // Page Assessments
  pageAssessments: WithMetaArray(PageAssessment),
  landingPageQuality: WithMeta(z.string()),
  formExperience: WithMeta(z.string()),

  // Infrastructure
  infraNotes: WithMetaArray(z.string()),
  hasContactForm: WithMeta(z.boolean()),
  hasPhoneNumbers: WithMeta(z.boolean()),
  hasLiveChat: WithMeta(z.boolean()),
  hasChatbot: WithMeta(z.boolean()),

  // Technical
  sslStatus: WithMeta(HealthStatus),
  mobileResponsive: WithMeta(z.boolean()),
  accessibilityScore: WithMeta(z.number()),

  // Recommendations
  criticalIssues: WithMetaArray(z.string()),
  quickWins: WithMetaArray(z.string()),
  recommendations: WithMetaArray(z.string()),
});

export type WebsiteDomain = z.infer<typeof WebsiteDomain>;

/**
 * Create an empty Website domain
 */
export function createEmptyWebsiteDomain(): WebsiteDomain {
  return {
    websiteScore: { value: null, provenance: [] },
    websiteSummary: { value: null, provenance: [] },
    executiveSummary: { value: null, provenance: [] },
    coreWebVitals: { value: null, provenance: [] },
    pageSpeedScore: { value: null, provenance: [] },
    mobileScore: { value: null, provenance: [] },
    funnelIssues: { value: [], provenance: [] },
    conversionBlocks: { value: [], provenance: [] },
    conversionOpportunities: { value: [], provenance: [] },
    pageAssessments: { value: [], provenance: [] },
    landingPageQuality: { value: null, provenance: [] },
    formExperience: { value: null, provenance: [] },
    infraNotes: { value: [], provenance: [] },
    hasContactForm: { value: null, provenance: [] },
    hasPhoneNumbers: { value: null, provenance: [] },
    hasLiveChat: { value: null, provenance: [] },
    hasChatbot: { value: null, provenance: [] },
    sslStatus: { value: null, provenance: [] },
    mobileResponsive: { value: null, provenance: [] },
    accessibilityScore: { value: null, provenance: [] },
    criticalIssues: { value: [], provenance: [] },
    quickWins: { value: [], provenance: [] },
    recommendations: { value: [], provenance: [] },
  };
}
