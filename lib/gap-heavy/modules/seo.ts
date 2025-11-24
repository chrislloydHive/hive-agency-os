// lib/gap-heavy/modules/seo.ts
// SEO Diagnostic Module - Real Implementation

import type { CompanyRecord } from '@/lib/airtable/companies';
import type { DiagnosticModuleResult, EvidencePack } from '../types';
import { extractTechnicalSeoSignals } from '@/lib/growth-plan/section-analyses';
import type { TechnicalSeoSignals } from '@/lib/growth-plan/types';
import * as cheerio from 'cheerio';
import { normalizeDomain } from '../state';

// ============================================================================
// Types
// ============================================================================

export interface SeoPageAnalysis {
  url: string;
  title?: string;
  titleLength?: number;
  metaDescription?: string;
  metaDescriptionLength?: number;
  h1Count: number;
  h1Text?: string[];
  hasCanonical: boolean;
  canonicalUrl?: string;
  hasRobotsNoindex: boolean;
  internalLinkCount: number;
  error?: string;
}

export interface SeoEvidenceData {
  // Overall signals
  technicalSignals: TechnicalSeoSignals;

  // Page-level analysis
  pagesAnalyzed: number;
  pageDetails: SeoPageAnalysis[];

  // Sitemap discovery
  hasSitemap: boolean;
  sitemapUrl?: string;

  // Aggregated metrics
  pagesWithTitles: number;
  pagesWithMetaDescriptions: number;
  pagesWithCanonicals: number;
  pagesWithMultipleH1s: number;
  avgInternalLinksPerPage: number;

  // Computed score
  score: number;
}

// ============================================================================
// Main SEO Module Function
// ============================================================================

