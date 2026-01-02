// lib/gap-heavy/modules/websiteLabImpl.ts
// Website Diagnostics V4/V5 - Implementation
//
// This file contains the concrete implementation of the Website Lab engine.

import * as cheerio from 'cheerio';
import type {
  DiscoveredPage,
  WebsitePageSnapshot,
  WebsitePageType,
  WebsitePageEvidenceV4,
  WebsiteSiteGraphV4,
  SiteGraphEdge,
  WebsiteScreenshotSet,
  PageVisionAnalysis,
  PageIntentAnalysis,
  HeuristicUxSummary,
  HeuristicFinding,
  WebsiteUXLabPersonaResult,
  WebsiteUXAssessmentV4,
  WebsiteUXLabResultV4,
  PersonaType,
  BenchmarkLabel,
} from './websiteLab';
import type { WebsiteEvidenceV3 as _WebsiteEvidenceV3 } from './website';
import { runV5Diagnostic, type V5DiagnosticOutput } from './websiteLabV5';

// ============================================================================
// MULTI-PAGE SPIDER (V4.0)
// ============================================================================

/**
 * Page type patterns for classification
 */
const PAGE_TYPE_PATTERNS: Record<WebsitePageType, { paths: string[]; linkTexts: string[] }> = {
  home: {
    paths: ['/', '/home', '/index'],
    linkTexts: ['home'],
  },
  pricing: {
    paths: ['/pricing', '/plans', '/price', '/packages', '/buy'],
    linkTexts: ['pricing', 'plans', 'price', 'packages', 'buy', 'get started'],
  },
  about: {
    paths: ['/about', '/about-us', '/who-we-are', '/our-story', '/company', '/team'],
    linkTexts: ['about', 'about us', 'who we are', 'our story', 'company', 'team'],
  },
  contact: {
    paths: ['/contact', '/get-in-touch', '/reach-us', '/support', '/help'],
    linkTexts: ['contact', 'get in touch', 'reach us', 'contact us', 'talk to us'],
  },
  product: {
    paths: ['/product', '/products', '/features', '/platform', '/tool', '/app'],
    linkTexts: ['product', 'products', 'features', 'platform', 'tool', 'app', 'solution'],
  },
  service: {
    paths: ['/services', '/what-we-do', '/solutions', '/offerings'],
    linkTexts: ['services', 'what we do', 'solutions', 'offerings'],
  },
  blog: {
    paths: ['/blog', '/articles', '/news', '/insights', '/posts'],
    linkTexts: ['blog', 'articles', 'news', 'insights', 'posts'],
  },
  resource: {
    paths: ['/resources', '/guides', '/help', '/docs', '/documentation', '/library', '/knowledge'],
    linkTexts: ['resources', 'guides', 'help', 'docs', 'documentation', 'library', 'knowledge base'],
  },
  other: {
    paths: [],
    linkTexts: [],
  },
};

/**
 * Classify a URL/path into a page type
 */
function classifyPageType(url: string, linkText?: string): WebsitePageType {
  try {
    const path = new URL(url).pathname.toLowerCase();
    const text = linkText?.toLowerCase() || '';

    // Check each page type
    for (const [type, patterns] of Object.entries(PAGE_TYPE_PATTERNS)) {
      if (type === 'other') continue;

      // Check path patterns
      if (patterns.paths.some(p => path === p || path.startsWith(p + '/'))) {
        return type as WebsitePageType;
      }

      // Check link text patterns
      if (text && patterns.linkTexts.some(t => text.includes(t))) {
        return type as WebsitePageType;
      }
    }

    return 'other';
  } catch {
    // If URL parsing fails, return 'other'
    return 'other';
  }
}

/**
 * Normalize a URL path for comparison
 */
function normalizePath(url: string): string {
  try {
    const urlObj = new URL(url);
    let path = urlObj.pathname;

    // Remove trailing slash except for root
    if (path !== '/' && path.endsWith('/')) {
      path = path.slice(0, -1);
    }

    return path;
  } catch {
    return url;
  }
}

/**
 * Calculate priority score for a discovered page
 * Higher score = more important to analyze
 *
 * Base scores by page type:
 * - home: 100
 * - pricing/contact: 95
 * - product/service: 90
 * - about: 80
 * - blog index: 70
 * - resource: 65
 * - posts/case studies: 60
 * - other: 40
 *
 * Modifiers:
 * - +10 if in main navigation
 * - +5 if in footer navigation
 * - -5 for each level deep in path (e.g., /blog/2023/post = -10)
 */
function calculatePriorityScore(
  type: WebsitePageType,
  inNavigation: boolean,
  pathDepth: number
): number {
  // Base score by type
  const baseScores: Record<WebsitePageType, number> = {
    home: 100,
    pricing: 95,
    contact: 95,
    product: 90,
    service: 90,
    about: 80,
    blog: 70,
    resource: 65,
    other: 40,
  };

  let score = baseScores[type] || 40;

  // Add bonus for navigation presence
  if (inNavigation) {
    score += 10;
  }

  // Penalize deep paths (each level beyond 1 reduces score by 5)
  const depthPenalty = Math.max(0, (pathDepth - 1) * 5);
  score -= depthPenalty;

  // Ensure score stays within 0-100
  return Math.max(0, Math.min(100, score));
}

/**
 * Discover and prioritize pages for analysis
 *
 * NEW V4.2 DISCOVERY ENGINE:
 * - Analyzes 20-40 pages instead of 5-10
 * - Priority-based selection
 * - Multi-level crawl (home + linked pages)
 * - Detects blog posts, case studies, resources
 *
 * @param rootUrl - Homepage URL
 * @param maxPages - Maximum pages to discover (default: 30)
 * @returns Array of discovered pages with priority scores
 */
