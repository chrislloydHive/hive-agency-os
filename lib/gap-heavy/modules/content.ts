// lib/gap-heavy/modules/content.ts
// Content Diagnostic Module - Blog & Resource Analysis

import type { CompanyRecord } from '@/lib/airtable/companies';
import type { DiagnosticModuleResult, EvidencePack } from '../types';
import { normalizeDomain } from '../state';
import * as cheerio from 'cheerio';

// ============================================================================
// Types
// ============================================================================

/**
 * Content publishing cadence level
 */
export type ContentCadenceLevel = 'none' | 'low' | 'steady' | 'high';

/**
 * Content freshness assessment
 */
export type ContentFreshnessLevel = 'stale' | 'mixed' | 'fresh';

/**
 * Topic coverage breadth
 */
export type TopicCoverageLevel = 'narrow' | 'focused' | 'broad';

/**
 * Content format classification
 */
export type ContentFormat =
  | 'blog'
  | 'case_study'
  | 'whitepaper'
  | 'guide'
  | 'webinar'
  | 'video'
  | 'podcast'
  | 'other';

/**
 * Legacy Content Piece structure (V1)
 */
export interface ContentPiece {
  url: string;
  title?: string;
  publishDate?: string; // ISO date string or detected date
  type?: 'blog' | 'resource' | 'case-study' | 'unknown';
  wordCount?: number;
}

/**
 * Legacy Content Evidence structure (V1)
 * Kept for backward compatibility
 */
export interface ContentEvidenceData {
  hasBlog: boolean;
  hasResources: boolean;
  estimatedPostCount: number;
  lastDetectedPostDate?: string;
  oldestDetectedPostDate?: string;
  contentPieces: ContentPiece[];
  blogSectionUrl?: string;
  resourceSectionUrl?: string;
  notes: string[];
}

/**
 * Content Evidence V2 - Enhanced Content Strategy Analysis
 *
 * This captures comprehensive content marketing evaluation including:
 * - Content hub discovery and inventory
 * - Publishing cadence and freshness
 * - Topic coverage and strategic gaps
 * - Content depth and expertise signals
 * - Funnel stage mapping
 * - Performance insights (via GA4)
 *
 * V2 UPGRADES:
 * - Cadence and freshness classification
 * - Topic analysis and gap identification
 * - Depth scoring and expertise signals
 * - Funnel stage coverage mapping
 * - GA4 performance insights
 * - Thin content detection
 */
export interface ContentEvidence {
  // ========================================================================
  // Discovery
  // ========================================================================

  /** Whether blog or resources section exists */
  hasBlogOrResources: boolean;

  /** URL of the blog/resources index page */
  // TODO: Populate via navigation link detection
  blogIndexUrl?: string;

  /** Additional content hubs found */
  // TODO: Populate for multiple content sections (resources, guides, etc.)
  contentHubs?: { title: string; url: string }[];

  // ========================================================================
  // Inventory
  // ========================================================================

  /** Estimated total post count */
  // TODO: Extract from blog index or sitemap
  estimatedPostCount?: number;

  /** Recent posts discovered */
  // TODO: Crawl blog index for N most recent posts
  recentPosts?: {
    title: string;
    url: string;
    publishedAt?: string; // ISO date
    format?: ContentFormat;
    estimatedWordCount?: number;
  }[];

  /** Publishing cadence assessment */
  // TODO: Compute from recentPosts dates over last 90 days
  cadenceLevel?: ContentCadenceLevel;

  /** Content freshness assessment */
  // TODO: Based on whether posts exist in last 3-6 months
  freshnessLevel?: ContentFreshnessLevel;

  // ========================================================================
  // Topics & Coverage
  // ========================================================================

  /** Primary content themes */
  // TODO: LLM extraction from post titles/excerpts
  primaryTopics?: string[];

  /** Topic coverage breadth */
  // TODO: LLM assessment of topic diversity
  topicCoverageLevel?: TopicCoverageLevel;

  /** Strategic topic gaps */
  // TODO: LLM identification of missing themes for ICP
  topicGaps?: string[];

  // ========================================================================
  // Depth & Quality
  // ========================================================================

  /** Average word count across content */
  // TODO: Compute from recentPosts word counts
  averageWordCount?: number;

