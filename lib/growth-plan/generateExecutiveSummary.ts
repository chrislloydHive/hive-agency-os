/**
 * Executive Summary Generation Module
 * 
 * Generates a comprehensive executive summary for the Growth Acceleration Plan (GAP)
 * with validation and rewrite logic to ensure completeness.
 */

import OpenAI from 'openai';
import { env } from '@/lib/env';
import type {
  ExecutiveSummary,
  Scorecard,
  SectionAnalysis,
  MarketAnalysis,
  PositioningAnalysis,
  DataAvailability,
  FullGapPlanResponse,
  RoadmapInitiative,
  SectionAnalysisCardLevel,
  SectionAnalysisDeepDive,
} from './types';
import type { Opportunity } from './types';
import type { ContentInventory } from './analyzeContentInventory';
import type { TechnicalSeoSignals } from './types';
import type { SiteFeatures } from '@/lib/eval/siteFeatures';
import { detectMaturity, computeMaturityStage } from './detectMaturity';

interface ExecutiveSummaryContext {
  companyName: string;
  websiteUrl: string;
  scorecard: Scorecard;
  sectionAnalyses: {
    websiteAndConversion: SectionAnalysis;
    seoAndVisibility: SectionAnalysis;
    contentAndMessaging: SectionAnalysis;
    brandAndPositioning: SectionAnalysis;
  };
  marketAnalysis?: MarketAnalysis;
  positioningAnalysis?: PositioningAnalysis;
  dataAvailability?: DataAvailability;
  contentInventory?: ContentInventory;
  technicalSeoSignals?: TechnicalSeoSignals;
  competitorAnalysis?: {
    categorySummary?: string;
    positioningPatterns?: string[];
    messagingComparison?: string[];
    differentiationOpportunities?: string[];
  };
  topOpportunities?: Opportunity[];
  features?: SiteFeatures; // SiteFeatures for authority signals
}

/**
 * Get OpenAI client instance
 */
function getOpenAI(): OpenAI {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  return new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    timeout: 60000, // 60 seconds for executive summary generation (more complex than other steps)
  });
}

/**
 * Check if narrative contains confidence caveat phrases
 */
function hasConfidenceCaveat(narrative: string): boolean {
  const caveatPhrases = [
    'limited visibility',
    'based on partial data',
    'given partial coverage',
    'limited data',
    'partial visibility',
    'limited coverage',
  ];
  
  const lowerNarrative = narrative.toLowerCase();
  return caveatPhrases.some(phrase => lowerNarrative.includes(phrase));
}

/**
 * Check and enforce confidence caveat for low-confidence summaries
 */
async function checkConfidenceCaveat(
  summary: ExecutiveSummary,
  dataAvailability?: DataAvailability
): Promise<ExecutiveSummary> {
  if (!dataAvailability) {
    return summary;
  }

  const needsCaveat = 
    dataAvailability.overallConfidence === 'low' || 
    dataAvailability.siteCrawl.coverageLevel === 'minimal';

  if (!needsCaveat) {
    return summary;
  }

  // Check if narrative already contains a caveat phrase
  if (hasConfidenceCaveat(summary.narrative)) {
    console.log('✅ Executive summary already includes confidence caveat');
    return summary;
  }

  console.warn('⚠️  Low confidence summary missing caveat phrase, adding...');
  
  // Add caveat to narrative
  const caveatPhrases = [
    'Given limited visibility into the site',
    'Based on partial data coverage',
    'With partial site coverage',
  ];
  
  // Add caveat at the beginning or end of narrative
  const narrative = summary.narrative.trim();
  const hasPeriod = narrative.endsWith('.');
  const caveat = caveatPhrases[0] + ', ';
  
  // Insert caveat after first sentence or at start
  const sentences = narrative.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length > 0) {
    const firstSentence = sentences[0].trim();
    const restOfNarrative = sentences.slice(1).join('. ').trim();
    const updatedNarrative = `${caveat}${firstSentence}. ${restOfNarrative ? restOfNarrative + (hasPeriod ? '.' : '') : ''}`;
    
    return {
      ...summary,
      narrative: updatedNarrative,
      expectedOutcomes: Array.isArray(summary.expectedOutcomes) ? summary.expectedOutcomes : [],
    };
  }
  
  // Fallback: prepend caveat
  return {
    ...summary,
    narrative: `${caveat}${narrative}`,
    expectedOutcomes: Array.isArray(summary.expectedOutcomes) ? summary.expectedOutcomes : [],
  };
}

/**
 * Validate executive summary meets minimum requirements
 * Updated: expectedOutcomes is now an array
 */
