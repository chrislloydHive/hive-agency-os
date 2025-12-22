// lib/contextGraph/v4/evidenceGrounding.ts
// Evidence Grounding for V4 Context Proposals
//
// Ensures proposals are decision-grade by:
// 1. Validating field content meets specificity requirements
// 2. Extracting evidence anchors from site snapshots
// 3. Applying strong penalties for generic/ungrounded proposals
//
// REQUIREMENTS:
// - positioning: must include category + audience (not "businesses")
// - valueProp: must include outcome + mechanism
// - primaryAudience: must include at least one concrete segment
// - icpDescription: must include firmographics or role/team + trigger

import type { EvidenceAnchor } from '@/lib/types/contextField';
import type { SiteSnapshot } from './siteSnapshot';
import { extractEvidenceAnchors, hasUsableContent, shouldBlockProposals } from './siteSnapshot';

// ============================================================================
// Types
// ============================================================================

export interface GroundedCandidate {
  fieldPath: string;
  fieldLabel: string;
  proposedValue: string;
  reasoning: string;
  confidence: number;
  evidenceAnchors: EvidenceAnchor[];
  validationPassed: boolean;
  validationErrors: string[];
}

export interface FieldValidationResult {
  valid: boolean;
  errors: string[];
  score: number; // 0-100 validation score
}

export interface EvidenceGroundingOptions {
  /** Site snapshot for evidence extraction */
  snapshot: SiteSnapshot | null;
  /** Company name for specificity checks */
  companyName?: string;
  /** Skip validation (useful for non-narrative fields) */
  skipValidation?: boolean;
  /** Max evidence anchors to extract per field */
  maxAnchors?: number;
}

// ============================================================================
// Constants - Validation Patterns
// ============================================================================

/**
 * Category terms that indicate a specific product type
 */
const CATEGORY_PATTERNS = [
  'platform', 'software', 'tool', 'app', 'application', 'service', 'solution',
  'crm', 'erp', 'cms', 'lms', 'hrm', 'api', 'sdk', 'saas', 'paas', 'iaas',
  'marketplace', 'network', 'engine', 'builder', 'automation', 'analytics',
  'dashboard', 'management', 'tracking', 'monitoring', 'integration',
];

/**
 * Audience terms that indicate specific targeting (not generic)
 */
const SPECIFIC_AUDIENCE_TERMS = [
  // Roles
  'cto', 'cmo', 'cfo', 'ceo', 'founder', 'engineer', 'developer', 'marketer',
  'designer', 'product manager', 'sales', 'hr', 'recruiter', 'operations',
  // Segments
  'startup', 'smb', 'mid-market', 'enterprise', 'agency', 'freelancer',
  'creator', 'solopreneur', 'consultant',
  // Industries
  'fintech', 'healthtech', 'edtech', 'martech', 'proptech', 'insurtech',
  'saas', 'b2b', 'b2c', 'd2c', 'ecommerce', 'retail', 'healthcare',
  'finance', 'legal', 'manufacturing', 'logistics', 'hospitality',
  // Team types
  'marketing team', 'sales team', 'engineering team', 'product team',
  'customer success', 'support team', 'operations team',
];

/**
 * Generic audience terms to avoid
 */
const GENERIC_AUDIENCE_TERMS = [
  'businesses', 'companies', 'organizations', 'enterprises', 'teams',
  'professionals', 'users', 'customers', 'clients', 'stakeholders',
  'decision makers', 'leaders', 'people', 'individuals',
];

/**
 * Outcome/benefit patterns for value proposition
 */
const OUTCOME_PATTERNS = [
  'increase', 'reduce', 'save', 'improve', 'accelerate', 'automate',
  'eliminate', 'simplify', 'consolidate', 'unify', 'scale', 'grow',
  'boost', 'maximize', 'minimize', 'optimize', 'cut', 'double', 'triple',
  '%', 'x faster', 'hours', 'days', 'minutes', 'revenue', 'cost', 'time',
  'conversion', 'retention', 'engagement', 'productivity', 'efficiency',
];

/**
 * Mechanism patterns for value proposition
 */
