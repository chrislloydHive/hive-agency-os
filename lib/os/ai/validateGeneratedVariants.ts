// lib/os/ai/validateGeneratedVariants.ts
// Lightweight Constraint Violation Detector
//
// Checks generated variants for:
// - Banned phrases from contract exclusions
// - Obvious constraint violations
// - Quality issues (empty, too short, etc.)

import type { AIGenerationContract } from './strategyFieldContracts';
import type { ConfirmedContextSnapshot } from './buildStrategyFieldPrompt';

// ============================================================================
// Types
// ============================================================================

/**
 * Types of warnings that can be detected
 */
export type VariantWarningType =
  | 'banned_phrase'
  | 'invented_claim'
  | 'generic_fluff'
  | 'constraint_violation'
  | 'category_drift'
  | 'domain_mismatch'
  | 'quality_too_short'
  | 'quality_too_long'
  | 'quality_placeholder';

/**
 * Recommended actions for fixing warnings
 */
export type VariantWarningAction =
  | 'remove_phrase'
  | 'rewrite_defensible'
  | 'rewrite_with_constraints'
  | 'regenerate_stricter';

/**
 * Mapping of warning types to their default fix actions
 */
export const WARNING_ACTION_MAP: Record<VariantWarningType, VariantWarningAction> = {
  banned_phrase: 'remove_phrase',
  invented_claim: 'rewrite_defensible',
  generic_fluff: 'regenerate_stricter',
  constraint_violation: 'rewrite_with_constraints',
  category_drift: 'rewrite_defensible',
  domain_mismatch: 'rewrite_defensible',
  quality_too_short: 'regenerate_stricter',
  quality_too_long: 'regenerate_stricter',
  quality_placeholder: 'regenerate_stricter',
};

/**
 * Human-readable action labels for UI
 */
export const ACTION_LABELS: Record<VariantWarningAction, string> = {
  remove_phrase: 'Remove phrase',
  rewrite_defensible: 'Rewrite to be defensible',
  rewrite_with_constraints: 'Rewrite to fit constraints',
  regenerate_stricter: 'Regenerate this variant',
};

export interface VariantWarning {
  /** Index of the variant with the warning */
  variantIndex: number;
  /** Type of warning for programmatic handling */
  type: VariantWarningType;
  /** Human-readable reason for the warning */
  reason: string;
  /** Severity: 'error' for must-fix, 'warning' for review */
  severity: 'error' | 'warning';
  /** Recommended action to fix this warning */
  action: VariantWarningAction;
  /** The matched phrase or pattern if applicable */
  matchedPhrase?: string;
  /** Additional metadata for repairs (e.g., phrases to remove) */
  meta?: {
    phrases?: string[];
    pattern?: string;
    constraint?: string;
    tags?: string[];
  };
}

export interface ValidationResult {
  /** Whether all variants passed validation */
  valid: boolean;
  /** Warnings for individual variants */
  warnings: VariantWarning[];
  /** Summary of issues */
  summary: string | null;
}

// ============================================================================
// Common Banned Phrases (beyond contract-specific exclusions)
// ============================================================================

/**
 * Phrases that indicate invented/unsupported claims
 */
const INVENTED_CLAIM_PATTERNS = [
  /\b(?:proprietary|patented)\s+(?:technology|algorithm|process)/i,
  /\b(?:industry-first|first-of-its-kind|only\s+solution)/i,
  /\b(?:guaranteed|100%|proven)\s+(?:results|success|roi)/i,
  /\b(?:millions|thousands)\s+of\s+(?:customers|users|clients)/i,
  /\b(?:award-winning|best\s+in\s+class|market\s+leader)/i,
  /\$\d+[KMB]?\+?\s+(?:saved|generated|revenue)/i, // Specific financial claims
];

/**
 * Generic marketing fluff that should be avoided
 */
const GENERIC_FLUFF_PHRASES = [
  'leverage',
  'synergy',
  'paradigm',
  'holistic',
  'best-in-class',
  'world-class',
  'cutting-edge',
  'bleeding-edge',
  'next-generation',
  'game-changing',
  'revolutionary',
  'disruptive',
  'innovative', // too generic without specifics
  'seamless',
  'robust',
  'scalable', // only flag if not in context
  'enterprise-grade',
  'turn-key',
  'end-to-end',
  'one-stop',
];

/**
 * Category drift phrases - mechanism/tool language that indicates
 * the AI has drifted into an adjacent product category.
 * These should only appear if explicitly in confirmed context.
 */
