// lib/gap-heavy/modules/brandLabImpl.ts
// Brand Lab V1 - Implementation
//
// This module implements the Brand Lab diagnostic engine.
// Analyzes brand health, clarity, and coherence through an LLM-powered diagnostic.

import type { CompanyRecord } from '@/lib/airtable/companies';
import type {
  BrandLabResult,
  BrandDiagnosticResult,
  BrandActionPlan,
} from './brandLab';
import { BrandDiagnosticResultSchema, getBenchmarkLabel } from './brandLab';
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
}

/**
 * Run Brand Lab V1 diagnostic
 *
 * Analyzes brand health, clarity, and coherence using LLM-powered analysis
 * of website content and company context.
 *
 * @param input - Company, URL, and optional GAP context
 * @returns BrandLabResult with diagnostic and action plan
 */
export async function runBrandLab(input: BrandLabInput): Promise<BrandLabResult> {
  console.log('[Brand Lab V1] Starting brand diagnostic for:', input.websiteUrl);

  const { company, websiteUrl, existingGapData } = input;

  // Step 1: Fetch and parse website content
  const siteContent = await fetchSiteContentForBrand(websiteUrl);

  // Step 2: Run LLM diagnostic
  const diagnostic = await runBrandDiagnosticLLM({
    siteContent,
    company,
    gapData: existingGapData,
  });

  // Step 3: Build action plan from diagnostic
  const actionPlan = buildBrandActionPlan(diagnostic);

  console.log('[Brand Lab V1] ✓ Brand diagnostic complete');
  console.log(`  - Overall Score: ${diagnostic.score}/100 (${diagnostic.benchmarkLabel})`);
  console.log(`  - ${actionPlan.now.length} items in NOW bucket`);
  console.log(`  - ${actionPlan.next.length} items in NEXT bucket`);
  console.log(`  - ${actionPlan.later.length} items in LATER bucket`);

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
}

/**
 * Run LLM-powered brand diagnostic
 * Uses structured output to ensure consistent JSON format
 */
async function runBrandDiagnosticLLM(input: BrandDiagnosticLLMInput): Promise<BrandDiagnosticResult> {
  const { siteContent, company, gapData } = input;

  console.log('[Brand Lab] Running LLM diagnostic...');

  // Build context for LLM
  const companyContext = `
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
