// lib/contextGraph/domains/ops.ts
// Operations & Capacity Domain

import { z } from 'zod';
import { WithMeta, WithMetaArray } from '../types';

/**
 * Location definition
 */
export const Location = z.object({
  name: z.string(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zip: z.string().nullable(),
  country: z.string().nullable(),
  isPrimary: z.boolean().default(false),
  isActive: z.boolean().default(true),
  serviceRadius: z.string().nullable(),
});

export type Location = z.infer<typeof Location>;

/**
 * Team Member definition
 */
export const TeamMember = z.object({
  role: z.string(),
  count: z.number().default(1),
  isInternal: z.boolean().default(true),
  notes: z.string().nullable(),
});

export type TeamMember = z.infer<typeof TeamMember>;

/**
 * Ops domain captures operational capacity, team structure, and constraints.
 * This informs what's feasible for media scaling and creative production.
 */
export const OpsDomain = z.object({
  // Team Structure
  teamSummary: WithMeta(z.string()),
  teamSize: WithMeta(z.number()),
  teamMembers: WithMetaArray(TeamMember),
  hasMarketingTeam: WithMeta(z.boolean()),
  hasCreativeTeam: WithMeta(z.boolean()),
  hasAnalyticsTeam: WithMeta(z.boolean()),

  // Agency & Partners
  agencyPartners: WithMetaArray(z.string()),
  agencyRelationship: WithMeta(z.string()),
  agencyScope: WithMeta(z.string()),

  // Locations
  locations: WithMetaArray(Location),
  locationCount: WithMeta(z.number()),
  serviceAreas: WithMetaArray(z.string()),
  primaryServiceArea: WithMeta(z.string()),

  // Capacity
  operationalCapacity: WithMeta(z.string()),
  leadCapacity: WithMeta(z.string()),
  fulfillmentCapacity: WithMeta(z.string()),
  peakCapacity: WithMeta(z.string()),

  // Constraints
  operationalConstraints: WithMetaArray(z.string()),
  resourceLimitations: WithMetaArray(z.string()),
  scalingBlockers: WithMetaArray(z.string()),

  // Hours & Availability
  operatingHours: WithMeta(z.string()),
  seasonalVariation: WithMeta(z.string()),
  peakSeasons: WithMetaArray(z.string()),
  slowSeasons: WithMetaArray(z.string()),

  // Systems
  techStack: WithMetaArray(z.string()),
  crmSystem: WithMeta(z.string()),
  schedulingSystem: WithMeta(z.string()),
  inventorySystem: WithMeta(z.string()),

  // Process Efficiency
  processMaturity: WithMeta(z.string()),
  automationLevel: WithMeta(z.string()),
  responseTime: WithMeta(z.string()),
});

export type OpsDomain = z.infer<typeof OpsDomain>;

/**
 * Create an empty Ops domain
 */
export function createEmptyOpsDomain(): OpsDomain {
  return {
    teamSummary: { value: null, provenance: [] },
    teamSize: { value: null, provenance: [] },
    teamMembers: { value: [], provenance: [] },
    hasMarketingTeam: { value: null, provenance: [] },
    hasCreativeTeam: { value: null, provenance: [] },
    hasAnalyticsTeam: { value: null, provenance: [] },
    agencyPartners: { value: [], provenance: [] },
    agencyRelationship: { value: null, provenance: [] },
    agencyScope: { value: null, provenance: [] },
    locations: { value: [], provenance: [] },
    locationCount: { value: null, provenance: [] },
    serviceAreas: { value: [], provenance: [] },
    primaryServiceArea: { value: null, provenance: [] },
    operationalCapacity: { value: null, provenance: [] },
    leadCapacity: { value: null, provenance: [] },
    fulfillmentCapacity: { value: null, provenance: [] },
    peakCapacity: { value: null, provenance: [] },
    operationalConstraints: { value: [], provenance: [] },
    resourceLimitations: { value: [], provenance: [] },
    scalingBlockers: { value: [], provenance: [] },
    operatingHours: { value: null, provenance: [] },
    seasonalVariation: { value: null, provenance: [] },
    peakSeasons: { value: [], provenance: [] },
    slowSeasons: { value: [], provenance: [] },
    techStack: { value: [], provenance: [] },
    crmSystem: { value: null, provenance: [] },
    schedulingSystem: { value: null, provenance: [] },
    inventorySystem: { value: null, provenance: [] },
    processMaturity: { value: null, provenance: [] },
    automationLevel: { value: null, provenance: [] },
    responseTime: { value: null, provenance: [] },
  };
}
