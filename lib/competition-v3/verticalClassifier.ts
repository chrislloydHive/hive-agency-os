// lib/competition-v3/verticalClassifier.ts
// Vertical Category Intelligence
//
// Detects the vertical category of a business based on:
// - Domain signals
// - Keywords in homepage text
// - Structured signals (ecommerce, SaaS, retail, automotive, etc.)
// - Industry terminology
//
// Used to drive vertical-specific competitor filtering, narratives, and recommendations

import type {
  VerticalCategory,
  VerticalDetectionResult,
  QueryContext,
  CrawledContent,
  CompetitorType,
  CompanyArchetype,
  ArchetypeDetectionResult,
  CompanyClassificationResult,
} from './types';
import { VERTICAL_ALLOWED_TYPES, VERTICAL_DISALLOWED_TYPES } from './types';

// ============================================================================
// Vertical Detection Keywords
// ============================================================================

/**
 * Keywords that indicate retail vertical
 */
export const RETAIL_KEYWORDS = [
  'store', 'shop', 'retail', 'showroom', 'brick and mortar',
  'in-store', 'walk-in', 'storefront', 'location', 'locations',
  'visit us', 'come see', 'open hours', 'business hours',
  'shopping', 'buy now', 'add to cart', 'checkout',
  'inventory', 'in stock', 'out of stock', 'shipping',
];

/**
 * Keywords that indicate automotive vertical (subvertical of retail)
 */
export const AUTOMOTIVE_KEYWORDS = [
  'car', 'auto', 'automotive', 'vehicle', 'truck', 'suv',
  'car audio', 'car stereo', 'car electronics', 'mobile electronics',
  'installation', 'installer', 'install', 'remote start',
  'window tint', 'tinting', 'dash cam', 'dashcam',
  'aftermarket', 'accessories', 'upgrade', 'custom',
  'detailing', 'paint protection', 'wrap', 'ceramic coating',
  'mechanic', 'repair', 'service center', 'garage',
];

/**
 * Keywords that indicate services/agency vertical
 */
export const SERVICES_KEYWORDS = [
  'agency', 'consulting', 'consultancy', 'services',
  'marketing agency', 'digital agency', 'creative agency',
  'full-service', 'managed services', 'professional services',
  'b2b', 'enterprise', 'clients', 'case studies',
  'retainer', 'project-based', 'hourly', 'engagement',
  'strategy', 'strategic', 'advisory', 'advisor',
  'fractional', 'outsourced', 'partner', 'vendor',
  'seo agency', 'ppc agency', 'social media agency',
  'branding agency', 'design agency', 'web agency',
  'growth agency', 'performance agency', 'media agency',
];

/**
 * Keywords that indicate software/SaaS vertical
 */
export const SOFTWARE_KEYWORDS = [
  'software', 'saas', 'platform', 'app', 'application',
  'cloud', 'api', 'integration', 'integrations',
  'login', 'sign up', 'free trial', 'demo', 'pricing',
  'subscription', 'per month', 'per user', 'per seat',
  'enterprise plan', 'team plan', 'pro plan',
  'dashboard', 'analytics', 'reporting', 'automation',
  'workflow', 'crm', 'erp', 'hrm', 'cms',
  'developer', 'sdk', 'documentation', 'docs',
];

/**
 * Keywords that indicate consumer DTC vertical
 */
export const CONSUMER_DTC_KEYWORDS = [
  'direct to consumer', 'd2c', 'dtc', 'brand',
  'our story', 'founder', 'mission', 'values',
  'community', 'lifestyle', 'movement',
  'subscription box', 'membership', 'club',
  'instagram', 'tiktok', 'social', 'influencer',
  'unboxing', 'review', 'testimonial',
  'sustainability', 'eco-friendly', 'ethical',
  'handmade', 'artisan', 'craft', 'small batch',
];

/**
 * Keywords that indicate manufacturing vertical
 */
export const MANUFACTURING_KEYWORDS = [
  'manufacturing', 'manufacturer', 'factory',
  'oem', 'odm', 'wholesale', 'bulk',
  'industrial', 'b2b', 'supply chain',
  'production', 'fabrication', 'assembly',
  'iso certified', 'quality control', 'qc',
  'lead time', 'moq', 'minimum order',
  'raw materials', 'components', 'parts',
];

/**
 * Keywords that indicate marketplace/platform vertical
 */
export const MARKETPLACE_KEYWORDS = [
  'marketplace', 'platform', 'connect', 'book',
  'find', 'hire', 'browse', 'search',
  'providers', 'professionals', 'experts',
  'trainers', 'coaches', 'instructors', 'tutors',
  'freelancers', 'contractors', 'vendors',
  'supply and demand', 'two-sided', 'multi-sided',
  'booking', 'appointments', 'schedule',
  'reviews', 'ratings', 'verified',
  'join as provider', 'become a provider', 'list your',
  'sign up as', 'register as',
];

