// lib/contextGraph/domains/operationalConstraints.ts
// Operational Constraints Domain

import { z } from 'zod';
import { WithMeta, WithMetaArray } from '../types';

/**
 * Budget cap/floor definition
 */
export const BudgetCapFloor = z.object({
  type: z.enum(['cap', 'floor']),
  scope: z.enum(['total', 'channel', 'campaign', 'geo']),
  scopeId: z.string().nullable(),
  amount: z.number(),
  period: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'annual']),
  reason: z.string().nullable(),
});

export type BudgetCapFloor = z.infer<typeof BudgetCapFloor>;

/**
 * Channel restriction definition
 */
export const ChannelRestriction = z.object({
  channelId: z.string(),
  restrictionType: z.enum(['prohibited', 'requires_approval', 'limited_budget', 'seasonal_only']),
  reason: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
});

export type ChannelRestriction = z.infer<typeof ChannelRestriction>;

/**
 * OperationalConstraints domain captures operational limitations and requirements.
 * This informs planning feasibility and execution constraints.
 */
export const OperationalConstraintsDomain = z.object({
  // Budget Constraints
  budgetCapsFloors: WithMetaArray(BudgetCapFloor),
  minBudget: WithMeta(z.number()),
  maxBudget: WithMeta(z.number()),
  brandVsPerformanceRules: WithMeta(z.string()),

  // Budget Allocation
  testingBudgetNotes: WithMeta(z.string()),
  creativeBudgetNotes: WithMeta(z.string()),
  reportingBudgetNotes: WithMeta(z.string()),

  // Pacing & Timing
  pacingRequirements: WithMeta(z.string()),
  launchDeadlines: WithMetaArray(z.string()),
  blackoutPeriods: WithMetaArray(z.string()),

  // Channel Restrictions
  channelRestrictions: WithMetaArray(ChannelRestriction),
  requiredApprovals: WithMetaArray(z.string()),

  // Resource Constraints
  talentConstraints: WithMeta(z.string()),
  agencyCapabilities: WithMeta(z.string()),
  inHouseCapabilities: WithMeta(z.string()),

  // Compliance
  complianceRequirements: WithMetaArray(z.string()),
  legalRestrictions: WithMeta(z.string()),
  industryRegulations: WithMeta(z.string()),

  // Technical Constraints
  platformLimitations: WithMeta(z.string()),
  integrationConstraints: WithMeta(z.string()),
  dataAccessLimitations: WithMeta(z.string()),
});

export type OperationalConstraintsDomain = z.infer<typeof OperationalConstraintsDomain>;

/**
 * Create an empty OperationalConstraints domain
 */
export function createEmptyOperationalConstraintsDomain(): OperationalConstraintsDomain {
  return {
    budgetCapsFloors: { value: [], provenance: [] },
    minBudget: { value: null, provenance: [] },
    maxBudget: { value: null, provenance: [] },
    brandVsPerformanceRules: { value: null, provenance: [] },
    testingBudgetNotes: { value: null, provenance: [] },
    creativeBudgetNotes: { value: null, provenance: [] },
    reportingBudgetNotes: { value: null, provenance: [] },
    pacingRequirements: { value: null, provenance: [] },
    launchDeadlines: { value: [], provenance: [] },
    blackoutPeriods: { value: [], provenance: [] },
    channelRestrictions: { value: [], provenance: [] },
    requiredApprovals: { value: [], provenance: [] },
    talentConstraints: { value: null, provenance: [] },
    agencyCapabilities: { value: null, provenance: [] },
    inHouseCapabilities: { value: null, provenance: [] },
    complianceRequirements: { value: [], provenance: [] },
    legalRestrictions: { value: null, provenance: [] },
    industryRegulations: { value: null, provenance: [] },
    platformLimitations: { value: null, provenance: [] },
    integrationConstraints: { value: null, provenance: [] },
    dataAccessLimitations: { value: null, provenance: [] },
  };
}
