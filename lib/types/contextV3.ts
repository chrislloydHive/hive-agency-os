// lib/types/contextV3.ts
// Context V3 - Extended Domain Model
//
// Extends Context V2 with additional domains while maintaining full backward compatibility.
// New domains:
// - businessReality: Extended company fundamentals (was companyReality)
// - constraints: Enhanced operational boundaries (unchanged from V2)
// - strategicIntent: Extended goals and positioning (enhanced from V2)
// - competitiveTruth: Structured competitive intelligence (new)
// - historicalDecisions: Past strategic decisions and rationale (new)
//
// Key principles:
// - All fields use ContextField<T> wrapper for provenance tracking
// - User-confirmed fields are protected from AI modification
// - V2 compatibility maintained through section mapping

import type {
  ContextField,
  ContextFieldMeta,
  ContextFieldSource,
  ContextConfidence,
  ContextLifecycleStatus,
  CompanyContextV2,
  CompanyRealitySection,
  MarketRealitySection,
  ConstraintsSection,
  StrategicIntentSection,
} from './contextV2';
import type { Competitor } from './context';

// Re-export V2 types for convenience
export type {
  ContextField,
  ContextFieldMeta,
  ContextFieldSource,
  ContextConfidence,
  ContextLifecycleStatus,
};
export { createField, isUserConfirmed, updateField, confirmField, flagForReview } from './contextV2';

// ============================================================================
// V3 Extended Domains
// ============================================================================

// ----------------------------------------------------------------------------
// Domain 1: Business Reality (Extended from V2 CompanyReality)
// ----------------------------------------------------------------------------

/**
 * Business fundamentals - who the company is and how it operates
 */
export interface BusinessRealityDomain {
  // === Inherited from V2 CompanyReality ===
  /** How the company makes money (e.g., "B2B SaaS", "marketplace") */
  businessModel?: ContextField<string>;
  /** Industry/vertical category */
  category?: ContextField<string>;
  /** Geographic focus */
  geography?: ContextField<string>;
  /** Company lifecycle stage */
  stage?: ContextField<string>;
  /** Core value proposition */
  valueProposition?: ContextField<string>;

  // === New in V3 ===
  /** Company founding date or age */
  founded?: ContextField<string>;
  /** Approximate headcount or team size */
  teamSize?: ContextField<string>;
  /** Funding stage/status */
  fundingStage?: ContextField<string>;
  /** Total funding raised (if applicable) */
  totalFunding?: ContextField<string>;
  /** Revenue range (e.g., "$1-5M ARR") */
  revenueRange?: ContextField<string>;
  /** Growth rate (e.g., "100% YoY") */
  growthRate?: ContextField<string>;
  /** Key products or services */
  products?: ContextField<string[]>;
  /** Primary business channels */
  channels?: ContextField<string[]>;
  /** Core capabilities or competencies */
  coreCapabilities?: ContextField<string[]>;
  /** Known weaknesses or gaps */
  knownWeaknesses?: ContextField<string[]>;
}

// ----------------------------------------------------------------------------
// Domain 2: Constraints (Enhanced from V2)
// ----------------------------------------------------------------------------

/**
 * Operational boundaries and resource constraints
 */
export interface ConstraintsDomain {
  // === Inherited from V2 ===
  /** Budget constraints/range */
  budget?: ContextField<string>;
  /** Regulatory considerations */
  regulatory?: ContextField<string>;
  /** Internal capabilities/limitations */
  internalCapabilities?: ContextField<string>;
  /** Known unknowns - things we need to figure out */
  knownUnknowns?: ContextField<string[]>;
  /** Timeline constraints */
  timeline?: ContextField<string>;
  /** General constraints notes */
  constraints?: ContextField<string>;

