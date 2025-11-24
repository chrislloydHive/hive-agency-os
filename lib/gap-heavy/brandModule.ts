// lib/gap-heavy/brandModule.ts
// Brand & Positioning Diagnostic Module
//
// Evaluates brand clarity, positioning, differentiation, and trust signals

import axios from 'axios';
import * as cheerio from 'cheerio';
import type { CompanyRecord } from '@/lib/airtable/companies';
import type {
  DiagnosticModuleResult,
  EvidencePack,
  BrandEvidence,
} from './types';

// ============================================================================
// Main Brand Module
// ============================================================================

/**
 * Run Brand & Positioning diagnostic module
 *
 * Analyzes homepage (and optionally About/Solutions pages) to evaluate:
 * - Value proposition clarity
 * - Audience/ICP clarity
 * - Differentiation
 * - Trust signals / social proof
 * - Tone & personality
 * - Overall brand strength
 *
 * @param input - Company, website URL, and evidence pack
 * @returns Diagnostic module result with brand score and evidence
 */
export async function runBrandModule(input: {
  company: CompanyRecord;
  websiteUrl: string;
  evidence: EvidencePack;
}): Promise<DiagnosticModuleResult> {
  console.log('[Brand Module] Starting brand analysis for:', input.websiteUrl);

  const startTime = Date.now();

  try {
    // ========================================================================
    // 1. Fetch and Parse Pages
    // ========================================================================

    const homepageHtml = await fetchPageHtml(input.websiteUrl);
    const $homepage = cheerio.load(homepageHtml);

    // Optionally fetch About/Solutions pages (best effort)
    const aboutPage = await tryFetchAboutPage(input.websiteUrl);
    const solutionsPage = await tryFetchSolutionsPage(input.websiteUrl);

    // ========================================================================
    // 2. Extract Brand Signals
    // ========================================================================

    const signals = extractBrandSignals($homepage, aboutPage, solutionsPage);

    // ========================================================================
    // 3. Compute Brand Score
    // ========================================================================

    const brandScore = computeBrandScore(signals);

    // ========================================================================
    // 4. Build Brand Evidence
    // ========================================================================

    // ========================================================================
    // Extract Raw Snippets for Grounding
    // ========================================================================

    const rawSnippets = {
      heroText: extractHeroSnippet($homepage),
      aboutSnippet: aboutPage ? extractAboutSnippet(aboutPage) : undefined,
      solutionsSnippet: solutionsPage ? extractSolutionsSnippet(solutionsPage) : undefined,
    };

    const brandEvidence: BrandEvidence = {
      primaryTagline: signals.heroH1,
      supportingSubheadline: signals.heroSubhead,
      valuePropositionSummary: signals.valuePropositionSummary,
      audienceClarityLevel: determineAudienceClarityLevel(signals),
      differentiationLevel: determineDifferentiationLevel(signals),
      toneDescriptors: signals.toneDescriptors,
      trustSignalsPresent: signals.trustSignals.length > 0,
      trustSignalsExamples: signals.trustSignals,
      socialProofDensity: determineSocialProofDensity(signals),
      visualConsistencyHints: signals.visualConsistencyHints,
      competitorOverlapNotes: '', // TODO: Wire competitor data when available
      rawSnippets,
    };

    // Write to evidence pack
    input.evidence.brand = brandEvidence;

    // ========================================================================
    // 5. Generate Diagnostics
    // ========================================================================

    const diagnostics = generateBrandDiagnostics(signals, brandScore);

    // ========================================================================
    // 6. Build Module Result
    // ========================================================================

    const result: DiagnosticModuleResult = {
      module: 'brand',
      status: 'completed',
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      score: brandScore,
      summary: diagnostics.summary,
      issues: diagnostics.issues,
      recommendations: diagnostics.recommendations,
      rawEvidence: signals,
    };

    console.log('[Brand Module] Analysis complete:', {
      score: brandScore,
      duration: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    console.error('[Brand Module] Error during analysis:', error);

    // Return failed result
    return {
      module: 'brand',
      status: 'failed',
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      score: 0,
      summary: 'Failed to analyze brand positioning. Unable to fetch or parse homepage.',
      issues: ['Homepage could not be accessed for brand analysis'],
      recommendations: ['Verify website URL is accessible and try again'],
    };
  }
}

// ============================================================================
// Helper: Fetch Page HTML
// ============================================================================

async function fetchPageHtml(url: string): Promise<string> {
  const response = await axios.get(url, {
    timeout: 10000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; HiveBot/1.0; +https://hivegrowth.io)',
    },
    maxRedirects: 5,
  });

  return response.data;
}

// ============================================================================
// Helper: Try Fetch About Page
// ============================================================================

async function tryFetchAboutPage(
  baseUrl: string
): Promise<cheerio.CheerioAPI | null> {
  const aboutPaths = ['/about', '/about-us', '/company', '/who-we-are'];

  for (const path of aboutPaths) {
    try {
      const url = new URL(path, baseUrl).toString();
      const html = await fetchPageHtml(url);
      return cheerio.load(html);
    } catch (e) {
      // Try next path
      continue;
    }
  }

  return null;
}

// ============================================================================
// Helper: Try Fetch Solutions Page
// ============================================================================

async function tryFetchSolutionsPage(
  baseUrl: string
): Promise<cheerio.CheerioAPI | null> {
  const solutionsPaths = [
    '/solutions',
    '/services',
    '/products',
    '/what-we-do',
  ];

  for (const path of solutionsPaths) {
    try {
      const url = new URL(path, baseUrl).toString();
      const html = await fetchPageHtml(url);
      return cheerio.load(html);
    } catch (e) {
      // Try next path
      continue;
    }
  }

  return null;
}

// ============================================================================
// Helper: Extract Brand Signals
// ============================================================================

interface BrandSignals {
  heroH1?: string;
  heroSubhead?: string;
  heroCopy?: string;
  valuePropositionSummary?: string;
  audienceLanguage: string[];
  valuePropositionBlocks: string[];
  trustSignals: string[];
  toneDescriptors: string[];
  visualConsistencyHints: string[];
  hasGenericLanguage: boolean;
  hasSpecificBenefits: boolean;
}

function extractBrandSignals(
  $homepage: cheerio.CheerioAPI,
  $about: cheerio.CheerioAPI | null,
  $solutions: cheerio.CheerioAPI | null
): BrandSignals {
  // Extract hero section elements
  const heroH1 = $homepage('h1').first().text().trim() || undefined;
  const heroSubhead = extractHeroSubhead($homepage);
  const heroCopy = extractHeroCopy($homepage);

  // Extract audience language
  const audienceLanguage = extractAudienceLanguage($homepage, $about);

  // Extract value proposition blocks
  const valuePropositionBlocks = extractValuePropBlocks($homepage);

  // Extract trust signals
  const trustSignals = extractTrustSignals($homepage);

  // Generate value proposition summary
  const valuePropositionSummary = generateValuePropSummary(
    heroH1,
    heroSubhead,
    heroCopy,
    valuePropositionBlocks
  );

  // Analyze tone
  const toneDescriptors = analyzeTone($homepage, heroCopy || '');

  // Check for generic vs specific language
  const hasGenericLanguage = detectGenericLanguage(heroH1, heroCopy || '');
  const hasSpecificBenefits = detectSpecificBenefits(
    valuePropositionBlocks.join(' ')
  );

  // Visual consistency hints
  const visualConsistencyHints = analyzeVisualConsistency($homepage);

  return {
    heroH1,
    heroSubhead,
    heroCopy,
    valuePropositionSummary,
    audienceLanguage,
    valuePropositionBlocks,
    trustSignals,
    toneDescriptors,
    visualConsistencyHints,
    hasGenericLanguage,
    hasSpecificBenefits,
  };
}

// ============================================================================
// Helper: Extract Hero Subhead
// ============================================================================

function extractHeroSubhead($: cheerio.CheerioAPI): string | undefined {
  // Look for common hero subhead selectors
  const selectors = [
    'h1 + p',
    'h1 + h2',
    '[class*="hero"] h2',
    '[class*="hero"] p:first-of-type',
    '[class*="banner"] h2',
    'header h2',
  ];

  for (const selector of selectors) {
    const text = $(selector).first().text().trim();
    if (text && text.length > 20 && text.length < 300) {
      return text;
    }
  }

  return undefined;
}

// ============================================================================
// Helper: Extract Hero Copy
// ============================================================================

function extractHeroCopy($: cheerio.CheerioAPI): string | undefined {
  // Get first 1-2 paragraphs near hero
  const heroSelectors = [
    '[class*="hero"] p',
    '[class*="banner"] p',
    'header p',
    'main > section:first-of-type p',
  ];

  for (const selector of heroSelectors) {
    const paragraphs = $(selector)
      .slice(0, 2)
      .map((_, el) => $(el).text().trim())
      .get()
      .filter((text) => text.length > 30);

    if (paragraphs.length > 0) {
      return paragraphs.join(' ');
    }
  }

  // Fallback: get first 2 paragraphs from body
  const fallback = $('p')
    .slice(0, 2)
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((text) => text.length > 30)
    .join(' ');

  return fallback || undefined;
}

// ============================================================================
// Helper: Extract Audience Language
// ============================================================================

function extractAudienceLanguage(
  $homepage: cheerio.CheerioAPI,
  $about: cheerio.CheerioAPI | null
): string[] {
  const audiencePatterns = [
    /for ([\w\s-]+(?:teams|companies|businesses|organizations|professionals|startups|enterprises))/gi,
    /designed for ([\w\s-]+)/gi,
    /built for ([\w\s-]+)/gi,
    /helping ([\w\s-]+(?:teams|companies|businesses))/gi,
    /trusted by ([\w\s-]+)/gi,
  ];

  const matches: string[] = [];
  const homepageText = $homepage('body').text();
  const aboutText = $about ? $about('body').text() : '';
  const combinedText = `${homepageText} ${aboutText}`;

  for (const pattern of audiencePatterns) {
    const found = combinedText.matchAll(pattern);
    for (const match of found) {
      if (match[1]) {
        matches.push(match[1].trim());
      }
    }
  }

  return [...new Set(matches)]; // Remove duplicates
}

// ============================================================================
// Helper: Extract Value Prop Blocks
// ============================================================================

function extractValuePropBlocks($: cheerio.CheerioAPI): string[] {
  const blocks: string[] = [];

  // Look for "Why [Brand]" or "What we do" sections
  const headings = $('h2, h3')
    .filter((_, el) => {
      const text = $(el).text().toLowerCase();
      return (
        text.includes('why') ||
        text.includes('what we do') ||
        text.includes('how it works') ||
        text.includes('benefits')
      );
    })
    .slice(0, 3);

  headings.each((_, heading) => {
    const $heading = $(heading);
    const nextParagraphs = $heading
      .nextAll('p, li')
      .slice(0, 3)
      .map((_, el) => $(el).text().trim())
      .get()
      .join(' ');

    if (nextParagraphs) {
      blocks.push(nextParagraphs);
    }
  });

  return blocks;
}

// ============================================================================
// Helper: Extract Trust Signals
// ============================================================================

function extractTrustSignals($: cheerio.CheerioAPI): string[] {
  const signals: string[] = [];

  // Customer logos
  const logoElements = $('[class*="logo"], [class*="client"], [class*="partner"]').find(
    'img'
  );
  if (logoElements.length >= 3) {
    signals.push(`${logoElements.length} customer/partner logos`);
  }

  // Testimonials
  const testimonials = $(
    '[class*="testimonial"], blockquote, [class*="review"]'
  );
  if (testimonials.length > 0) {
    signals.push(`${testimonials.length} testimonial(s)`);
  }

  // Case studies
  const caseStudies = $('a, div')
    .filter((_, el) => {
      const text = $(el).text().toLowerCase();
      return text.includes('case study') || text.includes('success story');
    })
    .length;
  if (caseStudies > 0) {
    signals.push(`${caseStudies} case study/success story reference(s)`);
  }

  // Awards/badges
  const awards = $('[class*="award"], [class*="badge"], [class*="certification"]');
  if (awards.length > 0) {
    signals.push(`${awards.length} award/badge/certification(s)`);
  }

  // Ratings
  const ratings = $('[class*="rating"], [class*="star"]');
  if (ratings.length > 0) {
    signals.push('Rating/review elements present');
  }

  return signals;
}

// ============================================================================
// Helper: Generate Value Prop Summary
// ============================================================================

function generateValuePropSummary(
  heroH1?: string,
  heroSubhead?: string,
  heroCopy?: string,
  valuePropositionBlocks?: string[]
): string {
  // Simple heuristic-based summary (no LLM for now)
  const parts: string[] = [];

  if (heroH1) {
    parts.push(heroH1);
  }

  if (heroSubhead && heroSubhead !== heroH1) {
    parts.push(heroSubhead);
  }

  if (parts.length === 0 && heroCopy) {
    parts.push(heroCopy.substring(0, 200));
  }

  const summary = parts.join('. ').substring(0, 300);

  // If still empty, use a generic fallback
  if (!summary) {
    return 'Value proposition could not be determined from homepage content.';
  }

  return summary;
}

// ============================================================================
// Helper: Analyze Tone
// ============================================================================

function analyzeTone($: cheerio.CheerioAPI, heroCopy: string): string[] {
  const toneIndicators = {
    playful: ['fun', 'easy', 'simple', 'love', 'enjoy', 'delightful'],
    premium: ['premium', 'elite', 'luxury', 'exclusive', 'sophisticated'],
    technical: [
      'advanced',
      'powerful',
      'robust',
      'scalable',
      'architecture',
      'infrastructure',
    ],
    friendly: ['friendly', 'team', 'together', 'community', 'support'],
    professional: [
      'professional',
      'enterprise',
      'business',
      'corporate',
      'solution',
    ],
    innovative: ['innovative', 'cutting-edge', 'modern', 'next-generation'],
  };

  const bodyText = ($('body').text() + ' ' + heroCopy).toLowerCase();
  const tones: string[] = [];

  for (const [tone, keywords] of Object.entries(toneIndicators)) {
    const matches = keywords.filter((keyword) => bodyText.includes(keyword));
    if (matches.length >= 2) {
      tones.push(tone);
    }
  }

  return tones.length > 0 ? tones.slice(0, 5) : ['neutral'];
}

// ============================================================================
// Helper: Detect Generic Language
// ============================================================================

function detectGenericLanguage(
  heroH1: string | undefined,
  heroCopy: string
): boolean {
  const genericPhrases = [
    'innovative solutions',
    'driving growth',
    'world-class',
    'industry-leading',
    'cutting-edge technology',
    'transforming businesses',
    'empowering teams',
    'revolutionizing',
    'game-changing',
    'next-generation platform',
  ];

  const combinedText = `${heroH1 || ''} ${heroCopy}`.toLowerCase();

  return genericPhrases.some((phrase) => combinedText.includes(phrase));
}

// ============================================================================
// Helper: Detect Specific Benefits
// ============================================================================

function detectSpecificBenefits(text: string): boolean {
  // Look for specific metrics, use cases, or concrete benefits
  const specificPatterns = [
    /\d+%/g, // Percentages
    /\d+x/g, // Multipliers
    /save \d+/gi, // Savings
    /increase \d+/gi, // Increases
    /reduce \d+/gi, // Reductions
    /specific|niche|specialized/gi,
  ];

  return specificPatterns.some((pattern) => pattern.test(text));
}

// ============================================================================
// Helper: Analyze Visual Consistency
// ============================================================================

function analyzeVisualConsistency($: cheerio.CheerioAPI): string[] {
  const hints: string[] = [];

  // Check for consistent class naming patterns
  const bodyClasses = $('body').attr('class') || '';
  if (bodyClasses.includes('brand') || bodyClasses.includes('theme')) {
    hints.push('Theme/brand classes detected on body element');
  }

  // Check for color consistency in nav, hero, CTAs
  const navBg = $('nav').attr('class') || '';
  const heroBg = $('[class*="hero"]').attr('class') || '';
  const ctaBg = $('button, [class*="cta"]').attr('class') || '';

  if (
    navBg.includes('bg-') &&
    heroBg.includes('bg-') &&
    ctaBg.includes('bg-')
  ) {
    hints.push('Consistent background color classes across nav, hero, and CTAs');
  }

  return hints;
}

// ============================================================================
// Helper: Extract Raw Snippets for Grounding
// ============================================================================

/**
 * Extract hero section text (H1 + surrounding copy)
 * Captures ~200-300 characters for grounding recommendations
 */
function extractHeroSnippet($: cheerio.CheerioAPI): string | undefined {
  const heroH1 = $('h1').first().text().trim();
  if (!heroH1) return undefined;

  // Get hero section container
  const heroSection = $('h1').first().closest('section, div, header');

  // Extract text from hero section (H1 + nearby paragraphs)
  const heroTexts: string[] = [heroH1];

  heroSection.find('p, h2').slice(0, 3).each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length > 20) {
      heroTexts.push(text);
    }
  });

  const combined = heroTexts.join(' ');

  // Truncate to ~300 chars
  return combined.length > 300 ? combined.slice(0, 300) + '...' : combined;
}

