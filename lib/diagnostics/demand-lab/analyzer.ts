// lib/diagnostics/demand-lab/analyzer.ts
// Demand Lab Analyzer - Collects signals for demand generation analysis
//
// Analyzes:
// - Landing page patterns
// - CTAs and offers
// - Tracking/measurement setup
// - Ad scent trail patterns
// - GA4 analytics (if available)

import type {
  DemandAnalyzerInput,
  DemandAnalyzerOutput,
  LandingPageSignals,
  CtaSignals,
  TrackingSignals,
  AdScentSignals,
  DemandAnalyticsSnapshot,
  DemandDataConfidence,
  DemandLabFindings,
  AnalyzedPage,
  DiscoveredCta,
  TrackingTech,
  DemandCompanyType,
} from './types';
import { getGa4ClientFromWorkspace } from '@/lib/os/integrations/ga4Client';

// ============================================================================
// Company Type Normalizer
// ============================================================================

/**
 * Normalize raw company type string to canonical DemandCompanyType
 * Handles variations like "Services", "B2B Services", "SaaS", etc.
 */
function normalizeCompanyType(raw?: string | null): DemandCompanyType {
  if (!raw) return 'unknown';
  const lowered = raw.toLowerCase().trim();

  // Check for specific matches
  if (lowered.includes('saas') || lowered.includes('software')) return 'saas';
  if (lowered.includes('ecom') || lowered.includes('shop') || lowered.includes('retail')) return 'ecommerce';
  if (lowered.includes('local')) return 'local_service';
  if (lowered.includes('b2b')) return 'b2b_services';
  // "Services" without B2B prefix - assume B2B services
  if (lowered === 'services' || lowered.includes('agency') || lowered.includes('consult')) return 'b2b_services';

  return 'other';
}

// ============================================================================
// Main Analyzer Function
// ============================================================================

// Collected findings during analysis
interface CollectedFindings {
  pagesAnalyzed: AnalyzedPage[];
  ctasFound: DiscoveredCta[];
  trackingDetected: TrackingTech[];
}

/**
 * Analyze demand generation signals from website and analytics
 */
