// lib/gap/core.ts
/**
 * Core GAP functions for running GAP-IA and Full GAP analysis
 * Extracted from API handlers for use in scripts and tests
 */

import OpenAI from 'openai';
import type { CoreMarketingContext, GapIaRun } from '@/lib/gap/types';
import { collectDigitalFootprint } from '@/lib/digital-footprint/collectDigitalFootprint';
import {
  GAP_SHARED_SYSTEM_PROMPT,
  GAP_SHARED_REASONING_PROMPT,
} from '@/lib/gap/prompts/sharedPrompts';
import { GAP_IA_OUTPUT_PROMPT_V3 } from '@/lib/gap/prompts/gapIaOutputPromptV3';
import { FULL_GAP_OUTPUT_PROMPT_V3 } from '@/lib/gap/prompts/fullGapOutputPromptV3';
import {
  InitialAssessmentOutputSchema,
  type InitialAssessmentOutput,
  FullGapOutputSchema,
  type FullGapOutput,
} from '@/lib/gap/outputTemplates';
import { mapInitialAssessmentToApiResponse, mapFullGapToApiResponse } from '@/lib/gap/outputMappers';
import {
  GapIaV2AiOutputSchema,
  GapIaAiOutputSchema,
} from '@/lib/gap/schemas';
import {
  discoverCandidateUrls,
  fetchPageSnippets,
} from '@/lib/gap/urlDiscovery';
import type {
  MultiPageSnapshot,
  DiscoveredPageSnippet,
  ContentSignals,
} from '@/lib/gap/types';
import {
  getBusinessContext,
  type BusinessContext,
  type BusinessContextInput,
} from '@/lib/gap/contextualHeuristics';

// ============================================================================
// Helper Functions (extracted from route.ts)
// ============================================================================

/**
 * Normalize a URL to extract the domain
 */
export function normalizeDomain(url: string): string {
  try {
    if (!url || url.trim().length === 0) {
      throw new Error('Please enter a URL to analyze');
    }

    const urlObj = new URL(url);

    if (!urlObj.protocol.startsWith('http')) {
      throw new Error(
        `Invalid URL protocol "${urlObj.protocol}". Please use http:// or https:// URLs only`
      );
    }

    if (!urlObj.hostname || urlObj.hostname.length === 0) {
      throw new Error('Invalid URL: missing hostname');
    }

    if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1' || urlObj.hostname.endsWith('.local')) {
      throw new Error(
        'Local development URLs cannot be analyzed. Please use a publicly accessible URL.'
      );
    }

    return urlObj.hostname.replace(/^www\./, '');
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Invalid URL')) {
      throw new Error(
        `Invalid URL format. Please enter a complete URL including https://, like: https://example.com`
      );
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error(`Invalid URL: ${url}`);
  }
}

/**
 * Fetch HTML from a URL with a bounded response size
 */
