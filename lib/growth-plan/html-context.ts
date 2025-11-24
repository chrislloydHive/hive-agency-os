/**
 * HTML Context Extraction
 * 
 * Extracts structured page elements (headings, nav, CTAs, sections) from HTML
 * to provide better context to AI models instead of raw HTML blobs.
 */

import * as cheerio from 'cheerio';

export type PageType = 'home' | 'about' | 'blogIndex' | 'blogPost' | 'caseStudyIndex' | 'caseStudy' | 'services' | 'pricing' | 'other';

export interface PageElementContext {
  pageUrl: string;
  type: PageType;
  title?: string;
  headings: string[];
  navItems: string[];
  ctaLabels: string[];
  sectionTitles: string[];
  rawTextSample?: string; // First ~500 chars of main content
}

export interface BlogPost {
  title: string;
  url: string;
}

export interface CaseStudy {
  title: string;
  url: string;
}

export interface SiteElementContext {
  pages: PageElementContext[];
  blogPosts: BlogPost[];
  caseStudies: CaseStudy[];
}

/**
 * Build content inventory flags from crawled URLs (deterministic, crawl-driven)
 * This ensures contentInventory flags are based on actual URLs we accessed, not LLM guesses
 */
export function buildContentInventoryFromUrls(urls: string[]): {
  blogDetected: boolean;
  caseStudiesDetected: boolean;
  aboutPageDetected: boolean;
  faqDetected: boolean;
} {
  const lower = urls.map(u => u.toLowerCase());

  const blogDetected = lower.some(u =>
    u.includes('/blog') || u.includes('/insights') || u.includes('/articles') || u.includes('/news')
  );

  const caseStudiesDetected = lower.some(u =>
    u.includes('/case-studies') || u.includes('/case-study') || u.includes('/work') || u.includes('/portfolio') || u.includes('/projects')
  );

  const aboutPageDetected = lower.some(u =>
    u.endsWith('/about') || u.includes('/about-us') || u.includes('/about/') || u.includes('/team') || u.includes('/company')
  );

  const faqDetected = lower.some(u =>
    u.includes('/faq') || u.includes('/faqs') || u.includes('/questions') || u.includes('/help')
  );

  return {
    blogDetected,
    caseStudiesDetected,
    aboutPageDetected,
    faqDetected,
  };
}

/**
 * Detect analytics tools from HTML content
 * Checks for Google Analytics, GTM, and other common analytics platforms
 */
export function detectAnalyticsFromHTML(html: string): {
  googleAnalyticsDetected: boolean;
  gtmDetected: boolean;
  otherAnalyticsDetected: boolean;
} {
  const lowerHtml = html.toLowerCase();
  
  // Google Analytics detection
  const googleAnalyticsDetected = 
    lowerHtml.includes('gtag(') ||
    lowerHtml.includes('googleanalyticsobject') ||
    lowerHtml.includes('ga.js') ||
    lowerHtml.includes('analytics.js') ||
    lowerHtml.includes('google-analytics.com');
  
  // Google Tag Manager detection
  const gtmDetected = 
    lowerHtml.includes('www.googletagmanager.com') ||
    lowerHtml.includes('googletagmanager.com/gtm.js') ||
    lowerHtml.includes('gtm.js') ||
    lowerHtml.includes('dataLayer');
  
  // Other analytics platforms
  const otherAnalyticsDetected = 
    lowerHtml.includes('plausible.io') ||
    lowerHtml.includes('mixpanel') ||
    lowerHtml.includes('segment.com') ||
    lowerHtml.includes('segment.io') ||
    lowerHtml.includes('hotjar.com') ||
    lowerHtml.includes('amplitude.com') ||
    lowerHtml.includes('heap.io') ||
    lowerHtml.includes('fullstory.com') ||
    lowerHtml.includes('clarity.microsoft.com') ||
    lowerHtml.includes('matomo') ||
    lowerHtml.includes('piwik') ||
    lowerHtml.includes('adobe analytics') ||
    lowerHtml.includes('omniture') ||
    lowerHtml.includes('adobe.com/analytics');
  
  return {
    googleAnalyticsDetected,
    gtmDetected,
    otherAnalyticsDetected,
  };
}

/**
 * Detect analytics across multiple HTML pages
 * Returns true if any page shows a signal
 */
