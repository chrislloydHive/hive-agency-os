// lib/gap/core.ts
/**
 * Core GAP functions for running GAP-IA and Full GAP analysis
 * Extracted from API handlers for use in scripts and tests
 *
 * Uses GapModelCaller abstraction to allow:
 * - aiForCompany() with memory injection in API routes
 * - Direct OpenAI calls in scripts/tests
 */

import OpenAI from 'openai';
import type { CoreMarketingContext } from '@/lib/gap/types';

// ============================================================================
// Model Caller Abstraction
// ============================================================================

/**
 * A function that sends a prompt to an LLM and returns the response.
 * This abstraction allows GAP engines to use different AI backends:
 * - aiForCompany() for API routes (includes memory injection)
 * - Direct OpenAI for scripts/tests
 */
export type GapModelCaller = (prompt: string) => Promise<string>;
import { collectDigitalFootprint } from '@/lib/digital-footprint/collectDigitalFootprint';
import { discoverSocialPresence, type SocialDiscoveryResult } from '@/lib/digital-footprint/socialDiscovery';
import type { SocialPresenceData } from '@/lib/gap/types';
import {
  detectSocialAndGbp,
  computeSocialLocalPresenceScore,
  type SocialFootprintSnapshot,
} from '@/lib/gap/socialDetection';
import {
  GAP_SHARED_SYSTEM_PROMPT,
  GAP_SHARED_REASONING_PROMPT,
} from '@/lib/gap/prompts/sharedPrompts';
import { GAP_IA_OUTPUT_PROMPT_V4 } from '@/lib/gap/prompts/gapIaOutputPromptV4';
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
import { computeGapDataConfidence } from '@/lib/gap/dataConfidence';
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
 *
 * Default is 150KB to ensure we capture footer content where social links
 * and GBP references are commonly placed. The LLM prompt only uses 10KB
 * (see htmlSample in generateGapIaAnalysisCore), so this doesn't affect costs.
 */
