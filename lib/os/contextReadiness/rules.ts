// lib/os/contextReadiness/rules.ts
// Context Readiness Rules Engine
//
// Centralized, deterministic rules for context readiness.
// No AI calls - pure logic based on data presence and quality.

import type {
  ContextDomainKey,
  RequirementLevel,
  RequiredForFeature,
  DomainConfig,
  FeatureRequirements,
  DomainCheck,
  ContextGraphSnapshot,
  ReadinessCTA,
  ReadinessCTAType,
} from './types';

// ============================================================================
// Domain Configuration
// ============================================================================

/**
 * Domain configurations with associated labs
 */
export const DOMAIN_CONFIGS: Record<ContextDomainKey, DomainConfig> = {
  audience: {
    domain: 'audience',
    label: 'Audience',
    labSlug: 'audience',
    labName: 'Audience Lab',
    contextDomains: ['audience'],
  },
  competitiveLandscape: {
    domain: 'competitiveLandscape',
    label: 'Competitive Landscape',
    labSlug: 'competitor',
    labName: 'Competition Lab',
    contextDomains: ['competitive'],
  },
  brand: {
    domain: 'brand',
    label: 'Brand',
    labSlug: 'brand',
    labName: 'Brand Lab',
    contextDomains: ['brand', 'productOffer'],
  },
  website: {
    domain: 'website',
    label: 'Website',
    labSlug: 'website',
    labName: 'Website Lab',
    contextDomains: ['website'],
  },
  seo: {
    domain: 'seo',
    label: 'SEO',
    labSlug: 'seo',
    labName: 'SEO Lab',
    contextDomains: ['seo'],
  },
  media: {
    domain: 'media',
    label: 'Media',
    labSlug: 'media',
    labName: 'Media Lab',
    contextDomains: ['performanceMedia'],
  },
  creative: {
    domain: 'creative',
    label: 'Creative',
    labSlug: 'creative',
    labName: 'Creative Lab',
    contextDomains: ['creative'],
  },
};

/**
 * All domain keys in display order
 */
export const DOMAIN_DISPLAY_ORDER: ContextDomainKey[] = [
  'audience',
  'competitiveLandscape',
  'brand',
  'website',
  'seo',
  'media',
  'creative',
];

// ============================================================================
// Feature Requirements
// ============================================================================

/**
 * Feature-specific domain requirements
 */
export const FEATURE_REQUIREMENTS: Record<RequiredForFeature, FeatureRequirements> = {
  overview: {
    feature: 'overview',
    requirements: {
      audience: 'recommended',
      competitiveLandscape: 'recommended',
      brand: 'recommended',
      website: 'recommended',
      seo: 'optional',
      media: 'optional',
      creative: 'optional',
    },
  },
  proposals: {
    feature: 'proposals',
    requirements: {
      // For proposals, domains with pending proposals become "required" to review
      // This is dynamically adjusted in compute.ts
      audience: 'recommended',
      competitiveLandscape: 'recommended',
      brand: 'recommended',
      website: 'recommended',
      seo: 'optional',
      media: 'optional',
      creative: 'optional',
    },
  },
  strategy: {
    feature: 'strategy',
    requirements: {
      audience: 'required',
      competitiveLandscape: 'required',
      brand: 'recommended',
      website: 'recommended',
      seo: 'optional',
      media: 'optional',
      creative: 'optional',
    },
  },
  'gap-plan': {
    feature: 'gap-plan',
    requirements: {
      audience: 'required',
      competitiveLandscape: 'required',
      brand: 'required',
      website: 'recommended',
      seo: 'optional',
      media: 'optional',
      creative: 'optional',
    },
  },
  labs: {
    feature: 'labs',
    requirements: {
      // Labs page: show all, mostly optional, highlight prerequisites
      audience: 'optional',
      competitiveLandscape: 'optional',
      brand: 'optional',
      website: 'optional',
      seo: 'optional',
      media: 'optional',
      creative: 'optional',
    },
  },
};

// ============================================================================
// Quality Thresholds
// ============================================================================

/**
 * Minimum lab quality score for a domain to be considered "ready"
 * Below this, status is downgraded to "partial"
 */
export const MIN_QUALITY_SCORE_FOR_READY = 40;

/**
 * Minimum competitor count for competitive landscape to be ready
 */
export const MIN_COMPETITORS_FOR_READY = 2;

/**
 * Ideal competitor count (affects "partial" vs "ready")
 */
export const IDEAL_COMPETITORS_COUNT = 3;

// ============================================================================
// Domain Check Rules
// ============================================================================

/**
 * Check if a field has a meaningful value
 */
function hasValue(field: { value: unknown } | undefined | null): boolean {
  if (!field) return false;
  const v = field.value;
  if (v === null || v === undefined) return false;
  if (typeof v === 'string' && v.trim() === '') return false;
  if (Array.isArray(v) && v.length === 0) return false;
  return true;
}

/**
 * Get array length from a field
 */
function getArrayLength(field: { value: unknown[] | null } | undefined | null): number {
  if (!field || !Array.isArray(field.value)) return 0;
  return field.value.length;
}

