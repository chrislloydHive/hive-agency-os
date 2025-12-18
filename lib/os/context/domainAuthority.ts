// lib/os/context/domainAuthority.ts
// Domain Authority Declarations - ONE WRITER PER DOMAIN
//
// RULE: Each context domain has a single canonical authority.
// Only allowed sources may write to that domain.
// This prevents competing writers and ensures data consistency.

import type { LabKey } from '@/lib/diagnostics/contracts/labOutput';

// ============================================================================
// Domain Keys
// ============================================================================

export type DomainKey =
  | 'identity'
  | 'objectives'
  | 'brand'
  | 'audience'
  | 'productOffer'
  | 'website'
  | 'seo'
  | 'content'
  | 'digitalInfra'
  | 'ops'
  | 'performanceMedia'
  | 'competitive'
  | 'budgetOps'
  | 'operationalConstraints'
  | 'capabilities';

// ============================================================================
// Source Types
// ============================================================================

export type WriteSource = LabKey | 'user' | 'import' | 'migration';

// ============================================================================
// Domain Authority Configuration
// ============================================================================

export interface DomainAuthorityConfig {
  // Sources allowed to write to this domain
  sourcesAllowed: WriteSource[];
  // The canonical source for this domain (single source of truth)
  canonicalSource: WriteSource;
  // Description of what this domain contains
  description: string;
  // Whether user can always override (default true)
  userCanOverride?: boolean;
}

// ============================================================================
// Domain Authority Map
// ============================================================================

export const DOMAIN_AUTHORITY: Record<DomainKey, DomainAuthorityConfig> = {
  // Identity - company basics (GAP Full until Identity Lab exists)
  identity: {
    sourcesAllowed: ['gap_full', 'gap_ia', 'user', 'import'],
    canonicalSource: 'user',
    description: 'Company identity, mission, vision, core values',
    userCanOverride: true,
  },

  // Objectives - business goals and KPIs (orchestration domain)
  objectives: {
    sourcesAllowed: ['gap_full', 'gap_ia', 'user', 'import'],
    canonicalSource: 'user',
    description: 'Business objectives, goals, KPIs, success metrics',
    userCanOverride: true,
  },

  // Brand - brand attributes and positioning
  brand: {
    sourcesAllowed: ['brand_lab', 'user', 'import'],
    canonicalSource: 'brand_lab',
    description: 'Brand identity, voice, positioning, visual identity',
    userCanOverride: true,
  },

  // Audience - target audience and personas
  audience: {
    sourcesAllowed: ['audience_lab', 'brand_lab', 'user', 'import'],
    canonicalSource: 'audience_lab',
    description: 'Target audience, buyer personas, demographics',
    userCanOverride: true,
  },

  // Product/Offer - what the company sells
  productOffer: {
    sourcesAllowed: ['brand_lab', 'website_lab', 'user', 'import'],
    canonicalSource: 'brand_lab',
    description: 'Products, services, value proposition',
    userCanOverride: true,
  },

  // Website - website assessment and UX
  website: {
    sourcesAllowed: ['website_lab', 'user', 'import'],
    canonicalSource: 'website_lab',
    description: 'Website health, UX, conversion paths',
    userCanOverride: true,
  },

  // SEO - search engine optimization
  seo: {
    sourcesAllowed: ['seo_lab', 'user', 'import'],
    canonicalSource: 'seo_lab',
    description: 'SEO health, keywords, technical SEO',
    userCanOverride: true,
  },

  // Content - content strategy and assets
  content: {
    sourcesAllowed: ['content_lab', 'user', 'import'],
    canonicalSource: 'content_lab',
    description: 'Content pillars, gaps, performance',
    userCanOverride: true,
  },

  // Digital Infrastructure - tracking, tech stack
  digitalInfra: {
    sourcesAllowed: ['website_lab', 'user', 'import'],
    canonicalSource: 'website_lab',
    description: 'Tracking stack, martech, integrations',
    userCanOverride: true,
  },

  // Ops - team and operations
  ops: {
    sourcesAllowed: ['ops_lab', 'user', 'import'],
    canonicalSource: 'ops_lab',
    description: 'Team structure, processes, tools',
    userCanOverride: true,
  },

  // Performance Media - paid media
  performanceMedia: {
    sourcesAllowed: ['media_lab', 'demand_lab', 'user', 'import'],
    canonicalSource: 'media_lab',
    description: 'Paid media channels, spend, performance',
    userCanOverride: true,
  },

  // Competitive - competitive landscape
  competitive: {
    sourcesAllowed: ['competition_lab', 'user', 'import'],
    canonicalSource: 'competition_lab',
    description: 'Competitors, market position, differentiators',
    userCanOverride: true,
  },

  // Budget/Ops - budget constraints (user-first)
  budgetOps: {
    sourcesAllowed: ['user', 'gap_full', 'import'],
    canonicalSource: 'user',
    description: 'Budget constraints, resource allocation',
    userCanOverride: true,
  },

  // Operational Constraints - business constraints (user-first)
  operationalConstraints: {
    sourcesAllowed: ['user', 'ops_lab', 'gap_full', 'import'],
    canonicalSource: 'user',
    description: 'Business constraints, limitations, dependencies',
    userCanOverride: true,
  },

  // Capabilities - what the company can do
  capabilities: {
    sourcesAllowed: ['ops_lab', 'user', 'import'],
    canonicalSource: 'ops_lab',
    description: 'Team capabilities, skills, capacity',
    userCanOverride: true,
  },
};

