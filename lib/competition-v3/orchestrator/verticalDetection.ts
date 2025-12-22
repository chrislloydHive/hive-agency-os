// lib/competition-v3/orchestrator/verticalDetection.ts
// Competition Lab V3.6 - Vertical Detection Engine
//
// Detects business vertical using multiple signals:
// - Domain patterns
// - Industry keywords
// - Business model indicators
// - ICP description analysis
// - Primary offers analysis
//
// Returns detailed vertical classification with confidence scores.

import type { QueryContext, VerticalCategory, VerticalDetectionResult } from '../types';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Safely convert a value to a joinable string
 * Handles arrays, strings, and nullish values
 */
function toJoinableString(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join(' ');
  }
  if (typeof value === 'string') {
    return value;
  }
  return '';
}

// ============================================================================
// Vertical Categories
// ============================================================================

/**
 * B2C Retail vertical indicators
 * Physical retail stores, local shops, location-based businesses
 */
const B2C_RETAIL_SIGNALS = {
  domainPatterns: [
    'store', 'shop', 'retail', 'boutique', 'mall', 'outlet',
    'market', 'emporium', 'depot', 'warehouse', 'superstore',
  ],
  industryKeywords: [
    'retail', 'consumer', 'store', 'shop', 'ecommerce', 'e-commerce',
    'brick and mortar', 'brick-and-mortar', 'storefront', 'local',
    'sporting goods', 'apparel', 'clothing', 'shoes', 'footwear',
    'jewelry', 'furniture', 'home goods', 'pet supplies', 'toy',
    'hobby', 'craft', 'music store', 'book store', 'gift shop',
    'skateboard', 'skate shop', 'surf shop', 'outdoor gear',
    'camping', 'fishing', 'hunting', 'bike shop', 'cycling',
    'beauty supply', 'cosmetics', 'health food', 'grocery',
    'convenience store', 'liquor store', 'wine shop',
  ],
  businessModelKeywords: [
    'retail', 'store', 'shop', 'b2c', 'consumer', 'direct to consumer',
    'ecommerce', 'e-commerce', 'physical location', 'in-store',
    'showroom', 'walk-in', 'appointment', 'customer service',
  ],
  offerKeywords: [
    'products', 'merchandise', 'goods', 'items', 'brands',
    'sale', 'discount', 'clearance', 'selection', 'inventory',
    'in-stock', 'delivery', 'pickup', 'curbside',
  ],
};

/**
 * Automotive vertical indicators
 * Car audio, auto parts, service centers, dealerships
 */
const AUTOMOTIVE_SIGNALS = {
  domainPatterns: [
    'car', 'auto', 'automotive', 'vehicle', 'motor', 'tire', 'wheel',
    'audio', 'stereo', 'tint', 'wrap', 'detail', 'body',
  ],
  industryKeywords: [
    'automotive', 'car audio', 'car electronics', 'auto parts',
    'mobile electronics', 'car stereo', 'car accessories',
    'window tint', 'auto detailing', 'car wrap', 'vehicle wrap',
    'remote start', 'dash cam', 'backup camera', 'auto body',
    'tire shop', 'wheel shop', 'brake shop', 'muffler shop',
    'oil change', 'auto repair', 'service center',
    'aftermarket', 'performance parts', 'car customization',
  ],
  businessModelKeywords: [
    'installation', 'service center', 'shop', 'retail',
    'aftermarket', 'customization', 'modification',
    'mobile installation', 'professional installation',
  ],
  offerKeywords: [
    'installation', 'install', 'car audio', 'car stereo',
    'remote start', 'window tint', 'ceramic tint', 'dash cam',
    'speakers', 'subwoofer', 'amplifier', 'head unit',
    'alarm', 'tracking', 'accessories', 'parts',
  ],
};

/**
 * B2B SaaS/Software vertical indicators
 */
