// lib/contextGraph/v4/convergence.ts
// Context V4 Convergence Layer
//
// Implements decision-grade proposals with specificity scoring.
// Reduces "HubSpot = Mailchimp" genericness by:
// 1. De-emphasizing summary-shaped content as canonical facts
// 2. Adding decision-impact gating + specificity scoring
// 3. Producing differentiated, decision-grade proposals
//
// FEATURE FLAG: CONTEXT_V4_CONVERGENCE_ENABLED (default: false)

import type { DecisionImpact, DecisionGradeMetadata, EvidenceAnchor } from '@/lib/types/contextField';
import type { ContextProposal } from '../nodes/types';
import { FEATURE_FLAGS } from '@/lib/config/featureFlags';

// ============================================================================
// Constants
// ============================================================================

/**
 * Cliche phrases that indicate generic content
 * Penalizes specificity score when found
 */
const GENERIC_CLICHES = [
  'innovative',
  'seamless',
  'future-ready',
  'all-in-one',
  'growth',
  'streamline',
  'cutting-edge',
  'best-in-class',
  'world-class',
  'next-generation',
  'game-changing',
  'revolutionary',
  'transform',
  'empower',
  'leverage',
  'synergy',
  'holistic',
  'scalable',
  'robust',
  'comprehensive',
  'state-of-the-art',
  'leading',
  'trusted',
  'premier',
  'solutions',
  'drive results',
  'maximize',
  'optimize',
  'unlock',
  'reimagine',
  // V4 additions - more generic phrases
  'adapt and grow',
  'changing market',
  'thrive',
  'dynamic',
  'agile',
  'disrupt',
  'paradigm',
  'best practices',
  'turnkey',
  'end-to-end',
  'full-stack',
  'one-stop',
  'frictionless',
  'supercharge',
  'accelerate growth',
  'digital transformation',
];

/**
 * Category terms that indicate specificity
 * Presence of these terms rewards the specificity score
 */
const CATEGORY_TERMS = [
  'customer support platform',
  'website builder',
  'payroll software',
  'crm',
  'email marketing',
  'marketing automation',
  'project management',
  'analytics platform',
  'data warehouse',
  'payment processing',
  'hr software',
  'accounting software',
  'inventory management',
  'e-commerce platform',
  'help desk',
  'live chat',
  'scheduling software',
  'booking system',
  'survey tool',
  'form builder',
  'video conferencing',
  'collaboration tool',
  'document management',
  'design tool',
  'no-code platform',
  'low-code',
  'api platform',
  'developer tools',
  'security platform',
  'compliance software',
];

/**
 * Specific segment terms that indicate targeted audience
 */
const SEGMENT_TERMS = [
  'mid-market',
  'enterprise',
  'smb',
  'small business',
  'startup',
  'agency',
  'agencies',
  'freelancer',
  'creator',
  'ecommerce brand',
  'e-commerce brand',
  'd2c',
  'direct-to-consumer',
  'b2b saas',
  'b2c',
  'healthcare',
  'fintech',
  'edtech',
  'real estate',
  'retail',
  'manufacturing',
  'logistics',
  'hospitality',
  'professional services',
  'legal',
  'accounting firm',
  'marketing agency',
  'design agency',
  'consulting',
];

/**
 * Vague audience terms that indicate generic targeting
 */
const VAGUE_AUDIENCE_TERMS = [
  'businesses',
  'companies',
  'organizations',
  'enterprises',
  'teams',
  'professionals',
  'users',
  'customers',
  'clients',
  'stakeholders',
  'decision makers',
  'leaders',
];

/**
 * Summary-shaped field keys that should be marked as LOW impact
 * and hidden by default
 */
const SUMMARY_SHAPED_FIELDS = [
  'website.executiveSummary',
  'website.websiteSummary',
  'identity.companyDescription',
  'brand.brandPerception',
  'brand.strategistView',
  'brand.brandPersonality',
];

/**
 * High-impact fields critical for strategy decisions
 */