function validateExecutiveSummary(summary: ExecutiveSummary): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (!summary.narrative || summary.narrative.trim().length < 350) {
    issues.push(`Narrative must be at least 350 characters (current: ${summary.narrative?.length || 0})`);
  }

  if (!Array.isArray(summary.strengths) || summary.strengths.length < 2) {
    issues.push(`Strengths must be an array with at least 2 items (current: ${summary.strengths?.length || 0})`);
  }

  if (!Array.isArray(summary.keyIssues) || summary.keyIssues.length < 2) {
    issues.push(`Key issues must be an array with at least 2 items (current: ${summary.keyIssues?.length || 0})`);
  }

  if (!Array.isArray(summary.strategicPriorities) || summary.strategicPriorities.length < 2) {
    issues.push(`Strategic priorities must be an array with at least 2 items (current: ${summary.strategicPriorities?.length || 0})`);
  }

  // Validate expectedOutcomes is an array (can be empty, but must be array)
  if (!Array.isArray(summary.expectedOutcomes)) {
    issues.push('Expected outcomes must be an array');
  }

  // Check for empty strings in arrays
  if (summary.strengths?.some(s => !s || s.trim().length === 0)) {
    issues.push('Strengths array contains empty strings');
  }
  if (summary.keyIssues?.some(k => !k || k.trim().length === 0)) {
    issues.push('Key issues array contains empty strings');
  }
  if (summary.strategicPriorities?.some(p => !p || p.trim().length === 0)) {
    issues.push('Strategic priorities array contains empty strings');
  }
  if (Array.isArray(summary.expectedOutcomes) && summary.expectedOutcomes.some(e => !e || e.trim().length === 0)) {
    issues.push('Expected outcomes array contains empty strings');
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

/**
 * Rewrite executive summary to enforce completeness
 * Expands narrative, ensures minimum item counts, and synthesizes missing points
 */
async function rewriteExecutiveSummary(
  existingSummary: ExecutiveSummary,
  context: ExecutiveSummaryContext
): Promise<ExecutiveSummary> {
  console.log('🔄 Rewriting executive summary to enforce completeness...');

  const {
    companyName,
    websiteUrl,
    scorecard,
    sectionAnalyses,
    marketAnalysis,
    positioningAnalysis,
    dataAvailability,
    features,
  } = context;

  // Extract authority signals for prompt
  const authoritySignals = features?.authority;
  const contentSignals = features?.content;

  const overallScore = scorecard.overall;

  // Detect maturity level from SiteFeatures
  const detectedMaturity = features ? detectMaturity(features) : 'growing';
  const maturityStage = computeMaturityStage(overallScore, detectedMaturity);

  // Identify what's missing
  const missingStrengths = Math.max(0, 3 - (existingSummary.strengths?.length || 0));
  const missingIssues = Math.max(0, 3 - (existingSummary.keyIssues?.length || 0));
  const missingPriorities = Math.max(0, 3 - (existingSummary.strategicPriorities?.length || 0));
  const narrativeTooShort = !existingSummary.narrative || existingSummary.narrative.trim().length < 350;
  const missingOutcomes = !Array.isArray(existingSummary.expectedOutcomes) || existingSummary.expectedOutcomes.length === 0;

  const needsCaveat = dataAvailability && (
    dataAvailability.overallConfidence === 'low' || 
    dataAvailability.siteCrawl.coverageLevel === 'minimal'
  );

  const systemPrompt = `You are fixing an incomplete executive summary. Expand and complete it:

REQUIREMENTS:
1. Narrative: Expand to 350+ chars, 4+ sentences. Reference:
   - Overall score (${overallScore ?? 'Not evaluated'}) and dimension scores
   - Section analysis findings (Brand, Content, SEO, Website)
   - Positioning/market context
   ${needsCaveat ? `- REQUIRED: Include a caveat phrase like "limited visibility", "based on partial data", or "given partial coverage"` : ''}

MATURITY-BASED TONE:
- Use detected maturity level to control tone
- For "Mature" or "Category Leader": Use refinement language ("opportunities to sharpen", "could enhance"), NOT fundamental deficiency language ("lacks", "weak", "missing")
- For "Established": Use constructive language ("could be strengthened", "opportunities to expand")
- For "Growing" or "Early Stage": Can use more direct improvement-focused language

2. Strengths: Ensure 3+ items. Synthesize ${missingStrengths} missing from:
   - Brand & Positioning findings
   - Content & Messaging findings  
   - SEO/Visibility or Website/Conversion findings
   - Reference scores where strong (70+)

3. Key Issues: Ensure 3+ items. Synthesize ${missingIssues} missing from:
   - Brand/positioning issues
   - Content/messaging issues
   - SEO/Visibility or Website/Conversion issues
   - Reference scores where weak (<50)

4. Strategic Priorities: Ensure 3+ items. Synthesize ${missingPriorities} missing priorities that:
   - Cut across channels
   - Reference positioning/market/content opportunities

5. Expected Outcomes: ${missingOutcomes ? 'Write a paragraph' : 'Ensure paragraph'} tying benefits to strategic priorities.

${needsCaveat ? `
CONFIDENCE CAVEAT REQUIRED:
- If dataAvailability.overallConfidence is "low" OR coverageLevel is "minimal":
  - MUST include phrase: "limited visibility", "based on partial data", or "given partial coverage"
  - Use cautious language, avoid absolute statements
` : ''}

Keep existing good content. Add missing items. Return complete JSON.`;

  // Build condensed context focusing on what's needed for synthesis
  const dimensionScores = [
    scorecard.website !== undefined ? `Website: ${scorecard.website}/100` : null,
    scorecard.content !== undefined ? `Content: ${scorecard.content}/100` : null,
    scorecard.seo !== undefined ? `SEO: ${scorecard.seo}/100` : null,
    scorecard.brand !== undefined ? `Brand: ${scorecard.brand}/100` : null,
    scorecard.authority !== undefined ? `Authority: ${scorecard.authority}/100` : null,
  ].filter(Boolean).join(', ');

  const userPrompt = `Fix this incomplete summary:

EXISTING SUMMARY:
- Narrative: ${existingSummary.narrative?.substring(0, 150) || 'Missing'}...
- Strengths: ${existingSummary.strengths?.length || 0} items (need 3+)
- Key Issues: ${existingSummary.keyIssues?.length || 0} items (need 3+)
- Strategic Priorities: ${existingSummary.strategicPriorities?.length || 0} items (need 3+)
- Expected Outcomes: ${Array.isArray(existingSummary.expectedOutcomes) && existingSummary.expectedOutcomes.length > 0 ? `${existingSummary.expectedOutcomes.length} items` : 'Missing'}

SCORECARD:
Overall: ${overallScore ?? 'Not evaluated'}, Dimensions: ${dimensionScores}
Maturity Stage: ${maturityStage} (Detected: ${detectedMaturity})

SECTION FINDINGS:
Brand: ${(sectionAnalyses.brandAndPositioning.keyFindings || sectionAnalyses.brandAndPositioning.issues || []).slice(0, 2).join('; ')}
Content: ${(sectionAnalyses.contentAndMessaging.keyFindings || sectionAnalyses.contentAndMessaging.issues || []).slice(0, 2).join('; ')}
SEO: ${(sectionAnalyses.seoAndVisibility.keyFindings || sectionAnalyses.seoAndVisibility.issues || []).slice(0, 2).join('; ')}
Website: ${(sectionAnalyses.websiteAndConversion.keyFindings || sectionAnalyses.websiteAndConversion.issues || []).slice(0, 2).join('; ')}

${positioningAnalysis ? `Positioning: ${positioningAnalysis.primaryAudience}, ${positioningAnalysis.geographicFocus}` : ''}
${marketAnalysis ? `Market: ${marketAnalysis.category}` : ''}

${authoritySignals ? `Authority Signals:
- Testimonials: ${authoritySignals.testimonialCount}, Logos: ${authoritySignals.customerLogoCount}, Case Studies: ${contentSignals?.caseStudyCount ?? 0}
- Logo Strip: ${authoritySignals.hasCustomerLogoStrip ? 'Yes' : 'No'}, Trusted By: ${authoritySignals.hasTrustedBySection ? 'Yes' : 'No'}
- Awards: ${authoritySignals.hasAwardsOrBadges ? 'Yes' : 'No'}, Press: ${authoritySignals.hasPressLogos ? 'Yes' : 'No'}, Reviews: ${authoritySignals.hasG2OrReviewBadges ? 'Yes' : 'No'}

CRITICAL: If authoritySignals show presence (logos > 0, testimonials > 0, case studies > 0), acknowledge them. Critique depth/quality, NOT absence.
` : ''}

TASKS:
${narrativeTooShort ? '- Expand narrative to 350+ chars using scorecard + section findings' : '- Keep narrative, ensure 350+ chars'}
${missingStrengths > 0 ? `- Add ${missingStrengths} strength(s) from section findings` : '- Keep existing strengths'}
${missingIssues > 0 ? `- Add ${missingIssues} key issue(s) from section findings` : '- Keep existing key issues'}
${missingPriorities > 0 ? `- Add ${missingPriorities} strategic priority/priorities` : '- Keep existing priorities'}
${missingOutcomes ? '- Write expectedOutcomes array (3-5 items)' : '- Keep expectedOutcomes'}

Return complete JSON with all fields populated.`;

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
      max_tokens: 1000, // Shorter prompt = shorter response needed
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('No content from OpenAI rewrite');

    const parsed = JSON.parse(content);
    
    // Merge existing good content with new content
    return {
      overallScore: typeof parsed.overallScore === 'number' ? parsed.overallScore : overallScore,
      maturityStage: parsed.maturityStage || maturityStage,
      narrative: parsed.narrative || existingSummary.narrative || '',
      strengths: Array.isArray(parsed.strengths) && parsed.strengths.length >= 3 
        ? parsed.strengths 
        : [
            ...(existingSummary.strengths || []),
            ...(Array.isArray(parsed.strengths) ? parsed.strengths : [])
          ].slice(0, Math.max(3, parsed.strengths?.length || existingSummary.strengths?.length || 0)),
      keyIssues: Array.isArray(parsed.keyIssues) && parsed.keyIssues.length >= 3
        ? parsed.keyIssues
        : [
            ...(existingSummary.keyIssues || []),
            ...(Array.isArray(parsed.keyIssues) ? parsed.keyIssues : [])
          ].slice(0, Math.max(3, parsed.keyIssues?.length || existingSummary.keyIssues?.length || 0)),
      strategicPriorities: Array.isArray(parsed.strategicPriorities) && parsed.strategicPriorities.length >= 3
        ? parsed.strategicPriorities
        : [
            ...(existingSummary.strategicPriorities || []),
            ...(Array.isArray(parsed.strategicPriorities) ? parsed.strategicPriorities : [])
          ].slice(0, Math.max(3, parsed.strategicPriorities?.length || existingSummary.strategicPriorities?.length || 0)),
      expectedOutcomes: normalizeExpectedOutcomes(parsed.expectedOutcomes).length > 0 
        ? normalizeExpectedOutcomes(parsed.expectedOutcomes)
        : (Array.isArray(existingSummary.expectedOutcomes) ? existingSummary.expectedOutcomes : []),
    };
  } catch (error) {
    console.error('❌ Error rewriting executive summary:', error);
    // Return existing summary even if rewrite fails
    return existingSummary;
  }
}

/**
 * Result type for generateExecutiveSummary
 * Includes both backward-compatible ExecutiveSummary and full GAP response
 */
export interface GenerateExecutiveSummaryResult {
  executiveSummary: ExecutiveSummary; // Backward-compatible shape
  fullGap: FullGapPlanResponse; // Complete parsed GAP response
}

/**
 * Helper to normalize expectedOutcomes: convert string to array if needed
 */
function normalizeExpectedOutcomes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return [value];
  }
  return [];
}

/**
 * Helper to parse a SectionAnalysis from raw JSON (handles both new and legacy formats)
 */