export function detectAnalyticsFromPages(htmlByUrl: Map<string, string>): {
  googleAnalyticsDetected: boolean;
  gtmDetected: boolean;
  otherAnalyticsDetected: boolean;
} {
  let googleAnalyticsDetected = false;
  let gtmDetected = false;
  let otherAnalyticsDetected = false;
  
  for (const html of htmlByUrl.values()) {
    const detection = detectAnalyticsFromHTML(html);
    googleAnalyticsDetected = googleAnalyticsDetected || detection.googleAnalyticsDetected;
    gtmDetected = gtmDetected || detection.gtmDetected;
    otherAnalyticsDetected = otherAnalyticsDetected || detection.otherAnalyticsDetected;
  }
  
  return {
    googleAnalyticsDetected,
    gtmDetected,
    otherAnalyticsDetected,
  };
}

/**
 * Determine page type from URL
 */
function determinePageType(url: string, isHomepage: boolean): PageType {
  if (isHomepage) return 'home';
  
  const urlPath = new URL(url).pathname.toLowerCase();
  
  // About/Team pages
  if (urlPath.includes('/about') || urlPath.includes('/team') || urlPath.includes('/company') || urlPath.includes('/who-we-are')) {
    return 'about';
  }
  
  // Blog index pages
  if (urlPath === '/blog' || urlPath === '/blog/' || urlPath === '/insights' || urlPath === '/insights/' || 
      urlPath === '/resources' || urlPath === '/resources/' || urlPath === '/articles' || urlPath === '/articles/') {
    return 'blogIndex';
  }
  
  // Blog post pages
  if (urlPath.includes('/blog/') || urlPath.includes('/insights/') || urlPath.includes('/resources/') || 
      urlPath.includes('/articles/') || urlPath.includes('/post/')) {
    return 'blogPost';
  }
  
  // Case study index pages
  if (urlPath === '/work' || urlPath === '/work/' || urlPath === '/case-studies' || urlPath === '/case-studies/' ||
      urlPath === '/portfolio' || urlPath === '/portfolio/' || urlPath === '/projects' || urlPath === '/projects/') {
    return 'caseStudyIndex';
  }
  
  // Case study pages
  if (urlPath.includes('/work/') || urlPath.includes('/case-studies/') || urlPath.includes('/case-study/') ||
      urlPath.includes('/portfolio/') || urlPath.includes('/projects/')) {
    return 'caseStudy';
  }
  
  // Services pages
  if (urlPath.includes('/services') || urlPath.includes('/what-we-do') || urlPath.includes('/solutions')) {
    return 'services';
  }
  
  // Pricing pages
  if (urlPath.includes('/pricing') || urlPath.includes('/plans') || urlPath.includes('/prices')) {
    return 'pricing';
  }
  
  return 'other';
}

/**
 * Extract structured page elements from HTML
 */