  // === New in V3 ===
  /** Marketing budget specifically */
  marketingBudget?: ContextField<string>;
  /** Technology constraints */
  technology?: ContextField<string[]>;
  /** Team bandwidth/capacity */
  teamCapacity?: ContextField<string>;
  /** Legal/compliance requirements */
  legal?: ContextField<string[]>;
  /** Brand guidelines or restrictions */
  brandGuidelines?: ContextField<string>;
  /** Geographic restrictions */
  geographicRestrictions?: ContextField<string[]>;
  /** Pricing constraints */
  pricing?: ContextField<string>;
  /** Channel restrictions (e.g., "no cold outbound") */
  channelRestrictions?: ContextField<string[]>;
}

// ----------------------------------------------------------------------------
// Domain 3: Strategic Intent (Enhanced from V2)
// ----------------------------------------------------------------------------

/**
 * Goals, positioning, and strategic direction
 */
export interface StrategicIntentDomain {
  // === Inherited from V2 ===
  /** Primary business objectives */
  primaryObjectives?: ContextField<string[]>;
  /** Things explicitly NOT pursuing */
  nonGoals?: ContextField<string[]>;
  /** How success will be measured */
  successDefinition?: ContextField<string>;
  /** Key metrics to track */
  keyMetrics?: ContextField<string[]>;

  // === New in V3 ===
  /** Company mission statement */
  mission?: ContextField<string>;
  /** Company vision */
  vision?: ContextField<string>;
  /** Strategic timeframe (e.g., "12 months", "3 years") */
  planningHorizon?: ContextField<string>;
  /** Priority order of objectives */
  priorityStack?: ContextField<string[]>;
  /** Target market position */
  targetPosition?: ContextField<string>;
  /** Key strategic bets */
  strategicBets?: ContextField<string[]>;
  /** Risk tolerance level */
  riskTolerance?: ContextField<'Conservative' | 'Moderate' | 'Aggressive'>;
  /** Growth mode */
  growthMode?: ContextField<'Efficiency' | 'Scale' | 'Blitz'>;
}

// ----------------------------------------------------------------------------
// Domain 4: Competitive Truth (NEW in V3)
// ----------------------------------------------------------------------------

/**
 * A single competitor entry with V3 enhanced structure
 */
export interface CompetitorV3 {
  /** Competitor domain/URL */
  domain: string;
  /** Competitor name */
  name?: string;
  /** How closely their offer overlaps with ours */
  offerOverlap?: 'High' | 'Medium' | 'Low';
  /** How closely they address the same JTBD */
  jtbdMatch?: 'High' | 'Medium' | 'Low';
  /** Data source for this competitor */
  source?: string;
  /** Classification: direct, indirect, substitute, aspirational */
  classification?: 'Direct' | 'Indirect' | 'Substitute' | 'Aspirational';
  /** Their primary positioning */
  positioning?: string;
  /** Their key strengths */
  strengths?: string[];
  /** Their key weaknesses */
  weaknesses?: string[];
  /** How we differentiate against them */
  differentiation?: string;
  /** Threat level assessment */
  threatLevel?: 'High' | 'Medium' | 'Low';
  /** Notes */
  notes?: string;
}

/**
 * Competitive intelligence - structured view of competitive landscape
 */
export interface CompetitiveTruthDomain {
  /** Our competitive category/market */
  category?: ContextField<string>;
  /** Our posture in the market */
  posture?: ContextField<'Leader' | 'Challenger' | 'Follower' | 'Niche'>;
  /** Structured competitor list */
  competitors?: ContextField<CompetitorV3[]>;
  /** Primary differentiators */
  differentiators?: ContextField<string[]>;
  /** Market signals and trends */
  marketSignals?: ContextField<string[]>;
  /** Jobs-to-be-done we address */
  jtbds?: ContextField<string[]>;
  /** Alternatives (not direct competitors) */
  alternatives?: ContextField<string[]>;
  /** Our unfair advantages */
  unfairAdvantages?: ContextField<string[]>;
  /** Areas where we're weak vs competition */
  competitiveWeaknesses?: ContextField<string[]>;
  /** Source of latest competition analysis */
  analysisSource?: ContextField<'competition_v4' | 'competition_v3' | 'user' | 'other'>;
  /** When competition was last analyzed */
  lastAnalyzed?: ContextField<string>;
}

