// lib/gap/HEURISTICS_INTEGRATION_EXAMPLE.ts
/**
 * Example integration of contextual heuristics into GAP-IA and Full GAP pipelines
 *
 * This file shows how to integrate getBusinessContext() into your API handlers.
 * Copy the relevant sections into your actual API route files.
 */

import { getBusinessContext, logBusinessContext, type BusinessContextInput } from './contextualHeuristics';
import { GAP_IA_OUTPUT_PROMPT_V3 } from './prompts/gapIaOutputPromptV3';
import { FULL_GAP_OUTPUT_PROMPT_V3 } from './prompts/fullGapOutputPromptV3';
import { generateBusinessTypeContext } from './parseGapIaOutput';
import { generateFullGapPromptContext } from './parseFullGapOutput';
import { type InitialAssessmentOutput } from './outputTemplates';

// ============================================================================
// EXAMPLE 1: GAP-IA API HANDLER INTEGRATION
// ============================================================================

/**
 * Example GAP-IA handler (app/api/gap-ia/run/route.ts)
 */
export async function exampleGapIaHandler(request: Request) {
  // 1. Extract URL and basic inputs
  const { url } = await request.json();
  const domain = extractDomain(url);

  // 2. Fetch HTML snippet (existing logic)
  const htmlSnippet = await fetchHtmlBounded(url, 50000);

  // 3. Collect digital footprint signals (existing logic)
  const digitalFootprint = await collectDigitalFootprint(domain);

  // 4. Discover multi-page content (existing logic)
  const multiPageSnapshot = await discoverAndFetchPages(url);

  // 5. *** NEW: Get business context from heuristics ***
  const businessContextInput: BusinessContextInput = {
    url,
    domain,
    htmlSnippet,
    detectedSignals: {
      // Location-based signals
      hasPhysicalAddress: htmlSnippet.toLowerCase().includes('address') || htmlSnippet.includes('location'),
      hasOpeningHours: htmlSnippet.toLowerCase().includes('hours') || (htmlSnippet.includes('open') && htmlSnippet.includes('close')),
      hasEventDates: htmlSnippet.toLowerCase().includes('event') || htmlSnippet.includes('calendar'),
      hasSchedule: htmlSnippet.toLowerCase().includes('schedule'),
      hasMapEmbed: htmlSnippet.includes('google.com/maps') || htmlSnippet.includes('mapbox'),

      // Product/Commerce signals
      hasProductCatalog: htmlSnippet.toLowerCase().includes('product') || htmlSnippet.includes('shop'),
      hasAddToCart: htmlSnippet.toLowerCase().includes('add to cart'),
      hasPricingTables: htmlSnippet.toLowerCase().includes('pricing') && htmlSnippet.includes('table'),
      hasShoppingCart: htmlSnippet.toLowerCase().includes('cart') || htmlSnippet.includes('checkout'),

      // SaaS signals
      hasSaaSTerms: htmlSnippet.toLowerCase().includes('saas') || htmlSnippet.includes('software as a service'),
      hasFreeTrial: htmlSnippet.toLowerCase().includes('free trial') || htmlSnippet.includes('start free'),
      hasDemoRequest: htmlSnippet.toLowerCase().includes('demo') || htmlSnippet.includes('request demo'),
      hasAPIDocumentation: htmlSnippet.toLowerCase().includes('api') || htmlSnippet.includes('/docs'),

      // Content signals
      hasBlog: multiPageSnapshot.contentSignals.blogFound,
      hasCaseStudies: multiPageSnapshot.contentSignals.caseStudyPagesFound > 0,
      hasPortfolio: htmlSnippet.toLowerCase().includes('portfolio') || htmlSnippet.includes('my work'),

      // Platform hints (from existing detection logic)
      platformHints: detectPlatformHints(htmlSnippet),

      // Digital footprint signals
      hasGoogleBusinessProfile: digitalFootprint.gbp.found,
      hasLinkedInCompanyPage: digitalFootprint.linkedin.found,
      socialPlatforms: [
        digitalFootprint.instagram.found ? 'instagram' : null,
        digitalFootprint.facebook.found ? 'facebook' : null,
        digitalFootprint.linkedin.found ? 'linkedin' : null,
      ].filter(Boolean) as string[],
    },
  };

  const businessContext = getBusinessContext(businessContextInput);

  // 6. *** Log business context in development ***
  if (process.env.NODE_ENV === 'development') {
    logBusinessContext(businessContext, url);
  }

  // 7. *** Generate business-type aware prompt context ***
  const businessTypeContext = generateBusinessTypeContext(
    businessContext.businessType,
    businessContext.brandTier
  );

  // 8. Call LLM with business context
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content: GAP_SHARED_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: `
${GAP_SHARED_REASONING_PROMPT}

${GAP_IA_OUTPUT_PROMPT_V3}

════════════════════════════════════════════
BUSINESS CONTEXT (FROM HEURISTICS)
════════════════════════════════════════════

**Business Type**: ${businessContext.businessType}
**Brand Tier**: ${businessContext.brandTier}
**Confidence**: ${businessContext.confidence}

**Detected Signals:**
- Local business: ${businessContext.signals.isLocal}
- B2B: ${businessContext.signals.isB2B}
- B2C: ${businessContext.signals.isB2C}
- SaaS: ${businessContext.signals.isSaaS}
- E-commerce: ${businessContext.signals.isEcommerce}
- Physical location: ${businessContext.signals.hasPhysicalLocation}

**Heuristics Notes:**
${businessContext.notes.map((note) => `- ${note}`).join('\n')}

${businessTypeContext}

════════════════════════════════════════════
ANALYSIS INPUTS
════════════════════════════════════════════

URL: ${url}
Domain: ${domain}

Homepage HTML (truncated):
\`\`\`html
${htmlSnippet}
\`\`\`

Digital Footprint Signals:
\`\`\`json
${JSON.stringify(digitalFootprint, null, 2)}
\`\`\`

Multi-Page Snapshot:
\`\`\`json
${JSON.stringify(multiPageSnapshot, null, 2)}
\`\`\`

Now generate the Initial Assessment JSON output.
        `.trim(),
      },
    ],
    response_format: { type: 'json_object' },
  });

  // 9. Continue with existing parsing logic...
  const rawOutput = completion.choices[0]?.message?.content;

  // Parse using new parser
  const gapIaOutput = parseAndMapGapIaOutput(rawOutput, {
    url,
    domain,
    businessName: extractBusinessName(htmlSnippet, domain),
    companyType: mapBusinessTypeToCompanyType(businessContext.businessType),
    brandTier: businessContext.brandTier,
    htmlSignals: { /* ... */ },
    digitalFootprint,
    multiPageSnapshot,
  });

  return gapIaOutput;
}