function extractPageElements(html: string, pageUrl: string, isHomepage: boolean = false): PageElementContext {
  const $ = cheerio.load(html);
  
  // Extract page title
  const title = $('title').text().trim() || undefined;
  
  // Determine page type
  const pageType = determinePageType(pageUrl, isHomepage);
  
  // Extract raw text sample (first 500-1000 chars of main content)
  let rawTextSample: string | undefined;
  const mainContentSelectors = ['main', 'article', '[role="main"]', '.content', '.main-content', '#content'];
  for (const selector of mainContentSelectors) {
    const content = $(selector).first().text().trim();
    if (content && content.length > 50) {
      // Extract 500-1000 chars, preferring closer to 1000 if available
      rawTextSample = content.substring(0, Math.min(1000, content.length)).replace(/\s+/g, ' ').trim();
      break;
    }
  }
  // Fallback to body text if no main content found
  if (!rawTextSample) {
    const bodyText = $('body').text().trim();
    rawTextSample = bodyText.substring(0, Math.min(1000, bodyText.length)).replace(/\s+/g, ' ').trim() || undefined;
  }
  
  // Extract headings (H1, H2, H3)
  const headings: string[] = [];
  $('h1, h2, h3').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length > 0 && text.length < 200) {
      headings.push(text);
    }
  });
  
  // Extract navigation items
  const navItems: string[] = [];
  // Common nav selectors
  const navSelectors = [
    'nav a',
    'header nav a',
    '.nav a',
    '.navigation a',
    '.navbar a',
    '.menu a',
    '[role="navigation"] a',
  ];
  
  navSelectors.forEach(selector => {
    $(selector).each((_, el) => {
      const text = $(el).text().trim();
      const href = $(el).attr('href');
      // Only include if it's a real nav link (not empty, not just #)
      if (text && text.length > 0 && text.length < 100 && href && href !== '#' && href !== '#/') {
        navItems.push(text);
      }
    });
  });
  
  // Remove duplicates from nav items
  const uniqueNavItems = Array.from(new Set(navItems));
  
  // Extract CTA button labels
  const ctaLabels: string[] = [];
  // Common CTA selectors
  const ctaSelectors = [
    'button',
    'a[class*="cta"]',
    'a[class*="button"]',
    'a[class*="btn"]',
    '.cta',
    '.button',
    '.btn',
    '[role="button"]',
  ];
  
  ctaSelectors.forEach(selector => {
    $(selector).each((_, el) => {
      const text = $(el).text().trim();
      // Filter out empty buttons and very long text (likely not CTAs)
      if (text && text.length > 0 && text.length < 50) {
        // Check if it looks like a CTA (common CTA words or short actionable text)
        const ctaKeywords = ['get', 'start', 'try', 'buy', 'sign', 'learn', 'contact', 'request', 'demo', 'download', 'join', 'subscribe'];
        const lowerText = text.toLowerCase();
        if (ctaKeywords.some(keyword => lowerText.includes(keyword)) || text.length < 30) {
          ctaLabels.push(text);
        }
      }
    });
  });
  
  // Remove duplicates from CTAs
  const uniqueCtaLabels = Array.from(new Set(ctaLabels));
  
  // Extract section titles (from common section patterns)
  const sectionTitles: string[] = [];
  const sectionSelectors = [
    'section h2',
    'section h3',
    '.section h2',
    '.section h3',
    '[class*="section"] h2',
    '[class*="section"] h3',
  ];
  
  sectionSelectors.forEach(selector => {
    $(selector).each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 0 && text.length < 150) {
        sectionTitles.push(text);
      }
    });
  });
  
  // Remove duplicates from section titles
  const uniqueSectionTitles = Array.from(new Set(sectionTitles));
  
  return {
    pageUrl,
    type: pageType,
    title,
    headings: headings.slice(0, 20), // Limit to top 20 headings
    navItems: uniqueNavItems.slice(0, 15), // Limit to top 15 nav items
    ctaLabels: uniqueCtaLabels.slice(0, 15), // Limit to top 15 CTAs
    sectionTitles: uniqueSectionTitles.slice(0, 15), // Limit to top 15 sections
    rawTextSample,
  };
}

/**
 * Extract blog posts from a blog index page
 */
