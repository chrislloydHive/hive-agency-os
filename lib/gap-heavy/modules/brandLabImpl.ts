// lib/gap-heavy/modules/brandLabImpl.ts
// Brand Lab V1 - Implementation
//
// This module implements the Brand Lab diagnostic engine.
// Analyzes brand health, clarity, and coherence through an LLM-powered diagnostic.
//
// V4 Additions:
// - Competitive layer (competitor discovery, cliché detection, differentiation scoring)
// - Integration support for narrative generation

import type { CompanyRecord } from '@/lib/airtable/companies';
import type {
  BrandLabResult,
  BrandDiagnosticResult,
  BrandActionPlan,
  BrandCompetitiveLandscape,
  BrandCompetitorSummary,
  BrandDiagnosticResultWithCompetitive,
} from './brandLab';
import {
  BrandDiagnosticResultSchema,
  BrandDiagnosticResultWithCompetitiveSchema,
  BrandCompetitiveLandscapeSchema,
  getBenchmarkLabel,
} from './brandLab';
import { buildBrandActionPlan } from './brandActionPlanBuilder';
import { getOpenAI } from '@/lib/openai';

// ============================================================================
// MAIN BRAND LAB FUNCTION
// ============================================================================

export interface BrandLabInput {
  company: CompanyRecord;
  websiteUrl: string;
  existingGapData?: {
    icp?: string;
    goals?: string[];
    budget?: string;
    maturity?: string;
  };
  /** Optional competitor URLs to analyze for competitive layer */
  competitorUrls?: string[];
  /** Skip competitive analysis (faster, but no competitive layer) */
  skipCompetitive?: boolean;
}

/**
 * Run Brand Lab V1 diagnostic
 *
 * BRAIN-FIRST: Now loads context from Brain before running, respects
 * existing brand positioning, and includes constraints in prompts.
 *
 * Analyzes brand health, clarity, and coherence using LLM-powered analysis
 * of website content and company context.
 *
 * V4: Now includes competitive layer analysis when competitor data is available.
 *
 * @param input - Company, URL, and optional GAP context
 * @returns BrandLabResult with diagnostic, action plan, and optional competitive layer
 */
