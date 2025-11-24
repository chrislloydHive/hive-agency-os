/**
 * Positioning Analysis
 * 
 * Analyzes how a company positions itself in the market, with special focus on
 * audience, geography, and differentiation signals.
 */

import OpenAI from 'openai';
import { env } from '@/lib/env';
import type { SiteElementContext } from './html-context';
import type { PositioningAnalysis, DataAvailability } from './types';
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
 * Analyze company positioning from site context
 */
export async function analyzePositioning(
  companyName: string,
  siteContext: SiteElementContext,
  competitorContexts: SiteElementContext[] = [],
  dataAvailability?: DataAvailability
): Promise<PositioningAnalysis> {
  const systemPrompt = `You are a senior positioning strategist. Your job is to determine how this company is positioning itself in the market.

You MUST return a JSON object that strictly matches the following structure:
{
  "primaryAudience": string,
  "geographicFocus": string,
  "localSearchLanguage": string[] (optional),
  "corePositioningStatement": string,
  "keyThemes": string[],
  "differentiationSignals": string[],
  "evidenceFromSite": string[]
}

Respond ONLY with valid JSON and no additional text.

You must answer:
- WHO they are for (primary audience / ICP)
- WHERE they are focused (local, regional, national, global, specific cities, 'in your neighborhood', etc.)
- WHAT core promise or outcome they emphasize
- HOW they try to differentiate vs typical players in this category

You will receive structured summaries of multiple pages including:
- homepage
- about/team
- blog and case study titles
- services
- raw text samples from pages

CRITICAL: You MUST detect hyper-local positioning signals such as:
- "near you", "in your neighborhood", "local", "by neighborhood"
- "search by location", "find trainers near you"
- City-specific or neighborhood-specific language
- Geographic targeting in CTAs or messaging
- Location-based service descriptions

Your tasks:
1) Identify recurring themes (phrases, ideas) across headings, hero text, section titles, AND raw text samples.
2) Determine whether the brand is:
   - hyper-local / neighborhood-focused (MUST detect if present)
   - city/regional
   - national
   - remote/online-first
3) Write a CorePositioningStatement in your own words.
4) List keyThemes and differentiationSignals.
5) For each conclusion, list specific phrases or page contexts as evidence.

If competitorContexts are provided, briefly note how this brand's positioning is similar to or different from competitors.

The JSON object must include:
- primaryAudience: string (who they are for)
- geographicFocus: string (local/regional/national/remote, with specifics - MUST identify hyper-local if present)
- localSearchLanguage: string[] (optional: phrases like "search by neighborhood", "find trainers near you" if detected)
- corePositioningStatement: string (summary of positioning)
- keyThemes: string[] (repeated ideas - MUST include "local" or "neighborhood" if hyper-local signals detected)
- differentiationSignals: string[] (how they stand out)
- evidenceFromSite: string[] (specific phrases/sections that support conclusions)

Be specific and cite exact language from the site. If hyper-local signals exist, you MUST identify them.

FALLBACK BEHAVIOR:
If dataAvailability.siteCrawl.coverageLevel is 'minimal', you MUST:
- Limit your conclusions to what is visible in the hero, nav, and top-level sections.
- Avoid claiming that ICP or geographic focus is 'not defined' unless there is clear evidence of generic messaging.
- Use cautious language (e.g., 'not clearly articulated on the pages we saw') rather than absolute statements.
- Do not assume positioning elements exist on pages we did not access.`;

  // Extract hyper-local signals from site content before LLM call
  const localSearchPhrases: string[] = [];
  const hyperLocalKeywords = [
    'neighborhood', 'near you', 'near me', 'in your neighborhood', 'by neighborhood',
    'search by location', 'find trainers near', 'local', 'by location',
    'in your area', 'nearby', 'find near', 'search by', 'location-based'
  ];
  
  // Check all pages for hyper-local language
  for (const page of siteContext.pages) {
    const allText = [
      ...page.headings,
      ...page.navItems,
      ...page.ctaLabels,
      ...page.sectionTitles,
      page.rawTextSample || '',
    ].join(' ').toLowerCase();
    
    for (const keyword of hyperLocalKeywords) {
      if (allText.includes(keyword.toLowerCase())) {
        // Extract the phrase containing the keyword
        const sentences = allText.split(/[.!?]/);
        for (const sentence of sentences) {
          if (sentence.includes(keyword.toLowerCase())) {
            const phrase = sentence.trim().substring(0, 100);
            if (phrase && !localSearchPhrases.includes(phrase)) {
              localSearchPhrases.push(phrase);
            }
          }
        }
      }
    }
  }
  
  // Also check blog posts and case studies
  for (const blogPost of siteContext.blogPosts) {
    if (blogPost.title) {
      const titleLower = blogPost.title.toLowerCase();
      for (const keyword of hyperLocalKeywords) {
        if (titleLower.includes(keyword.toLowerCase()) && !localSearchPhrases.includes(blogPost.title)) {
          localSearchPhrases.push(blogPost.title);
        }
      }
    }
  }
  
  for (const caseStudy of siteContext.caseStudies) {
    if (caseStudy.title) {
      const titleLower = caseStudy.title.toLowerCase();
      for (const keyword of hyperLocalKeywords) {
        if (titleLower.includes(keyword.toLowerCase()) && !localSearchPhrases.includes(caseStudy.title)) {
          localSearchPhrases.push(caseStudy.title);
        }
      }
    }
  }

  const siteContextText = formatSiteContextForPrompt(siteContext);
  const competitorContextText = competitorContexts.length > 0 
    ? formatCompetitorContextsForPrompt(competitorContexts)
    : '';

  const dataAvailabilitySummary = dataAvailability ? {
    siteCoverageLevel: dataAvailability.siteCrawl.coverageLevel,
    pagesAnalyzed: dataAvailability.siteCrawl.successfulUrls.length,
  } : null;

  const userPrompt = `Analyze the positioning for: ${companyName}

${dataAvailabilitySummary ? `Data Availability:
- Site Coverage: ${dataAvailabilitySummary.siteCoverageLevel} (${dataAvailabilitySummary.pagesAnalyzed} page(s) analyzed)
` : ''}

SITE CONTEXT (includes headings, nav items, CTAs, section titles, and raw text samples from multiple pages):
${siteContextText}

${competitorContextText ? `\nCOMPETITOR CONTEXT:\n${competitorContextText}` : ''}

CRITICAL: Analyze raw text samples and headings across ALL pages (homepage, About, Services, Blog, Case Studies) to detect:
- Hyper-local signals: "near you", "in your neighborhood", "by location", "search by neighborhood", city-specific language
- Geographic focus patterns repeated across multiple pages
- Audience signals found repeatedly in text samples and headings
- Messaging themes that appear consistently

${localSearchPhrases.length > 0 ? `HYPER-LOCAL SIGNALS DETECTED IN SITE CONTENT:
${localSearchPhrases.map((phrase, i) => `${i + 1}. "${phrase}"`).join('\n')}

These phrases indicate hyper-local/neighborhood-focused positioning. You MUST reflect this in geographicFocus and keyThemes.` : ''}

Analyze the positioning strategy, paying special attention to:
- Geographic focus (hyper-local, neighborhood-focused, city-specific, regional, national, remote) - MUST check text samples for location language
- Primary audience (who they are targeting) - look for repeated audience references in text
- Recurring themes and messaging patterns across headings AND text samples
- Differentiation signals

Provide specific evidence from the site content, citing exact phrases from headings or text samples.`;

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
      max_tokens: 1000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('No content from OpenAI');

    const parsed = JSON.parse(content);

    // Validate and return
    const localSearchLanguage = Array.isArray(parsed.localSearchLanguage) 
      ? parsed.localSearchLanguage.slice(0, 10)
      : (localSearchPhrases.length > 0 ? localSearchPhrases.slice(0, 10) : undefined);
    
    // Ensure keyThemes includes local/neighborhood if hyper-local signals detected
    let keyThemes = Array.isArray(parsed.keyThemes) ? parsed.keyThemes.slice(0, 10) : [];
    if (localSearchPhrases.length > 0) {
      const hasLocalTheme = keyThemes.some((theme: string) => 
        theme.toLowerCase().includes('local') || 
        theme.toLowerCase().includes('neighborhood') ||
        theme.toLowerCase().includes('near')
      );
      if (!hasLocalTheme) {
        keyThemes = ['local', 'neighborhood-focused', ...keyThemes].slice(0, 10);
      }
    }
    
    // Ensure geographicFocus reflects hyper-local if signals detected
    let geographicFocus = typeof parsed.geographicFocus === 'string' ? parsed.geographicFocus : 'Not clearly defined';
    if (localSearchPhrases.length > 0 && !geographicFocus.toLowerCase().includes('local') && !geographicFocus.toLowerCase().includes('neighborhood')) {
      geographicFocus = `hyper-local / neighborhood-focused${geographicFocus !== 'Not clearly defined' ? ` (${geographicFocus})` : ''}`;
    }
    
    return {
      primaryAudience: typeof parsed.primaryAudience === 'string' ? parsed.primaryAudience : 'Not clearly defined',
      geographicFocus,
      localSearchLanguage,
      corePositioningStatement: typeof parsed.corePositioningStatement === 'string' ? parsed.corePositioningStatement : 'Positioning not clearly articulated',
      keyThemes,
      differentiationSignals: Array.isArray(parsed.differentiationSignals) ? parsed.differentiationSignals.slice(0, 10) : [],
      evidenceFromSite: Array.isArray(parsed.evidenceFromSite) ? parsed.evidenceFromSite.slice(0, 15) : [],
    };
  } catch (error) {
    console.error('❌ Error analyzing positioning with AI:', error);
    
    // Fallback: try to extract basic positioning from site context
    const fallback: PositioningAnalysis = {
      primaryAudience: 'Not clearly defined',
      geographicFocus: 'Not clearly defined',
      corePositioningStatement: 'Positioning not clearly articulated',
      keyThemes: [],
      differentiationSignals: [],
      evidenceFromSite: [],
    };

    // Try to extract some basic info from site context
    if (siteContext.pages.length > 0) {
      const mainPage = siteContext.pages[0];
      if (mainPage.headings.length > 0) {
        fallback.keyThemes = mainPage.headings.slice(0, 5);
      }
      
      // Check for hyper-local signals in fallback
      if (localSearchPhrases.length > 0) {
        fallback.localSearchLanguage = localSearchPhrases.slice(0, 10);
        fallback.geographicFocus = 'hyper-local / neighborhood-focused';
        if (!fallback.keyThemes.some((theme: string) => theme.toLowerCase().includes('local') || theme.toLowerCase().includes('neighborhood'))) {
          fallback.keyThemes = ['local', 'neighborhood-focused', ...fallback.keyThemes].slice(0, 10);
        }
      }
    }

    return fallback;
  }
}