/**
 * Keywords that indicate financial services vertical
 */
export const FINANCIAL_SERVICES_KEYWORDS = [
  // Banking
  'bank', 'banking', 'banker', 'bankers',
  'credit union', 'savings', 'checking', 'deposit', 'deposits',
  'lending', 'loan', 'loans', 'mortgage', 'mortgages',
  'interest rate', 'apr', 'apy', 'fdic',
  'branch', 'branches', 'atm', 'online banking', 'mobile banking',
  // Financial services
  'financial services', 'financial institution',
  'wealth management', 'asset management', 'portfolio',
  'investment', 'investments', 'investing',
  'retirement', '401k', 'ira', 'pension',
  'financial planning', 'financial advisor',
  // Insurance
  'insurance', 'insurer', 'underwriting', 'coverage', 'policy', 'premium',
  'claims', 'deductible', 'beneficiary',
  // Credit
  'credit', 'credit card', 'line of credit', 'credit score', 'fico',
  // Fintech
  'fintech', 'neobank', 'digital bank', 'challenger bank',
  'payment', 'payments', 'transaction', 'transfer', 'wire',
];

// ============================================================================
// Archetype Detection Keywords
// ============================================================================

/**
 * Keywords that indicate two-sided marketplace archetype
 */
export const TWO_SIDED_MARKETPLACE_KEYWORDS = [
  'marketplace', 'platform connecting', 'connects',
  'find and book', 'hire', 'browse',
  'providers', 'professionals', 'experts',
  'customers', 'clients', 'users',
  'supply', 'demand', 'two-sided', 'multi-sided',
  'join as provider', 'become a provider', 'list your',
  'sign up as a', 'register as a',
  'booking platform', 'matching', 'matchmaking',
];

/**
 * Keywords that indicate SaaS archetype
 */
export const SAAS_KEYWORDS = [
  'software', 'saas', 'cloud', 'subscription',
  'free trial', 'pricing plans', 'per user', 'per seat',
  'api', 'integrations', 'dashboard', 'analytics',
  'log in', 'sign up', 'get started',
  'enterprise plan', 'team plan', 'pro plan',
];

/**
 * Keywords that indicate agency archetype
 */
export const AGENCY_ARCHETYPE_KEYWORDS = [
  'agency', 'marketing agency', 'digital agency',
  'creative agency', 'design agency', 'web agency',
  'full-service', 'managed services',
  'our team', 'our experts', 'our specialists',
  'case studies', 'portfolio', 'our work',
  'retainer', 'project-based', 'engagement',
];

/**
 * Marketplace sub-verticals (what the marketplace is about)
 */
export const MARKETPLACE_VERTICALS: Record<string, string[]> = {
  'fitness': ['trainer', 'fitness', 'gym', 'workout', 'personal training', 'yoga', 'pilates', 'crossfit', 'boot camp'],
  'wellness': ['wellness', 'spa', 'massage', 'meditation', 'health coaching', 'nutrition'],
  'home-services': ['home service', 'cleaning', 'plumber', 'electrician', 'handyman', 'contractor', 'landscaping'],
  'professional-services': ['consultant', 'lawyer', 'accountant', 'financial advisor', 'business services'],
  'creative': ['designer', 'photographer', 'videographer', 'artist', 'creative', 'freelance'],
  'education': ['tutor', 'teacher', 'instructor', 'lessons', 'classes', 'courses', 'learning'],
  'rentals': ['rental', 'rent', 'vacation', 'property', 'equipment', 'vehicle'],
  'events': ['event', 'wedding', 'party', 'venue', 'catering', 'entertainment'],
};

// ============================================================================
// Sub-Vertical Detection
// ============================================================================

/**
 * Sub-vertical keywords mapped to their parent vertical
 */
