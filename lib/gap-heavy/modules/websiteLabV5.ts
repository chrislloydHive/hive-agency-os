// lib/gap-heavy/modules/websiteLabV5.ts
// Website Lab V5 Strict Diagnostic
//
// This module provides the V5 LLM-based diagnostic that produces:
// - Page observations (facts only, no opinions)
// - Persona journey simulations with exact failure points
// - Top 5 blocking issues with specific pages and fixes
// - Quick wins and structural changes
//
// V5 is MANDATORY. No fallback to V4-derived data.

import type { WebsiteSiteGraphV4, HeuristicUxSummary } from './websiteLab';

// ============================================================================
// V5 OUTPUT TYPES
// ============================================================================

export type V5PageObservation = {
  pagePath: string;
  pageType: string;
  aboveFoldElements: string[];
  primaryCTAs: Array<{
    text: string;
    position: 'above_fold' | 'mid_page' | 'below_fold';
    destination: string | null;
  }>;
  trustProofElements: string[];
  missingUnclearElements: string[];
};

export type V5PersonaJourney = {
  persona: 'first_time' | 'ready_to_buy' | 'comparison_shopper';
  startingPage: string;
  intendedGoal: string;
  actualPath: string[];
  failurePoint: { page: string; reason: string } | null;
  confidenceScore: number;
  succeeded: boolean;
};

export type V5BlockingIssue = {
  id: number;
  severity: 'high' | 'medium' | 'low';
  affectedPersonas: Array<'first_time' | 'ready_to_buy' | 'comparison_shopper'>;
  page: string;
  whyItBlocks: string;
  concreteFix: { what: string; where: string };
};

export type V5QuickWin = {
  addressesIssueId: number;
  title: string;
  action: string;
  page: string;
  expectedImpact: string;
};

export type V5StructuralChange = {
  addressesIssueIds: number[];
  title: string;
  description: string;
  pagesAffected: string[];
  rationale: string;
};

export type V5DiagnosticOutput = {
  observations: V5PageObservation[];
  personaJourneys: V5PersonaJourney[];
  blockingIssues: V5BlockingIssue[];
  quickWins: V5QuickWin[];
  structuralChanges: V5StructuralChange[];
  score: number;
  scoreJustification: string;
};

// ============================================================================
// BRAIN CONTEXT (for prompt enrichment)
// ============================================================================

export type BrainContextForLab = {
  identitySummary?: string;
  objectivesSummary?: string;
  audienceSummary?: string;
};

// ============================================================================
// V5 SYSTEM PROMPT
// ============================================================================

const V5_SYSTEM_PROMPT = `You are a senior UX strategist analyzing a website. Your output must be SPECIFIC and PAGE-ANCHORED.

CRITICAL RULES:
1. Every issue MUST reference a specific page path (e.g., "/pricing", "/about")
2. Every fix MUST specify exactly WHERE on the page it goes
3. NO generic phrases like "strengthen the funnel" or "improve conversion paths"
4. NO buzzwords - only concrete, actionable observations
5. Every persona failure must specify the EXACT page where they failed and WHY

You will analyze the provided website data and produce a structured JSON response with:
- Phase 1: Page observations (facts only)
- Phase 2: Three persona journey simulations
- Phase 3: Top 5 blocking issues with specific fixes
- Phase 4: 3 quick wins + 2 structural changes
- Score and justification

OUTPUT FORMAT: Valid JSON only, no markdown, no explanation text.`;

// ============================================================================
// V5 USER PROMPT BUILDER
// ============================================================================