export async function analyzeDemandInputs(
  input: DemandAnalyzerInput
): Promise<DemandAnalyzerOutput & { findings: DemandLabFindings }> {
  // Support both url and websiteUrl for backwards compatibility
  const websiteUrl = input.url || input.websiteUrl || '';
  const { companyId, workspaceId } = input;

  // Normalize company type BEFORE scoring
  const normalizedCompanyType = normalizeCompanyType(input.companyType);

  console.log('[DemandAnalyzer] Starting analysis for:', websiteUrl, '| Company type:', normalizedCompanyType);

  // Initialize findings collector
  const findings: CollectedFindings = {
    pagesAnalyzed: [],
    ctasFound: [],
    trackingDetected: [],
  };

  // Crawl and analyze pages (passing findings to collect evidence)
  const pages = await crawlKeyPages(websiteUrl, findings);
  console.log('[DemandAnalyzer] Crawled', pages.length, 'pages');

  // Extract signals from crawled pages
  const landingPages = analyzeLandingPages(pages, findings);
  const ctas = analyzeCtaSignals(pages, findings);
  const tracking = analyzeTrackingSignals(pages, findings);
  const adScent = analyzeAdScentSignals(pages);

  // Try to get GA4 analytics directly (not via API)
  const analyticsSnapshot: DemandAnalyticsSnapshot | undefined = await fetchGa4AnalyticsDirect(workspaceId);

  if (analyticsSnapshot) {
    console.log('[DemandAnalyzer] GA4 data retrieved:', {
      sessions: analyticsSnapshot.sessionVolume,
      channels: analyticsSnapshot.topChannels?.length,
      conversionRate: analyticsSnapshot.conversionRate,
    });
  } else {
    console.log('[DemandAnalyzer] No GA4 data available');
  }

  // Compute data confidence
  const dataConfidence = computeDemandDataConfidence(analyticsSnapshot, pages.length);

  // V2: Compute detection flags for company-type-aware scoring
  const paidShare = analyticsSnapshot?.paidShare ?? analyticsSnapshot?.paidTrafficShare ?? null;
  const hasPaidTraffic = (paidShare !== null && paidShare > 0.01) || tracking.hasRetargetingPixels;
  const hasRetargetingSignals = tracking.hasRetargetingPixels;
  const hasDedicatedLandingPages = landingPages.hasDedicatedLandingPages;
  const hasClearPrimaryCTA = ctas.primaryCta !== null && ctas.ctaClarityScore >= 60;
  const hasLeadCapture = landingPages.hasLeadCaptureForm;
  const utmUsageLevel = computeUtmUsageLevel(tracking, pages);
  const conversionEventsImplemented = tracking.hasConversionTracking || (analyticsSnapshot?.conversionRate !== null && analyticsSnapshot?.conversionRate !== undefined);
  const remarketingInfraLikely = tracking.hasRetargetingPixels || adScent.hasAdLandingPatterns;

  // Build channel insights from analytics
  const channelInsights = analyticsSnapshot ? buildChannelInsights(analyticsSnapshot) : undefined;

  // Build final findings object
  const finalFindings: DemandLabFindings = {
    pagesAnalyzed: findings.pagesAnalyzed,
    ctasFound: findings.ctasFound,
    trackingDetected: findings.trackingDetected,
    landingPageInsights: {
      totalPages: pages.length,
      dedicatedLandingPages: landingPages.landingPageUrls.length,
      pagesWithForms: pages.filter(p => p.hasForm).length,
      pagesWithClearCta: pages.filter(p => p.hasCta).length,
      urls: landingPages.landingPageUrls,
    },
    channelInsights,
  };

  console.log('[DemandAnalyzer] Analysis complete:', {
    pagesAnalyzed: finalFindings.pagesAnalyzed.length,
    ctasFound: finalFindings.ctasFound.length,
    trackingDetected: finalFindings.trackingDetected.filter(t => t.detected).length,
  });

  return {
    companyId,
    url: websiteUrl,
    companyType: normalizedCompanyType,
    landingPages,
    ctas,
    tracking,
    adScent,
    analyticsSnapshot,
    dataConfidence,
    findings: finalFindings,
    // V2 detection flags
    hasPaidTraffic,
    hasRetargetingSignals,
    hasDedicatedLandingPages,
    hasClearPrimaryCTA,
    hasLeadCapture,
    utmUsageLevel,
    conversionEventsImplemented,
    remarketingInfraLikely,
  };
}

/**
 * Build channel insights from analytics snapshot
 */
function buildChannelInsights(analytics: DemandAnalyticsSnapshot) {
  const topChannels = analytics.topChannels?.slice(0, 5).map((name, idx) => ({
    name,
    share: analytics.trafficMix?.[name] ?? (1 / (idx + 1)) * 0.5,
  })) || [];

  const paidShare = analytics.paidShare ?? analytics.paidTrafficShare ?? 0;

  return {
    topChannels,
    paidVsOrganic: {
      paid: paidShare,
      organic: 1 - paidShare,
    },
    hasMultiChannel: topChannels.length >= 3,
  };
}

/**
 * Compute UTM usage level from tracking signals
 */
function computeUtmUsageLevel(
  tracking: TrackingSignals,
  pages: CrawledPage[]
): 'none' | 'some' | 'consistent' {
  if (!tracking.hasUtmTracking) return 'none';

  // Check how many pages have UTM parameters in links
  let pagesWithUtm = 0;
  for (const page of pages) {
    if (page.html.includes('utm_source') || page.html.includes('utm_medium')) {
      pagesWithUtm++;
    }
  }

  const ratio = pages.length > 0 ? pagesWithUtm / pages.length : 0;
  if (ratio >= 0.5) return 'consistent';
  if (ratio > 0) return 'some';
  return 'none';
}

// ============================================================================
// Page Crawling
// ============================================================================

