// lib/gap-heavy/pageEvaluator.ts
// Standalone Page Evaluation Tool
//
// Evaluates a single web page for content quality, UX, and conversion optimization.
// Can be used standalone or integrated into Heavy Worker V4.

import axios from 'axios';
import * as cheerio from 'cheerio';
import type { CompanyRecord } from '@/lib/airtable/companies';
import type { PageEvaluationResult } from './types';
import type { Ga4Snapshot } from '@/lib/telemetry/ga4Client';

// ============================================================================
// Constants
// ============================================================================

// CTA keywords to look for in buttons/links
const CTA_KEYWORDS = [
  'book',
  'schedule',
  'get started',
  'start free',
  'try free',
  'contact',
  'demo',
  'learn more',
  'sign up',
  'request',
  'buy now',
  'get quote',
  'talk to',
  'speak to',
  'call us',
];

// Trust signal indicators
const TRUST_INDICATORS = [
  'testimonial',
  'review',
  'client',
  'partner',
  'logo',
  'case study',
  'success',
  'trusted by',
  'rating',
  'star',
];

// ============================================================================
// Main Page Evaluator
// ============================================================================

/**
 * Evaluate a single web page for content quality, UX, and conversion optimization
 *
 * @param input - Company, page URL, and optional GA4 snapshot
 * @returns Complete page evaluation with scores, issues, and recommendations
 */
export async function runPageEvaluator(input: {
  company: CompanyRecord;
  pageUrl: string;
  maybeGa4Snapshot?: Ga4Snapshot | null;
}): Promise<PageEvaluationResult> {
  console.log('[Page Evaluator] Evaluating page:', input.pageUrl);

  try {
    // ========================================================================
    // 1. Fetch and Parse HTML
    // ========================================================================

    const html = await fetchPageHtml(input.pageUrl);
    const $ = cheerio.load(html);

    // ========================================================================
    // 2. Extract Metadata and Content
    // ========================================================================

    const pageTitle = $('title').first().text().trim() || undefined;
    const metaDescription =
      $('meta[name="description"]').attr('content')?.trim() || undefined;
    const h1 = $('h1').first().text().trim() || undefined;

    // Extract hero text (approximate - look for large text blocks near top)
    const heroCopy = extractHeroCopy($);

    // Extract CTAs
    const { primaryCta, primaryCtaLocation, ctaCount, ctasNearTop } = extractCtas($);

    // Extract trust signals
    const trustSignals = extractTrustSignals($);

    // Count words in main content
    const wordCount = countWords($);

    // ========================================================================
    // 3. Compute Scores
    // ========================================================================

    const contentScore = computeContentScore({
      pageTitle,
      metaDescription,
      h1,
      wordCount,
      heroCopy,
    });

    const uxScore = computeUxScore({ $, h1, wordCount });

    const conversionScore = computeConversionScore({
      primaryCta,
      ctaCount,
      ctasNearTop,
      trustSignals,
    });

    // Overall score: weighted combination
    let overallScore = Math.round(
      conversionScore * 0.4 + contentScore * 0.3 + uxScore * 0.3
    );

    // ========================================================================
    // 3.5. GA4-Based Score Adjustment (if available)
    // ========================================================================

    const ga4Snapshot = extractGa4ForPage(input.pageUrl, input.maybeGa4Snapshot);

    // Penalize high-traffic pages with low/zero conversions
    if (ga4Snapshot) {
      const sessions = ga4Snapshot.sessions || 0;
      const conversions = ga4Snapshot.conversions || 0;

      // If sessions > 100 and conversions = 0, apply penalty
      if (sessions > 100 && conversions === 0) {
        overallScore = Math.max(0, overallScore - 10);
      }
      // If sessions > 50 and conversion rate < 1%, apply smaller penalty
      else if (sessions > 50 && conversions / sessions < 0.01) {
        overallScore = Math.max(0, overallScore - 5);
      }
    }

    // ========================================================================
    // 4. Generate Diagnostics
    // ========================================================================

    const contentDiagnostics = generateContentDiagnostics({
      pageTitle,
      metaDescription,
      h1,
      wordCount,
      heroCopy,
    });

    const uxDiagnostics = generateUxDiagnostics({ $, h1, wordCount });

    const conversionDiagnostics = generateConversionDiagnostics({
      primaryCta,
      ctaCount,
      ctasNearTop,
      trustSignals,
    });

    // ========================================================================
    // 5. Build Result
    // ========================================================================

    const result: PageEvaluationResult = {
      url: input.pageUrl,
      pageTitle,
      metaDescription,
      h1,
      contentScore,
      uxScore,
      conversionScore,
      overallScore,
      contentIssues: contentDiagnostics.issues,
      contentRecommendations: contentDiagnostics.recommendations,
      uxIssues: uxDiagnostics.issues,
      uxRecommendations: uxDiagnostics.recommendations,
      conversionIssues: conversionDiagnostics.issues,
      conversionRecommendations: conversionDiagnostics.recommendations,
      ga4Snapshot,
      raw: {
        heroCopy,
        primaryCtaText: primaryCta,
        primaryCtaLocation,
        trustSignals,
        wordCount,
      },
    };

    console.log('[Page Evaluator] Evaluation complete:', {
      url: input.pageUrl,
      overallScore,
      contentScore,
      uxScore,
      conversionScore,
    });

    return result;
  } catch (error) {
    console.error('[Page Evaluator] Error evaluating page:', error);

    // Return a minimal result with error state
    return {
      url: input.pageUrl,
      contentScore: 0,
      uxScore: 0,
      conversionScore: 0,
      overallScore: 0,
      contentIssues: ['Failed to fetch or parse page'],
      contentRecommendations: ['Verify page URL is accessible'],
      uxIssues: [],
      uxRecommendations: [],
      conversionIssues: [],
      conversionRecommendations: [],
      raw: {
        wordCount: 0,
      },
    };
  }
}

