/**
 * CTA (Call-to-Action) Heuristics
 *
 * Lightweight intelligence layer that:
 * - Detects primary CTAs from HTML
 * - Classifies CTA types and quality
 * - Identifies friction points
 * - Provides recommendations
 *
 * Never throws - always returns safe defaults
 */

export type CtaType =
  | 'book_call'
  | 'contact'
  | 'shop'
  | 'signup'
  | 'learn_more'
  | 'other';

export type ClarityLevel = 'clear' | 'moderate' | 'unclear';
export type ProminenceLevel = 'prominent' | 'buried' | 'missing';

export interface CtaHeuristicsInput {
  htmlSnippet: string;
  url: string;
}

export interface CtaHeuristicsOutput {
  primaryCtaText: string | null;
  primaryCtaType: CtaType | null;
  clarityLevel: ClarityLevel;
  prominenceLevel: ProminenceLevel;
  frictionFlags: string[];
  recommendedPrimaryCta: string;
}

/**
 * CTA phrase patterns for detection
 */
const CTA_PATTERNS = {
  book_call: [
    /book\s+(a\s+)?(call|demo|consultation|meeting|session)/i,
    /schedule\s+(a\s+)?(call|demo|consultation|meeting)/i,
    /request\s+(a\s+)?(call|demo|consultation)/i,
    /talk\s+to\s+(us|sales|an?\s+expert)/i,
  ],
  contact: [
    /contact\s+(us|me|sales)/i,
    /get\s+in\s+touch/i,
    /reach\s+out/i,
    /send\s+(us\s+)?a\s+message/i,
  ],
  shop: [
    /shop\s+(now|the\s+collection|all)/i,
    /buy\s+now/i,
    /add\s+to\s+(cart|bag)/i,
    /view\s+products?/i,
  ],
  signup: [
    /sign\s+up/i,
    /get\s+started/i,
    /create\s+(an?\s+)?account/i,
    /join\s+(now|free|us)/i,
    /start\s+(free\s+)?trial/i,
    /try\s+(it\s+)?free/i,
  ],
  learn_more: [
    /learn\s+more/i,
    /read\s+more/i,
    /discover/i,
    /explore/i,
    /find\s+out/i,
  ],
};

/**
 * Extract candidate CTA texts from HTML
 */
function extractCtaCandidates(html: string): Array<{ text: string; position: number }> {
  const candidates: Array<{ text: string; position: number }> = [];

  // Extract from <a> tags
  const linkRegex = /<a[^>]*>([^<]+)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const text = match[1].trim();
    if (text && text.length < 100 && text.length > 2) {
      candidates.push({
        text: text.replace(/\s+/g, ' '),
        position: match.index,
      });
    }
  }

  // Extract from <button> tags
  const buttonRegex = /<button[^>]*>([^<]+)<\/button>/gi;
  while ((match = buttonRegex.exec(html)) !== null) {
    const text = match[1].trim();
    if (text && text.length < 100 && text.length > 2) {
      candidates.push({
        text: text.replace(/\s+/g, ' '),
        position: match.index,
      });
    }
  }

  // Extract from input submit buttons
  const submitRegex = /<input[^>]*type=["']submit["'][^>]*value=["']([^"']+)["'][^>]*>/gi;
  while ((match = submitRegex.exec(html)) !== null) {
    const text = match[1].trim();
    if (text && text.length < 100 && text.length > 2) {
      candidates.push({
        text: text.replace(/\s+/g, ' '),
        position: match.index,
      });
    }
  }

  return candidates;
}

/**
 * Classify CTA type based on text content
 */
function classifyCtaType(text: string): CtaType {
  // Check each pattern group
  for (const [type, patterns] of Object.entries(CTA_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return type as CtaType;
      }
    }
  }

  // Default to 'other'
  return 'other';
}

/**
 * Score a CTA candidate for ranking
 * Higher score = better primary CTA candidate
 */
