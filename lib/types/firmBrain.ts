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

/** Permission levels for case studies */
export type CaseStudyPermission = 'public' | 'internal';

/** Legacy permission values - mapped to new values on read */
export type CaseStudyPermissionLegacy = 'public' | 'nda_allowed' | 'internal_only';

/** Structured metric (legacy format) */
export const CaseStudyMetricSchema = z.object({
  label: z.string(),
  value: z.string(),
  context: z.string().optional(),
});

export type CaseStudyMetric = z.infer<typeof CaseStudyMetricSchema>;

/** Flexible metrics - supports both array format and object format */
export const CaseStudyMetricsSchema = z.union([
  z.array(CaseStudyMetricSchema),
  z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
]).default([]);

export type CaseStudyMetrics = z.infer<typeof CaseStudyMetricsSchema>;

// ============================================================================
// Case Study Visuals
// ============================================================================

/** Visual types for case study media */
export const CaseStudyVisualTypeSchema = z.enum([
  'hero',        // Main hero image/video
  'campaign',    // Campaign imagery
  'before_after', // Before/after comparison
  'process',     // Process/methodology shots
  'detail',      // Detail shots
]);

export type CaseStudyVisualType = z.infer<typeof CaseStudyVisualTypeSchema>;

/** Media types for visuals */
export const CaseStudyMediaTypeSchema = z.enum(['image', 'video']);

export type CaseStudyMediaType = z.infer<typeof CaseStudyMediaTypeSchema>;

/** Individual visual asset for a case study */
export const CaseStudyVisualSchema = z.object({
  id: z.string(),
  type: CaseStudyVisualTypeSchema,
  mediaType: CaseStudyMediaTypeSchema,
  title: z.string().optional(),
  caption: z.string().optional(),
  assetUrl: z.string().url(),
  originalUrl: z.string().url().optional(), // Original source URL before upload
  linkUrl: z.string().url().optional(), // For video embeds or external links
  posterUrl: z.string().url().optional(), // Poster image for videos (uploaded)
  thumbnailUrl: z.string().url().optional(), // Alias for posterUrl (legacy)
  order: z.number().int().min(0).default(0),
  visibility: z.enum(['public', 'internal']).default('internal'),
});

export type CaseStudyVisual = z.infer<typeof CaseStudyVisualSchema>;

export const CaseStudyVisualInputSchema = CaseStudyVisualSchema.omit({ id: true });

export type CaseStudyVisualInput = z.infer<typeof CaseStudyVisualInputSchema>;

// ============================================================================
// Case Study Client Logo
// ============================================================================

/** Logo source - auto-ingested or manually confirmed */
export const CaseStudyLogoSourceSchema = z.enum(['auto', 'manual']);
export type CaseStudyLogoSource = z.infer<typeof CaseStudyLogoSourceSchema>;

/** Client logo configuration */
export const CaseStudyClientLogoSchema = z.object({
  assetUrl: z.string().url(),
  fallbackUrl: z.string().url().optional(), // Fallback for SVG or dark mode
  alt: z.string(),
  theme: z.enum(['light', 'dark']).optional(), // Which background the logo is optimized for
  variant: z.enum(['full', 'mark']).optional(), // Full wordmark or logo mark only
  visibility: z.enum(['public', 'internal']).default('public'),
  source: CaseStudyLogoSourceSchema.default('auto'), // auto = ingested, manual = user-confirmed
});

export type CaseStudyClientLogo = z.infer<typeof CaseStudyClientLogoSchema>;

// ============================================================================
// Case Study Main Schema
// ============================================================================

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
  metrics: CaseStudyMetricsSchema,
  assets: z.array(z.string()).default([]), // Legacy: URLs to images, decks, etc.
  tags: z.array(z.string()).default([]),
  permissionLevel: z.enum(['public', 'internal']).default('internal'),
  visibility: z.enum(['public', 'internal']).default('internal'), // Alias for permissionLevel
  caseStudyUrl: z.string().url().nullable().optional(),
  // V2: Rich media support
  visuals: z.array(CaseStudyVisualSchema).default([]),
  clientLogo: CaseStudyClientLogoSchema.nullable().optional(),
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