export async function runSeoModule(input: {
  company: CompanyRecord;
  websiteUrl: string;
  evidence: EvidencePack;
}): Promise<DiagnosticModuleResult> {
  const startTime = new Date().toISOString();

  console.log('[SEO Module] Starting SEO diagnostic for:', input.websiteUrl);

  try {
    // 1. Discover key pages to analyze
    const pagesToAnalyze = await discoverKeyPages(input.websiteUrl);
    console.log(`[SEO Module] Discovered ${pagesToAnalyze.length} pages to analyze`);

    // 2. Analyze each page for SEO elements
    const pageDetails: SeoPageAnalysis[] = [];
    for (const pageUrl of pagesToAnalyze) {
      const analysis = await analyzePageSeo(pageUrl);
      pageDetails.push(analysis);
    }

    // 3. Extract technical SEO signals (using existing function)
    // Note: This requires AssessmentResult, so we'll do a simplified version for now
    const technicalSignals = await extractBasicTechnicalSignals(input.websiteUrl, pageDetails);

    // 4. Calculate aggregated metrics
    const pagesWithTitles = pageDetails.filter(p => p.title && p.title.length > 0).length;
    const pagesWithMetaDescriptions = pageDetails.filter(p => p.metaDescription && p.metaDescription.length > 0).length;
    const pagesWithCanonicals = pageDetails.filter(p => p.hasCanonical).length;
    const pagesWithMultipleH1s = pageDetails.filter(p => p.h1Count > 1).length;
    const avgInternalLinksPerPage = pageDetails.length > 0
      ? pageDetails.reduce((sum, p) => sum + p.internalLinkCount, 0) / pageDetails.length
      : 0;

    // 5. Compute SEO score (0-100)
    const score = computeSeoScore({
      pagesAnalyzed: pageDetails.length,
      pagesWithTitles,
      pagesWithMetaDescriptions,
      pagesWithCanonicals,
      pagesWithMultipleH1s,
      avgInternalLinksPerPage,
      technicalSignals,
    });

    // 6. Build evidence data
    const evidenceData: SeoEvidenceData = {
      technicalSignals,
      pagesAnalyzed: pageDetails.length,
      pageDetails: pageDetails.slice(0, 10), // Store first 10 for detail
      hasSitemap: technicalSignals.notes?.some(n => n.includes('sitemap')) ?? false,
      pagesWithTitles,
      pagesWithMetaDescriptions,
      pagesWithCanonicals,
      pagesWithMultipleH1s,
      avgInternalLinksPerPage: Math.round(avgInternalLinksPerPage),
      score,
    };

    // 7. Generate summary, issues, and recommendations
    const { summary, issues, recommendations } = generateSeoInsights(evidenceData);

    // 8. Store in evidence pack
    if (!input.evidence.presence) {
      input.evidence.presence = {};
    }
    input.evidence.presence.seo = evidenceData;

    const completedTime = new Date().toISOString();

    console.log('[SEO Module] Completed with score:', score);

    return {
      module: 'seo',
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
    console.error('[SEO Module] Error:', errorMsg);

    return {
      module: 'seo',
      status: 'failed',
      startedAt: startTime,
      completedAt: new Date().toISOString(),
      score: 0,
      summary: `SEO analysis failed: ${errorMsg}`,
      issues: ['Unable to complete SEO analysis due to technical error'],
      recommendations: ['Retry SEO analysis after verifying website accessibility'],
      rawEvidence: { error: errorMsg },
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Discover key pages to analyze via sitemap or crawling
 */
async function discoverKeyPages(websiteUrl: string): Promise<string[]> {
  const MAX_PAGES = 15;
  const discovered = new Set<string>([websiteUrl]);
  const domain = normalizeDomain(websiteUrl);

  // Try to find sitemap
  let sitemapFound = false;
  for (const sitemapPath of ['/sitemap.xml', '/sitemap_index.xml', '/sitemap-index.xml']) {
    try {
      const sitemapUrl = new URL(sitemapPath, websiteUrl).toString();
      const response = await fetch(sitemapUrl, {
        method: 'HEAD',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HiveGapBot/1.0)' },
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        sitemapFound = true;
        // Fetch and parse sitemap
        const sitemapResponse = await fetch(sitemapUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HiveGapBot/1.0)' },
          signal: AbortSignal.timeout(10000),
        });
        const xml = await sitemapResponse.text();
        const locMatches = xml.matchAll(/<loc>([^<]+)<\/loc>/gi);

        for (const match of locMatches) {
          const url = match[1].trim();
          const urlObj = new URL(url);
          if (normalizeDomain(urlObj.hostname) === domain) {
            discovered.add(url);
            if (discovered.size >= MAX_PAGES) break;
          }
        }
        break;
      }
    } catch {
      // Continue to next sitemap
    }
  }

  // If not enough pages from sitemap, crawl homepage for links
  if (discovered.size < 5) {
    try {
      const response = await fetch(websiteUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HiveGapBot/1.0)' },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const html = await response.text();
        const linkMatches = html.matchAll(/href=["']([^"']+)["']/gi);

        for (const match of linkMatches) {
          const href = match[1];
          if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
            continue;
          }

          try {
            const absoluteUrl = new URL(href, websiteUrl);
            if (normalizeDomain(absoluteUrl.hostname) === domain) {
              absoluteUrl.hash = '';
              discovered.add(absoluteUrl.toString());
              if (discovered.size >= MAX_PAGES) break;
            }
          } catch {
            // Invalid URL, skip
          }
        }
      }
    } catch (error) {
      console.warn('[SEO Module] Homepage crawl failed:', error);
    }
  }

  return Array.from(discovered);
}

/**
 * Analyze a single page for SEO elements
 */
