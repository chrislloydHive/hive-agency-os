// lib/gap/calibration.ts
// Score calibration for enterprise brands and category leaders

/**
 * Enterprise brands and category leaders that should have score floors
 * to prevent technical quirks from downgrading world-class marketing systems
 */
const ENTERPRISE_BRANDS = [
  'apple.com',
  'starbucks.com',
  'nike.com',
  'airbnb.com',
  'stripe.com',
  'shopify.com',
  'tesla.com',
  'microsoft.com',
  'google.com',
  'amazon.com',
  'meta.com',
  'facebook.com',
  'instagram.com',
  'netflix.com',
  'spotify.com',
  'uber.com',
  'slack.com',
  'zoom.us',
  'adobe.com',
  'oracle.com',
  'ibm.com',
  'intel.com',
  'cisco.com',
  'salesforce.com',
];

/**
 * Score floors for enterprise brands
 * These minimums ensure that technical limitations (HTML snippet size, JS rendering, etc.)
 * don't result in unrealistically low scores for proven marketing systems
 */
const ENTERPRISE_SCORE_FLOORS = {
  brand: 85,
  content: 70,
  website: 70,
  seo: 60,
  overall: 75,
};

/**
 * Check if a domain is an enterprise/category leader brand
 */
export function isEnterpriseBrand(domain: string): boolean {
  const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');
  return ENTERPRISE_BRANDS.some(brand =>
    normalizedDomain === brand || normalizedDomain.endsWith(`.${brand}`)
  );
}

/**
 * Apply score calibration based on brand tier
 *
 * @param domain - The website domain
 * @param scores - Raw scores from AI analysis
 * @returns Calibrated scores with metadata
 */
export function calibrateScores(domain: string, scores: {
  brand?: number;
  content?: number;
  website?: number;
  seo?: number;
  overall?: number;
  authority?: number;
}) {
  const isEnterprise = isEnterpriseBrand(domain);

  if (!isEnterprise) {
    return {
      calibrated: false,
      scores,
      reason: 'Not an enterprise brand - no calibration applied',
    };
  }

  // Apply floor to each score
  const floor = (val: number | undefined, min: number): number => {
    if (val === undefined || val === null) return min;
    return Math.max(val, min);
  };

  const calibratedScores = {
    brand: floor(scores.brand, ENTERPRISE_SCORE_FLOORS.brand),
    content: floor(scores.content, ENTERPRISE_SCORE_FLOORS.content),
    website: floor(scores.website, ENTERPRISE_SCORE_FLOORS.website),
    seo: floor(scores.seo, ENTERPRISE_SCORE_FLOORS.seo),
    overall: floor(scores.overall, ENTERPRISE_SCORE_FLOORS.overall),
    authority: scores.authority, // No floor for authority - it's measured differently
  };

  return {
    calibrated: true,
    scores: calibratedScores,
    reason: `Enterprise brand (${domain}) - applied score floors to ensure accurate representation`,
    floors: ENTERPRISE_SCORE_FLOORS,
  };
}

/**
 * Get calibration context for logging/debugging
 */
export function getCalibrationContext(domain: string) {
  const isEnterprise = isEnterpriseBrand(domain);

  return {
    domain,
    isEnterprise,
    floors: isEnterprise ? ENTERPRISE_SCORE_FLOORS : null,
    brands: ENTERPRISE_BRANDS.length,
  };
}
