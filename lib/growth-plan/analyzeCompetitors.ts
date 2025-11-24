/**
 * Competitor Analysis Helper
 * 
 * Analyzes competitors to identify positioning patterns, differentiation opportunities,
 * content gaps, and competitive insights for the Growth Acceleration Plan (GAP).
 */

import OpenAI from 'openai';
import { env } from '@/lib/env';
import type { SiteElementContext } from './html-context';
import type { CompetitorAnalysis, DataAvailability } from './types';
import { formatSiteContextForPrompt, formatCompetitorContextsForPrompt } from './html-context';

// Lazy initialization to avoid build-time errors
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
    }
    _openai = new OpenAI({ 
      apiKey,
      timeout: 15000, // 15 seconds per request
    });
  }
  return _openai;
}

/**
 * Analyze competitors to identify positioning patterns and opportunities
 */
export async function analyzeCompetitors(
  companyName: string,
  websiteUrl: string,
  mainContext: SiteElementContext,
  competitorContexts: SiteElementContext[],
  dataAvailability?: DataAvailability
): Promise<CompetitorAnalysis> {
  console.log('🔍 Analyzing competitors...');

  if (competitorContexts.length === 0) {
    return {
      competitorsReviewed: [],
      categorySummary: 'No competitors provided for analysis.',
      positioningPatterns: [],
      differentiationOpportunities: [],
      contentFootprintSummary: [],
      seoVisibilitySummary: [],
      messagingComparison: [],
      recommendations: [],
    };
  }

  const mainContextText = formatSiteContextForPrompt(mainContext);
  const competitorContextText = formatCompetitorContextsForPrompt(competitorContexts);

  // Extract competitor URLs
  const competitorUrls = competitorContexts
    .map(ctx => ctx.pages[0]?.pageUrl)
    .filter(Boolean) as string[];

  const systemPrompt = `You are a senior competitive intelligence analyst evaluating a company's positioning relative to its competitors.

You will receive:
- companyName and websiteUrl for the main company
- structured site context (headings, nav, CTAs, sections) for the main company
- structured site contexts for competitors

Your job:
- Identify common messaging themes across competitors
- Analyze category patterns and positioning strategies
- Compare competitor CTAs and navigation structures
- Identify relative positioning strengths and weaknesses
- Analyze content footprint gaps (who publishes what, how frequently)
- Identify opportunities for differentiation

Return a JSON object with this structure:
{
  "competitorsReviewed": string[],
  "categorySummary": string,
  "positioningPatterns": string[],
  "differentiationOpportunities": string[],
  "contentFootprintSummary": string[],
  "seoVisibilitySummary": string[],
  "messagingComparison": string[],
  "recommendations": string[]
}

Guidelines:
- categorySummary: 2-3 sentences describing the overall category/market positioning
- positioningPatterns: 3-5 patterns you observe across competitors (e.g. "Most competitors emphasize 'enterprise-grade' messaging", "CTAs tend to focus on 'Get Started' rather than 'Learn More'")
- differentiationOpportunities: 3-5 specific opportunities where the main company can differentiate (reference specific elements)
- contentFootprintSummary: 2-4 observations about content strategy differences (blog topics, frequency, depth)
- seoVisibilitySummary: 2-4 observations about SEO/visibility differences (headings, keywords, structure)
- messagingComparison: 3-5 specific comparisons between main company and competitors (headlines, value props, CTAs)
- recommendations: 3-5 actionable recommendations based on competitive analysis

Be specific and reference actual elements from the sites. Avoid generic advice.

FALLBACK BEHAVIOR:
If dataAvailability.competitors.competitorCount === 0:
- You may infer category and common claims from the site's own language, but you MUST label these as 'inferred' rather than definitive.
- Do not list specific competitor names or pricing patterns.
- Use language like 'Based on the site's messaging, the category appears to be...' rather than making definitive competitive statements.`;

  const dataAvailabilitySummary = dataAvailability ? {
    competitorCount: dataAvailability.competitors.competitorCount,
    providedByUser: dataAvailability.competitors.providedByUser,
  } : null;

  const userPrompt = `Analyze competitors for this company:

${dataAvailabilitySummary ? `Data Availability:
- Competitors: ${dataAvailabilitySummary.competitorCount} ${dataAvailabilitySummary.providedByUser ? 'provided by user' : 'not provided'}
` : ''}

Company: ${companyName}
Website: ${websiteUrl}

Main Company Site Structure & Elements:
${mainContextText}

${competitorContextText}

Provide a detailed competitive analysis comparing ${companyName} against ${competitorUrls.length} competitor(s).`;

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
      max_tokens: 1200, // Reduced for faster response
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('No content from OpenAI');

    const parsed = JSON.parse(content) as CompetitorAnalysis;
    
    // Validate and ensure all required fields
    return {
      competitorsReviewed: Array.isArray(parsed.competitorsReviewed) ? parsed.competitorsReviewed : competitorUrls,
      categorySummary: parsed.categorySummary || 'Category analysis unavailable.',
      positioningPatterns: Array.isArray(parsed.positioningPatterns) ? parsed.positioningPatterns : [],
      differentiationOpportunities: Array.isArray(parsed.differentiationOpportunities) ? parsed.differentiationOpportunities : [],
      contentFootprintSummary: Array.isArray(parsed.contentFootprintSummary) ? parsed.contentFootprintSummary : [],
      seoVisibilitySummary: Array.isArray(parsed.seoVisibilitySummary) ? parsed.seoVisibilitySummary : [],
      messagingComparison: Array.isArray(parsed.messagingComparison) ? parsed.messagingComparison : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
    };
  } catch (error) {
    console.error('❌ Error analyzing competitors:', error);
    // Return fallback analysis
    return {
      competitorsReviewed: competitorUrls,
      categorySummary: 'Competitor analysis failed. Unable to generate insights.',
      positioningPatterns: [],
      differentiationOpportunities: [],
      contentFootprintSummary: [],
      seoVisibilitySummary: [],
      messagingComparison: [],
      recommendations: [],
    };
  }
}