// ============================================================================
// Helper: Fetch Page HTML
// ============================================================================

async function fetchPageHtml(url: string): Promise<string> {
  const response = await axios.get(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; HiveMarketingBot/1.0; +https://hivemarketing.ai)',
    },
    timeout: 10000,
    maxRedirects: 5,
  });

  return response.data;
}

// ============================================================================
// Helper: Extract Hero Copy
// ============================================================================

function extractHeroCopy($: cheerio.CheerioAPI): string | undefined {
  // Look for common hero section selectors
  const heroSelectors = [
    'section:first-of-type',
    '[class*="hero"]',
    '[class*="banner"]',
    '[id*="hero"]',
    'header + section',
  ];

  for (const selector of heroSelectors) {
    const hero = $(selector).first();
    if (hero.length > 0) {
      const text = hero
        .find('p, h1, h2, div')
        .first()
        .text()
        .trim()
        .substring(0, 300);
      if (text.length > 20) {
        return text;
      }
    }
  }

  // Fallback: get first large paragraph
  const firstP = $('p')
    .filter((_, el) => $(el).text().trim().length > 50)
    .first()
    .text()
    .trim()
    .substring(0, 300);

  return firstP || undefined;
}

// ============================================================================
// Helper: Extract CTAs
// ============================================================================

type CtaLocation = 'hero' | 'nav' | 'footer' | 'inline' | 'unknown';

function extractCtas($: cheerio.CheerioAPI): {
  primaryCta: string | null;
  primaryCtaLocation: CtaLocation;
  ctaCount: number;
  ctasNearTop: boolean;
} {
  const ctas: { text: string; index: number; location: CtaLocation }[] = [];

  // Find all buttons and links that look like CTAs
  $('button, a.button, a.btn, a[class*="cta"], a[href*="contact"], a[href*="demo"]').each(
    (index, el) => {
      const text = $(el).text().trim().toLowerCase();
      const href = $(el).attr('href') || '';

      // Check if it matches CTA patterns
      const isCta =
        CTA_KEYWORDS.some((keyword) => text.includes(keyword)) ||
        href.includes('contact') ||
        href.includes('demo') ||
        href.includes('signup') ||
        href.includes('trial');

      if (isCta && text.length > 0 && text.length < 50) {
        // Determine location based on parent elements and position
        const location = detectCtaLocation($, $(el), index);
        ctas.push({ text: $(el).text().trim(), index, location });
      }
    }
  );

  // Determine if CTAs appear near top (within first 30% of elements)
  const totalElements = $('*').length;
  const ctasNearTop = ctas.some((cta) => cta.index < totalElements * 0.3);

  return {
    primaryCta: ctas.length > 0 ? ctas[0].text : null,
    primaryCtaLocation: ctas.length > 0 ? ctas[0].location : 'unknown',
    ctaCount: ctas.length,
    ctasNearTop,
  };
}

/**
 * Detect where a CTA is located on the page
 */
