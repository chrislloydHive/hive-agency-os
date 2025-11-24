/**
 * Section Analysis Helpers
 * 
 * Generate detailed analyses for each service area:
 * - Website & Conversion
 * - SEO & Visibility
 * - Content & Messaging
 * - Brand & Positioning
 */

import OpenAI from 'openai';
import { env } from '@/lib/env';
import type { AssessmentResult } from '@/lib/unified-assessment';
import type { SectionAnalysis, TechnicalSeoSignals, DataAvailability } from './types';
import type { SiteElementContext } from './html-context';
import type { ContentInventory } from './analyzeContentInventory';
import type { SiteFeatures } from '@/lib/eval/siteFeatures';
import type { MaturityLevel } from './detectMaturity';
import { formatSiteContextForPrompt, formatCompetitorContextsForPrompt, fetchHTMLForContext } from './html-context';
import * as cheerio from 'cheerio';
import { getPageSpeedScore } from '@/lib/ai';

// Lazy initialization to avoid build-time errors
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
      throw new Error(
        isProduction
          ? 'OpenAI API key not configured. Please set OPENAI_API_KEY in Vercel project settings (Settings → Environment Variables).'
          : 'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable in your .env.local file.'
      );
    }
    _openai = new OpenAI({
      apiKey,
      timeout: 60000, // 60 seconds per request for section narratives
    });
  }
  return _openai;
}

/**
 * Analyze Website & Conversion performance
 */