function parseSectionAnalysis(raw: any, defaultLabel: string, defaultScore: number = 0): SectionAnalysis | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  // Handle new format with cardLevel and deepDive
  if (raw.cardLevel && raw.deepDive) {
    return {
      label: raw.label || defaultLabel,
      score: typeof raw.score === 'number' ? raw.score : defaultScore,
      grade: raw.grade || (raw.score >= 85 ? 'A' : raw.score >= 70 ? 'B' : raw.score >= 50 ? 'C' : 'D'),
      cardLevel: {
        verdict: raw.cardLevel.verdict || raw.verdict || '',
        summary: raw.cardLevel.summary || raw.summary || '',
      },
      deepDive: {
        strengths: Array.isArray(raw.deepDive.strengths) ? raw.deepDive.strengths : (raw.strengths || []),
        issues: Array.isArray(raw.deepDive.issues) ? raw.deepDive.issues : (raw.issues || []),
        recommendations: Array.isArray(raw.deepDive.recommendations) ? raw.deepDive.recommendations : (raw.recommendations || []),
        impactEstimate: raw.deepDive.impactEstimate || raw.impactEstimate || 'Medium',
      },
      // Legacy fields for backward compatibility
      verdict: raw.cardLevel.verdict || raw.verdict,
      summary: raw.cardLevel.summary || raw.summary,
      strengths: raw.deepDive.strengths || raw.strengths,
      issues: raw.deepDive.issues || raw.issues,
      recommendations: raw.deepDive.recommendations || raw.recommendations,
      impactEstimate: raw.deepDive.impactEstimate || raw.impactEstimate,
    };
  }

  // Handle legacy format - create cardLevel and deepDive from legacy fields
  return {
    label: raw.label || defaultLabel,
    score: typeof raw.score === 'number' ? raw.score : defaultScore,
    grade: raw.grade || (raw.score >= 85 ? 'A' : raw.score >= 70 ? 'B' : raw.score >= 50 ? 'C' : 'D'),
    cardLevel: {
      verdict: raw.verdict || raw.summary?.split('.')[0] + '.' || `${defaultLabel} scores ${raw.score || defaultScore}/100.`,
      summary: raw.summary || '',
    },
    deepDive: {
      strengths: Array.isArray(raw.strengths) ? raw.strengths : [],
      issues: Array.isArray(raw.issues) ? raw.issues : (Array.isArray(raw.keyFindings) ? raw.keyFindings : []),
      recommendations: Array.isArray(raw.recommendations) ? raw.recommendations : [],
      impactEstimate: raw.impactEstimate || 'Medium',
    },
    // Legacy fields
    verdict: raw.verdict,
    summary: raw.summary,
    strengths: raw.strengths,
    issues: raw.issues,
    recommendations: raw.recommendations,
    impactEstimate: raw.impactEstimate,
    keyFindings: raw.keyFindings,
  };
}

/**
 * Helper to parse roadmap initiatives
 */
function parseRoadmapInitiatives(raw: any[]): RoadmapInitiative[] {
  if (!Array.isArray(raw)) return [];
  
  return raw
    .filter((item): item is any => item && typeof item === 'object')
    .map((item) => ({
      title: item.title || 'Untitled Initiative',
      description: item.description || '',
      sectionKey: (['brand', 'content', 'seo', 'website'].includes(item.sectionKey) ? item.sectionKey : 'website') as 'brand' | 'content' | 'seo' | 'website',
      priority: (['P0', 'P1', 'P2'].includes(item.priority) ? item.priority : 'P1') as 'P0' | 'P1' | 'P2',
      complexity: (['S', 'M', 'L'].includes(item.complexity) ? item.complexity : 'M') as 'S' | 'M' | 'L',
      expectedImpact: item.expectedImpact || 'Medium',
      ownerHint: item.ownerHint || 'Team',
    }));
}

/**
 * Generate executive summary with validation and rewrite if needed
 * Now parses full GAP response and returns both ExecutiveSummary (backward-compatible) and fullGap
 */
