import OpenAI from 'openai';
import { env } from './env';
import type { PageSpeedResult, AISnapshotAnalysis, PriorityAction } from '@/types/snapshot';

// Lazy initialization to avoid build-time errors
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
    }
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

/**
 * Fetch PageSpeed Insights performance score
 * 
 * @param url - Website URL to analyze
 * @param apiKey - Optional PageSpeed API key (defaults to PAGESPEED_API_KEY env var)
 * @returns Promise resolving to PageSpeedResult with performance score (0-100)
 * @throws Never throws - returns default score of 75 on error
 */
export async function getPageSpeedScore(
  url: string,
  apiKey?: string
): Promise<PageSpeedResult> {
  const pagespeedApiKey = apiKey || process.env.PAGESPEED_API_KEY;

  if (!pagespeedApiKey) {
    console.warn('⚠️  PAGESPEED_API_KEY not set, using default performance score of 75');
    return {
      performance: 75,
      url,
    };
  }

  try {
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance&key=${pagespeedApiKey}`;
    
    const response = await fetch(apiUrl, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      console.warn(`PageSpeed API error: ${response.status}, using default score`);
      return {
        performance: 75,
        url,
      };
    }

    const data = await response.json();
    const performanceScore =
      data.lighthouseResult?.categories?.performance?.score * 100 || 75;

    return {
      performance: Math.round(performanceScore),
      url,
    };
  } catch (error) {
    console.error('Error fetching PageSpeed:', error);
    return {
      performance: 75,
      url,
    };
  }
}

/**
 * Fetch HTML content from URL (best-effort, truncated to ~6000 chars)
 * Used to provide context to AI analysis
 * 
 * @param url - Website URL to fetch
 * @returns Promise resolving to cleaned text content (max 6000 chars)
 * @throws Never throws - returns empty string on error
 */
export interface DiscoveredUrls {
  blogUrls: string[];
  linkedinUrls: string[];
  facebookUrls: string[];
  instagramUrls: string[];
  gbpUrls: string[];
}

export async function fetchHTMLHint(url: string): Promise<string>;
export async function fetchHTMLHint(url: string, returnUrls: true): Promise<{ htmlHint: string; urls: DiscoveredUrls }>;
export async function fetchHTMLHint(url: string, returnUrls?: boolean): Promise<string | { htmlHint: string; urls: DiscoveredUrls }> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; HiveSnapshotBot/1.0; +https://hiveadagency.com)',
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      return '';
    }

    const html = await response.text();
    
    // Extract navigation links, blog URLs, and social links before stripping HTML
    const navLinks: string[] = [];
    const blogUrls: string[] = [];
    const linkedinUrls: string[] = [];
    const facebookUrls: string[] = [];
    const instagramUrls: string[] = [];
    const gbpUrls: string[] = [];
    const allLinks: string[] = [];
    
    // Extract links from nav elements and footer
    const navMatch = html.match(/<nav[^>]*>([\s\S]*?)<\/nav>/gi);
    const footerMatch = html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/gi);
    const sectionsToSearch = [...(navMatch || []), ...(footerMatch || [])];
    
    sectionsToSearch.forEach(section => {
      const linkMatches = section.match(/<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*?)<\/a>/gi);
      if (linkMatches) {
        linkMatches.forEach(link => {
          const hrefMatch = link.match(/href=["']([^"']+)["']/i);
          const textMatch = link.match(/>([^<]+)</i);
          if (hrefMatch) {
            const href = hrefMatch[1];
            const text = (textMatch ? textMatch[1] : '').toLowerCase().trim();
            const fullHref = href.startsWith('http') ? href : (href.startsWith('/') ? new URL(href, url).href : href);
            
            allLinks.push(fullHref);
            
            // Detect blog links
            if (text.includes('blog') || text.includes('article') || text.includes('news') || 
                text.includes('resource') || href.includes('/blog') || href.includes('/article') || 
                href.includes('/news') || href.includes('/resources') || href.includes('/posts') ||
                href.includes('/journal') || href.includes('/insights')) {
              if (!blogUrls.includes(fullHref)) {
                blogUrls.push(fullHref);
              }
            }
            
            // Detect LinkedIn links
            if (href.includes('linkedin.com/company') || href.includes('linkedin.com/company/')) {
              if (!linkedinUrls.includes(fullHref)) {
                linkedinUrls.push(fullHref);
              }
            } else if (href.includes('linkedin.com') && (text.includes('linkedin') || text.includes('company'))) {
              // Also catch general LinkedIn links that might be company pages
              if (!linkedinUrls.includes(fullHref)) {
                linkedinUrls.push(fullHref);
              }
            }
            
            // Detect Facebook links
            if (href.includes('facebook.com/') || href.includes('fb.com/') || href.includes('fb.me/')) {
              if (!facebookUrls.includes(fullHref)) {
                facebookUrls.push(fullHref);
              }
            }
            
            // Detect Instagram links
            if (href.includes('instagram.com/') || href.includes('instagr.am/')) {
              if (!instagramUrls.includes(fullHref)) {
                instagramUrls.push(fullHref);
              }
            }
            
            // Detect Google Business Profile links
            if (href.includes('google.com/maps') || href.includes('g.page') || 
                href.includes('google.com/business') || href.includes('maps.google.com')) {
              if (!gbpUrls.includes(fullHref)) {
                gbpUrls.push(fullHref);
              }
            } else if (href.includes('google.com') && text && 
                       (text.includes('business') || text.includes('maps') || text.includes('reviews') || text.includes('google'))) {
              // Also catch Google links that might be business profile related
              if (!gbpUrls.includes(fullHref)) {
                gbpUrls.push(fullHref);
              }
            }
          }
        });
      }
    });
    
    // Also check for links in all anchor tags (for social icons, etc.)
    const allLinkMatches = html.match(/<a[^>]*href=["']([^"']+)["'][^>]*>/gi);
    if (allLinkMatches) {
      allLinkMatches.forEach(link => {
        const hrefMatch = link.match(/href=["']([^"']+)["']/i);
        if (hrefMatch) {
          const href = hrefMatch[1];
          const fullHref = href.startsWith('http') ? href : (href.startsWith('/') ? new URL(href, url).href : href);
          
          // Detect blog links
          if (href.includes('/blog') || href.includes('/article') || href.includes('/news') || 
              href.includes('/resources') || href.includes('/posts') || href.includes('/journal') ||
              href.includes('/insights')) {
            if (!blogUrls.includes(fullHref)) {
              blogUrls.push(fullHref);
            }
          }
          
          // Detect LinkedIn links
          if ((href.includes('linkedin.com/company') || href.includes('linkedin.com/company/')) &&
              !linkedinUrls.includes(fullHref)) {
            linkedinUrls.push(fullHref);
          }
          
          // Detect Facebook links
          if ((href.includes('facebook.com/') || href.includes('fb.com/') || href.includes('fb.me/')) &&
              !facebookUrls.includes(fullHref)) {
            facebookUrls.push(fullHref);
          }
          
          // Detect Instagram links
          if ((href.includes('instagram.com/') || href.includes('instagr.am/')) &&
              !instagramUrls.includes(fullHref)) {
            instagramUrls.push(fullHref);
          }
          
          // Detect Google Business Profile links
          if ((href.includes('google.com/maps') || href.includes('g.page') || 
               href.includes('google.com/business') || href.includes('maps.google.com')) &&
              !gbpUrls.includes(fullHref)) {
            gbpUrls.push(fullHref);
          }
        }
      });
    }
    
    // Extract text content roughly (remove scripts, styles, etc.)
    const textOnly = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Build enhanced HTML hint with navigation, blog, and social links
    let enhancedHint = textOnly.substring(0, 4000); // Reserve space for links
    
    if (navLinks.length > 0) {
      enhancedHint += '\n\nNAVIGATION LINKS:\n' + navLinks.slice(0, 20).join('\n');
    }
    
    if (blogUrls.length > 0) {
      enhancedHint += '\n\nBLOG/ARTICLE URLs DETECTED:\n' + blogUrls.slice(0, 10).join('\n');
    }
    
    if (linkedinUrls.length > 0) {
      enhancedHint += '\n\nLINKEDIN COMPANY PAGE URLs DETECTED:\n' + linkedinUrls.slice(0, 5).join('\n');
      // eslint-disable-next-line no-console
      console.log(`🔗 Found ${linkedinUrls.length} LinkedIn URL(s):`, linkedinUrls.slice(0, 5));
    }
    
    if (facebookUrls.length > 0) {
      enhancedHint += '\n\nFACEBOOK PAGE URLs DETECTED:\n' + facebookUrls.slice(0, 5).join('\n');
      // eslint-disable-next-line no-console
      console.log(`📘 Found ${facebookUrls.length} Facebook URL(s):`, facebookUrls.slice(0, 5));
    }
    
    if (instagramUrls.length > 0) {
      enhancedHint += '\n\nINSTAGRAM PROFILE URLs DETECTED:\n' + instagramUrls.slice(0, 5).join('\n');
      // eslint-disable-next-line no-console
      console.log(`📷 Found ${instagramUrls.length} Instagram URL(s):`, instagramUrls.slice(0, 5));
    }
    
    if (gbpUrls.length > 0) {
      enhancedHint += '\n\nGOOGLE BUSINESS PROFILE URLs DETECTED:\n' + gbpUrls.slice(0, 5).join('\n');
      // eslint-disable-next-line no-console
      console.log(`📍 Found ${gbpUrls.length} GBP URL(s):`, gbpUrls.slice(0, 5));
    }
    
    if (blogUrls.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`📝 Found ${blogUrls.length} blog URL(s):`, blogUrls.slice(0, 5));
    }
    
    if (facebookUrls.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`📘 Found ${facebookUrls.length} Facebook URL(s):`, facebookUrls.slice(0, 5));
    }
    
    if (instagramUrls.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`📷 Found ${instagramUrls.length} Instagram URL(s):`, instagramUrls.slice(0, 5));
    }
    
    if (allLinks.length > 0 && blogUrls.length === 0) {
      // Include some internal links that might be blog-related
      const potentialBlogLinks = allLinks.filter(link => 
        link.includes('/blog') || link.includes('/article') || link.includes('/news') ||
        link.includes('/resources') || link.includes('/posts') || link.includes('/journal') ||
        link.includes('/insights')
      );
      if (potentialBlogLinks.length > 0) {
        enhancedHint += '\n\nPOTENTIAL BLOG LINKS:\n' + potentialBlogLinks.slice(0, 10).join('\n');
      }
    }

    const finalHint = enhancedHint.substring(0, 8000);
    
    if (returnUrls) {
      return {
        htmlHint: finalHint,
        urls: {
          blogUrls,
          linkedinUrls,
          facebookUrls,
          instagramUrls,
          gbpUrls,
        },
      };
    }
    
    return finalHint;
  } catch (error: any) {
    // Handle timeout errors gracefully - don't log as error if it's just a timeout
    if (error?.name === 'TimeoutError' || error?.code === 23 || error?.message?.includes('timeout') || error?.message?.includes('aborted')) {
      console.log('⚠️  HTML fetch timed out (5s limit) - continuing without HTML context');
    } else {
      console.warn('Error fetching HTML hint:', error);
    }
    if (returnUrls) {
      return {
        htmlHint: '',
        urls: {
          blogUrls: [],
          linkedinUrls: [],
          facebookUrls: [],
          instagramUrls: [],
          gbpUrls: [],
        },
      };
    }
    return '';
  }
}

/**
 * Analyze website with GPT-4o-mini
 * Scores SEO, content, and conversion readiness, plus provides strengths and quick wins
 * 
 * @deprecated This function is deprecated. Use analyzeWebsiteWithRubric from lib/rubric-analysis.ts instead.
 * This function is kept for backward compatibility and fallback scenarios.
 * 
 * @param url - Website URL being analyzed
 * @param performanceScore - PageSpeed performance score (0-100)
 * @param htmlHint - Text content extracted from website (for context)
 * @returns Promise resolving to AISnapshotAnalysis with scores and insights
 * @throws Never throws - returns default values on error
 */
export async function analyzeWebsiteWithAI(
  url: string,
  performanceScore: number,
  htmlHint: string,
  googleBusinessData?: { found: boolean; rating?: number; reviewCount?: number; completeness?: number },
  linkedinData?: { found: boolean; completeness?: number; followerCount?: number }
): Promise<AISnapshotAnalysis> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for AI analysis');
  }

  const prompt = `Analyze this website comprehensively and return detailed JSON with scores, breakdowns, and actionable insights.

Score each category 0-100. Use these criteria:
- SEO: title/H1/meta tags, internal links, on-page optimization, keyword usage, technical SEO
- Content: clarity, specificity, proof points, value proposition, messaging quality, tone consistency, readability
- Conversion: hero clarity, primary CTA visibility, social proof, friction points, trust signals, urgency

For each score category (seo, content, conversion), provide:
- score: current score (0-100)
- reasons: array of 3-5 specific reasons why the score is what it is (be specific, reference actual elements found)
- potential: potential score (0-100) if key issues were fixed

For priorityActions, provide 5-7 prioritized actions with:
- action: specific, actionable recommendation
- impact: "high", "medium", or "low"
- effort: "low", "medium", or "high" 
- potentialGain: estimated points this could add to overall score (0-20)

For industryBenchmark, provide typical scores for similar businesses:
- overall: typical overall score (60-75)
- seo: typical SEO score (55-70)
- content: typical content score (60-75)
- conversion: typical conversion score (55-70)

For contentInsights, provide 2-3 sentences analyzing content quality, messaging effectiveness, value proposition clarity.

overall = round(0.3*seo + 0.3*content + 0.3*conversion + 0.1*performance).

URL: ${url}
Performance: ${performanceScore}/100
HTML hint (may be truncated):
${htmlHint.substring(0, 4000)}
${googleBusinessData?.found ? `
Google Business Profile:
- Rating: ${googleBusinessData.rating || 'N/A'}/5.0
- Reviews: ${googleBusinessData.reviewCount || 'N/A'}
- Completeness: ${googleBusinessData.completeness || 'N/A'}%
` : ''}
${linkedinData?.found ? `
LinkedIn Company Page:
- Followers: ${linkedinData.followerCount || 'N/A'}
- Completeness: ${linkedinData.completeness || 'N/A'}%
` : ''}

Return JSON ONLY with these exact fields:
{
  "seo": number,
  "content": number,
  "conversion": number,
  "strengths": ["strength1", "strength2", "strength3"],
  "quickWins": ["win1", "win2", "win3"],
  "contentInsights": "2-3 sentence analysis",
  "scoreBreakdowns": {
    "seo": {"score": number, "reasons": ["reason1", "reason2", "reason3"], "potential": number},
    "content": {"score": number, "reasons": ["reason1", "reason2", "reason3"], "potential": number},
    "conversion": {"score": number, "reasons": ["reason1", "reason2", "reason3"], "potential": number},
    "performance": {"score": number, "reasons": ["reason1", "reason2"], "potential": number}
  },
  "priorityActions": [
    {"action": "specific action", "impact": "high|medium|low", "effort": "low|medium|high", "potentialGain": number}
  ],
  "industryBenchmark": {
    "overall": number,
    "seo": number,
    "content": number,
    "conversion": number
  }
}`;

  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a marketing expert analyzing websites. Return only valid JSON, no markdown, no explanations.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
      max_tokens: 2000, // Increased for detailed breakdowns
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content from OpenAI');
    }

    const parsed = JSON.parse(content) as Partial<AISnapshotAnalysis>;

    // Validate and ensure we have all required fields
    const seoScore = Math.max(0, Math.min(100, parsed.seo ?? 50));
    const contentScore = Math.max(0, Math.min(100, parsed.content ?? 50));
    const conversionScore = Math.max(0, Math.min(100, parsed.conversion ?? 50));
    
    const analysis: AISnapshotAnalysis = {
      seo: seoScore,
      content: contentScore,
      conversion: conversionScore,
      strengths: Array.isArray(parsed.strengths)
        ? parsed.strengths.slice(0, 3)
        : ['Fast loading', 'Clear navigation', 'Professional design'],
      quickWins: Array.isArray(parsed.quickWins)
        ? parsed.quickWins.slice(0, 3)
        : ['Improve meta titles', 'Add social proof', 'Clarify CTA'],
      contentInsights:
        typeof parsed.contentInsights === 'string' && parsed.contentInsights.trim()
          ? parsed.contentInsights.trim()
          : undefined,
      scoreBreakdowns: parsed.scoreBreakdowns ? {
        seo: {
          score: Math.max(0, Math.min(100, parsed.scoreBreakdowns.seo?.score ?? seoScore)),
          reasons: Array.isArray(parsed.scoreBreakdowns.seo?.reasons) 
            ? parsed.scoreBreakdowns.seo.reasons.slice(0, 5)
            : ['On-page optimization needed', 'Meta tags could be improved', 'Internal linking structure'],
          potential: Math.max(0, Math.min(100, parsed.scoreBreakdowns.seo?.potential ?? seoScore + 15)),
        },
        content: {
          score: Math.max(0, Math.min(100, parsed.scoreBreakdowns.content?.score ?? contentScore)),
          reasons: Array.isArray(parsed.scoreBreakdowns.content?.reasons)
            ? parsed.scoreBreakdowns.content.reasons.slice(0, 5)
            : ['Value proposition could be clearer', 'Proof points needed', 'Messaging consistency'],
          potential: Math.max(0, Math.min(100, parsed.scoreBreakdowns.content?.potential ?? contentScore + 15)),
        },
        conversion: {
          score: Math.max(0, Math.min(100, parsed.scoreBreakdowns.conversion?.score ?? conversionScore)),
          reasons: Array.isArray(parsed.scoreBreakdowns.conversion?.reasons)
            ? parsed.scoreBreakdowns.conversion.reasons.slice(0, 5)
            : ['CTA visibility could improve', 'Social proof needed', 'Friction points present'],
          potential: Math.max(0, Math.min(100, parsed.scoreBreakdowns.conversion?.potential ?? conversionScore + 15)),
        },
        performance: {
          score: performanceScore,
          reasons: [
            performanceScore >= 80 ? 'Fast loading times' : 'Page load speed needs improvement',
            performanceScore >= 70 ? 'Good mobile performance' : 'Mobile optimization needed',
          ],
          potential: Math.min(100, performanceScore + 10),
        },
      } : undefined,
      priorityActions: Array.isArray(parsed.priorityActions) && parsed.priorityActions.length > 0
        ? parsed.priorityActions
            .slice(0, 7)
            .map((action: Partial<PriorityAction>) => ({
              action: typeof action.action === 'string' ? action.action : 'Improve website performance',
              impact: ['high', 'medium', 'low'].includes(action.impact || '') 
                ? (action.impact as 'high' | 'medium' | 'low')
                : 'medium',
              effort: ['low', 'medium', 'high'].includes(action.effort || '')
                ? (action.effort as 'low' | 'medium' | 'high')
                : 'medium',
              potentialGain: Math.max(0, Math.min(20, typeof action.potentialGain === 'number' ? action.potentialGain : 5)),
            }))
        : undefined,
      industryBenchmark: parsed.industryBenchmark ? {
        overall: Math.max(0, Math.min(100, parsed.industryBenchmark.overall ?? 65)),
        seo: Math.max(0, Math.min(100, parsed.industryBenchmark.seo ?? 60)),
        content: Math.max(0, Math.min(100, parsed.industryBenchmark.content ?? 65)),
        conversion: Math.max(0, Math.min(100, parsed.industryBenchmark.conversion ?? 60)),
      } : undefined,
    };

    return analysis;
  } catch (error) {
    console.error('Error in AI analysis:', error);
    // Return default values on error
    return {
      seo: 50,
      content: 50,
      conversion: 50,
      strengths: ['Fast loading', 'Clear navigation', 'Professional design'],
      quickWins: ['Improve meta titles', 'Add social proof', 'Clarify CTA'],
      contentInsights: undefined,
      scoreBreakdowns: undefined,
      priorityActions: undefined,
      industryBenchmark: undefined,
    };
  }
}

/**
 * Calculate overall score from subscores using weighted formula
 * Formula: overall = 0.3*seo + 0.3*content + 0.3*conversion + 0.1*performance
 * 
 * @param seo - SEO score (0-100)
 * @param content - Content score (0-100)
 * @param conversion - Conversion score (0-100)
 * @param performance - Performance score (0-100)
 * @returns Overall score rounded to nearest integer (0-100)
 */
export function calculateOverallScore(
  seo: number,
  content: number,
  conversion: number,
  performance: number
): number {
  return Math.round(0.3 * seo + 0.3 * content + 0.3 * conversion + 0.1 * performance);
}

