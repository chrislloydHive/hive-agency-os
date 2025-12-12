// lib/competition-v3/b2cRetailClassifier.ts
// B2C Retail Competitor Classification & Filtering
//
// Provides B2C-specific competitor classification logic:
// - Determines if a company is B2C retail
// - Filters out B2B-only competitor types for B2C companies
// - Classifies platforms (Amazon, Walmart, etc.) correctly
// - Prevents context-bleed from B2B company data

import type { QueryContext, CompetitorType, EnrichedCandidate, ClassificationResult, CompetitorProfileV3 } from './types';

// ============================================================================
// B2C Classification Rules
// ============================================================================

/**
 * Competitor types allowed for B2C retail companies
 * Fractional and internal alternatives are B2B concepts
 */
export const B2C_ALLOWED_COMPETITOR_TYPES: CompetitorType[] = [
  'direct',    // Same product/service offering
  'partial',   // Category neighbor
  'platform',  // E-commerce platforms (Amazon, eBay, etc.)
];

/**
 * Competitor types that should NEVER appear for B2C retail
 */
export const B2C_DISALLOWED_COMPETITOR_TYPES: CompetitorType[] = [
  'fractional', // B2B concept - fractional CMO/executive
  'internal',   // B2B concept - internal hire alternative
  'irrelevant', // Always filtered out
];

/**
 * Industries/categories that indicate B2C retail
 */
export const B2C_RETAIL_INDICATORS = [
  'retail',
  'consumer',
  'automotive aftermarket',
  'car electronics',
  'car audio',
  'skateboard',
  'skate shop',
  'sporting goods',
  'apparel',
  'clothing',
  'shoes',
  'electronics retail',
  'home improvement',
  'pet supplies',
  'grocery',
  'convenience',
  'furniture',
  'jewelry',
  'beauty',
  'cosmetics',
  'toy store',
  'hobby shop',
  'music store',
  'bike shop',
  'outdoor gear',
  'camping',
  'fishing',
  'hunting',
];

/**
 * Industries/categories that indicate marketplace
 */
export const MARKETPLACE_INDICATORS = [
  'marketplace',
  'platform',
  'two-sided',
  'multi-sided',
  'booking',
  'connect',
  'trainer',
  'fitness marketplace',
  'service marketplace',
  'gig economy',
  'on-demand',
];

/**
 * Keywords that indicate B2B service/agency (NOT B2C retail)
 */
export const B2B_SERVICE_INDICATORS = [
  'agency',
  'consulting',
  'consultancy',
  'services provider',
  'marketing agency',
  'digital agency',
  'web agency',
  'seo agency',
  'ppc agency',
  'fractional',
  'outsourced',
  'managed services',
  'b2b',
  'enterprise solution',
  'saas',
  'software as a service',
  'in-house',
  'in house',
  'cmo',
  'chief marketing',
  'growth consulting',
];

/**
 * Known e-commerce platform domains - classify as 'platform' not 'direct'
 */
export const ECOMMERCE_PLATFORM_DOMAINS = new Set([
  'amazon.com',
  'ebay.com',
  'walmart.com',
  'target.com',
  'bestbuy.com',
  'newegg.com',
  'wayfair.com',
  'overstock.com',
  'etsy.com',
  'aliexpress.com',
  'wish.com',
  'rakuten.com',
  'jet.com',
  'costco.com',
  'samsclub.com',
  'homedepot.com',
  'lowes.com',
  'menards.com',
]);

/**
 * Platform domains for the retail/automotive sector specifically
 */
export const AUTOMOTIVE_PLATFORM_DOMAINS = new Set([
  'amazon.com',
  'ebay.com',
  'walmart.com',
  'crutchfield.com', // Can be considered platform for car audio
]);

// ============================================================================
// Detection Functions
// ============================================================================

/**
 * Determine if a company is a marketplace/platform based on its context
 */
