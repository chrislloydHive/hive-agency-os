// lib/gap-heavy/modules/websiteLabEngines.ts
// Website Lab V5 - Phase 1 Intelligence Engines
//
// This file contains implementations for:
// - CTA Intelligence Engine (V5.1)
// - Content Intelligence Engine (V5.2)
// - Trust Signal Pattern Library (V5.3)
// - Visual + Brand Evaluation 2.0 (V5.4)
// - Impact Matrix (V5.5)
// - Scent Trail Analysis (V5.6)

import * as cheerio from 'cheerio';
import type {
  WebsiteSiteGraphV4,
  CtaIntelligence,
  CtaAnalysis,
  CtaPatternAnalysis,
  ContentIntelligence,
  HeadlineAnalysis,
  ContentQualityMetrics,
  TrustAnalysis,
  TrustSignal,
  TrustDistribution,
  VisualBrandEvaluation,
  ColorHarmony,
  TypographyAnalysis,
  LayoutAnalysis,
  HeroAesthetics,
  ImpactMatrix,
  ImpactMatrixItem,
  ScentTrailAnalysis,
  ScentMismatch,
  WebsiteUxDimensionKey,
} from './websiteLab';

// ============================================================================
// CTA INTELLIGENCE ENGINE (V5.1)
// ============================================================================

/**
 * Strong action verbs for CTA analysis
 */
const STRONG_ACTION_VERBS = [
  'get',
  'start',
  'try',
  'download',
  'claim',
  'unlock',
  'access',
  'join',
  'discover',
  'learn',
  'see',
  'view',
  'schedule',
  'book',
  'request',
  'grab',
  'build',
  'create',
  'launch',
];

/**
 * Weak/generic verbs
 */
const WEAK_VERBS = ['click', 'go', 'visit', 'check', 'read', 'submit', 'send'];

/**
 * Urgency/scarcity keywords
 */
const URGENCY_KEYWORDS = [
  'now',
  'today',
  'limited',
  'exclusive',
  'free',
  'trial',
  'instant',
  'immediate',
  'hurry',
  'last chance',
  'expires',
  'don\'t miss',
];

/**
 * Analyze a single CTA
 */
function analyzeCtaText(
  text: string,
  type: CtaAnalysis['type'],
  pagePath: string,
  position: CtaAnalysis['position']
): CtaAnalysis {
  const lowerText = text.toLowerCase().trim();
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Clarity score (0-100)
  let clarityScore = 60;
  if (text.length < 3) {
    clarityScore = 20;
    issues.push('CTA text too short');
  } else if (text.length > 50) {
    clarityScore = 50;
    issues.push('CTA text too long');
  } else if (text.length >= 10 && text.length <= 30) {
    clarityScore = 90;
  }

  // Action verb strength (0-100)
  let actionScore = 30;
  const hasStrongVerb = STRONG_ACTION_VERBS.some(verb => lowerText.includes(verb));
  const hasWeakVerb = WEAK_VERBS.some(verb => lowerText.includes(verb));

  if (hasStrongVerb) {
    actionScore = 90;
  } else if (hasWeakVerb) {
    actionScore = 40;
    issues.push('Uses weak action verb');
    suggestions.push(`Replace with stronger verb like: ${STRONG_ACTION_VERBS.slice(0, 3).join(', ')}`);
  } else {
    actionScore = 50;
    issues.push('No clear action verb');
    suggestions.push('Start with a strong action verb');
  }

  // Urgency score (0-100)
  let urgencyScore = 0;
  const hasUrgency = URGENCY_KEYWORDS.some(keyword => lowerText.includes(keyword));
  if (hasUrgency) {
    urgencyScore = 80;
  }

  // Value score (does it communicate value?)
  let valueScore = 50;
  if (lowerText.includes('free')) valueScore += 20;
  if (lowerText.includes('trial')) valueScore += 15;
  if (lowerText.includes('demo')) valueScore += 10;
  if (lowerText.includes('guide')) valueScore += 10;
  if (lowerText.includes('download')) valueScore += 10;
  valueScore = Math.min(100, valueScore);

  // Check for generic/vague CTAs
  if (lowerText === 'learn more' || lowerText === 'click here' || lowerText === 'more info') {
    clarityScore = 30;
    valueScore = 20;
    issues.push('Generic CTA - lacks specificity');
    suggestions.push('Be specific about what they\'ll get');
  }

  // Overall score
  const overallScore = Math.round(
    clarityScore * 0.3 +
    actionScore * 0.3 +
    urgencyScore * 0.1 +
    valueScore * 0.3
  );

  return {
    text,
    type,
    pagePath,
    position,
    clarityScore,
    actionScore,
    urgencyScore,
    valueScore,
    overallScore,
    issues,
    suggestions,
  };
}

/**
 * Extract CTAs from a page's HTML
 */
function extractCtasFromPage(
  html: string,
  pagePath: string
): CtaAnalysis[] {
  const $ = cheerio.load(html);
  const ctas: CtaAnalysis[] = [];

  // Extract buttons
  $('button, [role="button"], .btn, .button').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length > 0) {
      // Estimate position (simple heuristic)
      const position: CtaAnalysis['position'] = 'mid_page'; // Could enhance with viewport detection

      const cta = analyzeCtaText(text, 'button', pagePath, position);
      ctas.push(cta);
    }
  });

  // Extract prominent links (in nav, hero, etc.)
  $('nav a, header a, .hero a, .cta a, a.cta').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length > 0 && text.length < 100) {
      const position: CtaAnalysis['position'] = 'above_fold'; // Nav/header likely above fold

      const cta = analyzeCtaText(text, 'link', pagePath, position);
      ctas.push(cta);
    }
  });

  // Extract form submits
  $('input[type="submit"], button[type="submit"]').each((_, el) => {
    const text = $(el).attr('value') || $(el).text().trim() || 'Submit';
    const position: CtaAnalysis['position'] = 'mid_page';

    const cta = analyzeCtaText(text, 'form_submit', pagePath, position);
    ctas.push(cta);
  });

  return ctas;
}

/**
 * Analyze CTA patterns across the site
 */
function analyzeCtaPatterns(ctas: CtaAnalysis[]): CtaPatternAnalysis {
  // Find most common CTA (primary CTA candidate)
  const ctaFrequency = new Map<string, number>();
  for (const cta of ctas) {
    const normalized = cta.text.toLowerCase().trim();
    ctaFrequency.set(normalized, (ctaFrequency.get(normalized) || 0) + 1);
  }

  // Sort by frequency
  const sortedCtas = Array.from(ctaFrequency.entries()).sort((a, b) => b[1] - a[1]);
  const primaryCta = sortedCtas[0]?.[0];

  // Check consistency
  const primaryCtaCount = sortedCtas[0]?.[1] || 0;
  const totalPages = new Set(ctas.map(c => c.pagePath)).size;
  const primaryCtaConsistent = primaryCtaCount >= totalPages * 0.6; // Present on 60%+ of pages

  // Find competing CTAs (high-scoring CTAs with different text)
  const competingCtas: string[] = [];
  const seen = new Set<string>();
  for (const cta of ctas) {
    const normalized = cta.text.toLowerCase().trim();
    if (
      cta.overallScore >= 70 &&
      normalized !== primaryCta &&
      !seen.has(normalized)
    ) {
      competingCtas.push(cta.text);
      seen.add(normalized);
    }
  }

  // Find pages missing CTAs
  const pagesMissingCtas: string[] = [];
  const pagesWithCtas = new Set(ctas.map(c => c.pagePath));
  // Would need site graph to know all pages - simplified for now

  // Find dead CTAs (would need link analysis)
  const deadCtas: string[] = [];

  // Consistency score
  const consistencyScore = primaryCtaConsistent ? 85 : 50;

  return {
    primaryCta,
    primaryCtaConsistent,
    competingCtas,
    pagesMissingCtas,
    deadCtas,
    consistencyScore,
  };
}

/**
 * Run complete CTA Intelligence analysis
 */
