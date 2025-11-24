// lib/gap/contextualHeuristics.ts
/**
 * Contextual Heuristics for Business Type Inference
 *
 * Infers businessType and related context from URL, HTML content, and detected signals
 * to improve GAP-IA and Full GAP recommendations.
 */

/**
 * Business type classifications
 */
export type BusinessType =
  | 'local-consumer'     // Local businesses: gyms, restaurants, farmers markets, venues
  | 'b2b-saas'           // B2B SaaS products
  | 'b2c-saas'           // B2C SaaS products
  | 'ecommerce'          // E-commerce / online retail
  | 'b2b-services'       // B2B services: consulting, agencies
  | 'b2c-services'       // B2C services: coaching, training
  | 'nonprofit'          // Non-profit organizations
  | 'portfolio'          // Personal portfolios, creative work
  | 'media'              // Media publishers, blogs, news
  | 'unknown';           // Unable to determine

/**
 * Brand tier classifications
 */
export type BrandTier =
  | 'global_category_leader'  // Apple, HubSpot, Salesforce, Starbucks
  | 'enterprise'              // Large established companies
  | 'mid_market'              // Well-established mid-sized companies
  | 'smb'                     // Small-to-medium businesses
  | 'startup'                 // Early-stage companies
  | 'local_business'          // Local single/few location businesses
  | 'nonprofit'               // Non-profit organizations
  | 'other';                  // Default

/**
 * Input signals for business context inference
 */
export interface BusinessContextInput {
  url: string;
  domain?: string;
  htmlSnippet?: string;
  detectedSignals?: {
    // Location-based signals
    hasPhysicalAddress?: boolean;
    hasOpeningHours?: boolean;
    hasEventDates?: boolean;
    hasSchedule?: boolean;
    hasMapEmbed?: boolean;

    // Product/Commerce signals
    hasProductCatalog?: boolean;
    hasAddToCart?: boolean;
    hasPricingTables?: boolean;
    hasShoppingCart?: boolean;

    // SaaS signals
    hasSaaSTerms?: boolean;
    hasFreeTrial?: boolean;
    hasDemoRequest?: boolean;
    hasAPIDocumentation?: boolean;

    // Content signals
    hasBlog?: boolean;
    hasCaseStudies?: boolean;
    hasPortfolio?: boolean;
    hasNewsArticles?: boolean;

    // Platform hints
    platformHints?: string[]; // e.g., ["shopify", "wordpress", "webflow"]

    // Social/Digital signals
    hasGoogleBusinessProfile?: boolean;
    hasLinkedInCompanyPage?: boolean;
    socialPlatforms?: string[]; // e.g., ["instagram", "facebook", "linkedin"]
  };
}

/**
 * Inferred business context
 */
export interface BusinessContext {
  businessType: BusinessType;
  brandTier: BrandTier;
  confidence: 'low' | 'medium' | 'high';
  notes: string[];
  signals: {
    isLocal: boolean;
    isB2B: boolean;
    isB2C: boolean;
    isSaaS: boolean;
    isEcommerce: boolean;
    hasPhysicalLocation: boolean;
  };
}

/**
 * Known global category leaders (domain-based)
 */
const GLOBAL_CATEGORY_LEADERS = new Set([
  'apple.com',
  'google.com',
  'microsoft.com',
  'salesforce.com',
  'hubspot.com',
  'shopify.com',
  'stripe.com',
  'openai.com',
  'slack.com',
  'zoom.us',
  'nike.com',
  'starbucks.com',
  'tesla.com',
  'meta.com',
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'twitter.com',
  'netflix.com',
  'spotify.com',
  'airbnb.com',
  'uber.com',
  'amazon.com',
]);

/**
 * Get business context from URL, HTML, and detected signals
 */
