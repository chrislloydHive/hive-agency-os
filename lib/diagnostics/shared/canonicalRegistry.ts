// lib/diagnostics/shared/canonicalRegistry.ts
// Canonical Contract Registry - defines required canonical fields per Lab type
//
// Each Lab must guarantee these fields exist in their output:
// - Either populated with meaningful content
// - Or explicitly null (never {}, never [], never missing)
//
// This registry is used by:
// - ensureCanonical() to validate and fill missing fields
// - Context Graph writers to know what to expect
// - Strategy/GAP to safely assume field availability

// ============================================================================
// Types
// ============================================================================

/**
 * Lab types that produce canonical outputs
 */
export type LabType =
  | 'brand'
  | 'website'
  | 'seo'
  | 'content'
  | 'audience'
  | 'competition'
  | 'demand'
  | 'ops';

/**
 * Canonical field types
 */
export type CanonicalFieldType = 'string' | 'array' | 'object' | 'number';

/**
 * Single canonical field specification
 */
export interface CanonicalFieldSpec {
  /** Dot-path within findings/canonical object (e.g., 'positioning.statement') */
  path: string;
  /** Human-readable label */
  label: string;
  /** Expected type */
  type: CanonicalFieldType;
  /** Whether this field is required (must have value or explicit null) */
  required: boolean;
  /** For arrays: minimum items required (0 = empty allowed if not required) */
  minItems?: number;
  /** For strings: minimum length required */
  minLength?: number;
  /** Description for documentation */
  description?: string;
}

/**
 * Lab canonical specification
 */
export interface LabCanonicalSpec {
  /** Lab type identifier */
  labType: LabType;
  /** Human-readable lab name */
  labName: string;
  /** Required canonical fields */
  fields: CanonicalFieldSpec[];
  /** Context Graph domain this lab writes to */
  targetDomain: string;
  /** Context Graph field paths this lab writes */
  targetPaths: string[];
}

// ============================================================================
// Canonical Specifications per Lab
// ============================================================================

/**
 * Brand Lab canonical specification
 * Canonical fields used by Strategy Frame
 */
export const BRAND_LAB_SPEC: LabCanonicalSpec = {
  labType: 'brand',
  labName: 'Brand Lab',
  targetDomain: 'brand',
  targetPaths: [
    'brand.positioning',
    'productOffer.valueProposition',
    'brand.differentiators',
    'audience.primaryAudience',
    'brand.toneDescriptor',
    'brand.messagingPillars',
  ],
  fields: [
    {
      path: 'positioning.statement',
      label: 'Positioning Statement',
      type: 'string',
      required: true,
      minLength: 15,
      description: 'Customer-facing positioning statement (1-2 sentences)',
    },
    {
      path: 'positioning.summary',
      label: 'Positioning Summary',
      type: 'string',
      required: false,
      description: 'Rationale/summary referencing on-site signals',
    },
    {
      path: 'valueProp.headline',
      label: 'Value Proposition Headline',
      type: 'string',
      required: true,
      minLength: 5,
      description: 'Short value prop headline',
    },
    {
      path: 'valueProp.description',
      label: 'Value Proposition Description',
      type: 'string',
      required: false,
      description: 'Extended description (1-2 sentences)',
    },
    {
      path: 'differentiators.bullets',
      label: 'Differentiators',
      type: 'array',
      required: true,
      minItems: 1,
      description: 'Key differentiators (3-7 bullets)',
    },
    {
      path: 'icp.primaryAudience',
      label: 'Primary Audience',
      type: 'string',
      required: true,
      minLength: 10,
      description: 'Primary audience description (1-2 sentences)',
    },
    {
      path: 'icp.buyerRoles',
      label: 'Buyer Roles',
      type: 'array',
      required: false,
      description: 'Buyer roles (optional)',
    },
    {
      path: 'toneOfVoice.descriptor',
      label: 'Tone of Voice',
      type: 'string',
      required: false,
      description: 'Brand tone descriptor',
    },
    {
      path: 'messaging.pillars',
      label: 'Messaging Pillars',
      type: 'array',
      required: false,
      minItems: 0,
      description: 'Messaging pillars (3-6 items)',
    },
  ],
};

/**
 * Website Lab canonical specification
 * Canonical fields for UX/conversion context
 */