/**
 * Check rules for Audience domain
 */
export function checkAudienceDomain(graph: ContextGraphSnapshot): DomainCheck[] {
  const checks: DomainCheck[] = [];
  const audience = graph.audience;

  // Check 1: primaryAudience OR icpDescription (required)
  const hasPrimaryAudience = hasValue(audience?.primaryAudience);
  const hasIcpDescription = hasValue(audience?.icpDescription);
  checks.push({
    fieldPath: 'audience.primaryAudience',
    label: 'Primary Audience or ICP Description',
    passed: hasPrimaryAudience || hasIcpDescription,
    reason: !hasPrimaryAudience && !hasIcpDescription
      ? 'Missing primary audience definition'
      : undefined,
    required: true,
  });

  // Check 2: segments (at least one)
  const segmentCount = Math.max(
    getArrayLength(audience?.segments),
    getArrayLength(audience?.primarySegments)
  );
  checks.push({
    fieldPath: 'audience.segments',
    label: 'Audience Segments',
    passed: segmentCount > 0,
    reason: segmentCount === 0 ? 'No audience segments defined' : undefined,
    required: false, // Recommended but not required
  });

  return checks;
}

/**
 * Check rules for Competitive Landscape domain
 */
export function checkCompetitiveLandscapeDomain(
  graph: ContextGraphSnapshot,
  labQualityScore: number | null
): DomainCheck[] {
  const checks: DomainCheck[] = [];
  const competitive = graph.competitive;

  // Check 1: competitors (at least MIN_COMPETITORS_FOR_READY)
  const competitorCount = Math.max(
    getArrayLength(competitive?.competitors),
    getArrayLength(competitive?.primaryCompetitors)
  );
  const hasEnoughCompetitors = competitorCount >= MIN_COMPETITORS_FOR_READY;

  // If lab quality is high enough, we're more lenient on competitor count
  const qualityBoost = labQualityScore !== null && labQualityScore >= 60;
  const passesWithQuality = hasEnoughCompetitors || (competitorCount >= 1 && qualityBoost);

  checks.push({
    fieldPath: 'competitive.primaryCompetitors',
    label: 'Primary Competitors',
    passed: passesWithQuality,
    reason: !passesWithQuality
      ? `Need at least ${MIN_COMPETITORS_FOR_READY} competitors (have ${competitorCount})`
      : undefined,
    required: true,
  });

  // Check 2: competitiveModality OR positionSummary
  const hasModality = hasValue(competitive?.competitiveModality);
  const hasPosition = hasValue(competitive?.positionSummary);
  checks.push({
    fieldPath: 'competitive.competitiveModality',
    label: 'Competitive Modality or Position Summary',
    passed: hasModality || hasPosition,
    reason: !hasModality && !hasPosition
      ? 'Missing competitive positioning context'
      : undefined,
    required: false, // Recommended
  });

  return checks;
}

/**
 * Check rules for Brand domain
 */
export function checkBrandDomain(graph: ContextGraphSnapshot): DomainCheck[] {
  const checks: DomainCheck[] = [];
  const brand = graph.brand;
  const productOffer = graph.productOffer;

  // Check 1: positioning OR valueProposition (required)
  const hasPositioning = hasValue(brand?.positioning);
  const hasValueProp = hasValue(productOffer?.valueProposition);
  checks.push({
    fieldPath: 'brand.positioning',
    label: 'Brand Positioning or Value Proposition',
    passed: hasPositioning || hasValueProp,
    reason: !hasPositioning && !hasValueProp
      ? 'Missing brand positioning or value proposition'
      : undefined,
    required: true,
  });

  // Check 2: valueProps or differentiators (recommended)
  const hasValueProps = hasValue(brand?.valueProps) && getArrayLength(brand?.valueProps) > 0;
  const hasDifferentiators = hasValue(brand?.differentiators) && getArrayLength(brand?.differentiators) > 0;
  checks.push({
    fieldPath: 'brand.valueProps',
    label: 'Value Props or Differentiators',
    passed: hasValueProps || hasDifferentiators,
    reason: !hasValueProps && !hasDifferentiators
      ? 'No value props or differentiators defined'
      : undefined,
    required: false,
  });

  return checks;
}

/**
 * Check rules for Website domain
 * NOTE: Website Lab V5 is the ONLY authoritative source
 */
export function checkWebsiteDomain(graph: ContextGraphSnapshot): DomainCheck[] {
  const checks: DomainCheck[] = [];
  const website = graph.website;

  // Check 1: websiteScore (from V5 lab output)
  const hasScore = hasValue(website?.websiteScore);
  checks.push({
    fieldPath: 'website.websiteScore',
    label: 'Website Score',
    passed: hasScore,
    reason: !hasScore ? 'No website analysis score (run Website Lab)' : undefined,
    required: true,
  });

  // Check 2: conversionBlocks
  const hasBlocks = hasValue(website?.conversionBlocks) && getArrayLength(website?.conversionBlocks) > 0;
  checks.push({
    fieldPath: 'website.conversionBlocks',
    label: 'Conversion Blockers Identified',
    passed: hasBlocks,
    reason: !hasBlocks ? 'No conversion blockers identified' : undefined,
    required: false,
  });

  // Check 3: quickWins
  const hasQuickWins = hasValue(website?.quickWins) && getArrayLength(website?.quickWins) > 0;
  checks.push({
    fieldPath: 'website.quickWins',
    label: 'Quick Wins Identified',
    passed: hasQuickWins,
    reason: !hasQuickWins ? 'No quick wins identified' : undefined,
    required: false,
  });

  return checks;
}

