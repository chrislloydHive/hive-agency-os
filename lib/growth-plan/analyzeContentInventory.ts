/**
 * Content Inventory Analysis
 * 
 * Analyzes content depth, blog posts, case studies, About page depth,
 * FAQ presence, content gaps, and funnel stage coverage.
 */

import OpenAI from 'openai';
import { env } from '@/lib/env';
import type { SiteElementContext } from './html-context';
import { formatSiteContextForPrompt } from './html-context';

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

export interface ContentInventory {
  blogPostsFound: number;
  blogCategories: string[]; // Inferred categories/themes
  caseStudiesFound: number;
  aboutPageDepth: 'minimal' | 'moderate' | 'comprehensive';
  faqPresent: boolean;
  contentGaps: string[]; // Missing content types or topics
  funnelStageCoverage: {
    topOfFunnel: 'strong' | 'moderate' | 'weak';
    middleOfFunnel: 'strong' | 'moderate' | 'weak';
    bottomOfFunnel: 'strong' | 'moderate' | 'weak';
  };
  contentThemes: string[]; // Recurring topics/themes across content
  contentVolume: 'high' | 'medium' | 'low';
}

/**
 * Analyze content inventory from site context
 */
export async function analyzeContentInventory(
  siteContext: SiteElementContext
): Promise<ContentInventory> {
  console.log('📚 Analyzing content inventory...');

  // Extract basic counts
  const blogPostsFound = siteContext.blogPosts.length;
  const caseStudiesFound = siteContext.caseStudies.length;
  
  // Find About page
  const aboutPage = siteContext.pages.find(p => p.type === 'about');
  const aboutPageDepth = aboutPage 
    ? (aboutPage.rawTextSample && aboutPage.rawTextSample.length > 1000 
        ? 'comprehensive' 
        : aboutPage.rawTextSample && aboutPage.rawTextSample.length > 500 
          ? 'moderate' 
          : 'minimal')
    : 'minimal';
  
  // Check for FAQ
  const faqPresent = siteContext.pages.some(page => 
    page.headings.some(h => h.toLowerCase().includes('faq') || h.toLowerCase().includes('frequently asked'))
  );

  // Extract blog post titles for category inference
  const blogTitles = siteContext.blogPosts.map(p => p.title).join('; ');
  
  // Extract content themes from headings and text samples
  const allHeadings = siteContext.pages.flatMap(p => p.headings);
  const allTextSamples = siteContext.pages
    .map(p => p.rawTextSample)
    .filter(Boolean)
    .join(' ');

  const systemPrompt = `You are a content strategist analyzing a website's content inventory.

You will receive:
- Number of blog posts found
- Blog post titles
- Number of case studies found
- About page depth assessment
- FAQ presence
- Headings from all pages
- Text samples from pages

Your job:
1. Infer blog categories/themes from blog post titles
2. Identify content gaps (missing content types or topics)
3. Assess funnel stage coverage:
   - Top of Funnel (TOFU): Educational content, awareness-building
   - Middle of Funnel (MOFU): Consideration content, comparisons, how-tos
   - Bottom of Funnel (BOFU): Case studies, testimonials, pricing, demos
4. Identify recurring content themes across the site
5. Assess overall content volume (high/medium/low)

Return a JSON ContentInventory object:
{
  "blogPostsFound": number,
  "blogCategories": string[],
  "caseStudiesFound": number,
  "aboutPageDepth": "minimal" | "moderate" | "comprehensive",
  "faqPresent": boolean,
  "contentGaps": string[],
  "funnelStageCoverage": {
    "topOfFunnel": "strong" | "moderate" | "weak",
    "middleOfFunnel": "strong" | "moderate" | "weak",
    "bottomOfFunnel": "strong" | "moderate" | "weak"
  },
  "contentThemes": string[],
  "contentVolume": "high" | "medium" | "low"
}

Be specific and evidence-based.`;

  const userPrompt = `Analyze content inventory:

Blog Posts Found: ${blogPostsFound}
Blog Post Titles: ${blogTitles || 'None found'}

Case Studies Found: ${caseStudiesFound}
Case Study Titles: ${siteContext.caseStudies.map(cs => cs.title).join('; ') || 'None found'}

About Page Depth: ${aboutPageDepth}
FAQ Present: ${faqPresent}

All Page Headings:
${allHeadings.slice(0, 50).join('\n')}

Text Samples (first 2000 chars):
${allTextSamples.substring(0, 2000)}

Provide comprehensive content inventory analysis.`;

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

    return {
      blogPostsFound: typeof parsed.blogPostsFound === 'number' ? parsed.blogPostsFound : blogPostsFound,
      blogCategories: Array.isArray(parsed.blogCategories) ? parsed.blogCategories.slice(0, 10) : [],
      caseStudiesFound: typeof parsed.caseStudiesFound === 'number' ? parsed.caseStudiesFound : caseStudiesFound,
      aboutPageDepth: parsed.aboutPageDepth === 'comprehensive' || parsed.aboutPageDepth === 'moderate' || parsed.aboutPageDepth === 'minimal' 
        ? parsed.aboutPageDepth 
        : aboutPageDepth,
      faqPresent: typeof parsed.faqPresent === 'boolean' ? parsed.faqPresent : faqPresent,
      contentGaps: Array.isArray(parsed.contentGaps) ? parsed.contentGaps.slice(0, 10) : [],
      funnelStageCoverage: parsed.funnelStageCoverage || {
        topOfFunnel: 'weak',
        middleOfFunnel: 'weak',
        bottomOfFunnel: 'weak',
      },
      contentThemes: Array.isArray(parsed.contentThemes) ? parsed.contentThemes.slice(0, 10) : [],
      contentVolume: parsed.contentVolume === 'high' || parsed.contentVolume === 'medium' || parsed.contentVolume === 'low'
        ? parsed.contentVolume
        : (blogPostsFound + caseStudiesFound > 20 ? 'high' : blogPostsFound + caseStudiesFound > 5 ? 'medium' : 'low'),
    };
  } catch (error) {
    console.error('❌ Error analyzing content inventory:', error);
    
    // Fallback
    return {
      blogPostsFound,
      blogCategories: [],
      caseStudiesFound,
      aboutPageDepth,
      faqPresent,
      contentGaps: [],
      funnelStageCoverage: {
        topOfFunnel: 'weak',
        middleOfFunnel: 'weak',
        bottomOfFunnel: 'weak',
      },
      contentThemes: [],
      contentVolume: blogPostsFound + caseStudiesFound > 20 ? 'high' : blogPostsFound + caseStudiesFound > 5 ? 'medium' : 'low',
    };
  }
}