export const WEBSITE_LAB_SPEC: LabCanonicalSpec = {
  labType: 'website',
  labName: 'Website Lab',
  targetDomain: 'website',
  targetPaths: [
    'website.uxMaturity',
    'website.conversionMaturity',
    'website.primaryCta',
    'website.funnelStages',
    'website.keyIssues',
  ],
  fields: [
    {
      path: 'uxMaturity',
      label: 'UX Maturity',
      type: 'string',
      required: true,
      description: 'UX maturity stage assessment',
    },
    {
      path: 'primaryCta',
      label: 'Primary CTA',
      type: 'string',
      required: true,
      minLength: 3,
      description: 'Primary call-to-action identified',
    },
    {
      path: 'conversionPath',
      label: 'Conversion Path',
      type: 'string',
      required: false,
      description: 'Primary conversion path description',
    },
    {
      path: 'topIssues',
      label: 'Top UX Issues',
      type: 'array',
      required: true,
      minItems: 0,
      description: 'Top UX/conversion issues identified',
    },
    {
      path: 'mobileExperience',
      label: 'Mobile Experience',
      type: 'string',
      required: false,
      description: 'Mobile experience assessment',
    },
  ],
};

/**
 * SEO Lab canonical specification
 * Canonical fields for search context
 */
export const SEO_LAB_SPEC: LabCanonicalSpec = {
  labType: 'seo',
  labName: 'SEO Lab',
  targetDomain: 'seo',
  targetPaths: [
    'seo.maturityStage',
    'seo.topQueries',
    'seo.technicalHealth',
    'seo.authorityScore',
  ],
  fields: [
    {
      path: 'maturityStage',
      label: 'SEO Maturity',
      type: 'string',
      required: true,
      description: 'SEO maturity stage (unproven/emerging/scaling/established)',
    },
    {
      path: 'technicalHealth',
      label: 'Technical Health',
      type: 'string',
      required: true,
      description: 'Technical SEO health assessment',
    },
    {
      path: 'topQueries',
      label: 'Top Queries',
      type: 'array',
      required: false,
      minItems: 0,
      description: 'Top performing search queries',
    },
    {
      path: 'topIssues',
      label: 'Top SEO Issues',
      type: 'array',
      required: true,
      minItems: 0,
      description: 'Critical SEO issues identified',
    },
    {
      path: 'organicVisibility',
      label: 'Organic Visibility',
      type: 'string',
      required: false,
      description: 'Organic visibility summary',
    },
  ],
};

/**
 * Content Lab canonical specification
 * Canonical fields for content context
 */
export const CONTENT_LAB_SPEC: LabCanonicalSpec = {
  labType: 'content',
  labName: 'Content Lab',
  targetDomain: 'content',
  targetPaths: [
    'content.maturityStage',
    'content.contentTypes',
    'content.topTopics',
    'content.freshness',
  ],
  fields: [
    {
      path: 'maturityStage',
      label: 'Content Maturity',
      type: 'string',
      required: true,
      description: 'Content maturity stage',
    },
    {
      path: 'contentTypes',
      label: 'Content Types Present',
      type: 'array',
      required: true,
      minItems: 0,
      description: 'Types of content present (blog, case studies, etc.)',
    },
    {
      path: 'topTopics',
      label: 'Top Topics',
      type: 'array',
      required: false,
      minItems: 0,
      description: 'Primary content topics',
    },
    {
      path: 'freshness',
      label: 'Content Freshness',
      type: 'string',
      required: false,
      description: 'Content freshness assessment',
    },
    {
      path: 'topIssues',
      label: 'Content Issues',
      type: 'array',
      required: true,
      minItems: 0,
      description: 'Top content issues',
    },
  ],
};

/**
 * Competition Lab canonical specification
 * Canonical fields for competitive context
 */
export const COMPETITION_LAB_SPEC: LabCanonicalSpec = {
  labType: 'competition',
  labName: 'Competition Lab',
  targetDomain: 'competitive',
  targetPaths: [
    'competitive.competitors',
    'competitive.primaryCompetitors',
    'competitive.positionSummary',
    'competitive.threatLevel',
  ],
  fields: [
    {
      path: 'competitors',
      label: 'Competitors',
      type: 'array',
      required: true,
      minItems: 0,
      description: 'Validated competitor list',
    },
    {
      path: 'positionSummary',
      label: 'Competitive Position',
      type: 'string',
      required: true,
      minLength: 10,
      description: 'Summary of competitive positioning',
    },
    {
      path: 'threatLevel',
      label: 'Overall Threat Level',
      type: 'number',
      required: false,
      description: 'Overall competitive threat score (0-100)',
    },
    {
      path: 'differentiationAxes',
      label: 'Differentiation Axes',
      type: 'array',
      required: false,
      minItems: 0,
      description: 'Key axes of differentiation',
    },
  ],
};

/**
 * Audience Lab canonical specification
 * Canonical fields for audience context
 */