export async function generateExecutiveSummary(
  context: ExecutiveSummaryContext
): Promise<GenerateExecutiveSummaryResult> {
  console.log('🤖 Generating executive summary with AI...');

  const {
    companyName,
    websiteUrl,
    scorecard,
    sectionAnalyses,
    marketAnalysis,
    positioningAnalysis,
    dataAvailability,
    contentInventory,
    technicalSeoSignals,
    competitorAnalysis,
    topOpportunities = [],
    features,
  } = context;

  // Extract authority signals for prompt
  const authoritySignals = features?.authority;
  const contentSignals = features?.content;

  const overallScore = scorecard.overall;
  const websiteScore = scorecard.website;
  const contentScore = scorecard.content;
  const seoScore = scorecard.seo;
  const brandScore = scorecard.brand;
  const authorityScore = scorecard.authority;

  // Detect maturity level from SiteFeatures
  const detectedMaturity = features ? detectMaturity(features) : 'growing';
  const maturityStage = computeMaturityStage(overallScore, detectedMaturity);

  // Identify dimension strengths and weaknesses
  const dimensionStrengths: string[] = [];
  const dimensionWeaknesses: string[] = [];

  if (websiteScore !== undefined) {
    if (websiteScore >= 70) {
      dimensionStrengths.push(`Website & Conversion (${websiteScore}/100) - Strong conversion optimization`);
    } else if (websiteScore < 50) {
      dimensionWeaknesses.push(`Website & Conversion (${websiteScore}/100) - Needs significant improvement`);
    }
  }

  if (contentScore !== undefined) {
    if (contentScore >= 70) {
      dimensionStrengths.push(`Content Depth & Velocity (${contentScore}/100) - Strong content presence`);
    } else if (contentScore < 50) {
      dimensionWeaknesses.push(`Content Depth & Velocity (${contentScore}/100) - Limited content depth`);
    }
  }

  if (seoScore !== undefined) {
    if (seoScore >= 70) {
      dimensionStrengths.push(`SEO & Visibility (${seoScore}/100) - Strong technical SEO`);
    } else if (seoScore < 50) {
      dimensionWeaknesses.push(`SEO & Visibility (${seoScore}/100) - SEO visibility gaps`);
    }
  }

  if (brandScore !== undefined) {
    if (brandScore >= 70) {
      dimensionStrengths.push(`Brand & Positioning (${brandScore}/100) - Clear positioning`);
    } else if (brandScore < 50) {
      dimensionWeaknesses.push(`Brand & Positioning (${brandScore}/100) - Positioning clarity needed`);
    }
  }

  if (authorityScore !== undefined) {
    if (authorityScore >= 70) {
      dimensionStrengths.push(`Authority & Trust (${authorityScore}/100) - Strong trust signals`);
    } else if (authorityScore < 50) {
      dimensionWeaknesses.push(`Authority & Trust (${authorityScore}/100) - Trust signals need strengthening`);
    }
  }

  const systemPrompt = `You are the strategic intelligence layer powering Hive OS, an AI-driven marketing operating system for analyzing company websites and generating a Growth Acceleration Plan (GAP).

Your job is to transform a single website URL + HTML snapshot into a structured, actionable GAP JSON object.

You MUST respond with one valid JSON object only, with exactly the structure described below.

No explanations.

No markdown.

No narrative outside of JSON.

🎯 HIGH-LEVEL PURPOSE

This is the FULL Growth Acceleration Plan (Full GAP), which builds upon and expands the GAP Initial Assessment (GAP-IA).

The Full GAP provides:

A strategic, high-quality evaluation of a company's marketing system.

A detailed diagnostic of four core areas (Brand, Content, SEO, Website).

Clear actionable recommendations across Now / Next / Later.

A business-ready plan with priorities, accelerators, and outcomes.

The Full GAP is 2–3× MORE DETAILED than the GAP-IA, with deeper narrative analysis, more context, and strategic framing.

It MUST feel:

Insightful

Specific

Practical

Non-generic

Written by a senior strategist

Comprehensive and coaching-oriented

CRITICAL CONSISTENCY RULES:

1. The Full GAP MUST NEVER contradict the GAP-IA.
2. Scores in Full GAP must be >= GAP-IA scores (never lower).
3. If GAP-IA identified an issue, Full GAP must acknowledge it and expand on it.
4. If GAP-IA identified a strength, Full GAP must acknowledge it and provide more detail.
5. Full GAP expands GAP-IA findings with 2–3× more narrative, context, and strategic guidance.
6. Full GAP adds depth: why issues matter, what better looks like, how to get there.

MATURITY OVERRIDE MODE:

When HTML extraction fails OR domain is an iconic brand (Apple, Nike, Tesla, Google, Shopify, Salesforce, etc.):

- Scores receive maturity floor overrides (Brand 90+, Content 85+, SEO 80+, Website 70+)
- Narrative must explain: "This site uses advanced/dynamic frameworks. HTML snippet may not reflect real content. Brand maturity, trust, and authority are extremely strong. Content ecosystem exists outside the homepage. Scoring reflects brand reality, not technical extraction."

Never use filler phrases like:

"This area shows strengths but also opportunities for improvement."

"Foundational elements are in place."

"Based on our analysis."

"Implement key improvements."

"Strategic enhancements could be made."

These are strictly forbidden.

🧠 SECTION ANALYSIS MODEL

You must generate two distinct abstraction layers:

1. cardLevel (for small dashboards)

short, punchy, high-level

1–2 sentence verdict summarizing the state of the section with SPECIFIC observations

1–2 sentence summary describing what's working + what's not with CONCRETE examples

MUST be unique across sections

Examples of GOOD verdicts:
- "Homepage hero lacks a clear value proposition; visitors won't immediately understand what you offer or why it matters."
- "Strong technical SEO foundation with optimized meta tags and clean URL structure, but missing content depth for long-tail keywords."
- "Testimonials and case studies present, but buried 3 clicks deep—social proof should be front and center."

Examples of BAD verdicts (too generic):
- "This area shows strengths but also opportunities for improvement."
- "Overall performance is decent with room to grow."

2. deepDive (for diagnostics)

strengths (2–5 very specific bullets) - MUST reference actual page elements, metrics, or observable patterns

issues (3–5 very specific problem statements) - MUST cite specific pages, missing elements, or measurable gaps

recommendations (3–7 actionable steps) - MUST be concrete tasks, not vague suggestions

impactEstimate (e.g., "High – improving this would meaningfully increase conversions")

deepDive content MUST be:

concrete - reference specific URLs, page elements, CTAs, headlines, nav items

non-repetitive - no overlap between sections

tailored to what's visible in the HTML snapshot

highly specific (e.g., "Homepage CTA says 'Learn More' instead of action-oriented copy", "Blog last updated 8 months ago", "No pricing page linked from main nav")

CRITICAL SPECIFICITY REQUIREMENTS:

Brand & Positioning:
- Mention specific messaging (e.g., headline copy, tagline, value prop)
- Reference actual positioning statements or lack thereof
- Note competitor differentiation or sameness
- Cite authority signals (testimonials count, logo strips, case study depth)
- Observe target audience clarity in copy

Content & Messaging:
- Count blog posts, case studies, resources
- Note publication frequency and recency
- Identify content gaps (e.g., "No product comparison guides", "Missing use case library")
- Assess depth (e.g., "Blog posts average 300 words vs. industry standard 1200+")
- Reference specific CTAs and their clarity

SEO & Visibility:
- Cite meta tags, title tags, descriptions
- Note technical issues (e.g., "Missing alt text on 40% of images", "No sitemap.xml")
- Reference URL structure, heading hierarchy
- Mention keyword usage or absence
- Identify crawlability issues

Website & Conversion:
- Reference specific CTAs (e.g., "Homepage CTA is 'Learn More', not action-oriented")
- Note navigation structure and clarity
- Cite page load issues or performance gaps
- Mention form fields, friction points
- Identify conversion path clarity or confusion

📊 SCORING RULES (STRICT)

Each section produces a score 0–100.

Calibration rules:

0–49 → "Needs Work" (serious problems)

50–69 → "Developing"

70–84 → "Strong but inconsistent"

85–100 → "Best-in-class"

Global brands and highly mature companies should not score below 80 in Brand, Content, or Website unless snapshot proves major issues.

Scores must correlate directly to the problems you identify.

🧩 SECTIONS TO ANALYZE

CRITICAL: You MUST populate all four sectionAnalyses keys with complete data. Do not leave sectionAnalyses empty or partially filled.

Produce sectionAnalyses with exactly these keys:

brand → "Brand & Positioning"

content → "Content & Messaging"

seo → "SEO & Visibility"

website → "Website & Conversion"

Each section MUST have the complete shape:

{

  "label": "Brand & Positioning",

  "score": 0,

  "grade": "A/B/C/D/F or Strong/Developing/Needs Work",

  "cardLevel": {

    "verdict": "1–2 sentence high-level diagnosis",

    "summary": "1–2 sentence card-friendly summary"

  },

  "deepDive": {

    "strengths": ["specific", "non-generic"],

    "issues": ["specific", "non-generic"],

    "recommendations": ["specific", "actionable"],

    "impactEstimate": "High / Medium / Low with rationale"

  }

}

REQUIREMENTS:

- All four keys (brand, content, seo, website) MUST be present in sectionAnalyses.

- Each section MUST include: label, score, grade, cardLevel (with verdict + summary), and deepDive (with strengths, issues, recommendations, impactEstimate).

- Do NOT omit any of these fields. If information is limited, still provide your best professional assessment with at least 2–3 items in each array.

- Avoid ANY repeated content across sections.

🚀 ROADMAP REQUIREMENTS

The roadmap MUST have initiatives distributed across ALL THREE buckets:

now (0–30 days) - Quick wins, small tasks, high-impact / low-complexity items

next (30–90 days) - Medium complexity projects, foundational improvements

later (90–180+ days) - Large complexity projects, strategic initiatives

Each initiative must include:

title

description (2–4 sentences)

sectionKey (brand, content, seo, website)

priority (P0 = critical, P1 = important, P2 = nice-to-have)

complexity (S, M, L)

expectedImpact

ownerHint (Marketing Lead, Web Dev, Founder, etc.)

CRITICAL DISTRIBUTION RULES:

REQUIRED: Generate 8-12 total initiatives distributed as follows:
- now: 3-5 initiatives (small complexity only)
- next: 3-5 initiatives (small or medium complexity)
- later: 2-4 initiatives (medium or large complexity)

Complexity assignment:
- S (Small) = Can be done in 1-2 days, minimal resources (e.g., "Update meta description", "Add CTA to homepage")
- M (Medium) = 1-2 weeks, requires coordination (e.g., "Launch blog with 5 posts", "Redesign navigation")
- L (Large) = 1-3 months, significant effort (e.g., "Build content library with 20+ resources", "Complete website redesign")

Priority assignment:
- P0 = Blocking major conversions or visibility (e.g., broken forms, no clear value prop, missing critical pages)
- P1 = Important improvements with measurable impact (e.g., add testimonials, improve meta tags, publish blog)
- P2 = Nice-to-have optimizations (e.g., minor copy tweaks, additional social profiles)

Mapping rules:
- Every initiative must directly respond to an issue in the matching section's deepDive.issues array
- P0 items must go in now or next
- Small complexity can go anywhere
- Medium complexity must go in next or later
- Large complexity must go in later only

⚡ ACCELERATORS

Produce 3–5 strategic pillars summarizing the big moves that will materially improve growth.

Each should be:

short

punchy

actionable

based on consistent themes found in diagnostics

📈 EXPECTED OUTCOMES

Produce measurable, business-facing outcomes such as:

increased SQL conversion

improved LCP

higher CTR for CTAs

stronger authority signals

better retention or funnel clarity

Outcomes must feel like KPIs a founder or CMO would recognize.

🧱 TOP-LEVEL JSON STRUCTURE

Your final JSON MUST match this shape exactly:

{

  "gapId": "string",

  "companyName": "string",

  "websiteUrl": "string",

  "generatedAt": "ISO timestamp",

  "executiveSummary": {

    "overallScore": 0,

    "maturityStage": "string",

    "narrative": "5–7 paragraph COMPREHENSIVE overview that expands on GAP-IA findings by 2–3×. Structure: (1) What This Score Means - 2–3 sentences explaining business impact in plain English, (2) Key Strengths - what's working well today with specific examples, (3) Key Issues - what needs attention and why it matters for traffic/conversions/trust, (4) Strategic Context - market position and competitive landscape insights, (5) Priority Focus Areas - what to tackle first and why, (6-7) Expected Outcomes - what success looks like in 30/60/90 days. Each paragraph should be 3–5 sentences. Use plain English, avoid jargon, explain WHY everything matters.",

    "strengths": ["..."],

    "keyIssues": ["..."],

    "strategicPriorities": ["..."]

  },

  "scorecardExplanation": {

    "howToRead": "SHORT paragraph explaining the score bands: 0–39 = Needs Work (major gaps), 40–59 = Developing (basics exist but inconsistent), 60–79 = Solid (working but room to grow), 80–100 = Strong (relative strength you can build on). This will be displayed above the scorecard.",

    "dimensionMeanings": {

      "brand": "One-sentence meaning explaining what the Brand & Positioning score means in business terms. Example: 'Your story is unclear and visitors don\\'t quickly understand who you serve.'",

      "content": "One-sentence meaning for Content & Messaging score.",

      "seo": "One-sentence meaning for SEO & Visibility score.",

      "website": "One-sentence meaning for Website & Conversion score."

    }

  },

  "scorecard": {

    "brandScore": 0,

    "contentScore": 0,

    "seoScore": 0,

    "websiteScore": 0,

    "overallScore": 0

  },

  "sectionAnalyses": {

    "brand": { ... },

    "content": { ... },

    "seo": { ... },

    "website": { ... }

  },

  "accelerators": ["short, punchy strategic pillars"],

  "roadmap": {

    "now": [ { ...initiative } ],

    "next": [ { ...initiative } ],

    "later": [ { ...initiative } ]

  },

  "expectedOutcomes": ["..."]

}

This schema is strict.

Never omit keys.

If uncertain, make your best professional inference.

📋 ADDITIONAL REQUIREMENTS: sectionAnalyses

In addition to everything above, you must also include a sectionAnalyses object in the root JSON.

sectionAnalyses MUST have exactly these keys:

- brand → "Brand & Positioning"

- content → "Content & Messaging"

- seo → "SEO & Visibility"

- website → "Website & Conversion"

Each of these keys must point to an object with this shape:

{

  "label": "Brand & Positioning",            // or appropriate label

  "score": number,                           // 0-100, consistent with the scorecard

  "summary": "2–3 SHORT PARAGRAPHS explaining this dimension like a patient senior marketer coaching a founder. Each paragraph should be 2–4 sentences. Structure: (1) What we're seeing now with site-specific observations, (2) Why this matters for business (traffic/conversions/trust/clarity), (3) What 'better' would look like in concrete terms.",

  "strengths": [                             // 2–5 bullets

    "Specific, concrete strength.",

    "Another concrete strength."

  ],

  "issues": [                                // 3–5 bullets

    "Specific, concrete issue.",

    "Avoid generic phrases like 'could benefit from improvements'."

  ],

  "recommendations": [                       // 3–7 actionable steps

    "Actionable, concrete recommendation tied to the issues above.",

    "Each written as a clear, standalone action."

  ],

  "impactEstimate": "High / Medium / Low with 1 short rationale."

}

CRITICAL: The "summary" field is now the NARRATIVE for this dimension. It should be 2–3 SHORT PARAGRAPHS (not a single sentence).

TONE REQUIREMENTS FOR summary NARRATIVE:
- Write for relatively inexperienced marketers / founders / first-time marketing hires
- Use plain English, avoid jargon OR explain it inline
  Examples: "H1 (your main page headline)", "meta description (the preview text in Google search results)"
- Focus on "what this means in real life": higher/lower conversion rates, more/fewer leads, more/less trust
- Be encouraging and constructive, not harsh
- Connect every finding to business outcomes

PARAGRAPH STRUCTURE FOR summary:
- Paragraph 1: What exists today (site-specific observations from HTML)
- Paragraph 2: Why this is a problem or risk in business terms
- Paragraph 3: What "better" would look like in simple, concrete terms

EXAMPLE for Website & Conversion summary:
"Your website has a functional structure with clear navigation and several CTAs throughout the pages. However, visitors see 3-4 different CTAs competing for attention on the homepage (Get Started, Learn More, Contact Us, Free Trial), which creates decision paralysis. When people don't know which action to take, they often take no action at all and leave your site.

This confusion likely costs you conversions. If 100 visitors land on your homepage but half leave because they're unsure what to do next, that's 50 potential customers lost. The friction compounds when your contact form requires 8 fields—many visitors will start filling it out but abandon it halfway through.

A stronger version would have one primary CTA per page with clear, action-oriented copy (like 'Start Your Free Trial' instead of 'Learn More'), visible testimonials near the CTA to build trust, and a streamlined 3-field contact form that captures just the essentials. These changes would make it crystal clear what visitors should do and why they should trust you."

Strict rules:

- Do not leave sectionAnalyses empty.

- Each bullet in strengths, issues, recommendations must be specific to what you see in the HTML snapshot and metadata.

- REFERENCE ACTUAL PAGE ELEMENTS: Don't say "improve CTAs", say "Homepage primary CTA says 'Learn More'—change to 'Start Free Trial' or 'Get Demo'"

- CITE OBSERVABLE DATA: Don't say "content is thin", say "Blog section shows 4 posts total, last published 6 months ago"

- NAME SPECIFIC PAGES/SECTIONS: Don't say "navigation unclear", say "Main nav has 8 items including ambiguous 'Solutions' and 'Resources' without clear hierarchy"

- QUANTIFY WHEN POSSIBLE: "3 customer logos on homepage vs. 20+ on competitor sites", "Testimonials section has 2 quotes without attribution"

- Avoid generic filler phrases such as:

  - "foundational elements are in place"

  - "could benefit from strategic improvements"

  - "shows strengths but also opportunities for improvement"

  - "implement key improvements"

  - "based on our analysis"

  - "optimize for better performance"

  - "enhance user experience"

  - "improve messaging clarity"

EXAMPLES OF GOOD SPECIFICITY:

Brand & Positioning - Strengths:
✓ "Clear tagline 'Enterprise-grade analytics for growing teams' immediately communicates target audience and value"
✓ "Customer logo strip features 15 recognizable brands including Shopify, Stripe, and Notion"
✗ "Strong brand positioning with good social proof"

Brand & Positioning - Issues:
✓ "Homepage hero headline is generic 'Welcome to our platform'—doesn't explain what the product does or who it's for"
✓ "No differentiation from competitors: same 'AI-powered' and 'easy-to-use' claims as 12 other tools in category"
✗ "Positioning could be clearer and more differentiated"

Content & Messaging - Issues:
✓ "Blog last updated 8 months ago; shows 6 total posts averaging 400 words—insufficient for SEO authority"
✓ "No case studies or customer success stories despite testimonials mentioning specific results"
✗ "Content strategy needs improvement"

SEO & Visibility - Issues:
✓ "Homepage meta description is 45 characters (vs. recommended 150-160), missing key terms like 'analytics' and 'dashboard'"
✓ "No H1 tag on homepage; H2s used inconsistently across About and Pricing pages"
✗ "Meta tags could be optimized"

Website & Conversion - Issues:
✓ "Primary CTA 'Learn More' is passive; consider action-oriented 'Start Free Trial' or 'See Demo'"
✓ "Contact form has 12 fields including 'Company Size' and 'Budget'—high friction for early-stage leads"
✗ "CTAs and forms need optimization"

Do not change the existing quickWins / strategicInitiatives / timeline / expectedOutcomes behavior. Simply add this additional sectionAnalyses object to the JSON alongside the existing fields.

🧬 WRITING STYLE RULES

No generic fluff

No repeated sentences across sections

No filler like "our analysis shows…"

Everything must reference visible or logically inferable site behaviors

Tone = Senior CMO + Growth Strategist

Be confident and direct

Use crisp, specific language

🛑 FINAL RULES

Output ONLY JSON

No markdown

No commentary

Never break schema

Never hallucinate technologies not visible in the snapshot

If data is missing, fall back to reasonable defaults but still produce full structure

That's it.

Generate the GAP only according to this schema.`;

  // Extract data for USER prompt
  const featuresAny = features as any;
  const extraction = featuresAny?.extraction || {};

  // Extract specific data points instead of truncated JSON
  const title = extraction?.meta?.title || 'Not available';
  const metaDescription = extraction?.meta?.description || 'Not available';
  const h1 = extraction?.seo_elements?.h1 || 'Not available';
  const h2s = extraction?.seo_elements?.h2 || [];
  const ogTitle = extraction?.meta?.og_title || 'Not available';
  const ogDescription = extraction?.meta?.og_description || 'Not available';

  // HTML Safety Guards: Add fallback messages for missing elements
  // This prevents the AI from making false assumptions about missing content
  const safeH1 = h1 === 'Not available' ? '(H1 not visible in limited HTML snippet - may be JS-rendered)' : h1;
  const safeH2s = h2s.length === 0 ? ['(H2s not visible in limited HTML snippet - may be JS-rendered)'] : h2s;
  const safeMetaDescription = metaDescription === 'Not available' ? '(Meta description not found in HTML snippet)' : metaDescription;

  // Navigation and structure
  const navItems = extraction?.navigation ? JSON.stringify(extraction.navigation, null, 2) : 'Not available';
  const ctaButtons = extraction?.ctas ? JSON.stringify(extraction.ctas, null, 2) : 'Not available';
  const links = extraction?.links ? extraction.links.slice(0, 30) : [];

  // Content signals
  const headlines = extraction?.headlines ? extraction.headlines.slice(0, 10) : [];
  const paragraphs = extraction?.paragraphs ? extraction.paragraphs.slice(0, 5) : [];

  // Authority signals from features
  const authSignals = authoritySignals ? {
    testimonialCount: authoritySignals.testimonialCount || 0,
    customerLogoCount: authoritySignals.customerLogoCount || 0,
    hasCustomerLogoStrip: authoritySignals.hasCustomerLogoStrip || false,
    hasTrustedBySection: authoritySignals.hasTrustedBySection || false,
    hasAwardsOrBadges: authoritySignals.hasAwardsOrBadges || false,
    hasPressLogos: authoritySignals.hasPressLogos || false,
    hasG2OrReviewBadges: authoritySignals.hasG2OrReviewBadges || false,
  } : null;

  // Content inventory
  const hasBlog = contentInventory?.blogPostsFound ? contentInventory.blogPostsFound > 0 : false;
  const contentInventoryAny = contentInventory as any;
  const blogPostCount = contentInventoryAny?.blogPostsFound || 0;
  const blogUrls = contentInventoryAny?.blogUrls ? contentInventoryAny.blogUrls.slice(0, 10) : [];
  const caseStudyCount = contentSignals?.caseStudyCount || 0;

  // Social profiles
  const socialProfiles = extraction?.external_profiles ? JSON.stringify(extraction.external_profiles, null, 2) : 'Not available';
  const hasLinkedInProfile = extraction?.external_profiles?.linkedin_raw ? extraction.external_profiles.linkedin_raw.length > 0 : false;
  const hasInstagramProfile = extraction?.external_profiles?.instagram_raw ? extraction.external_profiles.instagram_raw.length > 0 : false;
  const hasFacebookProfile = extraction?.external_profiles?.facebook_raw ? extraction.external_profiles.facebook_raw.length > 0 : false;
  const hasGoogleBusinessProfile = extraction?.external_profiles?.gbp_raw ? extraction.external_profiles.gbp_raw.length > 0 : false;

  // Competitor analysis
  const competitorAnalysisAny = competitorAnalysis as any;
  const competitorUrls = competitorAnalysisAny?.competitorsIdentified ? JSON.stringify(competitorAnalysisAny.competitorsIdentified) : '[]';

  // Data availability
  const snapshotFlags = dataAvailability ? JSON.stringify({
    coverageLevel: dataAvailability.siteCrawl.coverageLevel,
    overallConfidence: dataAvailability.overallConfidence,
    evaluatedDimensions: scorecard.evaluatedDimensions,
  }) : '{}';

  const industry = marketAnalysis?.category || 'Not specified';
  const evidenceJson = technicalSeoSignals ? JSON.stringify(technicalSeoSignals, null, 2) : '';

  // Create a rich, structured snapshot with actual observable data
  const richSnapshot = JSON.stringify({
    meta: {
      title,
      metaDescription: safeMetaDescription,
      ogTitle,
      ogDescription,
    },
    seoElements: {
      h1: safeH1,
      h2s: safeH2s.slice(0, 10),
      headlines: headlines.length > 0 ? headlines : ['(Headlines not visible in limited HTML snippet)'],
    },
    navigation: extraction?.navigation || {},
    ctas: extraction?.ctas || [],
    links: links.map((l: any) => ({ text: l.text, href: l.href })),
    content: {
      paragraphs: paragraphs.map((p: any) => p?.substring ? p.substring(0, 200) : p),
      headlines: headlines,
    },
    authority: authSignals,
    social: {
      hasLinkedIn: hasLinkedInProfile,
      hasInstagram: hasInstagramProfile,
      hasFacebook: hasFacebookProfile,
      hasGoogleBusiness: hasGoogleBusinessProfile,
    },
    contentInventory: {
      hasBlog,
      blogPostCount,
      blogUrls,
      caseStudyCount,
    },
  }, null, 2);

  const userPrompt = `You are generating a Growth Acceleration Plan (GAP) for a company based on the following input data.

Use this data as the factual basis for all diagnostics, insights, recommendations, and roadmap initiatives.

If certain details are missing, make reasonable inferences but stay grounded in what's visible.

🔗 Company & URL

URL: ${websiteUrl}

Company Name: ${companyName}

Industry: ${industry}

Stage: ${maturityStage}

📊 STRUCTURED WEBSITE DATA SNAPSHOT

This is the COMPLETE extracted data from the website. Use ALL of this data to write specific diagnostics.

${richSnapshot}

CRITICAL: Use this data to:
- Quote actual headlines, CTAs, and copy (from content.headlines, ctas, meta.title, seoElements.h1)
- Reference specific navigation items (from navigation)
- Count and cite authority signals (from authority.testimonialCount, customerLogoCount, etc.)
- Identify content gaps (from contentInventory.blogPostCount, caseStudyCount)
- Note SEO issues (from meta.metaDescription length, seoElements.h2s presence, etc.)
- Reference actual links and page structure (from links)

🗂️ Additional SEO & Technical Signals

${evidenceJson || 'No additional technical evidence provided.'}

Use this for:
- Performance metrics (LCP, CLS, FID)
- Keyword data
- Sitemap structure
- Crawlability issues
- Backlink quality

🧭 Instructions

Using the SYSTEM prompt rules + this input data, generate the strict JSON output for the GAP-Plan Run.

CRITICAL REQUIREMENTS FOR SECTION ANALYSES:

For cardLevel.verdict:
- QUOTE or PARAPHRASE actual page copy (e.g., homepage headline, tagline, CTA text)
- REFERENCE specific page elements visible in the HTML (e.g., "nav has 8 items", "hero section lacks value prop")
- CITE observable patterns (e.g., "3 testimonials without attribution", "no pricing page in main nav")

For deepDive.strengths:
- MUST reference actual content from the snapshot (e.g., "Clear H1: 'Enterprise Analytics Built for Scale'")
- MUST cite specific counts/metrics when available (e.g., "15 customer logos including Shopify and Stripe")
- MUST name specific pages/sections (e.g., "About page clearly defines 3 target personas")

For deepDive.issues:
- MUST identify missing elements by name (e.g., "No case studies despite testimonials mentioning results")
- MUST quote problematic copy (e.g., "Homepage CTA says 'Learn More' instead of action-oriented")
- MUST quantify gaps (e.g., "Blog shows 4 posts, last updated 6 months ago")
- MUST reference specific SEO/technical issues (e.g., "Meta description only 45 chars, missing key terms")

For deepDive.recommendations:
- MUST be actionable tasks, not vague goals (e.g., "Change homepage CTA from 'Learn More' to 'Start Free Trial'")
- MUST reference specific pages/sections to update (e.g., "Add 3-5 detailed case studies to homepage below hero")
- MUST tie directly to issues identified (e.g., "If issue is 'no blog posts', recommend 'Publish 2 posts/month on [topic]'")

USE THE ACTUAL DATA FROM THE STRUCTURED SNAPSHOT:

For Brand & Positioning diagnostics, USE:
- Actual H1: "${h1}"
- Actual title: "${title}"
- Headlines from content.headlines array
- Authority signals: testimonialCount=${authSignals?.testimonialCount || 0}, customerLogos=${authSignals?.customerLogoCount || 0}
- Social presence: LinkedIn=${hasLinkedInProfile}, Instagram=${hasInstagramProfile}, Facebook=${hasFacebookProfile}

For Content & Messaging diagnostics, USE:
- Blog count: ${blogPostCount} posts
- Case studies: ${caseStudyCount}
- Blog URLs: ${blogUrls.length > 0 ? blogUrls.join(', ') : 'None found'}
- Headlines and paragraphs from content array
- Actual CTA text from ctas array

For SEO & Visibility diagnostics, USE:
- Meta description: "${metaDescription}" (length: ${metaDescription.length} chars)
- H1: "${h1}"
- H2s: ${h2s.length} found
- OG tags: title="${ogTitle}", description="${ogDescription}"

For Website & Conversion diagnostics, USE:
- Navigation items from navigation object
- CTA buttons from ctas array
- Links count and structure from links array (${links.length} total links)

NEVER WRITE GENERIC STATEMENTS - quote, count, or reference something specific from the data above.

🚨 ROADMAP REQUIREMENTS (CRITICAL):

You MUST generate a roadmap with initiatives in ALL THREE buckets:

roadmap.now: 3-5 initiatives (complexity: S only)
Example initiatives for "now":
- "Update meta description to 150-160 chars with key terms" (seo, P1, S)
- "Add clear value prop headline to homepage hero" (brand, P0, S)
- "Change homepage CTA from 'Learn More' to 'Start Free Trial'" (website, P1, S)

roadmap.next: 3-5 initiatives (complexity: S or M)
Example initiatives for "next":
- "Launch blog with 5 foundational posts" (content, P1, M)
- "Add testimonials section with 5+ customer quotes" (brand, P1, M)
- "Redesign navigation with clear hierarchy" (website, P1, M)

roadmap.later: 2-4 initiatives (complexity: M or L)
Example initiatives for "later":
- "Build comprehensive content library with 20+ resources" (content, P1, L)
- "Implement full SEO strategy with keyword research and optimization" (seo, P1, L)

Every initiative must tie to a specific issue from deepDive.issues.

Ensure:

All insights are specific and grounded in the provided data

No generic filler language

No repeated phrasing across sections

Roadmap MUST have 8-12 total initiatives distributed across now (3-5), next (3-5), later (2-4)

All roadmap initiatives tie back to deepDive issues with specific actions

All content fits the schema from the SYSTEM prompt

NEVER GENERATE GENERIC DIAGNOSTICS - every bullet must reference something observable in the data above

Output ONLY the JSON.`;

  try {
    const openai = getOpenAI();
    
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];
    
    // DEBUG: Log messages array in non-production environments
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n═══════════════════════════════════════════════════════════');
      console.log('🔍 DEBUG GAP MESSAGES');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`Total messages: ${messages.length}`);
      console.log('\n--- SYSTEM MESSAGE ---');
      console.log(`Length: ${systemPrompt.length} characters`);
      console.log(`Preview (first 500 chars):\n${systemPrompt.substring(0, 500)}...`);
      console.log('\n--- USER MESSAGE ---');
      console.log(`Length: ${userPrompt.length} characters`);
      console.log(`Preview (first 500 chars):\n${userPrompt.substring(0, 500)}...`);
      console.log('\n--- FULL MESSAGES ARRAY (JSON) ---');
      console.log(JSON.stringify(messages, null, 2));
      console.log('═══════════════════════════════════════════════════════════\n');
    }
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      max_tokens: 2500, // Increased for more detailed section analyses
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('No content from OpenAI');

    // DEBUG: Log raw model response in non-production environments
    if (process.env.NODE_ENV !== 'production') {
      try {
        const rawParsed = JSON.parse(content);
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('📦 RAW MODEL RESPONSE (GAP-Plan)');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('\n--- TOP-LEVEL KEYS ---');
        console.log('Keys:', Object.keys(rawParsed).join(', '));
        console.log('\n--- SECTION ANALYSES (RAW) ---');
        if (rawParsed.sectionAnalyses) {
          console.log('sectionAnalyses keys:', Object.keys(rawParsed.sectionAnalyses).join(', '));
          console.log('\nFull sectionAnalyses JSON:');
          console.log(JSON.stringify(rawParsed.sectionAnalyses, null, 2));
          
          // Validate structure
          const requiredKeys = ['brand', 'content', 'seo', 'website'];
          const missingKeys = requiredKeys.filter(k => !rawParsed.sectionAnalyses[k]);
          if (missingKeys.length > 0) {
            console.warn(`\n⚠️  MISSING sectionAnalyses keys: ${missingKeys.join(', ')}`);
          }
          
          // Check each section structure
          requiredKeys.forEach(key => {
            const section = rawParsed.sectionAnalyses[key];
            if (section) {
              const hasLabel = 'label' in section;
              const hasScore = 'score' in section;
              const hasGrade = 'grade' in section;
              const hasCardLevel = 'cardLevel' in section;
              const hasDeepDive = 'deepDive' in section;
              const cardLevelComplete = hasCardLevel && section.cardLevel && 'verdict' in section.cardLevel && 'summary' in section.cardLevel;
              const deepDiveComplete = hasDeepDive && section.deepDive && 'strengths' in section.deepDive && 'issues' in section.deepDive && 'recommendations' in section.deepDive && 'impactEstimate' in section.deepDive;
              
              console.log(`\n${key}:`);
              console.log(`  ✓ label: ${hasLabel}`);
              console.log(`  ✓ score: ${hasScore}`);
              console.log(`  ✓ grade: ${hasGrade}`);
              console.log(`  ✓ cardLevel: ${hasCardLevel} (complete: ${cardLevelComplete})`);
              console.log(`  ✓ deepDive: ${hasDeepDive} (complete: ${deepDiveComplete})`);
              
              if (!hasLabel || !hasScore || !hasGrade || !cardLevelComplete || !deepDiveComplete) {
                console.warn(`  ⚠️  ${key} section is incomplete!`);
              }
            } else {
              console.warn(`  ⚠️  ${key} section is missing!`);
            }
          });
        } else {
          console.warn('⚠️  sectionAnalyses is missing from response!');
        }
        console.log('\n═══════════════════════════════════════════════════════════\n');
      } catch (e) {
        console.error('Error parsing raw response for debug:', e);
      }
    }

    const parsed = JSON.parse(content);

    // DEBUG: Log sectionAnalyses and roadmap in non-production environments
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n🔍 ===== GAP GENERATION DEBUG =====');
      console.log('📊 SECTION ANALYSES:', JSON.stringify(parsed.sectionAnalyses, null, 2));
      console.log('\n🗺️ ROADMAP:');
      console.log('  NOW:', parsed.roadmap?.now?.length || 0, 'initiatives');
      console.log('  NEXT:', parsed.roadmap?.next?.length || 0, 'initiatives');
      console.log('  LATER:', parsed.roadmap?.later?.length || 0, 'initiatives');
      if (parsed.roadmap) {
        console.log('\n  Roadmap details:', JSON.stringify(parsed.roadmap, null, 2));
      }
      console.log('===== END DEBUG =====\n');
    }
    
    // Parse full GAP response with graceful fallbacks
    const parsedExecSummary = parsed.executiveSummary || {};
    const parsedScorecard = parsed.scorecard || {};
    const parsedSectionAnalyses = parsed.sectionAnalyses || {};
    const parsedRoadmap = parsed.roadmap || {};
    const parsedAccelerators = Array.isArray(parsed.accelerators) ? parsed.accelerators : [];
    
    // Normalize expectedOutcomes (can be string or array, at top-level or in executiveSummary)
    const topLevelOutcomes = normalizeExpectedOutcomes(parsed.expectedOutcomes);
    const execSummaryOutcomes = normalizeExpectedOutcomes(parsedExecSummary.expectedOutcomes);
    const finalExpectedOutcomes = topLevelOutcomes.length > 0 ? topLevelOutcomes : execSummaryOutcomes;
    
    // Build full GAP response
    const fullGap: FullGapPlanResponse = {
      gapId: parsed.gapId || `GAP-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      companyName: parsed.companyName || companyName,
      websiteUrl: parsed.websiteUrl || websiteUrl,
      generatedAt: parsed.generatedAt || new Date().toISOString(),
      
      executiveSummary: {
        overallScore: typeof parsedExecSummary.overallScore === 'number' ? parsedExecSummary.overallScore : overallScore,
        maturityStage: parsedExecSummary.maturityStage || maturityStage,
        narrative: typeof parsedExecSummary.narrative === 'string' ? parsedExecSummary.narrative : '',
        strengths: Array.isArray(parsedExecSummary.strengths) ? parsedExecSummary.strengths : [],
        keyIssues: Array.isArray(parsedExecSummary.keyIssues) ? parsedExecSummary.keyIssues : [],
        strategicPriorities: Array.isArray(parsedExecSummary.strategicPriorities) ? parsedExecSummary.strategicPriorities : [],
        expectedOutcomes: execSummaryOutcomes.length > 0 ? execSummaryOutcomes : undefined,
      },
      
      scorecard: {
        brandScore: typeof parsedScorecard.brandScore === 'number' ? parsedScorecard.brandScore : brandScore,
        contentScore: typeof parsedScorecard.contentScore === 'number' ? parsedScorecard.contentScore : contentScore,
        seoScore: typeof parsedScorecard.seoScore === 'number' ? parsedScorecard.seoScore : seoScore,
        websiteScore: typeof parsedScorecard.websiteScore === 'number' ? parsedScorecard.websiteScore : websiteScore,
        overallScore: typeof parsedScorecard.overallScore === 'number' ? parsedScorecard.overallScore : overallScore,
      },
      
      sectionAnalyses: {
        brand: parseSectionAnalysis(parsedSectionAnalyses.brand, 'Brand & Positioning', parsedScorecard.brandScore),
        content: parseSectionAnalysis(parsedSectionAnalyses.content, 'Content & Messaging', parsedScorecard.contentScore),
        seo: parseSectionAnalysis(parsedSectionAnalyses.seo, 'SEO & Visibility', parsedScorecard.seoScore),
        website: parseSectionAnalysis(parsedSectionAnalyses.website, 'Website & Conversion', parsedScorecard.websiteScore),
      },
      
      accelerators: parsedAccelerators,
      
      roadmap: {
        now: parseRoadmapInitiatives(parsedRoadmap.now || []),
        next: parseRoadmapInitiatives(parsedRoadmap.next || []),
        later: parseRoadmapInitiatives(parsedRoadmap.later || []),
      },
      
      expectedOutcomes: finalExpectedOutcomes,
    };
    
    // Extract backward-compatible ExecutiveSummary
    const rawSummary: ExecutiveSummary = {
      overallScore: fullGap.executiveSummary.overallScore,
      maturityStage: fullGap.executiveSummary.maturityStage,
      narrative: fullGap.executiveSummary.narrative,
      strengths: fullGap.executiveSummary.strengths,
      keyIssues: fullGap.executiveSummary.keyIssues,
      strategicPriorities: fullGap.executiveSummary.strategicPriorities,
      expectedOutcomes: finalExpectedOutcomes, // Now array
    };

    // Validate the summary
    const validation = validateExecutiveSummary(rawSummary);
    
    if (!validation.isValid) {
      console.warn('⚠️  Executive summary failed validation:', validation.issues);
      console.log('🔄 Attempting rewrite to enforce completeness...');
      
      // Attempt rewrite (this still returns old format, we'll need to update it)
      const rewrittenSummary = await rewriteExecutiveSummary(rawSummary, context);
      const rewriteValidation = validateExecutiveSummary(rewrittenSummary);
      
      if (!rewriteValidation.isValid) {
        console.error('❌ Executive summary still incomplete after rewrite:', rewriteValidation.issues);
      // Update fullGap with rewritten summary
      fullGap.executiveSummary = {
        ...fullGap.executiveSummary,
        overallScore: rewrittenSummary.overallScore ?? overallScore ?? 0,
        maturityStage: rewrittenSummary.maturityStage,
        narrative: rewrittenSummary.narrative,
        strengths: rewrittenSummary.strengths,
        keyIssues: rewrittenSummary.keyIssues,
        strategicPriorities: rewrittenSummary.strategicPriorities,
        expectedOutcomes: rewrittenSummary.expectedOutcomes,
      };
      rawSummary.expectedOutcomes = rewrittenSummary.expectedOutcomes;
    }
    
    console.log('✅ Executive summary validated after rewrite');
    
    // Check for confidence caveat if needed
    const finalSummary = await checkConfidenceCaveat(rawSummary, dataAvailability);
    
    // Update fullGap with final summary
    fullGap.executiveSummary = {
      ...fullGap.executiveSummary,
      overallScore: finalSummary.overallScore ?? overallScore ?? 0,
      maturityStage: finalSummary.maturityStage,
      narrative: finalSummary.narrative,
      strengths: finalSummary.strengths,
      keyIssues: finalSummary.keyIssues,
      strategicPriorities: finalSummary.strategicPriorities,
      expectedOutcomes: finalSummary.expectedOutcomes,
    };
    
    return {
      executiveSummary: finalSummary,
      fullGap,
    };
  }

  console.log('✅ Executive summary validated');
  
  // Check for confidence caveat if needed
  const finalSummary = await checkConfidenceCaveat(rawSummary, dataAvailability);
  
  // Update fullGap with final summary
  fullGap.executiveSummary = {
    ...fullGap.executiveSummary,
    overallScore: finalSummary.overallScore ?? overallScore ?? 0,
    maturityStage: finalSummary.maturityStage,
    narrative: finalSummary.narrative,
    strengths: finalSummary.strengths,
    keyIssues: finalSummary.keyIssues,
    strategicPriorities: finalSummary.strategicPriorities,
    expectedOutcomes: finalSummary.expectedOutcomes,
  };
    
    return {
      executiveSummary: finalSummary,
      fullGap,
    };
  } catch (error) {
    console.error('❌ Error generating executive summary:', error);
    throw error;
  }
}

/**
 * ============================================================================
 * CURRENT FLOW SUMMARY - generateExecutiveSummary
 * ============================================================================
 * 
 * WHAT WE SEND:
 * 
 * SYSTEM PROMPT (lines 445-769):
 *   - Asks LLM to generate a COMPLETE GAP-Plan JSON structure including:
 *     * executiveSummary (with overallScore, maturityStage, narrative, strengths, keyIssues, strategicPriorities)
 *     * scorecard (with brandScore, contentScore, seoScore, websiteScore, overallScore)
 *     * sectionAnalyses (with brand, content, seo, website - each with cardLevel and deepDive)
 *     * accelerators (array of strategic pillars)
 *     * roadmap (with now, next, later buckets)
 *     * expectedOutcomes (array)
 *   - Instructs LLM to output ONLY JSON, no markdown or explanations
 *   - Provides strict schema and scoring rules
 * 
 * USER PROMPT (lines 796-872):
 *   - Provides input data:
 *     * Company & URL (websiteUrl, companyName, industry, stage)
 *     * Partial HTML Snapshot (truncated extraction data)
 *     * Extracted Metadata & Flags (title, metaDescription, h1, navItems, socialProfiles, blog info, competitor URLs, snapshot flags)
 *     * Optional Additional Evidence (technicalSeoSignals as JSON)
 *   - Instructs LLM to use this data as factual basis for all diagnostics
 *   - Reminds LLM to follow SYSTEM prompt schema
 * 
 * WHAT WE EXPECT BACK:
 * 
 * The LLM generates a JSON object matching the full GAP-Plan structure described in the SYSTEM prompt.
 * However, the LLM may generate MORE than what we parse (see below).
 * 
 * WHAT WE PARSE AND RETURN (lines 890-900):
 * 
 * We ONLY extract the ExecutiveSummary subset from the LLM response:
 *   - overallScore (number, optional)
 *   - maturityStage (string)
 *   - narrative (string, 350+ chars)
 *   - strengths (string[], min 3 items)
 *   - keyIssues (string[], min 3 items)
 *   - strategicPriorities (string[], min 3 items)
 *   - expectedOutcomes (string, single paragraph)
 * 
 * IMPORTANT MISMATCH:
 *   - The SYSTEM prompt asks for: sectionAnalyses, roadmap, accelerators, expectedOutcomes array
 *   - We ONLY parse: executiveSummary fields (narrative, strengths, keyIssues, strategicPriorities, expectedOutcomes string)
 *   - Any other fields (sectionAnalyses, roadmap, accelerators, etc.) are IGNORED
 *   - This means the LLM generates a full GAP structure but we only use the executiveSummary portion
 * 
 * VALIDATION & REWRITE (lines 902-930):
 *   - Validates narrative length (350+ chars), array lengths (3+ items each)
 *   - If validation fails, calls rewriteExecutiveSummary() to fix incomplete fields
 *   - Adds confidence caveat if dataAvailability indicates low confidence
 * 
 * WHERE IT'S CALLED:
 * 
 * 1. lib/growth-plan/generateGrowthActionPlan.ts (line 2051):
 *    - Called during GAP plan generation pipeline
 *    - Uses legacy sectionAnalyses format (websiteAndConversion, seoAndVisibility, etc.)
 *    - Result is assigned to plan.executiveSummary
 * 
 * 2. lib/gap/engine.ts (line 832):
 *    - Called in step-based GAP generation state machine
 *    - Uses legacy sectionAnalyses format
 *    - Result stored in state.executiveSummary
 * 
 * 3. lib/gap/legacyEngine/engine.ts (line 832):
 *    - Legacy engine implementation
 *    - Same usage pattern as lib/gap/engine.ts
 * 
 * WHAT PARTS OF THE APP RELY ON THE RETURN SHAPE:
 * 
 * - GrowthAccelerationPlan.executiveSummary field (in lib/growth-plan/types.ts)
 * - GAP plan rendering components that display executive summary section
 * - Validation logic expects specific field types and minimum lengths
 * - The executiveSummary is displayed on the GAP plan page UI
 * 
 * NOTE: The current implementation has a structural mismatch:
 *   - SYSTEM/USER prompts ask for full GAP structure
 *   - Parsing only extracts ExecutiveSummary subset
 *   - This may cause confusion or wasted tokens as LLM generates unused fields
 */