function extractBlogPosts(html: string, baseUrl: string): BlogPost[] {
  const $ = cheerio.load(html);
  const blogPosts: BlogPost[] = [];
  const seenUrls = new Set<string>();

  // Common blog post container selectors
  const blogContainerSelectors = [
    'article',
    '[class*="blog"]',
    '[class*="post"]',
    '[class*="article"]',
    '[class*="entry"]',
    '.blog-post',
    '.post-card',
    '.article-card',
    '[id*="blog"]',
    '[id*="post"]',
  ];

  blogContainerSelectors.forEach(containerSelector => {
    $(containerSelector).each((_, container) => {
      // Try to find a link within the container
      const link = $(container).find('a').first();
      const href = link.attr('href');
      
      if (!href || href === '#' || href.startsWith('#')) return;

      // Resolve relative URLs
      let fullUrl: string;
      try {
        fullUrl = new URL(href, baseUrl).href;
      } catch {
        return;
      }

      // Skip if we've already seen this URL
      if (seenUrls.has(fullUrl)) return;
      seenUrls.add(fullUrl);

      // Try to extract title from various sources
      let title = '';
      
      // Try H2/H3 within the container
      const heading = $(container).find('h2, h3').first();
      if (heading.length) {
        title = heading.text().trim();
      }
      
      // Try link text
      if (!title) {
        title = link.text().trim();
      }
      
      // Try title attribute
      if (!title) {
        title = link.attr('title') || '';
      }
      
      // Try data attributes
      if (!title) {
        title = $(container).attr('data-title') || link.attr('data-title') || '';
      }

      // Try aria-label
      if (!title) {
        title = link.attr('aria-label') || '';
      }

      // Filter out invalid titles
      if (title && title.length > 3 && title.length < 200) {
        blogPosts.push({ title: title.trim(), url: fullUrl });
      }
    });
  });

  // Also check for direct links in blog-related sections
  const blogSectionSelectors = [
    'nav a[href*="/blog"]',
    'nav a[href*="/insights"]',
    'nav a[href*="/resources"]',
    'nav a[href*="/articles"]',
    '[class*="blog"] a',
    '[class*="post"] a',
  ];

  blogSectionSelectors.forEach(selector => {
    $(selector).each((_, el) => {
      const link = $(el);
      const href = link.attr('href');
      if (!href || href === '#' || href.startsWith('#')) return;

      let fullUrl: string;
      try {
        fullUrl = new URL(href, baseUrl).href;
      } catch {
        return;
      }

      // Only include if it looks like a blog post URL (not the index page)
      const urlPath = new URL(fullUrl).pathname.toLowerCase();
      if (urlPath === '/blog' || urlPath === '/blog/' || urlPath === '/insights' || urlPath === '/insights/') {
        return;
      }

      if (seenUrls.has(fullUrl)) return;
      seenUrls.add(fullUrl);

      const title = link.text().trim() || link.attr('title') || '';
      if (title && title.length > 3 && title.length < 200) {
        blogPosts.push({ title, url: fullUrl });
      }
    });
  });

  return blogPosts.slice(0, 50); // Limit to 50 blog posts
}

/**
 * Extract case studies from a case study/portfolio page
 */
function extractCaseStudies(html: string, baseUrl: string): CaseStudy[] {
  const $ = cheerio.load(html);
  const caseStudies: CaseStudy[] = [];
  const seenUrls = new Set<string>();

  // Common case study container selectors
  const caseStudyContainerSelectors = [
    '[class*="case-study"]',
    '[class*="casestudy"]',
    '[class*="portfolio"]',
    '[class*="work"]',
    '[class*="project"]',
    '.case-study',
    '.portfolio-item',
    '.work-item',
    '[id*="case-study"]',
    '[id*="portfolio"]',
  ];

  caseStudyContainerSelectors.forEach(containerSelector => {
    $(containerSelector).each((_, container) => {
      // Try to find a link within the container
      const link = $(container).find('a').first();
      const href = link.attr('href');
      
      if (!href || href === '#' || href.startsWith('#')) return;

      // Resolve relative URLs
      let fullUrl: string;
      try {
        fullUrl = new URL(href, baseUrl).href;
      } catch {
        return;
      }

      // Skip if we've already seen this URL
      if (seenUrls.has(fullUrl)) return;
      seenUrls.add(fullUrl);

      // Try to extract title from various sources
      let title = '';
      
      // Try H2/H3 within the container
      const heading = $(container).find('h2, h3').first();
      if (heading.length) {
        title = heading.text().trim();
      }
      
      // Try link text
      if (!title) {
        title = link.text().trim();
      }
      
      // Try title attribute
      if (!title) {
        title = link.attr('title') || '';
      }
      
      // Try data attributes
      if (!title) {
        title = $(container).attr('data-title') || link.attr('data-title') || '';
      }

      // Try aria-label
      if (!title) {
        title = link.attr('aria-label') || '';
      }

      // Filter out invalid titles
      if (title && title.length > 3 && title.length < 200) {
        caseStudies.push({ title: title.trim(), url: fullUrl });
      }
    });
  });

  // Also check for direct links in work/case study sections
  const caseStudySectionSelectors = [
    'nav a[href*="/work"]',
    'nav a[href*="/case-studies"]',
    'nav a[href*="/case-studies"]',
    'nav a[href*="/portfolio"]',
    '[class*="work"] a',
    '[class*="case-study"] a',
    '[class*="portfolio"] a',
  ];

  caseStudySectionSelectors.forEach(selector => {
    $(selector).each((_, el) => {
      const link = $(el);
      const href = link.attr('href');
      if (!href || href === '#' || href.startsWith('#')) return;

      let fullUrl: string;
      try {
        fullUrl = new URL(href, baseUrl).href;
      } catch {
        return;
      }

      // Only include if it looks like a case study URL (not the index page)
      const urlPath = new URL(fullUrl).pathname.toLowerCase();
      if (urlPath === '/work' || urlPath === '/work/' || 
          urlPath === '/case-studies' || urlPath === '/case-studies/' ||
          urlPath === '/portfolio' || urlPath === '/portfolio/') {
        return;
      }

      if (seenUrls.has(fullUrl)) return;
      seenUrls.add(fullUrl);

      const title = link.text().trim() || link.attr('title') || '';
      if (title && title.length > 3 && title.length < 200) {
        caseStudies.push({ title, url: fullUrl });
      }
    });
  });

  return caseStudies.slice(0, 50); // Limit to 50 case studies
}