/** Helper to normalize legacy permission values */
export function normalizePermissionLevel(value: string | null | undefined): CaseStudyPermission {
  if (!value) return 'internal';
  if (value === 'public') return 'public';
  // Map legacy values to 'internal'
  if (value === 'internal_only' || value === 'nda_allowed' || value === 'internal') {
    return 'internal';
  }
  return 'internal';
}

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
// Pricing Templates (Simplified - Airtable Fields)
// ============================================================================

/** Airtable attachment schema */
export const AirtableAttachmentSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  filename: z.string(),
  size: z.number().optional(),
  type: z.string().optional(),
  thumbnails: z.object({
    small: z.object({ url: z.string(), width: z.number(), height: z.number() }).optional(),
    large: z.object({ url: z.string(), width: z.number(), height: z.number() }).optional(),
    full: z.object({ url: z.string(), width: z.number(), height: z.number() }).optional(),
  }).optional(),
});
export type AirtableAttachment = z.infer<typeof AirtableAttachmentSchema>;

/** Linked opportunity summary (from linked records) */
export const LinkedOpportunitySchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type LinkedOpportunity = z.infer<typeof LinkedOpportunitySchema>;

/** Main Pricing Template schema (Simplified) */
export const PricingTemplateSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().default(''),
  linkedAgencyId: z.string().nullable().optional(),
  examplePricingFiles: z.array(AirtableAttachmentSchema).default([]),
  relevantOpportunities: z.array(LinkedOpportunitySchema).default([]),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export type PricingTemplate = z.infer<typeof PricingTemplateSchema>;

/** Input schema for creating/updating pricing templates */
export const PricingTemplateInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  linkedAgencyId: z.string().nullable().optional(),
  // examplePricingFiles are managed via Airtable attachments, not API input
  // relevantOpportunities are read-only linked records
});

export type PricingTemplateInput = z.infer<typeof PricingTemplateInputSchema>;

/** Filter options for listing pricing templates */
export interface ListPricingTemplatesOptions {
  q?: string;
  hasFile?: boolean;
  hasOpportunities?: boolean;
}

/** Description scaffold sections for guided editing */
export const PRICING_TEMPLATE_SCAFFOLD = `Best for:

Typical range:

Billing:

Includes:

Excludes:

Common add-ons:

Pricing modifiers:

Notes:
`;

/** Known section labels in description text */
export const DESCRIPTION_SECTION_LABELS = [
  'Best for',
  'Typical range',
  'Billing',
  'Includes',
  'Excludes',
  'Common add-ons',
  'Pricing modifiers',
  'Notes',
] as const;

export type DescriptionSectionLabel = typeof DESCRIPTION_SECTION_LABELS[number];

/** Parsed description section */
export interface DescriptionSection {
  label: DescriptionSectionLabel | string;
  content: string;
}

/**
 * Parse a plain text description into labeled sections
 * Detects lines starting with known labels (e.g., "Best for:", "Includes:")
 */
export function parseDescriptionSections(description: string): DescriptionSection[] {
  if (!description.trim()) return [];

  const sections: DescriptionSection[] = [];
  const lines = description.split('\n');
  let currentSection: DescriptionSection | null = null;

  for (const line of lines) {
    // Check if line starts with a known label pattern (Label:)
    const labelMatch = line.match(/^([A-Za-z][A-Za-z\s-]+):\s*(.*)/);

    if (labelMatch) {
      // Save previous section
      if (currentSection) {
        currentSection.content = currentSection.content.trim();
        if (currentSection.content || currentSection.label) {
          sections.push(currentSection);
        }
      }

      // Start new section
      currentSection = {
        label: labelMatch[1].trim(),
        content: labelMatch[2] || '',
      };
    } else if (currentSection) {
      // Append to current section
      currentSection.content += (currentSection.content ? '\n' : '') + line;
    } else if (line.trim()) {
      // Content before any label - treat as unlabeled intro
      currentSection = { label: '', content: line };
    }
  }

  // Add final section
  if (currentSection) {
    currentSection.content = currentSection.content.trim();
    if (currentSection.content || currentSection.label) {
      sections.push(currentSection);
    }
  }

  return sections;
}

/**
 * Get a short preview of the description (first 2 lines, max 150 chars)
 */
export function getDescriptionPreview(description: string, maxLength = 150): string {
  if (!description) return '';
  const lines = description.split('\n').filter(l => l.trim());
  const preview = lines.slice(0, 2).join(' ');
  if (preview.length <= maxLength) return preview;
  return preview.slice(0, maxLength - 3) + '...';
}

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