export function getBusinessContext(input: BusinessContextInput): BusinessContext {
  const { url, domain, htmlSnippet = '', detectedSignals = {} } = input;
  const notes: string[] = [];
  let businessType: BusinessType = 'unknown';
  let brandTier: BrandTier = 'other';
  let confidence: 'low' | 'medium' | 'high' = 'medium';

  // Normalize HTML snippet for easier matching
  const html = htmlSnippet.toLowerCase();
  const urlLower = url.toLowerCase();
  const domainLower = (domain || extractDomain(url)).toLowerCase();

  // ============================================================================
  // BRAND TIER DETECTION (do this first)
  // ============================================================================

  // Check if global category leader
  if (GLOBAL_CATEGORY_LEADERS.has(domainLower)) {
    brandTier = 'global_category_leader';
    notes.push(`Recognized as global category leader: ${domainLower}`);
    confidence = 'high';
  }

  // ============================================================================
  // BUSINESS TYPE DETECTION (order matters - most specific first)
  // ============================================================================

  // 1. LOCAL-CONSUMER DETECTION (highest priority for local businesses)
  const localSignals = {
    hasAddress: detectedSignals.hasPhysicalAddress || html.includes('address') || html.includes('location'),
    hasHours: detectedSignals.hasOpeningHours || html.includes('hours') || html.includes('open') && html.includes('close'),
    hasEvents: detectedSignals.hasEventDates || html.includes('event') || html.includes('calendar'),
    hasSchedule: detectedSignals.hasSchedule || html.includes('schedule'),
    hasMap: detectedSignals.hasMapEmbed || html.includes('google.com/maps') || html.includes('map'),
    hasVisitCTA: html.includes('visit us') || html.includes('come visit') || html.includes('stop by'),
    hasLocalTerms: html.includes('local') || html.includes('neighborhood') || html.includes('community'),
    hasFarmersMarket: html.includes('farmers market') || html.includes('farmer\'s market') || urlLower.includes('farmersmarket') || urlLower.includes('farmers-market'),
    hasVenue: html.includes('venue') || html.includes('space rental') || html.includes('event space'),
    hasRestaurant: html.includes('restaurant') || html.includes('menu') || html.includes('reservation'),
    hasGym: html.includes('gym') || html.includes('fitness') || html.includes('workout') || html.includes('training'),
  };

  const localScore = Object.values(localSignals).filter(Boolean).length;

  if (localScore >= 3 || localSignals.hasFarmersMarket ||
      (localSignals.hasAddress && localSignals.hasHours)) {
    businessType = 'local-consumer';
    notes.push(`Detected local-consumer business (${localScore} local signals)`);
    if (localSignals.hasFarmersMarket) notes.push('Detected farmers market terminology');
    if (localSignals.hasAddress) notes.push('Detected physical address');
    if (localSignals.hasHours) notes.push('Detected opening hours');
    if (localSignals.hasEvents) notes.push('Detected event dates/calendar');
    confidence = 'high';
  }

  // 2. E-COMMERCE DETECTION
  const ecommerceSignals = {
    isShopify: detectedSignals.platformHints?.includes('shopify') || html.includes('shopify'),
    hasCart: detectedSignals.hasAddToCart || detectedSignals.hasShoppingCart ||
             html.includes('add to cart') || html.includes('shopping cart') || html.includes('checkout'),
    hasProducts: detectedSignals.hasProductCatalog || html.includes('product') || html.includes('shop now'),
    hasWooCommerce: html.includes('woocommerce'),
  };

  const ecommerceScore = Object.values(ecommerceSignals).filter(Boolean).length;

  if (businessType === 'unknown' && ecommerceScore >= 2) {
    businessType = 'ecommerce';
    notes.push(`Detected e-commerce (${ecommerceScore} signals)`);
    if (ecommerceSignals.isShopify) notes.push('Detected Shopify platform');
    if (ecommerceSignals.hasCart) notes.push('Detected shopping cart functionality');
    confidence = 'high';
  }

  // 3. B2B SAAS DETECTION
  const b2bSaasSignals = {
    hasSaaS: detectedSignals.hasSaaSTerms || html.includes('saas') || html.includes('software as a service'),
    hasB2B: html.includes('b2b') || html.includes('for businesses') || html.includes('for teams'),
    hasAPI: detectedSignals.hasAPIDocumentation || html.includes('api') || html.includes('developer'),
    hasFreeTrial: detectedSignals.hasFreeTrial || html.includes('free trial') || html.includes('start free'),
    hasDemo: detectedSignals.hasDemoRequest || html.includes('book demo') || html.includes('request demo') || html.includes('schedule demo'),
    hasPricing: detectedSignals.hasPricingTables || html.includes('pricing') || html.includes('plans'),
    hasPlatform: html.includes('platform') || html.includes('dashboard') || html.includes('workspace'),
    hasIntegrations: html.includes('integration') || html.includes('connect with'),
  };

  const b2bSaasScore = Object.values(b2bSaasSignals).filter(Boolean).length;

  if (businessType === 'unknown' && b2bSaasScore >= 3) {
    businessType = 'b2b-saas';
    notes.push(`Detected B2B SaaS (${b2bSaasScore} signals)`);
    if (b2bSaasSignals.hasSaaS) notes.push('Detected SaaS terminology');
    if (b2bSaasSignals.hasB2B) notes.push('Detected B2B focus');
    if (b2bSaasSignals.hasDemo) notes.push('Detected demo request flow');
    confidence = 'high';
  }

  // 4. B2C SAAS DETECTION
  const b2cSaasSignals = {
    hasSaaS: b2bSaasSignals.hasSaaS,
    hasFreeTrial: b2bSaasSignals.hasFreeTrial,
    hasConsumerFocus: html.includes('for you') || html.includes('personal') || html.includes('individual'),
    hasAppStore: html.includes('app store') || html.includes('google play'),
    hasMobileApp: html.includes('download app') || html.includes('mobile app'),
  };

  const b2cSaasScore = Object.values(b2cSaasSignals).filter(Boolean).length;

  if (businessType === 'unknown' && b2cSaasScore >= 2 && !b2bSaasSignals.hasB2B) {
    businessType = 'b2c-saas';
    notes.push(`Detected B2C SaaS (${b2cSaasScore} signals)`);
    if (b2cSaasSignals.hasConsumerFocus) notes.push('Detected consumer focus');
    confidence = 'medium';
  }

  // 5. B2B SERVICES DETECTION
  const b2bServicesSignals = {
    hasConsulting: html.includes('consulting') || html.includes('consultant'),
    hasAgency: html.includes('agency') || html.includes('we help businesses'),
    hasServices: html.includes('services') || html.includes('solutions'),
    hasB2B: b2bSaasSignals.hasB2B,
    hasCaseStudies: detectedSignals.hasCaseStudies || html.includes('case stud') || html.includes('client'),
    hasExpertise: html.includes('expertise') || html.includes('expert') || html.includes('specialist'),
  };

  const b2bServicesScore = Object.values(b2bServicesSignals).filter(Boolean).length;

  if (businessType === 'unknown' && b2bServicesScore >= 3 && !ecommerceSignals.hasCart) {
    businessType = 'b2b-services';
    notes.push(`Detected B2B services (${b2bServicesScore} signals)`);
    if (b2bServicesSignals.hasConsulting) notes.push('Detected consulting services');
    if (b2bServicesSignals.hasAgency) notes.push('Detected agency terminology');
    confidence = 'medium';
  }

  // 6. B2C SERVICES DETECTION
  const b2cServicesSignals = {
    hasCoaching: html.includes('coaching') || html.includes('coach'),
    hasTraining: html.includes('training') || html.includes('lessons'),
    hasBooking: html.includes('book now') || html.includes('schedule') || html.includes('appointment'),
    hasPersonal: html.includes('personal') || html.includes('individual'),
  };

  const b2cServicesScore = Object.values(b2cServicesSignals).filter(Boolean).length;

  if (businessType === 'unknown' && b2cServicesScore >= 2) {
    businessType = 'b2c-services';
    notes.push(`Detected B2C services (${b2cServicesScore} signals)`);
    if (b2cServicesSignals.hasCoaching) notes.push('Detected coaching services');
    confidence = 'medium';
  }

  // 7. NONPROFIT DETECTION
  const nonprofitSignals = {
    hasDonate: html.includes('donate') || html.includes('donation') || html.includes('give'),
    has501c3: html.includes('501(c)(3)') || html.includes('nonprofit') || html.includes('non-profit'),
    hasCharity: html.includes('charity') || html.includes('charitable'),
    hasMission: html.includes('mission') || html.includes('cause'),
  };

  const nonprofitScore = Object.values(nonprofitSignals).filter(Boolean).length;

  if (businessType === 'unknown' && nonprofitScore >= 2) {
    businessType = 'nonprofit';
    brandTier = 'nonprofit';
    notes.push(`Detected nonprofit organization (${nonprofitScore} signals)`);
    confidence = 'high';
  }

  // 8. PORTFOLIO DETECTION
  const portfolioSignals = {
    hasPortfolio: detectedSignals.hasPortfolio || html.includes('portfolio') || html.includes('my work'),
    hasProjects: html.includes('projects') || html.includes('case studies'),
    hasPersonal: html.includes('i\'m') || html.includes('my name is') || html.includes('about me'),
    hasCreative: html.includes('designer') || html.includes('developer') || html.includes('photographer'),
  };

  const portfolioScore = Object.values(portfolioSignals).filter(Boolean).length;

  if (businessType === 'unknown' && portfolioScore >= 2) {
    businessType = 'portfolio';
    notes.push(`Detected personal portfolio (${portfolioScore} signals)`);
    confidence = 'medium';
  }

  // 9. MEDIA DETECTION
  const mediaSignals = {
    hasArticles: detectedSignals.hasNewsArticles || html.includes('article') || html.includes('news'),
    hasBlog: detectedSignals.hasBlog,
    hasPublisher: html.includes('publish') || html.includes('magazine') || html.includes('journal'),
    hasSubscribe: html.includes('subscribe') || html.includes('newsletter'),
  };

  const mediaScore = Object.values(mediaSignals).filter(Boolean).length;

  if (businessType === 'unknown' && mediaScore >= 2) {
    businessType = 'media';
    notes.push(`Detected media publisher (${mediaScore} signals)`);
    confidence = 'medium';
  }

  // ============================================================================
  // BRAND TIER REFINEMENT (if not already set)
  // ============================================================================

  if (brandTier === 'other' && businessType === 'local-consumer') {
    brandTier = 'local_business';
    notes.push('Classified as local_business tier based on local-consumer type');
  }

  if (brandTier === 'other' && businessType === 'nonprofit') {
    brandTier = 'nonprofit';
  }

  if (brandTier === 'other') {
    // Use simple heuristics for tier (can be refined later)
    const domain = domainLower;
    const hasComplexSite = html.length > 50000; // Large, complex sites
    const hasProfessionalDesign = html.includes('professional') || html.includes('enterprise');

    if (hasComplexSite && hasProfessionalDesign) {
      brandTier = 'enterprise';
    } else if (businessType === 'b2b-saas' || businessType === 'b2c-saas') {
      brandTier = 'startup'; // Default for SaaS
    } else {
      brandTier = 'smb'; // Default for most businesses
    }
  }

  // ============================================================================
  // CONFIDENCE ADJUSTMENT
  // ============================================================================

  if (businessType === 'unknown') {
    confidence = 'low';
    notes.push('Unable to determine business type with confidence - using generic recommendations');
  }

  // ============================================================================
  // DERIVED SIGNALS
  // ============================================================================

  const signals = {
    isLocal: businessType === 'local-consumer' || localScore >= 2,
    isB2B: businessType === 'b2b-saas' || businessType === 'b2b-services',
    isB2C: businessType === 'local-consumer' || businessType === 'b2c-saas' ||
           businessType === 'b2c-services' || businessType === 'ecommerce',
    isSaaS: businessType === 'b2b-saas' || businessType === 'b2c-saas',
    isEcommerce: businessType === 'ecommerce',
    hasPhysicalLocation: localSignals.hasAddress || localSignals.hasMap || localScore >= 2,
  };

  return {
    businessType,
    brandTier,
    confidence,
    notes,
    signals,
  };
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Log business context (for development/debugging)
 */
export function logBusinessContext(context: BusinessContext, url: string): void {
  console.log('[business-context] ═══════════════════════════════════');
  console.log(`[business-context] URL: ${url}`);
  console.log(`[business-context] Business Type: ${context.businessType}`);
  console.log(`[business-context] Brand Tier: ${context.brandTier}`);
  console.log(`[business-context] Confidence: ${context.confidence}`);
  console.log('[business-context] Signals:');
  console.log(`  - isLocal: ${context.signals.isLocal}`);
  console.log(`  - isB2B: ${context.signals.isB2B}`);
  console.log(`  - isB2C: ${context.signals.isB2C}`);
  console.log(`  - isSaaS: ${context.signals.isSaaS}`);
  console.log(`  - isEcommerce: ${context.signals.isEcommerce}`);
  console.log(`  - hasPhysicalLocation: ${context.signals.hasPhysicalLocation}`);
  console.log('[business-context] Notes:');
  context.notes.forEach((note) => console.log(`  - ${note}`));
  console.log('[business-context] ═══════════════════════════════════');
}
