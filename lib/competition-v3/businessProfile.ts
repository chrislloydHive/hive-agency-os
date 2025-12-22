// lib/competition-v3/businessProfile.ts
// Business Type Sanity Gate
//
// Computes a business profile with confidence scoring to prevent
// Competition V3 from generating obviously wrong competitors.
//
// When confidence is too low (missing website, empty description, unknown category),
// the run should NOT output "direct competitors" - only alternatives or error state.

import type { QueryContext, VerticalCategory, CompanyArchetype } from './types';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Safely join array or return string value
 */
function safeJoin(value: unknown, separator: string = ', '): string {
  if (Array.isArray(value)) {
    return value.join(separator);
  }
  if (typeof value === 'string') {
    return value;
  }
  return '';
}

// ============================================================================
// Types
// ============================================================================

/**
 * Inferred business category based on available signals
 */
export type InferredCategory =
  | 'marketing_agency'
  | 'software_saas'
  | 'local_service'
  | 'ecommerce_retail'
  | 'professional_services'
  | 'manufacturing'
  | 'marketplace'
  | 'financial_services'
  | 'healthcare'
  | 'education'
  | 'hospitality'
  | 'automotive_service'
  | 'construction_trades'
  | 'logistics_dispatch'
  | 'unknown';

/**
 * Evidence source for confidence scoring
 */
export interface EvidenceSource {
  field: string;
  value: string | null;
  hasValue: boolean;
  confidence: number; // 0-1 contribution to overall confidence
}

/**
 * Computed business profile with confidence scoring
 */
export interface BusinessProfile {
  // Core identity
  companyName: string;
  websiteUrl: string | null;
  companyDescription: string | null;

  // Inferred classification
  inferredCategory: InferredCategory;
  inferredAudience: string | null;

  // Vertical/Archetype (from existing detection)
  verticalCategory: VerticalCategory;
  archetype: CompanyArchetype;

  // Confidence scoring
  confidence: number; // 0-1 overall confidence
  confidenceLevel: 'high' | 'medium' | 'low' | 'very_low';

  // Evidence tracking
  evidence: EvidenceSource[];

  // Warnings/issues
  warnings: string[];