export async function discoverSiteGraph(
  rootUrl: string,
  maxPages: number = 30
): Promise<DiscoveredPage[]> {
  console.log(`[WebsiteLab V4.2] Discovering site graph from: ${rootUrl} (max: ${maxPages} pages)`);

  const discovered: DiscoveredPage[] = [];
  const seen = new Set<string>();
  const urlObj = new URL(rootUrl);
  const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

  try {
    // Fetch homepage
    const homeResponse = await fetch(rootUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HiveBot/1.0)',
      },
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!homeResponse.ok) {
      throw new Error(`Failed to fetch homepage: ${homeResponse.status}`);
    }

    const homeHtml = await homeResponse.text();
    const $ = cheerio.load(homeHtml);

    // Add homepage
    discovered.push({
      url: rootUrl,
      path: '/',
      type: 'home',
      isPrimary: true,
      priorityScore: 100,
      inNavigation: true,
    });
    seen.add('/'); // Use path for deduplication

    // Extract navigation links (higher priority)
    const navLinks: Array<{ url: string; text: string; path: string }> = [];
    $('nav a[href], header a[href], .nav a[href], .navigation a[href], .menu a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      try {
        const linkUrl = new URL(href, baseUrl);
        if (linkUrl.host !== urlObj.host) return;
        if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

        const path = normalizePath(linkUrl.href);
        const text = $(el).text().trim();

        navLinks.push({ url: linkUrl.href, text, path });
      } catch {
        // Skip malformed URLs
      }
    });

    // Extract all other links (lower priority)
    const contentLinks: Array<{ url: string; text: string; path: string }> = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      try {
        const linkUrl = new URL(href, baseUrl);
        if (linkUrl.host !== urlObj.host) return;
        if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

        const path = normalizePath(linkUrl.href);
        const text = $(el).text().trim();

        // Skip if already in nav links
        if (navLinks.some(nl => nl.url === linkUrl.href)) return;

        contentLinks.push({ url: linkUrl.href, text, path });
      } catch {
        // Skip malformed URLs
      }
    });

    console.log(`[WebsiteLab V4.2] Found ${navLinks.length} nav links, ${contentLinks.length} content links`);

    // Process navigation links first (highest priority)
    for (const link of navLinks) {
      // Dedupe by path (normalized URL path) to avoid duplicate pages
      if (seen.has(link.path)) continue;
      if (discovered.length >= maxPages) break;

      const type = classifyPageType(link.url, link.text);
      const pathDepth = link.path.split('/').filter(Boolean).length;
      const priorityScore = calculatePriorityScore(type, true, pathDepth);

      discovered.push({
        url: link.url,
        path: link.path,
        type,
        isPrimary: ['pricing', 'product', 'service', 'about', 'contact'].includes(type),
        priorityScore,
        linkText: link.text,
        inNavigation: true,
      });

      seen.add(link.path);
    }

    // Process content links (lower priority, but includes blog posts/resources)
    for (const link of contentLinks) {
      // Dedupe by path (normalized URL path) to avoid duplicate pages
      if (seen.has(link.path)) continue;
      if (discovered.length >= maxPages) break;

      const type = classifyPageType(link.url, link.text);
      const pathDepth = link.path.split('/').filter(Boolean).length;
      const priorityScore = calculatePriorityScore(type, false, pathDepth);

      discovered.push({
        url: link.url,
        path: link.path,
        type,
        isPrimary: false,
        priorityScore,
        linkText: link.text,
        inNavigation: false,
      });

      seen.add(link.path);
    }

    // Sort by priority score (highest first) and cap at maxPages
    discovered.sort((a, b) => b.priorityScore - a.priorityScore);
    const finalPages = discovered.slice(0, maxPages);

    // Log statistics
    const typeStats = finalPages.reduce((acc, page) => {
      acc[page.type] = (acc[page.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log(`[WebsiteLab V4.2] Discovered ${finalPages.length} pages:`, typeStats);
    console.log(`[WebsiteLab V4.2] Primary pages: ${finalPages.filter(p => p.isPrimary).length}`);
    console.log(`[WebsiteLab V4.2] Nav pages: ${finalPages.filter(p => p.inNavigation).length}`);

    return finalPages;
  } catch (error) {
    console.error('[WebsiteLab V4.2] Site graph discovery error:', error);

    // Fallback: return just homepage
    if (discovered.length > 0) {
      return discovered;
    }

    throw error;
  }
}

/**
 * Fetch HTML content for discovered pages in batches
 *
 * @param discoveredPages - Pages to fetch HTML for
 * @param batchSize - Number of concurrent requests (default: 5)
 * @returns Array of page snapshots with HTML content
 */
export async function fetchPagesHTML(
  discoveredPages: DiscoveredPage[],
  batchSize: number = 5
): Promise<WebsitePageSnapshot[]> {
  console.log(`[WebsiteLab V4.2] Fetching HTML for ${discoveredPages.length} pages (batch size: ${batchSize})`);

  const snapshots: WebsitePageSnapshot[] = [];
  const failures: string[] = [];

  // Process in batches to avoid overwhelming the server
  for (let i = 0; i < discoveredPages.length; i += batchSize) {
    const batch = discoveredPages.slice(i, i + batchSize);
    console.log(`[WebsiteLab V4.2] Fetching batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(discoveredPages.length / batchSize)}`);

    const batchPromises = batch.map(async (page) => {
      try {
        const response = await fetch(page.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; HiveBot/1.0)',
          },
          signal: AbortSignal.timeout(15000), // 15 second timeout per page
        });

        if (!response.ok) {
          console.warn(`[WebsiteLab V4.2] Failed to fetch ${page.path}: ${response.status}`);
          failures.push(page.url);
          return null;
        }

        const html = await response.text();

        return {
          url: page.url,
          type: page.type,
          html,
          path: page.path,
          isPrimary: page.isPrimary,
          priorityScore: page.priorityScore,
        } as WebsitePageSnapshot;
      } catch (error) {
        console.warn(`[WebsiteLab V4.2] Error fetching ${page.path}:`, error);
        failures.push(page.url);
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    snapshots.push(...batchResults.filter((s): s is WebsitePageSnapshot => s !== null));

    // Small delay between batches to be polite
    if (i + batchSize < discoveredPages.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`[WebsiteLab V4.2] Successfully fetched ${snapshots.length}/${discoveredPages.length} pages`);
  if (failures.length > 0) {
    console.log(`[WebsiteLab V4.2] Failed pages (${failures.length}):`, failures.slice(0, 5));
  }

  // Safety check: ensure we have at least some pages
  if (snapshots.length === 0 && discoveredPages.length > 0) {
    console.error('[WebsiteLab V4.2] WARNING: Failed to fetch HTML for ALL pages');
    throw new Error('Failed to fetch HTML for any discovered pages');
  }

  return snapshots;
}

/**
 * Analyze a single page (for parallel processing)
 *
 * @param snapshot - Page snapshot with HTML
 * @returns Page evidence
 */
export async function analyzePage(
  snapshot: WebsitePageSnapshot
): Promise<WebsitePageEvidenceV4> {
  console.log(`[WebsiteLab V4.2] Analyzing page: ${snapshot.path} (${snapshot.type})`);

  // Reuse existing extractPageEvidence function
  return await extractPageEvidence(snapshot);
}

/**
 * Discover key pages from homepage (LEGACY - kept for backwards compatibility)
 *
 * Strategy:
 * 1. Fetch homepage HTML
 * 2. Extract all internal links
 * 3. Classify links by type (pricing, about, contact, etc.)
 * 4. Select one representative per type (prefer shorter paths)
 * 5. Cap at ~7-10 pages total
 * 6. Fetch HTML for each discovered page
 *
 * @param websiteUrl - Homepage URL
 * @param maxPages - Maximum pages to fetch (default: 10)
 * @returns Array of page snapshots
 */
export async function discoverPages(
  websiteUrl: string,
  _maxPages: number = 10
): Promise<WebsitePageSnapshot[]> {
  console.log('[WebsiteLab V4] Discovering pages from:', websiteUrl);

  const snapshots: WebsitePageSnapshot[] = [];
  const urlObj = new URL(websiteUrl);
  const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

  try {
    // Fetch homepage
    const homeResponse = await fetch(websiteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HiveBot/1.0)',
      },
    });

    if (!homeResponse.ok) {
      throw new Error(`Failed to fetch homepage: ${homeResponse.status}`);
    }

    const homeHtml = await homeResponse.text();
    const $ = cheerio.load(homeHtml);

    // Add homepage as primary page
    snapshots.push({
      url: websiteUrl,
      type: 'home',
      html: homeHtml,
      path: '/',
      isPrimary: true,
    });

    // Extract all internal links
    const links: Array<{ url: string; text: string; path: string }> = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      try {
        // Resolve relative URLs
        const linkUrl = new URL(href, baseUrl);

        // Skip external links
        if (linkUrl.host !== urlObj.host) return;

        // Skip anchors, javascript, mailto, tel
        if (
          linkUrl.pathname === urlObj.pathname ||
          href.startsWith('#') ||
          href.startsWith('javascript:') ||
          href.startsWith('mailto:') ||
          href.startsWith('tel:')
        ) {
          return;
        }

        const path = normalizePath(linkUrl.href);
        const text = $(el).text().trim();

        links.push({
          url: linkUrl.href,
          text,
          path,
        });
      } catch {
        // Skip malformed URLs
      }
    });

    console.log(`[WebsiteLab V4] Found ${links.length} internal links`);

    // Group links by type
    const linksByType: Map<WebsitePageType, typeof links> = new Map();

    for (const link of links) {
      const type = classifyPageType(link.url, link.text);
      if (!linksByType.has(type)) {
        linksByType.set(type, []);
      }
      linksByType.get(type)!.push(link);
    }

    // Select one representative per type (prefer shorter paths)
    const priorityTypes: WebsitePageType[] = [
      'pricing',
      'product',
      'service',
      'about',
      'contact',
      'resource',
      'blog',
    ];

    const selectedUrls = new Set<string>();
    selectedUrls.add(websiteUrl); // Already added homepage

    for (const type of priorityTypes) {
      const candidates = linksByType.get(type) || [];
      if (candidates.length === 0) continue;

      // Sort by path length (prefer shorter paths)
      candidates.sort((a, b) => a.path.length - b.path.length);

      const selected = candidates[0];
      if (!selectedUrls.has(selected.url)) {
        selectedUrls.add(selected.url);

        // Fetch this page
        try {
          const pageResponse = await fetch(selected.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; HiveBot/1.0)',
            },
          });

          if (pageResponse.ok) {
            const pageHtml = await pageResponse.text();
            snapshots.push({
              url: selected.url,
              type,
              html: pageHtml,
              path: selected.path,
              isPrimary: ['pricing', 'product', 'service', 'about', 'contact'].includes(type),
            });

            console.log(`[WebsiteLab V4] Added ${type} page: ${selected.path}`);
          }
        } catch (err) {
          console.warn(`[WebsiteLab V4] Failed to fetch ${type} page:`, selected.url, err);
        }
      }

      // Cap at 10 pages total
      if (snapshots.length >= 10) break;
    }

    console.log(`[WebsiteLab V4] Discovered ${snapshots.length} pages`);
    return snapshots;
  } catch (error) {
    console.error('[WebsiteLab V4] Page discovery error:', error);

    // Fallback: return just homepage
    if (snapshots.length > 0) {
      return snapshots;
    }

    throw error;
  }
}

