// lib/diagnostics/content-lab/analyzer.ts
// Content Lab Analyzer - Collects signals for content analysis
//
// V1 Lightweight analyzer that examines:
// - Blog presence and article count
// - Case studies
// - Resource pages (guides, whitepapers)
// - Pricing content
// - FAQ/Help content
// - Content freshness signals
// - GSC content performance (if available)

import type {
  ContentLabAnalysisOutput,
  ContentDataConfidence,
  ContentLabFindings,
  ContentTypePresence,
} from './types';

// ============================================================================
// Types
// ============================================================================

interface ContentAnalyzerInput {
  companyId?: string;
  url: string;
  companyType?: string | null;
  workspaceId?: string;
}

interface CrawledPage {
  url: string;
  path: string;
  html: string;
  title: string | null;
  contentType: 'blog' | 'article' | 'case_study' | 'resource' | 'faq' | 'pricing' | 'guide' | 'other';
  publishDate?: string | null;
  wordCount: number;
}

// ============================================================================
// Main Analyzer Function
// ============================================================================

/**
 * Normalize company type to standard values
 * V2: Consistent normalization across all labs
 */
function normalizeCompanyType(raw?: string | null): string {
  if (!raw) return 'unknown';
  const lowered = raw.toLowerCase().trim();

  if (lowered.includes('saas') || lowered.includes('software')) return 'saas';
  if (lowered.includes('ecom') || lowered.includes('shop') || lowered.includes('retail')) return 'ecommerce';
  if (lowered.includes('local')) return 'local_service';
  if (lowered.includes('b2b')) return 'b2b_services';
  if (lowered === 'services' || lowered.includes('agency') || lowered.includes('consult')) return 'b2b_services';

  return 'other';
}

/**
 * Analyze content signals from website
 */
export async function analyzeContentInputs(
  input: ContentAnalyzerInput
): Promise<ContentLabAnalysisOutput> {
  const websiteUrl = input.url.replace(/\/$/, '');
  const { companyId } = input;
  // V2: Normalize company type
  const companyType = normalizeCompanyType(input.companyType);

  console.log('[ContentAnalyzer] Starting analysis for:', websiteUrl);

  // Crawl content pages
  const pages = await crawlContentPages(websiteUrl);
  console.log('[ContentAnalyzer] Crawled', pages.length, 'content pages');

  // Analyze content inventory
  const hasBlog = pages.some(p => p.contentType === 'blog' || p.contentType === 'article');
  const hasCaseStudies = pages.some(p => p.contentType === 'case_study');
  const hasResourcePages = pages.some(p => p.contentType === 'resource' || p.contentType === 'guide');
  const hasPricingContent = pages.some(p => p.contentType === 'pricing');
  const hasFaqContent = pages.some(p => p.contentType === 'faq');

  // Count articles
  const articles = pages.filter(p => p.contentType === 'blog' || p.contentType === 'article');
  const articleCount = articles.length;

  // Extract article titles
  const extractedArticleTitles = articles
    .map(p => p.title)
    .filter((t): t is string => t !== null)
    .slice(0, 20);

  // Extract topics from titles
  const extractedTopics = extractTopicsFromTitles(extractedArticleTitles);

  // Count recent articles (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const recentArticles = articles.filter(p => {
    if (!p.publishDate) return false;
    const pubDate = new Date(p.publishDate);
    return pubDate > sixMonthsAgo;
  });
  const recentArticlesCount = recentArticles.length;

  // Collect last updated dates
  const lastUpdatedDates = articles
    .map(p => p.publishDate)
    .filter((d): d is string => d !== null)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
    .slice(0, 10);

  // Get content URLs
  const contentUrls = pages.map(p => p.url);

  // Try to get GSC data for content pages (if available)
  let contentSearchClicks: number | undefined;
  let contentSearchImpressions: number | undefined;
  let contentSearchCtr: number | undefined;

  try {
    const gscData = await fetchGscContentData(input.workspaceId, contentUrls);
    if (gscData) {
      contentSearchClicks = gscData.clicks;
      contentSearchImpressions = gscData.impressions;
      contentSearchCtr = gscData.ctr;
    }
  } catch (error) {
    console.log('[ContentAnalyzer] No GSC data available:', error);
  }

  // Compute data confidence
  const dataConfidence = computeDataConfidence(pages.length, articleCount, !!contentSearchImpressions);

  // Build findings
  const findings: ContentLabFindings = {
    contentUrls,
    articleTitles: extractedArticleTitles,
    topics: extractedTopics,
    contentTypes: buildContentTypePresence(pages),
  };

  console.log('[ContentAnalyzer] Analysis complete:', {
    articleCount,
    hasBlog,
    hasCaseStudies,
    hasResourcePages,
    topics: extractedTopics.length,
    recentArticles: recentArticlesCount,
  });

  return {
    url: websiteUrl,
    companyId,
    companyType,
    articleCount,
    hasBlog,
    hasCaseStudies,
    hasResourcePages,
    hasPricingContent,
    hasFaqContent,
    extractedTopics,
    extractedArticleTitles,
    contentUrls,
    recentArticlesCount,
    lastUpdatedDates,
    contentSearchClicks,
    contentSearchImpressions,
    contentSearchCtr,
    dataConfidence,
  };
}