export const SUB_VERTICAL_KEYWORDS: Record<string, { vertical: VerticalCategory; keywords: string[] }> = {
  'car-audio': { vertical: 'automotive', keywords: ['car audio', 'car stereo', 'speakers', 'subwoofer', 'amplifier', 'head unit'] },
  'car-electronics': { vertical: 'automotive', keywords: ['remote start', 'dash cam', 'radar detector', 'backup camera', 'gps'] },
  'window-tint': { vertical: 'automotive', keywords: ['window tint', 'tinting', 'film', 'ceramic tint', 'privacy'] },
  'detailing': { vertical: 'automotive', keywords: ['detailing', 'detail', 'ceramic coating', 'paint protection', 'ppf', 'wrap'] },
  'skateboard': { vertical: 'retail', keywords: ['skateboard', 'skate', 'deck', 'trucks', 'wheels', 'bearings', 'grip tape'] },
  'sporting-goods': { vertical: 'retail', keywords: ['sporting goods', 'sports equipment', 'fitness', 'outdoor', 'camping', 'hiking'] },
  'apparel': { vertical: 'retail', keywords: ['clothing', 'apparel', 'fashion', 'shoes', 'footwear', 'accessories'] },
  'electronics': { vertical: 'retail', keywords: ['electronics', 'tech', 'gadgets', 'computers', 'phones', 'tablets'] },
  'home-improvement': { vertical: 'retail', keywords: ['home improvement', 'hardware', 'tools', 'lumber', 'paint', 'flooring'] },
  'beauty': { vertical: 'retail', keywords: ['beauty', 'cosmetics', 'skincare', 'makeup', 'hair care', 'salon'] },
  'pet': { vertical: 'retail', keywords: ['pet', 'dog', 'cat', 'pet food', 'pet supplies', 'grooming'] },
  'marketing-agency': { vertical: 'services', keywords: ['marketing agency', 'digital marketing', 'seo', 'ppc', 'social media marketing'] },
  'design-agency': { vertical: 'services', keywords: ['design agency', 'creative agency', 'branding', 'web design', 'graphic design'] },
  'consulting': { vertical: 'services', keywords: ['consulting', 'consultancy', 'advisory', 'strategy consulting', 'management consulting'] },
  'crm': { vertical: 'software', keywords: ['crm', 'customer relationship', 'sales software', 'pipeline', 'contacts'] },
  'marketing-software': { vertical: 'software', keywords: ['marketing software', 'marketing automation', 'email marketing', 'marketing platform'] },
  'analytics': { vertical: 'software', keywords: ['analytics', 'data analytics', 'business intelligence', 'reporting', 'dashboards'] },
};

// ============================================================================
// Domain-Based Detection
// ============================================================================

/**
 * Known domain patterns that indicate specific verticals
 */
export const DOMAIN_VERTICAL_HINTS: Record<string, VerticalCategory> = {
  // Automotive
  'cartoys': 'automotive',
  'crutchfield': 'automotive',
  'jlaudio': 'automotive',
  'kicker': 'automotive',
  'alpine': 'automotive',
  'kenwood': 'automotive',
  'pioneer': 'automotive',
  'bestbuy': 'retail', // Has automotive but primarily retail

  // Software/SaaS indicators in domain
  'app.': 'software',
  'dashboard.': 'software',
  'cloud.': 'software',
  'api.': 'software',

  // E-commerce platforms
  'shopify': 'consumer-dtc',
  'bigcommerce': 'consumer-dtc',
  'woocommerce': 'retail',

  // Financial services - TLD indicators
  '.bank': 'financial-services',       // .bank TLD (e.g., portage.bank)
  '.insurance': 'financial-services',  // .insurance TLD
  // Financial services - known patterns
  'creditunion': 'financial-services',
  'savings': 'financial-services',
  'mortgage': 'financial-services',
  'lending': 'financial-services',
};

// ============================================================================
// Detection Functions
// ============================================================================

/**
 * Count keyword matches in text
 */
function countKeywordMatches(text: string, keywords: string[]): number {
  const lowerText = text.toLowerCase();
  return keywords.filter(kw => lowerText.includes(kw.toLowerCase())).length;
}

/**
 * Get all matching keywords from text
 */
function getMatchingKeywords(text: string, keywords: string[]): string[] {
  const lowerText = text.toLowerCase();
  return keywords.filter(kw => lowerText.includes(kw.toLowerCase()));
}

/**
 * Detect vertical category from domain name
 */
export function detectVerticalFromDomain(domain: string | null): VerticalCategory | null {
  if (!domain) return null;

  const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');

  // Check explicit domain mappings
  for (const [pattern, vertical] of Object.entries(DOMAIN_VERTICAL_HINTS)) {
    if (normalizedDomain.includes(pattern)) {
      return vertical;
    }
  }

  return null;
}

/**
 * Detect sub-vertical from text content
 */
export function detectSubVertical(text: string): { subVertical: string; vertical: VerticalCategory } | null {
  const lowerText = text.toLowerCase();
  let bestMatch: { subVertical: string; vertical: VerticalCategory; score: number } | null = null;

  for (const [subVertical, config] of Object.entries(SUB_VERTICAL_KEYWORDS)) {
    const matchCount = countKeywordMatches(lowerText, config.keywords);
    if (matchCount >= 2 && (!bestMatch || matchCount > bestMatch.score)) {
      bestMatch = { subVertical, vertical: config.vertical, score: matchCount };
    }
  }

  return bestMatch ? { subVertical: bestMatch.subVertical, vertical: bestMatch.vertical } : null;
}

