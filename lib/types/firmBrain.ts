// lib/types/firmBrain.ts
// Types for Firm Brain (Settings) entities
// Used for RFP generation and agency-wide knowledge management

import { z } from 'zod';

// ============================================================================
// Agency Profile
// ============================================================================

export const AgencyProfileSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  oneLiner: z.string().nullable(),
  overviewLong: z.string().nullable(),
  differentiators: z.array(z.string()).default([]),
  services: z.array(z.string()).default([]),
  industries: z.array(z.string()).default([]),
  approachSummary: z.string().nullable(),
  collaborationModel: z.string().nullable(),
  aiStyleGuide: z.string().nullable(),
  defaultAssumptions: z.array(z.string()).default([]),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export type AgencyProfile = z.infer<typeof AgencyProfileSchema>;

export const AgencyProfileInputSchema = AgencyProfileSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AgencyProfileInput = z.infer<typeof AgencyProfileInputSchema>;

// ============================================================================
// Team Members
// ============================================================================

export type TeamMemberAvailability = 'available' | 'limited' | 'unavailable';
export type TeamMemberFunction =
  | 'strategy'
  | 'creative'
  | 'media'
  | 'analytics'
  | 'development'
  | 'project_management'
  | 'account'
  | 'leadership';

export const TeamMemberSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  role: z.string().min(1),
  bio: z.string().nullable(),
  strengths: z.array(z.string()).default([]),
  functions: z.array(z.string()).default([]),
  availabilityStatus: z.enum(['available', 'limited', 'unavailable']).default('available'),
  defaultOnRfp: z.boolean().default(false),
  headshotUrl: z.string().url().nullable(),
  linkedinUrl: z.string().url().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export type TeamMember = z.infer<typeof TeamMemberSchema>;

export const TeamMemberInputSchema = TeamMemberSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type TeamMemberInput = z.infer<typeof TeamMemberInputSchema>;

// ============================================================================
// Case Studies
// ============================================================================

export type CaseStudyPermission = 'public' | 'nda_allowed' | 'internal_only';

export const CaseStudyMetricSchema = z.object({
  label: z.string(),
  value: z.string(),
  context: z.string().optional(),
});

export type CaseStudyMetric = z.infer<typeof CaseStudyMetricSchema>;

export const CaseStudySchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  client: z.string().min(1),
  industry: z.string().nullable(),
  services: z.array(z.string()).default([]),
  summary: z.string().nullable(),
  problem: z.string().nullable(),
  approach: z.string().nullable(),
  outcome: z.string().nullable(),
  metrics: z.array(CaseStudyMetricSchema).default([]),
  assets: z.array(z.string()).default([]), // URLs to images, decks, etc.
  tags: z.array(z.string()).default([]),
  permissionLevel: z.enum(['public', 'nda_allowed', 'internal_only']).default('internal_only'),
  caseStudyUrl: z.string().url().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export type CaseStudy = z.infer<typeof CaseStudySchema>;

export const CaseStudyInputSchema = CaseStudySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CaseStudyInput = z.infer<typeof CaseStudyInputSchema>;

// ============================================================================
// References
// ============================================================================

export type ReferencePermissionStatus = 'confirmed' | 'pending' | 'declined' | 'expired';

export const ReferenceSchema = z.object({
  id: z.string(),
  client: z.string().min(1),
  contactName: z.string().min(1),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  engagementType: z.string().nullable(), // e.g., "Retainer", "Project", "AOR"
  industries: z.array(z.string()).default([]),
  permissionStatus: z.enum(['confirmed', 'pending', 'declined', 'expired']).default('pending'),
  notes: z.string().nullable(),
  lastConfirmedAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export type Reference = z.infer<typeof ReferenceSchema>;

export const ReferenceInputSchema = ReferenceSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ReferenceInput = z.infer<typeof ReferenceInputSchema>;

// ============================================================================
// Pricing Templates
// ============================================================================

export const PricingLineItemSchema = z.object({
  id: z.string(),
  category: z.string(),
  description: z.string(),
  unit: z.enum(['hourly', 'monthly', 'fixed', 'percentage']),
  rate: z.number().nullable(),
  quantity: z.number().nullable(),
  optional: z.boolean().default(false),
});

export type PricingLineItem = z.infer<typeof PricingLineItemSchema>;

export const PricingOptionSetSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  multiplier: z.number().default(1),
  includedLineItemIds: z.array(z.string()),
});

export type PricingOptionSet = z.infer<typeof PricingOptionSetSchema>;