const B2B_SOFTWARE_SIGNALS = {
  domainPatterns: [
    'app', 'cloud', 'io', 'ai', 'hub', 'stack', 'flow', 'fy', 'ly',
    'platform', 'software', 'tech', 'digital',
  ],
  industryKeywords: [
    'software', 'saas', 'platform', 'technology', 'tech',
    'cloud', 'api', 'dashboard', 'automation', 'analytics',
    'crm', 'erp', 'marketing automation', 'sales enablement',
    'project management', 'collaboration', 'productivity',
    'fintech', 'healthtech', 'martech', 'adtech', 'hrtech',
  ],
  businessModelKeywords: [
    'saas', 'software', 'platform', 'subscription', 'cloud',
    'api', 'b2b', 'enterprise', 'self-serve', 'freemium',
    'monthly', 'annual', 'per seat', 'per user',
  ],
  offerKeywords: [
    'platform', 'software', 'tool', 'solution', 'system',
    'dashboard', 'analytics', 'automation', 'integration',
    'api', 'features', 'modules', 'plugins', 'extensions',
  ],
};

/**
 * B2B Services vertical indicators
 * Agencies, consulting, professional services
 */
const B2B_SERVICES_SIGNALS = {
  domainPatterns: [
    'agency', 'consulting', 'partners', 'solutions', 'group',
    'advisors', 'associates', 'co', 'collective',
  ],
  industryKeywords: [
    'agency', 'consulting', 'consultancy', 'professional services',
    'marketing agency', 'digital agency', 'creative agency',
    'advertising agency', 'pr agency', 'seo agency', 'ppc agency',
    'web agency', 'design agency', 'branding agency',
    'management consulting', 'strategy consulting', 'it consulting',
    'legal services', 'accounting', 'financial services',
    'staffing', 'recruiting', 'hr services', 'payroll services',
  ],
  businessModelKeywords: [
    'agency', 'consulting', 'services', 'retainer', 'project-based',
    'hourly', 'team', 'client', 'engagement', 'scope',
    'strategy', 'execution', 'implementation', 'management',
    'fractional', 'outsourced', 'managed services', 'advisory',
  ],
  offerKeywords: [
    'services', 'strategy', 'consulting', 'management',
    'implementation', 'optimization', 'audit', 'analysis',
    'planning', 'execution', 'campaign', 'content',
    'design', 'development', 'support', 'training',
  ],
};

/**
 * Hybrid B2C+B2B indicators
 * Wholesale, distributor, dealer networks
 */
const HYBRID_SIGNALS = {
  domainPatterns: [
    'wholesale', 'distributor', 'supply', 'dealer',
  ],
  industryKeywords: [
    'wholesale', 'distribution', 'dealer network', 'reseller',
    'b2b2c', 'b2b and b2c', 'retail and wholesale',
    'distributor', 'supplier', 'vendor',
  ],
  businessModelKeywords: [
    'wholesale', 'distribution', 'dealer', 'reseller',
    'channel partner', 'volume pricing', 'bulk orders',
    'retail and wholesale', 'business accounts',
  ],
  offerKeywords: [
    'wholesale', 'bulk', 'volume', 'dealer pricing',
    'business accounts', 'reseller program', 'distribution',
  ],
};

/**
 * Consumer DTC (Direct-to-Consumer) indicators
 * Online-first brands selling direct to consumers
 */
const CONSUMER_DTC_SIGNALS = {
  domainPatterns: [
    'brand', 'co', 'life', 'wellness', 'beauty', 'skin', 'fit',
  ],
  industryKeywords: [
    'dtc', 'd2c', 'direct to consumer', 'direct-to-consumer',
    'lifestyle brand', 'consumer brand', 'cpg', 'consumer packaged goods',
    'subscription box', 'membership', 'wellness', 'fitness',
    'beauty brand', 'skincare', 'haircare', 'supplements',
    'food brand', 'beverage brand', 'apparel brand',
  ],
  businessModelKeywords: [
    'dtc', 'd2c', 'direct to consumer', 'subscription',
    'membership', 'ecommerce', 'online-first', 'digital-first',
    'brand', 'lifestyle', 'community',
  ],
  offerKeywords: [
    'subscription', 'membership', 'bundle', 'collection',
    'products', 'brand', 'line', 'range',
  ],
};

// ============================================================================
// Detection Functions
// ============================================================================

/**
 * Calculate signal match score for a vertical
 */