export async function analyzeWebsiteAndConversion(
  assessment: AssessmentResult,
  siteElementContext?: SiteElementContext,
  competitorContexts: SiteElementContext[] = [],
  dataAvailability?: DataAvailability,
  detectedMaturity?: MaturityLevel,
  siteFeatures?: SiteFeatures
): Promise<SectionAnalysis> {
  console.log('🔍 Analyzing Website & Conversion...');

  const extraction = assessment.extraction;
  const websiteScore = assessment.websiteScore;
  
  // Extract key elements
  const heroSection = {
    headline: extraction.hero_section?.headline_text || 'Not found',
    subheadline: extraction.hero_section?.subheadline_text || 'Not found',
    ctas: extraction.hero_section?.cta_buttons || [],
  };

  const navigation = {
    primary: extraction.navigation?.primary_nav_items || [],
    secondary: extraction.navigation?.secondary_nav_items || [],
  };

  const allCTAs = extraction.all_ctas || [];
  const sections = extraction.sections?.slice(0, 10).map(s => ({
    heading: s.heading,
    subheading: s.subheading,
    ctas: s.cta_buttons,
  })) || [];

  const systemPrompt = `You are a senior UX and conversion strategist evaluating a company's website.

You will receive:
- websiteUrl
- cleaned HTML snippets (hero section, main headings, nav labels, CTA labels, key sections)
- any numeric scores or performance indicators available
- SiteFeatures signals (deterministic CTA detection data)

Your job:
- Describe how well the site communicates value and guides visitors to action.
- Identify specific UX and conversion issues, not generic best practices.
- Call out specific pages or elements when possible (e.g. homepage hero, nav labels, footer, specific sections).

Return a JSON SectionAnalysis object with this EXACT structure:
{
  "label": "Website & Conversion",           // Section name (use exactly: "Website & Conversion")
  "score": 75,                               // 0-100 score for this area
  "grade": "B",                              // Letter grade: A (85+), B (70-84), C (50-69), D (30-49), F (0-29) OR descriptive: "Strong", "Developing", "Needs Work"
  "verdict": "Website shows strong conversion fundamentals but needs optimization in key areas.",  // 1 short sentence card-friendly summary
  "summary": "The website demonstrates solid UX foundations with clear navigation and multiple CTAs. However, conversion optimization opportunities exist in hero messaging clarity and form design. Mobile experience could be enhanced to match desktop quality.",  // 1-3 sentences
  "strengths": [                             // 2-5 concrete bullet points of what is working
    "Clear primary navigation with logical information architecture",
    "Multiple CTAs detected across key pages indicating conversion focus",
    "Above-the-fold CTA placement follows best practices"
  ],
  "issues": [                                // 3-5 concrete bullet points of main problems or gaps
    "Homepage hero headline lacks specific value proposition for target ICP",
    "Form fields could be reduced to decrease friction",
    "Mobile page speed scores below industry benchmarks"
  ],
  "recommendations": [                       // 3-7 actionable bullets
    "Rewrite hero headline to state clear, outcome-driven value proposition",
    "Reduce form fields from 7 to 3-4 essential fields",
    "Implement lazy loading for below-fold images to improve mobile performance",
    "Add trust signals (testimonials, logos) near primary CTA",
    "A/B test CTA button colors and copy for conversion lift"
  ],
  "impactEstimate": "High – optimizing conversion path will increase conversion from existing traffic by 15-25%."  // Impact assessment with context
}

SCORING CALIBRATION RULES:
- 0-49 = "Needs Work" (major problems, dysfunctional areas)
- 50-69 = "Developing" (underdeveloped, clear gaps)
- 70-84 = "Strong with gaps" (good foundation, optimization opportunities)
- 85+ = "Best-in-class" (excellent, minor optimizations only)

Reserve sub-50 scores for truly dysfunctional areas with obvious issues.
For clearly global/category-leading brands, scores should usually be 80+ unless there is strong contrary evidence.

VERDICT: Must be exactly 1 short sentence, card-friendly (under 100 characters ideal).

SUMMARY: 1-3 sentences maximum. Be specific and reference actual elements observed.

STRENGTHS/ISSUES/RECOMMENDATIONS: Must be specific and concrete. Avoid generic statements like "improve UX" or "add more CTAs". Instead say "Homepage lacks a clear primary CTA above the fold" or "Rewrite hero to emphasize category POV and add 1 primary CTA".

Respond with a single JSON object and nothing else. No markdown, no explanation.

Avoid generic or vague recommendations like 'improve UX' or 'add more CTAs'. Be concrete.

Do not repeat any finding that properly belongs to another section. If a finding overlaps with another domain, choose the one most closely aligned and omit it from this section.

────────────────────────────────────────
CTA LOGIC — CRITICAL NON-CONTRADICTION RULES
────────────────────────────────────────

You MUST respect the SiteFeatures CTA signals provided. These are deterministic detections from actual HTML parsing.

IF features.cta.heroCtaPresent === true OR features.cta.primaryCtaCount >= 1:

You MUST NOT say:
- "no call-to-action"
- "no clear CTA"
- "no actionable CTA"
- "lacks actionable CTAs"
- "no clear CTA on the homepage"
- "missing CTAs"
- "no conversion elements"

INSTEAD, treat CTAs as PRESENT and focus your feedback on:

QUALITY & CLARITY:
- Clarity of the CTA (who it's for, what happens next)
- Specificity of the CTA messaging
- Whether the CTA clearly communicates the next step

RELEVANCE & ALIGNMENT:
- Relevance of the CTA (demo vs free trial vs signup)
- Alignment to ICP/funnel stage
- Whether the CTA matches visitor intent

HIERARCHY & PLACEMENT:
- Single CTA vs secondary paths
- Visual prominence and hierarchy
- Above-the-fold placement effectiveness
- Whether competing CTAs create confusion

REFINEMENT LANGUAGE (when CTAs exist):
- "The hero includes '[CTA label]' - consider clarifying who this is for..."
- "Navigation includes a CTA - ensure it stands out visually..."
- "Consider refining CTA messaging to better align with [ICP segment]..."
- "The site has [X] CTAs detected - evaluate whether multiple CTAs compete or complement..."

IF features.cta.ctaButtonCount > 10:
- Focus on whether CTAs are overwhelming, competing, or misaligned
- Do NOT say they are missing
- Consider: "With [X] CTAs detected, evaluate if they create choice paralysis or if they're strategically placed for different visitor segments"

IF features.cta.heroCtaPresent === true OR features.cta.primaryCtaCount > 0:
- Treat CTAs as PRESENT
- Focus feedback on quality, clarity, prominence, hierarchy, or specificity
- NOT on their existence

────────────────────────────────────────

MATURITY-BASED TONE ADJUSTMENT:
Use the detected maturity level to control tone:
- If detectedMaturity is "category-leader" or "mature": Use refinement language ("opportunities to enhance", "could optimize"), NOT fundamental deficiency language ("lacks", "weak", "missing basics")
- If detectedMaturity is "established": Use constructive language ("could be strengthened", "opportunities to improve")
- If detectedMaturity is "growing" or "early-stage": Can use more direct improvement-focused language

FALLBACK BEHAVIOR:
If dataAvailability.siteCrawl.coverageLevel is 'minimal', you MUST:
- Focus only on what is clearly visible in the homepage context.
- Avoid drawing conclusions about pages or flows you have not seen.
- Use language like 'On the pages we could access...' or 'Based on the homepage...' instead of absolute statements.
- Do NOT assume missing sections (blog, case studies, etc.) unless they are clearly absent from the navigation and context.

If coverageLevel is 'partial', acknowledge that analysis is based on limited page coverage and focus on what was observed.`;

  const siteContextText = siteElementContext ? formatSiteContextForPrompt(siteElementContext) : '';
  const competitorContextText = competitorContexts.length > 0 ? formatCompetitorContextsForPrompt(competitorContexts) : '';

  const dataAvailabilitySummary = dataAvailability ? {
    siteCoverageLevel: dataAvailability.siteCrawl.coverageLevel,
    pagesAnalyzed: dataAvailability.siteCrawl.successfulUrls.length,
  } : null;

  // Build structured website analysis input with CTA features and other signals
  const websiteAnalysisInput = siteFeatures ? {
    url: assessment.url,
    features: {
      cta: {
        primaryCtaCount: siteFeatures.ux.primaryCtaCount,
        ctaButtonCount: siteFeatures.conversions.ctaButtonCount,
        heroCtaPresent: siteFeatures.ux.heroCtaPresent,
        heroCtaLabels: siteFeatures.ux.heroCtaLabels,
        navCtaPresent: siteFeatures.ux.navCtaPresent,
        stickyCtaPresent: siteFeatures.ux.stickyCtaPresent,
        hasAboveTheFoldCTA: siteFeatures.ux.hasAboveTheFoldCTA,
        hasSignupOrDemoCTA: siteFeatures.conversions.hasSignupOrDemoCTA,
        hasFreeTrialOrGetStarted: siteFeatures.conversions.hasFreeTrialOrGetStarted,
      },
      hero: {
        headlineTextLength: siteFeatures.ux.heroHeadlineTextLength,
        hasSubheadline: siteFeatures.ux.heroHasSubheadline,
        ctaPresent: siteFeatures.ux.heroCtaPresent,
        ctaLabels: siteFeatures.ux.heroCtaLabels,
      },
      navigation: {
        navItemLabels: siteFeatures.navigation.navItemLabels,
        hasProductNav: siteFeatures.navigation.hasProductNav,
        hasSolutionsNav: siteFeatures.navigation.hasSolutionsNav,
        hasResourcesNav: siteFeatures.navigation.hasResourcesNav,
        hasPricingNav: siteFeatures.navigation.hasPricingNav,
        hasBlogNav: siteFeatures.navigation.hasBlogNav,
        hasDocsNav: siteFeatures.navigation.hasDocsNav,
        ctaPresent: siteFeatures.ux.navCtaPresent,
      },
      conversion: {
        formCount: siteFeatures.conversions.formCount,
        hasNewsletterOrLeadMagnet: siteFeatures.conversions.hasNewsletterOrLeadMagnet,
        hasClearContactOrDemoEntry: siteFeatures.ux.hasClearContactOrDemoEntry,
      },
      ux: {
        hasStickyNav: siteFeatures.ux.hasStickyNav,
        hasAboveTheFoldCTA: siteFeatures.ux.hasAboveTheFoldCTA,
      },
    },
    scorecard: {
      overall: websiteScore,
      website: websiteScore,
    },
  } : null;

  // Debug log the structured input (dev mode only)
  if (process.env.NODE_ENV !== 'production' && websiteAnalysisInput) {
    console.info('[websiteAnalysisInput]', JSON.stringify(websiteAnalysisInput, null, 2));
  }

  // Build CTA features summary text for the prompt
  const ctaFeaturesText = websiteAnalysisInput ? `
CTA Detection Signals (deterministic from HTML parsing):
- Primary CTA Count: ${websiteAnalysisInput.features.cta.primaryCtaCount}
- Total CTA Button Count: ${websiteAnalysisInput.features.cta.ctaButtonCount}
- Hero CTA Present: ${websiteAnalysisInput.features.cta.heroCtaPresent ? 'Yes' : 'No'}
${websiteAnalysisInput.features.cta.heroCtaPresent && websiteAnalysisInput.features.cta.heroCtaLabels.length > 0 ? `- Hero CTA Labels: ${websiteAnalysisInput.features.cta.heroCtaLabels.map(l => `"${l}"`).join(', ')}` : ''}
- Navigation CTA Present: ${websiteAnalysisInput.features.cta.navCtaPresent ? 'Yes' : 'No'}
- Sticky/Floating CTA Present: ${websiteAnalysisInput.features.cta.stickyCtaPresent ? 'Yes' : 'No'}
- Above-the-fold CTA: ${websiteAnalysisInput.features.cta.hasAboveTheFoldCTA ? 'Yes' : 'No'}
- Signup/Demo CTA: ${websiteAnalysisInput.features.cta.hasSignupOrDemoCTA ? 'Yes' : 'No'}
- Free Trial/Get Started CTA: ${websiteAnalysisInput.features.cta.hasFreeTrialOrGetStarted ? 'Yes' : 'No'}

Hero Structure:
- Headline Length: ${websiteAnalysisInput.features.hero.headlineTextLength} characters
- Has Subheadline: ${websiteAnalysisInput.features.hero.hasSubheadline ? 'Yes' : 'No'}
- CTA Present: ${websiteAnalysisInput.features.hero.ctaPresent ? 'Yes' : 'No'}

Navigation Structure:
- Nav Items: ${websiteAnalysisInput.features.navigation.navItemLabels.length} items (${websiteAnalysisInput.features.navigation.navItemLabels.slice(0, 5).join(', ')}${websiteAnalysisInput.features.navigation.navItemLabels.length > 5 ? '...' : ''})
- Has Product Nav: ${websiteAnalysisInput.features.navigation.hasProductNav ? 'Yes' : 'No'}
- Has Solutions Nav: ${websiteAnalysisInput.features.navigation.hasSolutionsNav ? 'Yes' : 'No'}
- Has Resources Nav: ${websiteAnalysisInput.features.navigation.hasResourcesNav ? 'Yes' : 'No'}
- Has Pricing Nav: ${websiteAnalysisInput.features.navigation.hasPricingNav ? 'Yes' : 'No'}
- Nav CTA Present: ${websiteAnalysisInput.features.navigation.ctaPresent ? 'Yes' : 'No'}

Conversion Elements:
- Form Count: ${websiteAnalysisInput.features.conversion.formCount}
- Newsletter/Lead Magnet: ${websiteAnalysisInput.features.conversion.hasNewsletterOrLeadMagnet ? 'Yes' : 'No'}
- Clear Contact/Demo Entry: ${websiteAnalysisInput.features.conversion.hasClearContactOrDemoEntry ? 'Yes' : 'No'}

IMPORTANT: These CTA signals are extracted from actual HTML. Do NOT contradict them.
If primaryCtaCount > 0 or ctaButtonCount > 0, acknowledge CTAs exist and focus on optimization, not addition.
If heroCtaPresent === true, do NOT say "no clear CTA on the homepage".
If navCtaPresent === true, acknowledge the navigation CTA exists.
` : '';

  const userPrompt = `Analyze the Website & Conversion performance:

Website: ${assessment.url}
Current Score: ${websiteScore}/100
${detectedMaturity ? `Detected Maturity: ${detectedMaturity} - Adjust tone accordingly (refinement language for mature/category-leader, direct language for growing/early-stage)` : ''}

${dataAvailabilitySummary ? `Data Availability:
- Site Coverage: ${dataAvailabilitySummary.siteCoverageLevel} (${dataAvailabilitySummary.pagesAnalyzed} page(s) analyzed)
` : ''}

${siteContextText ? `\nSite Structure & Elements:\n${siteContextText}\n` : ''}${competitorContextText}

${ctaFeaturesText}

Hero Section:
- Headline: "${heroSection.headline}"
- Subheadline: "${heroSection.subheadline}"
- CTAs: ${heroSection.ctas.map(c => `"${c}"`).join(', ') || 'None found'}

Navigation:
- Primary: ${navigation.primary.join(', ') || 'None'}
- Secondary: ${navigation.secondary.join(', ') || 'None'}

All CTAs Found:
${allCTAs.map(c => `- "${c}"`).join('\n') || '- None found'}

Key Sections:
${sections.map((s, i) => `Section ${i + 1}:
  Heading: "${s.heading}"
  Subheading: "${s.subheading}"
  CTAs: ${s.ctas.join(', ') || 'None'}`).join('\n\n') || 'No sections found'}

Trust Signals:
- Testimonials: ${extraction.trust_signals?.testimonials_visible?.length || 0} visible
- Reviews: ${extraction.trust_signals?.review_counts_visible || 'Not found'}
- Logos: ${extraction.trust_signals?.logos_visible?.length || 0} visible

Value Propositions:
${extraction.value_props?.map(vp => `- ${vp}`).join('\n') || '- None found'}

Provide concrete, site-specific analysis referencing actual elements from this website.`;

  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
      max_tokens: 1000, // Reduced for faster response
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('No content from OpenAI');

    const parsed = JSON.parse(content) as SectionAnalysis;
    
    // Ensure rich format fields are present
    const verdict = parsed.verdict || parsed.summary?.split('.')[0] + '.' || 'Website shows promise but needs optimization.';
    const summary = parsed.summary || '';
    const strengths = Array.isArray(parsed.strengths) ? parsed.strengths : [];
    const issues = Array.isArray(parsed.issues) ? parsed.issues : [];
    const recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
    const impactEstimate = parsed.impactEstimate || 'Medium';

    return {
      label: parsed.label || 'Website & Conversion',
      score: parsed.score ?? websiteScore,
      grade: parsed.grade || (parsed.score >= 85 ? 'A' : parsed.score >= 70 ? 'B' : parsed.score >= 50 ? 'C' : 'D'),
      cardLevel: parsed.cardLevel || {
        verdict,
        summary,
      },
      deepDive: parsed.deepDive || {
        strengths,
        issues,
        recommendations,
        impactEstimate,
      },
      verdict,
      summary,
      strengths,
      issues,
      recommendations,
      impactEstimate,
      // Legacy fields for backward compatibility
      keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings : [],
      quickWins: Array.isArray(parsed.quickWins) ? parsed.quickWins : [],
      deeperInitiatives: Array.isArray(parsed.deeperInitiatives) ? parsed.deeperInitiatives : [],
    };
  } catch (error) {
    console.error('❌ Error analyzing Website & Conversion:', error);
    return {
      label: 'Website & Conversion',
      score: websiteScore,
      grade: websiteScore >= 85 ? 'A' : websiteScore >= 70 ? 'B' : websiteScore >= 50 ? 'C' : 'D',
      cardLevel: {
        verdict: 'Website analysis failed.',
        summary: `Website conversion score is ${websiteScore}/100. Analysis failed.`,
      },
      deepDive: {
        strengths: [],
        issues: [],
        recommendations: [],
        impactEstimate: 'Medium',
      },
      verdict: 'Website analysis failed.',
      summary: `Website conversion score is ${websiteScore}/100. Analysis failed.`,
      strengths: [],
      issues: [],
      recommendations: [],
      impactEstimate: 'Medium',
      keyFindings: [],
      quickWins: [],
      deeperInitiatives: [],
    };
  }
}