// ============================================================================
// EXAMPLE 2: FULL GAP HANDLER INTEGRATION
// ============================================================================

/**
 * Example Full GAP handler (app/api/growth-plan/route.ts or Inngest function)
 */
export async function exampleFullGapHandler(gapIaRunId: string) {
  // 1. Fetch GAP-IA from database (existing logic)
  const gapIaRun = await fetchGapIaRunFromAirtable(gapIaRunId);
  const { url, domain } = gapIaRun;

  // 2. Re-fetch or extract business context
  // Option A: Re-run heuristics (if HTML still available)
  const businessContext = getBusinessContext({
    url,
    domain,
    htmlSnippet: gapIaRun.htmlSnapshot,
    detectedSignals: {
      hasGoogleBusinessProfile: gapIaRun.digitalFootprint?.gbp?.found,
      hasLinkedInCompanyPage: gapIaRun.digitalFootprint?.linkedin?.found,
      // ... extract other signals from stored data
    },
  });

  // Option B: Use stored businessType from GAP-IA if available
  // const businessContext = {
  //   businessType: gapIaRun.businessType || 'unknown',
  //   brandTier: gapIaRun.brandTier || 'other',
  // };

  // 3. Log business context
  if (process.env.NODE_ENV === 'development') {
    logBusinessContext(businessContext, url);
  }

  // 4. Parse GAP-IA into InitialAssessmentOutput format
  const gapIaOutput: InitialAssessmentOutput = {
    executiveSummary: gapIaRun.summary.narrative,
    marketingReadinessScore: gapIaRun.summary.overallScore,
    maturityStage: mapMaturityStage(gapIaRun.summary.maturityStage),
    topOpportunities: gapIaRun.summary.topOpportunities,
    quickWins: gapIaRun.quickWins.bullets.map((qw: any) => ({
      action: qw.action,
      dimensionId: mapCategoryToDimensionId(qw.category),
      impactLevel: qw.expectedImpact,
      effortLevel: qw.effortLevel,
    })),
    dimensionSummaries: [
      { id: 'brand', score: gapIaRun.dimensions.brand.score, summary: gapIaRun.dimensions.brand.oneLiner, keyIssue: gapIaRun.dimensions.brand.issues[0] },
      { id: 'content', score: gapIaRun.dimensions.content.score, summary: gapIaRun.dimensions.content.oneLiner, keyIssue: gapIaRun.dimensions.content.issues[0] },
      // ... rest of dimensions
    ],
    confidence: 'high',
  };

  // 5. Generate Full GAP prompt context
  const iaContext = generateFullGapPromptContext(gapIaOutput, {
    businessType: businessContext.businessType,
    brandTier: businessContext.brandTier,
    companyName: gapIaRun.businessName,
    url,
  });

  // 6. Call LLM with Full GAP prompt
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content: GAP_SHARED_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: `
${GAP_SHARED_REASONING_PROMPT}

${FULL_GAP_OUTPUT_PROMPT_V3}

════════════════════════════════════════════
BUSINESS CONTEXT (FROM HEURISTICS)
════════════════════════════════════════════

**Business Type**: ${businessContext.businessType}
**Brand Tier**: ${businessContext.brandTier}

**Signals:**
- Local: ${businessContext.signals.isLocal}
- B2B: ${businessContext.signals.isB2B}
- B2C: ${businessContext.signals.isB2C}
- SaaS: ${businessContext.signals.isSaaS}

${iaContext}

Now generate the Full Growth Acceleration Plan JSON output.
        `.trim(),
      },
    ],
    response_format: { type: 'json_object' },
  });

  // 7. Parse and map Full GAP output
  const rawOutput = completion.choices[0]?.message?.content;
  const fullGapResponse = parseAndMapFullGapOutput(
    rawOutput,
    gapIaOutput,
    {
      url,
      domain,
      businessName: gapIaRun.businessName,
      gapId: gapIaRun.id,
      companyType: businessContext.businessType,
      brandTier: businessContext.brandTier,
    }
  );

  return fullGapResponse;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Detect platform hints from HTML
 */