const HIGH_IMPACT_FIELDS = [
  'brand.positioning',
  'productOffer.valueProposition',
  'audience.primaryAudience',
  'audience.icpDescription',
  'brand.differentiators',
  'competitive.positionSummary',
];

/**
 * Medium-impact fields important for tactics
 */
const MEDIUM_IMPACT_FIELDS = [
  'productOffer.primaryConversionAction',
  'productOffer.primaryProducts',
  'audience.coreSegments',
  'audience.painPoints',
  'identity.businessModel',
  'performanceMedia.activeChannels',
  'operationalConstraints.minBudget',
  'operationalConstraints.maxBudget',
];

/**
 * Threshold below which specificity triggers convergence rewrite
 */
const SPECIFICITY_REWRITE_THRESHOLD = 45;

/**
 * Baseline fields that can be rewritten by convergence
 */
const BASELINE_REWRITE_FIELDS = [
  'brand.positioning',
  'productOffer.valueProposition',
  'audience.primaryAudience',
  'audience.icpDescription',
];

// ============================================================================
// Feature Flag Check
// ============================================================================

/**
 * Check if V4 Convergence is enabled
 */
export function isConvergenceEnabled(): boolean {
  return FEATURE_FLAGS.CONTEXT_V4_CONVERGENCE_ENABLED;
}

// ============================================================================
// Specificity Scoring
// ============================================================================

export interface SpecificityResult {
  score: number;
  reasons: string[];
}

export interface SpecificityOptions {
  /** Company name for specificity bonus */
  companyName?: string;
  /** Evidence anchors - empty array triggers penalty */
  evidenceAnchors?: EvidenceAnchor[];
}

/**
 * Compute specificity score for a text value
 *
 * Heuristics:
 * - Penalize cliches ("innovative", "seamless", etc.)
 * - Penalize vague audiences ("businesses", "companies")
 * - Penalize lack of evidence anchors (V4 Evidence Grounding)
 * - Penalize lack of specific numbers
 * - Reward company name mentions
 * - Reward category terms ("customer support platform", etc.)
 * - Reward segment terms ("mid-market B2B SaaS", etc.)
 * - Reward pricing/plan mentions
 *
 * @param text - The text to score
 * @param options - Scoring options including company name and evidence anchors
 * @returns Score 0-100 and array of genericness reasons
 */