/**
 * Extract technical SEO signals from HTML and assessment data
 */
export async function extractTechnicalSeoSignals(
  url: string,
  assessment: AssessmentResult | undefined | null,
  siteElementContext?: SiteElementContext
): Promise<TechnicalSeoSignals> {
  // Hard guard: if assessment is missing, return safe defaults
  if (!assessment) {
    console.warn('[extractTechnicalSeoSignals] Assessment is missing, returning fallback TechnicalSeoSignals');
    return {
      notes: ['Technical SEO analysis ran in fallback mode because assessment data was missing. Limited analysis available.'],
    };
  }
  
  const signals: TechnicalSeoSignals = {};
  const extraction = assessment?.extraction ?? {};
  const notes: string[] = [];
  
  // Get PageSpeed/Lighthouse data
  try {
    const pageSpeedResult = await getPageSpeedScore(url);
    signals.lighthousePerformanceScore = pageSpeedResult.performance;
    notes.push(`Lighthouse performance score: ${pageSpeedResult.performance}`);
    // Note: Lighthouse SEO score would need to be fetched separately if available
  } catch (error) {
    console.warn('Could not fetch PageSpeed data:', error);
    notes.push('Lighthouse data not available');
  }
  
  // Extract meta tag information from HTML
  try {
    const html = siteElementContext?.pages[0] 
      ? await fetchHTMLForContext(siteElementContext.pages[0].pageUrl)
      : await fetchHTMLForContext(url);
    
    if (html) {
      const $ = cheerio.load(html);
      
      // Check for title tag
      const title = $('title').text().trim();
      const hasTitle = title.length > 0;
      
      // Check for meta description
      const metaDescription = $('meta[name="description"]').attr('content') || '';
      const hasMetaDescription = metaDescription.length > 0;
      
      // Determine if meta tags are present
      signals.metaTagsPresent = hasTitle && hasMetaDescription;
      
      // Count H1 tags - only set if we actually found multiple
      const h1Count = $('h1').length;
      signals.hasMultipleH1 = h1Count > 1;
      if (h1Count > 1) {
        notes.push(`Found ${h1Count} H1 tags on page`);
      }
      
      // Check for canonical tag issues
      const canonical = $('link[rel="canonical"]').attr('href');
      signals.hasCanonicalTagIssues = !canonical;
      if (!canonical) {
        notes.push('No canonical tag found');
      }
      
      // Count internal links (approximate - links to same domain)
      try {
        const baseUrl = new URL(url);
        const internalLinks = $('a[href]').filter((_, el) => {
          const href = $(el).attr('href');
          if (!href) return false;
          try {
            const linkUrl = new URL(href, url);
            return linkUrl.hostname === baseUrl.hostname;
          } catch {
            // Relative links are internal
            return href.startsWith('/') || href.startsWith('#');
          }
        }).length;
        signals.internalLinkCount = internalLinks;
        notes.push(`Approximate internal link count: ${internalLinks}`);
      } catch (error) {
        // Could not count internal links
      }
      
      // Check for robots directives
      const robotsMeta = $('meta[name="robots"]').attr('content') || '';
      const indexabilityIssues: string[] = [];
      if (robotsMeta.toLowerCase().includes('noindex')) {
        indexabilityIssues.push('noindex directive found');
      }
      if (robotsMeta.toLowerCase().includes('nofollow')) {
        indexabilityIssues.push('nofollow directive found');
      }
      if (indexabilityIssues.length > 0) {
        signals.indexabilityIssues = indexabilityIssues;
      }
    }
  } catch (error) {
    console.warn('Could not extract technical SEO signals from HTML:', error);
    notes.push('HTML parsing failed - limited technical signals available');
    
    // Fallback: use extraction data if available (but be conservative)
    if (extraction?.meta?.title) {
      signals.metaTagsPresent = true;
      // Do NOT set hasMultipleH1 or hasCanonicalTagIssues from extraction alone
      // Only set what we can confirm
    }
  }
  
  if (notes.length > 0) {
    signals.notes = notes;
  }
  
  return signals;
}