const CATEGORY_DRIFT_PHRASES = [
  // Software/Platform mechanisms
  'platform',
  'software',
  'tool',
  'system',
  'dashboard',
  'app',
  'application',
  // Analytics/Data mechanisms
  'analytics',
  'diagnostics',
  'metrics',
  'tracking',
  'insights',
  'reporting',
  'data-driven',
  // Optimization mechanisms
  'optimization',
  'optimize',
  'optimizing',
  'CRO',
  'conversion rate',
  'A/B test',
  'split test',
  // Automation mechanisms
  'automation',
  'automated',
  'automate',
  'workflow',
  'AI-powered',
  'machine learning',
  // Integration mechanisms
  'integration',
  'API',
  'sync',
  'connect',
];

/**
 * CRO/Website-audit specific patterns.
 * These are high-confidence indicators of drift into CRO/website optimization
 * when the business is NOT a CRO agency or website optimization service.
 */
const CRO_INDICATOR_PATTERNS: { pattern: RegExp; label: string }[] = [
  // CRO-specific terminology
  { pattern: /\bCRO\b/i, label: 'CRO' },
  { pattern: /\bconversion\s+rate\s+optimization/i, label: 'conversion rate optimization' },
  { pattern: /\blanding\s+page\s+(?:performance|optimization|testing)/i, label: 'landing page optimization' },
  { pattern: /\bconversion\s+funnel/i, label: 'conversion funnel' },
  { pattern: /\bconversion\s+lift/i, label: 'conversion lift' },
  // Website analytics terminology
  { pattern: /\bscroll\s+depth/i, label: 'scroll depth' },
  { pattern: /\bbounce\s+rate/i, label: 'bounce rate' },
  { pattern: /\bexit\s+rate/i, label: 'exit rate' },
  { pattern: /\bpage\s+views?/i, label: 'page views' },
  { pattern: /\buser\s+behavior\s+(?:tracking|analytics|data)/i, label: 'user behavior tracking' },
  { pattern: /\bsession\s+(?:duration|recording|replay)/i, label: 'session tracking' },
  { pattern: /\bheatmaps?\b/i, label: 'heatmaps' },
  { pattern: /\bclick\s+tracking/i, label: 'click tracking' },
  // Website audit terminology
  { pattern: /\bwebsite\s+(?:audit|performance|optimization)/i, label: 'website audit' },
  { pattern: /\bUX\s+(?:audit|optimization|testing)/i, label: 'UX audit' },
  { pattern: /\bpage\s+speed/i, label: 'page speed' },
  { pattern: /\bcore\s+web\s+vitals/i, label: 'core web vitals' },
  { pattern: /\bLCP|FID|CLS\b/, label: 'web performance metrics' },
  // A/B testing
  { pattern: /\bA\/B\s+test(?:ing)?/i, label: 'A/B testing' },
  { pattern: /\bsplit\s+test(?:ing)?/i, label: 'split testing' },
  { pattern: /\bmultivariate\s+test(?:ing)?/i, label: 'multivariate testing' },
  // Funnel optimization
  { pattern: /\bcheckout\s+optimization/i, label: 'checkout optimization' },
  { pattern: /\bcart\s+abandonment/i, label: 'cart abandonment' },
  { pattern: /\bform\s+optimization/i, label: 'form optimization' },
];

/**
 * Domain-specific terminology that indicates a specific business/product domain.
 * If these appear in variants but not in the primary inputs, it's domain mismatch.
 * This is more specific than category_drift - it detects when AI invents
 * domain context that wasn't provided.
 */
const DOMAIN_INDICATOR_PATTERNS: { pattern: RegExp; domain: string }[] = [
  // E-commerce/retail
  { pattern: /\b(?:shopping\s+cart|checkout|add\s+to\s+cart|product\s+catalog)/i, domain: 'e-commerce' },
  { pattern: /\b(?:inventory|SKU|fulfillment|warehouse)/i, domain: 'retail/logistics' },
  // Healthcare
  { pattern: /\b(?:patient|HIPAA|medical|healthcare|clinical|diagnosis)/i, domain: 'healthcare' },
  { pattern: /\b(?:pharmacy|prescription|treatment|therapy)/i, domain: 'healthcare' },
  // Finance/Fintech
  { pattern: /\b(?:banking|investment|portfolio|trading|securities)/i, domain: 'finance' },
  { pattern: /\b(?:loan|mortgage|credit\s+score|APR|interest\s+rate)/i, domain: 'finance' },
  // Real estate
  { pattern: /\b(?:property|listing|MLS|realtor|real\s+estate|mortgage)/i, domain: 'real estate' },
  // Education/EdTech
  { pattern: /\b(?:curriculum|student|enrollment|LMS|course|classroom)/i, domain: 'education' },
  // HR/Recruitment
  { pattern: /\b(?:applicant|hiring|onboarding|payroll|HR|recruiting)/i, domain: 'HR' },
  // Legal
  { pattern: /\b(?:litigation|legal\s+counsel|attorney|court|lawsuit)/i, domain: 'legal' },
  // Manufacturing
  { pattern: /\b(?:manufacturing|production\s+line|assembly|factory|supply\s+chain)/i, domain: 'manufacturing' },
  // SaaS-specific (only flag if not in a SaaS context)
  { pattern: /\b(?:MRR|ARR|churn\s+rate|LTV|CAC)/i, domain: 'SaaS metrics' },
];