function calculateSignalScore(
  context: QueryContext,
  signals: typeof B2C_RETAIL_SIGNALS
): { score: number; matches: string[] } {
  const matches: string[] = [];
  let score = 0;

  const searchText = [
    context.domain ?? '',
    context.industry ?? '',
    context.businessModel ?? '',
    context.icpDescription ?? '',
    toJoinableString(context.primaryOffers),
    context.valueProposition ?? '',
    toJoinableString(context.differentiators),
  ].join(' ').toLowerCase();

  // Domain patterns (high weight - 20 points each)
  for (const pattern of signals.domainPatterns) {
    if (context.domain?.toLowerCase().includes(pattern)) {
      score += 20;
      matches.push(`Domain contains "${pattern}"`);
    }
  }

  // Industry keywords (high weight - 15 points each)
  for (const keyword of signals.industryKeywords) {
    if (context.industry?.toLowerCase().includes(keyword)) {
      score += 15;
      matches.push(`Industry: "${keyword}"`);
      break; // Only count once per category
    }
  }

  // Business model keywords (medium weight - 10 points each)
  for (const keyword of signals.businessModelKeywords) {
    if (context.businessModel?.toLowerCase().includes(keyword)) {
      score += 10;
      matches.push(`Business model: "${keyword}"`);
      break;
    }
  }

  // Offer keywords (medium weight - 5 points each, max 3)
  let offerMatches = 0;
  for (const keyword of signals.offerKeywords) {
    if (searchText.includes(keyword) && offerMatches < 3) {
      score += 5;
      matches.push(`Offers: "${keyword}"`);
      offerMatches++;
    }
  }

  return { score, matches };
}

/**
 * Detect the primary vertical category for a business
 */
export function detectVertical(context: QueryContext): VerticalDetectionResult {
  // Calculate scores for each vertical
  const scores: Record<string, { score: number; matches: string[] }> = {
    retail: calculateSignalScore(context, B2C_RETAIL_SIGNALS),
    automotive: calculateSignalScore(context, AUTOMOTIVE_SIGNALS),
    software: calculateSignalScore(context, B2B_SOFTWARE_SIGNALS),
    services: calculateSignalScore(context, B2B_SERVICES_SIGNALS),
    'consumer-dtc': calculateSignalScore(context, CONSUMER_DTC_SIGNALS),
    hybrid: calculateSignalScore(context, HYBRID_SIGNALS),
  };

  // Explicit businessModelCategory override
  if (context.businessModelCategory === 'B2C') {
    scores.retail.score += 30;
    scores.automotive.score += 20;
    scores['consumer-dtc'].score += 25;
    scores.retail.matches.push('businessModelCategory: B2C');
  } else if (context.businessModelCategory === 'B2B') {
    scores.services.score += 25;
    scores.software.score += 25;
    scores.services.matches.push('businessModelCategory: B2B');
  } else if (context.businessModelCategory === 'Hybrid') {
    scores.hybrid.score += 40;
    scores.hybrid.matches.push('businessModelCategory: Hybrid');
  }

  // Find highest scoring vertical (including hybrid as internal tracking)
  let bestVerticalKey = 'unknown';
  let bestScore = 0;
  let bestMatches: string[] = [];

  for (const [vertical, { score, matches }] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestVerticalKey = vertical;
      bestMatches = matches;
    }
  }

  // Map hybrid to appropriate VerticalCategory (hybrid is not a valid VerticalCategory)
  let bestVertical: VerticalCategory;
  if (bestVerticalKey === 'hybrid') {
    // Check if it's primarily retail + wholesale
    if (scores.retail.score > 20 || scores.automotive.score > 20) {
      bestVertical = scores.automotive.score > scores.retail.score ? 'automotive' : 'retail';
    } else {
      bestVertical = 'retail'; // Default hybrid to retail
    }
  } else {
    bestVertical = bestVerticalKey as VerticalCategory;
  }

  // Calculate confidence (normalize to 0-1)
  const maxPossibleScore = 100;
  const confidence = Math.min(bestScore / maxPossibleScore, 1);

  // Detect sub-vertical
  const subVertical = detectSubVertical(context, bestVertical);

  // Generate reasoning
  const reasoning = generateReasoning(bestVertical, bestMatches, confidence);

  return {
    verticalCategory: bestVertical,
    subVertical,
    confidence,
    reasoning,
    signals: bestMatches,
  };
}