export async function runBrandLab(input: BrandLabInput): Promise<BrandLabResult> {
  console.log('[Brand Lab V1] Starting brand diagnostic for:', input.websiteUrl);

  const { company, websiteUrl, existingGapData, competitorUrls, skipCompetitive } = input;

  // BRAIN-FIRST: Load context before running
  let brainContext: string | undefined;
  let contextIntegrity: 'high' | 'medium' | 'low' | 'none' = 'none';

  try {
    const { getLabContext, buildLabPromptContext, checkLabReadiness } = await import('@/lib/contextGraph/labContext');
    const labContext = await getLabContext(company.companyId || company.id, 'brand');
    contextIntegrity = labContext.contextIntegrity;

    const readiness = checkLabReadiness(labContext);
    if (readiness.warning) {
      console.log('[Brand Lab V1] Context warning:', readiness.warning);
    }

    console.log('[Brand Lab V1] Brain context loaded:', {
      integrity: labContext.contextIntegrity,
      hasICP: labContext.hasCanonicalICP,
      hasBrand: labContext.hasBrandPositioning,
    });

    brainContext = buildLabPromptContext(labContext);
  } catch (error) {
    console.warn('[Brand Lab V1] Could not load Brain context:', error);
  }

  // Step 1: Fetch and parse website content
  const siteContent = await fetchSiteContentForBrand(websiteUrl);

  // Step 2: Discover and fetch competitor content (if not skipped)
  let competitorExtracts: CompetitorExtract[] = [];
  if (!skipCompetitive) {
    competitorExtracts = await discoverAndFetchCompetitors(siteContent, competitorUrls);
  }

  // Step 3: Run LLM diagnostic (with competitive layer if available)
  let diagnostic: BrandDiagnosticResult | BrandDiagnosticResultWithCompetitive;

  if (competitorExtracts.length > 0) {
    diagnostic = await runBrandDiagnosticWithCompetitiveLLM({
      siteContent,
      company,
      gapData: existingGapData,
      competitorExtracts,
      brainContext,
    });

    // Dev logging
    if (process.env.NODE_ENV !== 'production') {
      console.log('[DEBUG BRAND DIAGNOSTIC (COMPETITIVE LAYER INCLUDED)]:', {
        competitorCount: competitorExtracts.length,
        differentiationScore: (diagnostic as BrandDiagnosticResultWithCompetitive).competitiveLandscape?.differentiationScore,
        clicheDensityScore: (diagnostic as BrandDiagnosticResultWithCompetitive).competitiveLandscape?.clicheDensityScore,
        contextIntegrity,
      });
    }
  } else {
    diagnostic = await runBrandDiagnosticLLM({
      siteContent,
      company,
      gapData: existingGapData,
      brainContext,
    });
  }

  // Step 4: Build action plan from diagnostic
  const actionPlan = buildBrandActionPlan(diagnostic);

  console.log('[Brand Lab V1] Brand diagnostic complete');
  console.log(`  - Overall Score: ${diagnostic.score}/100 (${diagnostic.benchmarkLabel})`);
  console.log(`  - ${actionPlan.now.length} items in NOW bucket`);
  console.log(`  - ${actionPlan.next.length} items in NEXT bucket`);
  console.log(`  - ${actionPlan.later.length} items in LATER bucket`);
  if ('competitiveLandscape' in diagnostic && diagnostic.competitiveLandscape) {
    console.log(`  - Competitive layer: ${diagnostic.competitiveLandscape.primaryCompetitors.length} competitors analyzed`);
    console.log(`  - Differentiation: ${diagnostic.competitiveLandscape.differentiationScore}/100`);
  }

  return {
    diagnostic,
    actionPlan,
  };
}

// ============================================================================
// WEBSITE CONTENT FETCHING
// ============================================================================

interface SiteContentForBrand {
  url: string;
  title: string;
  metaDescription: string;
  heroText: string;
  headlines: string[];
  navigationItems: string[];
  bodySnippets: string[];
  footerText: string;
  hasLogo: boolean;
  hasFavicon: boolean;
  colorPalette?: string[];
}

/**
 * Fetch and parse website content for brand analysis
 * Focuses on brand-relevant elements: messaging, visuals, structure
 */
async function fetchSiteContentForBrand(url: string): Promise<SiteContentForBrand> {
  console.log('[Brand Lab] Fetching site content for:', url);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HiveBrandLab/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    // Basic HTML parsing (could be enhanced with cheerio/jsdom if needed)
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);

    // Extract hero text (first h1 + nearby p tags)
    const h1Matches = html.match(/<h1[^>]*>([^<]+)<\/h1>/gi) || [];
    const heroText = h1Matches.slice(0, 2).join(' ').replace(/<[^>]+>/g, '');

    // Extract all headlines (h1, h2, h3)
    const headlineMatches = html.match(/<h[123][^>]*>([^<]+)<\/h[123]>/gi) || [];
    const headlines = headlineMatches
      .map(h => h.replace(/<[^>]+>/g, '').trim())
      .filter(h => h.length > 0 && h.length < 200)
      .slice(0, 15);

    // Extract navigation items
    const navMatches = html.match(/<nav[^>]*>([\s\S]*?)<\/nav>/gi) || [];
    const navText = navMatches.join(' ');
    const navLinkMatches = navText.match(/<a[^>]*>([^<]+)<\/a>/gi) || [];
    const navigationItems = navLinkMatches
      .map(a => a.replace(/<[^>]+>/g, '').trim())
      .filter(text => text.length > 0 && text.length < 50)
      .slice(0, 10);

    // Extract body text snippets (p tags)
    const pMatches = html.match(/<p[^>]*>([^<]+)<\/p>/gi) || [];
    const bodySnippets = pMatches
      .map(p => p.replace(/<[^>]+>/g, '').trim())
      .filter(text => text.length > 20 && text.length < 300)
      .slice(0, 10);

    // Extract footer text
    const footerMatches = html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/gi) || [];
    const footerText = footerMatches.join(' ').replace(/<[^>]+>/g, '').trim().substring(0, 500);

    // Check for brand assets
    const hasLogo = html.includes('logo') || html.includes('brand');
    const hasFavicon = html.includes('<link rel="icon"') || html.includes('<link rel="shortcut icon"');

    return {
      url,
      title: titleMatch?.[1] || '',
      metaDescription: metaDescMatch?.[1] || '',
      heroText,
      headlines,
      navigationItems,
      bodySnippets,
      footerText,
      hasLogo,
      hasFavicon,
    };
  } catch (error) {
    console.error('[Brand Lab] Error fetching site content:', error);

    // Return minimal structure on error
    return {
      url,
      title: '',
      metaDescription: '',
      heroText: '',
      headlines: [],
      navigationItems: [],
      bodySnippets: [],
      footerText: '',
      hasLogo: false,
      hasFavicon: false,
    };
  }
}

