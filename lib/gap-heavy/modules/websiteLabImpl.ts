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
  PageLevelScore,
  WebsiteQuickWin,
  WebsiteStrategicInitiative,
  WebsiteUxSectionAnalysis,
  WebsiteUxDimensionKey,
} from './websiteLab';
import type { WebsiteEvidenceV3 as _WebsiteEvidenceV3 } from './website';

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
// CONSULTANT REPORT CONTENT GENERATION (V5)
// ============================================================================

/**
 * Generate consultant-style report content using LLM
 *
 * This creates the narrative-first content that makes Website diagnostics
 * feel like a business consultant's written report.
 */
async function generateConsultantReportContent(
  siteGraph: WebsiteSiteGraphV4,
  personas: WebsiteUXLabPersonaResult[],
  heuristics: HeuristicUxSummary,
  funnelHealthScore: number,
  multiPageConsistencyScore: number,
  overallScore: number,
  brainContext?: BrainContextForLab
): Promise<{
  executiveSummary: string;
  strengths: string[];
  keyIssues: string[];
  quickWins: WebsiteQuickWin[];
  strategicInitiatives: WebsiteStrategicInitiative[];
  focusAreas: WebsiteUxDimensionKey[];
  expectedOutcomes: {
    thirtyDays: string[];
    ninetyDays: string[];
    sixMonths: string[];
  };
  sectionAnalyses: WebsiteUxSectionAnalysis[];
}> {
  console.log('[WebsiteLab V5] Generating consultant report content via LLM...');
  if (brainContext) {
    console.log('[WebsiteLab V5] Brain context loaded, integrity:', brainContext.contextIntegrity || 'unknown');
  }

  const { pages } = siteGraph;
  const homePage = pages.find(p => p.type === 'home');

  // Build Brain context section if available
  const brainContextSection = brainContext ? `
**Company Context from Brain:**
${brainContext.identitySummary ? `Identity: ${brainContext.identitySummary}` : ''}
${brainContext.objectivesSummary ? `Objectives: ${brainContext.objectivesSummary}` : ''}
${brainContext.audienceSummary ? `Target Audience: ${brainContext.audienceSummary}` : ''}
${brainContext.brandSummary ? `Brand: ${brainContext.brandSummary}` : ''}
Context Integrity: ${brainContext.contextIntegrity || 'unknown'}
${brainContext.contextIntegrity === 'low' || brainContext.contextIntegrity === 'none' ? '⚠️ LIMITED CONTEXT: Recommendations may need validation' : ''}
`.trim() : '';

  // Build evidence summary for LLM prompt
  const evidenceSummary = `
${brainContextSection ? brainContextSection + '\n\n' : ''}**Website Analysis Context:**
- Pages Analyzed: ${pages.length}
- Overall Score: ${overallScore}/100
- Funnel Health: ${funnelHealthScore}/100
- Multi-Page Consistency: ${multiPageConsistencyScore}/100
- Persona Success Rate: ${(personas.filter(p => p.success).length / personas.length * 100).toFixed(0)}%

**Homepage Evidence:**
${homePage ? `
- Hero CTA: ${homePage.evidenceV3.hero.hasPrimaryCta ? 'Present' : 'Missing'}
- Value Prop: ${homePage.evidenceV3.valueProp.text || 'Not clear'}
- Trust Signals: ${homePage.evidenceV3.trust.trustDensity} found
- Navigation Links: ${homePage.evidenceV3.navigation.links.length}
- Mobile Issues: ${homePage.evidenceV3.visual.mobileIssuesDetected.length}
` : 'Homepage not analyzed'}

**Heuristic Findings (${heuristics.findings.length} total):**
${heuristics.findings.slice(0, 5).map(f => `- [${f.severity.toUpperCase()}] ${f.description}`).join('\n')}

**Persona Journey Results:**
${personas.map(p => `- ${p.persona}: ${p.success ? '✓ Succeeded' : '✗ Failed'} - ${p.frictionNotes[0] || 'N/A'}`).join('\n')}

**Page-Level Highlights:**
${pages.slice(0, 5).map(p => `- ${p.type} (${p.path}): CTA=${p.evidenceV3.hero.hasPrimaryCta ? 'Y' : 'N'}, Trust=${p.evidenceV3.trust.trustDensity}`).join('\n')}
`.trim();

  const systemPrompt = `You are a senior UX/conversion consultant writing a Website UX Diagnostics report for a client.

Your task is to generate consultant-style narrative content based on the Website UX Lab analysis data provided.

You MUST respond with ONLY a valid JSON object matching this exact structure (no markdown, no code blocks, pure JSON):

{
  "executiveSummary": "A 2-3 paragraph executive summary that explains WHY the score is what it is, what the key findings are, and what this means for the business. This should be a narrative overview of the diagnostic results written in a consultant's voice - explaining the score, highlighting the most important issues and opportunities, and providing context for why these findings matter.",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "keyIssues": ["issue 1", "issue 2", "issue 3"],
  "quickWins": [
    {
      "title": "Fix missing homepage CTA",
      "description": "Add a prominent primary CTA above the fold on the homepage to give first-time visitors a clear next step.",
      "impact": "high",
      "effort": "low",
      "dimensions": ["hero_and_value_prop", "conversion_flow"],
      "timeline": "1-2 days"
    }
  ],
  "strategicInitiatives": [
    {
      "title": "Redesign multi-page conversion funnel",
      "description": "Map and optimize the conversion journey across Product → Pricing → Contact pages to reduce friction and dead ends.",
      "impact": "high",
      "effort": "high",
      "dimensions": ["navigation_and_structure", "conversion_flow"],
      "timeHorizon": "4-6 weeks",
      "rationale": "Current funnel has 3 dead ends and 40% of personas fail to reach conversion pages."
    }
  ],
  "focusAreas": ["hero_and_value_prop", "conversion_flow"],
  "expectedOutcomes": {
    "thirtyDays": ["Improved homepage CTA clarity", "Reduced bounce rate by 10-15%"],
    "ninetyDays": ["Streamlined conversion funnel", "20% increase in contact form submissions"],
    "sixMonths": ["Consistent UX across all pages", "30-40% improvement in overall conversion rate"]
  },
  "sectionAnalyses": [
    {
      "title": "Hero & Value Proposition",
      "dimension": "hero_and_value_prop",
      "score": 65,
      "verdict": "Value proposition is present but lacks differentiation and urgency",
      "narrative": "The homepage hero section communicates the core service offering, but the value proposition lacks specificity and competitive differentiation. The headline is generic and doesn't immediately convey unique value. Trust signals are minimal in the hero area, which reduces credibility for first-time visitors.\\n\\nThe primary CTA is present but doesn't create urgency or communicate clear next-step value. Mobile analysis shows the hero section is functional but could benefit from tighter messaging.",
      "keyFindings": [
        "Hero CTA present but lacks urgency",
        "Value proposition is generic, not differentiated",
        "Missing trust signals above the fold",
        "Mobile hero is functional but could be tighter"
      ],
      "quickWins": [],
      "deeperInitiatives": []
    }
  ]
}

**Guidelines:**
1. Strengths: 3-5 positive findings (be specific, evidence-based)
2. Key Issues: 3-5 critical problems (prioritize high-severity issues)
3. Quick Wins: 3-5 high-impact, low-effort actions (1-2 weeks max)
4. Strategic Initiatives: 2-4 longer-horizon improvements (1-3 months)
5. Focus Areas: 2-3 most critical dimensions to prioritize
6. Expected Outcomes: Realistic, measurable outcomes at 30/90/180 days
7. Section Analyses: Generate for ALL 8 dimensions with narrative-first approach

**8 UX Dimensions (generate section analyses for ALL):**
- overall_experience
- hero_and_value_prop
- navigation_and_structure
- trust_and_social_proof
- conversion_flow
- content_and_clarity
- visual_and_mobile
- intent_alignment

**Tone:**
- Professional, consultative, evidence-based
- Use narrative paragraphs (not just bullets)
- Be specific (cite scores, findings, evidence)
- Balance criticism with constructive recommendations

${brainContext ? `**CRITICAL CONSTRAINTS (Brain-First):**
- Use the company's existing positioning, ICP, and primary objectives from the provided context.
- Do not change who they serve. Propose website improvements within this strategy.
- All recommendations must align with the stated business model and target audience.
- Do not suggest pivoting the business or changing the core value proposition.
- If context integrity is low/none, flag recommendations as preliminary.` : ''}

Respond with ONLY the JSON object. No explanatory text before or after.`;

  const userPrompt = evidenceSummary;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    // Parse the JSON response
    const parsed = JSON.parse(content.trim());

    console.log('[WebsiteLab V5] ✓ Consultant report content generated');
    console.log(`  - ${parsed.quickWins?.length || 0} quick wins`);
    console.log(`  - ${parsed.strategicInitiatives?.length || 0} strategic initiatives`);
    console.log(`  - ${parsed.sectionAnalyses?.length || 0} section analyses`);

    return parsed;
  } catch (error) {
    console.warn('[WebsiteLab V5] Failed to generate consultant report content:', error);

    // Return minimal fallback structure
    return {
      executiveSummary: 'Analysis data available. Detailed report generation pending.',
      strengths: ['Analysis data available'],
      keyIssues: ['Detailed analysis pending'],
      quickWins: [],
      strategicInitiatives: [],
      focusAreas: ['overall_experience' as WebsiteUxDimensionKey],
      expectedOutcomes: {
        thirtyDays: [],
        ninetyDays: [],
        sixMonths: [],
      },
      sectionAnalyses: [],
    };
  }
}