// ============================================================================
// PER-PAGE EVIDENCE EXTRACTION (V4.1)
// ============================================================================

/**
 * Extract evidence from a single page
 *
 * Refactors existing V3 evidence extraction to work per-page instead of
 * just homepage.
 *
 * @param snapshot - Page snapshot with HTML
 * @returns Page evidence with V3 data
 */
export async function extractPageEvidence(
  snapshot: WebsitePageSnapshot
): Promise<WebsitePageEvidenceV4> {
  console.log(`[WebsiteLab V4] Extracting evidence for: ${snapshot.path}`);

  try {
    // Dynamic import to avoid circular dependency
    const { extractWebsiteEvidenceV3 } = await import('./website');

    // Use existing V3 extraction function
    // NOTE: This function expects a URL but we'll pass it our snapshot data
    const evidenceV3 = await extractWebsiteEvidenceV3(snapshot.url);

    // Create V4 page evidence
    const pageEvidence: WebsitePageEvidenceV4 = {
      url: snapshot.url,
      path: snapshot.path,
      type: snapshot.type,
      title: evidenceV3.pageTitle,
      isPrimary: snapshot.isPrimary || false,
      evidenceV3,
      // Vision, intent, and funnel stage will be added later
    };

    return pageEvidence;
  } catch (error) {
    console.error(`[WebsiteLab V4] Evidence extraction error for ${snapshot.path}:`, error);
    throw error;
  }
}

// ============================================================================
// SITE GRAPH CONSTRUCTOR (V4.2)
// ============================================================================

/**
 * Build site graph from page evidences
 *
 * Constructs a graph showing:
 * - All analyzed pages
 * - Links between pages (edges)
 * - Primary entry path
 *
 * @param pages - All page evidences
 * @returns Site graph
 */
export function buildSiteGraph(pages: WebsitePageEvidenceV4[]): WebsiteSiteGraphV4 {
  console.log(`[WebsiteLab V4] Building site graph from ${pages.length} pages`);

  const edges: SiteGraphEdge[] = [];
  const pathSet = new Set(pages.map(p => p.path));

  // For each page, extract links to other known pages
  for (const page of pages) {
    try {
      const $ = cheerio.load(page.evidenceV3.rawHtml);

      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;

        try {
          const linkUrl = new URL(href, page.url);
          const linkPath = normalizePath(linkUrl.href);

          // Only create edges to known pages
          if (pathSet.has(linkPath) && linkPath !== page.path) {
            const linkText = $(el).text().trim();

            edges.push({
              fromPath: page.path,
              toPath: linkPath,
              linkText: linkText || undefined,
            });
          }
        } catch {
          // Skip malformed URLs
        }
      });
    } catch (err) {
      console.warn(`[WebsiteLab V4] Failed to extract links from ${page.path}:`, err);
    }
  }

  // Find primary entry (home page)
  const homePage = pages.find(p => p.type === 'home');
  const primaryEntryPath = homePage?.path || '/';

  console.log(`[WebsiteLab V4] Built site graph: ${pages.length} pages, ${edges.length} edges`);

  return {
    pages,
    edges,
    primaryEntryPath,
  };
}

// ============================================================================
// PLACEHOLDER IMPLEMENTATIONS (To be completed)
// ============================================================================

/**
 * Capture screenshots for pages
 *
 * TODO: Integrate with browserless service or headless browser
 * For now, returns empty array
 */
export async function captureScreenshots(
  _pages: WebsitePageSnapshot[]
): Promise<WebsiteScreenshotSet[]> {
  console.log(`[WebsiteLab V4] Screenshot capture not yet implemented`);
  // TODO: Implement screenshot capture
  // - Use puppeteer/playwright or browserless service
  // - Capture desktop (1920x1080) and mobile (375x667) viewports
  // - Store images in cloud storage or base64
  return [];
}

