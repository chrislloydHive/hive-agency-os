/**
 * Market Insight Generator
 *
 * Provides a lightweight market/category snapshot based on publicly
 * observable website content from competitors and/or the main site.
 */

import OpenAI from 'openai';
import { env } from '@/lib/env';
import type { SiteElementContext } from './html-context';
import type { MarketAnalysis, DataAvailability } from './types';
import { formatSiteContextForPrompt } from './html-context';

const SERVICE_PAGE_KEYWORDS = /service|solution|offering|product|capability|practice|industry|vertical/i;

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

function summarizeCompetitorContext(context: SiteElementContext, index: number): string {
  const page = context.pages[0];
  const headlineSummary = page?.headings?.slice(0, 5).map((text, i) => `${i + 1}. ${text}`).join('; ') || 'No headlines captured';
  const navSummary = page?.navItems?.slice(0, 5).join(', ') || 'No nav labels captured';
  const ctaSummary = page?.ctaLabels?.slice(0, 5).join(', ') || 'No CTAs captured';
  const servicePages = context.pages
    .filter(p => SERVICE_PAGE_KEYWORDS.test(p.pageUrl.toLowerCase() || '') || SERVICE_PAGE_KEYWORDS.test((p.title || '').toLowerCase()))
    .slice(0, 3)
    .map(p => p.title || p.pageUrl)
    .filter(Boolean);

  const fallbackServicePages = servicePages.length > 0
    ? servicePages
    : context.pages.slice(1, 4).map(p => p.title || p.pageUrl).filter(Boolean);

  const servicePageSummary = fallbackServicePages.length > 0
    ? fallbackServicePages.join(', ')
    : 'No distinct service page titles captured';

  return [
    `Competitor ${index + 1}: ${page?.pageUrl || 'Unknown URL'}${page?.title ? ` (${page.title})` : ''}`,
    `  Headlines: ${headlineSummary}`,
    `  Navigation: ${navSummary}`,
    `  CTAs: ${ctaSummary}`,
    `  Service pages: ${servicePageSummary}`,
  ].join('\n');
}

function buildCompetitorSummary(contexts: SiteElementContext[]): string {
  if (contexts.length === 0) {
    return 'No competitor contexts provided.';
  }

  const maxCompetitors = 3;
  return contexts
    .slice(0, maxCompetitors)
    .map((context, index) => summarizeCompetitorContext(context, index))
    .join('\n\n');
}

/**
 * Analyze the broader market/category using competitor contexts and/or site context
 */