// ----------------------------------------------------------------------------
// Domain 5: Historical Decisions (NEW in V3)
// ----------------------------------------------------------------------------

/**
 * A recorded strategic decision
 */
export interface StrategicDecision {
  /** Unique ID */
  id: string;
  /** When the decision was made */
  date: string;
  /** What was decided */
  decision: string;
  /** Why this decision was made */
  rationale?: string;
  /** What alternatives were considered */
  alternatives?: string[];
  /** Who made or approved this decision */
  madeBy?: string;
  /** What was the outcome (if known) */
  outcome?: string;
  /** Whether this decision is still in effect */
  status: 'Active' | 'Superseded' | 'Reversed';
  /** What superseded this decision (if applicable) */
  supersededBy?: string;
  /** Tags for categorization */
  tags?: string[];
}

/**
 * Historical record of strategic decisions and their outcomes
 */
export interface HistoricalDecisionsDomain {
  /** Strategic decisions made */
  decisions?: ContextField<StrategicDecision[]>;
  /** Past strategic pivots */
  pivots?: ContextField<string[]>;
  /** Lessons learned from past decisions */
  lessonsLearned?: ContextField<string[]>;
  /** What we tried that didn't work */
  failedExperiments?: ContextField<string[]>;
  /** What we tried that worked well */
  successfulExperiments?: ContextField<string[]>;
  /** Recurring themes in our decisions */
  decisionPatterns?: ContextField<string[]>;
}

// ============================================================================
// Audience Domain (NEW in V3 - pulled from MarketReality)
// ============================================================================

/**
 * A single audience segment
 */
export interface AudienceSegment {
  /** Segment identifier */
  id: string;
  /** Segment name */
  name: string;
  /** Description of who they are */
  description?: string;
  /** Is this the primary target? */
  isPrimary?: boolean;
  /** Jobs they're trying to get done */
  jtbds?: string[];
  /** Key pain points */
  painPoints?: string[];
  /** What they value most */
  values?: string[];
  /** Where to find them */
  channels?: string[];
  /** How they make decisions */
  decisionProcess?: string;
  /** Source of this segment data */
  source?: ContextFieldSource;
  /** Confidence in this segment */
  confidence?: ContextConfidence;
}

/**
 * Audience intelligence - who we serve and how
 */
export interface AudienceDomain {
  /** High-level audience summary */
  summary?: ContextField<string>;
  /** Primary target audience */
  primaryAudience?: ContextField<string>;
  /** Secondary target audience */
  secondaryAudience?: ContextField<string>;
  /** ICP description */
  icpDescription?: ContextField<string>;
  /** Detailed audience segments */
  segments?: ContextField<AudienceSegment[]>;
  /** What they have in common */
  commonThreads?: ContextField<string[]>;
  /** Audience size estimate */
  marketSize?: ContextField<string>;
  /** Source of latest audience analysis */
  analysisSource?: ContextField<'audience_lab' | 'user' | 'other'>;
  /** When audience was last analyzed */
  lastAnalyzed?: ContextField<string>;
}

// ============================================================================
// Context V3 - Full Structure
// ============================================================================

/**
 * Context V3 - Extended company context with additional domains
 */
export interface CompanyContextV3 {
  /** Database record ID */
  id?: string;
  /** Company ID this context belongs to */
  companyId: string;
  /** Context version */
  version: 'v3';

  // ========== Lifecycle ==========
  /** Current lifecycle status */
  status: ContextLifecycleStatus;
  /** Revision ID for optimistic concurrency */
  revisionId?: string;

  // ========== Domains ==========
  /** Domain 1: Business Reality - who the company is */
  businessReality: BusinessRealityDomain;
  /** Domain 2: Audience - who we serve */
  audience: AudienceDomain;
  /** Domain 3: Competitive Truth - market positioning */
  competitiveTruth: CompetitiveTruthDomain;
  /** Domain 4: Constraints - operational boundaries */
  constraints: ConstraintsDomain;
  /** Domain 5: Strategic Intent - goals and direction */
  strategicIntent: StrategicIntentDomain;
  /** Domain 6: Historical Decisions - past choices */
  historicalDecisions: HistoricalDecisionsDomain;