export function isMarketplaceCompany(context: QueryContext): boolean {
  // Explicit marketplace vertical
  if (context.verticalCategory === 'marketplace') return true;

  // Explicit marketplace archetype
  if (context.archetype === 'two_sided_marketplace') return true;

  // Check industry for marketplace indicators
  const industryLower = context.industry?.toLowerCase() || '';
  if (MARKETPLACE_INDICATORS.some(indicator => industryLower.includes(indicator))) {
    return true;
  }

  // Check business model for marketplace indicators
  const businessModelLower = context.businessModel?.toLowerCase() || '';
  if (businessModelLower.includes('marketplace') ||
      businessModelLower.includes('platform') ||
      businessModelLower.includes('two-sided') ||
      businessModelLower.includes('connect')) {
    return true;
  }

  // Check for domain patterns that indicate marketplace
  const domain = context.domain?.toLowerCase() || '';
  const marketplaceDomainPatterns = ['hub', 'connect', 'find', 'book', 'hire', 'match'];
  if (marketplaceDomainPatterns.some(pattern => domain.includes(pattern))) {
    return true;
  }

  return false;
}

/**
 * Determine if a company is B2C based on its context
 */
export function isB2CCompany(context: QueryContext): boolean {
  // Marketplace companies should NOT be treated as B2C retail
  // They have different competitor dynamics
  if (isMarketplaceCompany(context)) {
    return false;
  }

  // Explicit B2C category
  if (context.businessModelCategory === 'B2C') return true;

  // Check industry for B2C indicators
  const industryLower = context.industry?.toLowerCase() || '';
  if (B2C_RETAIL_INDICATORS.some(indicator => industryLower.includes(indicator))) {
    return true;
  }

  // Check business model for retail indicators
  const businessModelLower = context.businessModel?.toLowerCase() || '';
  if (businessModelLower.includes('retail') || businessModelLower.includes('consumer')) {
    return true;
  }

  // Check ICP for consumer language
  const icpLower = context.icpDescription?.toLowerCase() || '';
  const consumerTerms = ['consumer', 'shopper', 'customer', 'driver', 'household', 'individual', 'visitor'];
  if (consumerTerms.some(term => icpLower.includes(term))) {
    return true;
  }

  return false;
}

/**
 * Determine if a company is a retail/installation service
 * (e.g., Car Toys - sells products AND provides installation)
 */
export function isRetailServiceCompany(context: QueryContext): boolean {
  const industryLower = context.industry?.toLowerCase() || '';
  const businessModelLower = context.businessModel?.toLowerCase() || '';
  const offersLower = context.primaryOffers.join(' ').toLowerCase();

  // Check for installation/service indicators
  const serviceIndicators = ['installation', 'install', 'service', 'repair', 'maintenance'];
  const hasService = serviceIndicators.some(term =>
    industryLower.includes(term) || businessModelLower.includes(term) || offersLower.includes(term)
  );

  // Check for retail/product indicators
  const retailIndicators = ['retail', 'store', 'shop', 'sell'];
  const hasRetail = retailIndicators.some(term =>
    industryLower.includes(term) || businessModelLower.includes(term)
  );

  return hasService && hasRetail;
}

/**
 * Check if a competitor is an e-commerce platform
 */