function buildV5UserPrompt(
  siteGraph: WebsiteSiteGraphV4,
  heuristics: HeuristicUxSummary,
  brainContext?: BrainContextForLab
): string {
  // Build page summaries
  const pageSummaries = siteGraph.pages.slice(0, 10).map(page => ({
    path: page.path,
    type: page.type,
    title: page.title || 'Untitled',
    hasHero: !!page.evidenceV3?.hero?.headline,
    heroHeadline: page.evidenceV3?.hero?.headline || null,
    ctaCount: page.evidenceV3?.hero?.ctaTexts?.length || 0,
    ctaTexts: page.evidenceV3?.hero?.ctaTexts || [],
    hasNavigation: (page.evidenceV3?.navigation?.links?.length || 0) > 0,
    navLinkCount: page.evidenceV3?.navigation?.links?.length || 0,
    testimonialCount: page.evidenceV3?.trust?.testimonialCount || 0,
    logoCount: page.evidenceV3?.trust?.logoCount || 0,
    proofStatements: page.evidenceV3?.trust?.proofStatements || [],
    clarityFlags: page.evidenceV3?.valueProp?.clarityFlags || [],
  }));

  // Build heuristic summary
  const heuristicSummary = {
    overallScore: heuristics.overallScore,
    findingsCount: heuristics.findings.length,
    topFindings: heuristics.findings.slice(0, 5).map(f => ({
      heuristic: f.rule,
      severity: f.severity,
      description: f.description,
      page: f.pagePath,
    })),
  };

  // Build context section if available
  let contextSection = '';
  if (brainContext) {
    contextSection = `
BUSINESS CONTEXT:
${brainContext.identitySummary ? `Identity: ${brainContext.identitySummary}` : ''}
${brainContext.objectivesSummary ? `Objectives: ${brainContext.objectivesSummary}` : ''}
${brainContext.audienceSummary ? `Target Audience: ${brainContext.audienceSummary}` : ''}
`;
  }

  return `Analyze this website and produce V5 diagnostic output.
${contextSection}
PAGES ANALYZED (${pageSummaries.length}):
${JSON.stringify(pageSummaries, null, 2)}

HEURISTIC EVALUATION:
${JSON.stringify(heuristicSummary, null, 2)}

SITE STRUCTURE:
- Total pages: ${siteGraph.pages.length}
- Total edges (links): ${siteGraph.edges.length}

Produce a JSON response with this exact structure:
{
  "observations": [
    {
      "pagePath": "/path",
      "pageType": "home|pricing|about|etc",
      "aboveFoldElements": ["element1", "element2"],
      "primaryCTAs": [{"text": "CTA text", "position": "above_fold|mid_page|below_fold", "destination": "/target-path"}],
      "trustProofElements": ["testimonials", "logos", etc],
      "missingUnclearElements": ["what's missing or unclear"]
    }
  ],
  "personaJourneys": [
    {
      "persona": "first_time|ready_to_buy|comparison_shopper",
      "startingPage": "/",
      "intendedGoal": "what they want to do",
      "actualPath": ["/", "/about", "/pricing"],
      "failurePoint": {"page": "/pricing", "reason": "No clear pricing information"} or null if succeeded,
      "confidenceScore": 0-100,
      "succeeded": true/false
    }
  ],
  "blockingIssues": [
    {
      "id": 1,
      "severity": "high|medium|low",
      "affectedPersonas": ["first_time", "ready_to_buy"],
      "page": "/specific-page",
      "whyItBlocks": "Specific reason why this blocks conversion",
      "concreteFix": {"what": "Add pricing table", "where": "Above the fold on /pricing"}
    }
  ],
  "quickWins": [
    {
      "addressesIssueId": 1,
      "title": "Add pricing clarity",
      "action": "Specific action to take",
      "page": "/pricing",
      "expectedImpact": "Measurable expected impact"
    }
  ],
  "structuralChanges": [
    {
      "addressesIssueIds": [1, 2],
      "title": "Restructure navigation",
      "description": "Detailed description",
      "pagesAffected": ["/", "/about"],
      "rationale": "Why this structural change is needed"
    }
  ],
  "score": 0-100,
  "scoreJustification": "Brief justification for the score (max 5 lines)"
}

REQUIREMENTS:
- Analyze all ${pageSummaries.length} pages provided
- Simulate exactly 3 persona journeys (first_time, ready_to_buy, comparison_shopper)
- Identify exactly 5 blocking issues
- Provide exactly 3 quick wins
- Provide exactly 2 structural changes
- Every issue must reference a specific page path
- Every persona failure must explain exactly where and why they failed`;
}

// ============================================================================
// DETERMINISTIC V5 FALLBACK GENERATOR
// ============================================================================

/**
 * Generate a deterministic V5 diagnostic from V4 data when LLM fails
 *
 * This ensures v5Diagnostic ALWAYS exists, even if the OpenAI API fails.
 * The fallback uses existing parsed page data and heuristic findings.
 */