  // ========== Metadata ==========
  /** When context was created */
  createdAt?: string;
  /** When context was last updated */
  updatedAt?: string;
  /** Who last updated (user ID or "system") */
  updatedBy?: string;
  /** Free-form notes */
  notes?: ContextField<string>;
}

// ============================================================================
// V2 <-> V3 Conversion
// ============================================================================

/**
 * Convert V1/V2 numeric overlap score to V3 string classification
 */
function overlapScoreToLevel(score: number | undefined): 'High' | 'Medium' | 'Low' | undefined {
  if (score === undefined) return undefined;
  if (score >= 70) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
}

/**
 * Convert V1/V2 boolean jtbdMatch to V3 string classification
 */
function jtbdBoolToLevel(match: boolean | undefined): 'High' | 'Medium' | 'Low' | undefined {
  if (match === undefined) return undefined;
  return match ? 'High' : 'Low';
}

/**
 * Convert V3 level back to numeric score for V1/V2 compatibility
 */
function levelToOverlapScore(level: 'High' | 'Medium' | 'Low' | undefined): number {
  if (level === 'High') return 85;
  if (level === 'Medium') return 55;
  if (level === 'Low') return 25;
  return 0;
}

/**
 * Convert V3 level back to boolean for V1/V2 compatibility
 */
function levelToJtbdBool(level: 'High' | 'Medium' | 'Low' | undefined): boolean {
  return level === 'High' || level === 'Medium';
}

/**
 * Convert V1 Competitor to V3 CompetitorV3
 */
function competitorV1ToV3(c: Competitor): CompetitorV3 {
  return {
    domain: c.domain,
    name: c.name || c.domain,
    offerOverlap: overlapScoreToLevel(c.offerOverlap),
    jtbdMatch: jtbdBoolToLevel(c.jtbdMatch),
    source: c.source,
    classification: c.type === 'direct' ? 'Direct' : c.type === 'indirect' ? 'Indirect' : 'Substitute',
  };
}

/**
 * Convert V3 CompetitorV3 to V1 Competitor
 */
function competitorV3ToV1(c: CompetitorV3): Competitor {
  return {
    domain: c.domain,
    name: c.name,
    offerOverlap: levelToOverlapScore(c.offerOverlap),
    jtbdMatch: levelToJtbdBool(c.jtbdMatch),
    geoRelevance: 50, // Default
    type: c.classification === 'Direct' ? 'direct' : c.classification === 'Indirect' ? 'indirect' : 'adjacent',
    confidence: 50, // Default
    source: (c.source as 'baseline' | 'ai' | 'manual') || 'ai',
  };
}

/**
 * Convert V2 context to V3
 * Maps V2 sections to V3 domains with enhanced structure
 */
