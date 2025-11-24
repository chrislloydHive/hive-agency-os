// lib/gap-heavy/worker.ts
// Heavy GAP Worker V3 - Step-based worker engine

import {
  HeavyGapRunState,
  HeavyGapStep,
  normalizeDomain,
} from './state';
import {
  getHeavyGapRunById,
  updateHeavyGapRunState,
  updateHeavyRunMetrics,
} from '@/lib/airtable/gapHeavyRuns';
import { findRecordByField } from '@/lib/airtable/client';
import * as cheerio from 'cheerio';

// ============================================================================
// Main Worker Function
// ============================================================================

/**
 * Process the next step for a Heavy GAP Run
 *
 * This is the main entry point for the worker. It:
 * 1. Loads the current state
 * 2. Checks if the run is terminal
 * 3. Executes the current step
 * 4. Advances to the next step
 * 5. Saves the updated state
 *
 * @param runId - Airtable record ID of the heavy run
 * @returns Updated HeavyGapRunState
 */
export async function processNextStep(
  runId: string
): Promise<HeavyGapRunState> {
  console.log('[worker] Processing next step for run:', runId);

  // Load current state
  const state = await getHeavyGapRunById(runId);
  if (!state) {
    throw new Error(`HeavyGapRun not found: ${runId}`);
  }

  // Terminal guards - don't process if already in a terminal state
  if (['completed', 'error', 'cancelled'].includes(state.status)) {
    console.log('[worker] Run is in terminal state:', state.status);
    return state;
  }

  // Set status to running
  state.status = 'running';

  try {
    // Run the current step
    console.log('[worker] Running step:', state.currentStep);
    const updated = await runStep(state.currentStep, state);

    // After analyzePages completes, update metrics in Airtable (best-effort)
    if (state.currentStep === 'analyzePages' && updated.data.analyzePages) {
      const { analyzePages } = updated.data;
      await updateHeavyRunMetrics(runId, {
        pagesAnalyzed: analyzePages.pageCount,
        totalWords: analyzePages.contentDepthSummary?.totalWords,
        avgWordsPerPage: analyzePages.contentDepthSummary?.avgWordsPerPage,
        contentDepthBucket: analyzePages.contentDepthSummary?.depthBucket,
        hasBlog: analyzePages.contentDepthSummary?.hasBlog,
      });
    }

    // Determine next step
    const nextStep = getNextStep(updated);
    console.log('[worker] Next step:', nextStep);

    // Mark current step as completed
    updated.stepsCompleted = Array.from(
      new Set([...updated.stepsCompleted, updated.currentStep])
    );

    // Advance to next step
    updated.currentStep = nextStep;
    updated.updatedAt = new Date().toISOString();
    updated.lastTickAt = updated.updatedAt;
    updated.tickCount = (updated.tickCount ?? 0) + 1;

    // If reached complete step, mark as completed
    if (nextStep === 'complete') {
      updated.status = 'completed';
      console.log('[worker] Run completed successfully');
    }

    // Save updated state
    const saved = await updateHeavyGapRunState(updated);
    return saved;
  } catch (error) {
    // Handle step errors
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error('[worker] Step failed:', errorMessage);

    state.status = 'error';
    state.errorMessage = errorMessage;
    state.updatedAt = new Date().toISOString();
    state.lastTickAt = state.updatedAt;
    state.tickCount = (state.tickCount ?? 0) + 1;

    const saved = await updateHeavyGapRunState(state);
    return saved;
  }
}

// ============================================================================
// Step Router
// ============================================================================

/**
 * Run a specific step
 *
 * @param step - Step to run
 * @param state - Current state
 * @returns Updated state after step execution
 */