async function analyzePageSeo(url: string): Promise<SeoPageAnalysis> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HiveGapBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return {
        url,
        h1Count: 0,
        hasCanonical: false,
        hasRobotsNoindex: false,
        internalLinkCount: 0,
        error: `HTTP ${response.status}`,
      };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract title
    const title = $('title').text().trim();
    const titleLength = title.length;

    // Extract meta description
    const metaDescription = $('meta[name="description"]').attr('content')?.trim() || '';
    const metaDescriptionLength = metaDescription.length;

    // Count H1 tags
    const h1Elements = $('h1');
    const h1Count = h1Elements.length;
    const h1Text = h1Elements.map((_, el) => $(el).text().trim()).get().slice(0, 3);

    // Check canonical
    const canonical = $('link[rel="canonical"]').attr('href');
    const hasCanonical = !!canonical;

    // Check robots noindex
    const robotsMeta = $('meta[name="robots"]').attr('content')?.toLowerCase() || '';
    const hasRobotsNoindex = robotsMeta.includes('noindex');

    // Count internal links
    const baseUrl = new URL(url);
    const internalLinks = $('a[href]').filter((_, el) => {
      const href = $(el).attr('href');
      if (!href) return false;
      try {
        const linkUrl = new URL(href, url);
        return linkUrl.hostname === baseUrl.hostname;
      } catch {
        return href.startsWith('/') || href.startsWith('#');
      }
    }).length;

    return {
      url,
      title: title || undefined,
      titleLength,
      metaDescription: metaDescription || undefined,
      metaDescriptionLength,
      h1Count,
      h1Text: h1Text.length > 0 ? h1Text : undefined,
      hasCanonical,
      canonicalUrl: canonical,
      hasRobotsNoindex,
      internalLinkCount: internalLinks,
    };
  } catch (error) {
    return {
      url,
      h1Count: 0,
      hasCanonical: false,
      hasRobotsNoindex: false,
      internalLinkCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Extract basic technical SEO signals
 */
async function extractBasicTechnicalSignals(
  url: string,
  pageDetails: SeoPageAnalysis[]
): Promise<TechnicalSeoSignals> {
  const signals: TechnicalSeoSignals = {};
  const notes: string[] = [];

  // Check for multiple H1s
  const pagesWithMultipleH1s = pageDetails.filter(p => p.h1Count > 1);
  if (pagesWithMultipleH1s.length > 0) {
    signals.hasMultipleH1 = true;
    notes.push(`${pagesWithMultipleH1s.length} pages have multiple H1 tags`);
  }

  // Check for missing canonicals
  const pagesWithoutCanonicals = pageDetails.filter(p => !p.hasCanonical);
  if (pagesWithoutCanonicals.length > 0) {
    signals.hasCanonicalTagIssues = true;
    notes.push(`${pagesWithoutCanonicals.length} pages missing canonical tags`);
  }

  // Calculate average internal links
  const avgInternalLinks = pageDetails.length > 0
    ? pageDetails.reduce((sum, p) => sum + p.internalLinkCount, 0) / pageDetails.length
    : 0;
  signals.internalLinkCount = Math.round(avgInternalLinks);

  // Check for meta tags
  const pagesWithMeta = pageDetails.filter(p => p.title && p.metaDescription);
  signals.metaTagsPresent = pagesWithMeta.length >= pageDetails.length * 0.8; // 80% threshold

  // Check for indexability issues
  const indexabilityIssues: string[] = [];
  const noindexPages = pageDetails.filter(p => p.hasRobotsNoindex);
  if (noindexPages.length > 0) {
    indexabilityIssues.push(`${noindexPages.length} pages have noindex directive`);
  }
  if (indexabilityIssues.length > 0) {
    signals.indexabilityIssues = indexabilityIssues;
  }

  if (notes.length > 0) {
    signals.notes = notes;
  }

  return signals;
}

/**
 * Compute SEO score based on multiple criteria (0-100)
 */
function computeSeoScore(metrics: {
  pagesAnalyzed: number;
  pagesWithTitles: number;
  pagesWithMetaDescriptions: number;
  pagesWithCanonicals: number;
  pagesWithMultipleH1s: number;
  avgInternalLinksPerPage: number;
  technicalSignals: TechnicalSeoSignals;
}): number {
  let score = 0;

  // Title tags (25 points)
  const titleCoverage = metrics.pagesAnalyzed > 0
    ? metrics.pagesWithTitles / metrics.pagesAnalyzed
    : 0;
  score += titleCoverage * 25;

  // Meta descriptions (20 points)
  const metaCoverage = metrics.pagesAnalyzed > 0
    ? metrics.pagesWithMetaDescriptions / metrics.pagesAnalyzed
    : 0;
  score += metaCoverage * 20;

  // Canonical tags (20 points)
  const canonicalCoverage = metrics.pagesAnalyzed > 0
    ? metrics.pagesWithCanonicals / metrics.pagesAnalyzed
    : 0;
  score += canonicalCoverage * 20;

  // H1 structure (15 points) - penalize multiple H1s
  const h1Penalty = metrics.pagesAnalyzed > 0
    ? metrics.pagesWithMultipleH1s / metrics.pagesAnalyzed
    : 0;
  score += (1 - h1Penalty) * 15;

  // Internal linking (10 points)
  const linkingScore = Math.min(metrics.avgInternalLinksPerPage / 20, 1); // Cap at 20 links
  score += linkingScore * 10;

  // Indexability (10 points) - penalize noindex
  const hasIndexabilityIssues = metrics.technicalSignals.indexabilityIssues &&
    metrics.technicalSignals.indexabilityIssues.length > 0;
  if (!hasIndexabilityIssues) {
    score += 10;
  }

  return Math.round(score);
}

/**
 * Generate summary, issues, and recommendations based on evidence
 */
function generateSeoInsights(evidence: SeoEvidenceData): {
  summary: string;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Analyze title tags
  const titleCoverage = evidence.pagesAnalyzed > 0
    ? evidence.pagesWithTitles / evidence.pagesAnalyzed
    : 0;
  if (titleCoverage < 0.9) {
    issues.push(`${Math.round((1 - titleCoverage) * 100)}% of pages missing title tags`);
    recommendations.push('Add unique, descriptive title tags to all pages (50-60 characters)');
  }

  // Analyze meta descriptions
  const metaCoverage = evidence.pagesAnalyzed > 0
    ? evidence.pagesWithMetaDescriptions / evidence.pagesAnalyzed
    : 0;
  if (metaCoverage < 0.9) {
    issues.push(`${Math.round((1 - metaCoverage) * 100)}% of pages missing meta descriptions`);
    recommendations.push('Write compelling meta descriptions for all pages (150-160 characters)');
  }

  // Analyze canonical tags
  const canonicalCoverage = evidence.pagesAnalyzed > 0
    ? evidence.pagesWithCanonicals / evidence.pagesAnalyzed
    : 0;
  if (canonicalCoverage < 0.8) {
    issues.push(`${Math.round((1 - canonicalCoverage) * 100)}% of pages missing canonical tags`);
    recommendations.push('Implement canonical tags on all pages to prevent duplicate content issues');
  }

  // Analyze H1 structure
  if (evidence.pagesWithMultipleH1s > 0) {
    issues.push(`${evidence.pagesWithMultipleH1s} pages have multiple H1 tags`);
    recommendations.push('Ensure each page has exactly one H1 tag for proper heading hierarchy');
  }

  // Analyze internal linking
  if (evidence.avgInternalLinksPerPage < 5) {
    issues.push('Internal linking is weak (average < 5 links per page)');
    recommendations.push('Strengthen internal linking structure with 10-15 contextual links per page');
  }

  // Analyze indexability
  if (evidence.technicalSignals.indexabilityIssues && evidence.technicalSignals.indexabilityIssues.length > 0) {
    issues.push(...evidence.technicalSignals.indexabilityIssues);
    recommendations.push('Review and fix robots meta directives blocking search engines');
  }

  // Always add sitemap recommendation if missing
  if (!evidence.hasSitemap) {
    issues.push('No XML sitemap detected');
    recommendations.push('Create and submit XML sitemap to Google Search Console');
  }

  // Generate summary
  let summaryText = '';
  if (evidence.score >= 85) {
    summaryText = `SEO fundamentals are strong with ${Math.round(titleCoverage * 100)}% title tag coverage and ${Math.round(metaCoverage * 100)}% meta description coverage. `;
  } else if (evidence.score >= 70) {
    summaryText = `SEO foundation is solid but has gaps. ${Math.round(titleCoverage * 100)}% of pages have title tags, ${Math.round(metaCoverage * 100)}% have meta descriptions. `;
  } else if (evidence.score >= 50) {
    summaryText = `SEO needs improvement. Missing critical elements on ${100 - Math.round(titleCoverage * 100)}% of pages. `;
  } else {
    summaryText = `SEO requires significant work. Major gaps in title tags, meta descriptions, and technical fundamentals. `;
  }

  // Add key metric
  summaryText += `Analyzed ${evidence.pagesAnalyzed} pages with ${evidence.avgInternalLinksPerPage} average internal links per page.`;

  return {
    summary: summaryText,
    issues,
    recommendations,
  };
}