// ============================================================================
// SITE ASSESSMENT SYNTHESIS (V4.7)
// ============================================================================

/**
 * Generate final site assessment
 *
 * Synthesizes all V4/V5 analysis into a comprehensive site assessment:
 * - Aggregates page-level scores
 * - Calculates funnel health
 * - Measures multi-page consistency
 * - Assigns benchmark label
 * - Incorporates persona and heuristic insights
 *
 * @param siteGraph - Site graph with all pages
 * @param personas - Persona simulation results
 * @param heuristics - Heuristic UX summary
 * @returns Complete V4 assessment
 */
export async function generateSiteAssessment(
  siteGraph: WebsiteSiteGraphV4,
  personas: WebsiteUXLabPersonaResult[],
  heuristics: HeuristicUxSummary,
  brainContext?: BrainContextForLab
): Promise<WebsiteUXAssessmentV4> {
  console.log(`[WebsiteLab V4] Generating final site assessment`);

  const { pages } = siteGraph;

  // ========================================================================
  // 1. Calculate page-level scores
  // ========================================================================

  const pageLevelScores: PageLevelScore[] = [];

  for (const page of pages) {
    // Base score from V3 evidence quality
    let pageScore = 60;

    // Adjust based on V3 evidence signals
    if (page.evidenceV3.hero.hasPrimaryCta) pageScore += 10;
    if (page.evidenceV3.trust.trustDensity >= 3) pageScore += 10;
    if (page.evidenceV3.visual.readabilityScore >= 70) pageScore += 10;
    if (page.evidenceV3.valueProp.clarityFlags.length === 0) pageScore += 5;

    // Penalize issues
    if (page.evidenceV3.visual.contrastFlags.length > 0) pageScore -= 5;
    if (page.evidenceV3.visual.mobileIssuesDetected.length > 0) pageScore -= 10;

    // Clamp to 0-100
    pageScore = Math.max(0, Math.min(100, pageScore));

    // Identify strengths and weaknesses
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (page.evidenceV3.hero.hasPrimaryCta) {
      strengths.push('Clear primary CTA');
    } else {
      weaknesses.push('Missing primary CTA');
    }

    if (page.evidenceV3.trust.trustDensity >= 3) {
      strengths.push('Strong trust signals');
    } else if (page.evidenceV3.trust.trustDensity === 0) {
      weaknesses.push('Lacks trust signals');
    }

    if (page.evidenceV3.visual.readabilityScore >= 70) {
      strengths.push('Good readability');
    } else if (page.evidenceV3.visual.readabilityScore < 50) {
      weaknesses.push('Poor readability');
    }

    if (page.evidenceV3.visual.mobileIssuesDetected.length > 0) {
      weaknesses.push('Mobile UX issues');
    }

    pageLevelScores.push({
      path: page.path,
      type: page.type,
      score: pageScore,
      strengths,
      weaknesses,
    });
  }

  // ========================================================================
  // 2. Calculate funnel health (from funnel mapper)
  // ========================================================================

  const { funnelHealthScore } = mapConversionFunnels(siteGraph);

  // ========================================================================
  // 3. Calculate multi-page consistency
  // ========================================================================

  // Consistency = variance in page scores (low variance = high consistency)
  const scores = pageLevelScores.map(p => p.score);
  const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  // Map std dev to consistency score (lower std dev = higher consistency)
  // If std dev is 0 (perfect consistency), score = 100
  // If std dev is 30 (high variance), score = 40
  let multiPageConsistencyScore = Math.max(40, 100 - stdDev * 2);
  multiPageConsistencyScore = Math.round(multiPageConsistencyScore);

  // ========================================================================
  // 4. Calculate overall site score
  // ========================================================================

  // Weighted average of:
  // - Average page score (40%)
  // - Funnel health (20%)
  // - Multi-page consistency (15%)
  // - Heuristic score (15%)
  // - Persona success rate (10%)

  const personaSuccessRate =
    (personas.filter(p => p.success).length / personas.length) * 100;

  const overallScore = Math.round(
    avgScore * 0.4 +
      funnelHealthScore * 0.2 +
      multiPageConsistencyScore * 0.15 +
      heuristics.overallScore * 0.15 +
      personaSuccessRate * 0.1
  );

  // ========================================================================
  // 5. Assign benchmark label
  // ========================================================================

  let benchmarkLabel: BenchmarkLabel;
  if (overallScore >= 90) benchmarkLabel = 'elite';
  else if (overallScore >= 80) benchmarkLabel = 'strong';
  else if (overallScore >= 60) benchmarkLabel = 'average';
  else benchmarkLabel = 'weak';

  // ========================================================================
  // 6. Build V3-compatible assessment structure
  // ========================================================================

  // Get homepage for V3 compatibility
  const homePage = pages.find(p => p.type === 'home')!;

  // Aggregate issues from heuristics and persona friction
  const issues = heuristics.findings.map(f => ({
    id: f.id,
    severity: f.severity,
    tag: f.rule,
    description: f.description,
    evidence: f.pagePath || 'Site-wide',
  }));

  // Add persona friction as issues
  for (const persona of personas) {
    if (!persona.success) {
      issues.push({
        id: `persona-${persona.persona}`,
        severity: 'medium' as const,
        tag: 'User Journey',
        description: `${persona.persona} persona failed: ${persona.frictionNotes[0] || 'unclear reason'}`,
        evidence: `Persona: ${persona.persona}, Goal: ${persona.goal}`,
      });
    }
  }

  // Generate recommendations
  const recommendations: WebsiteUXAssessmentV4['recommendations'] = [];

  if (funnelHealthScore < 70) {
    recommendations.push({
      id: 'funnel-health',
      priority: 'now',
      tag: 'Conversion',
      description: 'Strengthen conversion funnel paths and reduce dead ends',
      evidence: `Funnel health score: ${funnelHealthScore}/100`,
    });
  }

  if (multiPageConsistencyScore < 70) {
    recommendations.push({
      id: 'consistency',
      priority: 'next',
      tag: 'Consistency',
      description: 'Improve consistency across pages (navigation, CTAs, visual design)',
      evidence: `Consistency score: ${multiPageConsistencyScore}/100`,
    });
  }

  // Add top heuristic findings as recommendations
  const highSeverityFindings = heuristics.findings.filter(f => f.severity === 'high');
  for (const finding of highSeverityFindings.slice(0, 3)) {
    recommendations.push({
      id: finding.id,
      priority: 'now',
      tag: finding.rule,
      description: finding.description,
      evidence: finding.pagePath || 'Site-wide',
    });
  }

  // Generate work items from recommendations
  const workItems = recommendations.slice(0, 5).map((rec, idx) => {
    // Map priority 'now' -> 'P1', 'next' -> 'P2', 'later' -> 'P3'
    const priorityMap = { now: 'P1' as const, next: 'P2' as const, later: 'P3' as const };
    return {
      id: `work-${idx + 1}`,
      title: rec.description,
      description: `${rec.tag}: ${rec.evidence}`,
      priority: priorityMap[rec.priority],
      reason: rec.evidence,
    };
  });

  // Generate strategist view
  const strategistView = `
**Multi-Page UX Lab Analysis (V4/V5)**

This website was analyzed across ${pages.length} pages using our flagship UX & Conversion Lab.

**Overall Grade: ${benchmarkLabel.toUpperCase()}** (${overallScore}/100)

**Key Findings:**
- **Funnel Health:** ${funnelHealthScore}/100 - ${funnelHealthScore >= 80 ? 'Strong conversion paths detected' : funnelHealthScore >= 60 ? 'Moderate funnel clarity' : 'Weak conversion paths, multiple dead ends'}
- **Multi-Page Consistency:** ${multiPageConsistencyScore}/100 - ${multiPageConsistencyScore >= 80 ? 'Excellent consistency' : multiPageConsistencyScore >= 60 ? 'Acceptable variance' : 'High inconsistency across pages'}
- **Persona Success Rate:** ${Math.round(personaSuccessRate)}% of personas achieved their goals
- **Heuristic Score:** ${heuristics.overallScore}/100 (${heuristics.findings.length} UX violations found)

**Page-Level Performance:**
${pageLevelScores
  .slice(0, 5)
  .map(p => `- ${p.type} (${p.path}): ${p.score}/100`)
  .join('\n')}

**Critical Actions:**
${highSeverityFindings
  .slice(0, 3)
  .map(f => `- ${f.description}`)
  .join('\n')}

**What Makes This "Flagship":**
Unlike single-page analysis, this V4/V5 assessment examined your entire conversion ecosystem:
multi-page journeys, funnel dead-ends, cross-page consistency, and behavioral simulations
for 5 different user personas. This is the most comprehensive UX diagnostic available.
`.trim();

  // Build section scores
  const sectionScores = {
    hierarchy: Math.round(avgScore * 0.9),
    clarity: Math.round(avgScore * 0.95),
    trust: Math.round((homePage.evidenceV3.trust.trustDensity / 5) * 100),
    navigation: Math.round((10 - Math.min(homePage.evidenceV3.navigation.links.length, 10)) * 10),
    conversion: funnelHealthScore,
    visualDesign: Math.round(avgScore * 0.85),
    mobile: homePage.evidenceV3.visual.mobileIssuesDetected.length === 0 ? 80 : 50,
    intentAlignment: Math.round(avgScore * 0.88), // Intent classification across pages
  };

  // ========================================================================
  // 7. Generate consultant report content (V5)
  // ========================================================================

  let consultantReport;
  try {
    consultantReport = await generateConsultantReportContent(
      siteGraph,
      personas,
      heuristics,
      funnelHealthScore,
      multiPageConsistencyScore,
      overallScore,
      brainContext
    );
  } catch {
    console.warn('[WebsiteLab V5] Failed to generate consultant report, using fallback');
    consultantReport = {
      executiveSummary: `Your website scored ${overallScore}/100 in our comprehensive analysis. This reflects the current state of your digital presence across multiple dimensions including user experience, conversion optimization, and technical implementation.`,
      strengths: [],
      keyIssues: [],
      quickWins: [],
      strategicInitiatives: [],
      focusAreas: ['overall_experience' as WebsiteUxDimensionKey],
      expectedOutcomes: { thirtyDays: [], ninetyDays: [], sixMonths: [] },
      sectionAnalyses: [],
    };
  }

  // ========================================================================
  // 8. Return V4/V5 Assessment
  // ========================================================================

  const assessment: WebsiteUXAssessmentV4 = {
    score: overallScore,
    summary: `${benchmarkLabel.toUpperCase()} - Multi-page UX Lab analysis across ${pages.length} pages`,
    strategistView,
    sectionScores,
    issues,
    recommendations,
    workItems,

    // V4/V5 Enhancements
    pageLevelScores,
    funnelHealthScore,
    multiPageConsistencyScore,
    benchmarkLabel,

    // V5 Consultant Report Enhancements
    executiveSummary: consultantReport.executiveSummary,
    strengths: consultantReport.strengths,
    keyIssues: consultantReport.keyIssues,
    quickWins: consultantReport.quickWins,
    strategicInitiatives: consultantReport.strategicInitiatives,
    focusAreas: consultantReport.focusAreas,
    expectedOutcomes: consultantReport.expectedOutcomes,
    sectionAnalyses: consultantReport.sectionAnalyses,
  };

  console.log(`[WebsiteLab V4/V5] Site assessment complete: ${overallScore}/100 (${benchmarkLabel})`);

  return assessment;
}

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
    // STEP 7: Generate Site Assessment
    // ========================================================================
    console.log('[WebsiteLab V4] Step 7/8: Generating final site assessment...');
    const siteAssessment = await generateSiteAssessment(siteGraph, personas, heuristics, options?.brainContext);
    console.log(`[WebsiteLab V4] ✓ Site assessment complete: ${siteAssessment.score}/100 (${siteAssessment.benchmarkLabel})`);

    // ========================================================================
    // STEP 7.5: Build Impact Matrix (V5.5)
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
    };

    console.log('[WebsiteLab V4] ============================================');
    console.log('[WebsiteLab V4] UX LAB COMPLETE');
    console.log(`[WebsiteLab V4] Score: ${siteAssessment.score}/100 (${siteAssessment.benchmarkLabel?.toUpperCase()})`);
    console.log(`[WebsiteLab V4] Pages: ${siteGraph.pages.length}`);
    console.log(`[WebsiteLab V4] Funnel Health: ${siteAssessment.funnelHealthScore}/100`);
    console.log(`[WebsiteLab V4] Consistency: ${siteAssessment.multiPageConsistencyScore}/100`);
    console.log(`[WebsiteLab V4] Personas Succeeded: ${personas.filter(p => p.success).length}/${personas.length}`);
    console.log('[WebsiteLab V4] ============================================');

    return labResult;
  } catch (error) {
    console.error('[WebsiteLab V4] ERROR during UX Lab analysis:', error);
    throw error;
  }
}