// ============================================================================
// Page Crawling
// ============================================================================

/**
 * Crawl content-related pages from the website
 */
async function crawlContentPages(baseUrl: string): Promise<CrawledPage[]> {
  const pages: CrawledPage[] = [];

  // Content-related paths to check
  const contentPaths = [
    '/blog',
    '/blog/',
    '/articles',
    '/news',
    '/insights',
    '/resources',
    '/case-studies',
    '/case-study',
    '/customers',
    '/success-stories',
    '/guides',
    '/guide',
    '/whitepapers',
    '/ebooks',
    '/faq',
    '/faqs',
    '/help',
    '/support',
    '/pricing',
    '/pricing/',
    '/learn',
    '/knowledge-base',
    '/kb',
  ];

  // First fetch homepage to find content links
  const homepageHtml = await fetchPage(baseUrl);
  if (homepageHtml) {
    // Extract links to content pages
    const links = extractContentLinks(homepageHtml, baseUrl);

    // Fetch blog index pages
    for (const path of contentPaths) {
      if (pages.length >= 30) break;

      try {
        const url = `${baseUrl}${path}`;
        const html = await fetchPage(url);

        if (html && html.length > 1000 && !isErrorPage(html)) {
          const contentType = determineContentType(path, html);
          const page = processPage(url, path, html, contentType);
          pages.push(page);

          // If this is a blog index, extract article links
          if (contentType === 'blog') {
            const articleLinks = extractArticleLinks(html, baseUrl, path);
            for (const articleLink of articleLinks.slice(0, 10)) {
              if (pages.length >= 30) break;
              if (pages.some(p => p.path === articleLink.path)) continue;

              try {
                const articleHtml = await fetchPage(articleLink.url);
                if (articleHtml && articleHtml.length > 1000 && !isErrorPage(articleHtml)) {
                  const articlePage = processPage(
                    articleLink.url,
                    articleLink.path,
                    articleHtml,
                    'article'
                  );
                  pages.push(articlePage);
                }
              } catch {
                // Skip failed article fetches
              }
            }
          }
        }
      } catch {
        // Path doesn't exist, skip
      }
    }

    // Also check content links found on homepage
    for (const link of links.slice(0, 15)) {
      if (pages.length >= 30) break;
      if (pages.some(p => p.path === link.path)) continue;

      try {
        const html = await fetchPage(link.url);
        if (html && html.length > 1000 && !isErrorPage(html)) {
          const contentType = determineContentType(link.path, html);
          if (contentType !== 'other') {
            const page = processPage(link.url, link.path, html, contentType);
            pages.push(page);
          }
        }
      } catch {
        // Skip failed fetches
      }
    }
  }

  return pages;
}

/**
 * Process a crawled page into structured data
 */
function processPage(
  url: string,
  path: string,
  html: string,
  contentType: CrawledPage['contentType']
): CrawledPage {
  return {
    url,
    path,
    html,
    title: extractTitle(html),
    contentType,
    publishDate: extractPublishDate(html),
    wordCount: estimateWordCount(html),
  };
}

/**
 * Fetch a single page
 */