function generateDeterministicV5Fallback(
  siteGraph: WebsiteSiteGraphV4,
  heuristics: HeuristicUxSummary
): V5DiagnosticOutput {
  console.log('[WebsiteLab V5] Generating deterministic fallback from V4 data...');

  const pages = siteGraph.pages;
  const homePage = pages.find(p => p.type === 'home');
  const pricingPage = pages.find(p => p.type === 'pricing');
  const contactPage = pages.find(p => p.type === 'contact');

  // Build observations from page evidence
  const observations: V5PageObservation[] = pages.slice(0, 10).map(page => {
    const ev = page.evidenceV3;
    return {
      pagePath: page.path,
      pageType: page.type,
      aboveFoldElements: [
        ev?.hero?.headline ? `Headline: "${ev.hero.headline}"` : 'No headline detected',
        ev?.hero?.subheadline ? `Subheadline present` : 'No subheadline',
        ev?.hero?.hasPrimaryCta ? `Primary CTA: "${ev.hero.ctaTexts?.[0] || 'Unknown'}"` : 'No primary CTA above fold',
      ].filter(Boolean),
      primaryCTAs: (ev?.hero?.ctaTexts || []).slice(0, 3).map((text: string) => ({
        text,
        position: 'above_fold' as const,
        destination: null,
      })),
      trustProofElements: [
        ev?.trust?.testimonialCount ? `${ev.trust.testimonialCount} testimonials` : null,
        ev?.trust?.logoCount ? `${ev.trust.logoCount} client logos` : null,
        ...(ev?.trust?.proofStatements?.slice(0, 2) || []),
      ].filter(Boolean) as string[],
      missingUnclearElements: [
        ...((ev?.valueProp?.clarityFlags || []) as string[]),
        !ev?.hero?.hasPrimaryCta ? 'Missing primary CTA above fold' : null,
        ev?.trust?.trustDensity === 0 ? 'No trust signals on page' : null,
      ].filter(Boolean) as string[],
    };
  });

  // Build persona journeys based on page availability
  const personaJourneys: V5PersonaJourney[] = [
    {
      persona: 'first_time',
      startingPage: '/',
      intendedGoal: 'Understand what this company does',
      actualPath: ['/', homePage?.path === '/' ? '/about' : '/'].filter(Boolean),
      failurePoint: homePage?.evidenceV3?.valueProp?.clarityFlags?.length
        ? { page: '/', reason: 'Value proposition unclear - ' + (homePage.evidenceV3.valueProp.clarityFlags[0] || 'generic messaging') }
        : null,
      confidenceScore: homePage?.evidenceV3?.valueProp?.clarityFlags?.length ? 40 : 75,
      succeeded: !homePage?.evidenceV3?.valueProp?.clarityFlags?.length,
    },
    {
      persona: 'ready_to_buy',
      startingPage: '/',
      intendedGoal: 'Find pricing and sign up',
      actualPath: pricingPage ? ['/', pricingPage.path] : ['/'],
      failurePoint: pricingPage
        ? (pricingPage.evidenceV3?.hero?.hasPrimaryCta ? null : { page: pricingPage.path, reason: 'No clear CTA on pricing page' })
        : { page: '/', reason: 'No pricing page found' },
      confidenceScore: pricingPage?.evidenceV3?.hero?.hasPrimaryCta ? 80 : 35,
      succeeded: !!pricingPage?.evidenceV3?.hero?.hasPrimaryCta,
    },
    {
      persona: 'comparison_shopper',
      startingPage: '/',
      intendedGoal: 'Compare features and understand differentiation',
      actualPath: ['/'],
      failurePoint: homePage?.evidenceV3?.structure?.hasFeaturesSection
        ? null
        : { page: '/', reason: 'No clear feature comparison or differentiation visible' },
      confidenceScore: homePage?.evidenceV3?.structure?.hasFeaturesSection ? 65 : 40,
      succeeded: !!homePage?.evidenceV3?.structure?.hasFeaturesSection,
    },
  ];

  // Build blocking issues from heuristic findings
  const blockingIssues: V5BlockingIssue[] = heuristics.findings.slice(0, 5).map((finding, idx) => ({
    id: idx + 1,
    severity: finding.severity as 'high' | 'medium' | 'low',
    affectedPersonas: finding.severity === 'high'
      ? ['first_time', 'ready_to_buy', 'comparison_shopper'] as const
      : ['ready_to_buy'] as const,
    page: finding.pagePath || '/',
    whyItBlocks: finding.description,
    concreteFix: {
      what: `Address: ${finding.rule}`,
      where: finding.pagePath ? `On ${finding.pagePath}` : 'Site-wide',
    },
  }));

  // Ensure we have at least one blocking issue
  if (blockingIssues.length === 0) {
    blockingIssues.push({
      id: 1,
      severity: 'medium',
      affectedPersonas: ['first_time'],
      page: '/',
      whyItBlocks: 'Website analysis completed but no specific blocking issues identified by heuristics',
      concreteFix: {
        what: 'Review user journey from homepage to conversion',
        where: 'Homepage and key landing pages',
      },
    });
  }

  // Build quick wins from top issues
  const quickWins: V5QuickWin[] = blockingIssues.slice(0, 3).map(issue => ({
    addressesIssueId: issue.id,
    title: `Fix: ${issue.concreteFix.what.substring(0, 50)}`,
    action: issue.concreteFix.what,
    page: issue.page,
    expectedImpact: issue.severity === 'high' ? 'High impact on conversion' : 'Moderate UX improvement',
  }));

  // Build structural changes
  const structuralChanges: V5StructuralChange[] = [];
  if (!pricingPage) {
    structuralChanges.push({
      addressesIssueIds: [2],
      title: 'Add dedicated pricing page',
      description: 'Create a clear pricing page accessible from main navigation',
      pagesAffected: ['/', '/pricing'],
      rationale: 'Ready-to-buy visitors need easy access to pricing information',
    });
  }
  if (!contactPage) {
    structuralChanges.push({
      addressesIssueIds: [3],
      title: 'Add clear contact/demo page',
      description: 'Create a dedicated contact or demo request page',
      pagesAffected: ['/', '/contact'],
      rationale: 'Conversion requires a clear call-to-action destination',
    });
  }
  if (structuralChanges.length === 0) {
    structuralChanges.push({
      addressesIssueIds: blockingIssues.map(i => i.id),
      title: 'Improve conversion funnel clarity',
      description: 'Streamline the path from homepage to conversion',
      pagesAffected: pages.slice(0, 3).map(p => p.path),
      rationale: 'Multiple persona journeys show friction in the conversion path',
    });
  }

  // Calculate score from heuristics
  const score = Math.max(20, Math.min(100, heuristics.overallScore));

  const fallback: V5DiagnosticOutput = {
    observations,
    personaJourneys,
    blockingIssues,
    quickWins,
    structuralChanges,
    score,
    scoreJustification: `[FALLBACK] Score based on heuristic evaluation (${heuristics.overallScore}/100). ${heuristics.findings.length} UX issues identified. LLM analysis unavailable - using deterministic V4-derived assessment.`,
  };

  console.log('[WebsiteLab V5] ✓ Deterministic fallback generated:', {
    observations: fallback.observations.length,
    personaJourneys: fallback.personaJourneys.length,
    blockingIssues: fallback.blockingIssues.length,
    quickWins: fallback.quickWins.length,
    structuralChanges: fallback.structuralChanges.length,
    score: fallback.score,
  });

  return fallback;
}