interface CrawledPage {
  url: string;
  path: string;
  html: string;
  title: string | null;
  isLandingPage: boolean;
  hasForm: boolean;
  hasCta: boolean;
  pageType: 'homepage' | 'landing' | 'pricing' | 'contact' | 'other';
}

/**
 * Determine page type from path and content
 */
function determinePageType(path: string, html: string): CrawledPage['pageType'] {
  const lowerPath = path.toLowerCase();
  if (lowerPath === '/' || lowerPath === '') return 'homepage';
  if (lowerPath.includes('pricing') || lowerPath.includes('plans')) return 'pricing';
  if (lowerPath.includes('contact') || lowerPath.includes('get-in-touch')) return 'contact';
  if (
    lowerPath.includes('demo') ||
    lowerPath.includes('trial') ||
    lowerPath.includes('get-started') ||
    lowerPath.includes('signup') ||
    lowerPath.includes('landing') ||
    lowerPath.includes('lp/')
  ) {
    return 'landing';
  }
  return 'other';
}

/**
 * Check if page has a form
 */
function pageHasForm(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    lower.includes('<form') &&
    (lower.includes('type="email"') ||
      lower.includes("type='email'") ||
      lower.includes('type="text"') ||
      lower.includes('name="email"') ||
      lower.includes('type="submit"'))
  );
}

/**
 * Check if page has clear CTA
 */
function pageHasCta(html: string): boolean {
  const lower = html.toLowerCase();
  const ctaPatterns = [
    'get started',
    'try free',
    'start free',
    'request demo',
    'book demo',
    'schedule demo',
    'contact us',
    'get quote',
    'sign up',
    'buy now',
    'learn more',
  ];
  return ctaPatterns.some((p) => lower.includes(p));
}

/**
 * Crawl key pages from the website
 */
async function crawlKeyPages(
  websiteUrl: string,
  findings: CollectedFindings
): Promise<CrawledPage[]> {
  const pages: CrawledPage[] = [];

  // Normalize URL
  const baseUrl = websiteUrl.replace(/\/$/, '');

  // Key paths to check for demand-related pages
  const keyPaths = [
    '/',
    '/demo',
    '/request-demo',
    '/get-started',
    '/trial',
    '/free-trial',
    '/pricing',
    '/contact',
    '/contact-us',
    '/get-quote',
    '/schedule',
    '/book',
    '/signup',
    '/sign-up',
    '/register',
    '/download',
    '/resources',
    '/landing',
    '/services',
    '/about',
  ];

  /**
   * Process a fetched page and add to pages + findings
   */
  const processPage = (url: string, path: string, html: string) => {
    const title = extractTitle(html);
    const pageType = determinePageType(path, html);
    const hasForm = pageHasForm(html);
    const hasCta = pageHasCta(html);

    const crawledPage: CrawledPage = {
      url,
      path,
      html,
      title,
      isLandingPage: pageType === 'landing' || pageType === 'homepage',
      hasForm,
      hasCta,
      pageType,
    };

    pages.push(crawledPage);

    // Add to findings
    findings.pagesAnalyzed.push({
      url,
      title,
      type: pageType,
      hasForm,
      hasCta,
    });
  };

  // Fetch homepage first
  try {
    const homepageHtml = await fetchPage(baseUrl);
    if (homepageHtml) {
      processPage(baseUrl, '/', homepageHtml);

      // Extract additional links from homepage
      const links = extractInternalLinks(homepageHtml, baseUrl);
      const landingPageLinks = links.filter((link) =>
        keyPaths.some((p) => link.path.includes(p.slice(1)) && p !== '/')
      );

      // Add found landing page links (up to 8)
      for (const link of landingPageLinks.slice(0, 8)) {
        if (!pages.some((p) => p.path === link.path)) {
          try {
            const html = await fetchPage(link.url);
            if (html && html.length > 500) {
              processPage(link.url, link.path, html);
            }
          } catch {
            // Skip failed pages
          }
        }
      }
    }
  } catch (error) {
    console.error('[DemandAnalyzer] Failed to crawl homepage:', error);
  }

  // Try to fetch common landing page paths (more paths)
  for (const path of keyPaths.slice(1)) {
    if (pages.length >= 12) break; // Cap at 12 pages
    if (pages.some((p) => p.path === path)) continue;

    try {
      const url = `${baseUrl}${path}`;
      const html = await fetchPage(url);
      // Check it's a real page (not 404)
      if (html && html.length > 1000 && !html.toLowerCase().includes('page not found')) {
        processPage(url, path, html);
      }
    } catch {
      // Path doesn't exist, skip
    }
  }

  return pages;
}