export async function analyzeMarket(
  companyName: string,
  competitorContexts: SiteElementContext[] = [],
  siteContext?: SiteElementContext,
  dataAvailability?: DataAvailability
): Promise<MarketAnalysis> {
  console.log('🔬 Generating market insights...');

  const competitorSummary = buildCompetitorSummary(competitorContexts);
  const competitorCount = competitorContexts.length;
  
  const systemPrompt = `You are an expert in market and category analysis. Based on publicly observable website content, determine: category, ICP, common claims, competitor messaging (if available), pricing signals, market expectations, and white-space opportunities.

You MUST return a JSON object that strictly matches the following structure:
{
  "category": string,
  "commonPainPoints": string[],
  "commonClaims": string[],
  "pricingPatterns": string[],
  "ICPProfiles": string[],
  "categoryTrends": string[],
  "differentiationWhitespace": string[]
}

Respond ONLY with valid JSON and no additional text.

Even if no competitors are provided, you MUST infer the likely category and competitive landscape based on:
- Page headings and messaging patterns
- Service/offering descriptions
- Target audience signals
- Content themes
- Navigation structure

Be specific and evidence-based.

FALLBACK BEHAVIOR:
If dataAvailability.competitors.competitorCount === 0:
- You may infer category and common claims from the site's own language, but you MUST label these as 'inferred' rather than definitive.
- Do not list specific competitor names or pricing patterns.
- Use language like 'Based on the site's messaging, the category appears to be...' rather than making definitive market statements.`;

  const siteContextText = siteContext ? formatSiteContextForPrompt(siteContext) : '';
  
  const dataAvailabilitySummary = dataAvailability ? {
    competitorCount: dataAvailability.competitors.competitorCount,
    providedByUser: dataAvailability.competitors.providedByUser,
  } : null;

  const userPrompt = `Company: ${companyName}

${dataAvailabilitySummary ? `Data Availability:
- Competitors: ${dataAvailabilitySummary.competitorCount} ${dataAvailabilitySummary.providedByUser ? 'provided by user' : 'not provided'}
` : ''}

${competitorCount > 0 ? `Competitor context summary (${competitorCount} competitor${competitorCount === 1 ? '' : 's'}):
${competitorSummary}

` : ''}${siteContext ? `Main Site Context:
${siteContextText}

` : ''}${competitorCount === 0 && siteContext ? 'INFER category and competitive landscape from the main site context above. Look for patterns in headings, services, messaging, and content themes. Label inferences as such.' : competitorCount > 0 ? 'Focus on the headlines, navigation, CTAs, and service page signals captured above.' : 'No site or competitor data available.'}`;

  // If no competitors but we have site context, still analyze
  if (competitorContexts.length === 0 && !siteContext) {
    return {
      category: 'Not evaluated (no competitor data available).',
      commonPainPoints: [],
      commonClaims: [],
      pricingPatterns: [],
      ICPProfiles: [],
      categoryTrends: [],
      differentiationWhitespace: [],
    };
  }

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
    if (!content) {
      throw new Error('No content from OpenAI');
    }

    // Try to parse JSON, handling incomplete responses
    let parsed: MarketAnalysis;
    try {
      parsed = JSON.parse(content) as MarketAnalysis;
    } catch (parseError) {
      // If JSON is incomplete, try to extract what we can
      console.warn('⚠️  Market analysis JSON parsing failed, attempting recovery...');
      console.warn('Raw content length:', content.length);
      console.warn('Raw content preview:', content.substring(0, 500));
      
      // Try to find the last complete JSON object/array
      let recoveredContent = content.trim();
      
      // If content ends abruptly, try to close JSON structures
      if (!recoveredContent.endsWith('}') && !recoveredContent.endsWith(']')) {
        // Count open braces/brackets
        const openBraces = (recoveredContent.match(/{/g) || []).length;
        const closeBraces = (recoveredContent.match(/}/g) || []).length;
        const openBrackets = (recoveredContent.match(/\[/g) || []).length;
        const closeBrackets = (recoveredContent.match(/\]/g) || []).length;
        
        // Try to close arrays first, then objects
        for (let i = closeBrackets; i < openBrackets; i++) {
          recoveredContent += ']';
        }
        for (let i = closeBraces; i < openBraces; i++) {
          recoveredContent += '}';
        }
      }
      
      try {
        parsed = JSON.parse(recoveredContent) as MarketAnalysis;
        console.log('✅ Recovered partial JSON successfully');
      } catch (recoveryError) {
        // If recovery fails, return fallback
        console.error('❌ JSON recovery failed, using fallback');
        throw parseError; // Throw original error to trigger fallback
      }
    }

    // Sanitize category to ensure no error language
    let category = typeof parsed.category === 'string'
      ? parsed.category
      : 'Not evaluated (no market data available).';
    
    // Sanitize any error language that might have slipped through
    if (category.toLowerCase().includes('error') || category.toLowerCase().includes('unavailable due to')) {
      category = 'Not evaluated (no market data available).';
    }
    
    return {
      category,
      commonPainPoints: Array.isArray(parsed.commonPainPoints)
        ? parsed.commonPainPoints
        : [],
      commonClaims: Array.isArray(parsed.commonClaims)
        ? parsed.commonClaims
        : [],
      pricingPatterns: Array.isArray(parsed.pricingPatterns)
        ? parsed.pricingPatterns
        : [],
      ICPProfiles: Array.isArray(parsed.ICPProfiles)
        ? parsed.ICPProfiles
        : [],
      categoryTrends: Array.isArray(parsed.categoryTrends)
        ? parsed.categoryTrends
        : [],
      differentiationWhitespace: Array.isArray(parsed.differentiationWhitespace)
        ? parsed.differentiationWhitespace
        : [],
    };
  } catch (error) {
    console.error('❌ Error generating market analysis:', error);
    return {
      category: 'Not evaluated (competitor data was not available for this snapshot).',
      commonPainPoints: [],
      commonClaims: [],
      pricingPatterns: [],
      ICPProfiles: [],
      categoryTrends: [],
      differentiationWhitespace: [],
    };
  }
}