// ============================================================================
// MAIN V5 DIAGNOSTIC FUNCTION
// ============================================================================

/**
 * Run V5 diagnostic analysis using LLM
 *
 * V5 output is MANDATORY - this function ALWAYS returns a valid V5DiagnosticOutput.
 * If the LLM call fails, a deterministic fallback is generated from V4 data.
 */
export async function runV5Diagnostic(
  siteGraph: WebsiteSiteGraphV4,
  heuristics: HeuristicUxSummary,
  brainContext?: BrainContextForLab
): Promise<V5DiagnosticOutput> {
  // VERIFICATION LOG - Confirms V5 is executing
  console.error('🚨 WEBSITE LAB V5 EXECUTED 🚨');
  console.error('🚨 Pages in siteGraph:', siteGraph.pages.length);
  console.error('🚨 Heuristic findings:', heuristics.findings.length);

  console.log('[WebsiteLab V5] Running V5 diagnostic analysis...');

  const userPrompt = buildV5UserPrompt(siteGraph, heuristics, brainContext);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: V5_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 4000,
      }),
    });

    // DEBUG: Log response details to diagnose HTML-instead-of-JSON issue
    const text = await response.text();
    console.error("[V5 OpenAI] status=", response.status);
    console.error("[V5 OpenAI] content-type=", response.headers.get("content-type"));
    console.error("[V5 OpenAI] bodyHead=", text.slice(0, 200));

    if (!response.ok) {
      console.error(`[WebsiteLab V5] OpenAI API error: ${response.status} - using fallback`);
      return generateDeterministicV5Fallback(siteGraph, heuristics);
    }

    let data: any;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error(`[WebsiteLab V5] Non-JSON response from OpenAI - using fallback`);
      return generateDeterministicV5Fallback(siteGraph, heuristics);
    }

    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('[WebsiteLab V5] No content in OpenAI response - using fallback');
      return generateDeterministicV5Fallback(siteGraph, heuristics);
    }

    // Parse JSON response
    const cleanedContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    let parsed: V5DiagnosticOutput;
    try {
      parsed = JSON.parse(cleanedContent) as V5DiagnosticOutput;
    } catch (parseError) {
      console.error('[WebsiteLab V5] JSON parse failed. Raw content:', cleanedContent.substring(0, 500));
      return generateDeterministicV5Fallback(siteGraph, heuristics);
    }

    // Validate structure
    if (!parsed.observations || !parsed.personaJourneys || !parsed.blockingIssues) {
      console.error('[WebsiteLab V5] Invalid structure - using fallback');
      return generateDeterministicV5Fallback(siteGraph, heuristics);
    }

    console.log('[WebsiteLab V5] ✓ V5 diagnostic complete (LLM):', {
      observations: parsed.observations.length,
      personaJourneys: parsed.personaJourneys.length,
      blockingIssues: parsed.blockingIssues.length,
      quickWins: parsed.quickWins?.length ?? 0,
      structuralChanges: parsed.structuralChanges?.length ?? 0,
      score: parsed.score,
    });

    return parsed;
  } catch (error) {
    console.error('[WebsiteLab V5] LLM call failed:', error);
    return generateDeterministicV5Fallback(siteGraph, heuristics);
  }
}