const MECHANISM_PATTERNS = [
  'by', 'using', 'through', 'with', 'via', 'leveraging',
  'ai-powered', 'automated', 'real-time', 'data-driven', 'integrated',
  'single', 'unified', 'centralized', 'one-click', 'self-service',
  'api', 'webhook', 'integration', 'sync', 'workflow', 'pipeline',
];

/**
 * Firmographic patterns for ICP description
 */
const FIRMOGRAPHIC_PATTERNS = [
  // Company size
  'employee', 'team of', 'headcount', 'staff', '1-10', '10-50', '50-200',
  '200-500', '500+', '1000+', 'person', 'people',
  // Revenue
  'revenue', 'arr', 'mrr', 'funding', 'series', 'seed', '$',
  // Stage
  'pre-seed', 'seed', 'series a', 'series b', 'growth', 'mature',
  'early-stage', 'late-stage', 'scale-up',
  // Location
  'us-based', 'eu-based', 'apac', 'global', 'remote', 'distributed',
];

/**
 * Trigger patterns for ICP description
 */
const TRIGGER_PATTERNS = [
  'when', 'after', 'before', 'during', 'as', 'once',
  'hiring', 'scaling', 'expanding', 'launching', 'migrating',
  'outgrown', 'struggling', 'looking to', 'need to', 'want to',
  'pain point', 'challenge', 'problem', 'friction', 'bottleneck',
];

// ============================================================================
// Field Validation
// ============================================================================

/**
 * Validate positioning statement
 *
 * Requirements:
 * - Must include a category term (what type of product)
 * - Must include specific audience (not just "businesses")
 */
export function validatePositioning(value: string): FieldValidationResult {
  const errors: string[] = [];
  const lower = value.toLowerCase();
  let score = 50; // Base score

  // Check for category
  const hasCategory = CATEGORY_PATTERNS.some(term => lower.includes(term));
  if (!hasCategory) {
    errors.push('Positioning must include a product category (e.g., "platform", "software", "tool")');
    score -= 20;
  } else {
    score += 15;
  }

  // Check for specific audience
  const hasSpecificAudience = SPECIFIC_AUDIENCE_TERMS.some(term => lower.includes(term));
  const hasGenericAudience = GENERIC_AUDIENCE_TERMS.some(term => lower.includes(term));

  if (!hasSpecificAudience) {
    errors.push('Positioning must include a specific audience segment (e.g., "B2B SaaS", "marketing teams", "SMBs")');
    score -= 20;
  } else {
    score += 15;
  }

  if (hasGenericAudience && !hasSpecificAudience) {
    errors.push('Positioning uses generic audience term ("businesses") without specificity');
    score -= 10;
  }

  // Length check
  if (value.length < 30) {
    errors.push('Positioning is too short (< 30 chars)');
    score -= 10;
  }

  return {
    valid: errors.length === 0,
    errors,
    score: Math.max(0, Math.min(100, score)),
  };
}

/**
 * Validate value proposition
 *
 * Requirements:
 * - Must include an outcome (what result the customer gets)
 * - Must include a mechanism (how the product delivers)
 */
export function validateValueProposition(value: string): FieldValidationResult {
  const errors: string[] = [];
  const lower = value.toLowerCase();
  let score = 50;

  // Check for outcome
  const hasOutcome = OUTCOME_PATTERNS.some(term => lower.includes(term));
  if (!hasOutcome) {
    errors.push('Value proposition must include a concrete outcome (e.g., "increase revenue", "save 10 hours/week")');
    score -= 25;
  } else {
    score += 20;
  }

  // Check for mechanism
  const hasMechanism = MECHANISM_PATTERNS.some(term => lower.includes(term));
  if (!hasMechanism) {
    errors.push('Value proposition must include a mechanism (e.g., "by automating", "with AI-powered", "through real-time")');
    score -= 15;
  } else {
    score += 15;
  }

  // Length check
  if (value.length < 40) {
    errors.push('Value proposition is too short (< 40 chars)');
    score -= 10;
  }

  return {
    valid: errors.length === 0,
    errors,
    score: Math.max(0, Math.min(100, score)),
  };
}