/**
 * Fetch a single page
 */
async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'HiveOS-DemandLab/1.0',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;

    const html = await response.text();
    return html;
  } catch {
    return null;
  }
}

/**
 * Extract title from HTML
 */
function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : null;
}

/**
 * Normalize a URL path (remove ./, ../, double slashes, etc.)
 */
function normalizePath(path: string): string {
  // Remove leading ./ or /./
  let normalized = path.replace(/^\.\//, '/').replace(/^\/\.\//, '/');
  // Remove any remaining ./
  normalized = normalized.replace(/\/\.\//g, '/');
  // Remove double slashes
  normalized = normalized.replace(/\/+/g, '/');
  // Ensure starts with /
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  // Remove trailing slash (except for root)
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

/**
 * Extract internal links from HTML
 */
function extractInternalLinks(
  html: string,
  baseUrl: string
): Array<{ url: string; path: string; text: string }> {
  const links: Array<{ url: string; path: string; text: string }> = [];
  const seenPaths = new Set<string>();
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)</gi;

  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const text = match[2].trim();

    // Skip external links, anchors, mailto, tel
    if (
      href.startsWith('http') &&
      !href.startsWith(baseUrl)
    )
      continue;
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:'))
      continue;
    if (href.startsWith('javascript:')) continue;

    // Normalize path
    let path = href;
    if (href.startsWith(baseUrl)) {
      path = href.replace(baseUrl, '') || '/';
    }

    // Clean up the path
    path = normalizePath(path);

    // Skip if we've already seen this path
    if (seenPaths.has(path)) continue;
    seenPaths.add(path);

    const url = `${baseUrl}${path}`;

    links.push({ url, path, text });
  }

  return links;
}

// ============================================================================
// Signal Analysis
// ============================================================================

/**
 * Analyze landing page signals
 */
function analyzeLandingPages(
  pages: CrawledPage[],
  findings: CollectedFindings
): LandingPageSignals {
  const landingPages = pages.filter((p) => p.isLandingPage);
  const dedicatedLandingPages = landingPages.filter((p) => p.path !== '/');

  // Check for offer clarity (presence of clear value props, headlines)
  const hasOfferClarity = landingPages.some((p) => {
    const html = p.html.toLowerCase();
    return (
      (html.includes('<h1') || html.includes('<h2')) &&
      (html.includes('get ') ||
        html.includes('start ') ||
        html.includes('try ') ||
        html.includes('free') ||
        html.includes('demo') ||
        html.includes('trial'))
    );
  });

  // Check for lead capture forms
  const hasLeadCaptureForm = pages.some((p) => p.hasForm);

  return {
    landingPageCount: landingPages.length,
    hasDedicatedLandingPages: dedicatedLandingPages.length > 0,
    landingPageUrls: dedicatedLandingPages.map((p) => p.url),
    hasOfferClarity,
    hasLeadCaptureForm,
  };
}

/**
 * Analyze CTA signals
 */
function analyzeCtaSignals(
  pages: CrawledPage[],
  findings: CollectedFindings
): CtaSignals {
  const allCtas: Array<{ text: string; type: string; pageUrl: string; isPrimary: boolean }> = [];

  for (const page of pages) {
    const html = page.html;
    let foundOnPage = 0;

    // Find buttons and CTA-like links
    const buttonRegex =
      /<button[^>]*>([^<]+)<\/button>|<a[^>]+class="[^"]*(?:btn|button|cta)[^"]*"[^>]*>([^<]+)</gi;
    let match;
    while ((match = buttonRegex.exec(html)) !== null) {
      const text = (match[1] || match[2] || '').trim();
      if (text && text.length > 2 && text.length < 50) {
        const type = classifyCtaType(text.toLowerCase());
        allCtas.push({
          text,
          type,
          pageUrl: page.url,
          isPrimary: foundOnPage === 0, // First CTA on page is primary
        });
        foundOnPage++;
      }
    }

    // Also check for common CTA patterns in links
    const ctaPatterns = [
      'get started',
      'try free',
      'start free',
      'request demo',
      'book demo',
      'schedule demo',
      'contact us',
      'get quote',
      'sign up',
      'register',
      'download',
      'learn more',
      'buy now',
      'subscribe',
    ];

    for (const pattern of ctaPatterns) {
      if (html.toLowerCase().includes(pattern)) {
        const type = classifyCtaType(pattern);
        if (!allCtas.some((c) => c.text.toLowerCase().includes(pattern))) {
          allCtas.push({
            text: pattern,
            type,
            pageUrl: page.url,
            isPrimary: foundOnPage === 0,
          });
          foundOnPage++;
        }
      }
    }
  }

  // Dedupe by text (case insensitive)
  const uniqueCtasMap = new Map<string, typeof allCtas[0]>();
  for (const cta of allCtas) {
    const key = cta.text.toLowerCase();
    if (!uniqueCtasMap.has(key)) {
      uniqueCtasMap.set(key, cta);
    }
  }
  const uniqueCtas = [...uniqueCtasMap.values()];

  // Add to findings
  for (const cta of uniqueCtas.slice(0, 15)) {
    findings.ctasFound.push({
      text: cta.text,
      type: cta.type as DiscoveredCta['type'],
      pageUrl: cta.pageUrl,
      isPrimary: cta.isPrimary,
    });
  }

  const ctaTypes = [...new Set(uniqueCtas.map((c) => c.type))] as CtaSignals['ctaTypes'];

  // Find primary CTA - prefer conversion-oriented CTAs over "learn more" types
  // Priority: demo > trial > contact > buy > download > subscribe > learn > other
  const ctaPriority: Record<string, number> = {
    demo: 1,
    trial: 2,
    contact: 3,
    buy: 4,
    download: 5,
    subscribe: 6,
    learn: 7,
    other: 8,
  };

  // Sort CTAs by priority (lower = better), then by isPrimary
  const sortedCtas = [...uniqueCtas].sort((a, b) => {
    const priorityA = ctaPriority[a.type] ?? 8;
    const priorityB = ctaPriority[b.type] ?? 8;
    if (priorityA !== priorityB) return priorityA - priorityB;
    // If same priority, prefer isPrimary
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    return 0;
  });

  const primaryCta = sortedCtas[0]?.text || null;

  // Check for competing CTAs (multiple different primary actions)
  const primaryCtaTypes = ctaTypes.filter((t) =>
    ['demo', 'trial', 'contact', 'buy'].includes(t)
  );
  const hasCompetingCtas = primaryCtaTypes.length > 2;

  // CTA clarity score
  let ctaClarityScore = 50;
  if (uniqueCtas.length > 0) ctaClarityScore += 20;
  if (primaryCta) ctaClarityScore += 15;
  if (!hasCompetingCtas) ctaClarityScore += 15;
  ctaClarityScore = Math.min(100, ctaClarityScore);

  return {
    ctaCount: uniqueCtas.length,
    primaryCta,
    ctaTypes,
    ctaClarityScore,
    hasCompetingCtas,
  };
}

/**
 * Classify CTA type from text
 */
function classifyCtaType(
  text: string
): 'demo' | 'trial' | 'contact' | 'download' | 'subscribe' | 'buy' | 'learn' | 'other' {
  const lower = text.toLowerCase();
  if (lower.includes('demo') || lower.includes('schedule') || lower.includes('book'))
    return 'demo';
  if (lower.includes('trial') || lower.includes('try') || lower.includes('start'))
    return 'trial';
  if (lower.includes('contact') || lower.includes('quote') || lower.includes('talk'))
    return 'contact';
  if (lower.includes('download') || lower.includes('get ebook') || lower.includes('get guide'))
    return 'download';
  if (lower.includes('subscribe') || lower.includes('newsletter') || lower.includes('sign up'))
    return 'subscribe';
  if (lower.includes('buy') || lower.includes('purchase') || lower.includes('order'))
    return 'buy';
  if (lower.includes('learn') || lower.includes('more') || lower.includes('explore'))
    return 'learn';
  return 'other';
}

/**
 * Analyze tracking signals
 */
function analyzeTrackingSignals(
  pages: CrawledPage[],
  findings: CollectedFindings
): TrackingSignals {
  let hasUtmTracking = false;
  let hasConversionTracking = false;
  let hasAnalytics = false;
  let hasRetargetingPixels = false;

  // Track which technologies we've detected
  const detectedTech = {
    googleAnalytics: false,
    googleTagManager: false,
    facebookPixel: false,
    linkedInPixel: false,
    googleAds: false,
    hotjar: false,
    hubspot: false,
    intercom: false,
    segment: false,
  };

  for (const page of pages) {
    const html = page.html.toLowerCase();

    // Check for UTM parameters in links
    if (html.includes('utm_source') || html.includes('utm_medium') || html.includes('utm_campaign')) {
      hasUtmTracking = true;
    }

    // Check for Google Analytics / GA4
    if (
      html.includes('google-analytics') ||
      html.includes('gtag') ||
      html.includes('ga.js') ||
      html.includes('analytics.js') ||
      html.includes('g-') // GA4 measurement ID pattern
    ) {
      hasAnalytics = true;
      detectedTech.googleAnalytics = true;
    }

    // Check for Google Tag Manager
    if (html.includes('googletagmanager') || html.includes('gtm.js')) {
      hasAnalytics = true;
      detectedTech.googleTagManager = true;
    }

    // Check for Facebook Pixel
    if (
      html.includes('facebook.com/tr') ||
      html.includes('fbq(') ||
      html.includes('connect.facebook') ||
      html.includes('fb-pixel')
    ) {
      hasRetargetingPixels = true;
      detectedTech.facebookPixel = true;
    }

    // Check for LinkedIn Pixel
    if (
      html.includes('linkedin.com/px') ||
      html.includes('snap.licdn.com') ||
      html.includes('ads.linkedin.com') ||
      html.includes('_linkedin_partner_id')
    ) {
      hasRetargetingPixels = true;
      detectedTech.linkedInPixel = true;
    }

    // Check for Google Ads
    if (
      html.includes('googleadservices') ||
      html.includes('googlesyndication') ||
      html.includes('gclid')
    ) {
      hasRetargetingPixels = true;
      detectedTech.googleAds = true;
    }

    // Check for HotJar
    if (html.includes('hotjar') || html.includes('hj(')) {
      detectedTech.hotjar = true;
    }

    // Check for HubSpot
    if (html.includes('hubspot') || html.includes('hs-scripts') || html.includes('hbspt')) {
      detectedTech.hubspot = true;
      hasConversionTracking = true;
    }

    // Check for Intercom
    if (html.includes('intercom') || html.includes('intercomcdn')) {
      detectedTech.intercom = true;
    }

    // Check for Segment
    if (html.includes('segment.com') || html.includes('analytics.js')) {
      detectedTech.segment = true;
      hasAnalytics = true;
    }

    // Check for conversion tracking patterns
    if (
      html.includes('thank') ||
      html.includes('confirmation') ||
      html.includes('success') ||
      html.includes('conversion')
    ) {
      hasConversionTracking = true;
    }

    // Check for form tracking
    if (html.includes('form') && (html.includes('submit') || html.includes('action='))) {
      hasConversionTracking = true;
    }
  }

  // Build tracking tech findings
  const trackingTechList: TrackingTech[] = [
    { name: 'Google Analytics / GA4', type: 'analytics', detected: detectedTech.googleAnalytics },
    { name: 'Google Tag Manager', type: 'tag_manager', detected: detectedTech.googleTagManager },
    { name: 'Facebook Pixel', type: 'retargeting', detected: detectedTech.facebookPixel },
    { name: 'LinkedIn Insight Tag', type: 'retargeting', detected: detectedTech.linkedInPixel },
    { name: 'Google Ads', type: 'conversion', detected: detectedTech.googleAds },
    { name: 'HubSpot', type: 'analytics', detected: detectedTech.hubspot },
    { name: 'Hotjar', type: 'analytics', detected: detectedTech.hotjar },
    { name: 'Intercom', type: 'analytics', detected: detectedTech.intercom },
    { name: 'Segment', type: 'analytics', detected: detectedTech.segment },
  ];

  // Add to findings
  findings.trackingDetected = trackingTechList;

  return {
    hasUtmTracking,
    hasConversionTracking,
    hasAnalytics,
    hasRetargetingPixels,
  };
}

/**
 * Analyze ad scent trail signals
 */
function analyzeAdScentSignals(pages: CrawledPage[]): AdScentSignals {
  let hasAdLandingPatterns = false;
  let messageConsistency: AdScentSignals['messageConsistency'] = 'unknown';

  for (const page of pages) {
    const html = page.html.toLowerCase();

    // Check for ad landing page patterns
    if (
      page.path.includes('lp') ||
      page.path.includes('landing') ||
      page.path.includes('promo') ||
      page.path.includes('offer') ||
      page.path.includes('campaign')
    ) {
      hasAdLandingPatterns = true;
    }

    // Check for UTM patterns suggesting ad traffic
    if (html.includes('utm_source') || html.includes('gclid') || html.includes('fbclid')) {
      hasAdLandingPatterns = true;
    }
  }

  // Basic message consistency check
  // (In a real implementation, this would use NLP to compare headlines/messaging)
  const headlines: string[] = [];
  for (const page of pages) {
    const h1Match = page.html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) {
      headlines.push(h1Match[1].trim().toLowerCase());
    }
  }

  if (headlines.length >= 2) {
    // Simple check: do headlines share any key words?
    const words = headlines.flatMap((h) => h.split(/\s+/).filter((w) => w.length > 3));
    const uniqueWords = new Set(words);
    const repetitionRatio = words.length / uniqueWords.size;

    if (repetitionRatio > 1.5) {
      messageConsistency = 'strong';
    } else if (repetitionRatio > 1.2) {
      messageConsistency = 'moderate';
    } else {
      messageConsistency = 'weak';
    }
  }

  return {
    hasAdLandingPatterns,
    messageConsistency,
  };
}