/**
 * Product category drift detection - catches when AI confuses related but distinct products.
 * Example: TrainrHub is a trainer marketplace, but AI might drift to CRO/website optimization.
 */
interface ProductCategoryRule {
  /** Context indicators - if any match, this rule applies */
  contextIndicators: RegExp[];
  /** Output patterns to flag - if variant matches, it's drift */
  driftPatterns: { pattern: RegExp; description: string }[];
  /** Human-readable description of the mismatch */
  mismatchDescription: string;
}

const PRODUCT_CATEGORY_DRIFT_RULES: ProductCategoryRule[] = [
  // Marketplace/Platform → CRO/Website Optimization drift
  {
    contextIndicators: [
      /\b(?:marketplace|trainers?|coaches?|clients?|bookings?|sessions?)/i,
      /\b(?:connect(?:ing)?\s+(?:trainers?|coaches?|clients?))/i,
      /\b(?:fitness|personal\s+training|coaching\s+platform)/i,
    ],
    driftPatterns: [
      { pattern: /\b(?:CRO|conversion\s+rate\s+optimization)/i, description: 'CRO' },
      { pattern: /\b(?:website\s+visitors?|page\s+visitors?)/i, description: 'website visitors' },
      { pattern: /\b(?:landing\s+pages?|conversion\s+pages?)/i, description: 'landing pages' },
      { pattern: /\b(?:navigation\s+issues?|UX\s+optimization)/i, description: 'navigation/UX' },
      { pattern: /\b(?:bounce\s+rate|exit\s+rate|scroll\s+depth)/i, description: 'web analytics' },
      { pattern: /\b(?:A\/B\s+test|split\s+test|multivariate)/i, description: 'A/B testing' },
    ],
    mismatchDescription: 'CRO/website optimization language in marketplace context',
  },
  // CRO/Website Optimization → Marketplace/Trainers drift
  {
    contextIndicators: [
      /\b(?:CRO|conversion\s+rate\s+optimization)/i,
      /\b(?:website\s+optimization|landing\s+page)/i,
      /\b(?:web\s+analytics|user\s+experience|UX)/i,
    ],
    driftPatterns: [
      { pattern: /\b(?:trainers?|personal\s+trainers?|fitness\s+coaches?)/i, description: 'trainers' },
      { pattern: /\b(?:marketplace|trainer\s+marketplace)/i, description: 'marketplace' },
      { pattern: /\b(?:bookings?|sessions?|appointments?)/i, description: 'bookings' },
      { pattern: /\b(?:clients?\s+(?:connect|find|match))/i, description: 'client matching' },
    ],
    mismatchDescription: 'Trainer/marketplace language in CRO context',
  },
  // Agency/Services → SaaS Product drift
  {
    contextIndicators: [
      /\b(?:marketing\s+agency|digital\s+agency|creative\s+agency)/i,
      /\b(?:consulting|consultancy|professional\s+services)/i,
    ],
    driftPatterns: [
      { pattern: /\b(?:self-serve|self-service|no-code)/i, description: 'self-serve' },
      { pattern: /\b(?:freemium|free\s+trial|subscription\s+tier)/i, description: 'SaaS pricing' },
      { pattern: /\b(?:onboarding\s+wizard|product\s+tour)/i, description: 'product onboarding' },
    ],
    mismatchDescription: 'SaaS product language in agency/services context',
  },
];

/**
 * Generic engagement phrases that indicate low-signal drift when business definition is missing.
 */
const GENERIC_ENGAGEMENT_PATTERNS: RegExp[] = [
  /\bcustomer\s+engagement\b/i,
  /\bclient\s+engagement\b/i,
  /\baudience\s+engagement\b/i,
  /\bengagement\s+rates?\b/i,
  /\boptimi[sz]e\s+engagement\b/i,
  /\bdrive\s+engagement\b/i,
];

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Check for product category drift - detects when AI confuses related products.
 * E.g., TrainrHub (trainer marketplace) output containing CRO language.
 */