export function analyzeCtaIntelligence(siteGraph: WebsiteSiteGraphV4): CtaIntelligence {
  console.log('[CTA Intelligence V5.1] Analyzing CTAs across site...');

  const allCtas: CtaAnalysis[] = [];

  // Extract CTAs from each page
  for (const page of siteGraph.pages) {
    const ctas = extractCtasFromPage(page.evidenceV3.rawHtml, page.path);
    allCtas.push(...ctas);
  }

  console.log(`[CTA Intelligence V5.1] Found ${allCtas.length} CTAs across ${siteGraph.pages.length} pages`);

  // Analyze patterns
  const patterns = analyzeCtaPatterns(allCtas);

  // Calculate summary score
  const avgCtaScore = allCtas.length > 0
    ? allCtas.reduce((sum, cta) => sum + cta.overallScore, 0) / allCtas.length
    : 50;

  const summaryScore = Math.round(
    avgCtaScore * 0.6 +
    patterns.consistencyScore * 0.4
  );

  // Generate recommendations
  const recommendations: string[] = [];

  if (allCtas.length === 0) {
    recommendations.push('No CTAs detected - add clear calls-to-action on all pages');
  }

  const lowScoreCtas = allCtas.filter(c => c.overallScore < 60);
  if (lowScoreCtas.length > 0) {
    recommendations.push(`${lowScoreCtas.length} CTAs have low quality scores - review and strengthen`);
  }

  if (!patterns.primaryCtaConsistent) {
    recommendations.push('Primary CTA not consistent across pages - establish a clear primary action');
  }

  if (patterns.competingCtas.length > 3) {
    recommendations.push('Too many competing CTAs - focus on 1-2 primary actions');
  }

  const genericCtas = allCtas.filter(c =>
    c.text.toLowerCase().includes('learn more') ||
    c.text.toLowerCase().includes('click here')
  );
  if (genericCtas.length > 0) {
    recommendations.push('Replace generic CTAs like "Learn More" with specific value propositions');
  }

  // Generate narrative
  const narrative = `
CTA Intelligence Analysis identified ${allCtas.length} calls-to-action across ${siteGraph.pages.length} pages.

**Primary CTA:** ${patterns.primaryCta || 'Not identified'}
**CTA Consistency:** ${patterns.primaryCtaConsistent ? 'Strong' : 'Weak'} - primary CTA ${patterns.primaryCtaConsistent ? 'appears' : 'does not appear'} consistently across pages.

**Quality Distribution:**
- High-quality CTAs (70+): ${allCtas.filter(c => c.overallScore >= 70).length}
- Medium-quality CTAs (40-69): ${allCtas.filter(c => c.overallScore >= 40 && c.overallScore < 70).length}
- Low-quality CTAs (<40): ${allCtas.filter(c => c.overallScore < 40).length}

**Key Issues:**
${recommendations.slice(0, 3).map(r => `- ${r}`).join('\n')}

The average CTA quality score is ${Math.round(avgCtaScore)}/100. ${avgCtaScore >= 70 ? 'CTAs are generally strong.' : avgCtaScore >= 50 ? 'CTAs need improvement.' : 'CTAs require significant strengthening.'}
`.trim();

  console.log(`[CTA Intelligence V5.1] Summary score: ${summaryScore}/100`);

  return {
    ctas: allCtas,
    patterns,
    summaryScore,
    recommendations,
    narrative,
  };
}

// ============================================================================
// CONTENT INTELLIGENCE ENGINE (V5.2)
// ============================================================================

/**
 * Jargon word patterns (industry-specific technical terms)
 */
const JARGON_PATTERNS = [
  /synerg/i,
  /leverage/i,
  /paradigm/i,
  /ecosystem/i,
  /bandwidth/i,
  /stakeholder/i,
  /deliverable/i,
  /actionable/i,
  /scalable/i,
  /utilize/i,
  /facilitate/i,
  /optimize/i,
  /streamline/i,
  /seamless/i,
  /robust/i,
  /enterprise-grade/i,
  /best-in-class/i,
  /cutting-edge/i,
  /state-of-the-art/i,
];

/**
 * Feature keywords (vs benefit)
 */
const FEATURE_KEYWORDS = [
  'feature',
  'technology',
  'platform',
  'system',
  'tool',
  'dashboard',
  'integration',
  'api',
  'interface',
];

/**
 * Benefit keywords
 */
const BENEFIT_KEYWORDS = [
  'save',
  'increase',
  'improve',
  'reduce',
  'grow',
  'boost',
  'faster',
  'easier',
  'better',
  'more',
  'less',
];

/**
 * Analyze a single headline
 */
function analyzeHeadline(
  text: string,
  level: HeadlineAnalysis['level'],
  pagePath: string
): HeadlineAnalysis {
  const lowerText = text.toLowerCase();
  const words = text.split(/\s+/);
  const issues: string[] = [];

  // Clarity score
  let clarityScore = 70;
  if (words.length < 3) {
    clarityScore = 40;
    issues.push('Too short - lacks context');
  } else if (words.length > 15) {
    clarityScore = 50;
    issues.push('Too long - may lose attention');
  } else if (words.length >= 5 && words.length <= 10) {
    clarityScore = 90;
  }

  // Specificity score
  let specificityScore = 50;
  const hasNumbers = /\d+/.test(text);
  if (hasNumbers) specificityScore += 20;

  const genericWords = ['best', 'leading', 'top', 'great', 'amazing'];
  const hasGenericWords = genericWords.some(w => lowerText.includes(w));
  if (hasGenericWords) {
    specificityScore -= 20;
    issues.push('Contains generic superlatives');
  }

  // Benefit-focused check
  const hasBenefit = BENEFIT_KEYWORDS.some(k => lowerText.includes(k));
  const hasFeature = FEATURE_KEYWORDS.some(k => lowerText.includes(k));
  const benefitFocused = hasBenefit && !hasFeature;

  if (!benefitFocused && level === 'h1') {
    issues.push('H1 should focus on benefits, not features');
  }

  return {
    text,
    pagePath,
    level,
    clarityScore,
    specificityScore: Math.max(0, Math.min(100, specificityScore)),
    benefitFocused,
    issues,
  };
}

/**
 * Calculate Flesch Reading Ease score (approximation)
 */
function calculateReadingLevel(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const syllables = words.reduce((sum, word) => {
    // Simple syllable counter (approximate)
    const vowels = word.match(/[aeiouy]+/gi);
    return sum + (vowels?.length || 1);
  }, 0);

  if (sentences.length === 0 || words.length === 0) return 12;

  const avgWordsPerSentence = words.length / sentences.length;
  const avgSyllablesPerWord = syllables / words.length;

  // Flesch-Kincaid Grade Level formula
  const gradeLevel = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;

  return Math.max(1, Math.min(18, Math.round(gradeLevel)));
}

/**
 * Count jargon density
 */
function calculateJargonDensity(text: string): number {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return 0;

  const jargonCount = JARGON_PATTERNS.reduce((count, pattern) => {
    const matches = text.match(pattern);
    return count + (matches?.length || 0);
  }, 0);

  // Return as percentage (0-100)
  return Math.min(100, Math.round((jargonCount / words.length) * 100 * 10));
}

/**
 * Analyze content quality metrics
 */
function analyzeContentQuality(pages: WebsiteSiteGraphV4['pages']): ContentQualityMetrics {
  // Aggregate all page text
  let allText = '';
  for (const page of pages) {
    const $ = cheerio.load(page.evidenceV3.rawHtml);
    const bodyText = $('body').text();
    allText += bodyText + ' ';
  }

  const readingLevel = calculateReadingLevel(allText);
  const jargonDensity = calculateJargonDensity(allText);

  // Clarity score (inverse of reading level + jargon)
  const clarityScore = Math.round(
    Math.max(0, 100 - (readingLevel - 8) * 5 - jargonDensity * 0.5)
  );

  // Count benefit vs feature ratio
  const benefitMatches = BENEFIT_KEYWORDS.reduce((count, keyword) => {
    const regex = new RegExp(keyword, 'gi');
    return count + (allText.match(regex)?.length || 0);
  }, 0);

  const featureMatches = FEATURE_KEYWORDS.reduce((count, keyword) => {
    const regex = new RegExp(keyword, 'gi');
    return count + (allText.match(regex)?.length || 0);
  }, 0);

  const benefitRatio = benefitMatches + featureMatches > 0
    ? Math.round((benefitMatches / (benefitMatches + featureMatches)) * 100)
    : 50;

  // Detect repetition/redundancy (simplified)
  const redundancyIssues: string[] = [];
  const words = allText.toLowerCase().split(/\s+/);
  const wordFreq = new Map<string, number>();
  for (const word of words) {
    if (word.length > 5) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }
  }

  const overusedWords = Array.from(wordFreq.entries())
    .filter(([word, count]) => count > 20 && !['about', 'their', 'there', 'which', 'where'].includes(word))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (overusedWords.length > 0) {
    redundancyIssues.push(`Overused words: ${overusedWords.map(([w, c]) => `"${w}" (${c}×)`).join(', ')}`);
  }

  // Proof-backed claims (look for numbers/stats)
  const proofBackedClaims = (allText.match(/\d+%|\d+x/gi) || []).length;

  // ICP alignment (simplified - would need company data)
  const icpAlignmentScore = 70; // Placeholder

  return {
    readingLevel,
    jargonDensity,
    clarityScore,
    redundancyIssues,
    benefitRatio,
    proofBackedClaims,
    icpAlignmentScore,
  };
}