function detectPlatformHints(htmlSnippet: string): string[] {
  const hints: string[] = [];
  const html = htmlSnippet.toLowerCase();

  if (html.includes('shopify')) hints.push('shopify');
  if (html.includes('wordpress') || html.includes('wp-content')) hints.push('wordpress');
  if (html.includes('webflow')) hints.push('webflow');
  if (html.includes('squarespace')) hints.push('squarespace');
  if (html.includes('wix')) hints.push('wix');

  return hints;
}

/**
 * Map businessType to companyType enum used in existing schemas
 */
function mapBusinessTypeToCompanyType(businessType: string): string {
  const mapping: Record<string, string> = {
    'local-consumer': 'local_business',
    'b2b-saas': 'b2b_saas',
    'b2c-saas': 'b2c_saas',
    'ecommerce': 'ecommerce',
    'b2b-services': 'b2b_services',
    'b2c-services': 'b2c_services',
    'nonprofit': 'nonprofit',
    'portfolio': 'other',
    'media': 'media_publisher',
    'unknown': 'other',
  };

  return mapping[businessType] || 'other';
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
 * Extract business name from HTML or domain
 */
function extractBusinessName(htmlSnippet: string, domain: string): string {
  // Try to extract from title tag
  const titleMatch = htmlSnippet.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    return titleMatch[1].split('|')[0].split('-')[0].trim();
  }

  // Fallback to domain
  return domain.split('.')[0];
}

/**
 * Map maturity stage from legacy to new format
 */
function mapMaturityStage(legacyStage: string): 'Foundational' | 'Emerging' | 'Established' | 'Advanced' | 'CategoryLeader' {
  const mapping: Record<string, 'Foundational' | 'Emerging' | 'Established' | 'Advanced' | 'CategoryLeader'> = {
    'early': 'Foundational',
    'developing': 'Emerging',
    'established': 'Established',
    'advanced': 'Advanced',
    'category leader': 'CategoryLeader',
  };
  return mapping[legacyStage.toLowerCase()] || 'Emerging';
}

/**
 * Map category to dimension ID
 */
function mapCategoryToDimensionId(category: string): string {
  const mapping: Record<string, string> = {
    'Brand': 'brand',
    'Content': 'content',
    'SEO': 'seo',
    'Website & Conversion': 'website',
    'Digital Footprint': 'digitalFootprint',
    'Authority': 'authority',
    'Other': 'website',
  };
  return mapping[category] || 'website';
}

// Mock functions (replace with actual implementations)
declare function fetchHtmlBounded(url: string, maxBytes: number): Promise<string>;
declare function collectDigitalFootprint(domain: string): Promise<any>;
declare function discoverAndFetchPages(url: string): Promise<any>;
declare function fetchGapIaRunFromAirtable(id: string): Promise<any>;
declare const GAP_SHARED_SYSTEM_PROMPT: string;
declare const GAP_SHARED_REASONING_PROMPT: string;
declare const openai: any;
declare function parseAndMapGapIaOutput(rawOutput: any, context: any): any;
declare function parseAndMapFullGapOutput(rawOutput: any, gapIa: any, context: any): any;