  /** Content depth score (0-100) */
  // TODO: LLM assessment based on word count, structure, specifics
  depthScore?: number;

  /** Expertise signals found */
  // TODO: LLM extraction of signals like "original research", "data", "frameworks"
  expertiseSignals?: string[];

  /** Thin content warnings */
  // TODO: Flag very short posts, promotional-only content, lack of specifics
  thinContentFlags?: string[];

  // ========================================================================
  // Funnel Mapping
  // ========================================================================

  /** Content mapped to funnel stages */
  // TODO: LLM classification of posts by funnel stage
  funnelStageCoverage?: {
    /** Top of funnel (awareness/education) */
    topOfFunnel?: string[]; // titles or urls

    /** Mid funnel (evaluation/comparison) */
    midFunnel?: string[];

    /** Bottom funnel (case studies/ROI/implementation) */
    bottomFunnel?: string[];

    /** Coverage summary notes */
    coverageNotes?: string;
  };

  // ========================================================================
  // Performance Hints (from GA4)
  // ========================================================================

  /** GA4 content performance snapshot */
  // TODO: Match blog URLs to GA4 page data if available
  ga4ContentSnapshot?: {
    /** Total sessions across all content */
    totalContentSessions?: number;

    /** Top performing content pieces */
    topPerformers?: {
      title: string;
      url: string;
      sessions: number;
      conversions?: number;
    }[];

    /** Underperforming content (high traffic, low conversion) */
    underperformers?: {
      title: string;
      url: string;
      sessions: number;
      conversions?: number;
    }[];
  };

  // ========================================================================
  // Overall Score
  // ========================================================================

  /** Overall content score (0-100) */
  // TODO: Compute from cadence, freshness, depth, topic coverage, funnel coverage
  contentScore?: number;
}

// ============================================================================
// Main Content Module Function
// ============================================================================

/**
 * Run Content Module - Analyzes blog posts, resources, and content depth
 *
 * @param input - Company, website URL, and evidence pack
 * @returns DiagnosticModuleResult with content analysis
 */