// ============================================================================
// LLM DIAGNOSTIC
// ============================================================================

interface BrandDiagnosticLLMInput {
  siteContent: SiteContentForBrand;
  company: CompanyRecord;
  gapData?: BrandLabInput['existingGapData'];
  brainContext?: string;
}

/**
 * Run LLM-powered brand diagnostic
 * Uses structured output to ensure consistent JSON format
 */
async function runBrandDiagnosticLLM(input: BrandDiagnosticLLMInput): Promise<BrandDiagnosticResult> {
  const { siteContent, company, gapData, brainContext } = input;

  console.log('[Brand Lab] Running LLM diagnostic...');
  if (brainContext) {
    console.log('[Brand Lab] Brain context provided, using Brain-first approach');
  }

  // Build context for LLM (prioritize Brain context)
  const companyContext = brainContext || `
Company: ${company.name}
Industry: ${company.industry || 'Unknown'}
Website: ${siteContent.url}
${gapData?.icp ? `Target ICP: ${gapData.icp}` : ''}
${gapData?.goals ? `Goals: ${gapData.goals.join(', ')}` : ''}
`.trim();

  const siteContentSummary = `
Title: ${siteContent.title}
Meta Description: ${siteContent.metaDescription}

Hero Text: ${siteContent.heroText}

Headlines (sample):
${siteContent.headlines.slice(0, 8).map((h, i) => `${i + 1}. ${h}`).join('\n')}

Navigation: ${siteContent.navigationItems.join(', ')}

Body Content Samples:
${siteContent.bodySnippets.slice(0, 5).map((s, i) => `${i + 1}. ${s}`).join('\n\n')}
`.trim();

  const systemPrompt = `You are a senior brand strategist and messaging consultant with expertise in brand clarity, positioning, and coherence.

Your task is to analyze a company's website and provide a structured brand diagnostic.

You MUST respond with ONLY a valid JSON object matching this structure (no markdown, no code blocks, pure JSON):

{
  "score": 0-100,
  "benchmarkLabel": "weak" | "developing" | "solid" | "strong" | "category_leader",
  "summary": "1-2 sentence brand health summary",
  "brandPillars": [{"name": "...", "description": "...", "isExplicit": true/false, "isPerceived": true/false, "strengthScore": 0-100}],
  "identitySystem": {
    "tagline": "...",
    "taglineClarityScore": 0-100,
    "corePromise": "...",
    "corePromiseClarityScore": 0-100,
    "toneOfVoice": "...",
    "toneConsistencyScore": 0-100,
    "personalityTraits": ["..."],
    "identityGaps": ["..."]
  },
  "messagingSystem": {
    "headlinePatterns": ["..."],
    "valueProps": [{"statement": "...", "clarityScore": 0-100, "specificityScore": 0-100, "uniquenessScore": 0-100, "resonanceScore": 0-100}],
    "differentiators": ["..."],
    "benefitVsFeatureRatio": 0-100,
    "icpClarityScore": 0-100,
    "messagingFocusScore": 0-100,
    "clarityIssues": ["..."]
  },
  "positioning": {
    "positioningTheme": "...",
    "positioningClarityScore": 0-100,
    "competitiveAngle": "...",
    "isClearWhoThisIsFor": true/false,
    "positioningRisks": ["..."]
  },
  "audienceFit": {
    "primaryICPDescription": "...",
    "icpSignals": ["..."],
    "alignmentScore": 0-100,
    "misalignmentNotes": ["..."]
  },
  "trustAndProof": {
    "trustArchetype": "...",
    "trustSignalsScore": 0-100,
    "humanPresenceScore": 0-100,
    "credibilityGaps": ["..."]
  },
  "visualSystem": {
    "paletteDescriptor": "...",
    "visualPersonalityWords": ["..."],
    "visualConsistencyScore": 0-100,
    "brandRecognitionScore": 0-100,
    "logoUsageNotes": "...",
    "visualGaps": ["..."]
  },
  "brandAssets": {
    "hasLogoVariants": true/false,
    "hasFavicons": true/false,
    "hasIllustrationStyle": true/false,
    "hasPhotographyStyle": true/false,
    "hasIconSystem": true/false,
    "hasBrandGuidelines": true/false,
    "assetCoverageScore": 0-100,
    "assetNotes": ["..."]
  },
  "inconsistencies": [{"id": "...", "type": "tone|visual|promise|audience|offer", "location": "...", "description": "...", "severity": "low|medium|high"}],
  "opportunities": [{"id": "...", "title": "...", "description": "...", "theme": "clarity|differentiation|trust|coherence|visual|story", "estimatedImpactScore": 1-5, "area": "brand|content|website|seo|authority"}],
  "risks": [{"id": "...", "description": "...", "severity": 1-5, "riskType": "confusion|misalignment|generic_positioning|trust|inconsistency"}]
}

Focus on:
- Brand clarity: Is it immediately clear what they do and for whom?
- Positioning: Do they differentiate or use generic language?
- Consistency: Is tone/messaging/promise consistent?
- Trust & humanity: Do they show proof, people, story?
- Visual coherence: Is the visual brand memorable and consistent?

CRITICAL CONSTRAINTS (Brain-First):
- If company context/Brain data is provided, respect the existing business model and target audience.
- Analyze the brand within the context of who they actually serve, not who you think they should serve.
- If ICP is already defined, validate against that ICP rather than inventing a new one.
- Recommendations should refine existing positioning, not suggest a complete pivot.
- Flag opportunities within the company's strategic direction.
`;

  const userPrompt = `Analyze this brand and website:

${companyContext}

SITE CONTENT:
${siteContentSummary}

Provide a comprehensive brand diagnostic in valid JSON format.`;

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-2024-08-06',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from LLM');
    }

    console.log('[Brand Lab] LLM response received, parsing...');

    const parsed = JSON.parse(content);
    const validated = BrandDiagnosticResultSchema.parse(parsed);

    console.log('[Brand Lab] ✓ Brand diagnostic validated');
    return validated;

  } catch (error) {
    console.error('[Brand Lab] Error in LLM diagnostic:', error);

    // Return fallback diagnostic
    console.log('[Brand Lab] Using fallback diagnostic');
    return getFallbackDiagnostic(siteContent, company);
  }
}