// ============================================================================
// Field to Domain Mapping
// ============================================================================

// Maps context field paths to their domain
export const FIELD_TO_DOMAIN: Record<string, DomainKey> = {
  // Identity fields
  'identity.companyName': 'identity',
  'identity.businessName': 'identity',
  'identity.mission': 'identity',
  'identity.vision': 'identity',
  'identity.coreValues': 'identity',
  'identity.industry': 'identity',
  'identity.companyStage': 'identity',
  'identity.domain': 'identity',
  'identity.geographicFootprint': 'identity',

  // Objectives fields
  'objectives.primaryBusinessGoal': 'objectives',
  'objectives.kpiLabels': 'objectives',
  'objectives.targetMetrics': 'objectives',
  'objectives.successCriteria': 'objectives',
  'objectives.strategicPriorities': 'objectives',

  // Brand fields
  'brand.brandIdentity': 'brand',
  'brand.brandVoice': 'brand',
  'brand.brandTone': 'brand',
  'brand.brandPersonality': 'brand',
  'brand.visualIdentity': 'brand',
  'brand.brandScore': 'brand',
  'brand.brandSummary': 'brand',
  'brand.brandGaps': 'brand',
  'brand.brandStrengths': 'brand',

  // Audience fields
  'audience.primaryAudience': 'audience',
  'audience.secondaryAudiences': 'audience',
  'audience.buyerPersonas': 'audience',
  'audience.audienceScore': 'audience',
  'audience.audienceSummary': 'audience',
  'audience.audienceInsights': 'audience',

  // Product/Offer fields
  'productOffer.products': 'productOffer',
  'productOffer.services': 'productOffer',
  'productOffer.valueProposition': 'productOffer',
  'productOffer.pricingModel': 'productOffer',

  // Website fields
  'website.websiteUrl': 'website',
  'website.websiteScore': 'website',
  'website.websiteSummary': 'website',
  'website.criticalIssues': 'website',
  'website.quickWins': 'website',
  'website.uxAssessment': 'website',
  'website.conversionPaths': 'website',
  'website.technicalHealth': 'website',

  // SEO fields
  'seo.seoScore': 'seo',
  'seo.seoSummary': 'seo',
  'seo.technicalIssues': 'seo',
  'seo.keywordOpportunities': 'seo',
  'seo.onPageAssessment': 'seo',
  'seo.contentGaps': 'seo',
  'seo.backlinks': 'seo',
  'seo.localSeo': 'seo',

  // Content fields
  'content.contentScore': 'content',
  'content.contentSummary': 'content',
  'content.contentPillars': 'content',
  'content.contentGaps': 'content',
  'content.contentStrengths': 'content',
  'content.contentCalendar': 'content',
  'content.topPerformingContent': 'content',

  // Digital Infra fields
  'digitalInfra.trackingStack': 'digitalInfra',
  'digitalInfra.martech': 'digitalInfra',
  'digitalInfra.integrations': 'digitalInfra',
  'digitalInfra.trackingStackSummary': 'digitalInfra',

  // Ops fields
  'ops.teamStructure': 'ops',
  'ops.processMaturity': 'ops',
  'ops.toolStack': 'ops',
  'ops.opsScore': 'ops',
  'ops.opsSummary': 'ops',
  'ops.teamSummary': 'ops',
  'ops.capacityAssessment': 'ops',

  // Performance Media fields
  'performanceMedia.channelMix': 'performanceMedia',
  'performanceMedia.mediaScore': 'performanceMedia',
  'performanceMedia.mediaSummary': 'performanceMedia',
  'performanceMedia.mediaEfficiency': 'performanceMedia',

  // Competitive fields
  'competitive.competitors': 'competitive',
  'competitive.competitiveScore': 'competitive',
  'competitive.competitiveSummary': 'competitive',
  'competitive.competitiveLandscape': 'competitive',
  'competitive.differentiators': 'competitive',
  'competitive.threats': 'competitive',
  'competitive.opportunities': 'competitive',

  // Budget fields
  'budgetOps.monthlyBudget': 'budgetOps',
  'budgetOps.budgetConstraints': 'budgetOps',
  'budgetOps.resourceAllocation': 'budgetOps',

  // Operational Constraints fields
  'operationalConstraints.constraints': 'operationalConstraints',
  'operationalConstraints.limitations': 'operationalConstraints',
  'operationalConstraints.dependencies': 'operationalConstraints',

  // Capabilities fields
  'capabilities.skills': 'capabilities',
  'capabilities.capacity': 'capabilities',
  'capabilities.gaps': 'capabilities',
};