export const AUDIENCE_LAB_SPEC: LabCanonicalSpec = {
  labType: 'audience',
  labName: 'Audience Lab',
  targetDomain: 'audience',
  targetPaths: [
    'audience.primaryAudience',
    'audience.segments',
    'audience.painPoints',
    'audience.buyingBehavior',
  ],
  fields: [
    {
      path: 'primaryAudience',
      label: 'Primary Audience',
      type: 'string',
      required: true,
      minLength: 10,
      description: 'Primary audience description',
    },
    {
      path: 'segments',
      label: 'Audience Segments',
      type: 'array',
      required: false,
      minItems: 0,
      description: 'Identified audience segments',
    },
    {
      path: 'painPoints',
      label: 'Pain Points',
      type: 'array',
      required: false,
      minItems: 0,
      description: 'Customer pain points',
    },
    {
      path: 'buyingBehavior',
      label: 'Buying Behavior',
      type: 'string',
      required: false,
      description: 'Buying behavior insights',
    },
  ],
};

/**
 * Ops Lab canonical specification
 * Canonical fields for marketing ops context
 */
export const OPS_LAB_SPEC: LabCanonicalSpec = {
  labType: 'ops',
  labName: 'Ops Lab',
  targetDomain: 'ops',
  targetPaths: [
    'ops.maturityStage',
    'ops.trackingStack',
    'ops.topIssues',
  ],
  fields: [
    {
      path: 'maturityStage',
      label: 'Ops Maturity',
      type: 'string',
      required: true,
      description: 'Ops maturity stage (unproven/emerging/scaling/established)',
    },
    {
      path: 'trackingStack',
      label: 'Tracking Stack',
      type: 'array',
      required: true,
      minItems: 0,
      description: 'Detected tracking/analytics tools',
    },
    {
      path: 'hasAnalytics',
      label: 'Has Analytics',
      type: 'string',
      required: true,
      description: 'Whether analytics is configured (yes/no/partial)',
    },
    {
      path: 'topIssues',
      label: 'Top Ops Issues',
      type: 'array',
      required: true,
      minItems: 0,
      description: 'Critical ops issues identified',
    },
    {
      path: 'crmStatus',
      label: 'CRM Status',
      type: 'string',
      required: false,
      description: 'CRM integration status',
    },
  ],
};

/**
 * Demand Lab canonical specification
 * Canonical fields for demand generation context
 */
export const DEMAND_LAB_SPEC: LabCanonicalSpec = {
  labType: 'demand',
  labName: 'Demand Lab',
  targetDomain: 'demand',
  targetPaths: [
    'demand.maturityStage',
    'demand.channelMix',
    'demand.topIssues',
  ],
  fields: [
    {
      path: 'maturityStage',
      label: 'Demand Maturity',
      type: 'string',
      required: true,
      description: 'Demand generation maturity stage',
    },
    {
      path: 'primaryChannels',
      label: 'Primary Channels',
      type: 'array',
      required: true,
      minItems: 0,
      description: 'Primary demand channels in use',
    },
    {
      path: 'hasPaidTraffic',
      label: 'Has Paid Traffic',
      type: 'string',
      required: true,
      description: 'Whether paid traffic is detected (yes/no/unknown)',
    },
    {
      path: 'topIssues',
      label: 'Top Demand Issues',
      type: 'array',
      required: true,
      minItems: 0,
      description: 'Critical demand issues identified',
    },
    {
      path: 'conversionRate',
      label: 'Conversion Rate',
      type: 'number',
      required: false,
      description: 'Overall conversion rate if available',
    },
  ],
};

// ============================================================================
// Registry
// ============================================================================

/**
 * Complete registry of all Lab canonical specifications
 */
export const CANONICAL_REGISTRY: Record<LabType, LabCanonicalSpec> = {
  brand: BRAND_LAB_SPEC,
  website: WEBSITE_LAB_SPEC,
  seo: SEO_LAB_SPEC,
  content: CONTENT_LAB_SPEC,
  competition: COMPETITION_LAB_SPEC,
  audience: AUDIENCE_LAB_SPEC,
  demand: DEMAND_LAB_SPEC,
  ops: OPS_LAB_SPEC,
};

/**
 * Get canonical specification for a lab type
 */
export function getCanonicalSpec(labType: LabType): LabCanonicalSpec | null {
  return CANONICAL_REGISTRY[labType] || null;
}

/**
 * Get required paths for a lab type
 */
export function getRequiredPaths(labType: LabType): string[] {
  const spec = CANONICAL_REGISTRY[labType];
  if (!spec) return [];
  return spec.fields
    .filter((f) => f.required)
    .map((f) => f.path);
}

/**
 * Check if a lab type is registered
 */
export function isRegisteredLabType(labType: string): labType is LabType {
  return labType in CANONICAL_REGISTRY;
}