// ============================================================================
// FALLBACK DIAGNOSTIC
// ============================================================================

function getFallbackDiagnostic(siteContent: SiteContentForBrand, company: CompanyRecord): BrandDiagnosticResult {
  return {
    score: 50,
    benchmarkLabel: 'developing',
    summary: 'Unable to complete full brand analysis. Basic diagnostic generated.',

    brandPillars: [],

    identitySystem: {
      tagline: siteContent.metaDescription || undefined,
      taglineClarityScore: 50,
      corePromise: undefined,
      corePromiseClarityScore: 50,
      toneOfVoice: 'professional',
      toneConsistencyScore: 50,
      personalityTraits: ['professional'],
      identityGaps: ['Unable to analyze - LLM diagnostic failed'],
    },

    messagingSystem: {
      headlinePatterns: siteContent.headlines.slice(0, 3),
      valueProps: [],
      differentiators: [],
      benefitVsFeatureRatio: 50,
      icpClarityScore: 50,
      messagingFocusScore: 50,
      clarityIssues: ['Full analysis unavailable'],
    },

    positioning: {
      positioningTheme: 'Unknown',
      positioningClarityScore: 50,
      competitiveAngle: 'Unknown',
      isClearWhoThisIsFor: false,
      positioningRisks: ['Unable to assess positioning'],
    },

    audienceFit: {
      primaryICPDescription: 'Unknown',
      icpSignals: [],
      alignmentScore: 50,
      misalignmentNotes: ['Analysis incomplete'],
    },

    trustAndProof: {
      trustArchetype: 'Unknown',
      trustSignalsScore: 50,
      humanPresenceScore: 50,
      credibilityGaps: ['Analysis incomplete'],
    },

    visualSystem: {
      paletteDescriptor: 'Unknown',
      visualPersonalityWords: [],
      visualConsistencyScore: 50,
      brandRecognitionScore: 50,
      logoUsageNotes: undefined,
      visualGaps: ['Visual analysis unavailable'],
    },

    brandAssets: {
      hasLogoVariants: false,
      hasFavicons: siteContent.hasFavicon,
      hasIllustrationStyle: false,
      hasPhotographyStyle: false,
      hasIconSystem: false,
      hasBrandGuidelines: false,
      assetCoverageScore: 30,
      assetNotes: ['Limited asset analysis available'],
    },

    inconsistencies: [],
    opportunities: [],
    risks: [],
  };
}