async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'HiveOS-ContentLab/1.0',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.log('[ContentAnalyzer] Fetch failed:', { url, status: response.status });
      return null;
    }
    return await response.text();
  } catch (error) {
    console.log('[ContentAnalyzer] Fetch error:', { url, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * Check if HTML is an error page
 */
function isErrorPage(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    lower.includes('page not found') ||
    lower.includes('404') ||
    lower.includes('not found') ||
    lower.includes('error 404')
  );
}

/**
 * Extract title from HTML
 */
function extractTitle(html: string): string | null {
  // Try og:title first
  const ogMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (ogMatch) return ogMatch[1].trim();

  // Fall back to <title>
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : null;
}

/**
 * Extract publish date from HTML
 */
function extractPublishDate(html: string): string | null {
  // Check for common date meta tags
  const datePatterns = [
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']date["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']publish-date["'][^>]+content=["']([^"']+)["']/i,
    /<time[^>]+datetime=["']([^"']+)["']/i,
  ];

  for (const pattern of datePatterns) {
    const match = html.match(pattern);
    if (match) {
      try {
        const date = new Date(match[1]);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      } catch {
        // Invalid date, continue
      }
    }
  }

  return null;
}

/**
 * Estimate word count from HTML
 */
function estimateWordCount(html: string): number {
  // Remove scripts, styles, and HTML tags
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return text.split(' ').length;
}

/**
 * Determine content type from path and HTML
 */
function determineContentType(path: string, html: string): CrawledPage['contentType'] {
  const lowerPath = path.toLowerCase();
  const lowerHtml = html.toLowerCase();

  if (lowerPath.includes('case-stud') || lowerPath.includes('success-stor') || lowerPath.includes('customer')) {
    return 'case_study';
  }
  if (lowerPath.includes('blog') || lowerPath.includes('article') || lowerPath.includes('post')) {
    // Check if it's an index or single article
    if (lowerPath === '/blog' || lowerPath === '/blog/' || lowerPath === '/articles' || lowerPath === '/articles/') {
      return 'blog';
    }
    return 'article';
  }
  if (lowerPath.includes('resource') || lowerPath.includes('whitepaper') || lowerPath.includes('ebook')) {
    return 'resource';
  }
  if (lowerPath.includes('guide') || lowerPath.includes('learn') || lowerPath.includes('how-to')) {
    return 'guide';
  }
  if (lowerPath.includes('faq') || lowerPath.includes('help') || lowerPath.includes('support')) {
    return 'faq';
  }
  if (lowerPath.includes('pricing') || lowerPath.includes('plans')) {
    return 'pricing';
  }

  // Check HTML content for clues
  if (lowerHtml.includes('case study') || lowerHtml.includes('success story')) {
    return 'case_study';
  }
  if (lowerHtml.includes('article:published_time') || lowerHtml.includes('blog-post')) {
    return 'article';
  }

  return 'other';
}

/**
 * Extract content-related links from HTML
 */
function extractContentLinks(
  html: string,
  baseUrl: string
): Array<{ url: string; path: string; text: string }> {
  const links: Array<{ url: string; path: string; text: string }> = [];
  const seenPaths = new Set<string>();
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)</gi;

  // Content-related keywords
  const contentKeywords = [
    'blog', 'article', 'news', 'insight', 'resource', 'case', 'study',
    'guide', 'whitepaper', 'ebook', 'faq', 'help', 'learn', 'knowledge',
  ];

  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const text = match[2].trim();

    // Skip external links, anchors, etc.
    if (href.startsWith('http') && !href.startsWith(baseUrl)) continue;
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    if (href.startsWith('javascript:')) continue;

    let path = href;
    if (href.startsWith(baseUrl)) {
      path = href.replace(baseUrl, '') || '/';
    }

    // Normalize path
    path = normalizePath(path);

    // Check if it's a content-related link
    const isContentLink = contentKeywords.some(
      kw => path.toLowerCase().includes(kw) || text.toLowerCase().includes(kw)
    );

    if (!isContentLink) continue;
    if (seenPaths.has(path)) continue;
    seenPaths.add(path);

    links.push({ url: `${baseUrl}${path}`, path, text });
  }

  return links;
}

/**
 * Extract article links from a blog index page
 */
function extractArticleLinks(
  html: string,
  baseUrl: string,
  blogPath: string
): Array<{ url: string; path: string }> {
  const links: Array<{ url: string; path: string }> = [];
  const seenPaths = new Set<string>();
  const linkRegex = /<a[^>]+href=["']([^"']+)["']/gi;

  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];

    // Skip external links
    if (href.startsWith('http') && !href.startsWith(baseUrl)) continue;
    if (href.startsWith('#') || href.startsWith('mailto:')) continue;

    let path = href;
    if (href.startsWith(baseUrl)) {
      path = href.replace(baseUrl, '') || '/';
    }

    path = normalizePath(path);

    // Article links should be under the blog path and have additional segments
    if (!path.startsWith(blogPath) && !path.includes('/blog/') && !path.includes('/post/')) continue;
    if (path === blogPath || path === `${blogPath}/`) continue;
    if (seenPaths.has(path)) continue;

    // Skip pagination, category, tag links
    if (path.includes('/page/') || path.includes('/category/') || path.includes('/tag/')) continue;

    seenPaths.add(path);
    links.push({ url: `${baseUrl}${path}`, path });
  }

  return links;
}