export function isEcommercePlatform(domain: string | null): boolean {
  if (!domain) return false;
  let normalized = domain.toLowerCase().trim();
  // Remove protocol
  normalized = normalized.replace(/^https?:\/\//, '');
  // Remove www
  normalized = normalized.replace(/^www\./, '');
  // Remove trailing slash and path
  normalized = normalized.split('/')[0];
  return ECOMMERCE_PLATFORM_DOMAINS.has(normalized);
}

/**
 * Check if competitor text contains B2B service indicators
 */
export function hasB2BServiceIndicators(text: string): boolean {
  const lowerText = text.toLowerCase();
  return B2B_SERVICE_INDICATORS.some(indicator => lowerText.includes(indicator));
}

// ============================================================================
// Competitor Type Validation
// ============================================================================

/**
 * Check if a competitor type is allowed for a given company context
 */
export function isCompetitorTypeAllowed(
  type: CompetitorType,
  context: QueryContext
): boolean {
  if (!isB2CCompany(context)) {
    // B2B companies can have all types
    return true;
  }

  // B2C companies only get allowed types
  return B2C_ALLOWED_COMPETITOR_TYPES.includes(type);
}

/**
 * Get the allowed competitor types for a context
 */
export function getAllowedCompetitorTypes(context: QueryContext): CompetitorType[] {
  if (isB2CCompany(context)) {
    return B2C_ALLOWED_COMPETITOR_TYPES;
  }
  // B2B gets all types except irrelevant
  return ['direct', 'partial', 'fractional', 'internal', 'platform'];
}

/**
 * Sanitize a competitor type for B2C context
 * Converts disallowed types to partial or irrelevant
 */
export function sanitizeCompetitorTypeForB2C(
  type: CompetitorType,
  context: QueryContext
): CompetitorType {
  if (!isB2CCompany(context)) return type;

  if (B2C_DISALLOWED_COMPETITOR_TYPES.includes(type)) {
    // Convert fractional/internal to irrelevant for B2C
    return 'irrelevant';
  }

  return type;
}

// ============================================================================
// B2C Competitor Filtering
// ============================================================================

/**
 * Filter out competitors that shouldn't appear for B2C companies
 */
export function filterCompetitorsForB2C<T extends { classification?: { type: CompetitorType } }>(
  competitors: T[],
  context: QueryContext
): T[] {
  if (!isB2CCompany(context)) return competitors;

  return competitors.filter(c => {
    const type = c.classification?.type;
    if (!type) return true;
    return B2C_ALLOWED_COMPETITOR_TYPES.includes(type);
  });
}

/**
 * Check if a candidate should be filtered out for B2C contexts
 * based on text content (agency/consulting keywords)
 */
export function shouldFilterB2BCandidate(
  candidate: EnrichedCandidate,
  context: QueryContext
): boolean {
  if (!isB2CCompany(context)) return false;

  // Build text from all available content
  const textParts = [
    candidate.name,
    candidate.domain,
    candidate.snippet,
    candidate.aiSummary,
    candidate.crawledContent?.homepage?.description,
    candidate.crawledContent?.services?.offerings?.join(' '),
  ];
  const text = textParts.filter(Boolean).join(' ').toLowerCase();

  // Check for agency/consulting indicators
  return hasB2BServiceIndicators(text);
}

/**
 * Check if a candidate should be filtered out for marketplace contexts
 * Marketplaces compete with other marketplaces, not agencies
 */
export function shouldFilterForMarketplace(
  candidate: EnrichedCandidate,
  context: QueryContext
): boolean {
  if (!isMarketplaceCompany(context)) return false;

  // Build text from all available content
  const textParts = [
    candidate.name,
    candidate.domain,
    candidate.snippet,
    candidate.aiSummary,
    candidate.crawledContent?.homepage?.description,
    candidate.crawledContent?.services?.offerings?.join(' '),
  ];
  const text = textParts.filter(Boolean).join(' ').toLowerCase();

  // Agency indicators - filter these out for marketplaces
  const agencyIndicators = [
    'marketing agency',
    'digital agency',
    'seo agency',
    'ppc agency',
    'growth agency',
    'advertising agency',
    'creative agency',
    'branding agency',
    'web agency',
    'design agency',
    'media agency',
    'consulting firm',
    'consultancy',
    'fractional cmo',
    'fractional marketing',
    // Additional patterns for companies that provide marketing/advertising services
    'disruptive advertising',
    'paid media',
    'lead generation agency',
    'performance marketing',
    'social media marketing',
    'content marketing',
    'email marketing',
    'digital marketing',
    'marketing services',
    'advertising services',
  ];

  // If candidate is clearly an agency, filter it out
  if (agencyIndicators.some(indicator => text.includes(indicator))) {
    return true;
  }

  // Check the domain for agency patterns
  const domain = candidate.domain?.toLowerCase() || '';
  const agencyDomainPatterns = [
    'agency',
    'consulting',
    'consultants',
    'advisors',
    'advertising',  // disruptiveadvertising.com, etc.
    'marketing',    // lyfemarketing.com, etc.
    'growthlab',
    'cleverly',
    'mediabuying',
  ];
  if (agencyDomainPatterns.some(pattern => domain.includes(pattern))) {
    return true;
  }

  return false;
}

// ============================================================================
// B2C Classification Logic
// ============================================================================

/**
 * Pre-classify a candidate for B2C retail context
 * Returns null if AI classification is needed
 */
export function preClassifyForB2C(
  candidate: EnrichedCandidate,
  context: QueryContext
): { type: CompetitorType; confidence: number; reasoning: string } | null {
  if (!isB2CCompany(context)) return null;

  const domain = candidate.domain?.toLowerCase().replace(/^www\./, '') || '';
  const text = [
    candidate.name,
    candidate.snippet,
    candidate.aiSummary,
  ].filter(Boolean).join(' ').toLowerCase();

  // E-commerce platforms are always 'platform' type
  if (isEcommercePlatform(candidate.domain)) {
    return {
      type: 'platform',
      confidence: 0.95,
      reasoning: 'Major e-commerce platform - classified as platform alternative',
    };
  }

  // Filter out agency/consulting for B2C
  if (hasB2BServiceIndicators(text)) {
    return {
      type: 'irrelevant',
      confidence: 0.9,
      reasoning: 'B2B service provider - not relevant for B2C retail',
    };
  }

  // Check for retail service company (installation)
  const hasInstallation = /install|installer|installation/.test(text);
  if (isRetailServiceCompany(context) && hasInstallation) {
    // This is likely a direct competitor for retail service companies
    return {
      type: 'direct',
      confidence: 0.75,
      reasoning: 'Retail service company with installation services - potential direct competitor',
    };
  }

  return null; // Let AI classify
}

/**
 * Re-classify competitors after AI classification to enforce B2C rules
 * This is a post-processing step to ensure no B2B types leak through
 */
export function enforceB2CClassification<T extends { classification: ClassificationResult }>(
  classified: T[],
  context: QueryContext
): T[] {
  if (!isB2CCompany(context)) return classified;

  return classified.map(c => {
    const originalType = c.classification.type;

    // Convert disallowed types
    if (B2C_DISALLOWED_COMPETITOR_TYPES.includes(originalType)) {
      return {
        ...c,
        classification: {
          ...c.classification,
          type: 'irrelevant' as CompetitorType,
          reasoning: `${c.classification.reasoning} [Converted from ${originalType} - not applicable for B2C retail]`,
        },
      };
    }

    return c;
  });
}

// ============================================================================
// Positioning Map Axes for B2C
// ============================================================================

/**
 * B2C retail positioning axes
 */
export interface B2CPositioningAxes {
  xAxis: {
    label: string;
    lowLabel: string;
    highLabel: string;
    description: string;
  };
  yAxis: {
    label: string;
    lowLabel: string;
    highLabel: string;
    description: string;
  };
}

/**
 * Get positioning axes appropriate for B2C retail
 */
export function getB2CPositioningAxes(): B2CPositioningAxes {
  return {
    xAxis: {
      label: 'Product/Value Overlap',
      lowLabel: 'Different Products',
      highLabel: 'Same Products',
      description: 'Brand alignment and product assortment overlap',
    },
    yAxis: {
      label: 'Customer Fit',
      lowLabel: 'Different Customers',
      highLabel: 'Same Customers',
      description: 'Do they serve the same shoppers/customers?',
    },
  };
}

/**
 * Get positioning axes appropriate for B2B
 */
export function getB2BPositioningAxes() {
  return {
    xAxis: {
      label: 'Value Model Alignment',
      lowLabel: 'Different Value Model',
      highLabel: 'Same Value Model',
      description: 'Similarity in how value is delivered',
    },
    yAxis: {
      label: 'ICP Alignment',
      lowLabel: 'Different ICP',
      highLabel: 'Same ICP',
      description: 'Target the same ideal customer profile',
    },
  };
}

/**
 * Get appropriate positioning axes based on company context
 */
export function getPositioningAxes(context: QueryContext) {
  return isB2CCompany(context) ? getB2CPositioningAxes() : getB2BPositioningAxes();
}

// ============================================================================
// Selection Quotas for B2C
// ============================================================================

/**
 * Get selection quotas appropriate for B2C retail
 * (No fractional/internal slots)
 */
export function getB2CSelectionQuotas() {
  return {
    direct: { min: 4, max: 8 },    // More direct competitors for retail
    partial: { min: 3, max: 6 },   // Category neighbors
    fractional: { min: 0, max: 0 }, // Not applicable for B2C
    platform: { min: 2, max: 5 },  // E-commerce platforms
    internal: { min: 0, max: 0 },  // Not applicable for B2C
    total: 18,
  };
}

/**
 * Get selection quotas for B2B companies
 */
export function getB2BSelectionQuotas() {
  return {
    direct: { min: 3, max: 6 },
    partial: { min: 3, max: 6 },
    fractional: { min: 2, max: 4 },
    platform: { min: 1, max: 4 },
    internal: { min: 1, max: 3 },
    total: 18,
  };
}

/**
 * Get appropriate selection quotas based on context
 */
export function getSelectionQuotas(context: QueryContext) {
  return isB2CCompany(context) ? getB2CSelectionQuotas() : getB2BSelectionQuotas();
}

// ============================================================================
// Breakdown Counts for B2C
// ============================================================================

/**
 * Get competitor type breakdown filtered for B2C
 */
export function getB2CBreakdown(competitors: Array<{ classification: { type: CompetitorType } }>) {
  const breakdown = {
    direct: 0,
    partial: 0,
    platform: 0,
    total: 0,
  };

  for (const c of competitors) {
    const type = c.classification.type;
    if (type === 'direct') breakdown.direct++;
    else if (type === 'partial') breakdown.partial++;
    else if (type === 'platform') breakdown.platform++;
  }

  breakdown.total = breakdown.direct + breakdown.partial + breakdown.platform;
  return breakdown;
}

/**
 * Get competitor type breakdown for any context
 */
export function getBreakdown(
  competitors: Array<{ classification: { type: CompetitorType } }>,
  context: QueryContext
) {
  if (isB2CCompany(context)) {
    return getB2CBreakdown(competitors);
  }

  // B2B breakdown includes all types
  const breakdown = {
    direct: 0,
    partial: 0,
    fractional: 0,
    platform: 0,
    internal: 0,
    total: 0,
  };

  for (const c of competitors) {
    const type = c.classification.type;
    if (type in breakdown) {
      (breakdown as Record<string, number>)[type]++;
    }
  }

  breakdown.total = breakdown.direct + breakdown.partial + breakdown.fractional + breakdown.platform + breakdown.internal;
  return breakdown;
}

// ============================================================================
// Data Cleanup Helpers
// ============================================================================

/**
 * Clean existing competitor data for B2C context
 * Removes/converts invalid competitor types
 */
export function cleanB2CCompetitorData<T extends { classification?: { type: CompetitorType } }>(
  competitors: T[],
  context: QueryContext
): { cleaned: T[]; removed: T[] } {
  if (!isB2CCompany(context)) {
    return { cleaned: competitors, removed: [] };
  }

  const cleaned: T[] = [];
  const removed: T[] = [];

  for (const c of competitors) {
    const type = c.classification?.type;
    if (!type) {
      cleaned.push(c);
      continue;
    }

    if (B2C_ALLOWED_COMPETITOR_TYPES.includes(type)) {
      cleaned.push(c);
    } else {
      removed.push(c);
    }
  }

  return { cleaned, removed };
}

/**
 * Validate that a company's competitive data doesn't have context bleed
 */
export function validateNoContextBleed(
  companyContext: QueryContext,
  competitors: Array<{ classification: { type: CompetitorType }; name: string }>
): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (isB2CCompany(companyContext)) {
    // Check for B2B-only competitor types
    for (const c of competitors) {
      if (c.classification.type === 'fractional') {
        issues.push(`B2C company has fractional competitor: ${c.name}`);
      }
      if (c.classification.type === 'internal') {
        issues.push(`B2C company has internal hire alternative: ${c.name}`);
      }
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}