// ============================================================================
// COMPETITIVE LAYER (V4)
// ============================================================================

interface CompetitorExtract {
  url: string;
  name: string;
  title: string;
  metaDescription: string;
  heroText: string;
  headlines: string[];
}

/**
 * Discover and fetch competitor content for competitive analysis.
 *
 * Lightweight approach: Simple HTTP fetch + HTML parsing.
 * No headless browser required.
 *
 * @param siteContent - Main site content (for competitor discovery patterns)
 * @param providedUrls - Optional explicit competitor URLs
 * @returns Array of competitor extracts
 */
async function discoverAndFetchCompetitors(
  siteContent: SiteContentForBrand,
  providedUrls?: string[]
): Promise<CompetitorExtract[]> {
  console.log('[Brand Lab Competitive] Discovering competitors...');

  const competitorUrls: string[] = [];

  // Use provided URLs first
  if (providedUrls && providedUrls.length > 0) {
    competitorUrls.push(...providedUrls.slice(0, 5));
    console.log(`[Brand Lab Competitive] Using ${competitorUrls.length} provided competitor URLs`);
  }

  // If we don't have enough competitors, we could try to discover them
  // from links on the site (footer, comparison pages, etc.)
  // For now, we skip auto-discovery since it's often unreliable
  // and require explicit competitor URLs for the competitive layer

  if (competitorUrls.length === 0) {
    console.log('[Brand Lab Competitive] No competitor URLs provided, skipping competitive layer');
    return [];
  }

  // Fetch competitor content (limit to 3-5 for performance)
  const extracts: CompetitorExtract[] = [];
  const urlsToFetch = competitorUrls.slice(0, 5);

  for (const url of urlsToFetch) {
    try {
      const extract = await fetchCompetitorExtract(url);
      if (extract) {
        extracts.push(extract);
      }
    } catch (error) {
      console.warn(`[Brand Lab Competitive] Failed to fetch competitor ${url}:`, error);
    }
  }

  console.log(`[Brand Lab Competitive] Fetched ${extracts.length} competitor extracts`);
  return extracts;
}