/**
 * Check if a URL is a blog-related page
 */
function isBlogPage(url: string): boolean {
  const urlPath = new URL(url).pathname.toLowerCase();
  return urlPath.includes('/blog') || 
         urlPath.includes('/insights') || 
         urlPath.includes('/resources') ||
         urlPath.includes('/articles') ||
         urlPath.includes('/news');
}

/**
 * Check if a URL is a case study/portfolio page
 */
function isCaseStudyPage(url: string): boolean {
  const urlPath = new URL(url).pathname.toLowerCase();
  return urlPath.includes('/work') || 
         urlPath.includes('/case-studies') || 
         urlPath.includes('/case-studies') ||
         urlPath.includes('/portfolio') ||
         urlPath.includes('/projects');
}

/**
 * Discover key pages from navigation and footer links
 * Returns a prioritized list of URLs to fetch (max 8-10 pages including homepage)
 */
export function discoverKeyPages(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const discoveredUrls = new Set<string>();
  const baseUrlObj = new URL(baseUrl);
  
  // Priority order for page types
  const pagePatterns: Array<{ pattern: RegExp; priority: number }> = [
    { pattern: /^\/(about|team|company|who-we-are)/i, priority: 1 },
    { pattern: /^\/(blog|insights|resources|articles)(\/|$)/i, priority: 2 },
    { pattern: /^\/(work|case-studies|portfolio|projects)(\/|$)/i, priority: 3 },
    { pattern: /^\/(pricing|plans|prices)/i, priority: 4 },
    { pattern: /^\/(services|what-we-do|solutions)/i, priority: 5 },
  ];
  
  // Extract links from nav and footer
  const linkSelectors = [
    'nav a',
    'header nav a',
    'footer a',
    '.nav a',
    '.navigation a',
    '.navbar a',
    '.menu a',
    '[role="navigation"] a',
  ];
  
  const candidateUrls: Array<{ url: string; priority: number }> = [];
  
  linkSelectors.forEach(selector => {
    $(selector).each((_, el) => {
      const href = $(el).attr('href');
      if (!href || href === '#' || href.startsWith('#')) return;
      
      try {
        const fullUrl = new URL(href, baseUrl).href;
        const urlObj = new URL(fullUrl);
        
        // Only include same-domain URLs
        if (urlObj.hostname !== baseUrlObj.hostname) return;
        
        // Skip if already discovered
        if (discoveredUrls.has(fullUrl)) return;
        
        // Determine priority based on pathname
        const pathname = urlObj.pathname.toLowerCase();
        let priority = 10; // Default low priority
        
        for (const { pattern, priority: patternPriority } of pagePatterns) {
          if (pattern.test(pathname)) {
            priority = patternPriority;
            break;
          }
        }
        
        candidateUrls.push({ url: fullUrl, priority });
        discoveredUrls.add(fullUrl);
      } catch {
        // Skip invalid URLs
      }
    });
  });
  
  // Sort by priority and limit to 8-10 pages (including homepage)
  candidateUrls.sort((a, b) => a.priority - b.priority);
  
  // Return top 9 URLs (homepage will be added separately, so 9 + 1 = 10 max)
  return candidateUrls.slice(0, 9).map(c => c.url);
}

/**
 * Extract structured site context from HTML by URL
 */