export function computeSpecificityScore(
  text: string,
  companyNameOrOptions?: string | SpecificityOptions
): SpecificityResult {
  if (!text || typeof text !== 'string') {
    return { score: 0, reasons: ['Empty or invalid text'] };
  }

  // Handle legacy signature (companyName as string)
  const options: SpecificityOptions = typeof companyNameOrOptions === 'string'
    ? { companyName: companyNameOrOptions }
    : companyNameOrOptions || {};

  const { companyName, evidenceAnchors } = options;
  const lower = text.toLowerCase();
  const reasons: string[] = [];
  let score = 70; // Start with a base score

  // V4 Evidence Grounding: Penalize empty evidence anchors (-20)
  if (evidenceAnchors !== undefined && evidenceAnchors.length === 0) {
    score -= 20;
    reasons.push('No evidence anchors (ungrounded proposal)');
  }

  // Penalize cliches (-3 each, max -30)
  let clicheCount = 0;
  for (const cliche of GENERIC_CLICHES) {
    if (lower.includes(cliche)) {
      clicheCount++;
      if (clicheCount <= 3) {
        reasons.push(`Contains cliche: "${cliche}"`);
      }
    }
  }
  score -= Math.min(30, clicheCount * 3);

  // Penalize vague audience terms (-5 each, max -20)
  let vagueCount = 0;
  for (const term of VAGUE_AUDIENCE_TERMS) {
    if (lower.includes(term)) {
      vagueCount++;
      if (vagueCount <= 2) {
        reasons.push(`Vague audience term: "${term}"`);
      }
    }
  }
  score -= Math.min(20, vagueCount * 5);

  // Penalize very short text (-15)
  if (text.length < 50) {
    score -= 15;
    reasons.push('Text too short (< 50 chars)');
  }

  // Penalize very long text (-5)
  if (text.length > 500) {
    score -= 5;
    reasons.push('Text too long (> 500 chars)');
  }

  // Penalize lack of specific numbers (-10)
  const hasNumbers = /\d+/.test(text);
  if (!hasNumbers) {
    score -= 10;
    reasons.push('No specific numbers or metrics');
  }

  // Reward company name mention (+10)
  if (companyName && lower.includes(companyName.toLowerCase())) {
    score += 10;
  }

  // Reward category terms (+10)
  const hasCategoryTerm = CATEGORY_TERMS.some(term => lower.includes(term));
  if (hasCategoryTerm) {
    score += 10;
  }

  // Reward segment terms (+10)
  const hasSegmentTerm = SEGMENT_TERMS.some(term => lower.includes(term));
  if (hasSegmentTerm) {
    score += 10;
  }

  // Reward specific industry terms (+5)
  const industryTerms = ['saas', 'b2b', 'b2c', 'ecommerce', 'e-commerce', 'fintech', 'healthtech', 'edtech', 'martech'];
  const hasIndustryTerm = industryTerms.some(term => lower.includes(term));
  if (hasIndustryTerm) {
    score += 5;
  }

  // Reward specific role mentions (+5)
  const roleTerms = ['cto', 'cmo', 'cfo', 'developer', 'marketer', 'founder', 'engineer', 'designer'];
  const hasRoleTerm = roleTerms.some(term => lower.includes(term));
  if (hasRoleTerm) {
    score += 5;
  }

  // Reward pricing/plan mentions (+5)
  const pricingTerms = ['free tier', 'free plan', 'starter', 'pro plan', 'enterprise plan', 'pricing', '/month', '/year', '$ '];
  const hasPricingTerm = pricingTerms.some(term => lower.includes(term));
  if (hasPricingTerm) {
    score += 5;
  }

  // Bonus for having evidence anchors (+15 for 1+, +5 more for 2+)
  if (evidenceAnchors && evidenceAnchors.length > 0) {
    score += 15;
    if (evidenceAnchors.length >= 2) {
      score += 5;
    }
  }

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score));

  if (reasons.length === 0 && score >= 70) {
    // Good specificity
  } else if (reasons.length === 0) {
    reasons.push('Low overall specificity');
  }

  return { score, reasons };
}

// ============================================================================
// Decision Impact Inference
// ============================================================================

/**
 * Infer decision impact for a context field
 *
 * Rules:
 * - HIGH for positioning/valueProp/audience/icp, conversion blockers, trust signals
 * - MEDIUM for pricing, channels, segments
 * - LOW for long narrative summaries
 */
export function inferDecisionImpact(key: string, value: unknown): DecisionImpact {
  // Check summary-shaped fields first
  if (SUMMARY_SHAPED_FIELDS.includes(key)) {
    return 'LOW';
  }

  // Check high-impact fields
  if (HIGH_IMPACT_FIELDS.includes(key)) {
    return 'HIGH';
  }

  // Check medium-impact fields
  if (MEDIUM_IMPACT_FIELDS.includes(key)) {
    return 'MEDIUM';
  }

  // Default based on domain
  const domain = key.split('.')[0];
  switch (domain) {
    case 'brand':
    case 'audience':
    case 'productOffer':
      return 'MEDIUM';
    case 'competitive':
      return 'MEDIUM';
    case 'website':
    case 'content':
    case 'seo':
      return 'LOW';
    default:
      return 'MEDIUM';
  }
}

// ============================================================================
// Summary-Shaped Detection
// ============================================================================

/**
 * Check if a field key/value pair is summary-shaped
 *
 * Summary-shaped content:
 * - executiveSummary, websiteSummary, companyDescription
 * - Long narrative text (> 300 chars without structure)
 * - Content that starts with "The company..." or similar
 */