/**
 * Analyze screenshots with vision LLM
 *
 * TODO: Implement vision analysis with GPT-4 Vision or similar
 * For now, returns empty map
 */
export async function analyzeVision(
  _screenshotSets: WebsiteScreenshotSet[]
): Promise<Map<string, PageVisionAnalysis>> {
  console.log(`[WebsiteLab V4] Vision analysis not yet implemented`);
  // TODO: Implement vision analysis
  // - Call GPT-4 Vision with screenshot
  // - Extract visual clarity, whitespace, layout density
  // - Return PageVisionAnalysis for each page
  return new Map();
}

// ============================================================================
// FUNNEL MAPPING ENGINE (V4.3)
// ============================================================================

/**
 * Map conversion funnels and detect dead ends
 *
 * Identifies conversion-oriented paths through the site and calculates
 * funnel health based on:
 * - Existence of clear conversion paths
 * - Number of steps to conversion
 * - Presence of dead ends
 * - CTA availability at each step
 *
 * @param siteGraph - Site graph
 * @returns Funnel health score, dead ends, and identified funnel paths
 */
export function mapConversionFunnels(siteGraph: WebsiteSiteGraphV4): {
  funnelHealthScore: number;
  deadEnds: string[];
  funnelPaths: string[][];
} {
  console.log(`[WebsiteLab V4] Mapping conversion funnels`);

  const { pages, edges } = siteGraph;

  // Identify conversion endpoints (pages with strong conversion intent)
  const conversionEndpoints = pages.filter(
    p =>
      p.type === 'contact' ||
      p.type === 'pricing' ||
      p.evidenceV3.conversionFlow.conversionIntent !== null
  );

  // Identify dead ends (pages with no outgoing links to other known pages)
  const deadEnds: string[] = [];
  for (const page of pages) {
    const hasOutgoingLinks = edges.some(e => e.fromPath === page.path);
    const hasCta = page.evidenceV3.hero.hasPrimaryCta;

    // Dead end if no outgoing links AND no clear CTA
    if (!hasOutgoingLinks && !hasCta && page.type !== 'contact') {
      deadEnds.push(page.path);
    }
  }

  // Identify funnel paths (e.g., Home → Product → Pricing → Contact)
  const funnelPaths: string[][] = [];
  const homePage = pages.find(p => p.type === 'home');

  if (homePage) {
    // Simple BFS to find paths from home to conversion endpoints
    for (const endpoint of conversionEndpoints) {
      const path = findShortestPath(homePage.path, endpoint.path, edges);
      if (path && path.length > 1) {
        funnelPaths.push(path);
      }
    }
  }

  // Calculate funnel health score (0-100)
  let funnelHealthScore = 50; // Base score

  // Reward: Having at least one clear funnel path
  if (funnelPaths.length > 0) {
    funnelHealthScore += 20;
  }

  // Reward: Short funnel paths (≤3 steps)
  const shortPaths = funnelPaths.filter(p => p.length <= 3);
  if (shortPaths.length > 0) {
    funnelHealthScore += 15;
  }

  // Penalize: Dead ends on primary pages
  const primaryDeadEnds = deadEnds.filter(path =>
    pages.find(p => p.path === path && p.isPrimary)
  );
  funnelHealthScore -= primaryDeadEnds.length * 10;

  // Penalize: No conversion endpoints found
  if (conversionEndpoints.length === 0) {
    funnelHealthScore -= 30;
  }

  // Reward: Multiple conversion endpoints
  if (conversionEndpoints.length >= 2) {
    funnelHealthScore += 10;
  }

  // Clamp to 0-100
  funnelHealthScore = Math.max(0, Math.min(100, funnelHealthScore));

  console.log(`[WebsiteLab V4] Funnel health: ${funnelHealthScore}, Dead ends: ${deadEnds.length}, Paths: ${funnelPaths.length}`);

  return {
    funnelHealthScore,
    deadEnds,
    funnelPaths,
  };
}

/**
 * Find shortest path between two pages using BFS
 */
function findShortestPath(
  fromPath: string,
  toPath: string,
  edges: SiteGraphEdge[]
): string[] | null {
  const queue: { path: string; trail: string[] }[] = [{ path: fromPath, trail: [fromPath] }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { path, trail } = queue.shift()!;

    if (path === toPath) {
      return trail;
    }

    if (visited.has(path)) continue;
    visited.add(path);

    // Find outgoing edges
    const outgoing = edges.filter(e => e.fromPath === path);
    for (const edge of outgoing) {
      if (!visited.has(edge.toPath)) {
        queue.push({
          path: edge.toPath,
          trail: [...trail, edge.toPath],
        });
      }
    }
  }

  return null;
}

// ============================================================================
// INTENT CLASSIFICATION ENGINE (V4.4)
// ============================================================================

/**
 * Classify intent for each page using LLM
 *
 * Uses OpenAI to analyze each page's content and classify:
 * - Primary intent (educate, convert, compare, etc.)
 * - Clarity score (0-100)
 * - Misalignment notes
 *
 * @param pages - Page evidences
 * @returns Intent classifications per page
 */
export async function classifyPageIntents(
  pages: WebsitePageEvidenceV4[]
): Promise<Map<string, PageIntentAnalysis>> {
  console.log(`[WebsiteLab V4] Classifying page intents for ${pages.length} pages`);

  // TODO: Implement LLM-based intent classification
  // For now, use heuristic-based classification

  const intentMap = new Map<string, PageIntentAnalysis>();

  for (const page of pages) {
    let primaryIntent: PageIntentAnalysis['primaryIntent'] = 'other';
    let clarityScore = 50;
    const misalignmentNotes: string[] = [];

    // Heuristic classification based on page type
    switch (page.type) {
      case 'home':
        primaryIntent = 'explore';
        clarityScore = page.evidenceV3.valueProp.clarityFlags.length === 0 ? 75 : 50;
        break;
      case 'pricing':
        primaryIntent = 'convert';
        clarityScore = page.evidenceV3.hero.hasPrimaryCta ? 80 : 60;
        if (!page.evidenceV3.hero.hasPrimaryCta) {
          misalignmentNotes.push('Pricing page lacks clear CTA');
        }
        break;
      case 'product':
      case 'service':
        primaryIntent = 'educate';
        clarityScore = 70;
        break;
      case 'about':
        primaryIntent = 'validate';
        clarityScore = 65;
        break;
      case 'contact':
        primaryIntent = 'convert';
        clarityScore = 85;
        break;
      case 'blog':
      case 'resource':
        primaryIntent = 'educate';
        clarityScore = 60;
        break;
      default:
        primaryIntent = 'other';
        clarityScore = 50;
    }

    intentMap.set(page.path, {
      primaryIntent,
      clarityScore,
      misalignmentNotes,
    });
  }

  return intentMap;
}

// ============================================================================
// HEURISTIC UX EVALUATOR (V4.5)
// ============================================================================