export function extractSiteElementContext(htmlByUrl: Record<string, string>, homepageUrl?: string): SiteElementContext {
  const pages: PageElementContext[] = [];
  const blogPosts: BlogPost[] = [];
  const caseStudies: CaseStudy[] = [];
  
  // Determine homepage URL (first URL or explicitly provided)
  const homepage = homepageUrl || Object.keys(htmlByUrl)[0];
  
  for (const [url, html] of Object.entries(htmlByUrl)) {
    try {
      const isHomepage = url === homepage || (new URL(url).pathname === '/' || new URL(url).pathname === '');
      const pageContext = extractPageElements(html, url, isHomepage);
      pages.push(pageContext);
      
      // Extract blog posts if this is a blog page
      if (isBlogPage(url)) {
        const posts = extractBlogPosts(html, url);
        blogPosts.push(...posts);
      }
      
      // Extract case studies if this is a case study page
      if (isCaseStudyPage(url)) {
        const studies = extractCaseStudies(html, url);
        caseStudies.push(...studies);
      }
    } catch (error) {
      console.error(`Error extracting page elements from ${url}:`, error);
      // Continue with other pages even if one fails
    }
  }
  
  // Remove duplicates based on URL
  const uniqueBlogPosts = Array.from(
    new Map(blogPosts.map(post => [post.url, post])).values()
  );
  
  const uniqueCaseStudies = Array.from(
    new Map(caseStudies.map(study => [study.url, study])).values()
  );
  
  return { 
    pages,
    blogPosts: uniqueBlogPosts,
    caseStudies: uniqueCaseStudies,
  };
}

/**
 * Format competitor contexts for use in AI prompts
 */
export function formatCompetitorContextsForPrompt(competitorContexts: SiteElementContext[]): string {
  if (competitorContexts.length === 0) {
    return '';
  }
  
  const sections: string[] = [];
  sections.push(`\n\nCOMPETITOR ANALYSIS (${competitorContexts.length} competitor(s)):`);
  
  competitorContexts.forEach((competitorContext, index) => {
    const competitorPage = competitorContext.pages[0];
    if (!competitorPage) return;
    
    sections.push(`\nCompetitor ${index + 1}: ${competitorPage.pageUrl}`);
    
    if (competitorPage.title) {
      sections.push(`  Page Title: "${competitorPage.title}"`);
    }
    
    if (competitorPage.headings.length > 0) {
      sections.push(`  Top Headings:`);
      competitorPage.headings.slice(0, 5).forEach((heading, i) => {
        sections.push(`    ${i + 1}. ${heading}`);
      });
    }
    
    if (competitorPage.navItems.length > 0) {
      sections.push(`  Navigation: ${competitorPage.navItems.slice(0, 5).join(', ')}`);
    }
    
    if (competitorPage.ctaLabels.length > 0) {
      sections.push(`  CTAs: ${competitorPage.ctaLabels.slice(0, 5).map(c => `"${c}"`).join(', ')}`);
    }
    
    if (competitorContext.blogPosts.length > 0) {
      sections.push(`  Blog Posts: ${competitorContext.blogPosts.length} found`);
      competitorContext.blogPosts.slice(0, 3).forEach((post, i) => {
        sections.push(`    ${i + 1}. "${post.title}"`);
      });
    }
    
    if (competitorContext.caseStudies.length > 0) {
      sections.push(`  Case Studies: ${competitorContext.caseStudies.length} found`);
      competitorContext.caseStudies.slice(0, 3).forEach((study, i) => {
        sections.push(`    ${i + 1}. "${study.title}"`);
      });
    }
  });
  
  return sections.join('\n');
}

/**
 * Format site context for use in AI prompts
 */