/**
 * Analyze SEO & Visibility
 */
export async function analyzeSeoAndVisibility(
  assessment: AssessmentResult,
  siteElementContext?: SiteElementContext,
  competitorContexts: SiteElementContext[] = [],
  contentInventory?: ContentInventory,
  technicalSignals?: TechnicalSeoSignals,
  dataAvailability?: DataAvailability,
  detectedMaturity?: MaturityLevel
): Promise<SectionAnalysis> {
  console.log('🔍 Analyzing SEO & Visibility...');

  const extraction = assessment.extraction;
  const contentScore = assessment.contentScore;
  
  // Extract technical SEO signals if not provided
  const technicalSeoSignals = technicalSignals || await extractTechnicalSeoSignals(assessment.url, assessment, siteElementContext);
  console.log('📊 Technical SEO signals:', {
    lighthousePerformance: technicalSeoSignals.lighthousePerformanceScore,
    hasMultipleH1: technicalSeoSignals.hasMultipleH1,
    hasCanonicalTagIssues: technicalSeoSignals.hasCanonicalTagIssues,
    metaTagsPresent: technicalSeoSignals.metaTagsPresent,
    internalLinkCount: technicalSeoSignals.internalLinkCount,
  });
  
  const systemPrompt = `You are an SEO specialist evaluating search visibility and technical SEO.

You will receive:
- a scorecard
- content/site structure context
- TechnicalSeoSignals (as structured JSON with real numeric values and booleans)

STRICT RULES - DO NOT GUESS:

- You may ONLY mention technical SEO issues that are explicitly present in the 'technicalSeo' JSON you were given.

- If technicalSeo.hasMultipleH1 is false or undefined, you MUST NOT claim there are multiple H1s.

- If technicalSeo.hasCanonicalTagIssues is false or undefined, you MUST NOT mention canonical tag problems.

- If technicalSeo.internalLinkCount is undefined, you MUST NOT say there is 'no internal linking'. If it is defined and > 0, you MUST NOT claim there is zero internal linking.

- If lighthousePerformanceScore is undefined, you MUST NOT mention Lighthouse scores or performance numeric values.

- If indexabilityIssues is empty or undefined, you MUST NOT claim there are indexability or crawling problems.

- When data is missing, use language like 'Technical SEO was not fully evaluated due to limited signals' instead of inventing issues.

- If lighthousePerformanceScore is high (e.g., 90+ out of 100) and there are no serious meta/indexability issues, explicitly state that technical SEO is solid and do NOT invent generic warnings.

- You may still comment on on-page SEO and content gaps, but do not misrepresent technical health.

Return a JSON SectionAnalysis object with this EXACT structure:
{
  "label": "SEO & Visibility",              // Section name (use exactly: "SEO & Visibility")
  "score": 72,                              // 0-100 score for this area
  "grade": "B",                             // Letter grade: A (85+), B (70-84), C (50-69), D (30-49), F (0-29)
  "verdict": "SEO foundation is solid but content depth and visibility need improvement.",  // 1 short sentence
  "summary": "Technical SEO fundamentals are in place with proper meta tags and indexability. However, content depth for target keywords is limited and backlink profile needs strengthening. On-page optimization opportunities exist in heading structure and internal linking.",  // 1-3 sentences
  "strengths": [                            // 2-5 concrete bullets
    "Meta tags properly implemented across key pages",
    "Site is indexable with no major technical barriers",
    "Internal linking structure supports crawlability"
  ],
  "issues": [                               // 3-5 concrete bullets
    "Content depth insufficient for target keyword clusters",
    "Backlink profile lacks authority domains",
    "Heading hierarchy could better support keyword targeting"
  ],
  "recommendations": [                      // 3-7 actionable bullets
    "Create pillar content pages for 3-5 core keyword themes",
    "Develop 10-15 supporting blog posts linking to pillar pages",
    "Build 5-10 high-quality backlinks from industry publications",
    "Optimize H2/H3 structure to better target long-tail keywords",
    "Implement schema markup for key content types"
  ],
  "impactEstimate": "Medium – improving content depth and visibility will drive 20-40% organic traffic growth over 6 months."
}

SCORING CALIBRATION RULES:
- 0-49 = "Needs Work" (major technical issues, not indexable, etc.)
- 50-69 = "Developing" (basic SEO present but gaps in content/visibility)
- 70-84 = "Strong with gaps" (good foundation, optimization opportunities)
- 85+ = "Best-in-class" (excellent technical SEO + content depth + visibility)

Respond with a single JSON object and nothing else. No markdown, no explanation.

Do not repeat any finding that properly belongs to another section. If a finding overlaps with another domain, choose the one most closely aligned and omit it from this section.

FALLBACK BEHAVIOR:
If dataAvailability.technicalSeo.lighthouseAvailable is false, you MUST:
- Not mention Lighthouse scores.
- Not speculate about site speed or core web vitals.
- Say 'Technical SEO was not fully evaluated due to limited data' instead of inventing issues.

If dataAvailability.technicalSeo.metaTagsParsed is false, you MUST:
- Not claim specific meta tag issues unless explicitly present in TechnicalSeoSignals input.
- Use language like 'Meta tags were not fully evaluated' instead of assuming problems.

CRITICAL: Never claim multiple H1 tags, missing canonicals, or indexability problems unless they are explicitly present in the TechnicalSeoSignals input. Only flag issues that are clearly supported by the data provided.`;

  const siteContextText = siteElementContext ? formatSiteContextForPrompt(siteElementContext) : '';
  const competitorContextText = competitorContexts.length > 0 ? formatCompetitorContextsForPrompt(competitorContexts) : '';

  // Pass Technical SEO Signals as structured JSON
  const technicalSeoJson = JSON.stringify({
    lighthousePerformanceScore: technicalSeoSignals.lighthousePerformanceScore,
    lighthouseSeoScore: technicalSeoSignals.lighthouseSeoScore,
    hasMultipleH1: technicalSeoSignals.hasMultipleH1,
    hasCanonicalTagIssues: technicalSeoSignals.hasCanonicalTagIssues,
    internalLinkCount: technicalSeoSignals.internalLinkCount,
    metaTagsPresent: technicalSeoSignals.metaTagsPresent,
    indexabilityIssues: technicalSeoSignals.indexabilityIssues || [],
    notes: technicalSeoSignals.notes || [],
  }, null, 2);

  const dataAvailabilitySummary = dataAvailability ? {
    lighthouseAvailable: dataAvailability.technicalSeo.lighthouseAvailable,
    metaTagsParsed: dataAvailability.technicalSeo.metaTagsParsed,
    coreWebVitalsAvailable: dataAvailability.technicalSeo.coreWebVitalsAvailable,
  } : null;

  const userPrompt = `Analyze the SEO & Visibility:

Website: ${assessment.url}
Current Score: ${contentScore}/100

Technical SEO Signals (structured JSON - use ONLY these values):
${technicalSeoJson}

Data Availability Summary:
${dataAvailabilitySummary ? JSON.stringify(dataAvailabilitySummary, null, 2) : 'No data availability information'}

${siteContextText ? `\nSite Structure & Content Context:\n${siteContextText}\n` : ''}${competitorContextText}

On-Page SEO Elements:
- H1: "${extraction.seo_elements?.h1 || 'Not found'}"
- H2s: ${extraction.seo_elements?.h2_list?.slice(0, 10).map(h => `"${h}"`).join(', ') || 'None found'}
- H3s: ${extraction.seo_elements?.h3_list?.slice(0, 10).map(h => `"${h}"`).join(', ') || 'None found'}

Content Depth Indicators:
- Blog Posts: ${extraction.blogAnalysis?.postCount || 0}
- Posting Frequency: ${extraction.blogAnalysis?.postingFrequency || 'Unknown'}
- Latest Post: ${extraction.blogAnalysis?.latestPostDate || 'Unknown'}
- Topics: ${extraction.blogAnalysis?.topics?.join(', ') || 'None'}
- Feature Lists: ${extraction.content_depth_indicators?.feature_lists?.length || 0}
- Benefit Lists: ${extraction.content_depth_indicators?.benefit_lists?.length || 0}
- FAQs: ${extraction.content_depth_indicators?.faq_present ? 'Yes' : 'No'}

${contentInventory ? `Content Inventory:
- Blog Posts Found: ${contentInventory.blogPostsFound}
- Blog Categories: ${contentInventory.blogCategories.join(', ') || 'None'}
- Case Studies Found: ${contentInventory.caseStudiesFound}
- About Page Depth: ${contentInventory.aboutPageDepth}
- FAQ Present: ${contentInventory.faqPresent}
- Content Volume: ${contentInventory.contentVolume}
- Funnel Coverage: TOFU=${contentInventory.funnelStageCoverage.topOfFunnel}, MOFU=${contentInventory.funnelStageCoverage.middleOfFunnel}, BOFU=${contentInventory.funnelStageCoverage.bottomOfFunnel}
- Content Themes: ${contentInventory.contentThemes.join(', ') || 'None'}
- Content Gaps: ${contentInventory.contentGaps.join(', ') || 'None'}
` : ''}

${extraction.seo_elements?.schema_detected && extraction.seo_elements.schema_detected.length > 0 ? `- Schema Detected: ${extraction.seo_elements.schema_detected.join(', ')}` : ''}
${extraction.seo_elements?.internal_links_detected ? `- Internal Links: ${extraction.seo_elements.internal_links_detected.length} detected` : ''}

Provide SEO analysis that:
1. Clearly states technical SEO status based ONLY on TechnicalSeoSignals data
2. Separates technical issues from content/visibility opportunities
3. Does NOT invent issues when technical signals are strong
4. Focuses on what is actually measured, not speculation`;

  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
      max_tokens: 1000, // Reduced for faster response
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('No content from OpenAI');

    const parsed = JSON.parse(content) as SectionAnalysis;
    
    // Ensure rich format fields are present
    const verdict = parsed.verdict || parsed.summary?.split('.')[0] + '.' || 'SEO foundation needs improvement.';
    const summary = parsed.summary || '';
    const strengths = Array.isArray(parsed.strengths) ? parsed.strengths : [];
    const issues = Array.isArray(parsed.issues) ? parsed.issues : [];
    const recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
    const impactEstimate = parsed.impactEstimate || 'Medium';

    return {
      label: parsed.label || 'SEO & Visibility',
      score: parsed.score ?? contentScore,
      grade: parsed.grade || (parsed.score >= 85 ? 'A' : parsed.score >= 70 ? 'B' : parsed.score >= 50 ? 'C' : 'D'),
      cardLevel: parsed.cardLevel || {
        verdict,
        summary,
      },
      deepDive: parsed.deepDive || {
        strengths,
        issues,
        recommendations,
        impactEstimate,
      },
      verdict,
      summary,
      strengths,
      issues,
      recommendations,
      impactEstimate,
      // Legacy fields for backward compatibility
      keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings : [],
      quickWins: Array.isArray(parsed.quickWins) ? parsed.quickWins : [],
      deeperInitiatives: Array.isArray(parsed.deeperInitiatives) ? parsed.deeperInitiatives : [],
    };
  } catch (error) {
    console.error('❌ Error analyzing SEO & Visibility:', error);
    return {
      label: 'SEO & Visibility',
      score: contentScore,
      grade: contentScore >= 85 ? 'A' : contentScore >= 70 ? 'B' : contentScore >= 50 ? 'C' : 'D',
      cardLevel: {
        verdict: 'SEO analysis failed.',
        summary: `SEO visibility score is ${contentScore}/100. Analysis failed.`,
      },
      deepDive: {
        strengths: [],
        issues: [],
        recommendations: [],
        impactEstimate: 'Medium',
      },
      verdict: 'SEO analysis failed.',
      summary: `SEO visibility score is ${contentScore}/100. Analysis failed.`,
      strengths: [],
      issues: [],
      recommendations: [],
      impactEstimate: 'Medium',
      keyFindings: [],
      quickWins: [],
      deeperInitiatives: [],
    };
  }
}

