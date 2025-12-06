// lib/contextGraph/fcb/signalCollector.ts
// Signal Collector for Foundational Context Builder
//
// Collects raw signals from a company's web presence including:
// - Homepage and key pages (About, Services, Pricing, Contact)
// - HTML meta tags and OpenGraph data
// - Schema.org structured data
// - Social media profile links

import * as puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import type {
  SignalBundle,
  PageContent,
  MetaTags,
  OpenGraphData,
  SchemaOrgData,
  SocialLinks,
  CollectionDiagnostic,
} from './types';

// ============================================================================
// Configuration
// ============================================================================

const PAGE_TIMEOUT = 30000; // 30 seconds
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Common paths for key pages
 */
const PAGE_DISCOVERY = {
  about: ['/about', '/about-us', '/about-us/', '/company', '/who-we-are'],
  services: ['/services', '/what-we-do', '/solutions', '/products', '/offerings'],
  pricing: ['/pricing', '/prices', '/plans', '/packages', '/rates'],
  contact: ['/contact', '/contact-us', '/get-in-touch', '/reach-us'],
} as const;

// ============================================================================
// Signal Collector Class
// ============================================================================

export class SignalCollector {
  private browser: puppeteer.Browser | null = null;

  /**
   * Initialize the browser
   */
  async initialize(): Promise<void> {
    if (!this.browser) {
      try {
        this.browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
          ],
        });
        console.log('[FCB SignalCollector] Browser initialized');
      } catch (error) {
        console.error('[FCB SignalCollector] Browser init failed:', error);
        throw new Error(
          `Browser initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  /**
   * Close the browser
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Collect all signals for a company
   */
  async collectSignals(
    companyId: string,
    domain: string,
    companyName: string
  ): Promise<SignalBundle> {
    const diagnostics: CollectionDiagnostic[] = [];
    const startTime = Date.now();

    try {
      await this.initialize();

      if (!this.browser) {
        throw new Error('Browser not initialized');
      }

      // Normalize domain to URL
      const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;

      console.log(`[FCB SignalCollector] Starting signal collection for ${baseUrl}`);

      // Collect homepage (required)
      const homepage = await this.collectPage(baseUrl, 'homepage', diagnostics);
      if (!homepage) {
        throw new Error(`Failed to load homepage: ${baseUrl}`);
      }

      // Extract structured data from homepage
      const $ = cheerio.load(homepage.html);
      const metaTags = this.extractMetaTags($);
      const openGraph = this.extractOpenGraph($);
      const schemaOrg = this.extractSchemaOrg($);
      const socialLinks = this.extractSocialLinks($);

      // Discover and collect key pages
      const aboutPage = await this.discoverAndCollectPage(
        baseUrl,
        PAGE_DISCOVERY.about,
        $,
        'about',
        diagnostics
      );
      const servicesPage = await this.discoverAndCollectPage(
        baseUrl,
        PAGE_DISCOVERY.services,
        $,
        'services',
        diagnostics
      );
      const pricingPage = await this.discoverAndCollectPage(
        baseUrl,
        PAGE_DISCOVERY.pricing,
        $,
        'pricing',
        diagnostics
      );
      const contactPage = await this.discoverAndCollectPage(
        baseUrl,
        PAGE_DISCOVERY.contact,
        $,
        'contact',
        diagnostics
      );

      const durationMs = Date.now() - startTime;
      console.log(`[FCB SignalCollector] Collection complete in ${durationMs}ms`);

      return {
        companyId,
        domain,
        companyName,
        homepage,
        aboutPage: aboutPage ?? undefined,
        servicesPage: servicesPage ?? undefined,
        pricingPage: pricingPage ?? undefined,
        contactPage: contactPage ?? undefined,
        metaTags,
        openGraph,
        schemaOrg: Object.keys(schemaOrg).length > 0 ? schemaOrg : undefined,
        socialLinks,
        collectedAt: new Date().toISOString(),
        collectionDiagnostics: diagnostics,
      };
    } catch (error) {
      diagnostics.push({
        code: 'COLLECTION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        severity: 'error',
      });

      throw error;
    } finally {
      await this.close();
    }
  }

  /**
   * Collect a single page
   */
  private async collectPage(
    url: string,
    pageType: string,
    diagnostics: CollectionDiagnostic[]
  ): Promise<PageContent | null> {
    if (!this.browser) return null;

    let page: puppeteer.Page | null = null;
    const startTime = Date.now();

    try {
      page = await this.browser.newPage();
      await page.setUserAgent(USER_AGENT);

      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: PAGE_TIMEOUT,
      });

      const loadTimeMs = Date.now() - startTime;
      const html = await page.content();
      const $ = cheerio.load(html);

      // Extract text content
      // Remove script and style elements
      $('script, style, noscript').remove();
      const text = $('body').text().replace(/\s+/g, ' ').trim();
      const title = $('title').text().trim();

      diagnostics.push({
        code: 'PAGE_LOADED',
        message: `${pageType} loaded in ${loadTimeMs}ms`,
        severity: 'info',
        context: url,
      });

      return {
        url,
        html,
        text,
        title,
        loadTimeMs,
      };
    } catch (error) {
      diagnostics.push({
        code: 'PAGE_LOAD_FAILED',
        message: `Failed to load ${pageType}: ${error instanceof Error ? error.message : 'Unknown'}`,
        severity: 'warning',
        context: url,
      });
      return null;
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * Discover and collect a key page
   */
  private async discoverAndCollectPage(
    baseUrl: string,
    paths: readonly string[],
    $homepage: cheerio.CheerioAPI,
    pageType: string,
    diagnostics: CollectionDiagnostic[]
  ): Promise<PageContent | null> {
    // First, try to find the page in navigation links
    const navLink = this.findNavLink($homepage, pageType);
    if (navLink) {
      const fullUrl = this.resolveUrl(baseUrl, navLink);
      const page = await this.collectPage(fullUrl, pageType, diagnostics);
      if (page) return page;
    }

    // Fall back to trying common paths
    for (const path of paths) {
      const fullUrl = `${baseUrl.replace(/\/$/, '')}${path}`;
      const page = await this.collectPage(fullUrl, pageType, diagnostics);
      if (page) return page;
    }

    diagnostics.push({
      code: 'PAGE_NOT_FOUND',
      message: `Could not find ${pageType} page`,
      severity: 'info',
    });

    return null;
  }

  /**
   * Find navigation link for a page type
   */
  private findNavLink($: cheerio.CheerioAPI, pageType: string): string | null {
    const selectors = [
      `a[href*="${pageType}"]`,
      `nav a:contains("${pageType}")`,
      `header a:contains("${pageType}")`,
    ];

    for (const selector of selectors) {
      const link = $(selector).first();
      if (link.length) {
        const href = link.attr('href');
        if (href && !href.startsWith('#')) {
          return href;
        }
      }
    }

    return null;
  }

  /**
   * Resolve relative URL to absolute
   */
  private resolveUrl(baseUrl: string, href: string): string {
    if (href.startsWith('http')) return href;
    if (href.startsWith('//')) return `https:${href}`;
    if (href.startsWith('/')) return `${baseUrl.replace(/\/$/, '')}${href}`;
    return `${baseUrl.replace(/\/$/, '')}/${href}`;
  }

  // ============================================================================
  // Extraction Methods
  // ============================================================================

  /**
   * Extract HTML meta tags
   */
  private extractMetaTags($: cheerio.CheerioAPI): MetaTags {
    return {
      title: $('title').text().trim() || undefined,
      description: $('meta[name="description"]').attr('content') || undefined,
      keywords: $('meta[name="keywords"]').attr('content') || undefined,
      author: $('meta[name="author"]').attr('content') || undefined,
      robots: $('meta[name="robots"]').attr('content') || undefined,
    };
  }

  /**
   * Extract OpenGraph data
   */
  private extractOpenGraph($: cheerio.CheerioAPI): OpenGraphData {
    return {
      title: $('meta[property="og:title"]').attr('content') || undefined,
      description: $('meta[property="og:description"]').attr('content') || undefined,
      image: $('meta[property="og:image"]').attr('content') || undefined,
      type: $('meta[property="og:type"]').attr('content') || undefined,
      siteName: $('meta[property="og:site_name"]').attr('content') || undefined,
      url: $('meta[property="og:url"]').attr('content') || undefined,
    };
  }

  /**
   * Extract Schema.org structured data
   */
  private extractSchemaOrg($: cheerio.CheerioAPI): SchemaOrgData {
    const result: SchemaOrgData = {};

    // Find JSON-LD scripts
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '{}');
        const items = Array.isArray(json) ? json : [json];

        for (const item of items) {
          const type = item['@type'];
          if (!type) continue;

          if (type === 'Organization' || type === 'Corporation') {
            result.organization = {
              name: item.name,
              description: item.description,
              url: item.url,
              logo: typeof item.logo === 'string' ? item.logo : item.logo?.url,
              address: item.address
                ? {
                    streetAddress: item.address.streetAddress,
                    addressLocality: item.address.addressLocality,
                    addressRegion: item.address.addressRegion,
                    postalCode: item.address.postalCode,
                    addressCountry: item.address.addressCountry,
                  }
                : undefined,
              contactPoint: item.contactPoint
                ? {
                    telephone: item.contactPoint.telephone,
                    email: item.contactPoint.email,
                    contactType: item.contactPoint.contactType,
                  }
                : undefined,
              sameAs: item.sameAs,
            };
          }

          if (type === 'LocalBusiness' || type.includes('Business')) {
            result.localBusiness = {
              name: item.name,
              description: item.description,
              priceRange: item.priceRange,
              openingHours: item.openingHours,
              areaServed: Array.isArray(item.areaServed)
                ? item.areaServed
                : item.areaServed
                  ? [item.areaServed]
                  : undefined,
              serviceArea: item.serviceArea,
            };
          }

          if (type === 'Product') {
            if (!result.product) result.product = [];
            result.product.push({
              name: item.name,
              description: item.description,
              offers: item.offers
                ? {
                    price: item.offers.price,
                    priceCurrency: item.offers.priceCurrency,
                  }
                : undefined,
            });
          }

          if (type === 'Service') {
            if (!result.service) result.service = [];
            result.service.push({
              name: item.name,
              description: item.description,
              provider: item.provider?.name,
              areaServed: item.areaServed,
            });
          }
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    });

    return result;
  }

  /**
   * Extract social media links
   */
  private extractSocialLinks($: cheerio.CheerioAPI): SocialLinks {
    const links: SocialLinks = {};

    const patterns: Array<{ key: keyof SocialLinks; pattern: RegExp }> = [
      { key: 'linkedin', pattern: /linkedin\.com\/(company|in)\/[\w-]+/i },
      { key: 'twitter', pattern: /twitter\.com\/[\w-]+/i },
      { key: 'facebook', pattern: /facebook\.com\/[\w.-]+/i },
      { key: 'instagram', pattern: /instagram\.com\/[\w.-]+/i },
      { key: 'youtube', pattern: /youtube\.com\/(channel|user|@)[\w-]+/i },
      { key: 'tiktok', pattern: /tiktok\.com\/@[\w.-]+/i },
    ];

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      for (const { key, pattern } of patterns) {
        if (!links[key] && pattern.test(href)) {
          links[key] = href;
        }
      }
    });

    return links;
  }
}

// ============================================================================
// Convenience Function
// ============================================================================

/**
 * Collect signals for a company (convenience wrapper)
 */
export async function collectSignals(
  companyId: string,
  domain: string,
  companyName: string
): Promise<SignalBundle> {
  const collector = new SignalCollector();
  return collector.collectSignals(companyId, domain, companyName);
}