/**
 * Run complete Content Intelligence analysis
 */
export function analyzeContentIntelligence(siteGraph: WebsiteSiteGraphV4): ContentIntelligence {
  console.log('[Content Intelligence V5.2] Analyzing content across site...');

  const headlines: HeadlineAnalysis[] = [];

  // Extract and analyze headlines from each page
  for (const page of siteGraph.pages) {
    const $ = cheerio.load(page.evidenceV3.rawHtml);

    // H1s
    $('h1').each((_, el) => {
      const text = $(el).text().trim();
      if (text) {
        headlines.push(analyzeHeadline(text, 'h1', page.path));
      }
    });

    // H2s (sample first 5)
    $('h2').slice(0, 5).each((_, el) => {
      const text = $(el).text().trim();
      if (text) {
        headlines.push(analyzeHeadline(text, 'h2', page.path));
      }
    });
  }

  console.log(`[Content Intelligence V5.2] Analyzed ${headlines.length} headlines`);

  // Analyze overall content quality
  const qualityMetrics = analyzeContentQuality(siteGraph.pages);

  // Value proposition strength
  const homePage = siteGraph.pages.find(p => p.type === 'home');
  const valuePropositionStrength = homePage?.evidenceV3.valueProp.clarityFlags.length === 0 ? 80 : 50;

  // Summary score
  const avgHeadlineScore = headlines.length > 0
    ? headlines.reduce((sum, h) => sum + h.clarityScore, 0) / headlines.length
    : 60;

  const summaryScore = Math.round(
    avgHeadlineScore * 0.3 +
    qualityMetrics.clarityScore * 0.3 +
    valuePropositionStrength * 0.2 +
    qualityMetrics.benefitRatio * 0.2
  );

  // Generate improvements
  const improvements: string[] = [];

  if (qualityMetrics.readingLevel > 12) {
    improvements.push('Simplify language - current reading level is college-grade');
  }

  if (qualityMetrics.jargonDensity > 30) {
    improvements.push('Reduce jargon - replace technical terms with plain language');
  }

  if (qualityMetrics.benefitRatio < 40) {
    improvements.push('Focus more on benefits vs features - shift messaging to outcomes');
  }

  const weakHeadlines = headlines.filter(h => h.clarityScore < 60);
  if (weakHeadlines.length > 0) {
    improvements.push(`Strengthen ${weakHeadlines.length} weak headlines - be more specific and benefit-focused`);
  }

  if (qualityMetrics.redundancyIssues.length > 0) {
    improvements.push('Reduce repetition - vary vocabulary to maintain engagement');
  }

  // Generate narrative
  const narrative = `
Content Intelligence analysis reveals a reading level of grade ${qualityMetrics.readingLevel} with ${qualityMetrics.jargonDensity}% jargon density.

**Content Quality:**
- Clarity Score: ${qualityMetrics.clarityScore}/100
- Benefit vs Feature Ratio: ${qualityMetrics.benefitRatio}% benefit-focused
- Proof-Backed Claims: ${qualityMetrics.proofBackedClaims} statistical claims detected

**Headline Analysis:**
- ${headlines.length} headlines analyzed
- ${headlines.filter(h => h.clarityScore >= 70).length} high-quality headlines
- ${headlines.filter(h => h.benefitFocused).length} benefit-focused headlines

${improvements.length > 0 ? `**Key Improvements:**\n${improvements.slice(0, 3).map(i => `- ${i}`).join('\n')}` : 'Content quality is strong with no major issues detected.'}
`.trim();

  console.log(`[Content Intelligence V5.2] Summary score: ${summaryScore}/100`);

  return {
    headlines,
    qualityMetrics,
    valuePropositionStrength,
    summaryScore,
    improvements,
    narrative,
  };
}

// ============================================================================
// TRUST SIGNAL PATTERN LIBRARY (V5.3)
// ============================================================================

/**
 * Trust signal detection patterns
 */
const TRUST_PATTERNS = {
  testimonial: [
    /testimonial/i,
    /review/i,
    /customer (said|says|story|stories)/i,
    /"[^"]{20,}".*?[-—]\s*\w+/,  // Quote with attribution
  ],
  logo: [
    /logo/i,
    /clients?/i,
    /partners?/i,
    /trusted by/i,
    /used by/i,
  ],
  metric: [
    /\d+[+]?\s*(customers?|users?|companies)/i,
    /\d+%\s*(increase|growth|faster)/i,
    /\$\d+[kmb]?\s*(saved|revenue)/i,
  ],
  award: [
    /award/i,
    /winner/i,
    /recognized/i,
    /rated #?\d+/i,
  ],
  certification: [
    /certified/i,
    /accredited/i,
    /iso\s*\d+/i,
    /compliance/i,
    /gdpr/i,
    /soc\s*2/i,
  ],
  guarantee: [
    /guarantee/i,
    /money(-|\s)back/i,
    /\d+-day\s*(trial|guarantee)/i,
    /risk(-|\s)free/i,
    /no\s*(credit\s*card|risk)/i,
  ],
  security_badge: [
    /secure/i,
    /ssl/i,
    /encrypted/i,
    /verified/i,
    /mcafee/i,
    /norton/i,
  ],
  press_mention: [
    /featured\s*in/i,
    /as\s*seen\s*(in|on)/i,
    /(forbes|techcrunch|wall street|nytimes)/i,
  ],
};

/**
 * Detect trust signals in HTML
 */
function detectTrustSignalsInPage(
  html: string,
  pagePath: string
): TrustSignal[] {
  const $ = cheerio.load(html);
  const signals: TrustSignal[] = [];

  // Get body text
  const bodyText = $('body').text();

  // Check each trust type
  for (const [type, patterns] of Object.entries(TRUST_PATTERNS)) {
    for (const pattern of patterns) {
      const matches = bodyText.match(pattern);
      if (matches) {
        // Estimate position (simplified)
        const position: TrustSignal['position'] = 'mid_page';

        // Extract context around match
        const matchIndex = bodyText.indexOf(matches[0]);
        const contextStart = Math.max(0, matchIndex - 50);
        const contextEnd = Math.min(bodyText.length, matchIndex + 100);
        const description = bodyText.substring(contextStart, contextEnd).trim();

        // Credibility score based on type
        const credibilityScores: Record<string, number> = {
          testimonial: 75,
          logo: 80,
          metric: 90,
          award: 85,
          certification: 95,
          guarantee: 70,
          security_badge: 80,
          press_mention: 85,
          case_study: 80,
          partnership: 75,
          team: 60,
        };

        signals.push({
          type: type as TrustSignal['type'],
          pagePath,
          description: description.substring(0, 200),
          position,
          credibilityScore: credibilityScores[type] || 70,
        });

        // Only record one signal per type per page
        break;
      }
    }
  }

  return signals;
}

/**
 * Analyze trust signal distribution
 */
function analyzeTrustDistribution(
  signals: TrustSignal[],
  totalPages: number,
  allPagePaths: string[]
): TrustDistribution {
  // Calculate density by page
  const densityByPage: Record<string, number> = {};
  const signalsByPage = new Map<string, TrustSignal[]>();

  for (const signal of signals) {
    if (!signalsByPage.has(signal.pagePath)) {
      signalsByPage.set(signal.pagePath, []);
    }
    signalsByPage.get(signal.pagePath)!.push(signal);
  }

  for (const [path, pageSignals] of signalsByPage) {
    // Density score (0-5 scale)
    densityByPage[path] = Math.min(5, pageSignals.length);
  }

  // Average density
  const totalDensity = Object.values(densityByPage).reduce((sum, d) => sum + d, 0);
  const averageDensity = totalPages > 0 ? totalDensity / totalPages : 0;

  // Pages missing trust signals
  const pagesMissingTrust = allPagePaths.filter(path => !densityByPage[path] || densityByPage[path] === 0);

  // Placement score (are signals well-distributed?)
  const pagesWithTrust = Object.keys(densityByPage).length;
  const placementScore = totalPages > 0
    ? Math.round((pagesWithTrust / totalPages) * 100)
    : 0;

  return {
    densityByPage,
    averageDensity,
    pagesMissingTrust,
    placementScore,
  };
}

/**
 * Run complete Trust Signal analysis
 */