/**
 * Analyze Content & Messaging
 */
export async function analyzeContentAndMessaging(
  assessment: AssessmentResult,
  siteElementContext?: SiteElementContext,
  competitorContexts: SiteElementContext[] = [],
  contentInventory?: ContentInventory,
  dataAvailability?: DataAvailability,
  features?: SiteFeatures,
  detectedMaturity?: MaturityLevel
): Promise<SectionAnalysis> {
  console.log('🔍 Analyzing Content & Messaging...');

  const extraction = assessment.extraction;
  const contentScore = assessment.contentScore;
  
  // Extract SiteFeatures.content signals if available
  const contentSignals = features?.content;
  const hasBlog = contentSignals?.hasBlog ?? false;
  const blogPostCount = contentSignals?.blogPostCount ?? 0;
  const hasResourcesHub = contentSignals?.hasResourcesHub ?? false;
  const hasCaseStudiesSection = contentSignals?.hasCaseStudiesSection ?? false;
  const caseStudyCount = contentSignals?.caseStudyCount ?? 0;
  const hasDocsOrGuides = contentSignals?.hasDocsOrGuides ?? false;
  const coverageLevel = dataAvailability?.siteCrawl?.coverageLevel ?? 'unknown';

  const systemPrompt = `You are a content strategist analyzing the company's content depth and messaging execution.

You must focus on:
- messaging clarity
- narrative coherence
- content depth and authority
- content funnel coverage (TOFU/MOFU/BOFU)
- blog consistency and themes
- case study quality
- keyword/topic alignment
- evidence, proof, and demonstration
- thought leadership opportunities

You are NOT allowed to:
- comment on brand positioning
- describe value prop differentiation
- discuss visual identity
- make broad brand statements

All recommendations must relate to content execution and messaging depth.

CRITICAL: CONTENT SIGNALS TRUTH RULES
You will receive contentSignals data that reflects detected content from navigation, links, and crawled pages. You MUST respect these signals:

- If contentSignals.hasBlog is true, you MUST acknowledge the blog exists. NEVER say "there is no blog" or "the site lacks a blog". Instead, comment on blog depth, consistency, themes, or quality.

- If contentSignals.blogPostCount > 0, you MUST acknowledge blog posts exist. NEVER claim there are no blog posts. Instead, comment on volume, recency, topic coverage, or storytelling quality.

- If contentSignals.hasCaseStudiesSection is true OR contentSignals.caseStudyCount > 0, you MUST acknowledge case studies exist. NEVER say "there are no case studies" or "case studies are missing". Instead, comment on their depth, storytelling quality, proof value, or funnel coverage.

- If contentSignals.hasResourcesHub is true, you MUST acknowledge the resources hub exists. Comment on its breadth, organization, or educational value.

- If contentSignals.hasDocsOrGuides is true, acknowledge documentation exists and comment on its depth or accessibility.

- When contentSignals indicate presence but you see limited detail in the reviewed pages, use phrases like:
  * "While the site includes a blog and case studies, the reviewed pages suggest..."
  * "The content engine appears strong but may benefit from..."
  * "Based on a limited snapshot, there are opportunities to..."
  * "In the pages reviewed, the content shows..."

- Shift critique from "absence" to "refinement" for mature content engines. Instead of "missing blog", say "blog could be strengthened" or "content depth could be expanded".

- If coverageLevel is 'minimal' or 'partial', always qualify statements with "in the reviewed pages" or "based on the snapshot available" rather than making definitive claims about the entire site.

Return a JSON SectionAnalysis object with this EXACT structure:
{
  "label": "Content & Messaging",          // Section name (use exactly: "Content & Messaging")
  "score": 68,                             // 0-100 score for this area
  "grade": "C",                            // Letter grade: A (85+), B (70-84), C (50-69), D (30-49), F (0-29)
  "verdict": "Content shows promise but needs deeper execution and strategic focus.",  // 1 short sentence
  "summary": "Content foundation exists with blog and resource pages, but depth and consistency need improvement. Messaging could better align with ICP pain points. Content funnel coverage is incomplete with gaps in middle and bottom-of-funnel content.",  // 1-3 sentences
  "strengths": [                           // 2-5 concrete bullets
    "Blog section detected with regular publishing cadence",
    "Case studies present demonstrating proof points",
    "Messaging tone is consistent across pages"
  ],
  "issues": [                              // 3-5 concrete bullets
    "Content depth insufficient for thought leadership positioning",
    "Missing middle-of-funnel content addressing specific ICP challenges",
    "Blog topics lack clear strategic theme or keyword focus"
  ],
  "recommendations": [                     // 3-7 actionable bullets
    "Develop 5-7 pillar content pieces targeting core ICP pain points",
    "Create 15-20 supporting blog posts organized by topic clusters",
    "Add 3-5 bottom-of-funnel comparison guides or buyer's guides",
    "Establish editorial calendar with monthly themes aligned to sales cycle",
    "Repurpose top-performing content into multiple formats (video, infographics)"
  ],
  "impactEstimate": "High – deepening content strategy will improve lead quality and support longer sales cycles."
}

SCORING CALIBRATION RULES:
- 0-49 = "Needs Work" (minimal content, no blog, weak messaging)
- 50-69 = "Developing" (content exists but lacks depth/strategy)
- 70-84 = "Strong with gaps" (good content foundation, optimization opportunities)
- 85+ = "Best-in-class" (excellent content depth, consistency, and strategic alignment)

Respond with a single JSON object and nothing else. No markdown, no explanation.

Focus on content execution, messaging depth, and narrative coherence - NOT brand positioning or visual identity.

Do not repeat any finding that properly belongs to another section. If a finding overlaps with another domain, choose the one most closely aligned and omit it from this section.`;

  const siteContextText = siteElementContext ? formatSiteContextForPrompt(siteElementContext) : '';
  const competitorContextText = competitorContexts.length > 0 ? formatCompetitorContextsForPrompt(competitorContexts) : '';

  // Extract blog posts and case studies
  const blogPosts = siteElementContext?.blogPosts || [];
  const caseStudies = siteElementContext?.caseStudies || [];
  
  // Extract competitor content patterns
  const competitorBlogPosts: Array<{ title: string; url: string }> = [];
  const competitorCaseStudies: Array<{ title: string; url: string }> = [];
  competitorContexts.forEach(context => {
    competitorBlogPosts.push(...(context.blogPosts || []));
    competitorCaseStudies.push(...(context.caseStudies || []));
  });

  const dataAvailabilitySummary = dataAvailability ? {
    siteCoverageLevel: dataAvailability.siteCrawl.coverageLevel,
    blogDetected: dataAvailability.contentInventory.blogDetected,
    caseStudiesDetected: dataAvailability.contentInventory.caseStudiesDetected,
    aboutPageDetected: dataAvailability.contentInventory.aboutPageDetected,
    faqDetected: dataAvailability.contentInventory.faqDetected,
  } : null;

  const userPrompt = `Analyze the Content & Messaging (CONTENT EXECUTION FOCUS ONLY):

Website: ${assessment.url}
Current Score: ${contentScore}/100

${contentSignals ? `Content Signals (from navigation, links, and crawled pages):
- Has Blog: ${hasBlog ? 'Yes' : 'No'}${hasBlog ? ` (${blogPostCount} posts detected)` : ''}
- Has Resources Hub: ${hasResourcesHub ? 'Yes' : 'No'}
- Has Case Studies Section: ${hasCaseStudiesSection ? 'Yes' : 'No'}${hasCaseStudiesSection ? ` (${caseStudyCount} case studies detected)` : ''}
- Has Docs/Guides: ${hasDocsOrGuides ? 'Yes' : 'No'}
- Site Coverage Level: ${coverageLevel}

CRITICAL: These signals are based on actual detection from navigation, links, and crawled pages. 
- If "Has Blog" is true, you MUST acknowledge the blog exists and comment on its quality/depth, NOT claim it doesn't exist.
- If "Case Studies Section" is true or case study count > 0, you MUST acknowledge case studies exist and comment on their quality/depth, NOT claim they don't exist.
- Use cautious language like "in the reviewed pages" or "based on the snapshot available" when coverage is minimal or partial.
` : ''}

${dataAvailabilitySummary ? `Data Availability:
- Site Coverage: ${dataAvailabilitySummary.siteCoverageLevel}
- Blog Detected: ${dataAvailabilitySummary.blogDetected ? 'Yes' : 'No'}
- Case Studies Detected: ${dataAvailabilitySummary.caseStudiesDetected ? 'Yes' : 'No'}
- About Page Detected: ${dataAvailabilitySummary.aboutPageDetected ? 'Yes' : 'No'}
- FAQ Detected: ${dataAvailabilitySummary.faqDetected ? 'Yes' : 'No'}
` : ''}

${siteContextText ? `\nSite Structure & Elements:\n${siteContextText}\n` : ''}${competitorContextText}

Hero Messaging:
- Headline: "${extraction.hero_section?.headline_text || 'Not found'}"
- Subheadline: "${extraction.hero_section?.subheadline_text || 'Not found'}"

Value Propositions:
${extraction.value_props?.map(vp => `- ${vp}`).join('\n') || '- None found'}

All Headings:
${extraction.all_headings?.slice(0, 15).map(h => `- ${h}`).join('\n') || '- None found'}

Blog Posts Found (${blogPosts.length}):
${blogPosts.length > 0 ? blogPosts.slice(0, 15).map((post, i) => `  ${i + 1}. "${post.title}" - ${post.url}`).join('\n') : '  None found'}
${blogPosts.length > 15 ? `  ... and ${blogPosts.length - 15} more` : ''}

Case Studies Found (${caseStudies.length}):
${caseStudies.length > 0 ? caseStudies.slice(0, 10).map((study, i) => `  ${i + 1}. "${study.title}" - ${study.url}`).join('\n') : '  None found'}
${caseStudies.length > 10 ? `  ... and ${caseStudies.length - 10} more` : ''}

Content Depth Indicators:
- Feature Lists: ${extraction.content_depth_indicators?.feature_lists?.length || 0}
- Benefit Lists: ${extraction.content_depth_indicators?.benefit_lists?.length || 0}
- Case Study Snippets: ${extraction.content_depth_indicators?.case_study_snippets?.length || 0}
- FAQs: ${extraction.content_depth_indicators?.faq_present ? 'Yes' : 'No'}

Key Sections:
${extraction.sections?.slice(0, 5).map((s, i) => `Section ${i + 1}: "${s.heading}" - ${s.body_text.substring(0, 100)}...`).join('\n\n') || 'No sections found'}

${competitorBlogPosts.length > 0 ? `Competitor Blog Posts (${competitorBlogPosts.length}):
${competitorBlogPosts.slice(0, 10).map((post, i) => `  ${i + 1}. "${post.title}"`).join('\n')}
` : ''}

${competitorCaseStudies.length > 0 ? `Competitor Case Studies (${competitorCaseStudies.length}):
${competitorCaseStudies.slice(0, 10).map((study, i) => `  ${i + 1}. "${study.title}"`).join('\n')}
` : ''}

${contentInventory ? `Content Inventory:
- Blog Posts Found: ${contentInventory.blogPostsFound}
- Blog Categories: ${contentInventory.blogCategories.join(', ') || 'None'}
- Case Studies Found: ${contentInventory.caseStudiesFound}
- About Page Depth: ${contentInventory.aboutPageDepth}
- FAQ Present: ${contentInventory.faqPresent}
- Content Volume: ${contentInventory.contentVolume}
- Funnel Coverage: TOFU=${contentInventory.funnelStageCoverage.topOfFunnel}, MOFU=${contentInventory.funnelStageCoverage.middleOfFunnel}, BOFU=${contentInventory.funnelStageCoverage.bottomOfFunnel}
- Content Themes: ${contentInventory.contentThemes.join(', ') || 'None'}
- Content Gaps: ${contentInventory.contentGaps.join(', ') || 'None'}
` : ''}

Provide STRATEGIC content execution analysis focusing on:
- Messaging clarity and narrative coherence
- Content depth and authority (blog posts, case studies)
- Content funnel coverage (TOFU awareness, MOFU consideration, BOFU decision content)
- Blog consistency, themes, and topic coverage
- Case study quality and demonstration of value
- Keyword/topic alignment and SEO content strategy
- Evidence, proof points, and demonstration of claims
- Thought leadership opportunities vs competitors

DO NOT comment on brand positioning, value prop differentiation, or visual identity. Focus purely on content execution and messaging depth.`;

  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
      max_tokens: 1000, // Reduced for faster response
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('No content from OpenAI');

    const parsed = JSON.parse(content) as SectionAnalysis;
    
    // Ensure rich format fields are present
    const verdict = parsed.verdict || parsed.summary?.split('.')[0] + '.' || 'Content shows promise but needs improvement.';
    const summary = parsed.summary || '';
    const strengths = Array.isArray(parsed.strengths) ? parsed.strengths : [];
    const issues = Array.isArray(parsed.issues) ? parsed.issues : [];
    const recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
    const impactEstimate = parsed.impactEstimate || 'Medium';

    return {
      label: parsed.label || 'Content & Messaging',
      score: parsed.score ?? contentScore,
      grade: parsed.grade || (parsed.score >= 85 ? 'A' : parsed.score >= 70 ? 'B' : parsed.score >= 50 ? 'C' : 'D'),
      cardLevel: parsed.cardLevel || {
        verdict,
        summary,
      },
      deepDive: parsed.deepDive || {
        strengths,
        issues,
        recommendations,
        impactEstimate,
      },
      verdict,
      summary,
      strengths,
      issues,
      recommendations,
      impactEstimate,
      // Legacy fields for backward compatibility
      keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings : [],
      quickWins: Array.isArray(parsed.quickWins) ? parsed.quickWins : [],
      deeperInitiatives: Array.isArray(parsed.deeperInitiatives) ? parsed.deeperInitiatives : [],
    };
  } catch (error) {
    console.error('❌ Error analyzing Content & Messaging:', error);
    return {
      label: 'Content & Messaging',
      score: contentScore,
      grade: contentScore >= 85 ? 'A' : contentScore >= 70 ? 'B' : contentScore >= 50 ? 'C' : 'D',
      cardLevel: {
        verdict: 'Content analysis failed.',
        summary: `Content and messaging score is ${contentScore}/100. Analysis failed.`,
      },
      deepDive: {
        strengths: [],
        issues: [],
        recommendations: [],
        impactEstimate: 'Medium',
      },
      verdict: 'Content analysis failed.',
      summary: `Content and messaging score is ${contentScore}/100. Analysis failed.`,
      strengths: [],
      issues: [],
      recommendations: [],
      impactEstimate: 'Medium',
      keyFindings: [],
      quickWins: [],
      deeperInitiatives: [],
    };
  }
}