/**
 * Extract first paragraph(s) from About page
 * Captures ~250-350 characters
 */
function extractAboutSnippet($: cheerio.CheerioAPI): string | undefined {
  // Try to find main content area
  const mainSelectors = [
    'main p',
    '[class*="content"] p',
    '[class*="about"] p',
    'article p',
    'section p',
  ];

  for (const selector of mainSelectors) {
    const paragraphs: string[] = [];

    $(selector).slice(0, 2).each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 30) {
        paragraphs.push(text);
      }
    });

    if (paragraphs.length > 0) {
      const combined = paragraphs.join(' ');
      return combined.length > 350 ? combined.slice(0, 350) + '...' : combined;
    }
  }

  return undefined;
}

/**
 * Extract first paragraph(s) from Solutions/Services page
 * Captures ~250-350 characters
 */
function extractSolutionsSnippet($: cheerio.CheerioAPI): string | undefined {
  // Try to find solutions/services content
  const mainSelectors = [
    'main p',
    '[class*="content"] p',
    '[class*="solutions"] p',
    '[class*="services"] p',
    'article p',
    'section p',
  ];

  for (const selector of mainSelectors) {
    const paragraphs: string[] = [];

    $(selector).slice(0, 2).each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 30) {
        paragraphs.push(text);
      }
    });

    if (paragraphs.length > 0) {
      const combined = paragraphs.join(' ');
      return combined.length > 350 ? combined.slice(0, 350) + '...' : combined;
    }
  }

  return undefined;
}