/**
 * Main vertical detection function
 * Analyzes multiple signals to determine the business vertical
 */
export function detectVerticalCategory(
  context: Partial<QueryContext>,
  crawledContent?: CrawledContent | null,
  html?: string
): VerticalDetectionResult {
  const signals: string[] = [];
  const scores: Record<VerticalCategory, number> = {
    'retail': 0,
    'services': 0,
    'software': 0,
    'manufacturing': 0,
    'consumer-dtc': 0,
    'automotive': 0,
    'marketplace': 0,
    'financial-services': 0,
    'unknown': 0,
  };

  // Build combined text for analysis
  const textParts: string[] = [];

  // Add context data
  if (context.industry) textParts.push(context.industry);
  if (context.businessModel) textParts.push(context.businessModel);
  if (context.icpDescription) textParts.push(context.icpDescription);
  if (context.valueProposition) textParts.push(context.valueProposition);
  if (context.primaryOffers) textParts.push(...context.primaryOffers);
  if (context.differentiators) textParts.push(...context.differentiators);

  // Add crawled content
  if (crawledContent) {
    if (crawledContent.homepage.title) textParts.push(crawledContent.homepage.title);
    if (crawledContent.homepage.h1) textParts.push(crawledContent.homepage.h1);
    if (crawledContent.homepage.description) textParts.push(crawledContent.homepage.description);
    if (crawledContent.homepage.keywords) textParts.push(...crawledContent.homepage.keywords);
    if (crawledContent.services.offerings) textParts.push(...crawledContent.services.offerings);
    if (crawledContent.industries) textParts.push(...crawledContent.industries);
  }

  // Add raw HTML
  if (html) textParts.push(html);

  const combinedText = textParts.join(' ');

  // 1. Check domain-based hints first (high confidence)
  const domainVertical = detectVerticalFromDomain(context.domain ?? null);
  if (domainVertical) {
    scores[domainVertical] += 30;
    signals.push(`Domain pattern suggests ${domainVertical}`);
  }

  // 2. Check B2C indicator from context
  if (context.businessModelCategory === 'B2C') {
    scores['retail'] += 15;
    scores['consumer-dtc'] += 15;
    scores['automotive'] += 10;
    signals.push('B2C business model category');
  } else if (context.businessModelCategory === 'B2B') {
    scores['services'] += 15;
    scores['software'] += 10;
    scores['manufacturing'] += 10;
    signals.push('B2B business model category');
  }

  // 3. Score based on keyword matches
  const retailMatches = countKeywordMatches(combinedText, RETAIL_KEYWORDS);
  const automotiveMatches = countKeywordMatches(combinedText, AUTOMOTIVE_KEYWORDS);
  const servicesMatches = countKeywordMatches(combinedText, SERVICES_KEYWORDS);
  const softwareMatches = countKeywordMatches(combinedText, SOFTWARE_KEYWORDS);
  const dtcMatches = countKeywordMatches(combinedText, CONSUMER_DTC_KEYWORDS);
  const manufacturingMatches = countKeywordMatches(combinedText, MANUFACTURING_KEYWORDS);
  const marketplaceMatches = countKeywordMatches(combinedText, MARKETPLACE_KEYWORDS);
  const financialServicesMatches = countKeywordMatches(combinedText, FINANCIAL_SERVICES_KEYWORDS);

  // Weight the matches
  scores['retail'] += retailMatches * 3;
  scores['automotive'] += automotiveMatches * 4; // Higher weight for automotive specificity
  scores['services'] += servicesMatches * 3;
  scores['software'] += softwareMatches * 3;
  scores['consumer-dtc'] += dtcMatches * 3;
  scores['manufacturing'] += manufacturingMatches * 3;
  scores['marketplace'] += marketplaceMatches * 5; // Higher weight for marketplace (they often overlap with other verticals)
  scores['financial-services'] += financialServicesMatches * 4; // Higher weight for financial services specificity

  // Record signals
  if (retailMatches > 0) signals.push(`${retailMatches} retail keywords matched`);
  if (automotiveMatches > 0) signals.push(`${automotiveMatches} automotive keywords matched`);
  if (servicesMatches > 0) signals.push(`${servicesMatches} services keywords matched`);
  if (softwareMatches > 0) signals.push(`${softwareMatches} software keywords matched`);
  if (dtcMatches > 0) signals.push(`${dtcMatches} DTC keywords matched`);
  if (manufacturingMatches > 0) signals.push(`${manufacturingMatches} manufacturing keywords matched`);
  if (marketplaceMatches > 0) signals.push(`${marketplaceMatches} marketplace keywords matched`);
  if (financialServicesMatches > 0) signals.push(`${financialServicesMatches} financial services keywords matched`);

  // 4. Check for sub-vertical (can override or boost)
  const subVerticalResult = detectSubVertical(combinedText);
  let subVertical: string | null = null;

  if (subVerticalResult) {
    scores[subVerticalResult.vertical] += 20;
    subVertical = subVerticalResult.subVertical;
    signals.push(`Sub-vertical detected: ${subVertical}`);
  }

  // 5. Check explicit industry field
  const industryLower = context.industry?.toLowerCase() || '';
  if (industryLower.includes('retail') || industryLower.includes('store')) {
    scores['retail'] += 25;
    signals.push('Industry field contains retail indicators');
  }
  if (industryLower.includes('automotive') || industryLower.includes('car') || industryLower.includes('auto')) {
    scores['automotive'] += 25;
    signals.push('Industry field contains automotive indicators');
  }
  if (industryLower.includes('agency') || industryLower.includes('consulting') || industryLower.includes('services')) {
    scores['services'] += 25;
    signals.push('Industry field contains services indicators');
  }
  if (industryLower.includes('software') || industryLower.includes('saas')) {
    scores['software'] += 25;
    signals.push('Industry field contains software indicators');
  }
  if (industryLower.includes('marketplace') || industryLower.includes('platform') || industryLower.includes('booking')) {
    scores['marketplace'] += 30; // Strong signal for marketplace
    signals.push('Industry field contains marketplace indicators');
  }
  if (industryLower.includes('bank') || industryLower.includes('financial') || industryLower.includes('lending') ||
      industryLower.includes('credit union') || industryLower.includes('insurance') || industryLower.includes('mortgage')) {
    scores['financial-services'] += 35; // Strong signal for financial services
    signals.push('Industry field contains financial services indicators');
  }

  // 5b. Check business model for marketplace indicators
  const businessModelLower = context.businessModel?.toLowerCase() || '';
  if (businessModelLower.includes('marketplace') || businessModelLower.includes('two-sided') ||
      businessModelLower.includes('platform') || businessModelLower.includes('connect')) {
    scores['marketplace'] += 35;
    signals.push('Business model indicates marketplace');
  }

  // 6. Determine winner
  let winner: VerticalCategory = 'unknown';
  let maxScore = 0;

  for (const [vertical, score] of Object.entries(scores)) {
    if (score > maxScore && vertical !== 'unknown') {
      maxScore = score;
      winner = vertical as VerticalCategory;
    }
  }

  // Special case: automotive is a specialized form of retail
  // If automotive wins but retail is also high, it's still automotive
  if (winner === 'retail' && scores['automotive'] > scores['retail'] * 0.7) {
    winner = 'automotive';
    signals.push('Automotive signals strong enough to override retail');
  }

  // Calculate confidence
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0 ? Math.min(maxScore / totalScore * 1.5, 1) : 0;

  // Build reasoning
  let reasoning = '';
  if (winner === 'unknown' || maxScore < 10) {
    reasoning = 'Insufficient signals to determine vertical category';
    winner = 'unknown';
  } else {
    const topSignals = signals.slice(0, 3).join('; ');
    reasoning = `Detected as ${winner} based on: ${topSignals}`;
  }

  return {
    verticalCategory: winner,
    subVertical,
    confidence: Math.round(confidence * 100) / 100,
    reasoning,
    signals,
  };
}