/**
 * Check rules for SEO domain
 */
export function checkSeoDomain(graph: ContextGraphSnapshot): DomainCheck[] {
  const checks: DomainCheck[] = [];
  const seo = graph.seo;

  // Check 1: seoScore
  const hasScore = hasValue(seo?.seoScore);
  checks.push({
    fieldPath: 'seo.seoScore',
    label: 'SEO Score',
    passed: hasScore,
    reason: !hasScore ? 'No SEO analysis score (run SEO Lab)' : undefined,
    required: true,
  });

  return checks;
}

/**
 * Check rules for Media domain
 * Currently minimal - just check if any media data exists
 */
export function checkMediaDomain(_graph: ContextGraphSnapshot): DomainCheck[] {
  // Media domain checks are currently optional and minimal
  // Future: check for connected ad accounts, campaign data, etc.
  return [];
}

/**
 * Check rules for Creative domain
 * Currently minimal - just check if any creative data exists
 */
export function checkCreativeDomain(_graph: ContextGraphSnapshot): DomainCheck[] {
  // Creative domain checks are currently optional and minimal
  // Future: check for creative briefs, asset inventory, etc.
  return [];
}

// ============================================================================
// CTA Generation
// ============================================================================

/**
 * Generate CTAs for a domain based on its status
 */
export function generateDomainCTAs(
  companyId: string,
  domain: ContextDomainKey,
  status: 'ready' | 'partial' | 'missing',
  pendingProposalsCount: number,
  labHasRun: boolean
): ReadinessCTA[] {
  const config = DOMAIN_CONFIGS[domain];
  const ctas: ReadinessCTA[] = [];

  if (status === 'missing') {
    // Primary: Run lab (if available) or Add context
    if (config.labSlug) {
      ctas.push({
        type: 'run_lab',
        label: `Run ${config.labName || config.label + ' Lab'}`,
        href: `/c/${companyId}/diagnostics/${config.labSlug}`,
        primary: true,
      });
    }
    ctas.push({
      type: 'add_context',
      label: 'Add required context',
      href: `/c/${companyId}/context?domain=${domain}`,
      primary: !config.labSlug,
    });
  } else if (status === 'partial') {
    // Primary: Review proposals (if any) or Run lab
    if (pendingProposalsCount > 0) {
      ctas.push({
        type: 'review_proposals',
        label: `Review ${pendingProposalsCount} proposal${pendingProposalsCount > 1 ? 's' : ''}`,
        href: `/c/${companyId}/context/review?domain=${domain}`,
        primary: true,
      });
    } else if (config.labSlug && !labHasRun) {
      ctas.push({
        type: 'run_lab',
        label: `Run ${config.labName || config.label + ' Lab'}`,
        href: `/c/${companyId}/diagnostics/${config.labSlug}`,
        primary: true,
      });
    } else {
      ctas.push({
        type: 'add_context',
        label: 'Add missing context',
        href: `/c/${companyId}/context?domain=${domain}`,
        primary: true,
      });
    }
  } else {
    // Ready: View context
    ctas.push({
      type: 'view_context',
      label: 'View context',
      href: `/c/${companyId}/context?domain=${domain}`,
      primary: true,
    });
  }

  return ctas;
}

// ============================================================================
// Domain-to-Lab Mapping
// ============================================================================

/**
 * Map domain key to lab slugs for run status lookup
 */
export function getDomainLabSlug(domain: ContextDomainKey): string | undefined {
  return DOMAIN_CONFIGS[domain]?.labSlug;
}

/**
 * Map lab slug to domain key
 */
export function getLabDomainKey(labSlug: string): ContextDomainKey | undefined {
  for (const [domain, config] of Object.entries(DOMAIN_CONFIGS)) {
    if (config.labSlug === labSlug) {
      return domain as ContextDomainKey;
    }
  }
  return undefined;
}

/**
 * Get requirement level for a domain in a feature context
 * Handles dynamic adjustment for proposals (domains with pending proposals become required)
 */
export function getRequirementLevel(
  feature: RequiredForFeature,
  domain: ContextDomainKey,
  pendingProposalsCount: number
): RequirementLevel {
  const baseRequirement = FEATURE_REQUIREMENTS[feature].requirements[domain];

  // For proposals page: if domain has pending proposals, it's "required" to review
  if (feature === 'proposals' && pendingProposalsCount > 0) {
    return 'required';
  }

  return baseRequirement;
}