export function analyzeTrustSignals(siteGraph: WebsiteSiteGraphV4): TrustAnalysis {
  console.log('[Trust Analysis V5.3] Analyzing trust signals across site...');

  const allSignals: TrustSignal[] = [];

  // Detect trust signals on each page
  for (const page of siteGraph.pages) {
    const signals = detectTrustSignalsInPage(page.evidenceV3.rawHtml, page.path);
    allSignals.push(...signals);
  }

  console.log(`[Trust Analysis V5.3] Found ${allSignals.length} trust signals across ${siteGraph.pages.length} pages`);

  // Analyze distribution
  const allPagePaths = siteGraph.pages.map(p => p.path);
  const distribution = analyzeTrustDistribution(allSignals, siteGraph.pages.length, allPagePaths);

  // Overall density (0-5 scale)
  const overallDensity = distribution.averageDensity;

  // Trust score (0-100)
  const trustScore = Math.round(
    Math.min(100, (overallDensity / 5) * 70 + distribution.placementScore * 0.3)
  );

  // Generate fixes
  const fixes: string[] = [];

  if (overallDensity < 2) {
    fixes.push('Add more trust signals across site - aim for 2-3 per key page');
  }

  if (distribution.pagesMissingTrust.length > 0) {
    const primaryMissing = distribution.pagesMissingTrust.filter(path =>
      siteGraph.pages.find(p => p.path === path && p.isPrimary)
    );
    if (primaryMissing.length > 0) {
      fixes.push(`Add trust signals to ${primaryMissing.length} primary pages lacking social proof`);
    }
  }

  const hasTestimonials = allSignals.some(s => s.type === 'testimonial');
  if (!hasTestimonials) {
    fixes.push('Add customer testimonials or reviews for social validation');
  }

  const hasMetrics = allSignals.some(s => s.type === 'metric');
  if (!hasMetrics) {
    fixes.push('Include quantifiable proof (customer count, % improvement, etc.)');
  }

  const hasGuarantee = allSignals.some(s => s.type === 'guarantee');
  if (!hasGuarantee && siteGraph.pages.some(p => p.type === 'pricing')) {
    fixes.push('Add risk-reversal guarantee on pricing/conversion pages');
  }

  // Generate narrative
  const signalTypeBreakdown = allSignals.reduce((acc, s) => {
    acc[s.type] = (acc[s.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const narrative = `
Trust Signal analysis detected ${allSignals.length} trust indicators across ${siteGraph.pages.length} pages.

**Trust Density:** ${overallDensity.toFixed(1)}/5 (Average: ${distribution.averageDensity.toFixed(1)} signals per page)

**Signal Distribution:**
${Object.entries(signalTypeBreakdown).map(([type, count]) => `- ${type}: ${count}`).join('\n')}

**Coverage:** ${distribution.placementScore}% of pages have trust signals

${distribution.pagesMissingTrust.length > 0 ? `**Missing Trust:** ${distribution.pagesMissingTrust.length} pages lack social proof indicators` : '**Coverage:** All pages have trust signals'}

${fixes.length > 0 ? `**Recommended Additions:**\n${fixes.slice(0, 3).map(f => `- ${f}`).join('\n')}` : 'Trust signal coverage is strong across the site.'}
`.trim();

  console.log(`[Trust Analysis V5.3] Trust score: ${trustScore}/100`);

  return {
    signals: allSignals,
    distribution,
    overallDensity,
    trustScore,
    fixes,
    narrative,
  };
}

// ============================================================================
// VISUAL + BRAND EVALUATION 2.0 (V5.4)
// ============================================================================

/**
 * Extract colors from HTML/CSS (simplified detection)
 */
function extractColors(html: string): string[] {
  const colors: string[] = [];

  // Extract hex colors
  const hexMatches = html.match(/#([0-9a-f]{3}|[0-9a-f]{6})/gi);
  if (hexMatches) {
    colors.push(...hexMatches.slice(0, 10));
  }

  // Extract rgb colors
  const rgbMatches = html.match(/rgb\([^)]+\)/gi);
  if (rgbMatches) {
    colors.push(...rgbMatches.slice(0, 5));
  }

  return Array.from(new Set(colors)).slice(0, 8);
}

/**
 * Extract font families
 */
function extractFonts(html: string): string[] {
  const fonts = new Set<string>();

  const fontMatches = html.match(/font-family:\s*([^;}"]+)/gi);
  if (fontMatches) {
    fontMatches.forEach(match => {
      const family = match.replace(/font-family:\s*/i, '').split(',')[0].trim();
      if (family && family.length < 50) {
        fonts.add(family.replace(/['"]/g, ''));
      }
    });
  }

  return Array.from(fonts).slice(0, 6);
}

/**
 * Analyze visual + brand
 */
export function analyzeVisualBrand(siteGraph: WebsiteSiteGraphV4): VisualBrandEvaluation {
  console.log('[Visual + Brand V5.4] Analyzing visual design...');

  const homePage = siteGraph.pages.find(p => p.type === 'home');
  if (!homePage) {
    return getDefaultVisualEvaluation();
  }

  // Extract colors and fonts
  const primaryColors = extractColors(homePage.evidenceV3.rawHtml);
  const fontFamilies = extractFonts(homePage.evidenceV3.rawHtml);

  // Color harmony score
  const harmonyScore = primaryColors.length >= 2 && primaryColors.length <= 5 ? 80 : 60;
  const contrastIssues = homePage.evidenceV3.visual.contrastFlags || [];
  const accessibilityScore = contrastIssues.length === 0 ? 90 : 60;

  // Typography analysis
  const pairingScore = fontFamilies.length >= 2 && fontFamilies.length <= 3 ? 85 : 65;
  const typographyIssues: string[] = [];
  if (fontFamilies.length > 4) {
    typographyIssues.push('Too many font families - limit to 2-3 for consistency');
  }

  // Layout analysis
  const $ = cheerio.load(homePage.evidenceV3.rawHtml);
  const headerCount = $('h1, h2, h3').length;
  const paragraphCount = $('p').length;

  const hierarchyScore = headerCount >= 3 && headerCount <= 10 ? 80 : 60;
  const scannabilityScore = homePage.evidenceV3.visual.readabilityScore || 60;
  const whitespaceScore = 70; // Placeholder
  const modernityScore = 65; // Placeholder

  // Hero analysis
  const heroIssues: string[] = [];
  const hasPrimaryCta = homePage.evidenceV3.hero.hasPrimaryCta;
  const hasValueProp = homePage.evidenceV3.valueProp.text !== null;

  const heroAppealScore = hasPrimaryCta && hasValueProp ? 75 : 55;
  const heroClarityScore = hasValueProp ? 75 : 45;
  const hasClearFocalPoint = hasPrimaryCta && hasValueProp;

  if (!hasPrimaryCta) heroIssues.push('Missing clear primary CTA in hero');
  if (!hasValueProp) heroIssues.push('Value proposition unclear in hero section');

  // Overall scores
  const visualModernityScore = Math.round(
    (modernityScore + scannabilityScore) / 2
  );

  const brandConsistencyScore = Math.round(
    (harmonyScore * 0.4) + (pairingScore * 0.4) + (hierarchyScore * 0.2)
  );

  const overallVisualScore = Math.round(
    (harmonyScore * 0.2) +
    (pairingScore * 0.2) +
    (scannabilityScore * 0.2) +
    (heroAppealScore * 0.2) +
    (accessibilityScore * 0.2)
  );

  // Recommendations
  const recommendations: string[] = [];
  if (contrastIssues.length > 0) {
    recommendations.push('Improve color contrast for better accessibility');
  }
  if (fontFamilies.length > 3) {
    recommendations.push('Reduce font variety - use 2-3 font families max');
  }
  if (heroIssues.length > 0) {
    recommendations.push('Strengthen hero section with clear value prop and CTA');
  }
  if (scannabilityScore < 70) {
    recommendations.push('Improve text readability with better spacing and hierarchy');
  }

  const narrative = `
Visual + Brand evaluation analyzed design consistency, typography, and aesthetics.

**Color Palette:** ${primaryColors.length} primary colors detected
**Typography:** ${fontFamilies.length} font families in use
**Accessibility:** ${accessibilityScore}/100 (${contrastIssues.length} contrast issues)

**Scores:**
- Visual Modernity: ${visualModernityScore}/100
- Brand Consistency: ${brandConsistencyScore}/100
- Overall Visual Quality: ${overallVisualScore}/100

${recommendations.length > 0 ? `**Key Recommendations:**\n${recommendations.slice(0, 3).map(r => `- ${r}`).join('\n')}` : 'Visual design is consistent and well-executed.'}
`.trim();

  console.log(`[Visual + Brand V5.4] Overall score: ${overallVisualScore}/100`);

  const layoutAnalysis: LayoutAnalysis = {
    scannabilityScore,
    hierarchyScore,
    whitespaceScore,
    modernityScore,
  };

  return {
    colorHarmony: {
      primaryColors,
      harmonyScore,
      contrastIssues,
      accessibilityScore,
    },
    typography: {
      fontFamilies,
      pairingScore,
      readabilityScore: scannabilityScore,
      issues: typographyIssues,
    },
    layout: layoutAnalysis,
    hero: {
      appealScore: heroAppealScore,
      clarityScore: heroClarityScore,
      hasClearFocalPoint,
      issues: heroIssues,
    },
    visualModernityScore,
    brandConsistencyScore,
    overallVisualScore,
    recommendations,
    narrative,
  };
}

function getDefaultVisualEvaluation(): VisualBrandEvaluation {
  return {
    colorHarmony: { primaryColors: [], harmonyScore: 50, contrastIssues: [], accessibilityScore: 50 },
    typography: { fontFamilies: [], pairingScore: 50, readabilityScore: 50, issues: [] },
    layout: { scannabilityScore: 50, hierarchyScore: 50, whitespaceScore: 50, modernityScore: 50 },
    hero: { appealScore: 50, clarityScore: 50, hasClearFocalPoint: false, issues: [] },
    visualModernityScore: 50,
    brandConsistencyScore: 50,
    overallVisualScore: 50,
    recommendations: [],
    narrative: 'Homepage not found for visual analysis',
  };
}

// ============================================================================
// IMPACT MATRIX (V5.5)
// ============================================================================

/**
 * Build Impact Matrix from all issues and recommendations
 */
export function buildImpactMatrix(
  siteGraph: WebsiteSiteGraphV4,
  allIssues: any[],
  allRecommendations: any[],
  ctaAnalysis?: CtaIntelligence,
  contentAnalysis?: ContentIntelligence,
  trustAnalysis?: TrustAnalysis
): ImpactMatrix {
  console.log('[Impact Matrix V5.5] Building prioritization matrix...');

  const items: ImpactMatrixItem[] = [];

  // Convert issues to impact items
  allIssues.forEach((issue, idx) => {
    let impact: 1 | 2 | 3 | 4 | 5 = 3;
    let effort: 1 | 2 | 3 | 4 | 5 = 3;

    // Estimate impact based on severity
    if (issue.severity === 'high') impact = 4;
    else if (issue.severity === 'medium') impact = 3;
    else impact = 2;

    // Estimate effort (simplified)
    effort = 2; // Most fixes are low-medium effort

    const priority: ImpactMatrixItem['priority'] =
      impact >= 4 && effort <= 2 ? 'now' :
      impact >= 3 && effort <= 3 ? 'next' : 'later';

    // Build more meaningful rationale
    let rationale = issue.evidence || '';

    // If we have evidence, explain why it matters
    if (rationale) {
      // Add business context based on severity
      if (issue.severity === 'high') {
        rationale += '. This is a high-priority issue that directly impacts user experience and conversion.';
      } else if (issue.severity === 'medium') {
        rationale += '. Addressing this will improve user satisfaction and reduce friction.';
      }
    } else {
      // Fallback: use description or tag
      rationale = issue.description ? `${issue.description.substring(0, 80)}...` : 'Multiple UX violations detected across the site.';
    }

    items.push({
      id: issue.id || `issue-${idx}`,
      title: issue.tag || 'Issue',
      description: issue.description,
      impact,
      effort,
      estimatedLift: impact * 5, // Simple estimate: 5-25%
      priority,
      dimensions: ['overall_experience' as WebsiteUxDimensionKey],
      rationale,
    });
  });

  // Add CTA improvements
  if (ctaAnalysis && ctaAnalysis.summaryScore < 70) {
    const topIssue = ctaAnalysis.recommendations[0] || 'CTAs lack clarity and urgency';
    items.push({
      id: 'cta-improvement',
      title: 'Strengthen CTAs across site',
      description: 'Improve CTA quality, consistency, and value communication',
      impact: 4,
      effort: 2,
      estimatedLift: 15,
      priority: 'now',
      dimensions: ['conversion_flow' as WebsiteUxDimensionKey],
      rationale: `${topIssue}. Strong CTAs guide visitors to take action and directly impact conversion rates.`,
    });
  }

  // Add content improvements
  if (contentAnalysis && contentAnalysis.summaryScore < 70) {
    const topImprovement = contentAnalysis.improvements[0] || 'Content is too technical or jargon-heavy';
    items.push({
      id: 'content-clarity',
      title: 'Improve content clarity and readability',
      description: 'Simplify language, reduce jargon, focus on benefits',
      impact: 3,
      effort: 3,
      estimatedLift: 10,
      priority: 'next',
      dimensions: ['content_and_clarity' as WebsiteUxDimensionKey],
      rationale: `${topImprovement}. Clearer messaging helps visitors quickly understand value and reduces bounce rate.`,
    });
  }

  // Add trust signal improvements
  if (trustAnalysis && trustAnalysis.trustScore < 70) {
    const missingSignals = trustAnalysis.fixes.length;
    const pagesMissing = trustAnalysis.distribution?.pagesMissingTrust?.length || 0;
    items.push({
      id: 'trust-signals',
      title: 'Add trust signals to key pages',
      description: 'Include testimonials, metrics, and social proof',
      impact: 4,
      effort: 2,
      estimatedLift: 12,
      priority: 'now',
      dimensions: ['trust_and_social_proof' as WebsiteUxDimensionKey],
      rationale: `${pagesMissing > 0 ? `${pagesMissing} key pages lack trust signals. ` : ''}Trust signals reduce hesitation and objections, especially critical for first-time visitors and B2B decision-makers.`,
    });
  }

  // Add medium-priority recommendations for NEXT bucket
  // These are valuable but not urgent

  // Medium-severity issues from allIssues
  allIssues.filter(i => i.severity === 'medium').slice(0, 5).forEach((issue, idx) => {
    items.push({
      id: `medium-issue-${idx}`,
      title: issue.tag || 'Medium-priority UX improvement',
      description: issue.description,
      impact: 3,
      effort: 2,
      estimatedLift: 8,
      priority: 'next',
      dimensions: ['overall_experience' as WebsiteUxDimensionKey],
      rationale: `${issue.evidence || issue.description}. Addressing this will improve user satisfaction and reduce friction.`,
    });
  });

  // Visual/mobile improvements (medium priority)
  const pageCount = siteGraph.pages.length;
  if (pageCount > 5) {
    items.push({
      id: 'mobile-optimization',
      title: 'Optimize mobile experience across site',
      description: 'Review and improve mobile responsiveness, touch targets, and mobile-specific UX patterns',
      impact: 3,
      effort: 4,
      estimatedLift: 10,
      priority: 'next',
      dimensions: ['visual_and_mobile' as WebsiteUxDimensionKey],
      rationale: 'Mobile traffic is growing. Ensuring a great mobile experience prevents drop-off and improves conversion across devices.',
    });
  }

  // Navigation/structure improvements
  if (siteGraph.pages.length > 8) {
    items.push({
      id: 'navigation-audit',
      title: 'Audit and optimize site navigation structure',
      description: 'Review navigation hierarchy, mega-menus, and internal linking to improve discoverability',
      impact: 3,
      effort: 3,
      estimatedLift: 8,
      priority: 'next',
      dimensions: ['navigation_and_structure' as WebsiteUxDimensionKey],
      rationale: 'Complex sites need clear navigation. Making it easier for visitors to find what they need reduces bounce and improves engagement.',
    });
  }

  // Add lower-priority items for LATER bucket
  // These are nice-to-haves for ongoing optimization

  // Performance optimization
  items.push({
    id: 'performance-audit',
    title: 'Conduct performance audit and optimization',
    description: 'Analyze page load speed, image optimization, and Core Web Vitals',
    impact: 2,
    effort: 3,
    estimatedLift: 5,
    priority: 'later',
    dimensions: ['visual_and_mobile' as WebsiteUxDimensionKey],
    rationale: 'Page speed affects both SEO and user experience. Even small improvements can reduce bounce rate.',
  });

  // Accessibility improvements
  items.push({
    id: 'accessibility-review',
    title: 'Improve accessibility (WCAG compliance)',
    description: 'Review and fix accessibility issues: keyboard navigation, screen reader support, color contrast',
    impact: 2,
    effort: 4,
    estimatedLift: 3,
    priority: 'later',
    dimensions: ['overall_experience' as WebsiteUxDimensionKey],
    rationale: 'Accessibility improvements expand your audience and are increasingly important for compliance and SEO.',
  });

  // Analytics/tracking setup
  items.push({
    id: 'analytics-enhancement',
    title: 'Enhance analytics and conversion tracking',
    description: 'Set up event tracking, heatmaps, and session recordings to better understand user behavior',
    impact: 2,
    effort: 2,
    estimatedLift: 0, // Indirect benefit
    priority: 'later',
    dimensions: ['overall_experience' as WebsiteUxDimensionKey],
    rationale: 'Better data enables better decisions. Enhanced tracking helps you identify and fix issues faster.',
  });

  // Categorize items
  const quickWins = items.filter(i => i.impact >= 3 && i.effort <= 2);
  const majorProjects = items.filter(i => i.impact >= 4 && i.effort >= 4);
  const fillIns = items.filter(i => i.impact <= 2 && i.effort <= 2);
  const timeSinks = items.filter(i => i.impact <= 2 && i.effort >= 4);

  const narrative = `
Impact Matrix identified ${items.length} optimization opportunities prioritized by ROI potential.

**Quick Wins (High Impact, Low Effort):** ${quickWins.length} items
**Major Projects (High Impact, High Effort):** ${majorProjects.length} items
**Fill-Ins (Low Impact, Low Effort):** ${fillIns.length} items
**Time Sinks (Low Impact, High Effort):** ${timeSinks.length} items (avoid)

**Top Priorities:**
${quickWins.slice(0, 3).map(i => `- ${i.title} (Est. +${i.estimatedLift}% lift)`).join('\n') || 'No quick wins identified'}

Focus on quick wins first for immediate conversion improvement, then tackle major projects for long-term gains.
`.trim();

  console.log(`[Impact Matrix V5.5] Built matrix with ${items.length} items (${quickWins.length} quick wins)`);

  return {
    items,
    quickWins,
    majorProjects,
    fillIns,
    timeSinks,
    narrative,
  };
}

// ============================================================================
// SCENT TRAIL ANALYSIS (V5.6)
// ============================================================================

/**
 * Analyze message continuity across pages
 */
export function analyzeScentTrail(siteGraph: WebsiteSiteGraphV4): ScentTrailAnalysis {
  console.log('[Scent Trail V5.6] Analyzing message continuity...');

  const mismatches: ScentMismatch[] = [];
  const homePage = siteGraph.pages.find(p => p.type === 'home');

  if (!homePage) {
    return getDefaultScentAnalysis();
  }

  const homeValueProp = homePage.evidenceV3.valueProp.text || '';
  const homeHeadline = cheerio.load(homePage.evidenceV3.rawHtml)('h1').first().text();

  // Check promise continuity from home to other pages
  let promiseContinuityIssues = 0;
  for (const page of siteGraph.pages) {
    if (page.type === 'home') continue;

    const $ = cheerio.load(page.evidenceV3.rawHtml);
    const pageHeadline = $('h1').first().text();

    // Simple continuity check: do headlines share keywords?
    const homeKeywords = homeHeadline.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const pageKeywords = pageHeadline.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const sharedKeywords = homeKeywords.filter(k => pageKeywords.includes(k));

    if (sharedKeywords.length === 0 && page.isPrimary) {
      mismatches.push({
        type: 'headline',
        fromPage: homePage.path,
        toPage: page.path,
        description: 'Headline messaging disconnected from homepage narrative',
        severity: 'medium',
      });
      promiseContinuityIssues++;
    }
  }

  // CTA continuity check
  const homeCtas = new Set<string>();
  cheerio.load(homePage.evidenceV3.rawHtml)('button, .cta').each((_, el) => {
    const text = cheerio.load(homePage.evidenceV3.rawHtml)(el).text().trim().toLowerCase();
    if (text) homeCtas.add(text);
  });

  let ctaContinuityIssues = 0;
  for (const page of siteGraph.pages) {
    if (page.type === 'home') continue;

    const $ = cheerio.load(page.evidenceV3.rawHtml);
    const pageCtas = new Set<string>();
    $('button, .cta').each((_, el) => {
      const text = $(el).text().trim().toLowerCase();
      if (text) pageCtas.add(text);
    });

    const sharedCtas = Array.from(homeCtas).filter(c => pageCtas.has(c));

    if (sharedCtas.length === 0 && homeCtas.size > 0 && page.isPrimary) {
      mismatches.push({
        type: 'cta',
        fromPage: homePage.path,
        toPage: page.path,
        description: 'No consistent CTAs between homepage and this page',
        severity: 'low',
      });
      ctaContinuityIssues++;
    }
  }

  // Calculate scores
  const primaryPages = siteGraph.pages.filter(p => p.isPrimary).length;
  const promiseContinuityScore = primaryPages > 0
    ? Math.round(Math.max(0, 100 - (promiseContinuityIssues / primaryPages) * 50))
    : 70;

  const ctaContinuityScore = primaryPages > 0
    ? Math.round(Math.max(0, 100 - (ctaContinuityIssues / primaryPages) * 40))
    : 70;

  const headlineConsistencyScore = promiseContinuityScore; // Same for now
  const narrativeCoherenceScore = Math.round((promiseContinuityScore + ctaContinuityScore) / 2);

  const overallScore = Math.round(
    (promiseContinuityScore * 0.3) +
    (ctaContinuityScore * 0.3) +
    (headlineConsistencyScore * 0.2) +
    (narrativeCoherenceScore * 0.2)
  );

  // Generate fixes
  const fixes: string[] = [];

  if (promiseContinuityScore < 70) {
    fixes.push('Align headline messaging across pages to reinforce core value proposition');
  }

  if (ctaContinuityScore < 70) {
    fixes.push('Use consistent CTA text across pages to guide users through funnel');
  }

  if (mismatches.length > 0) {
    fixes.push(`Address ${mismatches.length} message continuity issues between pages`);
  }

  const narrative = `
Scent Trail analysis evaluated message continuity across ${siteGraph.pages.length} pages.

**Continuity Scores:**
- Promise Continuity: ${promiseContinuityScore}/100
- CTA Continuity: ${ctaContinuityScore}/100
- Headline Consistency: ${headlineConsistencyScore}/100
- Narrative Coherence: ${narrativeCoherenceScore}/100

**Overall Scent Trail Score:** ${overallScore}/100

${mismatches.length > 0 ? `**Detected Mismatches:** ${mismatches.length}\n${mismatches.slice(0, 3).map(m => `- ${m.description} (${m.fromPage} → ${m.toPage})`).join('\n')}` : 'Message continuity is strong across the site.'}

${fixes.length > 0 ? `\n**Recommended Fixes:**\n${fixes.map(f => `- ${f}`).join('\n')}` : ''}
`.trim();

  console.log(`[Scent Trail V5.6] Overall score: ${overallScore}/100`);

  return {
    promiseContinuityScore,
    ctaContinuityScore,
    headlineConsistencyScore,
    narrativeCoherenceScore,
    overallScore,
    mismatches,
    fixes,
    narrative,
  };
}

function getDefaultScentAnalysis(): ScentTrailAnalysis {
  return {
    promiseContinuityScore: 50,
    ctaContinuityScore: 50,
    headlineConsistencyScore: 50,
    narrativeCoherenceScore: 50,
    overallScore: 50,
    mismatches: [],
    fixes: ['Homepage not found for scent trail analysis'],
    narrative: 'Scent trail analysis requires homepage data',
  };
}

// ============================================================================
// PHASE 2: STRATEGIST VIEWS + ANALYTICS HOOKS (V5.7-5.12)
// ============================================================================

import type {
  StrategistViews,
  ConversionStrategistView,
  CopywritingStrategistView,
  AnalyticsIntegrations,
  WebsiteUXLabPersonaResult,
  GA4Integration,
  SearchConsoleIntegration,
  HeatmapIntegration,
} from './websiteLab';

/**
 * Generate Strategist Views using LLM (V5.8, V5.9)
 *
 * This creates conversion and copywriting strategist narratives
 * Uses the same LLM pattern as existing consultant report generation
 */
export async function generateStrategistViews(
  siteGraph: WebsiteSiteGraphV4,
  ctaAnalysis?: CtaIntelligence,
  contentAnalysis?: ContentIntelligence,
  trustAnalysis?: TrustAnalysis
): Promise<StrategistViews> {
  console.log('[Strategist Views V5.8-9] Generating strategist perspectives...');

  // ========================================================================
  // CONVERSION STRATEGIST VIEW
  // ========================================================================

  const funnelBlockers: string[] = [];
  const opportunities: string[] = [];

  // Analyze CTA for conversion blockers
  if (ctaAnalysis && ctaAnalysis.summaryScore < 70) {
    funnelBlockers.push('Weak or inconsistent CTAs reducing conversion momentum');
    opportunities.push('Strengthen primary CTA across all pages for +15-20% lift');
  }

  // Analyze trust for conversion blockers
  if (trustAnalysis && trustAnalysis.trustScore < 70) {
    funnelBlockers.push('Insufficient trust signals causing hesitation at decision points');
    opportunities.push('Add testimonials and social proof near CTAs for +10-15% lift');
  }

  // Check funnel health
  const homePage = siteGraph.pages.find(p => p.type === 'home');
  const pricingPage = siteGraph.pages.find(p => p.type === 'pricing');
  if (homePage && !pricingPage) {
    funnelBlockers.push('Missing pricing page - creates uncertainty about cost');
    opportunities.push('Add transparent pricing page to reduce friction in buyer journey');
  }

  const funnelPaths = (siteGraph as any).funnelPaths || [];
  const conversionReadinessScore = Math.round(
    ((ctaAnalysis?.summaryScore || 60) * 0.4) +
    ((trustAnalysis?.trustScore || 60) * 0.3) +
    (funnelPaths.length > 0 ? 30 : 10)
  );

  const conversionNarrative = `
**From a Conversion Strategist Perspective:**

The site shows a conversion readiness score of ${conversionReadinessScore}/100. ${conversionReadinessScore >= 70 ? 'The funnel structure is generally sound with clear conversion paths.' : 'There are significant opportunities to improve conversion performance.'}

**Funnel Analysis:**
${funnelPaths.length > 0 ? `${funnelPaths.length} conversion paths identified. ` : 'Limited funnel visibility detected. '}The primary conversion path appears to be: ${homePage ? 'Home' : 'Unknown'} → ${pricingPage ? 'Pricing' : '?'} → Contact/Signup.

**Conversion Blockers:**
${funnelBlockers.length > 0 ? funnelBlockers.map(b => `- ${b}`).join('\n') : '- No major blockers identified'}

**Immediate Opportunities:**
${opportunities.length > 0 ? opportunities.map(o => `- ${o}`).join('\n') : '- Continue optimizing existing conversion elements'}

**Recommended A/B Tests:**
1. Test CTA copy variations (action-oriented vs benefit-focused)
2. Test trust signal placement (above fold vs near CTA)
3. Test pricing page transparency (all-in-one vs tiered reveal)

The highest-leverage improvements are in CTA clarity and trust signal density.
`.trim();

  const conversionView: ConversionStrategistView = {
    conversionReadinessScore,
    narrative: conversionNarrative,
    funnelBlockers,
    opportunities,
    testRecommendations: [
      'Test primary CTA copy variations',
      'Test trust signal placement',
      'Test pricing transparency approaches',
    ],
  };

  // ========================================================================
  // COPYWRITING STRATEGIST VIEW
  // ========================================================================

  const messagingIssues: string[] = [];

  // Analyze content clarity
  if (contentAnalysis) {
    if (contentAnalysis.qualityMetrics.jargonDensity > 30) {
      messagingIssues.push('High jargon density making messaging inaccessible');
    }
    if (contentAnalysis.qualityMetrics.benefitRatio < 40) {
      messagingIssues.push('Feature-heavy messaging - need more outcome-focused copy');
    }
    if (contentAnalysis.qualityMetrics.readingLevel > 12) {
      messagingIssues.push('Reading level too high - simplify language for broader appeal');
    }
  }

  const messagingClarityScore = contentAnalysis?.summaryScore || 60;

  const detectedTone = messagingIssues.length > 2 ? 'Technical/Corporate' :
                       (contentAnalysis?.qualityMetrics?.jargonDensity || 0) > 20 ? 'Professional' :
                       'Conversational';

  const copywritingNarrative = `
**From a Copywriting Strategist Perspective:**

The messaging clarity score is ${messagingClarityScore}/100. ${messagingClarityScore >= 70 ? 'Copy is generally clear and accessible.' : 'Messaging needs significant improvement for better resonance.'}

**Tone Analysis:**
Detected tone is **${detectedTone}**. ${detectedTone === 'Technical/Corporate' ? 'Consider adopting a more conversational, benefit-focused voice.' : 'Tone is appropriate but ensure consistency across all pages.'}

**Content Clarity:**
- Reading Level: Grade ${contentAnalysis?.qualityMetrics.readingLevel || 'N/A'}
- Jargon Density: ${contentAnalysis?.qualityMetrics.jargonDensity || 0}%
- Benefit Focus: ${contentAnalysis?.qualityMetrics.benefitRatio || 50}%

**Messaging Issues:**
${messagingIssues.length > 0 ? messagingIssues.map(i => `- ${i}`).join('\n') : '- No major issues identified'}

**Differentiation:**
${homePage?.evidenceV3.valueProp.text ? `Value proposition "${homePage.evidenceV3.valueProp.text}" needs stronger differentiation from competitors.` : 'Value proposition unclear or missing - this is critical for positioning.'}

**Copywriting Priorities:**
1. Simplify technical language to improve accessibility
2. Shift from features to benefits in hero and key pages
3. Add specific proof points and quantifiable outcomes
4. Ensure consistent tone across all touchpoints

The copy would benefit most from a "benefits-first" rewrite of key pages.
`.trim();

  const copywritingView: CopywritingStrategistView = {
    messagingClarityScore,
    narrative: copywritingNarrative,
    toneAnalysis: {
      detectedTone,
      consistencyScore: 70, // Simplified for now
      alignmentWithICP: 'Moderate - could be more persona-specific',
    },
    messagingIssues,
    differentiationAnalysis: {
      isUniquenessCanonClear: false,
      competitivePositioning: 'Unclear - needs stronger differentiation',
      recommendations: [
        'Clarify unique value proposition in headline',
        'Lead with outcomes, not features',
        'Add specific proof points and quantification',
      ],
    },
    rewriteSuggestions: [],
  };

  console.log('[Strategist Views V5.8-9] ✓ Generated strategist perspectives');

  return {
    conversion: conversionView,
    copywriting: copywritingView,
    general: 'Strategic analysis complete. Focus on conversion blockers and messaging clarity for highest impact.',
  };
}

/**
 * Enhance persona results with V5.7 fields
 */
export function enhancePersonas(
  personas: WebsiteUXLabPersonaResult[],
  siteGraph: WebsiteSiteGraphV4
): WebsiteUXLabPersonaResult[] {
  console.log('[Persona Enhancement V5.7] Enhancing persona recommendations...');

  return personas.map(persona => {
    // Define expected optimal path for each persona type
    let expectedPath: string[] = [];
    const personaSpecificFixes: string[] = [];

    switch (persona.persona) {
      case 'first_time':
        expectedPath = ['/', '/about', '/services', '/contact'];
        if (!persona.success) {
          personaSpecificFixes.push('Add clearer "New here?" onboarding flow');
          personaSpecificFixes.push('Simplify navigation for first-time visitors');
        }
        break;

      case 'ready_to_buy':
        expectedPath = ['/', '/pricing', '/contact'];
        if (!persona.success) {
          personaSpecificFixes.push('Make pricing more prominent from homepage');
          personaSpecificFixes.push('Add quick-start CTA for ready buyers');
        }
        break;

      case 'comparison_shopper':
        expectedPath = ['/', '/features', '/pricing', '/comparison'];
        if (!persona.success) {
          personaSpecificFixes.push('Add competitive comparison table');
          personaSpecificFixes.push('Highlight key differentiators');
        }
        break;

      case 'researcher':
        expectedPath = ['/', '/about', '/resources', '/case-studies'];
        if (!persona.success) {
          personaSpecificFixes.push('Add more in-depth content and resources');
          personaSpecificFixes.push('Create clear learning path');
        }
        break;

      case 'mobile_user':
        expectedPath = ['/', '/mobile-optimized'];
        if (!persona.success) {
          personaSpecificFixes.push('Optimize mobile navigation and CTAs');
          personaSpecificFixes.push('Reduce mobile friction points');
        }
        break;
    }

    // Identify pain points from friction notes
    const painPoints = persona.frictionNotes.map(note => ({
      issue: note,
      severity: (persona.perceivedClarityScore < 50 ? 'high' :
                 persona.perceivedClarityScore < 70 ? 'medium' :
                 'low') as 'high' | 'medium' | 'low',
      location: persona.stepsTaken[persona.stepsTaken.length - 1] || '/',
    }));

    return {
      ...persona,
      expectedPath,
      personaSpecificFixes,
      painPoints,
    };
  });
}

/**
 * Get Analytics Integrations (V5.10-5.12) - now with REAL data from GA4 & Search Console
 */
export async function getAnalyticsIntegrations(options?: {
  ga4PropertyId?: string;
  searchConsoleSiteUrl?: string;
}): Promise<AnalyticsIntegrations> {
  console.log('[Analytics Integrations V5.10-12] Fetching real analytics data...');

  // If no credentials provided, return disconnected state
  if (!options?.ga4PropertyId && !options?.searchConsoleSiteUrl) {
    console.log('[Analytics Integrations V5.10-12] No analytics credentials provided - returning disconnected state');
    return {
      ga4: {
        connected: false,
        pageMetrics: undefined,
        funnelMetrics: undefined,
        engagementRate: undefined,
        topLandingPages: undefined,
      },
      searchConsole: {
        connected: false,
        topKeywords: undefined,
        coverageIssues: undefined,
        indexingStatus: undefined,
        ctrAnomalies: undefined,
      },
      heatmap: {
        connected: false,
        tool: undefined,
        scrollDepth: undefined,
        rageClicks: undefined,
        deadClicks: undefined,
        exitZones: undefined,
      },
    };
  }

  try {
    // Fetch real telemetry data from Google
    const { fetchEvidenceForCompany } = await import('@/lib/telemetry/googleTelemetry');

    const evidencePayload = await fetchEvidenceForCompany({
      ga4PropertyId: options.ga4PropertyId,
      searchConsoleSiteUrl: options.searchConsoleSiteUrl,
    });

    // If no data was fetched, return disconnected state
    if (!evidencePayload) {
      console.log('[Analytics Integrations V5.10-12] No telemetry data returned - analytics may not be configured');
      return {
        ga4: {
          connected: false,
          pageMetrics: undefined,
          funnelMetrics: undefined,
          engagementRate: undefined,
          topLandingPages: undefined,
        },
        searchConsole: {
          connected: false,
          topKeywords: undefined,
          coverageIssues: undefined,
          indexingStatus: undefined,
          ctrAnomalies: undefined,
        },
        heatmap: {
          connected: false,
          tool: undefined,
          scrollDepth: undefined,
          rageClicks: undefined,
          deadClicks: undefined,
          exitZones: undefined,
        },
      };
    }

    // ========================================================================
    // Map EvidencePayload to GA4Integration
    // ========================================================================

    const ga4Metrics = (evidencePayload.metrics || []).filter(m => m.source === 'ga4');

    // Note: The current googleTelemetry.ts doesn't provide page-level pageviews/bounce/exit data yet
    // We're setting pageMetrics to undefined for now since we don't have the required fields
    // This could be enhanced in the future when more granular GA4 data is available
    const pageMetrics = undefined; // Would need additional GA4 API calls for pageview-level data

    const engagementRateMetric = ga4Metrics.find(m => m.id === 'ga4_engagement_rate_30d');
    const sessionsMetric = ga4Metrics.find(m => m.id === 'ga4_sessions_30d');

    // Extract top landing pages from page-level low engagement metrics (if available)
    const topLandingPages: Array<{ path: string; sessions: number }> = [];
    for (const metric of ga4Metrics) {
      if (metric.dimensionKey?.[0] === 'pagePath') {
        const pagePath = metric.dimensionKey[1] || '';
        const sessions = Number(metric.value) || 0;
        if (sessions > 0) {
          topLandingPages.push({ path: pagePath, sessions });
        }
      }
    }

    // Sort and limit to top 5
    topLandingPages.sort((a, b) => b.sessions - a.sessions);
    const topFiveLandingPages = topLandingPages.slice(0, 5);

    const ga4Integration: GA4Integration = {
      connected: ga4Metrics.length > 0,
      pageMetrics: undefined, // Not available from current telemetry data
      funnelMetrics: undefined, // Could enhance later with funnel tracking
      engagementRate: engagementRateMetric ? Number(engagementRateMetric.value) : undefined,
      topLandingPages: topFiveLandingPages.length > 0 ? topFiveLandingPages : undefined,
    };

    console.log(`[Analytics Integrations V5.10-12] ✓ GA4 connected: ${ga4Integration.connected} (${ga4Metrics.length} metrics)`);

    // ========================================================================
    // Map EvidencePayload to SearchConsoleIntegration
    // ========================================================================

    const gscMetrics = (evidencePayload.metrics || []).filter(m => m.source === 'search_console');
    const insights = evidencePayload.insights || [];

    // Note: Current googleTelemetry doesn't provide query-level data with full keyword stats
    // We're setting topKeywords to undefined since we don't have the required fields
    // This could be enhanced when query-level Search Console data is added
    const topKeywords = undefined; // Would need query-level data from GSC API

    const clicksMetric = gscMetrics.find(m => m.id === 'gsc_clicks_28d');
    const impressionsMetric = gscMetrics.find(m => m.id === 'gsc_impressions_28d');
    const ctrMetric = gscMetrics.find(m => m.id === 'gsc_ctr_28d');
    const positionMetric = gscMetrics.find(m => m.id === 'gsc_position_28d');

    // Coverage issues from insights (mapped to simplified structure)
    const highSeverityInsights = insights.filter(
      i => i.source === 'search_console' && i.severity === 'High'
    );
    const coverageIssues = highSeverityInsights.length > 0
      ? highSeverityInsights.map(i => ({
          type: i.tag || 'Unknown',
          affectedPages: 1, // Unknown from current data
        }))
      : undefined;

    // Indexing status - not available in current telemetry
    const indexingStatus = undefined;

    // CTR anomalies from insights
    const ctrOpportunityInsights = insights.filter(
      i => i.id === 'insight_ctr_opportunity' || i.id === 'insight_low_ctr'
    );
    const ctrAnomalies = ctrOpportunityInsights.length > 0
      ? ctrOpportunityInsights.map(i => ({
          page: i.metricIds?.[0] || 'unknown',
          expectedCtr: 3.0, // Placeholder - would calculate from position
          actualCtr: ctrMetric ? Number(ctrMetric.value) : 0,
          issue: i.headline || i.detail || 'CTR below expected',
        }))
      : undefined;

    const searchConsoleIntegration: SearchConsoleIntegration = {
      connected: gscMetrics.length > 0,
      topKeywords: undefined, // Not available from current telemetry data
      coverageIssues,
      indexingStatus: undefined, // Not available from current telemetry data
      ctrAnomalies,
    };

    console.log(`[Analytics Integrations V5.10-12] ✓ Search Console connected: ${searchConsoleIntegration.connected} (${gscMetrics.length} metrics)`);

    // ========================================================================
    // Heatmap Integration (not implemented yet)
    // ========================================================================

    const heatmapIntegration: HeatmapIntegration = {
      connected: false,
      tool: undefined,
      scrollDepth: undefined,
      rageClicks: undefined,
      deadClicks: undefined,
      exitZones: undefined,
    };

    console.log('[Analytics Integrations V5.10-12] ✓ Analytics integration complete');

    return {
      ga4: ga4Integration,
      searchConsole: searchConsoleIntegration,
      heatmap: heatmapIntegration,
    };
  } catch (error) {
    console.error('[Analytics Integrations V5.10-12] Error fetching analytics data:', error);

    // Return disconnected state on error
    return {
      ga4: {
        connected: false,
        pageMetrics: undefined,
        funnelMetrics: undefined,
        engagementRate: undefined,
        topLandingPages: undefined,
      },
      searchConsole: {
        connected: false,
        topKeywords: undefined,
        coverageIssues: undefined,
        indexingStatus: undefined,
        ctrAnomalies: undefined,
      },
      heatmap: {
        connected: false,
        tool: undefined,
        scrollDepth: undefined,
        rageClicks: undefined,
        deadClicks: undefined,
        exitZones: undefined,
      },
    };
  }
}

// ============================================================================
// PHASE 3: GRADE HISTORY TRACKING (V5.13)
// ============================================================================

import type { GradeHistoryEntry } from './websiteLab';

/**
 * Create grade history entry from current assessment (V5.13)
 */
export function createGradeHistoryEntry(
  siteAssessment: any,
  ctaIntelligence?: CtaIntelligence,
  contentIntelligence?: ContentIntelligence,
  trustAnalysis?: TrustAnalysis,
  visualBrandEvaluation?: VisualBrandEvaluation
): GradeHistoryEntry {
  console.log('[Grade History V5.13] Creating grade history entry...');

  const entry: GradeHistoryEntry = {
    timestamp: new Date().toISOString(),
    score: siteAssessment.score,
    benchmarkLabel: siteAssessment.benchmarkLabel || 'unknown',
    metrics: {
      funnelHealth: siteAssessment.funnelHealthScore,
      multiPageConsistency: siteAssessment.multiPageConsistencyScore,
      ctaQuality: ctaIntelligence?.summaryScore,
      contentClarity: contentIntelligence?.summaryScore,
      trustScore: trustAnalysis?.trustScore,
      visualScore: visualBrandEvaluation?.overallVisualScore,
    },
  };

  console.log(`[Grade History V5.13] ✓ Entry created: Score ${entry.score}/100`);

  return entry;
}