// ============================================================================
// Vertical-Aware Filtering
// ============================================================================

/**
 * Check if a competitor type is allowed for the given vertical
 */
export function isCompetitorTypeAllowedForVertical(
  type: CompetitorType,
  vertical: VerticalCategory
): boolean {
  const allowed = VERTICAL_ALLOWED_TYPES[vertical] || VERTICAL_ALLOWED_TYPES['unknown'];
  return allowed.includes(type);
}

/**
 * Get allowed competitor types for a vertical
 */
export function getAllowedTypesForVertical(vertical: VerticalCategory): CompetitorType[] {
  return VERTICAL_ALLOWED_TYPES[vertical] || VERTICAL_ALLOWED_TYPES['unknown'];
}

/**
 * Get disallowed competitor types for a vertical
 */
export function getDisallowedTypesForVertical(vertical: VerticalCategory): CompetitorType[] {
  return VERTICAL_DISALLOWED_TYPES[vertical] || VERTICAL_DISALLOWED_TYPES['unknown'];
}

/**
 * Filter competitors based on vertical category rules
 */
export function filterCompetitorsByVertical<T extends { classification?: { type: CompetitorType } }>(
  competitors: T[],
  vertical: VerticalCategory
): T[] {
  const allowed = getAllowedTypesForVertical(vertical);

  return competitors.filter(c => {
    const type = c.classification?.type;
    if (!type) return true; // Keep unclassified
    return allowed.includes(type);
  });
}