async function runStep(
  step: HeavyGapStep,
  state: HeavyGapRunState
): Promise<HeavyGapRunState> {
  switch (step) {
    case 'init':
      return await runInitStep(state);
    case 'discoverPages':
      return await runDiscoverPagesStep(state);
    case 'analyzePages':
      return await runAnalyzePagesStep(state);
    case 'deepSeoAudit':
      return await runDeepSeoAuditStep(state);
    case 'socialDeepDive':
      return await runSocialDeepDiveStep(state);
    case 'competitorDeepDive':
      return await runCompetitorDeepDiveStep(state);
    case 'generateArtifacts':
      return await runGenerateArtifactsStep(state);
    case 'complete':
      // Already complete, no-op
      return state;
    default:
      throw new Error(`Unknown step: ${step}`);
  }
}

/**
 * Determine the next step based on current state
 *
 * Default linear flow: init → discoverPages → analyzePages → complete
 * Later steps can be enabled via data.deepSeoAudit.enabled, etc.
 *
 * @param state - Current state
 * @returns Next step to execute
 */
function getNextStep(state: HeavyGapRunState): HeavyGapStep {
  const current = state.currentStep;

  // Default linear progression for MVP
  const linearOrder: HeavyGapStep[] = [
    'init',
    'discoverPages',
    'analyzePages',
    'complete',
  ];

  // Find current step in linear order
  const currentIndex = linearOrder.indexOf(current);

  if (currentIndex === -1) {
    // If current step not in linear order, assume it's complete
    return 'complete';
  }

  // Return next step in linear order
  if (currentIndex < linearOrder.length - 1) {
    return linearOrder[currentIndex + 1];
  }

  // If at end of linear order, complete
  return 'complete';
}

// ============================================================================
// URL Filtering Helpers
// ============================================================================

/**
 * Check if a URL is likely a static asset (not an HTML page)
 */
function isStaticAsset(url: string): boolean {
  const urlLower = url.toLowerCase();

  // Static asset extensions
  const assetExtensions = [
    '.css', '.js', '.map',
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico',
    '.woff', '.woff2', '.ttf', '.otf', '.eot',
    '.pdf', '.zip', '.xml', '.json',
  ];

  if (assetExtensions.some(ext => urlLower.endsWith(ext))) {
    return true;
  }

  // Known asset path patterns
  const assetPaths = [
    '/etc.clientlibs/',
    '/content/dam/',
    '/static/',
    '/assets/',
    '/_next/static/',
  ];

  if (assetPaths.some(path => urlLower.includes(path))) {
    return true;
  }

  return false;
}

/**
 * Check if URL is likely a blog/content page
 */
function isBlogOrContentUrl(url: string): boolean {
  const urlLower = url.toLowerCase();
  const blogPatterns = ['/blog', '/insights', '/resources', '/articles', '/news'];
  return blogPatterns.some(pattern => urlLower.includes(pattern));
}

/**
 * Determine template key from URL path
 */
function getTemplateKey(url: string): string {
  try {
    const pathname = new URL(url).pathname.toLowerCase();

    if (pathname.includes('/blog')) return 'blog-post';
    if (pathname.includes('/pricing')) return 'pricing';
    if (pathname.includes('/about')) return 'about';
    if (pathname.includes('/contact')) return 'contact';
    if (pathname === '/' || pathname === '') return 'homepage';

    return 'default';
  } catch {
    return 'default';
  }
}

/**
 * Check if text content contains CTA language
 */
function hasPrimaryCta(html: string): boolean {
  const ctaPatterns = [
    /get\s+started/i,
    /book\s+(a|an|your)/i,
    /contact\s+us/i,
    /schedule\s+(a|an|your)/i,
    /request\s+(a|an|your)/i,
    /demo/i,
    /sign\s+up/i,
    /join\s+(us|now)/i,
    /start\s+(free|now|today)/i,
    /talk\s+to/i,
    /see\s+pricing/i,
    /try\s+(free|now)/i,
  ];

  return ctaPatterns.some(pattern => pattern.test(html));
}

/**
 * Extract visible text and count words
 */
function extractTextAndCountWords($: cheerio.CheerioAPI): number {
  // Remove script and style tags
  $('script, style, noscript').remove();

  // Get text from main content area (prefer <main>, fallback to <body>)
  const mainContent = $('main').length > 0 ? $('main') : $('body');
  const text = mainContent.text();

  // Split on whitespace and count non-empty words
  const words = text
    .split(/\s+/)
    .filter(word => word.trim().length > 0);

  return words.length;
}