// ============================================================================
// Analytics Integration
// ============================================================================

/**
 * Fetch GA4 analytics directly using the GA4 client (not via API)
 * This is the proper way to get analytics data server-side
 */
async function fetchGa4AnalyticsDirect(
  workspaceId?: string
): Promise<DemandAnalyticsSnapshot | undefined> {
  try {
    // Get GA4 client from workspace settings or env vars
    const ga4Config = await getGa4ClientFromWorkspace(workspaceId);

    if (!ga4Config) {
      console.log('[DemandAnalyzer] No GA4 configuration available');
      return undefined;
    }

    const { client, propertyId } = ga4Config;

    // Get date range (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log('[DemandAnalyzer] Fetching GA4 data:', { propertyId, startDateStr, endDateStr });

    // Run queries in parallel
    const [trafficResponse, channelsResponse] = await Promise.all([
      // Traffic summary
      client.runReport({
        property: propertyId,
        dateRanges: [{ startDate: startDateStr, endDate: endDateStr }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'conversions' },
        ],
      }),
      // Channels breakdown
      client.runReport({
        property: propertyId,
        dateRanges: [{ startDate: startDateStr, endDate: endDateStr }],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [
          { name: 'sessions' },
          { name: 'conversions' },
        ],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 10,
      }),
    ]);

    // Parse traffic summary
    const trafficRow = trafficResponse[0]?.rows?.[0];
    const sessions = trafficRow?.metricValues?.[0]?.value
      ? parseInt(trafficRow.metricValues[0].value)
      : null;
    const totalUsers = trafficRow?.metricValues?.[1]?.value
      ? parseInt(trafficRow.metricValues[1].value)
      : null;
    const conversions = trafficRow?.metricValues?.[2]?.value
      ? parseInt(trafficRow.metricValues[2].value)
      : 0;

    // Calculate conversion rate (cap at 100% since GA4 conversions can include multiple events per session)
    // If conversions > sessions, it likely means there are duplicate conversion events - report conservatively
    let conversionRate: number | null = null;
    if (sessions && sessions > 0) {
      // Use users as denominator if conversions exceed sessions (more conservative)
      const denominator = conversions > sessions && totalUsers ? totalUsers : sessions;
      conversionRate = Math.min(conversions / denominator, 1.0); // Cap at 100%
    }

    // Parse channels
    const channelsRows = channelsResponse[0]?.rows || [];
    const trafficMix: Record<string, number> = {};
    const topChannels: string[] = [];
    let paidSessions = 0;
    const totalSessions = sessions || 0;

    for (const row of channelsRows) {
      const channel = row.dimensionValues?.[0]?.value || 'Unknown';
      const channelSessions = row.metricValues?.[0]?.value
        ? parseInt(row.metricValues[0].value)
        : 0;

      topChannels.push(channel);

      // Calculate percentage
      if (totalSessions > 0) {
        trafficMix[channel] = channelSessions / totalSessions;
      }

      // Track paid sessions
      if (
        channel.toLowerCase().includes('paid') ||
        channel.toLowerCase().includes('cpc') ||
        channel.toLowerCase().includes('display') ||
        channel.toLowerCase().includes('shopping')
      ) {
        paidSessions += channelSessions;
      }
    }

    const paidShare = totalSessions > 0 ? paidSessions / totalSessions : null;

    return {
      trafficMix,
      topChannels,
      conversionRate,
      paidShare,
      sessionVolume: sessions,
      totalConversions: conversions,
      // Legacy aliases
      paidTrafficShare: paidShare,
      totalSessions: sessions ?? undefined,
    };
  } catch (error) {
    console.error('[DemandAnalyzer] GA4 fetch error:', error);
    return undefined;
  }
}