// ============================================================================
// Vertical-Specific Language
// ============================================================================

/**
 * Get vertical-specific terminology for narratives
 */
export interface VerticalTerminology {
  customer: string;
  customers: string;
  product: string;
  products: string;
  purchase: string;
  competitor: string;
  competitors: string;
  market: string;
  differentiation: string[];
  threats: string[];
}

export const VERTICAL_TERMINOLOGY: Record<VerticalCategory, VerticalTerminology> = {
  'retail': {
    customer: 'shopper',
    customers: 'shoppers',
    product: 'product',
    products: 'products',
    purchase: 'purchase',
    competitor: 'competing store',
    competitors: 'competing stores',
    market: 'retail market',
    differentiation: ['product selection', 'store experience', 'pricing', 'location', 'customer service'],
    threats: ['big-box retailers', 'e-commerce giants', 'category killers', 'discounters'],
  },
  'automotive': {
    customer: 'vehicle owner',
    customers: 'vehicle owners',
    product: 'product',
    products: 'products',
    purchase: 'purchase',
    competitor: 'competing shop',
    competitors: 'competing shops',
    market: 'automotive aftermarket',
    differentiation: ['installation expertise', 'product selection', 'service quality', 'warranty', 'location'],
    threats: ['national chains', 'dealership service', 'DIY installation', 'online retailers'],
  },
  'services': {
    customer: 'client',
    customers: 'clients',
    product: 'service',
    products: 'services',
    purchase: 'engagement',
    competitor: 'competing agency',
    competitors: 'competing agencies',
    market: 'services market',
    differentiation: ['expertise', 'track record', 'methodology', 'team', 'industry focus'],
    threats: ['in-house teams', 'offshore agencies', 'freelancers', 'AI tools'],
  },
  'software': {
    customer: 'user',
    customers: 'users',
    product: 'product',
    products: 'products',
    purchase: 'subscription',
    competitor: 'competing platform',
    competitors: 'competing platforms',
    market: 'software market',
    differentiation: ['features', 'integrations', 'ease of use', 'pricing', 'support'],
    threats: ['enterprise incumbents', 'point solutions', 'open source', 'platform expansion'],
  },
  'manufacturing': {
    customer: 'buyer',
    customers: 'buyers',
    product: 'product',
    products: 'products',
    purchase: 'order',
    competitor: 'competing manufacturer',
    competitors: 'competing manufacturers',
    market: 'manufacturing market',
    differentiation: ['quality', 'pricing', 'lead time', 'minimum order', 'certifications'],
    threats: ['offshore manufacturers', 'vertical integration', 'material costs', 'automation'],
  },
  'consumer-dtc': {
    customer: 'customer',
    customers: 'customers',
    product: 'product',
    products: 'products',
    purchase: 'purchase',
    competitor: 'competing brand',
    competitors: 'competing brands',
    market: 'consumer market',
    differentiation: ['brand story', 'community', 'product quality', 'values', 'experience'],
    threats: ['established brands', 'Amazon', 'copycats', 'acquisition costs'],
  },
  'marketplace': {
    customer: 'user',
    customers: 'users',
    product: 'service',
    products: 'services',
    purchase: 'booking',
    competitor: 'competing marketplace',
    competitors: 'competing marketplaces',
    market: 'marketplace vertical',
    differentiation: ['supply density', 'user experience', 'trust and safety', 'network effects', 'specialization'],
    threats: ['established marketplaces', 'vertical entrants', 'aggregators', 'direct booking'],
  },
  'financial-services': {
    customer: 'customer',
    customers: 'customers',
    product: 'product',
    products: 'products',
    purchase: 'account opening',
    competitor: 'competing institution',
    competitors: 'competing institutions',
    market: 'financial services market',
    differentiation: ['rates', 'fees', 'digital experience', 'branch network', 'customer service', 'product offerings'],
    threats: ['national banks', 'credit unions', 'fintechs', 'neobanks', 'big tech financial products'],
  },
  'unknown': {
    customer: 'customer',
    customers: 'customers',
    product: 'offering',
    products: 'offerings',
    purchase: 'purchase',
    competitor: 'competitor',
    competitors: 'competitors',
    market: 'market',
    differentiation: ['value proposition', 'pricing', 'quality', 'service'],
    threats: ['market leaders', 'new entrants', 'substitutes'],
  },
};

/**
 * Get terminology for a vertical
 */