export function contextV2ToV3(v2: CompanyContextV2): CompanyContextV3 {
  // Convert competitors from V1 format to V3 format
  const v3Competitors: CompetitorV3[] | undefined = v2.marketReality.competitors?.value?.map(competitorV1ToV3);

  return {
    id: v2.id,
    companyId: v2.companyId,
    version: 'v3',
    status: v2.status,

    // Domain 1: Business Reality (from CompanyReality)
    businessReality: {
      businessModel: v2.companyReality.businessModel,
      category: v2.companyReality.category,
      geography: v2.companyReality.geography,
      stage: v2.companyReality.stage,
      valueProposition: v2.companyReality.valueProposition,
    },

    // Domain 2: Audience (from MarketReality)
    audience: {
      summary: v2.marketReality.audienceSummary,
      primaryAudience: v2.marketReality.primaryAudience,
      secondaryAudience: v2.marketReality.secondaryAudience,
      icpDescription: v2.marketReality.icpDescription,
    },

    // Domain 3: Competitive Truth (from MarketReality)
    competitiveTruth: {
      category: v2.marketReality.competitiveCategory,
      posture: v2.marketReality.competitivePosture as ContextField<'Leader' | 'Challenger' | 'Follower' | 'Niche'> | undefined,
      competitors: v3Competitors && v2.marketReality.competitors ? {
        value: v3Competitors,
        meta: v2.marketReality.competitors.meta,
      } : undefined,
      differentiators: v2.marketReality.differentiators,
      marketSignals: v2.marketReality.marketSignals,
    },

    // Domain 4: Constraints
    constraints: {
      budget: v2.constraints.budget,
      regulatory: v2.constraints.regulatory,
      internalCapabilities: v2.constraints.internalCapabilities,
      knownUnknowns: v2.constraints.knownUnknowns,
      timeline: v2.constraints.timeline,
      constraints: v2.constraints.constraints,
    },

    // Domain 5: Strategic Intent
    strategicIntent: {
      primaryObjectives: v2.strategicIntent.primaryObjectives,
      nonGoals: v2.strategicIntent.nonGoals,
      successDefinition: v2.strategicIntent.successDefinition,
      keyMetrics: v2.strategicIntent.keyMetrics,
    },

    // Domain 6: Historical Decisions (new, empty)
    historicalDecisions: {},

    // Metadata
    createdAt: v2.createdAt,
    updatedAt: v2.updatedAt,
    updatedBy: v2.updatedBy,
    notes: v2.notes,
  };
}

/**
 * Convert V3 context back to V2 for backward compatibility
 */
export function contextV3ToV2(v3: CompanyContextV3): CompanyContextV2 {
  // Convert V3 competitors back to V1/V2 format
  const v1Competitors: Competitor[] | undefined = v3.competitiveTruth.competitors?.value.map(competitorV3ToV1);

  return {
    id: v3.id,
    companyId: v3.companyId,
    status: v3.status,

    // Section 1: Company Reality (from BusinessReality)
    companyReality: {
      businessModel: v3.businessReality.businessModel,
      category: v3.businessReality.category,
      geography: v3.businessReality.geography,
      stage: v3.businessReality.stage,
      valueProposition: v3.businessReality.valueProposition,
    },

    // Section 2: Market Reality (from Audience + CompetitiveTruth)
    marketReality: {
      audienceSummary: v3.audience.summary,
      primaryAudience: v3.audience.primaryAudience,
      secondaryAudience: v3.audience.secondaryAudience,
      icpDescription: v3.audience.icpDescription,
      competitiveCategory: v3.competitiveTruth.category,
      competitivePosture: v3.competitiveTruth.posture as ContextField<string> | undefined,
      competitors: v1Competitors && v3.competitiveTruth.competitors ? {
        value: v1Competitors,
        meta: v3.competitiveTruth.competitors.meta,
      } : undefined,
      differentiators: v3.competitiveTruth.differentiators,
      marketSignals: v3.competitiveTruth.marketSignals,
    },

    // Section 3: Constraints
    constraints: {
      budget: v3.constraints.budget,
      regulatory: v3.constraints.regulatory,
      internalCapabilities: v3.constraints.internalCapabilities,
      knownUnknowns: v3.constraints.knownUnknowns,
      timeline: v3.constraints.timeline,
      constraints: v3.constraints.constraints,
    },

    // Section 4: Strategic Intent
    strategicIntent: {
      primaryObjectives: v3.strategicIntent.primaryObjectives,
      nonGoals: v3.strategicIntent.nonGoals,
      successDefinition: v3.strategicIntent.successDefinition,
      keyMetrics: v3.strategicIntent.keyMetrics,
    },

    // Metadata
    createdAt: v3.createdAt,
    updatedAt: v3.updatedAt,
    updatedBy: v3.updatedBy,
    notes: v3.notes,
  };
}

// ============================================================================
// V3 Completeness & Health
// ============================================================================

/**
 * Domain completeness configuration
 */
export interface DomainCompletenessConfig {
  required: string[];
  optional: string[];
  weight: number;
}

/**
 * Default completeness config for V3 domains
 */