/**
 * Count heading elements
 */
function countHeadings($: cheerio.CheerioAPI): { h1: number; h2: number; h3: number } {
  return {
    h1: $('h1').length,
    h2: $('h2').length,
    h3: $('h3').length,
  };
}

/**
 * Determine content depth bucket from average words per page
 */
function getDepthBucket(avgWordsPerPage: number): 'shallow' | 'medium' | 'deep' {
  if (avgWordsPerPage < 400) return 'shallow';
  if (avgWordsPerPage < 1000) return 'medium';
  return 'deep';
}

// ============================================================================
// Step Implementations
// ============================================================================

/**
 * Step: init
 *
 * Pull any needed GAP V2 fields from GAP-Plan Run / GAP-Full Report.
 * Populate data.baseSnapshot minimally.
 * Idempotent: if baseSnapshot exists, skip.
 */
async function runInitStep(
  state: HeavyGapRunState
): Promise<HeavyGapRunState> {
  console.log('[worker] Running init step');

  // Idempotency check
  if (state.data.baseSnapshot) {
    console.log('[worker] Base snapshot already exists, skipping init');
    return state;
  }

  try {
    // Fetch GAP Plan Run record from Airtable
    const gapPlanRunRecord = await findRecordByField(
      process.env.AIRTABLE_GAP_PLAN_RUN_TABLE || 'GAP-Plan Run',
      'RECORD_ID()',
      state.gapPlanRunId
    );

    if (!gapPlanRunRecord) {
      console.warn('[worker] GAP Plan Run not found:', state.gapPlanRunId);
      // Still proceed, but with empty snapshot
      state.data.baseSnapshot = {
        fromGapRun: false,
        summary: 'GAP Plan Run not found',
        scores: {},
      };
      return state;
    }

    // Extract scores from GAP Plan Run
    const fields = gapPlanRunRecord.fields || {};
    const scores: Record<string, number> = {};

    if (fields['Overall Score']) scores.overall = fields['Overall Score'] as number;
    if (fields['Brand Score']) scores.brand = fields['Brand Score'] as number;
    if (fields['Content Score']) scores.content = fields['Content Score'] as number;
    if (fields['Website Score']) scores.website = fields['Website Score'] as number;
    if (fields['SEO Score']) scores.seo = fields['SEO Score'] as number;
    if (fields['Authority Score']) scores.authority = fields['Authority Score'] as number;

    // Build summary
    const summary = `GAP Plan Run for ${state.domain} - Overall: ${scores.overall || 'N/A'}`;

    state.data.baseSnapshot = {
      fromGapRun: true,
      summary,
      scores,
    };

    console.log('[worker] Init step completed:', summary);
    return state;
  } catch (error) {
    console.error('[worker] Init step failed:', error);
    // Non-fatal: continue with empty snapshot
    state.data.baseSnapshot = {
      fromGapRun: false,
      summary: 'Failed to fetch GAP Plan Run data',
      scores: {},
    };
    return state;
  }
}

/**
 * Step: discoverPages
 *
 * Discover pages to analyze via sitemap or shallow crawl.
 * Idempotent: if discoveredUrls exists, skip.
 */