export function getVerticalTerminology(vertical: VerticalCategory): VerticalTerminology {
  return VERTICAL_TERMINOLOGY[vertical] || VERTICAL_TERMINOLOGY['unknown'];
}

// ============================================================================
// Vertical-Specific Discovery Modifiers
// ============================================================================

/**
 * Get search query modifiers for a vertical
 */
export function getVerticalSearchModifiers(vertical: VerticalCategory): {
  include: string[];
  exclude: string[];
} {
  switch (vertical) {
    case 'retail':
      return {
        include: ['store', 'shop', 'retailer'],
        exclude: ['agency', 'consulting', 'software', 'saas', 'platform'],
      };
    case 'automotive':
      return {
        include: ['car', 'auto', 'vehicle', 'installation', 'mobile electronics'],
        exclude: ['agency', 'consulting', 'software', 'saas', 'dealership new cars'],
      };
    case 'services':
      return {
        include: ['agency', 'firm', 'consulting', 'services'],
        exclude: ['store', 'shop', 'retail', 'ecommerce'],
      };
    case 'software':
      return {
        include: ['software', 'platform', 'saas', 'app'],
        exclude: ['agency', 'consulting', 'store', 'retail'],
      };
    case 'consumer-dtc':
      return {
        include: ['brand', 'd2c', 'direct to consumer'],
        exclude: ['agency', 'consulting', 'b2b', 'enterprise'],
      };
    case 'manufacturing':
      return {
        include: ['manufacturer', 'oem', 'supplier', 'wholesale'],
        exclude: ['agency', 'consulting', 'retail', 'consumer'],
      };
    case 'marketplace':
      return {
        include: ['marketplace', 'platform', 'book', 'find', 'hire'],
        exclude: ['agency', 'consulting', 'marketing agency', 'seo agency', 'digital agency'],
      };
    case 'financial-services':
      return {
        include: ['bank', 'credit union', 'lending', 'mortgage', 'financial services', 'fintech'],
        exclude: ['agency', 'consulting', 'marketing agency', 'seo agency', 'digital agency', 'web design'],
      };
    default:
      return { include: [], exclude: [] };
  }
}

// ============================================================================
// Archetype Detection
// ============================================================================

/**
 * Detect the company archetype (business model structure)
 * This provides a higher-level classification than vertical
 */