/**
 * Run heuristic UX evaluation
 *
 * Applies rule-based checks inspired by Nielsen, Baymard, CXL heuristics:
 * - Primary CTA presence
 * - Trust signals
 * - Navigation depth
 * - Pricing accessibility
 * - Contact availability
 * - Mobile-friendliness
 *
 * @param siteGraph - Site graph
 * @returns Heuristic findings and score
 */
export function evaluateHeuristics(siteGraph: WebsiteSiteGraphV4): HeuristicUxSummary {
  console.log(`[WebsiteLab V4] Running heuristic UX evaluation`);

  const { pages, edges } = siteGraph;
  const findings: HeuristicFinding[] = [];
  let totalDeductions = 0;

  const homePage = pages.find(p => p.type === 'home');
  const pricingPage = pages.find(p => p.type === 'pricing');
  const primaryPages = pages.filter(p => p.isPrimary);

  // Rule 1: No primary CTA on homepage
  if (homePage && !homePage.evidenceV3.hero.hasPrimaryCta) {
    findings.push({
      id: 'no-home-cta',
      rule: 'Primary CTA on Homepage',
      severity: 'high',
      description: 'Homepage lacks a clear primary call-to-action above the fold',
      pagePath: homePage.path,
    });
    totalDeductions += 15;
  }

  // Rule 2: No trust signals on primary pages
  const pagesWithoutTrust = primaryPages.filter(p => p.evidenceV3.trust.trustDensity === 0);
  if (pagesWithoutTrust.length > 0) {
    findings.push({
      id: 'no-trust-signals',
      rule: 'Trust Signals on Key Pages',
      severity: 'high',
      description: `${pagesWithoutTrust.length} primary page(s) lack trust signals (testimonials, logos, proof statements)`,
    });
    totalDeductions += 15;
  }

  // Rule 3: Pricing is more than 3 clicks away from home
  if (homePage && pricingPage) {
    const pathToPricing = findShortestPath(homePage.path, pricingPage.path, edges);
    if (pathToPricing && pathToPricing.length > 3) {
      findings.push({
        id: 'pricing-too-deep',
        rule: 'Pricing Accessibility',
        severity: 'medium',
        description: `Pricing page is ${pathToPricing.length} clicks away from homepage (should be ≤3)`,
        pagePath: pricingPage.path,
      });
      totalDeductions += 10;
    }
  }

  // Rule 4: No Contact/Get in touch in navigation
  const hasContactInNav = pages.some(p =>
    p.evidenceV3.navigation.links.some(link =>
      /contact|get in touch|talk to us/i.test(link)
    )
  );
  if (!hasContactInNav) {
    findings.push({
      id: 'no-contact-nav',
      rule: 'Contact in Navigation',
      severity: 'medium',
      description: 'No "Contact" or "Get in touch" link found in main navigation',
    });
    totalDeductions += 10;
  }

  // Rule 5: More than 8 nav items
  if (homePage && homePage.evidenceV3.navigation.links.length > 8) {
    findings.push({
      id: 'nav-overload',
      rule: 'Navigation Cognitive Load',
      severity: 'medium',
      description: `Navigation has ${homePage.evidenceV3.navigation.links.length} items (recommended: ≤8 for cognitive load)`,
      pagePath: homePage.path,
    });
    totalDeductions += 8;
  }

  // Rule 6: No bottom-of-page CTA on key pages
  const keyPagesWithoutBottomCta = primaryPages.filter(p => {
    // Check if conversionFlow has any CTAs
    return p.evidenceV3.conversionFlow.pathsDetected.length === 0;
  });
  if (keyPagesWithoutBottomCta.length > 0) {
    findings.push({
      id: 'no-bottom-cta',
      rule: 'Bottom-of-Page CTA',
      severity: 'medium',
      description: `${keyPagesWithoutBottomCta.length} key page(s) lack clear conversion paths`,
    });
    totalDeductions += 8;
  }

  // Rule 7: Very low readability on home
  if (homePage && homePage.evidenceV3.visual.readabilityScore < 40) {
    findings.push({
      id: 'low-readability',
      rule: 'Text Readability',
      severity: 'high',
      description: `Homepage has poor readability score (${homePage.evidenceV3.visual.readabilityScore}/100)`,
      pagePath: homePage.path,
    });
    totalDeductions += 12;
  }

  // Rule 8: Mobile issues detected on homepage
  if (homePage && homePage.evidenceV3.visual.mobileIssuesDetected.length > 0) {
    findings.push({
      id: 'mobile-issues',
      rule: 'Mobile Responsiveness',
      severity: 'medium',
      description: `Mobile issues detected: ${homePage.evidenceV3.visual.mobileIssuesDetected.join(', ')}`,
      pagePath: homePage.path,
    });
    totalDeductions += 10;
  }

  // Calculate overall heuristic score (start at 100, deduct for each finding)
  const overallScore = Math.max(0, 100 - totalDeductions);

  console.log(`[WebsiteLab V4] Heuristic evaluation: ${findings.length} findings, score: ${overallScore}`);

  return {
    findings,
    overallScore,
  };
}

// ============================================================================
// PERSONA SIMULATION ENGINE (V4.6)
// ============================================================================

/**
 * Simulate persona behaviors on the site
 *
 * Uses LLM to role-play different user personas and simulate their journey:
 * - First-time visitor
 * - Ready-to-buy
 * - Researcher
 * - Comparison shopper
 * - Mobile user
 *
 * @param siteGraph - Site graph
 * @returns Persona simulation results
 */
export async function simulatePersonas(
  siteGraph: WebsiteSiteGraphV4
): Promise<WebsiteUXLabPersonaResult[]> {
  console.log(`[WebsiteLab V4] Simulating persona behaviors`);

  // TODO: Implement LLM-based persona simulation
  // For now, use heuristic-based simulation

  const personas: Array<{ persona: PersonaType; goal: string }> = [
    {
      persona: 'first_time',
      goal: 'Understand what this company does and whether it\'s relevant to me',
    },
    {
      persona: 'ready_to_buy',
      goal: 'Find pricing or a way to sign up/book a demo quickly',
    },
    {
      persona: 'researcher',
      goal: 'Understand details, features, and how it compares to alternatives',
    },
    {
      persona: 'comparison_shopper',
      goal: 'See why this is different/better than competitors',
    },
    {
      persona: 'mobile_user',
      goal: 'Do all of the above on a small screen with limited patience',
    },
  ];

  const results: WebsiteUXLabPersonaResult[] = [];

  for (const { persona, goal } of personas) {
    const result = simulatePersona(persona, goal, siteGraph);
    results.push(result);
  }

  return results;
}

/**
 * Simulate a single persona's journey (heuristic-based)
 */