function checkProductCategoryDrift(
  text: string,
  contextValues: string[]
): { found: boolean; description?: string; phrase?: string } {
  const lowerContext = contextValues.join(' ').toLowerCase();

  for (const rule of PRODUCT_CATEGORY_DRIFT_RULES) {
    // Check if any context indicator matches
    const contextMatches = rule.contextIndicators.some(pattern =>
      pattern.test(lowerContext)
    );

    if (!contextMatches) continue;

    // If context matches, check for drift patterns in the variant
    for (const { pattern, description } of rule.driftPatterns) {
      const match = text.match(pattern);
      if (match) {
        // Make sure the drift term is NOT in the context (legitimate if user mentioned it)
        if (!lowerContext.includes(match[0].toLowerCase())) {
          return {
            found: true,
            description: rule.mismatchDescription,
            phrase: match[0],
          };
        }
      }
    }
  }

  return { found: false };
}

/**
 * Check for domain mismatch - variant mentions domain-specific terms
 * not present in the confirmed context. This detects when AI invents
 * domain context (e.g., mentions "healthcare" when context is about e-commerce).
 */
function checkDomainMismatch(
  text: string,
  contextValues: string[]
): { found: boolean; domain?: string; phrase?: string } {
  const lowerText = text.toLowerCase();
  const lowerContext = contextValues.join(' ').toLowerCase();

  for (const { pattern, domain } of DOMAIN_INDICATOR_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      // Check if this domain term is present in the context
      // We check for either the matched phrase or domain indicator words
      const matchedPhrase = match[0].toLowerCase();
      if (!lowerContext.includes(matchedPhrase)) {
        // Also check if any domain keywords are in context
        const domainKeywords = domain.toLowerCase().split(/[\s\/]+/);
        const domainInContext = domainKeywords.some(kw => lowerContext.includes(kw));
        if (!domainInContext) {
          return { found: true, domain, phrase: match[0] };
        }
      }
    }
  }

  return { found: false };
}

/**
 * Check if a variant contains a banned phrase
 */
function checkBannedPhrases(
  text: string,
  exclusions: string[]
): { found: boolean; phrase?: string } {
  const lowerText = text.toLowerCase();

  for (const phrase of exclusions) {
    const lowerPhrase = phrase.toLowerCase();
    if (lowerText.includes(lowerPhrase)) {
      return { found: true, phrase };
    }
  }

  return { found: false };
}

/**
 * Check for invented claims patterns
 */
function checkInventedClaims(text: string): { found: boolean; match?: string } {
  for (const pattern of INVENTED_CLAIM_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return { found: true, match: match[0] };
    }
  }
  return { found: false };
}

/**
 * Check for generic fluff phrases
 */
function checkGenericFluff(
  text: string,
  contextValues: string[]
): { found: boolean; phrase?: string } {
  const lowerText = text.toLowerCase();
  const lowerContext = contextValues.join(' ').toLowerCase();

  for (const phrase of GENERIC_FLUFF_PHRASES) {
    // Only flag if the phrase is in the variant but NOT in the original context
    if (lowerText.includes(phrase) && !lowerContext.includes(phrase)) {
      return { found: true, phrase };
    }
  }

  return { found: false };
}

/**
 * Check for category drift - mechanism/tool language not present in context.
 * This detects when the AI has drifted into describing product features
 * or capabilities that aren't grounded in the confirmed context.
 */