// ============================================================================
// Authority Check Functions
// ============================================================================

/**
 * Get the domain for a field path
 */
export function getDomainForField(fieldPath: string): DomainKey | null {
  // Check exact match first
  if (FIELD_TO_DOMAIN[fieldPath]) {
    return FIELD_TO_DOMAIN[fieldPath];
  }

  // Check prefix match (e.g., "brand.anything" -> brand)
  const prefix = fieldPath.split('.')[0];
  const domainKeys = Object.keys(DOMAIN_AUTHORITY) as DomainKey[];
  if (domainKeys.includes(prefix as DomainKey)) {
    return prefix as DomainKey;
  }

  return null;
}

/**
 * Check if a source is allowed to write to a domain
 */
export function isSourceAllowedForDomain(
  source: WriteSource,
  domain: DomainKey
): boolean {
  const authority = DOMAIN_AUTHORITY[domain];
  if (!authority) return false;

  // User can always write if userCanOverride is true (default)
  if (source === 'user' && authority.userCanOverride !== false) {
    return true;
  }

  return authority.sourcesAllowed.includes(source);
}

/**
 * Check if a source is the canonical authority for a domain
 */
export function isCanonicalSourceForDomain(
  source: WriteSource,
  domain: DomainKey
): boolean {
  const authority = DOMAIN_AUTHORITY[domain];
  if (!authority) return false;
  return authority.canonicalSource === source;
}

/**
 * Get the canonical source for a domain
 */
export function getCanonicalSourceForDomain(domain: DomainKey): WriteSource {
  const authority = DOMAIN_AUTHORITY[domain];
  return authority?.canonicalSource || 'user';
}

/**
 * Validate a write operation
 */
export interface WriteValidationResult {
  allowed: boolean;
  reason?: string;
  isCanonical: boolean;
  domain: DomainKey | null;
}

export function validateWrite(
  fieldPath: string,
  source: WriteSource
): WriteValidationResult {
  const domain = getDomainForField(fieldPath);

  if (!domain) {
    // Unknown domain - allow but flag
    return {
      allowed: true,
      reason: 'Unknown domain - no authority defined',
      isCanonical: false,
      domain: null,
    };
  }

  const allowed = isSourceAllowedForDomain(source, domain);
  const isCanonical = isCanonicalSourceForDomain(source, domain);

  if (!allowed) {
    return {
      allowed: false,
      reason: `Source '${source}' is not authorized to write to domain '${domain}'. Allowed sources: ${DOMAIN_AUTHORITY[domain].sourcesAllowed.join(', ')}`,
      isCanonical: false,
      domain,
    };
  }

  return {
    allowed: true,
    isCanonical,
    domain,
  };
}

// ============================================================================
// Lab to Domain Mapping
// ============================================================================

// Which domains each lab can write to
export const LAB_DOMAINS: Record<LabKey, DomainKey[]> = {
  brand_lab: ['brand', 'audience', 'productOffer'],
  website_lab: ['website', 'digitalInfra'],
  seo_lab: ['seo'],
  content_lab: ['content'],
  demand_lab: ['performanceMedia'],
  ops_lab: ['ops', 'capabilities', 'operationalConstraints'],
  audience_lab: ['audience'],
  media_lab: ['performanceMedia'],
  competition_lab: ['competitive'],
  gap_ia: [], // GAP does not write to canonical domains
  gap_full: ['identity'], // Only identity until Identity Lab exists
  gap_heavy: [], // GAP does not write to canonical domains
};

/**
 * Get domains a lab is authorized to write to
 */
export function getLabDomains(labKey: LabKey): DomainKey[] {
  return LAB_DOMAINS[labKey] || [];
}

/**
 * Check if a lab can write to a domain
 */
export function canLabWriteToDomain(labKey: LabKey, domain: DomainKey): boolean {
  const labDomains = LAB_DOMAINS[labKey] || [];
  return labDomains.includes(domain);
}