function simulatePersona(
  persona: PersonaType,
  goal: string,
  siteGraph: WebsiteSiteGraphV4
): WebsiteUXLabPersonaResult {
  const { pages, edges } = siteGraph;
  const homePage = pages.find(p => p.type === 'home');

  let success = false;
  let perceivedClarityScore = 50;
  const frictionNotes: string[] = [];
  const stepsTaken: string[] = [];
  let timeToGoalEstimate = 0;

  if (!homePage) {
    return {
      persona,
      goal,
      success: false,
      perceivedClarityScore: 0,
      frictionNotes: ['Could not find homepage'],
      stepsTaken: [],
      timeToGoalEstimate: 0,
    };
  }

  stepsTaken.push(homePage.path);
  timeToGoalEstimate++;

  switch (persona) {
    case 'first_time':
      // Check if homepage clearly explains what the company does
      if (homePage.evidenceV3.valueProp.text && homePage.evidenceV3.valueProp.clarityFlags.length === 0) {
        success = true;
        perceivedClarityScore = 80;
      } else {
        success = false;
        perceivedClarityScore = 40;
        frictionNotes.push('Value proposition unclear or missing');
      }
      timeToGoalEstimate += 1;
      break;

    case 'ready_to_buy': {
      // Try to find pricing or contact quickly
      const pricingPage = pages.find(p => p.type === 'pricing');
      const contactPage = pages.find(p => p.type === 'contact');

      if (pricingPage) {
        const pathToPricing = findShortestPath(homePage.path, pricingPage.path, edges);
        if (pathToPricing && pathToPricing.length <= 2) {
          success = true;
          perceivedClarityScore = 85;
          stepsTaken.push(...pathToPricing.slice(1));
          timeToGoalEstimate += pathToPricing.length - 1;
        } else {
          success = false;
          perceivedClarityScore = 50;
          frictionNotes.push('Pricing not easily accessible from homepage');
          timeToGoalEstimate += 3;
        }
      } else if (contactPage) {
        stepsTaken.push(contactPage.path);
        success = true;
        perceivedClarityScore = 70;
        timeToGoalEstimate += 2;
      } else {
        success = false;
        perceivedClarityScore = 30;
        frictionNotes.push('No clear path to pricing or contact');
        timeToGoalEstimate += 5;
      }
      break;
    }

    case 'researcher': {
      // Look for product/service details
      const productPage = pages.find(p => p.type === 'product' || p.type === 'service');
      if (productPage) {
        stepsTaken.push(productPage.path);
        success = true;
        perceivedClarityScore = 75;
        timeToGoalEstimate += 2;
      } else {
        success = false;
        perceivedClarityScore = 45;
        frictionNotes.push('No dedicated product/service page found');
        timeToGoalEstimate += 4;
      }
      break;
    }

    case 'comparison_shopper':
      // Look for features, benefits, case studies
      if (homePage.evidenceV3.structure.hasFeaturesSection && homePage.evidenceV3.structure.hasSocialProofSection) {
        success = true;
        perceivedClarityScore = 70;
      } else {
        success = false;
        perceivedClarityScore = 45;
        frictionNotes.push('Lacks clear differentiation or social proof');
      }
      timeToGoalEstimate += 3;
      break;

    case 'mobile_user':
      // Check mobile issues
      if (homePage.evidenceV3.visual.mobileIssuesDetected.length > 0) {
        success = false;
        perceivedClarityScore = 35;
        frictionNotes.push(...homePage.evidenceV3.visual.mobileIssuesDetected);
      } else {
        success = true;
        perceivedClarityScore = 65;
      }
      timeToGoalEstimate += 2;
      break;
  }

  return {
    persona,
    goal,
    success,
    perceivedClarityScore,
    frictionNotes,
    stepsTaken,
    timeToGoalEstimate,
  };
}

// ============================================================================
// V4 SCORING FUNCTIONS REMOVED
// ============================================================================
// generateConsultantReportContent() and generateSiteAssessment() have been
// removed. V5 is the ONLY canonical implementation.
// siteAssessment is now built directly from v5Diagnostic in runWebsiteLab().

// ============================================================================
// MAIN ORCHESTRATOR (V4.8)
// ============================================================================

/**
 * Run complete Website Lab analysis (V4/V5)
 *
 * This is the main entry point that orchestrates all V4/V5 components:
 * 1. Discover pages from homepage
 * 2. Extract evidence per page
 * 3. Build site graph
 * 4. Map conversion funnels
 * 5. Classify page intents
 * 6. Run heuristic evaluation
 * 7. Simulate personas
 * 8. Generate final site assessment
 *
 * @param websiteUrl - Homepage URL
 * @param options - Optional analytics integration credentials
 * @returns Complete Website UX Lab Result
 */
/**
 * Brain context passed from the outer runner
 */
export interface BrainContextForLab {
  identitySummary?: string;
  objectivesSummary?: string;
  audienceSummary?: string;
  brandSummary?: string;
  constraints?: string;
  contextIntegrity?: 'high' | 'medium' | 'low' | 'none';
  confidenceCap?: number;
}

