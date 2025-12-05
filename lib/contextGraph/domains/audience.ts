// lib/contextGraph/domains/audience.ts
// Audience & Targeting Domain

import { z } from 'zod';
import { WithMeta, WithMetaArray } from '../types';
import { FunnelStage } from '../enums';

/**
 * Audience Segment definition
 */
export const AudienceSegment = z.object({
  name: z.string(),
  description: z.string().nullable(),
  size: z.string().nullable(),
  priority: z.enum(['primary', 'secondary', 'tertiary']).nullable(),
  demographics: z.string().nullable(),
  behaviors: z.string().nullable(),
});

export type AudienceSegment = z.infer<typeof AudienceSegment>;

/**
 * Persona Brief - compact summary of a persona
 */
export const PersonaBrief = z.object({
  name: z.string(),
  tagline: z.string().nullable(),
  oneSentenceSummary: z.string().nullable(),
  priority: z.string().nullable(),
});

export type PersonaBrief = z.infer<typeof PersonaBrief>;

/**
 * Company Profile for B2B ICP
 */
export const CompanyProfile = z.object({
  sizeRange: z.string().nullable(), // e.g., "SMB", "Mid-Market", "Enterprise", "1-50", "50-200"
  stage: z.string().nullable(), // e.g., "Startup", "Growth", "Mature", "Enterprise"
  industries: z.array(z.string()).nullable(), // e.g., ["SaaS", "Healthcare", "Finance"]
});

export type CompanyProfile = z.infer<typeof CompanyProfile>;

/**
 * Audience domain captures target audience insights and targeting data.
 * This informs media targeting and creative personalization.
 */
export const AudienceDomain = z.object({
  // ============================================================================
  // CANONICAL ICP FIELDS - These are the PRIMARY constraint for Labs
  // ============================================================================

  // Primary audience description (who we serve)
  primaryAudience: WithMeta(z.string()),

  // Primary buyer roles (decision makers, influencers)
  primaryBuyerRoles: WithMetaArray(z.string()),

  // Company profile for B2B (target company characteristics)
  companyProfile: WithMeta(CompanyProfile),

  // ============================================================================
  // Core Segments (derived from ICP by Audience Lab)
  // ============================================================================
  coreSegments: WithMetaArray(z.string()),
  segmentDetails: WithMetaArray(AudienceSegment),

  // Demographics
  demographics: WithMeta(z.string()),
  ageRanges: WithMetaArray(z.string()),
  genderSplit: WithMeta(z.string()),
  incomeLevel: WithMeta(z.string()),
  educationLevel: WithMeta(z.string()),

  // Geography
  geos: WithMeta(z.string()),
  primaryMarkets: WithMetaArray(z.string()),
  secondaryMarkets: WithMetaArray(z.string()),
  excludedGeos: WithMetaArray(z.string()),

  // Behavioral
  behavioralDrivers: WithMetaArray(z.string()),
  purchaseBehaviors: WithMetaArray(z.string()),
  mediaConsumption: WithMeta(z.string()),
  deviceUsage: WithMeta(z.string()),

  // Demand States
  demandStates: WithMetaArray(z.string()),
  funnelDistribution: WithMeta(z.record(FunnelStage, z.number())),
  buyerJourney: WithMeta(z.string()),

  // Media Habits
  mediaHabits: WithMeta(z.string()),
  preferredChannels: WithMetaArray(z.string()),
  contentPreferences: WithMetaArray(z.string()),

  // Cultural & Language
  culturalNuances: WithMeta(z.string()),
  languages: WithMetaArray(z.string()),
  primaryLanguage: WithMeta(z.string()),

  // Audience Needs
  audienceNeeds: WithMetaArray(z.string()),
  painPoints: WithMetaArray(z.string()),
  motivations: WithMetaArray(z.string()),

  // Persona Data (from Audience Lab Personas)
  personaNames: WithMetaArray(z.string()),
  personaBriefs: WithMetaArray(PersonaBrief),
  audienceTriggers: WithMetaArray(z.string()),
  audienceObjections: WithMetaArray(z.string()),
  decisionFactors: WithMetaArray(z.string()),
  keyMessages: WithMetaArray(z.string()),
  proofPointsNeeded: WithMetaArray(z.string()),
  exampleHooks: WithMetaArray(z.string()),
  contentFormatsPreferred: WithMetaArray(z.string()),
  toneGuidance: WithMeta(z.string()),
});

export type AudienceDomain = z.infer<typeof AudienceDomain>;

/**
 * Create an empty Audience domain
 */
export function createEmptyAudienceDomain(): AudienceDomain {
  return {
    // Canonical ICP fields
    primaryAudience: { value: null, provenance: [] },
    primaryBuyerRoles: { value: [], provenance: [] },
    companyProfile: { value: null, provenance: [] },

    // Core Segments
    coreSegments: { value: [], provenance: [] },
    segmentDetails: { value: [], provenance: [] },
    demographics: { value: null, provenance: [] },
    ageRanges: { value: [], provenance: [] },
    genderSplit: { value: null, provenance: [] },
    incomeLevel: { value: null, provenance: [] },
    educationLevel: { value: null, provenance: [] },
    geos: { value: null, provenance: [] },
    primaryMarkets: { value: [], provenance: [] },
    secondaryMarkets: { value: [], provenance: [] },
    excludedGeos: { value: [], provenance: [] },
    behavioralDrivers: { value: [], provenance: [] },
    purchaseBehaviors: { value: [], provenance: [] },
    mediaConsumption: { value: null, provenance: [] },
    deviceUsage: { value: null, provenance: [] },
    demandStates: { value: [], provenance: [] },
    funnelDistribution: { value: null, provenance: [] },
    buyerJourney: { value: null, provenance: [] },
    mediaHabits: { value: null, provenance: [] },
    preferredChannels: { value: [], provenance: [] },
    contentPreferences: { value: [], provenance: [] },
    culturalNuances: { value: null, provenance: [] },
    languages: { value: [], provenance: [] },
    primaryLanguage: { value: null, provenance: [] },
    audienceNeeds: { value: [], provenance: [] },
    painPoints: { value: [], provenance: [] },
    motivations: { value: [], provenance: [] },

    // Persona Data
    personaNames: { value: [], provenance: [] },
    personaBriefs: { value: [], provenance: [] },
    audienceTriggers: { value: [], provenance: [] },
    audienceObjections: { value: [], provenance: [] },
    decisionFactors: { value: [], provenance: [] },
    keyMessages: { value: [], provenance: [] },
    proofPointsNeeded: { value: [], provenance: [] },
    exampleHooks: { value: [], provenance: [] },
    contentFormatsPreferred: { value: [], provenance: [] },
    toneGuidance: { value: null, provenance: [] },
  };
}