function detectCtaLocation(
  $: cheerio.CheerioAPI,
  element: cheerio.Cheerio<any>,
  index: number
): CtaLocation {
  // Check if in nav
  if (element.closest('nav, header, [class*="nav"], [class*="header"]').length > 0) {
    return 'nav';
  }

  // Check if in footer
  if (element.closest('footer, [class*="footer"]').length > 0) {
    return 'footer';
  }

  // Check if in hero section (common hero selectors or early in DOM)
  const totalElements = $('*').length;
  const isEarlyInDom = index < totalElements * 0.15; // First 15% of page

  if (
    element.closest('[class*="hero"], [class*="banner"], [id*="hero"]').length > 0 ||
    (isEarlyInDom && element.closest('section, div[class*="section"]').length > 0)
  ) {
    return 'hero';
  }

  // Check if in main content area (inline CTA)
  if (
    element.closest('main, article, [class*="content"], section').length > 0 &&
    !isEarlyInDom
  ) {
    return 'inline';
  }

  return 'unknown';
}

// ============================================================================
// Helper: Extract Trust Signals
// ============================================================================

function extractTrustSignals($: cheerio.CheerioAPI): string[] {
  const signals: string[] = [];

  // Look for elements with trust-related classes/text
  TRUST_INDICATORS.forEach((indicator) => {
    const elements = $(`[class*="${indicator}"], [id*="${indicator}"]`);
    if (elements.length > 0) {
      signals.push(`Found ${elements.length} ${indicator} element(s)`);
    }
  });

  // Look for testimonial-like quotes
  const quotes = $('blockquote, [class*="quote"]');
  if (quotes.length > 0) {
    signals.push(`${quotes.length} testimonial quote(s)`);
  }

  // Look for logo containers
  const logos = $('[class*="logo"]').find('img');
  if (logos.length > 3) {
    signals.push(`${logos.length} client/partner logos`);
  }

  // Look for star ratings
  const ratings = $('[class*="rating"], [class*="star"]');
  if (ratings.length > 0) {
    signals.push('Rating/review elements present');
  }

  return signals;
}

// ============================================================================
// Helper: Count Words
// ============================================================================

function countWords($: cheerio.CheerioAPI): number {
  // Get main content (exclude nav, footer, scripts)
  $('script, style, nav, footer, header').remove();

  const text = $('body').text();
  const words = text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  return words.length;
}

// ============================================================================
// Helper: Compute Content Score
// ============================================================================