export async function fetchHtmlBounded(
  url: string,
  maxBytes: number = 50000
): Promise<string> {
  console.log('[gap/core] Fetching HTML from:', url);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; HiveGapBot/1.0; +https://hivegrowth.com)',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error(
          `This website is blocking automated access (403 Forbidden)`
        );
      } else if (response.status === 401) {
        throw new Error(
          `This website requires authentication (401 Unauthorized)`
        );
      } else if (response.status === 429) {
        throw new Error(
          `Rate limit exceeded (429 Too Many Requests)`
        );
      } else if (response.status >= 500) {
        throw new Error(
          `The website's server is experiencing issues (${response.status})`
        );
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      throw new Error(`Not HTML: ${contentType}`);
    }

    const text = await response.text();
    const bounded = text.substring(0, maxBytes);

    console.log('[gap/core] Fetched HTML:', {
      url,
      length: text.length,
      bounded: bounded.length,
    });

    return bounded;
  } catch (error) {
    console.error('[gap/core] Failed to fetch HTML:', error);

    if (error instanceof Error && error.message.includes('website')) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        throw new Error(
          `Request timed out after 10 seconds. The website may be slow or unreachable.`
        );
      } else if (error.message.includes('ENOTFOUND') || error.message.includes('DNS')) {
        throw new Error(
          `Cannot find the website at this URL. Please check that the URL is correct.`
        );
      } else if (error.message.includes('ECONNREFUSED')) {
        throw new Error(
          `Connection refused by the website. The site may be down.`
        );
      }
    }

    throw new Error(
      `Failed to fetch ${url}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Extract basic signals from HTML
 */
export function extractHtmlSignals(html: string): {
  title?: string;
  h1s: string[];
  metaDescription?: string;
  hasNav: boolean;
  hasBlog: boolean;
  ctaCount: number;
  hasTestimonials: boolean;
  hasCaseStudies: boolean;
  hasAwardsOrBadges: boolean;
  brandTaglineSnippet?: string;
  hasResourceHub: boolean;
  hasPricingPage: boolean;
  contentTypeHints: string[];
} {
  const htmlLower = html.toLowerCase();

  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();

  const h1Matches = html.matchAll(/<h1[^>]*>([^<]+)<\/h1>/gi);
  const h1s = Array.from(h1Matches, (m) => m[1].trim()).slice(0, 5);

  const metaDescription = html
    .match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1]
    ?.trim();

  const hasNav =
    html.includes('<nav') ||
    html.includes('class="nav') ||
    html.includes('id="nav');

  const hasBlog =
    htmlLower.includes('blog') ||
    htmlLower.includes('article') ||
    htmlLower.includes('resources');

  const ctaCount = (
    html.match(
      /(?:contact|get started|sign up|try|demo|learn more|book|schedule)/gi
    ) || []
  ).length;

  const hasTestimonials =
    htmlLower.includes('testimonial') ||
    htmlLower.includes('what our clients say') ||
    htmlLower.includes('what customers say') ||
    htmlLower.includes('client reviews') ||
    htmlLower.includes('customer reviews') ||
    htmlLower.includes('"review"') ||
    htmlLower.includes('success stories');

  const hasCaseStudies =
    htmlLower.includes('case stud') ||
    htmlLower.includes('customer stor') ||
    htmlLower.includes('success stor');

  const hasAwardsOrBadges =
    htmlLower.includes('award') ||
    htmlLower.includes('recognized by') ||
    htmlLower.includes('as seen in') ||
    htmlLower.includes('certified') ||
    htmlLower.includes('featured in') ||
    htmlLower.includes('trusted by') ||
    htmlLower.includes('forbes') ||
    htmlLower.includes('inc.') ||
    htmlLower.includes('g2') ||
    htmlLower.includes('capterra');

  let brandTaglineSnippet: string | undefined;
  const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)?.[1]?.trim();
  if (ogDesc && ogDesc.length < 150) {
    brandTaglineSnippet = ogDesc;
  } else {
    const earlyHtml = html.substring(0, 5000);
    const h2Match = earlyHtml.match(/<h2[^>]*>([^<]{10,100})<\/h2>/i);
    if (h2Match) {
      brandTaglineSnippet = h2Match[1].trim();
    } else {
      const pMatch = earlyHtml.match(/<p[^>]*>([^<]{20,120})<\/p>/i);
      if (pMatch) {
        brandTaglineSnippet = pMatch[1].trim();
      }
    }
  }

  const hasResourceHub =
    htmlLower.includes('resource') ||
    htmlLower.includes('library') ||
    htmlLower.includes('knowledge base') ||
    htmlLower.includes('learning center') ||
    htmlLower.includes('documentation') ||
    htmlLower.includes('guides');

  const hasPricingPage =
    htmlLower.includes('pricing') ||
    htmlLower.includes('plans') ||
    htmlLower.includes('subscription') ||
    htmlLower.includes('packages');

  const contentTypeHints: string[] = [];
  if (htmlLower.includes('blog')) contentTypeHints.push('blog');
  if (htmlLower.includes('whitepaper') || htmlLower.includes('white paper')) contentTypeHints.push('whitepaper');
  if (htmlLower.includes('guide') || htmlLower.includes('how-to')) contentTypeHints.push('guide');
  if (htmlLower.includes('webinar') || htmlLower.includes('workshop')) contentTypeHints.push('webinar');
  if (htmlLower.includes('ebook') || htmlLower.includes('e-book')) contentTypeHints.push('ebook');
  if (hasCaseStudies) contentTypeHints.push('case-study');
  if (htmlLower.includes('podcast')) contentTypeHints.push('podcast');
  if (htmlLower.includes('video') || htmlLower.includes('youtube')) contentTypeHints.push('video');

  return {
    title,
    h1s,
    metaDescription,
    hasNav,
    hasBlog,
    ctaCount,
    hasTestimonials,
    hasCaseStudies,
    hasAwardsOrBadges,
    brandTaglineSnippet,
    hasResourceHub,
    hasPricingPage,
    contentTypeHints,
  };
}

/**
 * Apply brand-tier-based score floors
 */
function applyBrandTierFloors(core: CoreMarketingContext): CoreMarketingContext {
  const { brandTier } = core;

  const clamp = (value: number | undefined, min: number) =>
    value !== undefined ? Math.max(value, min) : min;

  if (brandTier === 'global_category_leader') {
    core.overallScore = clamp(core.overallScore, 85);
    core.marketingReadinessScore = clamp(core.marketingReadinessScore, 85);
    if (core.brand) {
      core.brand.brandScore = clamp(core.brand.brandScore, 90);
    }
    if (core.content) {
      core.content.contentScore = clamp(core.content.contentScore, 70);
    }
    if (core.seo) {
      core.seo.seoScore = clamp(core.seo.seoScore, 60);
    }
    if (core.website) {
      core.website.websiteScore = clamp(core.website.websiteScore, 70);
    }
  } else if (brandTier === 'enterprise') {
    core.overallScore = clamp(core.overallScore, 70);
    core.marketingReadinessScore = clamp(core.marketingReadinessScore, 70);
    if (core.brand) {
      core.brand.brandScore = clamp(core.brand.brandScore, 75);
    }
    if (core.content) {
      core.content.contentScore = clamp(core.content.contentScore, 60);
    }
  } else if (brandTier === 'mid_market') {
    core.overallScore = clamp(core.overallScore, 60);
    core.marketingReadinessScore = clamp(core.marketingReadinessScore, 60);
  }

  return core;
}

// ============================================================================
// OpenAI Client (standalone, no env validator)
// ============================================================================

/**
 * Get OpenAI client instance
 * Uses OPENAI_API_KEY from environment without validating other env vars
 */
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY environment variable is required. ' +
      'Please set it in your .env.local file.'
    );
  }

  return new OpenAI({
    apiKey,
    timeout: 120000, // 120 seconds (2 minutes) for complex analyses
  });
}

// ============================================================================
// Core GAP-IA Generator
// ============================================================================

export interface GapIaCoreInput {
  url: string;
  domain: string;
  html: string;
  signals: ReturnType<typeof extractHtmlSignals>;
  digitalFootprint: Awaited<ReturnType<typeof collectDigitalFootprint>>;
  multiPageSnapshot?: MultiPageSnapshot;
}

/**
 * Generate GAP-IA analysis (core function without Airtable writes)
 *
 * Uses InitialAssessmentPromptV3 and InitialAssessmentOutputSchema exclusively
 */
export async function generateGapIaAnalysisCore(params: GapIaCoreInput) {
  console.log('[gap/core/V3] 🚀 Starting GAP-IA generation with InitialAssessmentPromptV3');
  console.log('[gap/core/V3] Target:', params.domain);
  console.log('[gap/core/V3] Digital Footprint Signals:', {
    gbpFound: params.digitalFootprint.gbp.found,
    linkedinFound: params.digitalFootprint.linkedin.found,
    instagramFound: params.digitalFootprint.otherSocials.instagram,
    facebookFound: params.digitalFootprint.otherSocials.facebook,
  });

  const openai = getOpenAIClient();

  const signalPayload = {
    url: params.url,
    domain: params.domain,
    signals: {
      brand: {
        taglineSnippet: params.signals.brandTaglineSnippet || 'None detected',
        hasAwardsOrBadges: params.signals.hasAwardsOrBadges,
        hasTestimonials: params.signals.hasTestimonials,
        hasCaseStudies: params.signals.hasCaseStudies,
      },
      content: {
        hasBlog: params.signals.hasBlog || params.signals.hasResourceHub,
        hasResourceHub: params.signals.hasResourceHub,
        contentTypeHints: params.signals.contentTypeHints.length > 0
          ? params.signals.contentTypeHints.join(', ')
          : 'None detected',
        hasCaseStudies: params.signals.hasCaseStudies,
      },
      seo: {
        title: params.signals.title || 'None',
        metaDescription: params.signals.metaDescription || 'None',
        h1s: params.signals.h1s.length > 0 ? params.signals.h1s.join(', ') : 'None',
      },
      website: {
        hasNav: params.signals.hasNav,
        hasPricingPage: params.signals.hasPricingPage,
        ctaCount: params.signals.ctaCount,
        hasAwardsOrBadges: params.signals.hasAwardsOrBadges,
      },
    },
    digitalFootprint: {
      gbp: {
        found: params.digitalFootprint.gbp.found,
        hasReviews: params.digitalFootprint.gbp.hasReviews,
        reviewCountBucket: params.digitalFootprint.gbp.reviewCountBucket,
        ratingBucket: params.digitalFootprint.gbp.ratingBucket,
      },
      linkedin: {
        found: params.digitalFootprint.linkedin.found,
        followerBucket: params.digitalFootprint.linkedin.followerBucket,
        postingCadence: params.digitalFootprint.linkedin.postingCadence,
      },
      otherSocials: {
        instagram: params.digitalFootprint.otherSocials.instagram,
        facebook: params.digitalFootprint.otherSocials.facebook,
        youtube: params.digitalFootprint.otherSocials.youtube,
      },
      brandedSearch: {
        ownDomainDominates: params.digitalFootprint.brandedSearch.ownDomainDominates,
        confusingNameCollisions: params.digitalFootprint.brandedSearch.confusingNameCollisions,
      },
    },
    htmlSample: params.html.substring(0, 10000),
    multiPageSnapshot: params.multiPageSnapshot,
  };

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: GAP_SHARED_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `${GAP_SHARED_REASONING_PROMPT}

**Analysis Mode:** GAP_IA (Initial Assessment - V3)

**Input Signals:**
${JSON.stringify(signalPayload, null, 2)}`,
      },
      { role: 'user', content: GAP_IA_OUTPUT_PROMPT_V3 },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 6000,
  });

  const responseText = completion.choices[0]?.message?.content;

  if (!responseText) {
    throw new Error('Empty response from OpenAI');
  }

  console.log('[gap/core/V3] ✅ Received OpenAI response:', {
    length: responseText.length,
  });

  // Parse and validate the response using V3 schema
  const parsed = JSON.parse(responseText);

  // DEBUG: Log actual model output to verify V3 format
  console.log('[gap/core/V3] 🔍 RAW MODEL OUTPUT:');
  console.log('[gap/core/V3]   executiveSummary preview:', parsed.executiveSummary?.substring(0, 200));
  console.log('[gap/core/V3]   topOpportunities count:', parsed.topOpportunities?.length);
  console.log('[gap/core/V3]   quickWins count:', parsed.quickWins?.length);
  console.log('[gap/core/V3]   First topOpportunity:', parsed.topOpportunities?.[0]);
  console.log('[gap/core/V3]   First quickWin format:', parsed.quickWins?.[0]?.action?.substring(0, 100));

  console.log('[gap/core/V3] Validating response structure...', {
    hasExecutiveSummary: !!parsed.executiveSummary,
    hasMarketingReadinessScore: typeof parsed.marketingReadinessScore === 'number',
    hasMaturityStage: !!parsed.maturityStage,
    hasDimensionSummaries: Array.isArray(parsed.dimensionSummaries),
    dimensionCount: Array.isArray(parsed.dimensionSummaries) ? parsed.dimensionSummaries.length : 0,
    hasTopOpportunities: Array.isArray(parsed.topOpportunities),
    opportunityCount: Array.isArray(parsed.topOpportunities) ? parsed.topOpportunities.length : 0,
    hasQuickWins: Array.isArray(parsed.quickWins),
    quickWinCount: Array.isArray(parsed.quickWins) ? parsed.quickWins.length : 0,
  });

  // Normalize maturity stage to match schema enums
  if (parsed.maturityStage) {
    const maturityMap: Record<string, string> = {
      'early': 'Foundational',
      'foundational': 'Foundational',
      'emerging': 'Emerging',
      'developing': 'Emerging',
      'established': 'Established',
      'scaling': 'Established',
      'advanced': 'Advanced',
      'mature': 'Advanced',
      'category leader': 'CategoryLeader',
      'categoryleader': 'CategoryLeader',
    };
    const normalized = maturityMap[parsed.maturityStage.toLowerCase()];
    if (normalized) {
      parsed.maturityStage = normalized;
    }
  }

  try {
    // Validate using V3 schema
    const validatedV3 = InitialAssessmentOutputSchema.parse(parsed);

    console.log('[gap/core/V3] ✅ Schema validation successful:', {
      businessType: parsed.businessType || 'Not specified',
      overallScore: validatedV3.marketingReadinessScore,
      maturityStage: validatedV3.maturityStage,
      opportunityCount: validatedV3.topOpportunities.length,
      quickWinCount: validatedV3.quickWins.length,
      dimensionCount: validatedV3.dimensionSummaries.length,
    });

    // Map V3 output to V2 format for backward compatibility
    const v2Output = mapInitialAssessmentToApiResponse(validatedV3, {
      url: params.url,
      domain: params.domain,
      businessName: parsed.businessName,
      companyType: parsed.businessType,
      brandTier: parsed.brandTier,
      htmlSignals: params.signals,
      digitalFootprint: params.digitalFootprint,
      multiPageSnapshot: params.multiPageSnapshot,
    });

    console.log('[gap/core/V3] ✅ Mapped to V2 format for compatibility');

    return v2Output;
  } catch (error) {
    console.error('[gap/core/V3] Validation or mapping failed:', error);

    // Log validation errors for debugging
    if (error instanceof Error) {
      if ('issues' in error && Array.isArray((error as any).issues)) {
        console.error('[gap/core/V3] Validation issues:', JSON.stringify((error as any).issues.slice(0, 5), null, 2));
      }
    }

    throw new Error(`GAP-IA V3 validation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ============================================================================
// Core Full GAP Generator
// ============================================================================

export interface FullGapCoreInput {
  gapIa: any; // GapIaRun or similar structure
  domain: string;
  url: string;
}

/**
 * Generate Full GAP analysis (core function without Airtable writes)
 */
export async function generateFullGapAnalysisCore(params: FullGapCoreInput) {
  console.log('[gap/core/V3] Generating Full GAP for:', params.domain);

  const openai = getOpenAIClient();

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: GAP_SHARED_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `${GAP_SHARED_REASONING_PROMPT}

**Analysis Mode:** FULL_GAP (Full Growth Acceleration Plan - V3)

**GAP-IA Input:**
${JSON.stringify({
  summary: params.gapIa.summary,
  dimensions: params.gapIa.dimensions,
  quickWins: params.gapIa.quickWins,
  breakdown: params.gapIa.breakdown,
  core: params.gapIa.core,
  insights: params.gapIa.insights,
}, null, 2)}`,
      },
      { role: 'user', content: FULL_GAP_OUTPUT_PROMPT_V3 },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 6000,
  });

  const content = completion.choices[0]?.message?.content;

  if (!content) {
    throw new Error('Empty response from OpenAI when generating Full GAP');
  }

  console.log('[gap/core/V3] ✅ Received Full GAP response:', {
    length: content.length,
  });

  try {
    const parsed = JSON.parse(content);

    console.log('[gap/core/V3] Validating Full GAP structure...', {
      hasExecutiveSummary: !!parsed.executiveSummary,
      hasOverallScore: typeof parsed.overallScore === 'number',
      hasMaturityStage: !!parsed.maturityStage,
      hasDimensionAnalyses: Array.isArray(parsed.dimensionAnalyses),
      dimensionCount: Array.isArray(parsed.dimensionAnalyses) ? parsed.dimensionAnalyses.length : 0,
      hasQuickWins: Array.isArray(parsed.quickWins),
      hasStrategicPriorities: Array.isArray(parsed.strategicPriorities),
      hasRoadmap: Array.isArray(parsed.roadmap),
      hasKpis: Array.isArray(parsed.kpis),
    });

    // Validate using V3 schema
    const validatedV3 = FullGapOutputSchema.parse(parsed);

    console.log('[gap/core/V3] ✅ Schema validation successful:', {
      overallScore: validatedV3.overallScore,
      maturityStage: validatedV3.maturityStage,
      quickWinCount: validatedV3.quickWins.length,
      strategicPriorityCount: validatedV3.strategicPriorities.length,
      roadmapPhaseCount: 3, // Fixed 3 phases
      kpiCount: validatedV3.kpis.length,
    });

    // Map V3 output to existing API format for backward compatibility
    const apiResponse = mapFullGapToApiResponse(validatedV3, {
      url: params.url,
      domain: params.domain,
      businessName: params.gapIa.businessName || params.domain,
      gapId: params.gapIa.id || 'unknown',
    });

    console.log('[gap/core/V3] ✅ Mapped to API format for compatibility');

    return apiResponse;
  } catch (error) {
    console.error('[gap/core/V3] Full GAP validation or mapping failed:', error);

    // Log validation errors for debugging
    if (error instanceof Error) {
      if ('issues' in error && Array.isArray((error as any).issues)) {
        console.error('[gap/core/V3] Validation issues:', JSON.stringify((error as any).issues.slice(0, 5), null, 2));
      }
    }

    throw new Error(`Full GAP V3 validation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ============================================================================
// Multi-Page Discovery
// ============================================================================

export async function discoverMultiPageContent(
  url: string,
  html: string
): Promise<MultiPageSnapshot> {
  console.log('[gap/core] Starting multi-page discovery...');

  const baseUrl = new URL(url);
  const discoveredUrls = discoverCandidateUrls(html, baseUrl, 5);

  console.log('[gap/core] Discovered URLs:', discoveredUrls.map(u => `${u.type}: ${u.path}`));

  const discoveredPageSnippets = await fetchPageSnippets(discoveredUrls, 3);
  console.log('[gap/core] Successfully fetched', discoveredPageSnippets.length, 'page snippets');

  const signals = extractHtmlSignals(html);
  const domain = normalizeDomain(url);

  const homepageSnippet: DiscoveredPageSnippet = {
    url,
    type: 'other',
    path: '/',
    title: signals.title || domain,
    snippet: html.slice(0, 2500),
  };

  const contentSignals: ContentSignals = {
    blogFound: discoveredPageSnippets.some((p) => p.type === 'blog'),
    blogUrlsFound: discoveredPageSnippets.filter((p) => p.type === 'blog').length,
    pricingFound: discoveredPageSnippets.some((p) => p.type === 'pricing'),
    resourcePagesFound: discoveredPageSnippets.filter((p) => p.type === 'resource').length,
    caseStudyPagesFound: discoveredPageSnippets.filter((p) => p.type === 'case_study').length,
    estimatedBlogWordCount: null,
  };

  return {
    homepage: homepageSnippet,
    discoveredPages: discoveredPageSnippets,
    contentSignals,
  };
}

// ============================================================================
// High-Level Wrapper Functions
// ============================================================================

/**
 * Run complete Initial Assessment (GAP-IA) for a URL
 *
 * This is the high-level function that orchestrates the entire IA workflow
 */
export async function runInitialAssessment(input: { url: string }) {
  const { url } = input;

  console.log('[gap/core] Running Initial Assessment for:', url);

  // 1. Normalize domain
  const domain = normalizeDomain(url);

  // 2. Fetch HTML
  const html = await fetchHtmlBounded(url);

  // 3. Extract HTML signals
  const signals = extractHtmlSignals(html);

  // 4. Discover multi-page content
  const multiPageSnapshot = await discoverMultiPageContent(url, html);

  // 5. Collect digital footprint (pass HTML for accurate detection)
  const digitalFootprint = await collectDigitalFootprint(domain, html);

  // 6. Infer business context
  const businessContext = getBusinessContext({
    url,
    domain,
    htmlSnippet: html,
    detectedSignals: {
      hasPhysicalAddress: html.toLowerCase().includes('address'),
      hasOpeningHours: html.toLowerCase().includes('hours'),
      hasEventDates: html.toLowerCase().includes('event'),
      hasGoogleBusinessProfile: digitalFootprint.gbp.found,
      hasLinkedInCompanyPage: digitalFootprint.linkedin.found,
      hasBlog: signals.hasBlog,
      hasCaseStudies: signals.hasCaseStudies,
      hasProductCatalog: html.toLowerCase().includes('product'),
      hasShoppingCart: html.toLowerCase().includes('cart'),
      hasSaaSTerms: html.toLowerCase().includes('saas'),
      hasFreeTrial: html.toLowerCase().includes('free trial'),
      hasDemoRequest: html.toLowerCase().includes('demo'),
    },
  });

  // 7. Generate GAP-IA
  const gapIaOutput = await generateGapIaAnalysisCore({
    url,
    domain,
    html,
    signals,
    digitalFootprint,
    multiPageSnapshot,
  });

  return {
    initialAssessment: gapIaOutput,
    businessContext,
    metadata: {
      url,
      domain,
      analyzedAt: new Date().toISOString(),
    },
  };
}

/**
 * Run complete Full Growth Acceleration Plan for a URL
 *
 * This is the high-level function that orchestrates the Full GAP workflow
 */
export async function runFullGap(input: {
  url: string;
  initialAssessment: any; // GapIaV2AiOutput or similar
}) {
  const { url, initialAssessment } = input;

  console.log('[gap/core] Running Full GAP for:', url);

  const domain = normalizeDomain(url);

  // Generate Full GAP based on Initial Assessment
  const fullGapOutput = await generateFullGapAnalysisCore({
    gapIa: initialAssessment,
    domain,
    url,
  });

  return {
    fullGap: fullGapOutput,
    metadata: {
      url,
      domain,
      analyzedAt: new Date().toISOString(),
    },
  };
}