/**
 * Fetch and extract key brand elements from a competitor URL.
 *
 * Simple HTTP fetch + regex parsing. No headless browser.
 */
async function fetchCompetitorExtract(url: string): Promise<CompetitorExtract | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HiveBrandLab/1.0)',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const html = await response.text();

    // Extract key elements
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const h1Matches = html.match(/<h1[^>]*>([^<]+)<\/h1>/gi) || [];
    const headlineMatches = html.match(/<h[123][^>]*>([^<]+)<\/h[123]>/gi) || [];

    // Try to extract company name from title
    const title = titleMatch?.[1] || '';
    const name = title.split(/[|\-–—]/)[0]?.trim() || new URL(url).hostname;

    return {
      url,
      name,
      title,
      metaDescription: metaDescMatch?.[1] || '',
      heroText: h1Matches.slice(0, 2).join(' ').replace(/<[^>]+>/g, ''),
      headlines: headlineMatches
        .map(h => h.replace(/<[^>]+>/g, '').trim())
        .filter(h => h.length > 0 && h.length < 200)
        .slice(0, 8),
    };
  } catch (error) {
    console.warn(`[Brand Lab Competitive] Error fetching ${url}:`, error);
    return null;
  }
}

// ============================================================================
// LLM DIAGNOSTIC WITH COMPETITIVE LAYER
// ============================================================================

interface BrandDiagnosticWithCompetitiveLLMInput {
  siteContent: SiteContentForBrand;
  company: CompanyRecord;
  gapData?: BrandLabInput['existingGapData'];
  competitorExtracts: CompetitorExtract[];
  brainContext?: string;
}

/**
 * Run LLM-powered brand diagnostic WITH competitive layer.
 *
 * Extends the base diagnostic with:
 * - Competitor comparison
 * - Category language patterns
 * - Cliché detection
 * - Differentiation scoring
 * - White space opportunities
 */