function scoreCtaCandidate(candidate: { text: string; position: number }, htmlLength: number): number {
  let score = 0;

  // Prefer earlier positions (up to +50 points)
  const positionScore = Math.max(0, 50 - (candidate.position / htmlLength) * 50);
  score += positionScore;

  // Prefer action verbs (+30 points)
  const actionVerbs = /\b(book|schedule|get|start|request|buy|shop|join|sign|create|try)\b/i;
  if (actionVerbs.test(candidate.text)) {
    score += 30;
  }

  // Prefer specific over generic (+20 points)
  const specificPhrases = /\b(call|demo|started|account|trial|quote|consultation)\b/i;
  if (specificPhrases.test(candidate.text)) {
    score += 20;
  }

  // Penalize generic phrases (-20 points)
  const genericPhrases = /\b(click here|submit|more|read more)\b/i;
  if (genericPhrases.test(candidate.text)) {
    score -= 20;
  }

  // Penalize very short CTAs (-10 points)
  if (candidate.text.length < 8) {
    score -= 10;
  }

  return score;
}

/**
 * Determine clarity level based on CTA text and type
 */
function determineClarityLevel(text: string | null, type: CtaType | null): ClarityLevel {
  if (!text) return 'unclear';

  // Clear: concrete next step with action verb
  const clearPatterns = /\b(book|schedule|get|start|request|buy|create)\b/i;
  if (clearPatterns.test(text) && type !== 'learn_more') {
    return 'clear';
  }

  // Moderate: somewhat vague but recognizable
  if (type === 'learn_more' || /\b(discover|explore|find out)\b/i.test(text)) {
    return 'moderate';
  }

  // Unclear: very generic
  if (/\b(click here|submit|more)\b/i.test(text)) {
    return 'unclear';
  }

  return 'moderate';
}

/**
 * Determine prominence level based on position
 */
function determineProminenceLevel(
  candidates: Array<{ text: string; position: number }>,
  primaryPosition: number | null,
  htmlLength: number
): ProminenceLevel {
  if (primaryPosition === null || candidates.length === 0) {
    return 'missing';
  }

  // Above the fold = first ~2000 characters or first 20% of content
  const aboveFoldThreshold = Math.min(2000, htmlLength * 0.2);

  if (primaryPosition < aboveFoldThreshold) {
    return 'prominent';
  }

  return 'buried';
}

/**
 * Identify friction flags
 */
function identifyFrictionFlags(
  candidates: Array<{ text: string; position: number }>,
  primaryCta: { text: string; position: number } | null,
  primaryType: CtaType | null,
  htmlLength: number
): string[] {
  const flags: string[] = [];

  const aboveFoldThreshold = Math.min(2000, htmlLength * 0.2);

  // No CTA above the fold
  const hasCtaAboveFold = candidates.some((c) => c.position < aboveFoldThreshold);
  if (!hasCtaAboveFold) {
    flags.push('No CTA above the fold');
  }

  // Multiple competing CTAs
  const uniqueTypes = new Set(
    candidates.slice(0, 5).map((c) => classifyCtaType(c.text))
  );
  if (uniqueTypes.size > 3) {
    flags.push('Multiple competing CTAs');
  }

  // CTA is vague
  if (primaryType === 'learn_more' || primaryType === 'other') {
    if (primaryCta && /\b(click here|submit|more)\b/i.test(primaryCta.text)) {
      flags.push('CTA is vague');
    }
  }

  // No clear primary CTA
  if (!primaryCta) {
    flags.push('No clear primary CTA');
  }

  return flags;
}

/**
 * Generate recommended primary CTA based on type
 */
function generateRecommendedCta(type: CtaType | null, url: string): string {
  // Try to infer site type from URL
  const isEcommerce = /shop|store|buy|cart/i.test(url);
  const isSaas = /app|software|platform|tool/i.test(url);

  if (type === 'book_call') {
    return 'Book a strategy call';
  }

  if (type === 'contact') {
    return 'Talk to our team';
  }

  if (type === 'shop') {
    return 'Shop the collection';
  }

  if (type === 'signup') {
    return 'Get started in 2 minutes';
  }

  // Default recommendations based on site type
  if (isEcommerce) {
    return 'Shop now';
  }

  if (isSaas) {
    return 'Start your free trial';
  }

  // Default for service-type sites
  return 'Book a strategy call';
}