/**
 * Validate primary audience
 *
 * Requirements:
 * - Must include at least one concrete segment
 * - Must not be purely generic terms
 */
export function validatePrimaryAudience(value: string): FieldValidationResult {
  const errors: string[] = [];
  const lower = value.toLowerCase();
  let score = 50;

  // Check for specific audience
  const hasSpecificAudience = SPECIFIC_AUDIENCE_TERMS.some(term => lower.includes(term));
  const hasGenericAudience = GENERIC_AUDIENCE_TERMS.some(term => lower.includes(term));

  if (!hasSpecificAudience) {
    errors.push('Primary audience must include a concrete segment (e.g., "B2B SaaS founders", "mid-market marketing teams")');
    score -= 30;
  } else {
    score += 25;
  }

  if (hasGenericAudience && !hasSpecificAudience) {
    errors.push('Primary audience uses only generic terms without specificity');
    score -= 20;
  }

  // Length check
  if (value.length < 20) {
    errors.push('Primary audience is too short (< 20 chars)');
    score -= 10;
  }

  return {
    valid: errors.length === 0,
    errors,
    score: Math.max(0, Math.min(100, score)),
  };
}

/**
 * Validate ICP description
 *
 * Requirements:
 * - Must include firmographics OR role/team
 * - Should include a trigger (when they buy)
 */
export function validateIcpDescription(value: string): FieldValidationResult {
  const errors: string[] = [];
  const lower = value.toLowerCase();
  let score = 50;

  // Check for firmographics or role
  const hasFirmographics = FIRMOGRAPHIC_PATTERNS.some(term => lower.includes(term));
  const hasRole = SPECIFIC_AUDIENCE_TERMS.some(term =>
    term.includes('team') ||
    ['cto', 'cmo', 'cfo', 'ceo', 'founder', 'engineer', 'developer', 'marketer', 'designer', 'product manager'].includes(term)
  );
  const hasRoleInValue = SPECIFIC_AUDIENCE_TERMS.filter(term =>
    term.includes('team') ||
    ['cto', 'cmo', 'cfo', 'ceo', 'founder', 'engineer', 'developer', 'marketer', 'designer', 'product manager', 'sales', 'hr', 'recruiter', 'operations'].includes(term)
  ).some(term => lower.includes(term));

  if (!hasFirmographics && !hasRoleInValue) {
    errors.push('ICP description must include firmographics (company size, stage) or specific role/team');
    score -= 25;
  } else {
    score += 20;
  }

  // Check for trigger
  const hasTrigger = TRIGGER_PATTERNS.some(term => lower.includes(term));
  if (!hasTrigger) {
    errors.push('ICP description should include a buying trigger (e.g., "when scaling", "after Series A")');
    score -= 10;
  } else {
    score += 15;
  }

  // Length check
  if (value.length < 50) {
    errors.push('ICP description is too short for adequate specificity (< 50 chars)');
    score -= 10;
  }

  return {
    valid: errors.length === 0,
    errors,
    score: Math.max(0, Math.min(100, score)),
  };
}

/**
 * Get validator for a field path
 */
export function getFieldValidator(fieldPath: string): ((value: string) => FieldValidationResult) | null {
  switch (fieldPath) {
    case 'brand.positioning':
      return validatePositioning;
    case 'productOffer.valueProposition':
      return validateValueProposition;
    case 'audience.primaryAudience':
      return validatePrimaryAudience;
    case 'audience.icpDescription':
      return validateIcpDescription;
    default:
      return null;
  }
}

// ============================================================================
// Evidence Grounding
// ============================================================================

/**
 * Ground a candidate with evidence from site snapshot
 *
 * @param fieldPath - The context field path
 * @param fieldLabel - Human-readable label
 * @param proposedValue - The proposed value
 * @param reasoning - Why this value was proposed
 * @param baseConfidence - Base confidence before grounding adjustments
 * @param options - Evidence grounding options
 * @returns Grounded candidate with evidence anchors and validation
 */