async function runDiscoverPagesStep(
  state: HeavyGapRunState
): Promise<HeavyGapRunState> {
  console.log('[worker] Running discoverPages step');

  // Idempotency check
  if (
    state.data.discoverPages &&
    state.data.discoverPages.discoveredUrls.length > 0
  ) {
    console.log('[worker] Pages already discovered, skipping');
    return state;
  }

  const MAX_PAGES = 50;
  const seedUrls = [state.url];
  const discovered = new Set<string>(seedUrls);

  // Try to fetch sitemap
  let sitemapFound = false;
  let sitemapUrl: string | undefined;

  for (const sitemapPath of [
    '/sitemap.xml',
    '/sitemap_index.xml',
    '/sitemap-index.xml',
  ]) {
    try {
      const sitemapFullUrl = new URL(sitemapPath, state.url).toString();
      const response = await fetch(sitemapFullUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; HiveGapBot/1.0; +https://hivegrowth.com)',
        },
      });

      if (response.ok) {
        sitemapUrl = sitemapFullUrl;
        sitemapFound = true;
        console.log('[worker] Sitemap found:', sitemapUrl);
        break;
      }
    } catch (error) {
      // Continue to next sitemap path
    }
  }

  // If sitemap found, parse it (simple XML parsing)
  if (sitemapFound && sitemapUrl) {
    try {
      const response = await fetch(sitemapUrl);
      const xml = await response.text();

      // Extract <loc> tags (simple regex)
      const locMatches = xml.matchAll(/<loc>([^<]+)<\/loc>/gi);

      for (const match of locMatches) {
        const url = match[1].trim();
        // Only include same-domain URLs
        const urlObj = new URL(url);
        if (normalizeDomain(urlObj.hostname) === state.domain) {
          discovered.add(url);
          if (discovered.size >= MAX_PAGES) break;
        }
      }

      console.log(
        '[worker] Discovered from sitemap:',
        discovered.size,
        'pages'
      );
    } catch (error) {
      console.warn('[worker] Failed to parse sitemap:', error);
    }
  }

  // If not enough pages from sitemap, do shallow crawl from homepage
  if (discovered.size < 10) {
    try {
      const response = await fetch(state.url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; HiveGapBot/1.0; +https://hivegrowth.com)',
        },
      });

      if (response.ok) {
        const html = await response.text();

        // Extract internal links
        const linkMatches = html.matchAll(/href=["']([^"']+)["']/gi);

        for (const match of linkMatches) {
          const href = match[1];

          if (
            !href ||
            href.startsWith('#') ||
            href.startsWith('mailto:') ||
            href.startsWith('tel:') ||
            href.startsWith('javascript:')
          ) {
            continue;
          }

          try {
            const absoluteUrl = new URL(href, state.url);
            if (normalizeDomain(absoluteUrl.hostname) === state.domain) {
              absoluteUrl.hash = '';
              discovered.add(absoluteUrl.toString());
              if (discovered.size >= MAX_PAGES) break;
            }
          } catch {
            // Invalid URL, skip
          }
        }

        console.log(
          '[worker] Discovered from crawl:',
          discovered.size,
          'pages'
        );
      }
    } catch (error) {
      console.warn('[worker] Failed to crawl homepage:', error);
    }
  }

  const discoveredUrls = Array.from(discovered);
  const limitedByCap = discoveredUrls.length >= MAX_PAGES;

  state.data.discoverPages = {
    sitemapUrl,
    sitemapFound,
    seedUrls,
    discoveredUrls,
    limitedByCap,
  };

  console.log('[worker] DiscoverPages completed:', {
    discovered: discoveredUrls.length,
    limitedByCap,
  });

  return state;
}

/**
 * Step: analyzePages
 *
 * Analyze discovered pages with real HTML parsing and metrics extraction.
 * Filters out static assets and performs per-page analysis.
 * Idempotent: if analyzePages.pageCount > 0, skip.
 */