  // Whether this profile is sufficient to run competitor discovery
  canRunDiscovery: boolean;
  gateReason: string | null;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Minimum confidence threshold for running competitor discovery
 */
export const MIN_DISCOVERY_CONFIDENCE = 0.5;

/**
 * Field weights for confidence calculation
 */
const FIELD_WEIGHTS = {
  websiteUrl: 0.25,          // Critical - can't identify business without website
  companyDescription: 0.20,  // Very important - describes what they do
  primaryOffers: 0.15,       // Important - what services/products
  icpDescription: 0.15,      // Important - who they serve
  industry: 0.10,            // Helpful context
  businessModel: 0.10,       // Helpful context
  valueProposition: 0.05,    // Nice to have
} as const;

/**
 * Category detection patterns
 */
const CATEGORY_PATTERNS: Record<InferredCategory, RegExp[]> = {
  marketing_agency: [
    /marketing\s*agency/i,
    /digital\s*marketing/i,
    /seo\s*agency/i,
    /advertising\s*agency/i,
    /social\s*media\s*marketing/i,
    /content\s*marketing/i,
    /ppc\s*agency/i,
    /branding\s*agency/i,
  ],
  software_saas: [
    /saas/i,
    /software\s*as\s*a\s*service/i,
    /cloud\s*platform/i,
    /software\s*platform/i,
    /app\s*platform/i,
    /enterprise\s*software/i,
  ],
  local_service: [
    /local\s*service/i,
    /home\s*service/i,
    /plumb(er|ing)/i,
    /electric(ian|al)/i,
    /hvac/i,
    /landscap/i,
    /cleaning\s*service/i,
    /repair\s*service/i,
    /auto\s*repair/i,
    /car\s*audio/i,
    /vehicle\s*installation/i,
    /tow(ing)?/i,
    /dispatch/i,
  ],
  ecommerce_retail: [
    /e-?commerce/i,
    /online\s*store/i,
    /retail/i,
    /shop(ping)?/i,
    /d2c|dtc|direct.to.consumer/i,
  ],
  professional_services: [
    /consult(ant|ing)/i,
    /law\s*firm/i,
    /accounting/i,
    /legal\s*service/i,
    /financial\s*advisor/i,
    /tax\s*service/i,
  ],
  manufacturing: [
    /manufactur/i,
    /industrial/i,
    /production/i,
    /fabricat/i,
  ],
  marketplace: [
    /marketplace/i,
    /two.sided/i,
    /platform\s*connect/i,
    /matching\s*platform/i,
  ],
  financial_services: [
    /bank(ing)?/i,
    /credit\s*union/i,
    /insurance/i,
    /fintech/i,
    /lending/i,
    /mortgage/i,
  ],
  healthcare: [
    /healthcare/i,
    /medical/i,
    /clinic/i,
    /hospital/i,
    /dental/i,
    /therapy/i,
  ],
  education: [
    /education/i,
    /training/i,
    /school/i,
    /university/i,
    /course/i,
    /learning/i,
  ],
  hospitality: [
    /hotel/i,
    /restaurant/i,
    /hospitality/i,
    /catering/i,
    /event\s*venue/i,
  ],
  automotive_service: [
    /auto(motive)?\s*(service|repair|shop)/i,
    /car\s*(service|repair|shop)/i,
    /vehicle\s*(service|repair)/i,
    /tire\s*shop/i,
    /oil\s*change/i,
    /collision/i,
    /body\s*shop/i,
    /detailing/i,
    /car\s*audio/i,
    /tint(ing)?/i,
    /wrap(ping)?/i,
  ],
  construction_trades: [
    /construct(ion)?/i,
    /contractor/i,
    /remodel/i,
    /renovation/i,
    /roof(ing)?/i,
    /floor(ing)?/i,
    /paint(ing)?/i,
  ],
  logistics_dispatch: [
    /dispatch/i,
    /tow(ing)?/i,
    /roadside/i,
    /logistics/i,
    /freight/i,
    /trucking/i,
    /transport/i,
    /delivery/i,
    /courier/i,
  ],
  unknown: [],
};

// ============================================================================
// Main Function
// ============================================================================

/**
 * Compute a business profile with confidence scoring
 *
 * @param context - The QueryContext built from company data
 * @param rawGraphData - Optional raw Context Graph data for additional evidence
 * @returns BusinessProfile with confidence scoring
 */
export function computeBusinessProfile(
  context: QueryContext,
  rawGraphData?: Record<string, any>
): BusinessProfile {
  const evidence: EvidenceSource[] = [];
  const warnings: string[] = [];

  // =========================================================================
  // Collect Evidence
  // =========================================================================

  // Website URL
  const hasWebsite = !!context.domain;
  evidence.push({
    field: 'websiteUrl',
    value: context.domain,
    hasValue: hasWebsite,
    confidence: hasWebsite ? 1.0 : 0.0,
  });
  if (!hasWebsite) {
    warnings.push('Missing website URL - cannot verify business type');
  }

  // Company description (from various sources)
  const description = buildDescription(context);
  const hasDescription = !!description && description.length > 20;
  evidence.push({
    field: 'companyDescription',
    value: description,
    hasValue: hasDescription,
    confidence: hasDescription ? (description.length > 100 ? 1.0 : 0.6) : 0.0,
  });
  if (!hasDescription) {
    warnings.push('Missing or insufficient company description');
  }

  // Primary offers
  const offersValue = safeJoin(context.primaryOffers);
  const hasOffers = offersValue.length > 0;
  const offersCount = Array.isArray(context.primaryOffers) ? context.primaryOffers.length : (offersValue ? 1 : 0);
  evidence.push({
    field: 'primaryOffers',
    value: hasOffers ? offersValue : null,
    hasValue: hasOffers,
    confidence: hasOffers ? Math.min(offersCount / 3, 1.0) : 0.0,
  });
  if (!hasOffers) {
    warnings.push('No primary offers/services identified');
  }

  // ICP description
  const hasIcp = !!context.icpDescription && context.icpDescription.length > 10;
  evidence.push({
    field: 'icpDescription',
    value: context.icpDescription,
    hasValue: hasIcp,
    confidence: hasIcp ? 1.0 : 0.0,
  });
  if (!hasIcp) {
    warnings.push('No target audience/ICP identified');
  }

  // Industry
  const hasIndustry = !!context.industry;
  evidence.push({
    field: 'industry',
    value: context.industry,
    hasValue: hasIndustry,
    confidence: hasIndustry ? 1.0 : 0.0,
  });

  // Business model
  const hasBusinessModel = !!context.businessModel;
  evidence.push({
    field: 'businessModel',
    value: context.businessModel,
    hasValue: hasBusinessModel,
    confidence: hasBusinessModel ? 1.0 : 0.0,
  });

  // Value proposition
  const hasValueProp = !!context.valueProposition;
  evidence.push({
    field: 'valueProposition',
    value: context.valueProposition,
    hasValue: hasValueProp,
    confidence: hasValueProp ? 1.0 : 0.0,
  });

  // =========================================================================
  // Calculate Overall Confidence
  // =========================================================================

  let weightedSum = 0;
  let totalWeight = 0;

  for (const ev of evidence) {
    const weight = FIELD_WEIGHTS[ev.field as keyof typeof FIELD_WEIGHTS] || 0.05;
    weightedSum += ev.confidence * weight;
    totalWeight += weight;
  }

  const confidence = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // Determine confidence level
  let confidenceLevel: BusinessProfile['confidenceLevel'];
  if (confidence >= 0.8) {
    confidenceLevel = 'high';
  } else if (confidence >= 0.6) {
    confidenceLevel = 'medium';
  } else if (confidence >= 0.4) {
    confidenceLevel = 'low';
  } else {
    confidenceLevel = 'very_low';
  }

  // =========================================================================
  // Infer Business Category
  // =========================================================================

  const inferredCategory = inferCategory(context, description);

  // =========================================================================
  // Infer Audience
  // =========================================================================

  const inferredAudience = inferAudience(context);

  // =========================================================================
  // Determine if we can run discovery
  // =========================================================================

  let canRunDiscovery = true;
  let gateReason: string | null = null;

  // Gate 1: Minimum confidence threshold
  if (confidence < MIN_DISCOVERY_CONFIDENCE) {
    canRunDiscovery = false;
    gateReason = `Confidence too low (${(confidence * 100).toFixed(0)}% < ${(MIN_DISCOVERY_CONFIDENCE * 100).toFixed(0)}% threshold)`;
  }

  // Gate 2: Must have website
  if (!hasWebsite) {
    canRunDiscovery = false;
    gateReason = gateReason || 'Missing website URL';
  }

  // Gate 3: Category must not be unknown with low confidence
  if (inferredCategory === 'unknown' && confidence < 0.7) {
    canRunDiscovery = false;
    gateReason = gateReason || 'Cannot determine business category with sufficient confidence';
  }

  // Gate 4: Must have at least description OR offers+ICP
  if (!hasDescription && !(hasOffers && hasIcp)) {
    canRunDiscovery = false;
    gateReason = gateReason || 'Insufficient business context (need description or offers+ICP)';
  }

  // =========================================================================
  // Build Profile
  // =========================================================================

  const profile: BusinessProfile = {
    companyName: context.businessName,
    websiteUrl: context.domain ? `https://${context.domain}` : null,
    companyDescription: description,
    inferredCategory,
    inferredAudience,
    verticalCategory: context.verticalCategory || 'unknown',
    archetype: context.archetype || 'unknown',
    confidence,
    confidenceLevel,
    evidence,
    warnings,
    canRunDiscovery,
    gateReason,
  };

  // Log the profile for debugging
  console.log('[businessProfile] Computed profile:', {
    companyName: profile.companyName,
    websiteUrl: profile.websiteUrl,
    inferredCategory: profile.inferredCategory,
    verticalCategory: profile.verticalCategory,
    archetype: profile.archetype,
    confidence: `${(profile.confidence * 100).toFixed(0)}%`,
    confidenceLevel: profile.confidenceLevel,
    canRunDiscovery: profile.canRunDiscovery,
    gateReason: profile.gateReason,
    warnings: profile.warnings,
    evidenceSummary: evidence.map(e => `${e.field}: ${e.hasValue ? '✓' : '✗'}`).join(', '),
  });

  return profile;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build a description from available context
 */
function buildDescription(context: QueryContext): string | null {
  const parts: string[] = [];

  if (context.valueProposition) {
    parts.push(context.valueProposition);
  }

  const offersStr = safeJoin(context.primaryOffers);
  if (offersStr) {
    parts.push(`Offers: ${offersStr}`);
  }

  if (context.icpDescription) {
    parts.push(`Target: ${context.icpDescription}`);
  }

  if (context.industry) {
    parts.push(`Industry: ${context.industry}`);
  }

  if (context.businessModel) {
    parts.push(`Model: ${context.businessModel}`);
  }

  return parts.length > 0 ? parts.join('. ') : null;
}

/**
 * Infer business category from context
 */
function inferCategory(context: QueryContext, description: string | null): InferredCategory {
  // Build text corpus for matching
  const corpus = [
    context.businessName,
    context.industry,
    context.businessModel,
    context.valueProposition,
    context.icpDescription,
    ...(context.primaryOffers || []),
    ...(context.differentiators || []),
    description,
  ].filter(Boolean).join(' ').toLowerCase();

  if (!corpus || corpus.length < 10) {
    return 'unknown';
  }

  // Score each category
  const scores: { category: InferredCategory; score: number }[] = [];

  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    if (category === 'unknown') continue;

    let score = 0;
    for (const pattern of patterns) {
      if (pattern.test(corpus)) {
        score += 1;
      }
    }

    if (score > 0) {
      scores.push({ category: category as InferredCategory, score });
    }
  }

  // Also consider vertical category mapping
  if (context.verticalCategory && context.verticalCategory !== 'unknown') {
    const verticalMapping: Partial<Record<VerticalCategory, InferredCategory>> = {
      'retail': 'ecommerce_retail',
      'services': 'professional_services',
      'software': 'software_saas',
      'manufacturing': 'manufacturing',
      'consumer-dtc': 'ecommerce_retail',
      'automotive': 'automotive_service',
      'marketplace': 'marketplace',
      'financial-services': 'financial_services',
    };

    const mappedCategory = verticalMapping[context.verticalCategory];
    if (mappedCategory) {
      scores.push({ category: mappedCategory, score: 2 }); // Higher weight for vertical
    }
  }

  // Consider archetype mapping
  if (context.archetype && context.archetype !== 'unknown') {
    const archetypeMapping: Partial<Record<CompanyArchetype, InferredCategory>> = {
      'agency': 'marketing_agency',
      'saas': 'software_saas',
      'ecommerce': 'ecommerce_retail',
      'local_service': 'local_service',
      'consultancy': 'professional_services',
      'two_sided_marketplace': 'marketplace',
    };

    const mappedCategory = archetypeMapping[context.archetype];
    if (mappedCategory) {
      scores.push({ category: mappedCategory, score: 2 }); // Higher weight for archetype
    }
  }

  // Return highest scoring category
  if (scores.length === 0) {
    return 'unknown';
  }

  scores.sort((a, b) => b.score - a.score);
  return scores[0].category;
}

/**
 * Infer target audience from context
 */
function inferAudience(context: QueryContext): string | null {
  if (context.icpDescription) {
    return context.icpDescription;
  }

  const parts: string[] = [];

  if (context.businessModelCategory) {
    parts.push(context.businessModelCategory);
  }

  if (context.icpStage) {
    parts.push(`${context.icpStage} companies`);
  }

  const industriesStr = safeJoin(
    Array.isArray(context.targetIndustries)
      ? context.targetIndustries.slice(0, 2)
      : context.targetIndustries
  );
  if (industriesStr) {
    parts.push(`in ${industriesStr}`);
  }

  return parts.length > 0 ? parts.join(' ') : null;
}

// ============================================================================
// Exports for Testing
// ============================================================================

export const _testing = {
  FIELD_WEIGHTS,
  CATEGORY_PATTERNS,
  MIN_DISCOVERY_CONFIDENCE,
  buildDescription,
  inferCategory,
  inferAudience,
};