export async function runWebsiteLab(
  websiteUrl: string,
  options?: {
    ga4PropertyId?: string;
    searchConsoleSiteUrl?: string;
    brainContext?: BrainContextForLab;
  }
): Promise<WebsiteUXLabResultV4> {
  console.log('[WebsiteLab V4] ============================================');
  console.log('[WebsiteLab V4] STARTING FLAGSHIP UX & CONVERSION LAB');
  console.log('[WebsiteLab V4] URL:', websiteUrl);
  console.log('[WebsiteLab V4] ============================================');

  try {
    // ========================================================================
    // STEP 1: Discover Pages
    // ========================================================================
    console.log('[WebsiteLab V4] Step 1/8: Discovering pages...');
    const pageSnapshots = await discoverPages(websiteUrl, 30); // Increased from default 10 to 30
    console.log(`[WebsiteLab V4] ✓ Discovered ${pageSnapshots.length} pages`);

    // ========================================================================
    // STEP 2: Extract Evidence Per Page
    // ========================================================================
    console.log('[WebsiteLab V4] Step 2/8: Extracting evidence per page...');
    const pageEvidences: WebsitePageEvidenceV4[] = [];

    for (const snapshot of pageSnapshots) {
      const evidence = await extractPageEvidence(snapshot);
      pageEvidences.push(evidence);
    }
    console.log(`[WebsiteLab V4] ✓ Extracted evidence for ${pageEvidences.length} pages`);

    // ========================================================================
    // STEP 3: Build Site Graph
    // ========================================================================
    console.log('[WebsiteLab V4] Step 3/8: Building site graph...');
    const siteGraph = buildSiteGraph(pageEvidences);
    console.log(`[WebsiteLab V4] ✓ Built site graph: ${siteGraph.pages.length} pages, ${siteGraph.edges.length} edges`);

    // ========================================================================
    // STEP 4: Classify Page Intents
    // ========================================================================
    console.log('[WebsiteLab V4] Step 4/8: Classifying page intents...');
    const intentMap = await classifyPageIntents(pageEvidences);

    // Attach intent to pages
    for (const page of siteGraph.pages) {
      const intent = intentMap.get(page.path);
      if (intent) {
        page.pageIntent = intent;

        // Also assign funnel stage based on intent
        if (intent.primaryIntent === 'explore') page.funnelStage = 'awareness';
        else if (intent.primaryIntent === 'educate') page.funnelStage = 'consideration';
        else if (intent.primaryIntent === 'convert') page.funnelStage = 'decision';
        else if (intent.primaryIntent === 'validate') page.funnelStage = 'consideration';
        else if (intent.primaryIntent === 'compare') page.funnelStage = 'consideration';
        else page.funnelStage = 'none';
      }
    }
    console.log(`[WebsiteLab V4] ✓ Classified intents for ${intentMap.size} pages`);

    // ========================================================================
    // STEP 5: Run Heuristic Evaluation
    // ========================================================================
    console.log('[WebsiteLab V4] Step 5/8: Running heuristic UX evaluation...');
    const heuristics = evaluateHeuristics(siteGraph);
    console.log(`[WebsiteLab V4] ✓ Heuristic evaluation complete: ${heuristics.findings.length} findings`);

    // ========================================================================
    // STEP 5.5: Run V5 Strict Diagnostic (MANDATORY)
    // ========================================================================
    // V5 is NOT optional. If V5 fails, the entire lab run fails.
    // This ensures outputs always include v5Diagnostic with specific,
    // page-anchored issues rather than generic V4 phrases.
    console.log('[WebsiteLab V5] Step 5.5: Running V5 strict diagnostic...');
    const v5Diagnostic: V5DiagnosticOutput = await runV5Diagnostic(siteGraph, heuristics, options?.brainContext);

    // HARD ASSERTION: V5 must produce valid output
    if (!v5Diagnostic || !v5Diagnostic.observations || !v5Diagnostic.blockingIssues) {
      throw new Error('[WebsiteLab V5] ASSERTION FAILED: V5 diagnostic returned invalid structure. v5Diagnostic must exist with observations and blockingIssues.');
    }

    console.log(`[WebsiteLab V5] ✓ V5 diagnostic complete: score=${v5Diagnostic.score}/100`);
    console.log(`[WebsiteLab V5]   - Observations: ${v5Diagnostic.observations.length} pages`);
    console.log(`[WebsiteLab V5]   - Persona journeys: ${v5Diagnostic.personaJourneys.length}`);
    console.log(`[WebsiteLab V5]   - Blocking issues: ${v5Diagnostic.blockingIssues.length}`);

    // ========================================================================
    // STEP 6: Simulate Personas
    // ========================================================================
    console.log('[WebsiteLab V4] Step 6/8: Simulating persona behaviors...');
    const personas = await simulatePersonas(siteGraph);
    console.log(`[WebsiteLab V4] ✓ Simulated ${personas.length} personas`);

    // ========================================================================
    // PHASE 1: CORE INTELLIGENCE ENGINES (V5.1-5.6)
    // ========================================================================
    console.log('[WebsiteLab V5] ============================================');
    console.log('[WebsiteLab V5] RUNNING PHASE 1 INTELLIGENCE ENGINES');
    console.log('[WebsiteLab V5] ============================================');

    // Import Phase 1 engines
    const {
      analyzeCtaIntelligence,
      analyzeContentIntelligence,
      analyzeTrustSignals,
      analyzeVisualBrand,
      buildImpactMatrix,
      analyzeScentTrail,
    } = await import('./websiteLabEngines');

    // Run CTA Intelligence
    console.log('[WebsiteLab V5] Running CTA Intelligence (V5.1)...');
    const ctaIntelligence = analyzeCtaIntelligence(siteGraph);
    console.log(`[WebsiteLab V5] ✓ CTA Intelligence: ${ctaIntelligence.summaryScore}/100`);

    // Run Content Intelligence
    console.log('[WebsiteLab V5] Running Content Intelligence (V5.2)...');
    const contentIntelligence = analyzeContentIntelligence(siteGraph);
    console.log(`[WebsiteLab V5] ✓ Content Intelligence: ${contentIntelligence.summaryScore}/100`);

    // Run Trust Signal Analysis
    console.log('[WebsiteLab V5] Running Trust Signal Analysis (V5.3)...');
    const trustAnalysis = analyzeTrustSignals(siteGraph);
    console.log(`[WebsiteLab V5] ✓ Trust Analysis: ${trustAnalysis.trustScore}/100`);

    // Run Visual + Brand Evaluation
    console.log('[WebsiteLab V5] Running Visual + Brand Evaluation (V5.4)...');
    const visualBrandEvaluation = analyzeVisualBrand(siteGraph);
    console.log(`[WebsiteLab V5] ✓ Visual + Brand: ${visualBrandEvaluation.overallVisualScore}/100`);

    // Run Scent Trail Analysis
    console.log('[WebsiteLab V5] Running Scent Trail Analysis (V5.6)...');
    const scentTrailAnalysis = analyzeScentTrail(siteGraph);
    console.log(`[WebsiteLab V5] ✓ Scent Trail: ${scentTrailAnalysis.overallScore}/100`);

    console.log('[WebsiteLab V5] ✓ Phase 1 intelligence engines complete');

    // ========================================================================
    // PHASE 2: STRATEGIST VIEWS + ANALYTICS (V5.7-5.12)
    // ========================================================================
    console.log('[WebsiteLab V5] ============================================');
    console.log('[WebsiteLab V5] RUNNING PHASE 2: STRATEGIST VIEWS + ANALYTICS');
    console.log('[WebsiteLab V5] ============================================');

    // Import Phase 2 engines
    const {
      generateStrategistViews,
      enhancePersonas,
      getAnalyticsIntegrations,
    } = await import('./websiteLabEngines');

    // Generate Strategist Views
    console.log('[WebsiteLab V5] Generating Strategist Views (V5.8-9)...');
    const strategistViews = await generateStrategistViews(
      siteGraph,
      ctaIntelligence,
      contentIntelligence,
      trustAnalysis
    );
    console.log(`[WebsiteLab V5] ✓ Strategist Views: Conversion ${strategistViews.conversion.conversionReadinessScore}/100, Messaging ${strategistViews.copywriting.messagingClarityScore}/100`);

    // Enhance Personas with V5.7 fields
    console.log('[WebsiteLab V5] Enhancing Persona Recommendations (V5.7)...');
    const enhancedPersonas = enhancePersonas(personas, siteGraph);
    console.log(`[WebsiteLab V5] ✓ Enhanced ${enhancedPersonas.length} personas with expected paths and persona-specific fixes`);

    // Get Analytics Integration with REAL data
    console.log('[WebsiteLab V5] Fetching Analytics Data (V5.10-12)...');
    const analyticsIntegrations = await getAnalyticsIntegrations({
      ga4PropertyId: options?.ga4PropertyId,
      searchConsoleSiteUrl: options?.searchConsoleSiteUrl,
    });
    console.log(`[WebsiteLab V5] ✓ Analytics: GA4=${analyticsIntegrations.ga4?.connected || false}, GSC=${analyticsIntegrations.searchConsole?.connected || false}`);

    console.log('[WebsiteLab V5] ✓ Phase 2 complete');

    // ========================================================================
    // STEP 7: BUILD SITE ASSESSMENT FROM V5 (V5 IS SOLE SOURCE)
    // ========================================================================
    // V4 scoring is REMOVED. V5 is the ONLY canonical implementation.
    // siteAssessment is built entirely from V5 diagnostic output.
    // Raw crawl data (siteGraph, heuristics) preserved as evidence only.
    console.log('[WebsiteLab V5] Step 7/8: Building site assessment from V5...');

    // Derive benchmark label from V5 score
    const benchmarkLabel: 'elite' | 'strong' | 'average' | 'weak' =
      v5Diagnostic.score >= 90 ? 'elite' :
      v5Diagnostic.score >= 80 ? 'strong' :
      v5Diagnostic.score >= 60 ? 'average' : 'weak';

    // Build siteAssessment directly from V5 (NO V4 scoring)
    const siteAssessment: WebsiteUXAssessmentV4 = {
      // === V3 REQUIRED FIELDS ===
      score: v5Diagnostic.score,
      summary: `${v5Diagnostic.score >= 80 ? 'STRONG' : v5Diagnostic.score >= 50 ? 'MIXED' : 'WEAK'} - ${v5Diagnostic.scoreJustification}`,
      strategistView: v5Diagnostic.scoreJustification,
      sectionScores: {
        hierarchy: v5Diagnostic.score,
        clarity: v5Diagnostic.score,
        trust: v5Diagnostic.score,
        navigation: v5Diagnostic.score,
        conversion: v5Diagnostic.score,
        visualDesign: v5Diagnostic.score,
        mobile: v5Diagnostic.score,
        intentAlignment: v5Diagnostic.score,
      },
      issues: v5Diagnostic.blockingIssues.map(issue => ({
        id: `v5-issue-${issue.id}`,
        severity: issue.severity,
        tag: `Blocking Issue #${issue.id}`,
        description: issue.whyItBlocks,
        evidence: `Page: ${issue.page} | Fix: ${issue.concreteFix.what} at ${issue.concreteFix.where}`,
      })),
      recommendations: v5Diagnostic.quickWins.map((win, idx) => ({
        id: `v5-quickwin-${idx + 1}`,
        priority: 'now' as const,
        tag: win.title,
        description: win.action,
        evidence: `Page: ${win.page} | Expected impact: ${win.expectedImpact}`,
      })),
      workItems: v5Diagnostic.quickWins.map((win, idx) => ({
        id: `v5-work-${idx + 1}`,
        title: win.title,
        description: win.action,
        priority: 'P1' as const,
        reason: win.expectedImpact,
      })),

      // === V4 REQUIRED FIELDS ===
      pageLevelScores: siteGraph.pages.slice(0, 10).map(page => {
        const obs = v5Diagnostic.observations.find(o => o.pagePath === page.path);
        return {
          path: page.path,
          type: page.type,
          score: v5Diagnostic.score,
          strengths: obs?.primaryCTAs?.map(c => `CTA: ${c.text}`) || [],
          weaknesses: obs?.missingUnclearElements || [],
        };
      }),
      funnelHealthScore: Math.round(
        (v5Diagnostic.personaJourneys.filter(j => j.succeeded).length / v5Diagnostic.personaJourneys.length) * 100
      ),
      multiPageConsistencyScore: v5Diagnostic.score,
      benchmarkLabel,

      // === V4 OPTIONAL FIELDS (from V5) ===
      executiveSummary: v5Diagnostic.scoreJustification,
      keyIssues: v5Diagnostic.blockingIssues
        .filter(i => i.severity === 'high')
        .map(i => `${i.page}: ${i.whyItBlocks}`),
      quickWins: v5Diagnostic.quickWins.map(w => ({
        title: w.title,
        description: `${w.action} (Page: ${w.page})`,
        impact: 'high' as const,
        effort: 'low' as const,
        dimensions: ['conversion_flow' as const],
      })),
    };

    console.log(`[WebsiteLab V5] ✓ Site assessment built from V5: ${siteAssessment.score}/100 (${siteAssessment.benchmarkLabel})`);

    // ========================================================================
    // STEP 7.6: Build Impact Matrix (V5.5)
    // ========================================================================
    console.log('[WebsiteLab V5] Building Impact Matrix (V5.5)...');
    const impactMatrix = buildImpactMatrix(
      siteGraph,
      siteAssessment.issues || [],
      siteAssessment.recommendations || [],
      ctaIntelligence,
      contentIntelligence,
      trustAnalysis
    );
    console.log(`[WebsiteLab V5] ✓ Impact Matrix: ${impactMatrix.quickWins.length} quick wins identified`);

    // ========================================================================
    // STEP 8: Assemble Final Result
    // ========================================================================
    console.log('[WebsiteLab V4] Step 8/8: Assembling final result...');

    const labResult: WebsiteUXLabResultV4 = {
      siteGraph,
      personas: enhancedPersonas, // Use enhanced personas with V5.7 fields
      heuristics,
      siteAssessment,
      // Phase 1 Intelligence Engines
      ctaIntelligence,
      contentIntelligence,
      trustAnalysis,
      visualBrandEvaluation,
      impactMatrix,
      scentTrailAnalysis,
      // Phase 2 Strategist Views + Analytics
      strategistViews,
      analyticsIntegrations,
      // V5 Strict Diagnostic (MANDATORY - page observations, persona journeys, blocking issues)
      // This is now guaranteed to exist due to the hard assertion in Step 5.5
      v5Diagnostic: {
        observations: v5Diagnostic.observations,
        personaJourneys: v5Diagnostic.personaJourneys,
        blockingIssues: v5Diagnostic.blockingIssues,
        quickWins: v5Diagnostic.quickWins,
        structuralChanges: v5Diagnostic.structuralChanges,
        score: v5Diagnostic.score,
        scoreJustification: v5Diagnostic.scoreJustification,
      },
    };

    console.log('[WebsiteLab V5] ============================================');
    console.log('[WebsiteLab V5] UX LAB COMPLETE (V5 ONLY)');
    console.log(`[WebsiteLab V5] Score: ${v5Diagnostic.score}/100 (${siteAssessment.benchmarkLabel?.toUpperCase()})`);
    console.log(`[WebsiteLab V5] Pages Analyzed: ${siteGraph.pages.length}`);
    console.log(`[WebsiteLab V5] Persona Success Rate: ${siteAssessment.funnelHealthScore}%`);
    console.log(`[WebsiteLab V5] Blocking Issues: ${v5Diagnostic.blockingIssues.length}`);
    console.log(`[WebsiteLab V5] Quick Wins: ${v5Diagnostic.quickWins.length}`);
    console.log(`[WebsiteLab V5] Structural Changes: ${v5Diagnostic.structuralChanges.length}`);
    console.log('[WebsiteLab V5] ============================================');

    return labResult;
  } catch (error) {
    console.error('[WebsiteLab V5] ERROR during UX Lab analysis:', error);
    throw error;
  }
}