export const V3_COMPLETENESS_CONFIG: Record<keyof Pick<CompanyContextV3, 'businessReality' | 'audience' | 'competitiveTruth' | 'constraints' | 'strategicIntent' | 'historicalDecisions'>, DomainCompletenessConfig> = {
  businessReality: {
    required: ['businessModel', 'category', 'valueProposition'],
    optional: ['geography', 'stage', 'teamSize', 'revenueRange'],
    weight: 0.20,
  },
  audience: {
    required: ['primaryAudience'],
    optional: ['secondaryAudience', 'icpDescription', 'segments'],
    weight: 0.20,
  },
  competitiveTruth: {
    required: ['category'],
    optional: ['posture', 'competitors', 'differentiators'],
    weight: 0.20,
  },
  constraints: {
    required: ['budget'],
    optional: ['timeline', 'regulatory', 'knownUnknowns'],
    weight: 0.15,
  },
  strategicIntent: {
    required: ['primaryObjectives'],
    optional: ['nonGoals', 'successDefinition', 'keyMetrics'],
    weight: 0.20,
  },
  historicalDecisions: {
    required: [],
    optional: ['decisions', 'lessonsLearned'],
    weight: 0.05,
  },
};

/**
 * Calculate V3 domain completeness
 */
export function calculateV3DomainCompleteness(
  domain: Record<string, ContextField<unknown> | undefined>,
  config: DomainCompletenessConfig
): { score: number; filled: number; total: number; missing: string[] } {
  const missing: string[] = [];
  let filledRequired = 0;
  let filledOptional = 0;

  // Check required fields
  for (const field of config.required) {
    const value = domain[field];
    if (hasValue(value)) {
      filledRequired++;
    } else {
      missing.push(field);
    }
  }

  // Check optional fields
  for (const field of config.optional) {
    const value = domain[field];
    if (hasValue(value)) {
      filledOptional++;
    }
  }

  // Required fields = 70% of score, optional = 30%
  const requiredScore = config.required.length > 0
    ? (filledRequired / config.required.length) * 0.7
    : 0.7;
  const optionalScore = config.optional.length > 0
    ? (filledOptional / config.optional.length) * 0.3
    : 0.3;

  return {
    score: Math.round((requiredScore + optionalScore) * 100),
    filled: filledRequired + filledOptional,
    total: config.required.length + config.optional.length,
    missing,
  };
}

/**
 * Calculate overall V3 context completeness
 */
export function getV3ContextCompleteness(context: CompanyContextV3): {
  overall: number;
  byDomain: Record<string, { score: number; filled: number; total: number; missing: string[] }>;
  missingRequired: string[];
  regenRecommended: boolean;
} {
  const byDomain: Record<string, { score: number; filled: number; total: number; missing: string[] }> = {};
  const missingRequired: string[] = [];
  let weightedSum = 0;

  // Calculate each domain
  for (const [domainKey, config] of Object.entries(V3_COMPLETENESS_CONFIG)) {
    const domain = context[domainKey as keyof typeof V3_COMPLETENESS_CONFIG] as Record<string, ContextField<unknown> | undefined>;
    const result = calculateV3DomainCompleteness(domain, config);
    byDomain[domainKey] = result;
    weightedSum += result.score * config.weight;

    // Track missing required fields with domain prefix
    for (const missing of result.missing) {
      missingRequired.push(`${domainKey}.${missing}`);
    }
  }

  const overall = Math.round(weightedSum);

  // Recommend regen if overall < 50% or missing critical fields
  const regenRecommended = overall < 50 || missingRequired.length > 3;

  return {
    overall,
    byDomain,
    missingRequired,
    regenRecommended,
  };
}

/**
 * Helper to check if a field has a value
 */
function hasValue(field: ContextField<unknown> | undefined): boolean {
  if (!field || field.value === undefined || field.value === null) {
    return false;
  }
  if (typeof field.value === 'string' && !field.value.trim()) {
    return false;
  }
  if (Array.isArray(field.value) && field.value.length === 0) {
    return false;
  }
  return true;
}

// ============================================================================
// Empty Context Factory
// ============================================================================