// ============================================================================
// Data Confidence (V2)
// ============================================================================

/**
 * Compute data confidence based on available data
 * V2: More nuanced confidence calculation aligned with spec
 */
function computeDemandDataConfidence(
  analytics: DemandAnalyticsSnapshot | undefined,
  pageCount: number
): DemandDataConfidence {
  if (!analytics) {
    return {
      score: 20,
      level: 'low',
      reason: 'No analytics snapshot available. Demand insights are based on visible site patterns only.',
    };
  }

  let score = 40;
  const reasonParts: string[] = [];

  // Session volume check
  const sessionVolume = analytics.sessionVolume ?? analytics.totalSessions ?? 0;
  if (sessionVolume > 1000) {
    score += 20;
    reasonParts.push('Sufficient traffic volume for directional insights.');
  } else {
    reasonParts.push('Limited traffic volume; treat trends as directional.');
  }

  // Conversion events check
  if (analytics.conversionRate !== null && analytics.conversionRate !== undefined) {
    score += 15;
    reasonParts.push('Conversion events detected in GA4.');
  } else {
    reasonParts.push('No conversion events detected; funnel performance is inferred.');
  }

  // Paid traffic share check
  const paidShare = analytics.paidShare ?? analytics.paidTrafficShare ?? 0;
  if (paidShare > 0.05) {
    score += 15;
    reasonParts.push('Paid traffic share detected in analytics.');
  } else {
    reasonParts.push('Little or no clear paid traffic detected.');
  }

  const finalScore = Math.min(score, 90);
  const level: DemandDataConfidence['level'] =
    finalScore >= 70 ? 'high' : finalScore >= 40 ? 'medium' : 'low';

  return {
    score: finalScore,
    level,
    reason: reasonParts.join(' '),
  };
}

// Legacy alias for backwards compatibility
const computeDataConfidence = computeDemandDataConfidence;