/**
 * Analyze Brand & Positioning
 */
export async function analyzeBrandAndPositioning(
  assessment: AssessmentResult,
  siteElementContext?: SiteElementContext,
  competitorContexts: SiteElementContext[] = [],
  competitorAnalysis?: Awaited<ReturnType<typeof import('./analyzeCompetitors').analyzeCompetitors>>,
  marketAnalysis?: Awaited<ReturnType<typeof import('./analyzeMarket').analyzeMarket>>,
  positioningAnalysis?: Awaited<ReturnType<typeof import('./analyzePositioning').analyzePositioning>>,
  dataAvailability?: DataAvailability,
  detectedMaturity?: MaturityLevel
): Promise<SectionAnalysis> {
  console.log('🔍 Analyzing Brand & Positioning...');

  const extraction = assessment.extraction;
  const brandScore = assessment.brandScore;
  
  const systemPrompt = `You are a senior brand strategist. Your job is to evaluate the company's *strategic brand positioning*, NOT their content execution or copy quality.

You must focus on:
- category clarity
- who the brand is for (ICP)
- differentiation vs competitors
- whether the value proposition is distinct
- market white-space opportunities
- clarity of brand promise
- credibility and trust signals
- visual identity cohesion and consistency

You are NOT allowed to:
- comment on blog depth
- comment on content execution
- suggest messaging rewrites
- list copywriting improvements
- comment on SEO issues
- comment on UX issues unless tied directly to brand perception

Keep this STRICTLY strategic.

Return a JSON SectionAnalysis object with this EXACT structure:
{
  "label": "Brand & Positioning",         // Section name (use exactly: "Brand & Positioning")
  "score": 65,                             // 0-100 score for this area
  "grade": "C",                            // Letter grade: A (85+), B (70-84), C (50-69), D (30-49), F (0-29)
  "verdict": "Brand positioning is clear but differentiation needs strengthening.",  // 1 short sentence
  "summary": "The brand communicates a clear value proposition and target audience, but differentiation from competitors is subtle. Positioning could be tightened to own a specific category or outcome. ICP clarity is present but could be more specific in messaging.",  // 1-3 sentences
  "strengths": [                           // 2-5 concrete bullets
    "Clear target audience identified in messaging",
    "Value proposition is articulated on key pages",
    "Brand voice is consistent across touchpoints"
  ],
  "issues": [                              // 3-5 concrete bullets
    "Differentiation from competitors is not clearly articulated",
    "Positioning statement lacks category ownership claim",
    "ICP messaging could be more specific to resonate with ideal customers"
  ],
  "recommendations": [                    // 3-7 actionable bullets
    "Develop a clear category POV that positions the brand as leader",
    "Rewrite hero headline to state specific outcome for target ICP",
    "Add 3-5 proof elements (logos, testimonials, metrics) near top of homepage",
    "Create positioning statement that differentiates from 2-3 key competitors",
    "Refine ICP messaging to be more specific about who the brand serves best"
  ],
  "impactEstimate": "High – tightening positioning will increase conversion from existing traffic by 20-30% and improve brand recall."
}

SCORING CALIBRATION RULES:
- 0-49 = "Needs Work" (unclear positioning, generic messaging, no differentiation)
- 50-69 = "Developing" (basic positioning present but needs refinement)
- 70-84 = "Strong with gaps" (good positioning, optimization opportunities)
- 85+ = "Best-in-class" (excellent positioning, clear differentiation, category leadership)

For clearly global/category-leading brands, scores should usually be 80+ unless there is strong contrary evidence.

Respond with a single JSON object and nothing else. No markdown, no explanation.

Focus on strategic positioning, differentiation, ICP clarity, and market positioning - NOT executional details.

Do not repeat any finding that properly belongs to another section. If a finding overlaps with another domain, choose the one most closely aligned and omit it from this section.

FALLBACK BEHAVIOR:
If dataAvailability.siteCrawl.coverageLevel is 'minimal', you MUST:
- Limit your conclusions to what is visible in the hero, nav, and top-level sections.
- Avoid claiming that ICP or geographic focus is 'not defined' unless there is clear evidence of generic messaging.
- Use cautious language (e.g., 'not clearly articulated on the pages we saw') rather than absolute statements.
- Do not assume brand positioning elements exist on pages we did not access.

CONTENT INVENTORY RULES (deterministic flags from crawled URLs):
- If dataAvailability.contentInventory.blogDetected is true, you may refer to the presence of a blog.
- If dataAvailability.contentInventory.blogDetected is false, you should say 'We did not detect a blog section in the URLs we crawled' rather than 'You do not have a blog', since it's possible we have incomplete coverage.
- Similarly for case studies and FAQs: use 'We did not detect...' language when flags are false, acknowledging potential incomplete coverage.
- These flags are based on actual URLs crawled, not LLM inference. Respect them as ground truth about what URLs we accessed.

HYPER-LOCAL POSITIONING RULES:
- If positioningAnalysis.geographicFocus or positioningAnalysis.localSearchLanguage indicate a hyper-local or neighborhood-based model, you MUST:
  - Explicitly reference that hyper-local model in your summary.
  - Acknowledge the neighborhood-focused positioning as a key strategic differentiator.
  - Discuss how this hyper-local focus impacts brand positioning and market approach.
  - Do NOT treat hyper-local positioning as a limitation - it is a strategic choice that should be emphasized.`;

  const siteContextText = siteElementContext ? formatSiteContextForPrompt(siteElementContext) : '';
  const competitorContextText = competitorContexts.length > 0 ? formatCompetitorContextsForPrompt(competitorContexts) : '';

  // Extract main page headings
  const mainPageHeadings = siteElementContext?.pages[0]?.headings || [];
  
  const dataAvailabilitySummary = dataAvailability ? {
    siteCoverageLevel: dataAvailability.siteCrawl.coverageLevel,
    competitorCount: dataAvailability.competitors.competitorCount,
    blogDetected: dataAvailability.contentInventory.blogDetected,
    caseStudiesDetected: dataAvailability.contentInventory.caseStudiesDetected,
    aboutPageDetected: dataAvailability.contentInventory.aboutPageDetected,
    faqDetected: dataAvailability.contentInventory.faqDetected,
  } : null;

  const userPrompt = `Analyze the Brand & Positioning (STRATEGIC FOCUS ONLY):

Website: ${assessment.url}
Current Score: ${brandScore}/100

${dataAvailabilitySummary ? `Data Availability:
- Site Coverage: ${dataAvailabilitySummary.siteCoverageLevel}
- Competitors Analyzed: ${dataAvailabilitySummary.competitorCount}
` : ''}

Main Page Headings:
${mainPageHeadings.length > 0 ? mainPageHeadings.slice(0, 10).map((h, i) => `  ${i + 1}. ${h}`).join('\n') : '  None found'}

${siteContextText ? `\nSite Structure & Elements:\n${siteContextText}\n` : ''}${competitorContextText}

Brand Messaging:
- Company Name: ${extraction.company_name || 'Not found'}
- Hero Headline: "${extraction.hero_section?.headline_text || 'Not found'}"
- Hero Subheadline: "${extraction.hero_section?.subheadline_text || 'Not found'}"

Value Propositions:
${extraction.value_props?.map(vp => `- ${vp}`).join('\n') || '- None found'}

Trust Signals:
- Testimonials Visible: ${extraction.trust_signals?.testimonials_visible?.length || 0}
- Review Counts: ${extraction.trust_signals?.review_counts_visible || 'Not found'}
- Logos Visible: ${extraction.trust_signals?.logos_visible?.join(', ') || 'None'}
- Awards Visible: ${extraction.trust_signals?.awards_visible?.join(', ') || 'None'}

Brand Authority:
- LinkedIn: ${extraction.brandAuthority?.linkedin?.url ? 'Found' : 'Not found'}
- Google Business Profile: ${extraction.brandAuthority?.gbp?.url ? 'Found' : 'Not found'}

Visual Identity:
- Design Notes: ${extraction.design_and_layout?.visual_hierarchy_notes || 'Not available'}

${competitorAnalysis ? `Competitor Analysis:
- Category Summary: ${competitorAnalysis.categorySummary}
- Positioning Patterns: ${competitorAnalysis.positioningPatterns.join('; ')}
- Messaging Comparison: ${competitorAnalysis.messagingComparison.join('; ')}
- Differentiation Opportunities: ${competitorAnalysis.differentiationOpportunities.join('; ')}
` : ''}

${marketAnalysis ? `Market Analysis:
- Category: ${marketAnalysis.category.toLowerCase().includes('error') || marketAnalysis.category.toLowerCase().includes('unavailable due to') ? 'Not evaluated (no market data available).' : marketAnalysis.category}
- ICP Profiles: ${marketAnalysis.ICPProfiles.join('; ')}
- Common Claims: ${marketAnalysis.commonClaims.join('; ')}
- Common Pain Points: ${marketAnalysis.commonPainPoints.join('; ')}
- Differentiation Whitespace: ${marketAnalysis.differentiationWhitespace.join('; ')}
` : ''}

${positioningAnalysis ? `Positioning Analysis:
- Primary Audience: ${positioningAnalysis.primaryAudience}
- Geographic Focus: ${positioningAnalysis.geographicFocus}
${positioningAnalysis.localSearchLanguage && positioningAnalysis.localSearchLanguage.length > 0 ? `- Local Search Language: ${positioningAnalysis.localSearchLanguage.join('; ')}` : ''}
- Core Positioning Statement: ${positioningAnalysis.corePositioningStatement}
- Key Themes: ${positioningAnalysis.keyThemes.join('; ')}
- Differentiation Signals: ${positioningAnalysis.differentiationSignals.join('; ')}
- Evidence: ${positioningAnalysis.evidenceFromSite.slice(0, 5).join('; ')}
${positioningAnalysis.geographicFocus.toLowerCase().includes('hyper-local') || positioningAnalysis.geographicFocus.toLowerCase().includes('neighborhood') || (positioningAnalysis.localSearchLanguage && positioningAnalysis.localSearchLanguage.length > 0) ? `
CRITICAL: This brand uses hyper-local/neighborhood-focused positioning. You MUST acknowledge this in your analysis and discuss how this geographic focus impacts brand strategy.` : ''}
` : ''}

Provide STRATEGIC brand positioning analysis focusing on:
- Category clarity and positioning
- ICP clarity (who is this brand for?)
- Differentiation vs competitors
- Value proposition distinctness
- Market white-space opportunities
- Brand promise clarity
- Strategic trust/credibility positioning
- Visual identity strategic coherence

DO NOT provide executional recommendations like copy edits, content depth, or SEO fixes.`;

  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
      max_tokens: 1000, // Reduced for faster response
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('No content from OpenAI');

    const parsed = JSON.parse(content) as SectionAnalysis;
    
    // Ensure rich format fields are present
    const verdict = parsed.verdict || parsed.summary?.split('.')[0] + '.' || 'Brand positioning needs strengthening.';
    const summary = parsed.summary || '';
    const strengths = Array.isArray(parsed.strengths) ? parsed.strengths : [];
    const issues = Array.isArray(parsed.issues) ? parsed.issues : [];
    const recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
    const impactEstimate = parsed.impactEstimate || 'Medium';

    return {
      label: parsed.label || 'Brand & Positioning',
      score: parsed.score ?? brandScore,
      grade: parsed.grade || (parsed.score >= 85 ? 'A' : parsed.score >= 70 ? 'B' : parsed.score >= 50 ? 'C' : 'D'),
      cardLevel: parsed.cardLevel || {
        verdict,
        summary,
      },
      deepDive: parsed.deepDive || {
        strengths,
        issues,
        recommendations,
        impactEstimate,
      },
      verdict,
      summary,
      strengths,
      issues,
      recommendations,
      impactEstimate,
      // Legacy fields for backward compatibility
      keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings : [],
      quickWins: Array.isArray(parsed.quickWins) ? parsed.quickWins : [],
      deeperInitiatives: Array.isArray(parsed.deeperInitiatives) ? parsed.deeperInitiatives : [],
    };
  } catch (error) {
    console.error('❌ Error analyzing Brand & Positioning:', error);
    return {
      label: 'Brand & Positioning',
      score: brandScore,
      grade: brandScore >= 85 ? 'A' : brandScore >= 70 ? 'B' : brandScore >= 50 ? 'C' : 'D',
      cardLevel: {
        verdict: 'Brand analysis failed.',
        summary: `Brand and positioning score is ${brandScore}/100. Analysis failed.`,
      },
      deepDive: {
        strengths: [],
        issues: [],
        recommendations: [],
        impactEstimate: 'Medium',
      },
      verdict: 'Brand analysis failed.',
      summary: `Brand and positioning score is ${brandScore}/100. Analysis failed.`,
      strengths: [],
      issues: [],
      recommendations: [],
      impactEstimate: 'Medium',
      keyFindings: [],
      quickWins: [],
      deeperInitiatives: [],
    };
  }
}