export function formatSiteContextForPrompt(context: SiteElementContext): string {
  if (context.pages.length === 0) {
    return 'No page context available.';
  }
  
  const mainPage = context.pages[0]; // First page is typically the homepage
  
  const sections: string[] = [];
  
  // Page title
  if (mainPage.title) {
    sections.push(`Page Title: "${mainPage.title}"`);
  }
  
  // Top headings
  if (mainPage.headings.length > 0) {
    sections.push(`\nTop Headings (H1/H2/H3):`);
    mainPage.headings.slice(0, 10).forEach((heading, i) => {
      sections.push(`  ${i + 1}. ${heading}`);
    });
  }
  
  // Navigation items
  if (mainPage.navItems.length > 0) {
    sections.push(`\nNavigation Items:`);
    mainPage.navItems.forEach((item, i) => {
      sections.push(`  ${i + 1}. ${item}`);
    });
  }
  
  // CTA labels
  if (mainPage.ctaLabels.length > 0) {
    sections.push(`\nCall-to-Action Labels:`);
    mainPage.ctaLabels.forEach((cta, i) => {
      sections.push(`  ${i + 1}. "${cta}"`);
    });
  }
  
  // Section titles
  if (mainPage.sectionTitles.length > 0) {
    sections.push(`\nSection Titles:`);
    mainPage.sectionTitles.slice(0, 10).forEach((section, i) => {
      sections.push(`  ${i + 1}. ${section}`);
    });
  }
  
  // Raw text sample (important for positioning and messaging analysis)
  if (mainPage.rawTextSample) {
    sections.push(`\nContent Sample (first 500 chars):`);
    sections.push(`  ${mainPage.rawTextSample.substring(0, 500)}${mainPage.rawTextSample.length > 500 ? '...' : ''}`);
  }
  
  // Blog posts
  if (context.blogPosts.length > 0) {
    sections.push(`\n\nBlog Posts Found (${context.blogPosts.length}):`);
    context.blogPosts.slice(0, 10).forEach((post, i) => {
      sections.push(`  ${i + 1}. "${post.title}" - ${post.url}`);
    });
    if (context.blogPosts.length > 10) {
      sections.push(`  ... and ${context.blogPosts.length - 10} more`);
    }
  }
  
  // Case studies
  if (context.caseStudies.length > 0) {
    sections.push(`\n\nCase Studies Found (${context.caseStudies.length}):`);
    context.caseStudies.slice(0, 10).forEach((study, i) => {
      sections.push(`  ${i + 1}. "${study.title}" - ${study.url}`);
    });
    if (context.caseStudies.length > 10) {
      sections.push(`  ... and ${context.caseStudies.length - 10} more`);
    }
  }
  
  // Additional pages organized by type
  if (context.pages.length > 1) {
    sections.push(`\n\nAdditional Pages Analyzed (${context.pages.length - 1}):`);
    
    // Group pages by type
    const pagesByType = new Map<string, typeof context.pages>();
    context.pages.slice(1).forEach(page => {
      const type = page.type;
      if (!pagesByType.has(type)) {
        pagesByType.set(type, []);
      }
      pagesByType.get(type)!.push(page);
    });
    
    // Display pages by type
    const typeOrder: Array<{ type: string; label: string }> = [
      { type: 'about', label: 'About/Team Pages' },
      { type: 'blogIndex', label: 'Blog Index Pages' },
      { type: 'blogPost', label: 'Blog Posts' },
      { type: 'caseStudyIndex', label: 'Case Study Index Pages' },
      { type: 'caseStudy', label: 'Case Studies' },
      { type: 'services', label: 'Services Pages' },
      { type: 'pricing', label: 'Pricing Pages' },
      { type: 'other', label: 'Other Pages' },
    ];
    
    typeOrder.forEach(({ type, label }) => {
      const pagesOfType = pagesByType.get(type);
      if (pagesOfType && pagesOfType.length > 0) {
        sections.push(`\n${label} (${pagesOfType.length}):`);
        pagesOfType.slice(0, 5).forEach((page, i) => {
      if (page.title) {
            sections.push(`  ${i + 1}. ${page.title} (${page.pageUrl})`);
          } else {
            sections.push(`  ${i + 1}. ${page.pageUrl}`);
      }
      if (page.headings.length > 0) {
            sections.push(`     Headings: ${page.headings.slice(0, 3).join('; ')}`);
          }
          if (page.rawTextSample) {
            // Show more text for About pages (critical for positioning) and other important pages
            const sampleLength = page.type === 'about' ? 500 : 300;
            sections.push(`     Content Sample: ${page.rawTextSample.substring(0, sampleLength)}${page.rawTextSample.length > sampleLength ? '...' : ''}`);
          }
        });
        if (pagesOfType.length > 5) {
          sections.push(`  ... and ${pagesOfType.length - 5} more`);
        }
      }
    });
  }
  
  return sections.join('\n');
}

/**
 * Fetch HTML for a URL (with timeout)
 */
export async function fetchHTMLForContext(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout (reduced from 10s for faster failure)
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HiveSnapshotBot/1.0; +https://hiveadagency.com)',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return '';
    }
    
    return await response.text();
  } catch (error) {
    console.error(`Error fetching HTML for ${url}:`, error);
    return '';
  }
}