/**
 * Normalize a URL path
 */
function normalizePath(path: string): string {
  let normalized = path.replace(/^\.\//, '/').replace(/^\/\.\//, '/');
  normalized = normalized.replace(/\/\.\//g, '/');
  normalized = normalized.replace(/\/+/g, '/');
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

// ============================================================================
// Topic Extraction V2
// ============================================================================

/**
 * Comprehensive stopwords to filter out from topics
 * Includes generic words, brand fragments, and filler terms
 */
const STOPWORDS = new Set([
  // Articles and prepositions
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'into', 'through', 'during', 'before',
  'after', 'above', 'below', 'between', 'under', 'over',
  // Verbs
  'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can',
  'get', 'got', 'go', 'going', 'gone', 'grow', 'growing', 'grown', 'make', 'making', 'made',
  'take', 'taking', 'took', 'use', 'using', 'used', 'know', 'need', 'want', 'build', 'building',
  // Pronouns and determiners
  'this', 'that', 'these', 'those', 'it', 'its',
  'your', 'our', 'their', 'my', 'his', 'her', 'we', 'you', 'they', 'i',
  'all', 'any', 'some', 'most', 'more', 'less', 'every', 'each',
  // Question words
  'how', 'what', 'when', 'where', 'why', 'which', 'who', 'whom',
  // Adverbs and modifiers
  'not', 'no', 'yes', 'very', 'just', 'only', 'also', 'even', 'still',
  'now', 'then', 'here', 'there', 'about', 'again', 'further', 'once',
  'really', 'actually', 'basically', 'simply', 'easily',
  // Generic content words (filler)
  'best', 'top', 'new', 'great', 'good', 'better', 'important', 'key',
  'guide', 'tips', 'ways', 'things', 'steps', 'complete', 'ultimate',
  'comprehensive', 'definitive', 'essential', 'simple', 'easy', 'quick',
  'free', 'full', 'big', 'small', 'right', 'wrong', 'part', 'parts',
  // Numbers as words
  'one', 'two', 'three', 'four', 'five', 'first', 'second', 'third',
  // Common brand/company fragments (will be supplemented by domain)
  'hive', 'business', 'company', 'companies', 'agency', 'team',
  'client', 'clients', 'customer', 'customers', 'service', 'services',
  // Generic marketing terms
  'marketing', 'strategy', 'growth', 'success', 'results', 'solution', 'solutions',
]);

/**
 * Extract topics from article titles using improved V2 heuristics
 * - Filters out stopwords and brand fragments
 * - Prioritizes 2-3 word phrases over single words
 * - Returns human-readable, meaningful topic clusters
 */
function extractTopicsFromTitles(titles: string[]): string[] {
  if (titles.length === 0) return [];

  const phraseCounts = new Map<string, number>();

  for (const title of titles) {
    // Split on common title separators: | – — : -
    const segments = title
      .toLowerCase()
      .split(/[|–—:-]/)
      .map(s => s.trim())
      .filter(Boolean);

    for (const segment of segments) {
      // Tokenize: remove punctuation, split on spaces
      const tokens = segment
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .map(t => t.trim())
        .filter(t => t.length > 0);

      if (tokens.length === 0) continue;

      // Build 1-3 word n-grams, skipping stopwords
      for (let i = 0; i < tokens.length; i++) {
        for (let len = 1; len <= 3; len++) {
          if (i + len > tokens.length) break;

          const slice = tokens.slice(i, i + len);

          // Filter out stopwords from the phrase
          const meaningful = slice.filter(t => !STOPWORDS.has(t) && t.length > 2);

          // Skip if phrase is all stopwords or too short
          if (meaningful.length === 0) continue;

          // Build the normalized phrase from meaningful words
          const phrase = meaningful.join(' ');

          // Skip very short phrases (less than 4 chars total)
          if (phrase.length < 4) continue;

          // Skip single-word phrases that are too generic
          if (meaningful.length === 1 && phrase.length < 5) continue;

          phraseCounts.set(phrase, (phraseCounts.get(phrase) ?? 0) + 1);
        }
      }
    }
  }

  // Rank by frequency first, then by phrase length (prefer longer phrases)
  const sorted = Array.from(phraseCounts.entries())
    .filter(([phrase, count]) => {
      // Must appear at least twice, or be a multi-word phrase appearing once
      const words = phrase.split(' ').length;
      return count >= 2 || (words >= 2 && count >= 1);
    })
    .sort((a, b) => {
      // Primary sort: frequency (descending)
      if (b[1] !== a[1]) return b[1] - a[1];
      // Secondary sort: phrase length (descending) - prefer multi-word
      return b[0].split(' ').length - a[0].split(' ').length;
    });

  // Deduplicate: if "video marketing" appears, don't also include "video" and "marketing" separately
  const selected: string[] = [];
  const usedWords = new Set<string>();

  for (const [phrase] of sorted) {
    const words = phrase.split(' ');

    // Check if this phrase is mostly already covered by a selected phrase
    const overlapCount = words.filter(w => usedWords.has(w)).length;
    if (overlapCount >= words.length * 0.7) continue;

    selected.push(phrase);

    // Mark words as used
    for (const w of words) {
      usedWords.add(w);
    }

    // Limit to 5 topics
    if (selected.length >= 5) break;
  }

  return selected;
}

// ============================================================================
// GSC Data Fetching
// ============================================================================

interface GscContentData {
  clicks: number;
  impressions: number;
  ctr: number;
}

/**
 * Fetch GSC data for content pages
 * V1: Placeholder - will integrate with actual GSC client
 */
async function fetchGscContentData(
  workspaceId?: string,
  contentUrls?: string[]
): Promise<GscContentData | null> {
  if (!workspaceId || !contentUrls || contentUrls.length === 0) {
    return null;
  }

  // TODO: Integrate with actual GSC client
  // For V1, return null - GSC integration will come in V2
  console.log('[ContentAnalyzer] GSC integration not yet implemented');
  return null;
}

// ============================================================================
// Data Confidence
// ============================================================================

/**
 * Compute data confidence based on crawled data
 */
function computeDataConfidence(
  pageCount: number,
  articleCount: number,
  hasGscData: boolean
): ContentDataConfidence {
  let score = 30; // Base score
  const reasons: string[] = [];

  // Page count contribution
  if (pageCount >= 10) {
    score += 25;
    reasons.push('Good page coverage');
  } else if (pageCount >= 5) {
    score += 15;
    reasons.push('Moderate page coverage');
  } else if (pageCount > 0) {
    score += 5;
    reasons.push('Limited page coverage');
  } else {
    reasons.push('No content pages found');
  }

  // Article count contribution
  if (articleCount >= 10) {
    score += 25;
    reasons.push('Good article sample');
  } else if (articleCount >= 5) {
    score += 15;
    reasons.push('Moderate article sample');
  } else if (articleCount > 0) {
    score += 5;
    reasons.push('Limited article sample');
  }

  // GSC data contribution
  if (hasGscData) {
    score += 20;
    reasons.push('GSC data available');
  }

  // Determine level
  let level: ContentDataConfidence['level'];
  if (score >= 70) {
    level = 'high';
  } else if (score >= 40) {
    level = 'medium';
  } else {
    level = 'low';
  }

  return {
    score: Math.min(100, score),
    level,
    reason: reasons.join('. '),
  };
}

// ============================================================================
// Content Type Presence
// ============================================================================

/**
 * Build content type presence array from pages
 */
function buildContentTypePresence(pages: CrawledPage[]): ContentTypePresence[] {
  const types: ContentTypePresence[] = [];

  const typeMap: Record<string, { type: ContentTypePresence['type']; count: number; urls: string[] }> = {
    blog: { type: 'blog', count: 0, urls: [] },
    article: { type: 'blog', count: 0, urls: [] }, // Group with blog
    case_study: { type: 'case_study', count: 0, urls: [] },
    resource: { type: 'resource', count: 0, urls: [] },
    guide: { type: 'guide', count: 0, urls: [] },
    faq: { type: 'faq', count: 0, urls: [] },
    pricing: { type: 'pricing', count: 0, urls: [] },
  };

  for (const page of pages) {
    if (page.contentType === 'other') continue;

    const key = page.contentType === 'article' ? 'blog' : page.contentType;
    if (typeMap[key]) {
      typeMap[key].count++;
      typeMap[key].urls.push(page.url);
    }
  }

  // Convert to array
  for (const [_, data] of Object.entries(typeMap)) {
    types.push({
      type: data.type,
      present: data.count > 0,
      count: data.count,
      urls: data.urls.slice(0, 5),
    });
  }

  return types;
}