export async function runContentModule(input: {
  company: CompanyRecord;
  websiteUrl: string;
  evidence: EvidencePack;
}): Promise<DiagnosticModuleResult> {
  const startTime = new Date().toISOString();

  console.log('[Content Module] Starting content diagnostic for:', input.websiteUrl);

  try {
    const domain = normalizeDomain(input.websiteUrl);
    const notes: string[] = [];

    // ========================================================================
    // 1. Discover Blog/Resource Sections
    // ========================================================================

    const { blogUrl, resourceUrl } = await discoverContentSections(input.websiteUrl);

    const hasBlog = !!blogUrl;
    const hasResources = !!resourceUrl;

    if (blogUrl) {
      notes.push(`Found blog section: ${blogUrl}`);
    }
    if (resourceUrl) {
      notes.push(`Found resource section: ${resourceUrl}`);
    }

    // ========================================================================
    // 2. Discover and Analyze Content Pieces
    // ========================================================================

    const contentPieces: ContentPiece[] = [];

    // Analyze blog section
    if (blogUrl) {
      const blogPieces = await discoverContentPieces(blogUrl, domain, 'blog');
      contentPieces.push(...blogPieces);
      notes.push(`Discovered ${blogPieces.length} blog posts`);
    }

    // Analyze resource section
    if (resourceUrl) {
      const resourcePieces = await discoverContentPieces(resourceUrl, domain, 'resource');
      contentPieces.push(...resourcePieces);
      notes.push(`Discovered ${resourcePieces.length} resources`);
    }

    // If no dedicated sections found, try general content discovery
    if (!hasBlog && !hasResources) {
      notes.push('No dedicated blog or resource section found, scanning site for content');
      const generalPieces = await discoverContentFromSitemap(input.websiteUrl, domain);
      contentPieces.push(...generalPieces);
      if (generalPieces.length > 0) {
        notes.push(`Found ${generalPieces.length} potential content pieces via sitemap`);
      }
    }

    // ========================================================================
    // 3. Analyze Content Freshness
    // ========================================================================

    // Extract dates and sort
    const piecesWithDates = contentPieces.filter(p => p.publishDate);
    piecesWithDates.sort((a, b) => {
      const dateA = new Date(a.publishDate!).getTime();
      const dateB = new Date(b.publishDate!).getTime();
      return dateB - dateA; // Most recent first
    });

    const lastDetectedPostDate = piecesWithDates[0]?.publishDate;
    const oldestDetectedPostDate = piecesWithDates[piecesWithDates.length - 1]?.publishDate;

    // ========================================================================
    // 4. Compute Content Score (0-100)
    // ========================================================================

    const score = computeContentScore({
      hasBlog,
      hasResources,
      contentCount: contentPieces.length,
      lastPostDate: lastDetectedPostDate,
    });

    // ========================================================================
    // 5. Generate Insights
    // ========================================================================

    const { summary, issues, recommendations } = generateContentInsights({
      hasBlog,
      hasResources,
      contentCount: contentPieces.length,
      lastPostDate: lastDetectedPostDate,
      score,
    });

    // ========================================================================
    // 6. Store Evidence
    // ========================================================================

    const evidenceData: ContentEvidenceData = {
      hasBlog,
      hasResources,
      estimatedPostCount: contentPieces.length,
      lastDetectedPostDate,
      oldestDetectedPostDate,
      contentPieces: contentPieces.slice(0, 20), // Store first 20
      blogSectionUrl: blogUrl,
      resourceSectionUrl: resourceUrl,
      notes,
    };

    if (!input.evidence.presence) {
      input.evidence.presence = {};
    }
    input.evidence.presence.content = evidenceData;

    const completedTime = new Date().toISOString();

    console.log('[Content Module] Completed with score:', score);

    return {
      module: 'content',
      status: 'completed',
      startedAt: startTime,
      completedAt: completedTime,
      score,
      summary,
      issues,
      recommendations,
      rawEvidence: evidenceData,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Content Module] Error:', errorMsg);

    return {
      module: 'content',
      status: 'failed',
      startedAt: startTime,
      completedAt: new Date().toISOString(),
      score: 0,
      summary: `Content analysis failed: ${errorMsg}`,
      issues: ['Unable to complete content analysis due to technical error'],
      recommendations: ['Retry content analysis after verifying website accessibility'],
      rawEvidence: { error: errorMsg },
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Discover blog and resource sections
 */
async function discoverContentSections(websiteUrl: string): Promise<{
  blogUrl?: string;
  resourceUrl?: string;
}> {
  const commonBlogPaths = [
    '/blog',
    '/blog/',
    '/articles',
    '/articles/',
    '/news',
    '/news/',
    '/insights',
    '/insights/',
    '/posts',
    '/posts/',
  ];

  const commonResourcePaths = [
    '/resources',
    '/resources/',
    '/resource-center',
    '/resource-center/',
    '/library',
    '/library/',
    '/guides',
    '/guides/',
    '/learn',
    '/learn/',
  ];

  let blogUrl: string | undefined;
  let resourceUrl: string | undefined;

  // Check for blog section
  for (const path of commonBlogPaths) {
    try {
      const url = new URL(path, websiteUrl).toString();
      const response = await fetch(url, {
        method: 'HEAD',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HiveGapBot/1.0)' },
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        blogUrl = url;
        break;
      }
    } catch {
      // Continue to next path
    }
  }

  // Check for resource section
  for (const path of commonResourcePaths) {
    try {
      const url = new URL(path, websiteUrl).toString();
      const response = await fetch(url, {
        method: 'HEAD',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HiveGapBot/1.0)' },
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        resourceUrl = url;
        break;
      }
    } catch {
      // Continue to next path
    }
  }

  return { blogUrl, resourceUrl };
}

/**
 * Discover content pieces from a section (blog or resources)
 */
async function discoverContentPieces(
  sectionUrl: string,
  domain: string,
  type: 'blog' | 'resource'
): Promise<ContentPiece[]> {
  const MAX_PIECES = 50;
  const pieces: ContentPiece[] = [];

  try {
    const response = await fetch(sectionUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HiveGapBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return pieces;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Find links that look like blog posts or articles
    $('a[href]').each((_, element) => {
      if (pieces.length >= MAX_PIECES) return false;

      const href = $(element).attr('href');
      if (!href) return;

      try {
        const url = new URL(href, sectionUrl);

        // Only same domain
        if (normalizeDomain(url.hostname) !== domain) return;

        // Skip navigation and common non-content links
        const path = url.pathname.toLowerCase();
        if (
          path === '/' ||
          path.includes('/tag/') ||
          path.includes('/category/') ||
          path.includes('/author/') ||
          path.includes('/page/') ||
          path.endsWith('/feed') ||
          path.endsWith('.xml')
        ) {
          return;
        }

        // Extract title
        const title = $(element).text().trim();

        // Try to extract date from URL or nearby elements
        const publishDate = extractDateFromUrl(url.pathname) || extractDateFromElement($, element);

        // Avoid duplicates
        const exists = pieces.some(p => p.url === url.toString());
        if (!exists && title) {
          pieces.push({
            url: url.toString(),
            title,
            publishDate,
            type,
          });
        }
      } catch {
        // Invalid URL, skip
      }
    });

    return pieces;
  } catch (error) {
    console.warn(`[Content Module] Failed to fetch ${sectionUrl}:`, error);
    return pieces;
  }
}

/**
 * Discover content from sitemap as fallback
 */
async function discoverContentFromSitemap(
  websiteUrl: string,
  domain: string
): Promise<ContentPiece[]> {
  const pieces: ContentPiece[] = [];

  try {
    const sitemapUrl = new URL('/sitemap.xml', websiteUrl).toString();
    const response = await fetch(sitemapUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HiveGapBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return pieces;
    }

    const xml = await response.text();
    const urlMatches = xml.matchAll(/<loc>([^<]+)<\/loc>/gi);

    for (const match of urlMatches) {
      const url = match[1].trim();
      const urlObj = new URL(url);

      if (normalizeDomain(urlObj.hostname) !== domain) continue;

      // Look for blog-like URLs
      const path = urlObj.pathname.toLowerCase();
      if (
        path.includes('/blog/') ||
        path.includes('/article/') ||
        path.includes('/post/') ||
        path.includes('/resource/')
      ) {
        const publishDate = extractDateFromUrl(path);
        const type = path.includes('/resource/') ? 'resource' : 'blog';

        pieces.push({
          url,
          publishDate,
          type,
        });

        if (pieces.length >= 50) break;
      }
    }

    return pieces;
  } catch (error) {
    console.warn('[Content Module] Failed to fetch sitemap:', error);
    return pieces;
  }
}

/**
 * Extract date from URL path
 * Patterns: /2024/01/15/, /blog/2024-01-15-, etc.
 */
function extractDateFromUrl(path: string): string | undefined {
  // Pattern: /YYYY/MM/DD/ or /YYYY/MM/
  const datePattern1 = /\/(\d{4})\/(\d{2})(?:\/(\d{2}))?/;
  const match1 = path.match(datePattern1);
  if (match1) {
    const year = match1[1];
    const month = match1[2];
    const day = match1[3] || '01';
    return `${year}-${month}-${day}`;
  }

  // Pattern: YYYY-MM-DD
  const datePattern2 = /(\d{4})-(\d{2})-(\d{2})/;
  const match2 = path.match(datePattern2);
  if (match2) {
    return `${match2[1]}-${match2[2]}-${match2[3]}`;
  }

  return undefined;
}

/**
 * Extract date from nearby elements (e.g., <time> tags)
 */
function extractDateFromElement($: cheerio.CheerioAPI, element: any): string | undefined {
  // Look for <time> tag near the link
  const timeElement = $(element).closest('article, .post, .entry').find('time[datetime]');
  if (timeElement.length > 0) {
    const datetime = timeElement.attr('datetime');
    if (datetime) {
      // Parse and normalize
      try {
        const date = new Date(datetime);
        return date.toISOString().split('T')[0]; // YYYY-MM-DD
      } catch {
        return undefined;
      }
    }
  }

  return undefined;
}

/**
 * Compute content score based on presence, volume, and freshness (0-100)
 */
function computeContentScore(metrics: {
  hasBlog: boolean;
  hasResources: boolean;
  contentCount: number;
  lastPostDate?: string;
}): number {
  let score = 0;

  // Presence of blog/resources (30 points)
  if (metrics.hasBlog) score += 20;
  if (metrics.hasResources) score += 10;

  // Volume of content (30 points)
  // Scale: 0-30 pieces = 0-30 points
  const volumeScore = Math.min((metrics.contentCount / 30) * 30, 30);
  score += volumeScore;

  // Freshness (40 points)
  if (metrics.lastPostDate) {
    const lastPostTime = new Date(metrics.lastPostDate).getTime();
    const now = Date.now();
    const daysSinceLastPost = (now - lastPostTime) / (1000 * 60 * 60 * 24);

    if (daysSinceLastPost < 30) {
      score += 40; // Very fresh (< 1 month)
    } else if (daysSinceLastPost < 90) {
      score += 30; // Fresh (< 3 months)
    } else if (daysSinceLastPost < 180) {
      score += 20; // Moderate (< 6 months)
    } else if (daysSinceLastPost < 365) {
      score += 10; // Stale (< 1 year)
    }
    // else: Very stale (0 points)
  }

  return Math.round(Math.min(score, 100));
}

/**
 * Generate summary, issues, and recommendations
 */
function generateContentInsights(data: {
  hasBlog: boolean;
  hasResources: boolean;
  contentCount: number;
  lastPostDate?: string;
  score: number;
}): {
  summary: string;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Analyze presence
  if (!data.hasBlog && !data.hasResources) {
    issues.push('No blog or resource section detected on website');
    recommendations.push('Create a blog or resource center to publish valuable content');
    recommendations.push('Start with 5-10 foundational pieces addressing core customer questions');
  } else if (!data.hasBlog) {
    issues.push('No dedicated blog section found');
    recommendations.push('Consider adding a blog to share regular updates and insights');
  }

  // Analyze volume
  if (data.contentCount === 0) {
    issues.push('No content pieces detected');
    recommendations.push('Develop content strategy with editorial calendar');
  } else if (data.contentCount < 10) {
    issues.push(`Limited content volume (${data.contentCount} pieces detected)`);
    recommendations.push('Expand content library to 20-30 pieces covering key topics');
  } else if (data.contentCount < 20) {
    issues.push(`Moderate content volume (${data.contentCount} pieces)`);
    recommendations.push('Continue building content library with consistent publishing schedule');
  }

  // Analyze freshness
  if (data.lastPostDate) {
    const daysSinceLastPost = (Date.now() - new Date(data.lastPostDate).getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceLastPost > 365) {
      issues.push('Content appears stale; no posts detected in the last 12 months');
      recommendations.push('Resume content publishing with 2-4 high-quality posts per month');
      recommendations.push('Update existing content to keep it current and relevant');
    } else if (daysSinceLastPost > 180) {
      issues.push('Content publishing has slowed; no posts in the last 6 months');
      recommendations.push('Establish regular publishing cadence (at least monthly)');
    } else if (daysSinceLastPost > 90) {
      issues.push('Content publishing is inconsistent; no posts in the last 3 months');
      recommendations.push('Commit to more frequent publishing (2-4 posts per month)');
    }
  } else if (data.contentCount > 0) {
    issues.push('Unable to determine content freshness from available data');
    recommendations.push('Add publish dates to content for better tracking');
  }

  // Quality recommendations
  if (data.score < 70) {
    recommendations.push('Focus content on high-value topics that address customer pain points');
    recommendations.push('Optimize existing content for SEO and conversion');
  }

  // Generate summary
  let summaryText = '';

  if (data.score >= 70) {
    summaryText = `Strong content foundation with ${data.hasBlog ? 'blog' : 'resource'} section. `;
  } else if (data.score >= 50) {
    summaryText = `Moderate content presence with ${data.contentCount} pieces detected. `;
  } else if (data.score >= 30) {
    summaryText = `Limited content detected (${data.contentCount} pieces). `;
  } else {
    summaryText = 'Minimal or no content detected. ';
  }

  if (data.lastPostDate) {
    const lastPost = new Date(data.lastPostDate);
    const monthsAgo = Math.round((Date.now() - lastPost.getTime()) / (1000 * 60 * 60 * 24 * 30));

    if (monthsAgo === 0) {
      summaryText += 'Content is very fresh (published this month). ';
    } else if (monthsAgo === 1) {
      summaryText += 'Last content published 1 month ago. ';
    } else {
      summaryText += `Last content published ${monthsAgo} months ago. `;
    }
  } else {
    summaryText += 'Content freshness could not be determined.';
  }

  return {
    summary: summaryText.trim(),
    issues,
    recommendations,
  };
}