// ============================================================================
// Helper: Determine Audience Clarity Level
// ============================================================================

function determineAudienceClarityLevel(
  signals: BrandSignals
): 'clear' | 'somewhat_clear' | 'unclear' {
  if (signals.audienceLanguage.length >= 2) {
    return 'clear';
  } else if (signals.audienceLanguage.length === 1) {
    return 'somewhat_clear';
  } else {
    return 'unclear';
  }
}

// ============================================================================
// Helper: Determine Differentiation Level
// ============================================================================

function determineDifferentiationLevel(
  signals: BrandSignals
): 'strong' | 'moderate' | 'weak' {
  if (signals.hasSpecificBenefits && !signals.hasGenericLanguage) {
    return 'strong';
  } else if (signals.hasSpecificBenefits || !signals.hasGenericLanguage) {
    return 'moderate';
  } else {
    return 'weak';
  }
}

// ============================================================================
// Helper: Determine Social Proof Density
// ============================================================================

function determineSocialProofDensity(
  signals: BrandSignals
): 'none' | 'light' | 'moderate' | 'heavy' {
  const count = signals.trustSignals.length;

  if (count === 0) return 'none';
  if (count === 1) return 'light';
  if (count <= 3) return 'moderate';
  return 'heavy';
}

// ============================================================================
// Helper: Compute Brand Score
// ============================================================================