/**
 * Main CTA heuristics function
 *
 * Never throws - always returns safe defaults
 */
export function getCtaHeuristics(input: CtaHeuristicsInput): CtaHeuristicsOutput {
  try {
    const { htmlSnippet, url } = input;

    if (!htmlSnippet || htmlSnippet.length === 0) {
      // No HTML - return safe defaults
      return {
        primaryCtaText: null,
        primaryCtaType: null,
        clarityLevel: 'unclear',
        prominenceLevel: 'missing',
        frictionFlags: ['No HTML content available'],
        recommendedPrimaryCta: generateRecommendedCta(null, url),
      };
    }

    // Extract all CTA candidates
    const candidates = extractCtaCandidates(htmlSnippet);

    if (candidates.length === 0) {
      // No CTAs found
      return {
        primaryCtaText: null,
        primaryCtaType: null,
        clarityLevel: 'unclear',
        prominenceLevel: 'missing',
        frictionFlags: ['No clear primary CTA'],
        recommendedPrimaryCta: generateRecommendedCta(null, url),
      };
    }

    // Score and rank candidates
    const htmlLength = htmlSnippet.length;
    const scoredCandidates = candidates
      .map((c) => ({
        ...c,
        score: scoreCtaCandidate(c, htmlLength),
        type: classifyCtaType(c.text),
      }))
      .sort((a, b) => b.score - a.score);

    // Select primary CTA (highest scored)
    const primaryCta = scoredCandidates[0];

    // Determine metrics
    const clarityLevel = determineClarityLevel(primaryCta.text, primaryCta.type);
    const prominenceLevel = determineProminenceLevel(
      candidates,
      primaryCta.position,
      htmlLength
    );
    const frictionFlags = identifyFrictionFlags(
      candidates,
      primaryCta,
      primaryCta.type,
      htmlLength
    );
    const recommendedPrimaryCta = generateRecommendedCta(primaryCta.type, url);

    return {
      primaryCtaText: primaryCta.text,
      primaryCtaType: primaryCta.type,
      clarityLevel,
      prominenceLevel,
      frictionFlags,
      recommendedPrimaryCta,
    };
  } catch (error) {
    // Safety net - always return valid output
    console.error('[CTA Heuristics] Error:', error);
    return {
      primaryCtaText: null,
      primaryCtaType: null,
      clarityLevel: 'unclear',
      prominenceLevel: 'missing',
      frictionFlags: ['CTA detection failed'],
      recommendedPrimaryCta: generateRecommendedCta(null, input.url),
    };
  }
}

/**
 * Generate panel hints based on CTA analysis and general best practices
 *
 * These are lightweight, actionable suggestions for key page sections
 */
export function generatePanelHints(
  ctaInsights: CtaHeuristicsOutput,
  url: string
): {
  hero: string;
  nav: string;
  offer: string;
  proof: string;
  footer: string;
} {
  const hints = {
    hero: 'Clarify who you serve and the primary outcome in one sentence above the fold.',
    nav: 'Reduce navigation items to 5–7 and surface your primary CTA in the header.',
    offer: 'Make your core offer explicit with a short supporting paragraph and clear benefits.',
    proof: 'Surface 3–5 proof elements (logos, testimonials, metrics) above the fold.',
    footer: 'Repeat your primary CTA and add a low-commitment alternative (e.g., email signup).',
  };

  // Customize based on CTA insights
  if (ctaInsights.prominenceLevel === 'buried' || ctaInsights.prominenceLevel === 'missing') {
    hints.hero = `Place a clear CTA above the fold: "${ctaInsights.recommendedPrimaryCta}".`;
  }

  if (ctaInsights.clarityLevel === 'unclear' || ctaInsights.primaryCtaType === 'learn_more') {
    hints.nav = `Replace vague CTAs with a specific action: "${ctaInsights.recommendedPrimaryCta}".`;
  }

  if (ctaInsights.frictionFlags.includes('Multiple competing CTAs')) {
    hints.offer = 'Focus on ONE primary action. Remove or de-emphasize competing CTAs.';
  }

  return hints;
}