export const PricingTemplateSchema = z.object({
  id: z.string(),
  templateName: z.string().min(1),
  useCase: z.string().nullable(), // e.g., "Website Redesign", "Brand Strategy"
  lineItems: z.array(PricingLineItemSchema).default([]),
  assumptions: z.array(z.string()).default([]),
  exclusions: z.array(z.string()).default([]),
  optionSets: z.array(PricingOptionSetSchema).default([]),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export type PricingTemplate = z.infer<typeof PricingTemplateSchema>;

export const PricingTemplateInputSchema = PricingTemplateSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PricingTemplateInput = z.infer<typeof PricingTemplateInputSchema>;

// ============================================================================
// Plan Templates
// ============================================================================

export const PlanPhaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  duration: z.string().optional(), // e.g., "2 weeks", "1 month"
  deliverables: z.array(z.string()).default([]),
  milestones: z.array(z.string()).default([]),
  order: z.number(),
});

export type PlanPhase = z.infer<typeof PlanPhaseSchema>;

export const PlanDependencySchema = z.object({
  fromPhaseId: z.string(),
  toPhaseId: z.string(),
  type: z.enum(['finish_to_start', 'start_to_start', 'finish_to_finish']).default('finish_to_start'),
});

export type PlanDependency = z.infer<typeof PlanDependencySchema>;

export const PlanTemplateSchema = z.object({
  id: z.string(),
  templateName: z.string().min(1),
  useCase: z.string().nullable(),
  phases: z.array(PlanPhaseSchema).default([]),
  dependencies: z.array(PlanDependencySchema).default([]),
  typicalTimeline: z.string().nullable(), // e.g., "8-12 weeks"
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export type PlanTemplate = z.infer<typeof PlanTemplateSchema>;

export const PlanTemplateInputSchema = PlanTemplateSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PlanTemplateInput = z.infer<typeof PlanTemplateInputSchema>;

// ============================================================================
// Firm Brain Aggregate (for RFP generation context)
// ============================================================================

export interface FirmBrainSnapshot {
  agencyProfile: AgencyProfile | null;
  teamMembers: TeamMember[];
  caseStudies: CaseStudy[];
  references: Reference[];
  pricingTemplates: PricingTemplate[];
  planTemplates: PlanTemplate[];
  snapshotAt: string;
}

// ============================================================================
// Firm Brain Health (for Settings UI)
// ============================================================================

export interface FirmBrainHealth {
  hasAgencyProfile: boolean;
  teamMemberCount: number;
  caseStudyCount: number;
  referenceCount: number;
  confirmedReferenceCount: number;
  pricingTemplateCount: number;
  planTemplateCount: number;
  completenessScore: number; // 0-100
  readyForRfp: boolean;
  missingForRfp: string[];
}

export function computeFirmBrainHealth(snapshot: FirmBrainSnapshot): FirmBrainHealth {
  const missing: string[] = [];

  const hasProfile = !!snapshot.agencyProfile?.name;
  if (!hasProfile) missing.push('Agency Profile');

  const teamCount = snapshot.teamMembers.length;
  if (teamCount === 0) missing.push('Team Members');

  const caseCount = snapshot.caseStudies.length;
  if (caseCount === 0) missing.push('Case Studies');

  const refCount = snapshot.references.length;
  const confirmedRefCount = snapshot.references.filter(r => r.permissionStatus === 'confirmed').length;
  if (confirmedRefCount === 0) missing.push('Confirmed References');

  const pricingCount = snapshot.pricingTemplates.length;
  const planCount = snapshot.planTemplates.length;

  // Completeness score: weighted average
  const weights = {
    profile: 25,
    team: 20,
    cases: 20,
    refs: 15,
    pricing: 10,
    plans: 10,
  };

  let score = 0;
  if (hasProfile) score += weights.profile;
  if (teamCount >= 3) score += weights.team;
  else if (teamCount >= 1) score += weights.team * 0.5;
  if (caseCount >= 3) score += weights.cases;
  else if (caseCount >= 1) score += weights.cases * (caseCount / 3);
  if (confirmedRefCount >= 2) score += weights.refs;
  else if (confirmedRefCount >= 1) score += weights.refs * 0.5;
  if (pricingCount >= 1) score += weights.pricing;
  if (planCount >= 1) score += weights.plans;

  return {
    hasAgencyProfile: hasProfile,
    teamMemberCount: teamCount,
    caseStudyCount: caseCount,
    referenceCount: refCount,
    confirmedReferenceCount: confirmedRefCount,
    pricingTemplateCount: pricingCount,
    planTemplateCount: planCount,
    completenessScore: Math.round(score),
    readyForRfp: missing.length === 0,
    missingForRfp: missing,
  };
}