function computeBrandScore(signals: BrandSignals): number {
  let score = 100;

  // Deductions
  if (!signals.heroH1 || signals.heroH1.length < 10) {
    score -= 15; // Missing or too short tagline
  }

  if (!signals.valuePropositionSummary || signals.valuePropositionSummary.includes('could not be determined')) {
    score -= 20; // Unclear value proposition
  }

  if (signals.audienceLanguage.length === 0) {
    score -= 15; // No audience indication
  }

  if (signals.trustSignals.length === 0) {
    score -= 15; // No social proof
  }

  if (signals.hasGenericLanguage) {
    score -= 10; // Generic corporate-speak
  }

  // Bonuses
  if (signals.hasSpecificBenefits) {
    score += 5; // Specific, measurable benefits
  }

  if (signals.audienceLanguage.length >= 2) {
    score += 5; // Clear ICP
  }

  if (signals.trustSignals.length >= 3) {
    score += 5; // Strong social proof
  }

  return Math.max(0, Math.min(100, score));
}

// ============================================================================
// Helper: Generate Brand Diagnostics
// ============================================================================

function generateBrandDiagnostics(
  signals: BrandSignals,
  brandScore: number
): {
  summary: string;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Summary
  const clarityLevel =
    brandScore >= 80 ? 'Strong' : brandScore >= 60 ? 'Moderate' : 'Weak';
  const summary = `${clarityLevel} brand positioning. ${
    signals.trustSignals.length > 0
      ? 'Trust signals are present.'
      : 'Limited social proof.'
  } ${
    signals.audienceLanguage.length > 0
      ? 'Audience is somewhat clear.'
      : 'Target audience is unclear.'
  }`;

  // Issues
  if (!signals.heroH1 || signals.heroH1.length < 10) {
    issues.push(
      'Hero tagline is missing or too short to convey value proposition'
    );
  }

  if (
    !signals.valuePropositionSummary ||
    signals.valuePropositionSummary.includes('could not be determined')
  ) {
    issues.push(
      'Homepage messaging does not clearly state what the product/service does'
    );
  }

  if (signals.audienceLanguage.length === 0) {
    issues.push(
      'No clear indication of who the product is for (target audience/ICP is unclear)'
    );
  }

  if (signals.trustSignals.length === 0) {
    issues.push(
      'No visible social proof (logos, testimonials, or case studies) on the homepage'
    );
  }

  if (signals.hasGenericLanguage) {
    issues.push(
      'Hero tagline and copy use generic language that could apply to many unrelated businesses'
    );
  }

  if (!signals.hasSpecificBenefits) {
    issues.push(
      'Benefits and value propositions lack specificity (no metrics, concrete outcomes, or niche focus)'
    );
  }

  // Recommendations
  if (issues.length === 0) {
    recommendations.push(
      'Brand positioning is strong—continue refining messaging based on customer feedback'
    );
  } else {
    if (!signals.heroH1 || signals.heroH1.length < 10) {
      recommendations.push(
        'Rewrite the hero H1 to clearly state what you offer and the primary benefit'
      );
    }

    if (signals.audienceLanguage.length === 0) {
      recommendations.push(
        'Add a "Who we serve" or "Built for" section above the fold to clarify target audience'
      );
    }

    if (signals.trustSignals.length === 0) {
      recommendations.push(
        'Add customer logos, testimonials, or case studies near the hero CTA to build trust'
      );
    }

    if (signals.hasGenericLanguage) {
      recommendations.push(
        'Replace generic phrases with specific, differentiated language that highlights unique value'
      );
    }

    if (!signals.hasSpecificBenefits) {
      recommendations.push(
        'Quantify benefits where possible (e.g., "Save 10 hours per week" instead of "Save time")'
      );
    }

    recommendations.push(
      'Consider adding a value proposition statement that clearly answers: What do you do? For whom? Why is it better?'
    );
  }

  return {
    summary,
    issues: issues.slice(0, 6),
    recommendations: recommendations.slice(0, 8),
  };
}