/**
 * Detect sub-vertical within a main vertical
 */
function detectSubVertical(context: QueryContext, vertical: VerticalCategory): string | null {
  const searchText = [
    context.domain ?? '',
    context.industry ?? '',
    toJoinableString(context.primaryOffers),
  ].join(' ').toLowerCase();

  if (vertical === 'automotive') {
    if (searchText.includes('audio') || searchText.includes('stereo') || searchText.includes('speaker')) {
      return 'car-audio';
    }
    if (searchText.includes('tint') || searchText.includes('window')) {
      return 'window-tint';
    }
    if (searchText.includes('detail') || searchText.includes('wrap')) {
      return 'detailing';
    }
    if (searchText.includes('remote start') || searchText.includes('alarm')) {
      return 'car-electronics';
    }
    return 'general-automotive';
  }

  if (vertical === 'retail') {
    if (searchText.includes('skate') || searchText.includes('skateboard')) {
      return 'skateboard';
    }
    if (searchText.includes('bike') || searchText.includes('cycling')) {
      return 'cycling';
    }
    if (searchText.includes('outdoor') || searchText.includes('camping')) {
      return 'outdoor-gear';
    }
    if (searchText.includes('music') || searchText.includes('instrument')) {
      return 'music';
    }
    if (searchText.includes('sporting') || searchText.includes('sports')) {
      return 'sporting-goods';
    }
    return 'general-retail';
  }

  if (vertical === 'services') {
    if (searchText.includes('marketing') || searchText.includes('digital agency')) {
      return 'marketing-agency';
    }
    if (searchText.includes('consulting') || searchText.includes('strategy')) {
      return 'consulting';
    }
    if (searchText.includes('design') || searchText.includes('creative')) {
      return 'creative-agency';
    }
    return 'professional-services';
  }

  if (vertical === 'software') {
    if (searchText.includes('crm') || searchText.includes('sales')) {
      return 'crm';
    }
    if (searchText.includes('marketing') || searchText.includes('automation')) {
      return 'marketing-software';
    }
    if (searchText.includes('project') || searchText.includes('collaboration')) {
      return 'productivity';
    }
    return 'general-software';
  }

  return null;
}

/**
 * Generate human-readable reasoning
 */
function generateReasoning(
  vertical: VerticalCategory,
  matches: string[],
  confidence: number
): string {
  const confidenceLabel = confidence >= 0.7 ? 'high' : confidence >= 0.4 ? 'medium' : 'low';
  const topMatches = matches.slice(0, 3).join(', ');

  const verticalDescriptions: Record<VerticalCategory, string> = {
    retail: 'B2C retail business with physical/online presence',
    automotive: 'automotive aftermarket/service business',
    software: 'B2B software/SaaS company',
    services: 'B2B professional services provider',
    'consumer-dtc': 'direct-to-consumer brand',
    manufacturing: 'manufacturing/industrial company',
    marketplace: 'two-sided marketplace/platform',
    'financial-services': 'bank, credit union, or financial institution',
    unknown: 'unknown business type',
  };

  return `Classified as ${verticalDescriptions[vertical]} with ${confidenceLabel} confidence. Key signals: ${topMatches || 'none detected'}.`;
}

/**
 * Check if a vertical is B2C (retail-oriented)
 * Note: marketplace is NOT B2C retail - they have different competitor dynamics
 */
export function isB2CVertical(vertical: VerticalCategory): boolean {
  return ['retail', 'automotive', 'consumer-dtc'].includes(vertical);
}

/**
 * Check if a vertical is a marketplace/platform
 */
export function isMarketplaceVertical(vertical: VerticalCategory): boolean {
  return vertical === 'marketplace';
}

/**
 * Check if a vertical is B2B (services/software-oriented)
 */
export function isB2BVertical(vertical: VerticalCategory): boolean {
  return ['services', 'software'].includes(vertical);
}

/**
 * Get competitor types that should be hidden for a vertical
 */
export function getHiddenCompetitorTypes(vertical: VerticalCategory): string[] {
  if (isB2CVertical(vertical)) {
    return ['fractional', 'internal'];
  }
  return [];
}