async function runAnalyzePagesStep(
  state: HeavyGapRunState
): Promise<HeavyGapRunState> {
  console.log('[worker] Running analyzePages step');

  // Idempotency check
  if (state.data.analyzePages && state.data.analyzePages.pageCount > 0) {
    console.log('[worker] Pages already analyzed, skipping');
    return state;
  }

  const discoveredUrls =
    state.data.discoverPages?.discoveredUrls || [state.url];

  // Filter out static assets
  const htmlUrls = discoveredUrls.filter((url) => !isStaticAsset(url));
  console.log(
    `[worker] Filtered ${discoveredUrls.length} URLs to ${htmlUrls.length} HTML pages`
  );

  // Analyze each page with real HTML parsing
  const perPageStats: Array<{
    url: string;
    title?: string;
    status?: number;
    wordCount?: number;
    headings?: { h1: number; h2: number; h3: number };
    hasPrimaryCta?: boolean;
    templateKey?: string;
  }> = [];

  let hasBlog = false;

  for (const url of htmlUrls) {
    try {
      console.log(`[worker] Analyzing page: ${url}`);

      // Fetch HTML
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; HiveGapBot/1.0; +https://hivegrowth.com)',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout per page
      });

      if (!response.ok) {
        console.warn(
          `[worker] Failed to fetch ${url}: ${response.status}`
        );
        perPageStats.push({
          url,
          status: response.status,
          templateKey: getTemplateKey(url),
        });
        continue;
      }

      const html = await response.text();

      // Parse with cheerio
      const $ = cheerio.load(html);

      // Extract title
      const title = $('title').text().trim() || undefined;

      // Extract metrics
      const wordCount = extractTextAndCountWords($);
      const headings = countHeadings($);
      const hasCta = hasPrimaryCta(html);
      const templateKey = getTemplateKey(url);

      // Check if this is a blog/content page
      if (isBlogOrContentUrl(url)) {
        hasBlog = true;
      }

      perPageStats.push({
        url,
        title,
        status: 200,
        wordCount,
        headings,
        hasPrimaryCta: hasCta,
        templateKey,
      });

      console.log(`[worker] Analyzed ${url}: ${wordCount} words`);
    } catch (error) {
      console.warn(`[worker] Error analyzing ${url}:`, error);
      perPageStats.push({
        url,
        status: 0,
        templateKey: getTemplateKey(url),
      });
    }
  }

  // Calculate content depth summary
  const totalWords = perPageStats.reduce(
    (sum, page) => sum + (page.wordCount || 0),
    0
  );
  const avgWordsPerPage =
    perPageStats.length > 0 ? totalWords / perPageStats.length : 0;
  const depthBucket = getDepthBucket(avgWordsPerPage);

  state.data.analyzePages = {
    pageCount: perPageStats.length,
    perPageStats,
    contentDepthSummary: {
      avgWordsPerPage: Math.round(avgWordsPerPage),
      primaryTemplateCount: perPageStats.length,
      totalWords,
      depthBucket,
      hasBlog,
    },
  };

  console.log('[worker] AnalyzePages completed:', {
    pageCount: perPageStats.length,
    totalWords,
    avgWordsPerPage: Math.round(avgWordsPerPage),
    depthBucket,
    hasBlog,
  });

  return state;
}

/**
 * Step: deepSeoAudit (stubbed)
 */
async function runDeepSeoAuditStep(
  state: HeavyGapRunState
): Promise<HeavyGapRunState> {
  console.log('[worker] Running deepSeoAudit step (stubbed)');

  state.data.deepSeoAudit = {
    enabled: false,
    completed: true,
    summary: 'Deep SEO audit not yet implemented',
  };

  return state;
}

/**
 * Step: socialDeepDive (stubbed)
 */
async function runSocialDeepDiveStep(
  state: HeavyGapRunState
): Promise<HeavyGapRunState> {
  console.log('[worker] Running socialDeepDive step (stubbed)');

  state.data.socialDeepDive = {
    enabled: false,
    completed: true,
    summary: 'Social deep dive not yet implemented',
  };

  return state;
}

/**
 * Step: competitorDeepDive (stubbed)
 */
async function runCompetitorDeepDiveStep(
  state: HeavyGapRunState
): Promise<HeavyGapRunState> {
  console.log('[worker] Running competitorDeepDive step (stubbed)');

  state.data.competitorDeepDive = {
    enabled: false,
    completed: true,
    summary: 'Competitor deep dive not yet implemented',
  };

  return state;
}

/**
 * Step: generateArtifacts (stubbed)
 */
async function runGenerateArtifactsStep(
  state: HeavyGapRunState
): Promise<HeavyGapRunState> {
  console.log('[worker] Running generateArtifacts step (stubbed)');

  state.data.generateArtifacts = {
    enabled: false,
    completed: true,
  };

  return state;
}