async function runBrandDiagnosticWithCompetitiveLLM(
  input: BrandDiagnosticWithCompetitiveLLMInput
): Promise<BrandDiagnosticResultWithCompetitive> {
  const { siteContent, company, gapData, competitorExtracts, brainContext } = input;

  console.log('[Brand Lab] Running LLM diagnostic with competitive layer...');
  if (brainContext) {
    console.log('[Brand Lab] Brain context provided, using Brain-first approach');
  }

  // Build context for LLM (prioritize Brain context)
  const companyContext = brainContext || `
Company: ${company.name}
Industry: ${company.industry || 'Unknown'}
Website: ${siteContent.url}
${gapData?.icp ? `Target ICP: ${gapData.icp}` : ''}
${gapData?.goals ? `Goals: ${gapData.goals.join(', ')}` : ''}
`.trim();

  const siteContentSummary = `
Title: ${siteContent.title}
Meta Description: ${siteContent.metaDescription}

Hero Text: ${siteContent.heroText}

Headlines (sample):
${siteContent.headlines.slice(0, 8).map((h, i) => `${i + 1}. ${h}`).join('\n')}

Navigation: ${siteContent.navigationItems.join(', ')}

Body Content Samples:
${siteContent.bodySnippets.slice(0, 5).map((s, i) => `${i + 1}. ${s}`).join('\n\n')}
`.trim();

  const competitorContext = `
=== COMPETITOR EXTRACTS ===
${competitorExtracts.map((c, i) => `
COMPETITOR ${i + 1}: ${c.name}
URL: ${c.url}
Title: ${c.title}
Meta: ${c.metaDescription}
Hero: ${c.heroText}
Headlines: ${c.headlines.slice(0, 5).join(' | ')}
`).join('\n---\n')}
`.trim();

  const systemPrompt = `You are a senior brand strategist analyzing a brand AND its competitive landscape.

Your task is to provide both a brand diagnostic AND a competitive layer analysis.

IMPORTANT: For the competitive analysis:
1. Identify category language patterns (phrases everyone uses)
2. Detect clichés in the main brand's messaging
3. Score differentiation (how much this brand stands out)
4. Identify white space opportunities (positioning angles not claimed)
5. Note where this brand sounds too similar to competitors

You MUST respond with ONLY a valid JSON object (no markdown, no code blocks).

The JSON must include ALL brand diagnostic fields PLUS a "competitiveLandscape" object:

{
  // ... ALL standard brand diagnostic fields from BrandDiagnosticResult ...
  "score": 0-100,
  "benchmarkLabel": "weak" | "developing" | "solid" | "strong" | "category_leader",
  "summary": "...",
  "brandPillars": [...],
  "identitySystem": {...},
  "messagingSystem": {...},
  "positioning": {...},
  "audienceFit": {...},
  "trustAndProof": {...},
  "visualSystem": {...},
  "brandAssets": {...},
  "inconsistencies": [...],
  "opportunities": [...],
  "risks": [...],

  // COMPETITIVE LAYER (NEW)
  "competitiveLandscape": {
    "primaryCompetitors": [
      {
        "name": "Competitor name",
        "url": "URL",
        "positioningSnippet": "How they position themselves",
        "estimatedAngle": "e.g., low-cost, premium, specialized",
        "notes": "Brief observation"
      }
    ],
    "categoryLanguagePatterns": ["Common phrases used by all competitors"],
    "differentiationScore": 0-100,
    "clicheDensityScore": 0-100,
    "whiteSpaceOpportunities": ["Positioning angles not claimed by competitors"],
    "similarityNotes": ["Where brand sounds too similar to competitors"]
  }
}

differentiationScore: How unique/differentiated is this brand? (100 = completely unique, 0 = indistinguishable)
clicheDensityScore: How much generic/cliché language does this brand use? (100 = all cliché, 0 = no cliché)

Output ONLY valid JSON.`;

  const userPrompt = `Analyze this brand AND compare to competitors:

${companyContext}

MAIN SITE CONTENT:
${siteContentSummary}

${competitorContext}

Provide a comprehensive brand diagnostic WITH competitive layer analysis in valid JSON format.`;

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-2024-08-06',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 5000,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from LLM');
    }

    console.log('[Brand Lab] LLM response with competitive layer received, parsing...');

    const parsed = JSON.parse(content);
    const validated = BrandDiagnosticResultWithCompetitiveSchema.parse(parsed);

    console.log('[Brand Lab] Brand diagnostic with competitive layer validated');
    return validated;

  } catch (error) {
    console.error('[Brand Lab] Error in LLM diagnostic with competitive:', error);

    // Fall back to base diagnostic without competitive layer
    console.log('[Brand Lab] Falling back to base diagnostic');
    const baseDiagnostic = await runBrandDiagnosticLLM({
      siteContent,
      company,
      gapData,
    });

    // Add empty competitive landscape
    return {
      ...baseDiagnostic,
      competitiveLandscape: {
        primaryCompetitors: competitorExtracts.map(c => ({
          name: c.name,
          url: c.url,
          positioningSnippet: 'Analysis unavailable',
          estimatedAngle: 'Unknown',
          notes: 'Competitive analysis failed',
        })),
        categoryLanguagePatterns: [],
        differentiationScore: 50,
        clicheDensityScore: 50,
        whiteSpaceOpportunities: [],
        similarityNotes: ['Competitive analysis incomplete'],
      },
    };
  }
}