export function detectCompanyArchetype(
  context: Partial<QueryContext>,
  crawledContent?: CrawledContent | null
): ArchetypeDetectionResult {
  const signals: string[] = [];
  const scores: Record<CompanyArchetype, number> = {
    'two_sided_marketplace': 0,
    'saas': 0,
    'directory': 0,
    'agency': 0,
    'consultancy': 0,
    'ecommerce': 0,
    'local_service': 0,
    'content_platform': 0,
    'enterprise_software': 0,
    'unknown': 0,
  };

  // Build combined text for analysis
  const textParts: string[] = [];
  if (context.businessName) textParts.push(context.businessName);
  if (context.industry) textParts.push(context.industry);
  if (context.businessModel) textParts.push(context.businessModel);
  if (context.icpDescription) textParts.push(context.icpDescription);
  if (context.valueProposition) textParts.push(context.valueProposition);
  if (context.primaryOffers) textParts.push(...context.primaryOffers);
  if (context.differentiators) textParts.push(...context.differentiators);

  if (crawledContent) {
    if (crawledContent.homepage.title) textParts.push(crawledContent.homepage.title);
    if (crawledContent.homepage.h1) textParts.push(crawledContent.homepage.h1);
    if (crawledContent.homepage.description) textParts.push(crawledContent.homepage.description);
    if (crawledContent.homepage.keywords) textParts.push(...crawledContent.homepage.keywords);
    if (crawledContent.services.offerings) textParts.push(...crawledContent.services.offerings);
  }

  const combinedText = textParts.join(' ').toLowerCase();

  // Two-sided marketplace detection
  const marketplaceMatches = countKeywordMatches(combinedText, TWO_SIDED_MARKETPLACE_KEYWORDS);
  scores['two_sided_marketplace'] += marketplaceMatches * 5;
  if (marketplaceMatches > 0) signals.push(`${marketplaceMatches} marketplace keywords matched`);

  // Check for two-sided signals specifically
  const hasBothSides = (
    (combinedText.includes('provider') || combinedText.includes('professional') || combinedText.includes('trainer') || combinedText.includes('expert')) &&
    (combinedText.includes('customer') || combinedText.includes('client') || combinedText.includes('user') || combinedText.includes('book'))
  );
  if (hasBothSides) {
    scores['two_sided_marketplace'] += 25;
    signals.push('Both supply and demand side signals detected');
  }

  // SaaS detection
  const saasMatches = countKeywordMatches(combinedText, SAAS_KEYWORDS);
  scores['saas'] += saasMatches * 4;
  if (saasMatches > 0) signals.push(`${saasMatches} SaaS keywords matched`);

  // Agency detection
  const agencyMatches = countKeywordMatches(combinedText, AGENCY_ARCHETYPE_KEYWORDS);
  scores['agency'] += agencyMatches * 4;
  if (agencyMatches > 0) signals.push(`${agencyMatches} agency keywords matched`);

  // Check explicit business model field
  const businessModelLower = context.businessModel?.toLowerCase() || '';
  if (businessModelLower.includes('marketplace') || businessModelLower.includes('two-sided')) {
    scores['two_sided_marketplace'] += 40;
    signals.push('Business model explicitly mentions marketplace');
  } else if (businessModelLower.includes('saas') || businessModelLower.includes('software')) {
    scores['saas'] += 40;
    signals.push('Business model explicitly mentions SaaS');
  } else if (businessModelLower.includes('agency')) {
    scores['agency'] += 40;
    signals.push('Business model explicitly mentions agency');
  } else if (businessModelLower.includes('ecommerce') || businessModelLower.includes('dtc') || businessModelLower.includes('d2c')) {
    scores['ecommerce'] += 40;
    signals.push('Business model explicitly mentions ecommerce/DTC');
  }

  // Check for known marketplace domain patterns
  const domain = context.domain?.toLowerCase() || '';
  const marketplaceDomainPatterns = ['hub', 'connect', 'find', 'book', 'hire', 'match', 'link'];
  for (const pattern of marketplaceDomainPatterns) {
    if (domain.includes(pattern)) {
      scores['two_sided_marketplace'] += 15;
      signals.push(`Domain contains marketplace indicator: ${pattern}`);
      break;
    }
  }

  // Determine winner
  let winner: CompanyArchetype = 'unknown';
  let maxScore = 0;
  for (const [archetype, score] of Object.entries(scores)) {
    if (score > maxScore && archetype !== 'unknown') {
      maxScore = score;
      winner = archetype as CompanyArchetype;
    }
  }

  // Calculate confidence
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0 ? Math.min(maxScore / totalScore * 1.5, 1) : 0;

  // Build reasoning
  let reasoning = '';
  if (winner === 'unknown' || maxScore < 10) {
    reasoning = 'Insufficient signals to determine archetype';
    winner = 'unknown';
  } else {
    const topSignals = signals.slice(0, 3).join('; ');
    reasoning = `Detected as ${winner} based on: ${topSignals}`;
  }

  return {
    archetype: winner,
    confidence: Math.round(confidence * 100) / 100,
    reasoning,
    signals,
  };
}

/**
 * Detect marketplace sub-vertical (fitness, wellness, home-services, etc.)
 */
export function detectMarketplaceVertical(text: string): string | null {
  const lowerText = text.toLowerCase();
  let bestMatch: { vertical: string; score: number } | null = null;

  for (const [vertical, keywords] of Object.entries(MARKETPLACE_VERTICALS)) {
    const matchCount = countKeywordMatches(lowerText, keywords);
    if (matchCount >= 2 && (!bestMatch || matchCount > bestMatch.score)) {
      bestMatch = { vertical, score: matchCount };
    }
  }

  return bestMatch?.vertical ?? null;
}

/**
 * Combined classification: archetype + vertical
 * This is the main entry point for classifying a company
 */
export function classifyCompanyArchetypeAndVertical(
  context: Partial<QueryContext>,
  crawledContent?: CrawledContent | null,
  html?: string
): CompanyClassificationResult {
  // Detect archetype
  const archetypeResult = detectCompanyArchetype(context, crawledContent);

  // Detect vertical
  const verticalResult = detectVerticalCategory(context, crawledContent, html);

  // If archetype is two_sided_marketplace but vertical didn't pick up marketplace,
  // override the vertical to marketplace
  if (archetypeResult.archetype === 'two_sided_marketplace' && verticalResult.verticalCategory !== 'marketplace') {
    return {
      archetype: archetypeResult,
      vertical: {
        ...verticalResult,
        verticalCategory: 'marketplace',
        reasoning: `${verticalResult.reasoning} [Overridden to marketplace due to archetype detection]`,
        signals: [...verticalResult.signals, 'Archetype is two_sided_marketplace'],
      },
    };
  }

  return {
    archetype: archetypeResult,
    vertical: verticalResult,
  };
}

// ============================================================================
// Export helpers
// ============================================================================

export {
  VERTICAL_ALLOWED_TYPES,
  VERTICAL_DISALLOWED_TYPES,
};