/**
 * Create an empty V3 context
 */
export function createEmptyContextV3(companyId: string): CompanyContextV3 {
  return {
    companyId,
    version: 'v3',
    status: 'Draft',
    businessReality: {},
    audience: {},
    competitiveTruth: {},
    constraints: {},
    strategicIntent: {},
    historicalDecisions: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// ContextField <-> WithMeta Compat Shim
// ============================================================================

import type { WithMetaType, ProvenanceTag, ContextSource } from '@/lib/contextGraph/types';

/**
 * Map ContextFieldSource to ContextSource (Context Graph source)
 * This preserves provenance fidelity when converting between formats
 */
function sourceToContextGraphSource(source: ContextFieldSource): ContextSource {
  switch (source) {
    case 'AI':
      return 'brain';
    case 'User':
      return 'user';
    case 'Lab':
      return 'gap_heavy'; // Default lab source
    case 'Imported':
      return 'airtable';
    default:
      return 'inferred';
  }
}

/**
 * Map ContextSource back to ContextFieldSource
 */
function contextGraphSourceToSource(source: ContextSource): ContextFieldSource {
  switch (source) {
    case 'user':
    case 'manual':
    case 'qbr':
      return 'User';
    case 'brain':
    case 'inferred':
      return 'AI';
    case 'airtable':
    case 'external_enrichment':
      return 'Imported';
    default:
      // All lab sources
      return 'Lab';
  }
}

/**
 * Map ContextConfidence to numeric confidence
 */
function confidenceToNumber(confidence: ContextConfidence): number {
  switch (confidence) {
    case 'High':
      return 0.9;
    case 'Medium':
      return 0.7;
    case 'Low':
      return 0.4;
    default:
      return 0.5;
  }
}

/**
 * Map numeric confidence to ContextConfidence
 */
function numberToConfidence(confidence: number): ContextConfidence {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.5) return 'Medium';
  return 'Low';
}

/**
 * Convert ContextField<T> to WithMeta<T> (Context Graph format)
 *
 * Use this when writing from V3 Context to Context Graph
 */
export function contextFieldToWithMeta<T>(
  field: ContextField<T> | undefined
): WithMetaType<T> {
  if (!field) {
    return { value: null, provenance: [] };
  }

  const provenance: ProvenanceTag = {
    source: sourceToContextGraphSource(field.meta.source),
    confidence: confidenceToNumber(field.meta.confidence),
    updatedAt: field.meta.lastUpdated,
    notes: field.meta.confidenceNotes,
  };

  return {
    value: field.value,
    provenance: [provenance],
  };
}

/**
 * Convert WithMeta<T> to ContextField<T> (V3 format)
 *
 * Use this when reading from Context Graph into V3 Context for UI display
 */
export function withMetaToContextField<T>(
  field: WithMetaType<T> | undefined,
  defaultNeedsReview: boolean = false
): ContextField<T> | undefined {
  if (!field || field.value === null) {
    return undefined;
  }

  const latestProvenance = field.provenance[0];

  const meta: ContextFieldMeta = {
    source: latestProvenance
      ? contextGraphSourceToSource(latestProvenance.source)
      : 'AI',
    lastUpdated: latestProvenance?.updatedAt ?? new Date().toISOString(),
    confidence: latestProvenance
      ? numberToConfidence(latestProvenance.confidence)
      : 'Medium',
    needsReview: defaultNeedsReview,
    confidenceNotes: latestProvenance?.notes,
  };

  return {
    value: field.value,
    meta,
  };
}

/**
 * Check if a WithMeta field is "user confirmed" (human override)
 * Mirrors the isUserConfirmed() function for ContextField
 */
export function isWithMetaUserConfirmed<T>(field: WithMetaType<T> | undefined): boolean {
  if (!field || field.provenance.length === 0) return false;

  const latestSource = field.provenance[0]?.source;
  // Human sources from sourcePriority.ts
  const humanSources = ['user', 'manual', 'qbr', 'strategy'];
  return humanSources.includes(latestSource);
}
