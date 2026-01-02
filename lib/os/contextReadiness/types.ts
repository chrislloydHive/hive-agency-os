// lib/os/contextReadiness/types.ts
// Context Readiness System Types
//
// Provides a system-level "Context Readiness" layer that tells users:
// 1) Do we have enough trusted context to proceed?
// 2) If not, exactly what is missing?
// 3) What is the single next best action?

// ============================================================================
// Core Types
// ============================================================================

/**
 * Context domains that readiness checks against
 * Maps to Context Graph domains + Lab outputs
 */
export type ContextDomainKey =
  | 'audience'
  | 'competitiveLandscape'
  | 'brand'
  | 'website'
  | 'seo'
  | 'media'
  | 'creative';

/**
 * Requirement level for a domain in a given feature context
 */
export type RequirementLevel = 'required' | 'recommended' | 'optional';

/**
 * Readiness status for a domain
 */
export type ReadinessStatus = 'ready' | 'partial' | 'missing';

/**
 * Features that require context readiness checking
 */
export type RequiredForFeature =
  | 'overview'
  | 'proposals'
  | 'strategy'
  | 'gap-plan'
  | 'labs';

/**
 * CTA action types
 */
export type ReadinessCTAType =
  | 'run_lab'
  | 'review_proposals'
  | 'view_context'
  | 'add_context';

// ============================================================================
// Domain Check Types
// ============================================================================

/**
 * A single check result for a domain field
 */
export interface DomainCheck {
  /** Field path (e.g., 'audience.primaryAudience') */
  fieldPath: string;
  /** Human-readable label */
  label: string;
  /** Whether this check passed */
  passed: boolean;
  /** Reason for failure (if not passed) */
  reason?: string;
  /** Is this a required check or optional? */
  required: boolean;
}

/**
 * Warning about a domain's readiness
 */
export interface DomainWarning {
  /** Warning message */
  message: string;
  /** Severity level */
  severity: 'info' | 'warning' | 'error';
  /** Related field or check */
  relatedField?: string;
}

/**
 * CTA for a domain
 */
export interface ReadinessCTA {
  /** CTA type */
  type: ReadinessCTAType;
  /** Button label */
  label: string;
  /** Navigation URL */
  href: string;
  /** Is this the primary CTA? */
  primary: boolean;
}

// ============================================================================
// Domain Readiness Result
// ============================================================================

/**
 * Readiness result for a single domain
 */
export interface DomainReadiness {
  /** Domain key */
  domain: ContextDomainKey;
  /** Human-readable domain name */
  domainLabel: string;
  /** Current status */
  status: ReadinessStatus;
  /** Requirement level for the current feature context */
  requirementLevel: RequirementLevel;
  /** Individual checks performed */
  checks: DomainCheck[];
  /** Checks that failed */
  failedChecks: DomainCheck[];
  /** Warnings */
  warnings: DomainWarning[];
  /** Available CTAs */
  ctas: ReadinessCTA[];
  /** Primary CTA (convenience accessor) */
  primaryCTA: ReadinessCTA | null;
  /** Lab slug if there's an associated lab */
  labSlug?: string;
  /** Lab quality score (if lab has run) */
  labQualityScore?: number | null;
  /** Whether lab has been run */
  labHasRun: boolean;
  /** Pending proposals count for this domain */
  pendingProposalsCount: number;
  /** Confirmed facts count for this domain */
  confirmedFactsCount: number;
}

// ============================================================================
// Overall Readiness Summary
// ============================================================================

/**
 * Complete readiness summary for a company
 */
export interface ReadinessSummary {
  /** Company ID */
  companyId: string;
  /** Feature context this readiness is computed for */
  requiredFor: RequiredForFeature;
  /** Overall readiness score 0-100 */
  overallScore: number;
  /** Overall status (ready if all required domains are ready) */
  overallStatus: ReadinessStatus;
  /** Per-domain readiness results */
  domains: DomainReadiness[];
  /** Missing required domains */
  missingRequiredDomains: ContextDomainKey[];
  /** Partially ready domains */
  partialDomains: ContextDomainKey[];
  /** Ready domains */
  readyDomains: ContextDomainKey[];
  /** Single next best action message */
  nextAction: string;
  /** Single next best action CTA */
  nextActionCTA: ReadinessCTA | null;
  /** Timestamp of computation */
  computedAt: string;
}

// ============================================================================
// Input Types (for computation)
// ============================================================================

/**
 * Lab run summary for readiness computation
 */
export interface LabRunSummary {
  labSlug: string;
  hasRun: boolean;
  latestRunDate: string | null;
  qualityScore: number | null;
}

/**
 * Input data for readiness computation
 */
export interface ReadinessInput {
  /** Company ID */
  companyId: string;
  /** Feature context */
  requiredFor: RequiredForFeature;
  /** Context graph (partial - only fields we care about) */
  contextGraph: ContextGraphSnapshot;
  /** Pending proposals count per domain */
  pendingProposalsByDomain: Record<ContextDomainKey, number>;
  /** Lab run summaries */
  labRuns: Map<string, LabRunSummary>;
}

/**
 * Snapshot of context graph for readiness checks
 * Contains only the fields we need to check
 */
export interface ContextGraphSnapshot {
  // Audience domain
  audience?: {
    primaryAudience?: { value: string | null; confirmed?: boolean };
    icpDescription?: { value: string | null; confirmed?: boolean };
    segments?: { value: unknown[] | null; confirmed?: boolean };
    primarySegments?: { value: unknown[] | null; confirmed?: boolean };
  };
  // Competitive domain
  competitive?: {
    competitors?: { value: unknown[] | null; confirmed?: boolean };
    primaryCompetitors?: { value: unknown[] | null; confirmed?: boolean };
    competitiveModality?: { value: string | null; confirmed?: boolean };
    positionSummary?: { value: string | null; confirmed?: boolean };
  };
  // Brand domain
  brand?: {
    positioning?: { value: string | null; confirmed?: boolean };
    valueProps?: { value: unknown[] | null; confirmed?: boolean };
    differentiators?: { value: unknown[] | null; confirmed?: boolean };
  };
  // Product Offer domain
  productOffer?: {
    valueProposition?: { value: string | null; confirmed?: boolean };
    primaryProducts?: { value: unknown[] | null; confirmed?: boolean };
  };
  // Website domain (from Website Lab)
  website?: {
    websiteScore?: { value: number | null; confirmed?: boolean };
    conversionBlocks?: { value: unknown[] | null; confirmed?: boolean };
    quickWins?: { value: unknown[] | null; confirmed?: boolean };
  };
  // SEO domain (from SEO Lab)
  seo?: {
    seoScore?: { value: number | null; confirmed?: boolean };
    technicalIssues?: { value: unknown[] | null; confirmed?: boolean };
  };
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Domain configuration for readiness rules
 */
export interface DomainConfig {
  /** Domain key */
  domain: ContextDomainKey;
  /** Human-readable label */
  label: string;
  /** Associated lab slug (if any) */
  labSlug?: string;
  /** Lab display name */
  labName?: string;
  /** Context graph domain name(s) this maps to */
  contextDomains: string[];
}

/**
 * Feature requirement configuration
 */
export interface FeatureRequirements {
  /** Feature key */
  feature: RequiredForFeature;
  /** Domain requirements */
  requirements: Record<ContextDomainKey, RequirementLevel>;
}