function checkCategoryDrift(
  text: string,
  contextValues: string[]
): { found: boolean; phrase?: string } {
  const lowerText = text.toLowerCase();
  const lowerContext = contextValues.join(' ').toLowerCase();

  for (const phrase of CATEGORY_DRIFT_PHRASES) {
    const lowerPhrase = phrase.toLowerCase();
    // Only flag if the phrase is in the variant but NOT in the original context
    // Use word boundary matching for short phrases to avoid false positives
    const wordBoundaryPattern = new RegExp(`\\b${lowerPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (wordBoundaryPattern.test(lowerText) && !lowerContext.includes(lowerPhrase)) {
      return { found: true, phrase };
    }
  }

  return { found: false };
}

/**
 * Check for CRO/Website-audit specific drift.
 * This is a high-confidence check for when AI drifts into CRO/website optimization
 * language that is NOT present in the confirmed context.
 */
function checkCRODrift(
  text: string,
  contextValues: string[]
): { found: boolean; label?: string; phrase?: string } {
  const lowerContext = contextValues.join(' ').toLowerCase();

  for (const { pattern, label } of CRO_INDICATOR_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      // Check if this term is present in the context (legitimate if user mentioned it)
      const matchedPhrase = match[0].toLowerCase();
      const labelLower = label.toLowerCase();

      // Check for the matched phrase or the label in context
      if (!lowerContext.includes(matchedPhrase) && !lowerContext.includes(labelLower)) {
        return { found: true, label, phrase: match[0] };
      }
    }
  }

  return { found: false };
}

/**
 * Check for constraint violations
 * e.g., if budget is "$5000/month max", don't claim "enterprise pricing"
 */
function checkConstraintViolations(
  text: string,
  snapshot: ConfirmedContextSnapshot
): { found: boolean; reason?: string } {
  const lowerText = text.toLowerCase();

  // Check budget constraints
  const budgetConstraint = snapshot.fields['operationalConstraints.budgetCapsFloors'];
  if (budgetConstraint) {
    const budgetStr = JSON.stringify(budgetConstraint).toLowerCase();

    // If budget is small, flag "enterprise" claims
    if (
      (budgetStr.includes('5000') || budgetStr.includes('10000')) &&
      lowerText.includes('enterprise')
    ) {
      return {
        found: true,
        reason: 'Claims "enterprise" but budget suggests smaller operation',
      };
    }
  }

  // Check resource constraints
  const resourceConstraint = snapshot.fields['operationalConstraints.resourceConstraints'];
  if (resourceConstraint) {
    const resourceStr = String(resourceConstraint).toLowerCase();

    // If small team, flag "large-scale" claims
    if (
      (resourceStr.includes('small') || resourceStr.includes('2-3') || resourceStr.includes('limited')) &&
      (lowerText.includes('large-scale') || lowerText.includes('global presence'))
    ) {
      return {
        found: true,
        reason: 'Claims scale beyond stated resource constraints',
      };
    }
  }

  return { found: false };
}

/**
 * Check for quality issues
 */
function checkQuality(text: string, maxWords: number): { found: boolean; reason?: string } {
  // Too short
  if (text.trim().length < 10) {
    return { found: true, reason: 'Variant is too short' };
  }

  // Too long
  const wordCount = text.split(/\s+/).length;
  if (wordCount > maxWords * 1.5) {
    return { found: true, reason: `Variant exceeds ${maxWords} word limit (has ${wordCount})` };
  }

  // Mostly placeholder/template
  if (text.includes('[') && text.includes(']')) {
    return { found: true, reason: 'Variant contains unfilled placeholders' };
  }

  return { found: false };
}

// ============================================================================
// Main Validation Function
// ============================================================================

/**
 * Validate generated variants against contract and context
 *
 * @param variants - The generated variant texts
 * @param contract - The contract that was used
 * @param snapshot - The confirmed context snapshot
 * @returns Validation result with warnings
 */
export function validateGeneratedVariants(
  variants: string[],
  contract: AIGenerationContract,
  snapshot: ConfirmedContextSnapshot,
  opts?: {
    businessDefinitionMissing?: boolean;
    hasGapBusinessSummary?: boolean;
  }
): ValidationResult {
  const businessDefinitionMissing = !!opts?.businessDefinitionMissing;
  const hasGapBusinessSummary = !!opts?.hasGapBusinessSummary;
  const warnings: VariantWarning[] = [];

  // Collect context values for fluff checking
  const contextValues: string[] = [];
  for (const value of Object.values(snapshot.fields)) {
    if (typeof value === 'string') {
      contextValues.push(value);
    } else if (Array.isArray(value)) {
      for (const v of value) {
        if (typeof v === 'string') contextValues.push(v);
        else if (typeof v === 'object' && v !== null && 'name' in v) {
          contextValues.push(String((v as { name: unknown }).name));
        }
      }
    }
  }

  for (let i = 0; i < variants.length; i++) {
    const text = variants[i];

    // Check banned phrases from contract
    if (contract.exclusions && contract.exclusions.length > 0) {
      const bannedCheck = checkBannedPhrases(text, contract.exclusions);
      if (bannedCheck.found) {
        warnings.push({
          variantIndex: i,
          type: 'banned_phrase',
          reason: `Contains banned phrase: "${bannedCheck.phrase}"`,
          severity: 'warning',
          action: WARNING_ACTION_MAP.banned_phrase,
          matchedPhrase: bannedCheck.phrase,
          meta: { phrases: [bannedCheck.phrase!] },
        });
      }
    }

    // Check invented claims
    const inventedCheck = checkInventedClaims(text);
    if (inventedCheck.found) {
      warnings.push({
        variantIndex: i,
        type: 'invented_claim',
        reason: `May contain invented claim: "${inventedCheck.match}"`,
        severity: 'warning',
        action: WARNING_ACTION_MAP.invented_claim,
        matchedPhrase: inventedCheck.match,
        meta: { pattern: inventedCheck.match },
      });
    }

    // Check generic fluff
    const fluffCheck = checkGenericFluff(text, contextValues);
    if (fluffCheck.found) {
      warnings.push({
        variantIndex: i,
        type: 'generic_fluff',
        reason: `Contains generic phrase not in context: "${fluffCheck.phrase}"`,
        severity: 'warning',
        action: WARNING_ACTION_MAP.generic_fluff,
        matchedPhrase: fluffCheck.phrase,
        meta: { phrases: [fluffCheck.phrase!] },
      });
    }

    // Generic engagement drift guardrail (only when we lack business definition and have no GAP fallback)
    if (businessDefinitionMissing && !hasGapBusinessSummary) {
      for (const pattern of GENERIC_ENGAGEMENT_PATTERNS) {
        const match = text.match(pattern);
        if (match) {
          warnings.push({
            variantIndex: i,
            type: 'category_drift',
            reason: `Contains generic engagement claim without business definition: "${match[0]}"`,
            severity: 'warning',
            action: WARNING_ACTION_MAP.category_drift,
            matchedPhrase: match[0],
            meta: { pattern: pattern.toString(), tags: ['generic_engagement'] },
          });
          break;
        }
      }
    }

    // Check category drift - mechanism/tool language not in context
    const driftCheck = checkCategoryDrift(text, contextValues);
    if (driftCheck.found) {
      warnings.push({
        variantIndex: i,
        type: 'category_drift',
        reason: `Contains mechanism/tool language not in context: "${driftCheck.phrase}"`,
        severity: 'warning',
        action: WARNING_ACTION_MAP.category_drift,
        matchedPhrase: driftCheck.phrase,
        meta: { phrases: [driftCheck.phrase!] },
      });
    }

    // Check CRO/Website-audit specific drift (high-confidence pattern)
    const croDriftCheck = checkCRODrift(text, contextValues);
    if (croDriftCheck.found) {
      warnings.push({
        variantIndex: i,
        type: 'category_drift',
        reason: `Contains CRO/website-audit language not in context: "${croDriftCheck.phrase}" (${croDriftCheck.label})`,
        severity: 'warning',
        action: WARNING_ACTION_MAP.category_drift,
        matchedPhrase: croDriftCheck.phrase,
        meta: { phrases: [croDriftCheck.phrase!] },
      });
    }

    // Check domain mismatch - domain-specific terminology not in context
    const domainCheck = checkDomainMismatch(text, contextValues);
    if (domainCheck.found) {
      warnings.push({
        variantIndex: i,
        type: 'domain_mismatch',
        reason: `References ${domainCheck.domain} domain not present in context: "${domainCheck.phrase}"`,
        severity: 'warning',
        action: WARNING_ACTION_MAP.domain_mismatch,
        matchedPhrase: domainCheck.phrase,
        meta: { phrases: [domainCheck.phrase!] },
      });
    }

    // Check product category drift - e.g., marketplace context with CRO language
    const categoryDriftCheck = checkProductCategoryDrift(text, contextValues);
    if (categoryDriftCheck.found) {
      warnings.push({
        variantIndex: i,
        type: 'domain_mismatch', // Reuse domain_mismatch type for consistency
        reason: `${categoryDriftCheck.description}: "${categoryDriftCheck.phrase}"`,
        severity: 'warning',
        action: WARNING_ACTION_MAP.domain_mismatch,
        matchedPhrase: categoryDriftCheck.phrase,
        meta: { phrases: [categoryDriftCheck.phrase!] },
      });
    }

    // Check constraint violations
    const constraintCheck = checkConstraintViolations(text, snapshot);
    if (constraintCheck.found) {
      warnings.push({
        variantIndex: i,
        type: 'constraint_violation',
        reason: constraintCheck.reason!,
        severity: 'error',
        action: WARNING_ACTION_MAP.constraint_violation,
        meta: { constraint: constraintCheck.reason },
      });
    }

    // Check quality
    const qualityCheck = checkQuality(text, contract.outputSpec.maxWords);
    if (qualityCheck.found) {
      // Determine specific quality type
      const qualityType: VariantWarningType = qualityCheck.reason!.includes('too short')
        ? 'quality_too_short'
        : qualityCheck.reason!.includes('word limit')
        ? 'quality_too_long'
        : 'quality_placeholder';

      warnings.push({
        variantIndex: i,
        type: qualityType,
        reason: qualityCheck.reason!,
        severity: 'error',
        action: WARNING_ACTION_MAP[qualityType],
      });
    }
  }

  // Build summary
  let summary: string | null = null;
  if (warnings.length > 0) {
    const errorCount = warnings.filter((w) => w.severity === 'error').length;
    const warningCount = warnings.filter((w) => w.severity === 'warning').length;
    const parts: string[] = [];
    if (errorCount > 0) parts.push(`${errorCount} error${errorCount > 1 ? 's' : ''}`);
    if (warningCount > 0) parts.push(`${warningCount} warning${warningCount > 1 ? 's' : ''}`);
    summary = parts.join(', ');
  }

  return {
    valid: warnings.filter((w) => w.severity === 'error').length === 0,
    warnings,
    summary,
  };
}

// ============================================================================
// Deterministic Repair Functions
// ============================================================================

/**
 * Result of a deterministic repair operation
 */
export interface RepairResult {
  /** The repaired text */
  text: string;
  /** Whether the repair was successful */
  success: boolean;
  /** What was changed */
  changes: string[];
}

/**
 * Remove banned/flagged phrases from text deterministically
 * Preserves sentence structure as much as possible
 *
 * @param text - The original variant text
 * @param phrases - Phrases to remove
 * @returns Repair result with cleaned text
 */
export function removePhrasesFromText(
  text: string,
  phrases: string[]
): RepairResult {
  let result = text;
  const changes: string[] = [];

  for (const phrase of phrases) {
    // Create case-insensitive pattern that handles word boundaries
    const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Try to match with surrounding context for cleaner removal
    const patterns = [
      // ", phrase" or "phrase," patterns
      new RegExp(`\\s*,\\s*${escapedPhrase}`, 'gi'),
      new RegExp(`${escapedPhrase}\\s*,\\s*`, 'gi'),
      // " phrase " pattern (word boundary)
      new RegExp(`\\b${escapedPhrase}\\b`, 'gi'),
    ];

    for (const pattern of patterns) {
      if (pattern.test(result)) {
        const before = result;
        result = result.replace(pattern, '');
        if (result !== before) {
          changes.push(`Removed "${phrase}"`);
          break; // Only apply one pattern per phrase
        }
      }
    }
  }

  // Clean up double spaces and fix punctuation
  result = result
    .replace(/\s+/g, ' ')           // Collapse multiple spaces
    .replace(/\s+([.,!?])/g, '$1')  // Remove space before punctuation
    .replace(/([.,!?])\s*([.,!?])/g, '$1') // Remove double punctuation
    .replace(/^\s+|\s+$/g, '')      // Trim
    .replace(/\s*,\s*,/g, ',')      // Remove double commas
    .replace(/^\s*,\s*/, '')        // Remove leading comma
    .replace(/\s*,\s*$/, '');       // Remove trailing comma

  // Ensure sentence starts with capital letter
  if (result.length > 0) {
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }

  return {
    text: result,
    success: changes.length > 0,
    changes,
  };
}

/**
 * Get the highest priority fix action for a variant
 * Prioritizes errors over warnings, then by action type
 *
 * @param warnings - All warnings for this variant
 * @returns The primary action to offer, or null if none
 */
export function getPrimaryFixAction(
  warnings: VariantWarning[]
): { action: VariantWarningAction; warnings: VariantWarning[] } | null {
  if (warnings.length === 0) return null;

  // Sort by severity (errors first), then by action priority
  const actionPriority: VariantWarningAction[] = [
    'remove_phrase',           // Deterministic, instant
    'rewrite_with_constraints', // Targeted AI
    'rewrite_defensible',      // Targeted AI
    'regenerate_stricter',     // Full regeneration
  ];

  const sorted = [...warnings].sort((a, b) => {
    // Errors before warnings
    if (a.severity === 'error' && b.severity !== 'error') return -1;
    if (b.severity === 'error' && a.severity !== 'error') return 1;

    // Then by action priority (prefer deterministic fixes)
    const aIdx = actionPriority.indexOf(a.action);
    const bIdx = actionPriority.indexOf(b.action);
    return aIdx - bIdx;
  });

  const primaryAction = sorted[0].action;

  // Return all warnings that can be fixed with this action
  const actionableWarnings = warnings.filter(w => w.action === primaryAction);

  return {
    action: primaryAction,
    warnings: actionableWarnings,
  };
}

/**
 * Collect all phrases to remove from warnings
 * Aggregates from meta.phrases across multiple warnings
 */
export function collectPhrasesToRemove(warnings: VariantWarning[]): string[] {
  const phrases: string[] = [];

  for (const warning of warnings) {
    if (warning.action === 'remove_phrase' && warning.meta?.phrases) {
      phrases.push(...warning.meta.phrases);
    }
    // Also include matchedPhrase as fallback
    if (warning.matchedPhrase && !phrases.includes(warning.matchedPhrase)) {
      phrases.push(warning.matchedPhrase);
    }
  }

  return [...new Set(phrases)]; // Deduplicate
}

// ============================================================================
// Output Parsing
// ============================================================================

/**
 * Parsed variant with metadata
 */
export interface ParsedVariant {
  text: string;
  index: number;
}

/**
 * Parse AI output into variants, handling various formats:
 * - JSON object with variants array
 * - Numbered lists (1. First, 2. Second)
 * - Bullet lists (- First, * Second)
 * - Separated paragraphs
 *
 * @param output - Raw AI output text
 * @param expectedCount - Expected number of variants
 * @returns Parsed variants
 */
export function parseVariantsFromOutput(
  output: string,
  expectedCount: number
): { variants: string[]; parseMethod: string } {
  // Clean the output
  let cleaned = output.trim();

  // Try JSON first (preferred)
  const jsonResult = tryParseJson(cleaned);
  if (jsonResult.ok && jsonResult.variants.length > 0) {
    return {
      variants: normalizeVariants(jsonResult.variants, expectedCount),
      parseMethod: 'json',
    };
  }

  // Try numbered list (1. First, 2. Second)
  const numberedResult = tryParseNumberedList(cleaned);
  if (numberedResult.length > 0) {
    return {
      variants: normalizeVariants(numberedResult, expectedCount),
      parseMethod: 'numbered',
    };
  }

  // Try bullet list (- First, * Second)
  const bulletResult = tryParseBulletList(cleaned);
  if (bulletResult.length > 0) {
    return {
      variants: normalizeVariants(bulletResult, expectedCount),
      parseMethod: 'bullets',
    };
  }

  // Try paragraph separation
  const paragraphResult = tryParseParagraphs(cleaned);
  if (paragraphResult.length > 0) {
    return {
      variants: normalizeVariants(paragraphResult, expectedCount),
      parseMethod: 'paragraphs',
    };
  }

  // Fallback: return cleaned output as single variant
  return {
    variants: normalizeVariants([cleaned], expectedCount),
    parseMethod: 'fallback',
  };
}

/**
 * Try to parse JSON format
 */
function tryParseJson(text: string): { ok: boolean; variants: string[] } {
  try {
    // Remove markdown code blocks if present
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    // Try to find JSON object
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonStr = objectMatch[0];
    }

    const parsed = JSON.parse(jsonStr);

    // Handle { variants: [{text: "..."}, ...] } format
    if (parsed.variants && Array.isArray(parsed.variants)) {
      const variants = parsed.variants
        .map((v: { text?: string } | string) => {
          if (typeof v === 'string') return v;
          return v.text || '';
        })
        .filter((v: string) => v.trim().length > 0);
      return { ok: true, variants };
    }

    // Handle array of strings
    if (Array.isArray(parsed)) {
      const variants = parsed
        .map((v: unknown) => {
          if (typeof v === 'string') return v;
          if (typeof v === 'object' && v !== null && 'text' in v) {
            return String((v as { text: unknown }).text);
          }
          return '';
        })
        .filter((v: string) => v.trim().length > 0);
      return { ok: true, variants };
    }

    return { ok: false, variants: [] };
  } catch {
    return { ok: false, variants: [] };
  }
}

/**
 * Try to parse numbered list format
 */
function tryParseNumberedList(text: string): string[] {
  // Match patterns like "1. Text", "1) Text", "1: Text"
  const pattern = /^\s*\d+[.):\s]+(.+?)(?=\n\s*\d+[.):\s]|$)/gm;
  const matches = [...text.matchAll(pattern)];

  if (matches.length === 0) return [];

  return matches
    .map((m) => cleanVariantText(m[1]))
    .filter((v) => v.length > 0);
}

/**
 * Try to parse bullet list format
 */
function tryParseBulletList(text: string): string[] {
  // Match patterns like "- Text", "* Text", "• Text"
  const pattern = /^\s*[-*•]\s+(.+?)(?=\n\s*[-*•]|$)/gm;
  const matches = [...text.matchAll(pattern)];

  if (matches.length === 0) return [];

  return matches
    .map((m) => cleanVariantText(m[1]))
    .filter((v) => v.length > 0);
}

/**
 * Try to parse paragraph-separated format
 */
function tryParseParagraphs(text: string): string[] {
  // Split by double newlines
  const paragraphs = text.split(/\n\n+/);

  return paragraphs
    .map((p) => cleanVariantText(p))
    .filter((v) => v.length > 10); // Filter very short paragraphs
}

/**
 * Clean variant text (remove headings, numbering, etc.)
 */
function cleanVariantText(text: string): string {
  let cleaned = text.trim();

  // Remove markdown headings
  cleaned = cleaned.replace(/^#+\s+/gm, '');

  // Remove "Variant X:" prefix
  cleaned = cleaned.replace(/^(?:variant|option)\s*\d*[:\s]*/i, '');

  // Remove leading numbering/bullets
  cleaned = cleaned.replace(/^\s*(?:\d+[.):\s]+|[-*•]\s+)/, '');

  // Remove quotes if the entire text is quoted
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);
  }

  return cleaned.trim();
}

/**
 * Normalize variants to expected count
 */
function normalizeVariants(variants: string[], expectedCount: number): string[] {
  // Filter empty/whitespace-only variants
  const cleaned = variants.filter((v) => v.trim().length > 0);

  if (cleaned.length === 0) {
    return [];
  }

  // If we have more than expected, take first N
  if (cleaned.length > expectedCount) {
    return cleaned.slice(0, expectedCount);
  }

  // If we have fewer, return what we have
  return cleaned;
}
