/**
 * GAP V2 Scoring Anchors & Calibration
 *
 * Provides consistent, benchmarked scoring for the Growth Acceleration Plan engine.
 * Prevents over-scoring weak sites and under-scoring category leaders.
 */

/**
 * Score anchor definitions - descriptive quality tiers for each category
 * These guide the LLM and provide normalization targets
 */
export const SCORE_ANCHORS = {
  overall: {
    95: "Industry-leading performance. Benchmark-caliber company (Apple, Tesla, Stripe, Airbnb).",
    85: "Excellent performance. Strong brand, site, and content execution.",
    70: "Solid with clear opportunities to refine foundation.",
    50: "Average. Foundational issues reduce impact.",
    30: "Underdeveloped. Significant friction points.",
  },
  brand: {
    90: "Category-defining brand. Instantly recognizable, consistent execution across all touchpoints.",
    75: "Strong brand identity. Clear positioning, professional execution, good market recognition.",
    60: "Developing brand. Basic identity established but inconsistent or generic in execution.",
    40: "Weak brand presence. Unclear positioning, minimal differentiation, inconsistent presentation.",
    20: "No meaningful brand. Generic or confusing identity, no clear market position.",
  },
  content: {
    90: "Exceptional content strategy. Highly relevant, engaging, optimized for both users and search.",
    75: "Strong content. Good quality, regular updates, clear value proposition and messaging.",
    60: "Adequate content. Basic information present but could be more compelling or comprehensive.",
    40: "Poor content. Minimal information, outdated, or fails to communicate value effectively.",
    20: "Severely lacking content. Almost no useful information or extremely low quality.",
  },
  website: {
    90: "World-class website. Fast, intuitive, mobile-optimized, excellent UX/UI, modern design.",
    75: "Professional website. Good performance, clear navigation, responsive, solid user experience.",
    60: "Functional website. Works but has usability issues, design inconsistencies, or performance problems.",
    40: "Poor website. Difficult to use, slow, broken elements, confusing navigation, outdated design.",
    20: "Severely broken website. Major functionality issues, unusable on mobile, critical UX failures.",
  },
  technical: {
    90: "Excellent technical foundation. Fast page loads, clean code, proper SEO implementation, secure.",
    75: "Solid technical setup. Good performance, proper meta tags, mobile-friendly, no major issues.",
    60: "Adequate technical implementation. Some optimization needed, minor technical SEO gaps.",
    40: "Poor technical foundation. Slow loading, missing SEO basics, mobile issues, technical debt.",
    20: "Critical technical problems. Broken functionality, severe performance issues, major SEO gaps.",
  },
  authority: {
    90: "Industry authority. Strong backlink profile, high domain authority, recognized thought leader.",
    75: "Good authority. Quality backlinks, growing domain authority, some industry recognition.",
    60: "Building authority. Some backlinks and mentions, but limited industry presence.",
    40: "Weak authority. Few quality backlinks, minimal online presence beyond owned properties.",
    20: "No authority. Almost no backlinks, no industry recognition, no third-party validation.",
  },
  seo: {
    90: "SEO excellence. Strong rankings for target keywords, comprehensive optimization, authoritative.",
    75: "Good SEO. Ranking for relevant terms, proper technical SEO, quality content strategy.",
    60: "Basic SEO. Some rankings, fundamentals in place, but missing optimization opportunities.",
    40: "Poor SEO. Weak rankings, missing basics, significant optimization gaps.",
    20: "No effective SEO. Not ranking for relevant terms, major technical and content issues.",
  },
} as const;

/**
 * Known category leaders - used for score calibration
 * These companies should score 90+ unless data indicates otherwise
 */
export const CATEGORY_LEADERS = [
  'apple.com',
  'tesla.com',
  'airbnb.com',
  'stripe.com',
  'shopify.com',
  'spotify.com',
  'netflix.com',
  'amazon.com',
  'google.com',
  'microsoft.com',
  'hubspot.com',
  'salesforce.com',
  'adobe.com',
] as const;

/**
 * Anchor normalization targets
 * Raw scores get nudged toward these values for consistency
 */
const ANCHOR_TARGETS = [95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25, 20];

/**
 * Snap a score to the nearest anchor target
 * Reduces scoring noise and creates consistent tiers
 */
function snapToAnchor(score: number): number {
  // Find closest anchor
  let closest = ANCHOR_TARGETS[0];
  let minDiff = Math.abs(score - closest);

  for (const target of ANCHOR_TARGETS) {
    const diff = Math.abs(score - target);
    if (diff < minDiff) {
      minDiff = diff;
      closest = target;
    }
  }

  return closest;
}

/**
 * Calibrate a single score with all scoring rules applied
 *
 * @param raw - Raw score from LLM (0-100)
 * @param opts - Calibration options
 * @returns Calibrated score (0-100)
 */
export function calibrateScore(
  raw: number | undefined | null,
  opts: {
    snapshot?: number;
    domainAuthority?: number;
    isCategoryLeader?: boolean;
  } = {}
): number {
  // 2.1 Clean Input - Convert invalid → 50, clamp 0-100
  let score: number;
  if (typeof raw !== 'number' || Number.isNaN(raw) || raw === null || raw === undefined) {
    score = 50;
  } else {
    score = Math.max(0, Math.min(100, raw));
  }

  // 2.2 Adjust for Category Leaders
  // Leaders should score minimum 88, unless snapshot indicates otherwise
  if (opts.isCategoryLeader === true) {
    // Only enforce minimum if snapshot isn't also very low
    const snapshotIsLow = typeof opts.snapshot === 'number' && opts.snapshot < 60;
    if (!snapshotIsLow) {
      score = Math.max(score, 88);
      // Smooth toward 90-98 range
      if (score < 90) {
        score = 88 + (score - 88) * 0.5; // Pull toward 90
      }
    }
  }

  // 2.3 Blend with Snapshot Scores (70% LLM + 30% snapshot)
  if (typeof opts.snapshot === 'number' && !Number.isNaN(opts.snapshot)) {
    const snapshotClamped = Math.max(0, Math.min(100, opts.snapshot));
    score = score * 0.7 + snapshotClamped * 0.3;
  }

  // 2.4 Avoid Over-Scoring Weak Sites
  // If snapshot < 40, cap final score at 60
  if (typeof opts.snapshot === 'number' && opts.snapshot < 40) {
    score = Math.min(score, 60);
  }

  // Round before snapping
  score = Math.round(score);

  // 2.5 Normalize to Anchor Buckets
  score = snapToAnchor(score);

  return score;
}

/**
 * Check if a domain is a known category leader
 */
export function isCategoryLeader(domain: string): boolean {
  const normalized = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '');
  return CATEGORY_LEADERS.some(leader => normalized.includes(leader));
}