export async function fetchHtmlBounded(
  url: string,
  maxBytes: number = 150000
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

/**
 * Create a default model caller using direct OpenAI calls.
 * Use this for scripts/tests. For API routes, use aiForCompany() instead.
 *
 * @param model - OpenAI model to use (default: 'gpt-4o')
 * @param options - Additional options for the model caller
 */
export function createDefaultModelCaller(
  model: string = 'gpt-4o',
  options: { maxTokens?: number; temperature?: number } = {}
): GapModelCaller {
  const { maxTokens = 6000, temperature = 0.7 } = options;

  return async (prompt: string): Promise<string> => {
    const openai = getOpenAIClient();

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: GAP_SHARED_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature,
      max_tokens: maxTokens,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    return content;
  };
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
  /**
   * Optional model caller. If not provided, uses direct OpenAI calls.
   * For API routes with company context, pass a caller created from aiForCompany().
   */
  modelCaller?: GapModelCaller;
  /**
   * V5 Social Footprint detection result.
   * Used to gate digitalFootprint subscores and sanitize narratives.
   */
  socialFootprint?: SocialFootprintSnapshot;
}

/**
 * Generate GAP-IA analysis (core function without Airtable writes)
 *
 * Uses InitialAssessmentPromptV4 and InitialAssessmentOutputSchema exclusively
 */
export async function generateGapIaAnalysisCore(params: GapIaCoreInput) {
  console.log('[gap/core/V4] 🚀 Starting GAP-IA generation with InitialAssessmentPromptV4');
  console.log('[gap/core/V4] Target:', params.domain);
  console.log('[gap/core/V4] Digital Footprint Signals:', {
    gbpFound: params.digitalFootprint.gbp.found,
    linkedinFound: params.digitalFootprint.linkedin.found,
    instagramFound: params.digitalFootprint.otherSocials.instagram,
    facebookFound: params.digitalFootprint.otherSocials.facebook,
  });

  // Use provided model caller or create default
  const modelCaller = params.modelCaller ?? createDefaultModelCaller('gpt-4o');

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

  // Build the full prompt for the model caller
  const fullPrompt = `${GAP_SHARED_REASONING_PROMPT}

**Analysis Mode:** GAP_IA (Initial Assessment - V4)

**Input Signals:**
${JSON.stringify(signalPayload, null, 2)}

${GAP_IA_OUTPUT_PROMPT_V4}`;

  // Call the model
  const responseText = await modelCaller(fullPrompt);

  console.log('[gap/core/V4] ✅ Received OpenAI response:', {
    length: responseText.length,
  });

  // Parse and validate the response using V3 schema
  const parsed = JSON.parse(responseText);

  // DEBUG: Log actual model output to verify V3 format
  console.log('[gap/core/V4] 🔍 RAW MODEL OUTPUT:');
  console.log('[gap/core/V4]   executiveSummary preview:', parsed.executiveSummary?.substring(0, 200));
  console.log('[gap/core/V4]   topOpportunities count:', parsed.topOpportunities?.length);
  console.log('[gap/core/V4]   quickWins count:', parsed.quickWins?.length);
  console.log('[gap/core/V4]   First topOpportunity:', parsed.topOpportunities?.[0]);
  console.log('[gap/core/V4]   First quickWin format:', parsed.quickWins?.[0]?.action?.substring(0, 100));

  console.log('[gap/core/V4] Validating response structure...', {
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

    console.log('[gap/core/V4] ✅ Schema validation successful:', {
      businessType: parsed.businessType || 'Not specified',
      overallScore: validatedV3.marketingReadinessScore,
      maturityStage: validatedV3.maturityStage,
      opportunityCount: validatedV3.topOpportunities.length,
      quickWinCount: validatedV3.quickWins.length,
      dimensionCount: validatedV3.dimensionSummaries.length,
    });

    // Map V3 output to V2 format for backward compatibility
    // socialFootprint is passed to gate subscores and sanitize narratives
    const v2Output = mapInitialAssessmentToApiResponse(validatedV3, {
      url: params.url,
      domain: params.domain,
      businessName: parsed.businessName,
      companyType: parsed.businessType,
      brandTier: parsed.brandTier,
      htmlSignals: params.signals,
      digitalFootprint: params.digitalFootprint,
      multiPageSnapshot: params.multiPageSnapshot,
      socialFootprint: params.socialFootprint,
    });

    console.log('[gap/core/V4] ✅ Mapped to V2 format for compatibility');

    return v2Output;
  } catch (error) {
    console.error('[gap/core/V4] Validation or mapping failed:', error);

    // Log validation errors for debugging
    if (error instanceof Error) {
      if ('issues' in error && Array.isArray((error as any).issues)) {
        console.error('[gap/core/V4] Validation issues:', JSON.stringify((error as any).issues.slice(0, 5), null, 2));
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
  /**
   * Optional model caller. If not provided, uses direct OpenAI calls.
   * For API routes with company context, pass a caller created from aiForCompany().
   */
  modelCaller?: GapModelCaller;
}

/**
 * Generate Full GAP analysis (core function without Airtable writes)
 *
 * The engine is model-agnostic and relies on the injected GapModelCaller.
 * If no modelCaller is provided, uses direct OpenAI calls.
 */
export async function generateFullGapAnalysisCore(params: FullGapCoreInput) {
  console.log('[gap/core/V4] Generating Full GAP for:', params.domain);

  // Build the full prompt
  const fullPrompt = `${GAP_SHARED_REASONING_PROMPT}

**Analysis Mode:** FULL_GAP (Full Growth Acceleration Plan - V3)

**GAP-IA Input:**
${JSON.stringify({
  summary: params.gapIa.summary,
  dimensions: params.gapIa.dimensions,
  quickWins: params.gapIa.quickWins,
  breakdown: params.gapIa.breakdown,
  core: params.gapIa.core,
  insights: params.gapIa.insights,
}, null, 2)}

${FULL_GAP_OUTPUT_PROMPT_V3}`;

  // Use provided model caller or create default
  const modelCaller = params.modelCaller ?? createDefaultModelCaller('gpt-4o-mini', {
    maxTokens: 6000,
    temperature: 0.7,
  });

  const content = await modelCaller(fullPrompt);

  if (!content) {
    throw new Error('Empty response from model when generating Full GAP');
  }

  console.log('[gap/core/V4] ✅ Received Full GAP response:', {
    length: content.length,
  });

  try {
    const parsed = JSON.parse(content);

    console.log('[gap/core/V4] Validating Full GAP structure...', {
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

    console.log('[gap/core/V4] ✅ Schema validation successful:', {
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
      businessName: params.gapIa.businessName || params.domain,
      gapId: params.gapIa.id || 'unknown',
    });

    console.log('[gap/core/V4] ✅ Mapped to API format for compatibility');

    return apiResponse;
  } catch (error) {
    console.error('[gap/core/V4] Full GAP validation or mapping failed:', error);

    // Log validation errors for debugging
    if (error instanceof Error) {
      if ('issues' in error && Array.isArray((error as any).issues)) {
        console.error('[gap/core/V4] Validation issues:', JSON.stringify((error as any).issues.slice(0, 5), null, 2));
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
 * Input options for Initial Assessment
 */
export interface InitialAssessmentInput {
  url: string;
  /**
   * Optional model caller. If not provided, uses direct OpenAI calls.
   * For API routes with company context, pass a caller created from aiForCompany().
   */
  modelCaller?: GapModelCaller;
}

/**
 * Run complete Initial Assessment (GAP-IA) for a URL
 *
 * This is the high-level function that orchestrates the entire IA workflow.
 * The engine is model-agnostic and relies on the injected GapModelCaller.
 *
 * @param input.url - The website URL to analyze
 * @param input.modelCaller - Optional model caller (defaults to direct OpenAI)
 */
export async function runInitialAssessment(input: InitialAssessmentInput) {
  const { url, modelCaller } = input;

  console.log('[gap/core] Running Initial Assessment for:', url);

  // 1. Normalize domain
  const domain = normalizeDomain(url);

  // 2. Fetch HTML
  // NOTE: We fetch 150KB to capture footer links (social/GBP often in footer)
  const html = await fetchHtmlBounded(url, 150000);

  // 3. Extract HTML signals
  const signals = extractHtmlSignals(html);

  // 4. Discover multi-page content
  const multiPageSnapshot = await discoverMultiPageContent(url, html);

  // 5. Collect digital footprint (pass HTML for accurate detection)
  const digitalFootprint = await collectDigitalFootprint(domain, html);

  // 5.5 Enhanced Social Discovery (more robust detection with confidence scores)
  let socialDiscoveryResult: SocialDiscoveryResult | undefined;
  let socialPresence: SocialPresenceData | undefined;

  try {
    // Extract company name from HTML for search-based discovery fallback
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const companyName = titleMatch?.[1]?.split(/[-|–]/).map(s => s.trim())[0] || domain;

    // Check for location hints in HTML (for local businesses)
    const locationHint = extractLocationHint(html);

    socialDiscoveryResult = await discoverSocialPresence({
      companyUrl: url,
      html,
      companyName,
      locationHint,
    });

    // Map to SocialPresenceData for GAP types
    socialPresence = mapSocialDiscoveryToPresence(socialDiscoveryResult);

    console.log('[gap/core] Social discovery complete:', {
      hasInstagram: socialPresence.hasInstagram,
      hasGBP: socialPresence.hasGBP,
      socialConfidence: socialPresence.socialConfidence,
      gbpConfidence: socialPresence.gbpConfidence,
    });
  } catch (error) {
    console.warn('[gap/core] Social discovery failed, continuing with basic detection:', error);
  }

  // 5.6 V5 Social Footprint Detection (more granular status + confidence)
  // This provides the new SocialFootprintSnapshot with status levels
  let socialFootprint: SocialFootprintSnapshot | undefined;
  let socialLocalPresenceScore: number | undefined;

  try {
    // Extract JSON-LD schemas from HTML for schema.org sameAs detection
    const schemaJsonLds: any[] = [];
    const schemaMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    for (const match of schemaMatches) {
      try {
        schemaJsonLds.push(JSON.parse(match[1]));
      } catch {
        // Skip invalid JSON-LD
      }
    }

    socialFootprint = detectSocialAndGbp({
      html,
      schemas: schemaJsonLds,
      baseUrl: url,
    });
    socialLocalPresenceScore = computeSocialLocalPresenceScore(socialFootprint);

    console.log('[gap/core] V5 Social footprint detection complete:', {
      socialsDetected: socialFootprint.socials.filter(s => s.status !== 'missing').length,
      gbpStatus: socialFootprint.gbp?.status ?? 'missing',
      dataConfidence: socialFootprint.dataConfidence,
      socialLocalPresenceScore,
    });
  } catch (error) {
    console.warn('[gap/core] V5 Social footprint detection failed:', error);
  }

  // 6. Infer business context (use enhanced social signals if available)
  const businessContext = getBusinessContext({
    url,
    domain,
    htmlSnippet: html,
    detectedSignals: {
      hasPhysicalAddress: html.toLowerCase().includes('address'),
      hasOpeningHours: html.toLowerCase().includes('hours'),
      hasEventDates: html.toLowerCase().includes('event'),
      // Use enhanced social discovery if available, fall back to basic detection
      hasGoogleBusinessProfile: socialPresence?.hasGBP ?? digitalFootprint.gbp.found,
      hasLinkedInCompanyPage: socialPresence?.hasLinkedIn ?? digitalFootprint.linkedin.found,
      socialPlatforms: socialPresence ? getSocialPlatformList(socialPresence) : undefined,
      hasBlog: signals.hasBlog,
      hasCaseStudies: signals.hasCaseStudies,
      hasProductCatalog: html.toLowerCase().includes('product'),
      hasShoppingCart: html.toLowerCase().includes('cart'),
      hasSaaSTerms: html.toLowerCase().includes('saas'),
      hasFreeTrial: html.toLowerCase().includes('free trial'),
      hasDemoRequest: html.toLowerCase().includes('demo'),
    },
  });

  // 7. Generate GAP-IA (pass modelCaller if provided)
  // Augment digital footprint with enhanced social signals
  const enhancedDigitalFootprint = socialPresence
    ? augmentDigitalFootprintWithSocial(digitalFootprint, socialPresence)
    : digitalFootprint;

  const gapIaOutput = await generateGapIaAnalysisCore({
    url,
    domain,
    html,
    signals,
    digitalFootprint: enhancedDigitalFootprint,
    multiPageSnapshot,
    modelCaller,
  });

  // Compute data confidence (aligned with Ops Lab pattern)
  const pagesAnalyzed = 1 + (multiPageSnapshot?.discoveredPages?.length ?? 0);
  const dataConfidence = computeGapDataConfidence({
    htmlSignals: signals,
    digitalFootprint: {
      gbp: enhancedDigitalFootprint.gbp,
      linkedin: enhancedDigitalFootprint.linkedin,
      otherSocials: enhancedDigitalFootprint.otherSocials,
    },
    pagesAnalyzed,
    businessType: businessContext?.businessType,
  });

  console.log('[gap/core] Data confidence computed:', {
    score: dataConfidence.score,
    level: dataConfidence.level,
    pagesAnalyzed,
  });

  return {
    initialAssessment: gapIaOutput,
    businessContext,
    dataConfidence,
    socialPresence,
    // V5 Social Footprint (new granular detection)
    socialFootprint,
    socialLocalPresenceScore,
    metadata: {
      url,
      domain,
      analyzedAt: new Date().toISOString(),
      pagesAnalyzed,
    },
  };
}

/**
 * Extract location hint from HTML (for local business discovery)
 */
function extractLocationHint(html: string): string | undefined {
  // Try to find location from schema.org
  const schemaMatch = html.match(/"addressLocality"\s*:\s*"([^"]+)"/i);
  if (schemaMatch) return schemaMatch[1];

  // Try to find from address patterns
  const addressMatch = html.match(/(?:(?:San|Los|New|Las|Salt|Fort|St\.?)\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s*,\s*(?:CA|NY|TX|FL|IL|PA|OH|GA|NC|MI|NJ|VA|WA|AZ|MA|TN|IN|MO|MD|WI|CO|MN|SC|AL|LA|KY|OR|OK|CT|UT|IA|NV|AR|MS|KS|NM|NE|WV|ID|HI|NH|ME|MT|RI|DE|SD|ND|AK|VT|DC|WY)/);
  if (addressMatch) return addressMatch[0];

  return undefined;
}

/**
 * Map SocialDiscoveryResult to SocialPresenceData
 */
function mapSocialDiscoveryToPresence(discovery: SocialDiscoveryResult): SocialPresenceData {
  const instagram = discovery.socialProfiles.find(p => p.platform === 'instagram');
  const facebook = discovery.socialProfiles.find(p => p.platform === 'facebook');
  const tiktok = discovery.socialProfiles.find(p => p.platform === 'tiktok');
  const x = discovery.socialProfiles.find(p => p.platform === 'x');
  const linkedin = discovery.socialProfiles.find(p => p.platform === 'linkedin');
  const youtube = discovery.socialProfiles.find(p => p.platform === 'youtube');

  return {
    instagramUrl: instagram?.url ?? null,
    facebookUrl: facebook?.url ?? null,
    tiktokUrl: tiktok?.url ?? null,
    xUrl: x?.url ?? null,
    linkedinUrl: linkedin?.url ?? null,
    youtubeUrl: youtube?.url ?? null,
    gbpUrl: discovery.gbp?.url ?? null,

    instagramHandle: instagram?.handle,
    linkedinHandle: linkedin?.handle,
    tiktokHandle: tiktok?.handle,

    socialConfidence: discovery.socialConfidence,
    gbpConfidence: discovery.gbpConfidence,

    hasInstagram: discovery.hasInstagram,
    hasFacebook: discovery.hasFacebook,
    hasLinkedIn: discovery.hasLinkedIn,
    hasTikTok: discovery.hasTikTok,
    hasYouTube: discovery.hasYouTube,
    hasGBP: discovery.hasGBP,

    summary: discovery.summary,
  };
}

/**
 * Get list of detected social platforms for business context
 */
function getSocialPlatformList(presence: SocialPresenceData): string[] {
  const platforms: string[] = [];
  if (presence.hasInstagram) platforms.push('instagram');
  if (presence.hasFacebook) platforms.push('facebook');
  if (presence.hasLinkedIn) platforms.push('linkedin');
  if (presence.hasTikTok) platforms.push('tiktok');
  if (presence.hasYouTube) platforms.push('youtube');
  return platforms;
}

/**
 * Augment basic digital footprint with enhanced social discovery results
 */
function augmentDigitalFootprintWithSocial(
  basic: Awaited<ReturnType<typeof collectDigitalFootprint>>,
  social: SocialPresenceData
): Awaited<ReturnType<typeof collectDigitalFootprint>> {
  return {
    ...basic,
    gbp: {
      ...basic.gbp,
      // Use enhanced detection if we have higher confidence
      found: social.hasGBP || basic.gbp.found,
    },
    linkedin: {
      ...basic.linkedin,
      found: social.hasLinkedIn || basic.linkedin.found,
    },
    otherSocials: {
      instagram: social.hasInstagram || basic.otherSocials.instagram,
      facebook: social.hasFacebook || basic.otherSocials.facebook,
      youtube: social.hasYouTube || basic.otherSocials.youtube,
    },
  };
}

/**
 * Input options for Full GAP
 */
export interface FullGapInput {
  url: string;
  initialAssessment: any; // GapIaV2AiOutput or similar
  /**
   * Optional model caller. If not provided, uses direct OpenAI calls.
   * For API routes with company context, pass a caller created from aiForCompany().
   */
  modelCaller?: GapModelCaller;
}

/**
 * Run complete Full Growth Acceleration Plan for a URL
 *
 * This is the high-level function that orchestrates the Full GAP workflow.
 * The engine is model-agnostic and relies on the injected GapModelCaller.
 *
 * @param input.url - The website URL to analyze
 * @param input.initialAssessment - The GAP-IA result to build upon
 * @param input.modelCaller - Optional model caller (defaults to direct OpenAI)
 * @deprecated Use runFullGapV4() for the multi-pass pipeline used by digitalmarketingaudit.ai
 */
export async function runFullGap(input: FullGapInput) {
  const { url, initialAssessment, modelCaller } = input;

  console.log('[gap/core] Running Full GAP for:', url);

  const domain = normalizeDomain(url);

  // Generate Full GAP based on Initial Assessment (pass modelCaller if provided)
  const fullGapOutput = await generateFullGapAnalysisCore({
    gapIa: initialAssessment,
    domain,
    url,
    modelCaller,
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

// ============================================================================
// Full GAP V4 - Multi-Pass Pipeline (same as digitalmarketingaudit.ai)
// ============================================================================

/**
 * Input options for Full GAP V4 multi-pass pipeline
 */
export interface FullGapV4Input {
  gapIaRun: any; // GapIaRun with V2 enhanced fields
  url: string;
  domain: string;
  /**
   * If true, skips the refinement pass for faster execution (used in tests)
   */
  skipRefinement?: boolean;
}

/**
 * Result from Full GAP V4 generation
 */
export interface FullGapV4Result {
  /**
   * Light JSON structure (strategicInitiatives, ninetyDayPlan, kpis)
   */
  lightPlan: any;
  /**
   * Refined markdown narrative (consultant-grade)
   */
  refinedMarkdown: string | null;
  /**
   * Combined GrowthAccelerationPlan object
   */
  plan: any;
}

/**
 * Run Full GAP V4 using the multi-pass pipeline (same as digitalmarketingaudit.ai)
 *
 * This function uses the same flow as the Inngest `generate-full-gap` function:
 * 1. generateFullGapDraft() - Light draft pass (gpt-4o-mini)
 * 2. refineFullGapReport() - Heavy refinement pass (gpt-4o)
 * 3. generateLightFullGapFromIa() - Generates JSON structure
 * 4. reviewFullGap() - Quality assurance pass
 *
 * This ensures consistent output between OS and digitalmarketingaudit.ai
 */
export async function runFullGapV4(input: FullGapV4Input): Promise<FullGapV4Result> {
  const { gapIaRun, url, domain, skipRefinement = false } = input;

  console.log('[gap/core/V4] Starting Full GAP V4 multi-pass pipeline for:', domain);

  // Import the DMA pipeline functions dynamically to avoid circular dependencies
  const { generateFullGapDraft } = await import('@/lib/gap/generateFullGapDraft');
  const { refineFullGapReport } = await import('@/lib/gap/refineFullGap');
  const { generateLightFullGapFromIa } = await import('@/lib/growth-plan/generateLightFullGapFromIa');
  const { reviewFullGap } = await import('@/lib/growth-plan/reviewFullGap');

  // Step 1: Generate Full GAP Draft (light, fast LLM call)
  console.log('[gap/core/V4] Step 1: Generating Full GAP draft...');
  const draftMarkdown = await generateFullGapDraft(gapIaRun);
  console.log('[gap/core/V4] Draft generated, length:', draftMarkdown.length);

  // Step 2: Refine Full GAP (heavy, comprehensive LLM call)
  let refinedMarkdown: string | null = null;
  if (!skipRefinement) {
    console.log('[gap/core/V4] Step 2: Refining Full GAP...');
    refinedMarkdown = await refineFullGapReport({
      iaJson: gapIaRun,
      fullGapDraftMarkdown: draftMarkdown,
    });
    console.log('[gap/core/V4] Refinement complete, length:', refinedMarkdown.length);
  } else {
    console.log('[gap/core/V4] Step 2: Skipping refinement (skipRefinement=true)');
    refinedMarkdown = draftMarkdown;
  }

  // Step 3: Generate Light Full GAP JSON structure
  console.log('[gap/core/V4] Step 3: Generating JSON structure...');
  const lightPlanDraft = await generateLightFullGapFromIa(gapIaRun, domain, url);
  console.log('[gap/core/V4] JSON structure generated');

  // Step 4: Internal Reviewer - Quality assurance pass
  console.log('[gap/core/V4] Step 4: Running Internal Reviewer...');
  let lightPlan;
  try {
    lightPlan = await reviewFullGap({
      gapIa: gapIaRun,
      draft: lightPlanDraft,
      siteMetadata: {
        domain,
        url,
        companyName: gapIaRun.core?.businessName,
        industry: gapIaRun.core?.industry,
        brandTier: gapIaRun.core?.brandTier,
      },
    });
    console.log('[gap/core/V4] ✓ Internal review complete');
  } catch (error) {
    console.warn('[gap/core/V4] Review failed, using draft:', error);
    lightPlan = lightPlanDraft;
  }

  // Step 5: Compose the full plan object (same structure as Inngest function)
  console.log('[gap/core/V4] Step 5: Composing final plan object...');
  const plan = composeFullGapPlan(gapIaRun, lightPlan, refinedMarkdown);

  console.log('[gap/core/V4] ✓ Full GAP V4 complete:', {
    hasLightPlan: !!lightPlan,
    hasRefinedMarkdown: !!refinedMarkdown,
    overallScore: plan.scorecard?.overall,
  });

  return {
    lightPlan,
    refinedMarkdown,
    plan,
  };
}

/**
 * Compose the full GrowthAccelerationPlan from GAP-IA data and light plan
 * (Same logic as Inngest generate-full-gap function)
 */
function composeFullGapPlan(gapIaRun: any, lightPlan: any, refinedMarkdown: string | null): any {
  return {
    companyName: gapIaRun.core?.businessName || 'Unknown Company',
    websiteUrl: gapIaRun.url,
    generatedAt: new Date().toISOString(),

    // Carry over scores from GAP-IA (canonical source of truth)
    scorecard: {
      overall: gapIaRun.summary?.overallScore || gapIaRun.core?.overallScore || 0,
      brand: gapIaRun.dimensions?.brand?.score || gapIaRun.core?.brand?.brandScore || 0,
      content: gapIaRun.dimensions?.content?.score || gapIaRun.core?.content?.contentScore || 0,
      website: gapIaRun.dimensions?.website?.score || gapIaRun.core?.website?.websiteScore || 0,
      seo: gapIaRun.dimensions?.seo?.score || gapIaRun.core?.seo?.seoScore || 0,
      authority: gapIaRun.dimensions?.authority?.score || 0,
      digitalFootprint: gapIaRun.dimensions?.digitalFootprint?.score || 0,
    },

    // Executive summary with expanded narrative
    executiveSummary: {
      strengths: [],
      keyIssues: gapIaRun.dimensions?.brand?.issues || [],
      strategicPriorities: gapIaRun.quickWins?.bullets?.slice(0, 3).map((w: any) => w.action) || [],
      maturityStage: gapIaRun.core?.marketingMaturity || 'developing',
      narrative: lightPlan.executiveSummaryNarrative,
      expectedOutcomes: [],
    },

    // Dimension narratives from GAP-IA
    dimensionNarratives: {
      brand: gapIaRun.dimensions?.brand?.narrative,
      content: gapIaRun.dimensions?.content?.narrative,
      seo: gapIaRun.dimensions?.seo?.narrative,
      website: gapIaRun.dimensions?.website?.narrative,
      digitalFootprint: gapIaRun.dimensions?.digitalFootprint?.narrative,
      authority: gapIaRun.dimensions?.authority?.narrative,
    },

    // Section analyses from GAP-IA dimensions
    sectionAnalyses: {
      brand: gapIaRun.dimensions?.brand ? {
        summary: gapIaRun.dimensions.brand.oneLiner,
        keyFindings: gapIaRun.dimensions.brand.issues || [],
      } : undefined,
      content: gapIaRun.dimensions?.content ? {
        summary: gapIaRun.dimensions.content.oneLiner,
        keyFindings: gapIaRun.dimensions.content.issues || [],
      } : undefined,
      seo: gapIaRun.dimensions?.seo ? {
        summary: gapIaRun.dimensions.seo.oneLiner,
        keyFindings: gapIaRun.dimensions.seo.issues || [],
      } : undefined,
      website: gapIaRun.dimensions?.website ? {
        summary: gapIaRun.dimensions.website.oneLiner,
        keyFindings: gapIaRun.dimensions.website.issues || [],
      } : undefined,
      digitalFootprint: gapIaRun.dimensions?.digitalFootprint ? {
        summary: gapIaRun.dimensions.digitalFootprint.oneLiner,
        keyFindings: gapIaRun.dimensions.digitalFootprint.issues || [],
      } : undefined,
      authority: gapIaRun.dimensions?.authority ? {
        summary: gapIaRun.dimensions.authority.oneLiner,
        keyFindings: gapIaRun.dimensions.authority.issues || [],
      } : undefined,
    },

    // Quick wins from GAP-IA
    quickWins: gapIaRun.quickWins?.bullets?.map((w: any) => ({
      title: w.action,
      description: w.action,
      category: w.category,
      expectedImpact: w.expectedImpact,
      effortLevel: w.effortLevel,
      timeframe: '0-30 days',
      implementationSteps: [],
    })) || [],

    // Strategic initiatives from Light Full GAP
    strategicInitiatives: lightPlan.strategicInitiatives.map((init: any) => ({
      title: init.title,
      description: init.description,
      category: init.dimension,
      timeline: init.timeframe === 'short' ? '0-30 days' : init.timeframe === 'medium' ? '30-60 days' : '60-90 days',
      expectedImpact: init.expectedImpact,
      keyActions: [],
      successMetrics: [],
      resourcesNeeded: [],
    })),

    // 90-day roadmap from Light Full GAP
    roadmap: lightPlan.ninetyDayPlan.map((phase: any) => ({
      phase: phase.phase,
      focus: phase.focus,
      actions: phase.actions,
      businessRationale: phase.businessRationale,
    })),

    // KPIs from Light Full GAP
    kpis: lightPlan.kpisToWatch,

    // Refined markdown narrative
    refinedMarkdown: refinedMarkdown,

    // Model version identifier
    modelVersion: 'gap-v4-multipass',
  };
}