function computeContentScore(params: {
  pageTitle?: string;
  metaDescription?: string;
  h1?: string;
  wordCount: number;
  heroCopy?: string;
}): number {
  let score = 100;

  // Title checks (20 points)
  if (!params.pageTitle) {
    score -= 20;
  } else if (params.pageTitle.length < 20) {
    score -= 10;
  } else if (params.pageTitle.length > 70) {
    score -= 5;
  }

  // Meta description checks (15 points)
  if (!params.metaDescription) {
    score -= 15;
  } else if (params.metaDescription.length < 50) {
    score -= 10;
  } else if (params.metaDescription.length > 160) {
    score -= 5;
  }

  // H1 checks (15 points)
  if (!params.h1) {
    score -= 15;
  } else if (params.h1.length < 10) {
    score -= 10;
  }

  // Word count checks (20 points)
  if (params.wordCount < 100) {
    score -= 20;
  } else if (params.wordCount < 300) {
    score -= 10;
  } else if (params.wordCount > 3000) {
    score -= 5; // Too much content
  }

  // Hero copy checks (10 points)
  if (!params.heroCopy || params.heroCopy.length < 30) {
    score -= 10;
  }

  // Clarity check (20 points) - simple heuristic
  const hasSpecificTerms =
    (params.pageTitle?.match(/\b(for|helps|platform|solution|service)\b/gi)
      ?.length || 0) > 0;
  if (!hasSpecificTerms) {
    score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

// ============================================================================
// Helper: Compute UX Score
// ============================================================================

function computeUxScore(params: {
  $: cheerio.CheerioAPI;
  h1?: string;
  wordCount: number;
}): number {
  const { $ } = params;
  let score = 100;

  // H1 presence (20 points)
  if (!params.h1) {
    score -= 20;
  }

  // Heading hierarchy (20 points)
  const h2Count = $('h2').length;
  const h3Count = $('h3').length;

  if (h2Count === 0) {
    score -= 15;
  } else if (h2Count < 2) {
    score -= 5;
  }

  if (h3Count === 0 && params.wordCount > 500) {
    score -= 5; // Missing H3s on longer pages
  }

  // Section structure (20 points)
  const sections = $('section, article, main').length;
  if (sections === 0) {
    score -= 10;
  } else if (sections < 2) {
    score -= 5;
  }

  // Visual breaks (15 points)
  const images = $('img').length;
  if (images === 0 && params.wordCount > 300) {
    score -= 15;
  } else if (images < 2 && params.wordCount > 800) {
    score -= 5;
  }

  // Navigation (15 points)
  const nav = $('nav').length;
  if (nav === 0) {
    score -= 15;
  }

  // Links (10 points)
  const links = $('a[href]').length;
  if (links < 5) {
    score -= 10;
  } else if (links > 100) {
    score -= 5; // Too many links
  }

  return Math.max(0, Math.min(100, score));
}

// ============================================================================
// Helper: Compute Conversion Score
// ============================================================================

function computeConversionScore(params: {
  primaryCta: string | null;
  ctaCount: number;
  ctasNearTop: boolean;
  trustSignals: string[];
}): number {
  let score = 100;

  // Primary CTA (30 points)
  if (!params.primaryCta) {
    score -= 30;
  }

  // CTA placement (20 points)
  if (!params.ctasNearTop) {
    score -= 20;
  } else if (params.ctaCount < 2) {
    score -= 10; // Only one CTA path
  }

  // Multiple CTAs (15 points)
  if (params.ctaCount === 0) {
    score -= 15;
  } else if (params.ctaCount === 1) {
    score -= 5;
  } else if (params.ctaCount > 10) {
    score -= 5; // Too many CTAs
  }

  // Trust signals (20 points)
  if (params.trustSignals.length === 0) {
    score -= 20;
  } else if (params.trustSignals.length < 2) {
    score -= 10;
  }

  // Contact path (15 points)
  const hasContactPath = params.primaryCta?.toLowerCase().includes('contact');
  if (!hasContactPath && params.ctaCount < 2) {
    score -= 15;
  }

  return Math.max(0, Math.min(100, score));
}

// ============================================================================
// Helper: Generate Content Diagnostics
// ============================================================================

function generateContentDiagnostics(params: {
  pageTitle?: string;
  metaDescription?: string;
  h1?: string;
  wordCount: number;
  heroCopy?: string;
}): { issues: string[]; recommendations: string[] } {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Title
  if (!params.pageTitle) {
    issues.push('Missing page title (<title> tag)');
    recommendations.push('Add a descriptive page title (50-60 characters)');
  } else if (params.pageTitle.length < 20) {
    issues.push('Page title is too short');
    recommendations.push('Expand page title to 50-60 characters for better SEO');
  } else if (params.pageTitle.length > 70) {
    issues.push('Page title is too long (will be truncated in search results)');
    recommendations.push('Shorten page title to 50-60 characters');
  }

  // Meta description
  if (!params.metaDescription) {
    issues.push('Missing meta description');
    recommendations.push(
      'Add a meta description (120-155 characters) to improve click-through rate'
    );
  } else if (params.metaDescription.length < 50) {
    issues.push('Meta description is too short');
    recommendations.push('Expand meta description to 120-155 characters');
  } else if (params.metaDescription.length > 160) {
    issues.push('Meta description is too long');
    recommendations.push('Shorten meta description to 120-155 characters');
  }

  // H1
  if (!params.h1) {
    issues.push('Missing H1 heading');
    recommendations.push(
      'Add a clear H1 heading that describes the page\'s main topic'
    );
  } else if (params.h1.length < 10) {
    issues.push('H1 heading is too short or generic');
    recommendations.push('Use a more descriptive H1 heading (20-70 characters)');
  }

  // Word count
  if (params.wordCount < 100) {
    issues.push('Very low word count - page may appear thin');
    recommendations.push(
      'Add more descriptive content (aim for at least 300 words for service pages)'
    );
  } else if (params.wordCount < 300) {
    issues.push('Low word count - could benefit from more detail');
    recommendations.push(
      'Expand content to better explain value proposition and benefits'
    );
  } else if (params.wordCount > 3000) {
    issues.push('Very high word count - may overwhelm visitors');
    recommendations.push(
      'Consider breaking content into multiple pages or adding clear sections'
    );
  }

  // Hero copy
  if (!params.heroCopy || params.heroCopy.length < 30) {
    issues.push('Weak or missing hero section copy');
    recommendations.push(
      'Add a clear, compelling hero message that explains what you offer'
    );
  }

  return { issues, recommendations };
}

// ============================================================================
// Helper: Generate UX Diagnostics
// ============================================================================

function generateUxDiagnostics(params: {
  $: cheerio.CheerioAPI;
  h1?: string;
  wordCount: number;
}): { issues: string[]; recommendations: string[] } {
  const { $ } = params;
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Heading structure
  const h2Count = $('h2').length;
  const h3Count = $('h3').length;

  if (!params.h1) {
    issues.push('No H1 heading found');
    recommendations.push('Add a primary H1 heading to establish page hierarchy');
  }

  if (h2Count === 0) {
    issues.push('No H2 headings found - poor content structure');
    recommendations.push(
      'Add H2 headings to break content into clear sections'
    );
  } else if (h2Count < 2 && params.wordCount > 500) {
    issues.push('Limited heading structure for amount of content');
    recommendations.push('Add more H2/H3 headings to improve scannability');
  }

  // Visual elements
  const images = $('img').length;
  if (images === 0 && params.wordCount > 300) {
    issues.push('No images found - page is text-heavy');
    recommendations.push(
      'Add relevant images to break up text and improve engagement'
    );
  }

  // Sections
  const sections = $('section, article, main').length;
  if (sections === 0) {
    issues.push('No clear section structure detected');
    recommendations.push(
      'Use semantic HTML (<section>, <article>) to structure content'
    );
  }

  // Navigation
  const nav = $('nav').length;
  if (nav === 0) {
    issues.push('No navigation element found');
    recommendations.push('Add a clear navigation menu for better user experience');
  }

  // Links
  const links = $('a[href]').length;
  if (links < 5) {
    issues.push('Very few internal/external links');
    recommendations.push('Add relevant links to improve navigation and SEO');
  } else if (links > 100) {
    issues.push('Excessive number of links may dilute page focus');
    recommendations.push('Review links and remove unnecessary ones');
  }

  return { issues, recommendations };
}

// ============================================================================
// Helper: Generate Conversion Diagnostics
// ============================================================================

function generateConversionDiagnostics(params: {
  primaryCta: string | null;
  ctaCount: number;
  ctasNearTop: boolean;
  trustSignals: string[];
}): { issues: string[]; recommendations: string[] } {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // CTA presence
  if (!params.primaryCta) {
    issues.push('No clear primary CTA found on page');
    recommendations.push(
      'Add a prominent call-to-action button (e.g., "Get Started", "Contact Us", "Book Demo")'
    );
  }

  // CTA placement
  if (params.ctaCount > 0 && !params.ctasNearTop) {
    issues.push('No CTA found above the fold');
    recommendations.push(
      'Place a primary CTA in the hero section for immediate visibility'
    );
  }

  // CTA quantity
  if (params.ctaCount === 0) {
    issues.push('No CTAs found anywhere on page');
    recommendations.push(
      'Add multiple CTAs throughout the page (hero, mid-content, footer)'
    );
  } else if (params.ctaCount === 1) {
    issues.push('Only one CTA found - limited conversion paths');
    recommendations.push(
      'Add secondary CTAs to provide multiple conversion opportunities'
    );
  } else if (params.ctaCount > 10) {
    issues.push('Too many CTAs may confuse or overwhelm visitors');
    recommendations.push(
      'Reduce to 2-3 clear CTAs with a single primary action'
    );
  }

  // Trust signals
  if (params.trustSignals.length === 0) {
    issues.push('No trust signals found (testimonials, logos, ratings)');
    recommendations.push(
      'Add social proof: client testimonials, partner logos, case studies, or ratings'
    );
  } else if (params.trustSignals.length < 2) {
    issues.push('Limited trust signals - could benefit from more social proof');
    recommendations.push(
      'Add additional trust elements: more testimonials, success metrics, or certifications'
    );
  }

  // Contact path
  const hasContactCta = params.primaryCta?.toLowerCase().includes('contact');
  if (!hasContactCta && params.ctaCount < 2) {
    issues.push('No clear contact path for potential customers');
    recommendations.push(
      'Add a "Contact Us" or "Talk to Sales" CTA for high-intent visitors'
    );
  }

  return { issues, recommendations };
}

// ============================================================================
// Helper: Extract GA4 Data for Page
// ============================================================================

function extractGa4ForPage(
  pageUrl: string,
  ga4Snapshot?: Ga4Snapshot | null
): PageEvaluationResult['ga4Snapshot'] {
  if (!ga4Snapshot?.pages) {
    return undefined;
  }

  // Extract path from URL
  const url = new URL(pageUrl);
  const pagePath = url.pathname;

  // Find matching page in GA4 data
  const pageData = ga4Snapshot.pages.find(
    (p) => p.pagePath === pagePath || p.pagePath === pagePath + '/'
  );

  if (!pageData) {
    return undefined;
  }

  return {
    sessions: pageData.sessions,
    engagedSessions: pageData.engagedSessions,
    engagementRate: pageData.engagementRate,
    conversions: pageData.conversions,
  };
}