export function isSummaryShaped(key: string, value: unknown): boolean {
  // Check explicit summary fields
  if (SUMMARY_SHAPED_FIELDS.includes(key)) {
    return true;
  }

  // Check for summary indicators in key name
  const keyLower = key.toLowerCase();
  if (
    keyLower.includes('summary') ||
    keyLower.includes('description') ||
    keyLower.includes('narrative') ||
    keyLower.includes('overview')
  ) {
    return true;
  }

  // Check for long narrative text
  if (typeof value === 'string' && value.length > 300) {
    const lower = value.toLowerCase();
    // Check for typical summary starts
    if (
      lower.startsWith('the company') ||
      lower.startsWith('this company') ||
      lower.startsWith('we are') ||
      lower.startsWith('our company')
    ) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// Apply Convergence to Candidates
// ============================================================================

export interface ConvergenceCandidate {
  fieldPath: string;
  value: unknown;
  confidence: number;
  reasoning?: string;
}

export interface EnhancedCandidate extends ConvergenceCandidate {
  decisionImpact: DecisionImpact;
  specificityScore: number;
  genericnessReasons: string[];
  hiddenByDefault: boolean;
  fieldCategory: 'derivedNarrative' | 'corePositioning' | 'tactical' | 'evidence';
}

/**
 * Apply convergence analysis to a list of candidates
 *
 * Adds:
 * - decisionImpact (LOW/MEDIUM/HIGH)
 * - specificityScore (0-100)
 * - genericnessReasons (why it's generic)
 * - hiddenByDefault (should hide in Review Queue by default)
 * - fieldCategory (for grouping)
 *
 * @param candidates - Raw candidates from lab/builder
 * @param companyName - Company name for specificity scoring
 * @returns Enhanced candidates with convergence metadata
 */
export function applyConvergenceToCandidates(
  candidates: ConvergenceCandidate[],
  companyName?: string
): EnhancedCandidate[] {
  // If convergence is disabled, return candidates with default metadata
  if (!isConvergenceEnabled()) {
    return candidates.map(c => ({
      ...c,
      decisionImpact: 'MEDIUM' as DecisionImpact,
      specificityScore: 50,
      genericnessReasons: [],
      hiddenByDefault: false,
      fieldCategory: 'evidence' as const,
    }));
  }

  return candidates.map(candidate => {
    const { fieldPath, value } = candidate;

    // Compute decision impact
    const decisionImpact = inferDecisionImpact(fieldPath, value);

    // Compute specificity score
    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
    const { score: specificityScore, reasons: genericnessReasons } = computeSpecificityScore(
      valueStr,
      companyName
    );

    // Determine if summary-shaped
    const isSummary = isSummaryShaped(fieldPath, value);

    // Determine field category
    let fieldCategory: EnhancedCandidate['fieldCategory'] = 'evidence';
    if (isSummary) {
      fieldCategory = 'derivedNarrative';
    } else if (HIGH_IMPACT_FIELDS.includes(fieldPath)) {
      fieldCategory = 'corePositioning';
    } else if (MEDIUM_IMPACT_FIELDS.includes(fieldPath)) {
      fieldCategory = 'tactical';
    }

    // Determine if should be hidden by default
    // Hide LOW impact or very low specificity
    const hiddenByDefault = decisionImpact === 'LOW' || specificityScore < 30;

    return {
      ...candidate,
      decisionImpact,
      specificityScore,
      genericnessReasons,
      hiddenByDefault,
      fieldCategory,
    };
  });
}

// ============================================================================
// Apply Convergence to Proposals
// ============================================================================

/**
 * Enhance an existing ContextProposal with convergence metadata
 */
export function enhanceProposalWithConvergence(
  proposal: ContextProposal,
  companyName?: string
): ContextProposal {
  if (!isConvergenceEnabled()) {
    return proposal;
  }

  const { fieldPath, proposedValue } = proposal;

  // Compute decision impact
  const decisionImpact = inferDecisionImpact(fieldPath, proposedValue);

  // Compute specificity score
  const valueStr = typeof proposedValue === 'string'
    ? proposedValue
    : JSON.stringify(proposedValue);
  const { score: specificityScore, reasons: genericnessReasons } = computeSpecificityScore(
    valueStr,
    companyName
  );

  // Determine if summary-shaped
  const isSummary = isSummaryShaped(fieldPath, proposedValue);

  // Determine field category
  let fieldCategory: ContextProposal['fieldCategory'] = 'evidence';
  if (isSummary) {
    fieldCategory = 'derivedNarrative';
  } else if (HIGH_IMPACT_FIELDS.includes(fieldPath)) {
    fieldCategory = 'corePositioning';
  } else if (MEDIUM_IMPACT_FIELDS.includes(fieldPath)) {
    fieldCategory = 'tactical';
  }

  // Determine if should be hidden by default
  const hiddenByDefault = decisionImpact === 'LOW' || specificityScore < 30;

  return {
    ...proposal,
    decisionImpact,
    specificityScore,
    genericnessReasons,
    hiddenByDefault,
    fieldCategory,
  };
}

// ============================================================================
// Convergence Rewrite Detection
// ============================================================================

/**
 * Check if a field needs convergence rewrite
 *
 * Triggers rewrite when:
 * - Field is in baseline rewrite fields list
 * - Specificity score < SPECIFICITY_REWRITE_THRESHOLD (45)
 * - Value is not null/empty
 */
export function needsConvergenceRewrite(
  fieldPath: string,
  value: unknown,
  companyName?: string
): boolean {
  if (!isConvergenceEnabled()) {
    return false;
  }

  // Only rewrite baseline fields
  if (!BASELINE_REWRITE_FIELDS.includes(fieldPath)) {
    return false;
  }

  // Need a value to rewrite
  if (!value) {
    return false;
  }

  // Check specificity
  const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
  const { score } = computeSpecificityScore(valueStr, companyName);

  return score < SPECIFICITY_REWRITE_THRESHOLD;
}

// ============================================================================
// Convergence Rewrite Prompt
// ============================================================================

export interface ConvergenceRewriteInput {
  companyName: string;
  companyUrl?: string;
  currentValues: {
    positioning?: string;
    valueProposition?: string;
    primaryAudience?: string;
    icpDescription?: string;
  };
  evidenceExcerpts: string[];
}

export interface ConvergenceRewriteOutput {
  positioning: string;
  valueProposition: string;
  primaryAudience: string;
  icpDescription: string;
  proofPoints: string[];
}

/**
 * Generate a prompt for LLM convergence rewrite
 *
 * Creates concise, distinctive positioning/value prop/audience/ICP
 * based on confirmed context and evidence excerpts.
 */
export function generateConvergenceRewritePrompt(input: ConvergenceRewriteInput): string {
  const { companyName, companyUrl, currentValues, evidenceExcerpts } = input;

  return `You are an expert brand strategist. Rewrite the following context fields for ${companyName}${companyUrl ? ` (${companyUrl})` : ''} to be more specific and distinctive.

CURRENT VALUES (may be generic):
${currentValues.positioning ? `- Positioning: ${currentValues.positioning}` : '- Positioning: [missing]'}
${currentValues.valueProposition ? `- Value Proposition: ${currentValues.valueProposition}` : '- Value Proposition: [missing]'}
${currentValues.primaryAudience ? `- Primary Audience: ${currentValues.primaryAudience}` : '- Primary Audience: [missing]'}
${currentValues.icpDescription ? `- ICP Description: ${currentValues.icpDescription}` : '- ICP Description: [missing]'}

EVIDENCE EXCERPTS:
${evidenceExcerpts.map((e, i) => `${i + 1}. ${e}`).join('\n')}

REQUIREMENTS:
1. Be SPECIFIC to ${companyName} - avoid generic phrases like "innovative", "seamless", "growth"
2. Reference CONCRETE features, use cases, or benefits unique to this company
3. Target a SPECIFIC audience segment, not generic "businesses" or "companies"
4. Each output should be 1-2 sentences MAX
5. Include proof points (bullet list) citing specific evidence used

OUTPUT (JSON):
{
  "positioning": "1-2 sentence positioning statement specific to ${companyName}",
  "valueProposition": "1-2 sentence value prop with concrete benefits",
  "primaryAudience": "Specific audience segment with role/industry/company size",
  "icpDescription": "Detailed ICP with constraints and qualifying criteria",
  "proofPoints": ["Evidence 1 used", "Evidence 2 used", ...]
}`;
}

// ============================================================================
// Ranking for Confirm Best
// ============================================================================

export interface RankableProposal {
  decisionImpact?: DecisionImpact;
  confidence: number;
  specificityScore?: number;
  createdAt: string;
  source?: string;
}

/**
 * Get ranking score for a proposal
 *
 * Ranking rules (in order):
 * 1. decisionImpact: HIGH > MEDIUM > LOW
 * 2. sourcePriority: user > lab > ai (simplified)
 * 3. confidence: higher is better
 * 4. specificityScore: higher is better
 * 5. recency: newer is better
 */
export function getProposalRankingScore(proposal: RankableProposal): number {
  let score = 0;

  // Decision impact weight (highest priority)
  const impactWeights = { HIGH: 10000, MEDIUM: 5000, LOW: 0 };
  score += impactWeights[proposal.decisionImpact || 'MEDIUM'];

  // Source priority weight
  const sourceWeights: Record<string, number> = {
    user: 1000,
    manual: 1000,
    brand_lab: 800,
    website_lab: 800,
    competition_lab: 700,
    ai: 500,
    inferred: 400,
  };
  score += sourceWeights[proposal.source || 'ai'] || 500;

  // Confidence weight (0-1 scaled to 0-100)
  score += (proposal.confidence || 0.5) * 100;

  // Specificity score (0-100, scaled to 0-50)
  score += ((proposal.specificityScore || 50) / 100) * 50;

  // Recency weight (newer is better, small factor)
  const ageMs = Date.now() - new Date(proposal.createdAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  score += Math.max(0, 10 - ageDays); // Max 10 points for very recent

  return score;
}

/**
 * Sort proposals by ranking score (descending)
 */
export function rankProposals<T extends RankableProposal>(proposals: T[]): T[] {
  return [...proposals].sort((a, b) =>
    getProposalRankingScore(b) - getProposalRankingScore(a)
  );
}

// ============================================================================
// Domain Grouping
// ============================================================================

/**
 * Get the domain group for a field path
 * Used for "Confirm Best per Domain" grouping
 */
export function getDomainGroup(fieldPath: string): string {
  const domain = fieldPath.split('.')[0];

  // Group similar domains
  const domainGroups: Record<string, string> = {
    identity: 'Identity',
    brand: 'Brand',
    audience: 'Audience',
    productOffer: 'ProductOffer',
    website: 'Website',
    content: 'Content',
    seo: 'SEO',
    competitive: 'Competitive',
    performanceMedia: 'Media',
    operationalConstraints: 'Constraints',
    creative: 'Creative',
    digitalInfra: 'Infrastructure',
  };

  return domainGroups[domain] || domain;
}

/**
 * Group proposals by domain
 */
export function groupProposalsByDomain<T extends { fieldPath: string }>(
  proposals: T[]
): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const proposal of proposals) {
    const domain = getDomainGroup(proposal.fieldPath);
    const group = groups.get(domain) || [];
    group.push(proposal);
    groups.set(domain, group);
  }

  return groups;
}

// ============================================================================
// Exports for Testing
// ============================================================================

export const _testing = {
  GENERIC_CLICHES,
  VAGUE_AUDIENCE_TERMS,
  SUMMARY_SHAPED_FIELDS,
  HIGH_IMPACT_FIELDS,
  MEDIUM_IMPACT_FIELDS,
  SPECIFICITY_REWRITE_THRESHOLD,
  BASELINE_REWRITE_FIELDS,
  CATEGORY_TERMS,
  SEGMENT_TERMS,
};