export function groundCandidate(
  fieldPath: string,
  fieldLabel: string,
  proposedValue: string,
  reasoning: string,
  baseConfidence: number,
  options: EvidenceGroundingOptions
): GroundedCandidate {
  const { snapshot, skipValidation, maxAnchors = 3 } = options;

  // Run validation if applicable
  let validationPassed = true;
  let validationErrors: string[] = [];

  if (!skipValidation) {
    const validator = getFieldValidator(fieldPath);
    if (validator) {
      const result = validator(proposedValue);
      validationPassed = result.valid;
      validationErrors = result.errors;
    }
  }

  // Extract evidence anchors from snapshot
  let evidenceAnchors: EvidenceAnchor[] = [];

  if (snapshot && hasUsableContent(snapshot) && !shouldBlockProposals(snapshot)) {
    evidenceAnchors = extractEvidenceAnchors(snapshot, proposedValue, maxAnchors);
  }

  // Adjust confidence based on grounding
  let adjustedConfidence = baseConfidence;

  // Penalty for empty evidence
  if (evidenceAnchors.length === 0) {
    adjustedConfidence *= 0.8; // 20% penalty
  } else {
    // Bonus for strong evidence
    adjustedConfidence = Math.min(1, adjustedConfidence * (1 + evidenceAnchors.length * 0.05));
  }

  // Penalty for validation failures
  if (!validationPassed) {
    adjustedConfidence *= 0.7; // 30% penalty
  }

  return {
    fieldPath,
    fieldLabel,
    proposedValue,
    reasoning,
    confidence: adjustedConfidence,
    evidenceAnchors,
    validationPassed,
    validationErrors,
  };
}

/**
 * Check if proposal should be blocked due to error state
 */
export function shouldBlockForErrorState(snapshot: SiteSnapshot | null): boolean {
  if (!snapshot) return false;
  return shouldBlockProposals(snapshot);
}

/**
 * Check if value contains excessive generic cliches
 * Returns list of found cliches
 */
export function findGenericCliches(value: string): string[] {
  const lower = value.toLowerCase();
  const cliches = [
    'innovative', 'seamless', 'future-ready', 'adapt and grow',
    'changing market', 'thrive', 'streamline', 'cutting-edge',
    'best-in-class', 'world-class', 'next-generation', 'game-changing',
    'revolutionary', 'transform', 'empower', 'leverage', 'synergy',
    'holistic', 'scalable', 'robust', 'comprehensive', 'state-of-the-art',
    'leading', 'trusted', 'premier', 'solutions', 'drive results',
    'maximize', 'optimize', 'unlock', 'reimagine', 'dynamic', 'agile',
    'disrupt', 'paradigm', 'best practices', 'turnkey', 'end-to-end',
    'full-stack', 'one-stop', 'frictionless', 'supercharge',
    'accelerate growth', 'digital transformation', 'all-in-one',
  ];

  return cliches.filter(cliche => lower.includes(cliche));
}

/**
 * Check if a value is too generic for decision-grade proposals
 */
export function isTooGeneric(value: string, maxCliches: number = 2): boolean {
  const cliches = findGenericCliches(value);
  return cliches.length > maxCliches;
}

// ============================================================================
// Batch Grounding
// ============================================================================

/**
 * Ground multiple candidates with evidence
 */
export function groundCandidates(
  candidates: Array<{
    fieldPath: string;
    fieldLabel: string;
    proposedValue: string;
    reasoning: string;
    confidence: number;
  }>,
  options: EvidenceGroundingOptions
): GroundedCandidate[] {
  return candidates.map(candidate =>
    groundCandidate(
      candidate.fieldPath,
      candidate.fieldLabel,
      candidate.proposedValue,
      candidate.reasoning,
      candidate.confidence,
      options
    )
  );
}

// ============================================================================
// Exports for Testing
// ============================================================================

export const _testing = {
  CATEGORY_PATTERNS,
  SPECIFIC_AUDIENCE_TERMS,
  GENERIC_AUDIENCE_TERMS,
  OUTCOME_PATTERNS,
  MECHANISM_PATTERNS,
  FIRMOGRAPHIC_PATTERNS,
  TRIGGER_PATTERNS,
};
