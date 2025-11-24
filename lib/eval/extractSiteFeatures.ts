/**
 * SiteFeatures Extraction
 * 
 * Extracts SiteFeatures from evaluation input by parsing HTML and detecting signals.
 * Uses cheerio for HTML parsing and simple heuristics for signal detection.
 */

import * as cheerio from 'cheerio';
import { SiteFeatures, createEmptySiteFeatures } from './siteFeatures';

/**
 * Evaluation Input
 * 
 * Input structure for evaluating a website and generating a Growth Acceleration Plan (GAP).
 * This will be replaced with a proper schema in future tasks.
 */
export interface EvaluationInput {
  websiteUrl: string;
  pageHtml?: string;
  textBlocks?: string[];
  competitors?: string[];
  category?: string;
}

/**
 * Extract SiteFeatures from evaluation input
 * 
 * Parses HTML and extracts structured signals for scoring.
 * Uses simple heuristics and pattern matching to detect features.
 * 
 * @param input - Evaluation input containing website URL and optional HTML/content
 * @returns SiteFeatures object with all detected signals
 */
export function extractSiteFeatures(input: EvaluationInput): SiteFeatures {
  const features = createEmptySiteFeatures(input.websiteUrl);

  // Parse HTML if provided
  if (!input.pageHtml) {
    // No HTML provided, return empty features
    return features;
  }

  const $ = cheerio.load(input.pageHtml);

  // ============================================
  // NAVIGATION SIGNALS
  // ============================================
  
  // Extract top-level navigation item labels
  const navSelectors = [
    'header nav a',
    'nav[role="navigation"] a',
    '.navbar a',
    '.nav a',
    '.main-nav a',
    '.primary-nav a',
    'header a[href]',
  ];

  const navItems: string[] = [];
  navSelectors.forEach(selector => {
    $(selector).each((_, el) => {
      const text = $(el).text().trim();
      const href = $(el).attr('href') || '';
      
      // Skip empty text, skip anchors, skip common non-nav links
      if (text && 
          text.length > 0 && 
          text.length < 50 && // Reasonable nav item length
          !href.startsWith('#') &&
          !text.toLowerCase().includes('skip to') &&
          !text.toLowerCase().includes('cookie')) {
        navItems.push(text);
      }
    });
  });

  // Deduplicate nav items
  const uniqueNavItems = Array.from(new Set(navItems));
  features.navigation.navItemLabels = uniqueNavItems;

  // Detect specific nav types by checking labels (case-insensitive)
  const navLabelsLower = uniqueNavItems.map(item => item.toLowerCase());
  
  features.navigation.hasProductNav = navLabelsLower.some(label => 
    label.includes('product') || label.includes('products')
  );
  features.navigation.hasSolutionsNav = navLabelsLower.some(label => 
    label.includes('solution') || label.includes('solutions')
  );
  features.navigation.hasResourcesNav = navLabelsLower.some(label => 
    label.includes('resource') || label.includes('resources') ||
    label.includes('learn') || label.includes('library')
  );
  features.navigation.hasPricingNav = navLabelsLower.some(label => 
    label.includes('pricing') || label.includes('price') || label.includes('plan')
  );
  features.navigation.hasBlogNav = navLabelsLower.some(label => 
    label.includes('blog') || label.includes('article') || label.includes('news')
  );
  features.navigation.hasDocsNav = navLabelsLower.some(label => 
    label.includes('doc') || label.includes('guide') || label.includes('help') ||
    label.includes('support') || label.includes('api')
  );

  // ============================================
  // CONTENT SIGNALS
  // ============================================
  // Improved content detection: Use navigation and links as hints of a bigger content ecosystem
  // This helps detect content systems even when we only fetch the homepage

  // Collect all links from the page
  const allLinks = $('a[href]').map((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().toLowerCase().trim();
    return { href: href.toLowerCase(), text };
  }).get();

  // Content-related path patterns to detect
  const blogPatterns = [
    '/blog', '/article', '/post', '/posts', '/news', '/journal', '/insights',
    '/blog/', '/articles/', '/posts/', '/news/', '/journal/', '/insights/'
  ];
  
  const resourcesPatterns = [
    '/resources', '/resource', '/learn', '/academy', '/library', '/hub',
    '/resources/', '/learn/', '/academy/', '/library/', '/hub/'
  ];
  
  const docsPatterns = [
    '/docs', '/documentation', '/doc', '/guide', '/guides', '/help',
    '/knowledge-base', '/knowledge', '/kb', '/support', '/api',
    '/docs/', '/documentation/', '/guide/', '/guides/', '/help/',
    '/knowledge-base/', '/knowledge/', '/kb/', '/support/', '/api/'
  ];
  
  const caseStudyPatterns = [
    '/case-study', '/case_study', '/casestudy', '/case-studies',
    '/customer-story', '/customer-stories', '/success-story', '/success-stories',
    '/customers', '/portfolio', '/work', '/projects',
    '/case-study/', '/case-studies/', '/customer-story/', '/customers/', '/portfolio/'
  ];

  // Detect content ecosystem from links (not just current page content)
  let hasBlogLink = false;
  let hasResourcesLink = false;
  let hasDocsLink = false;
  let hasCaseStudyLink = false;
  
  // Also check navigation labels (already extracted above)
  const navHasBlog = features.navigation.hasBlogNav;
  const navHasResources = features.navigation.hasResourcesNav;
  const navHasDocs = features.navigation.hasDocsNav;

  // Scan all links for content patterns
  allLinks.forEach(({ href, text }) => {
    // Check for blog patterns
    if (blogPatterns.some(pattern => href.includes(pattern)) ||
        text.includes('blog') || text.includes('article') || text.includes('news')) {
      hasBlogLink = true;
    }
    
    // Check for resources/academy patterns
    if (resourcesPatterns.some(pattern => href.includes(pattern)) ||
        text.includes('resources') || text.includes('learn') || text.includes('academy') ||
        text.includes('library') || text.includes('hub')) {
      hasResourcesLink = true;
    }
    
    // Check for docs/guides patterns
    if (docsPatterns.some(pattern => href.includes(pattern)) ||
        text.includes('doc') || text.includes('guide') || text.includes('help') ||
        text.includes('knowledge') || text.includes('support') || text.includes('api')) {
      hasDocsLink = true;
    }
    
    // Check for case study patterns
    if (caseStudyPatterns.some(pattern => href.includes(pattern)) ||
        text.includes('case study') || text.includes('customer story') ||
        text.includes('success story') || text.includes('portfolio')) {
      hasCaseStudyLink = true;
    }
  });

  // Set content flags based on links OR navigation
  features.content.hasBlog = hasBlogLink || navHasBlog;
  features.content.hasResourcesHub = hasResourcesLink || navHasResources;
  features.content.hasDocsOrGuides = hasDocsLink || navHasDocs;
  features.content.hasCaseStudiesSection = hasCaseStudyLink;

  // Count blog posts from current page (if visible)
  const blogPostElements = $('article.post, article.blog, .blog-post, .post-card, .blog-card, .article-card').length;
  const blogLinksOnPage = allLinks.filter(({ href }) => 
    blogPatterns.some(pattern => href.includes(pattern))
  ).length;

  // Count case studies from current page (if visible)
  const caseStudyElements = $('.case-study, .case-study-card, .customer-story, .success-story, .portfolio-item').length;
  const caseStudyLinksOnPage = allLinks.filter(({ href }) => 
    caseStudyPatterns.some(pattern => href.includes(pattern))
  ).length;

  // Initial counts from visible content
  features.content.blogPostCount = Math.max(blogPostElements, blogLinksOnPage);
  features.content.caseStudyCount = Math.max(caseStudyElements, caseStudyLinksOnPage);

  // Apply heuristic estimates based on navigation/link presence
  // This helps distinguish "minimal content" from "serious content engine"
  if (features.content.hasBlog && features.content.blogPostCount === 0) {
    // If blog link exists in nav but no posts visible, assume at least a minimum viable blog
    features.content.blogPostCount = 20;
  }

  if (features.content.hasCaseStudiesSection && features.content.caseStudyCount === 0) {
    // If case study link exists but none visible, assume at least a handful
    features.content.caseStudyCount = 10;
  }

  if (features.content.hasResourcesHub && features.content.blogPostCount < 40) {
    // Resource hubs usually mean lots of content (HubSpot, Intercom, etc.)
    // If we have a resources hub, assume substantial content volume
    features.content.blogPostCount = Math.max(features.content.blogPostCount, 40);
  }

  // If we have both blog AND resources hub, boost the count further
  if (features.content.hasBlog && features.content.hasResourcesHub) {
    features.content.blogPostCount = Math.max(features.content.blogPostCount, 50);
  }

  // ============================================
  // SOCIAL MEDIA SIGNALS
  // ============================================
  
  // Normalize URL helper: strip query params and fragments, convert to lowercase
  const normalizeUrl = (url: string): string => {
    try {
      // Handle relative URLs
      if (!url.startsWith('http')) {
        return url.toLowerCase();
      }
      const urlObj = new URL(url);
      // Return base URL without query params or fragments
      return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  };

  // Extract social media URLs from all links
  const linkedinUrls: string[] = [];
  const facebookUrls: string[] = [];
  const instagramUrls: string[] = [];

  allLinks.forEach(({ href }) => {
    const normalizedHref = href.toLowerCase();
    
    // Detect LinkedIn URLs
    if (normalizedHref.includes('linkedin.com/company') || 
        normalizedHref.includes('linkedin.com/company/') ||
        (normalizedHref.includes('linkedin.com') && normalizedHref.includes('/company'))) {
      const normalized = normalizeUrl(href);
      if (!linkedinUrls.includes(normalized)) {
        linkedinUrls.push(normalized);
      }
    }
    
    // Detect Facebook URLs
    if (normalizedHref.includes('facebook.com/') || 
        normalizedHref.includes('fb.com/') ||
        normalizedHref.includes('fb.me/')) {
      const normalized = normalizeUrl(href);
      if (!facebookUrls.includes(normalized)) {
        facebookUrls.push(normalized);
      }
    }
    
    // Detect Instagram URLs
    if (normalizedHref.includes('instagram.com/') || 
        normalizedHref.includes('instagr.am/')) {
      const normalized = normalizeUrl(href);
      if (!instagramUrls.includes(normalized)) {
        instagramUrls.push(normalized);
      }
    }
  });

  // Set social media flags
  features.social.linkedinUrls = linkedinUrls;
  features.social.facebookUrls = facebookUrls;
  features.social.instagramUrls = instagramUrls;
  features.social.hasLinkedIn = linkedinUrls.length > 0;
  features.social.hasFacebook = facebookUrls.length > 0;
  features.social.hasInstagram = instagramUrls.length > 0;

  // Detect key pages by checking links
  const allLinksLower = allLinks.map(({ href }) => href);

  features.content.hasPricingPage = allLinksLower.some(link => 
    link.includes('/pricing') || link.includes('/price') || link.includes('/plan')
  );
  features.content.hasAboutPage = allLinksLower.some(link => 
    link.includes('/about') || link.includes('/team') || link.includes('/company')
  );
  features.content.hasCareersPage = allLinksLower.some(link => 
    link.includes('/career') || link.includes('/job') || link.includes('/hiring')
  );
  features.content.hasFeatureOrProductPages = allLinksLower.some(link => 
    link.includes('/feature') || link.includes('/product') || link.includes('/solution')
  );

  // ============================================
  // AUTHORITY SIGNALS
  // ============================================
  // Improved authority detection: Use both visible elements and link patterns
  // This helps detect trust assets even from partial HTML snapshots

  const bodyText = $('body').text().toLowerCase();
  const bodyTextLower = bodyText;

  // A. Customer logos & "trusted by" sections
  // Look for sections whose class or text includes customer/trust indicators
  const trustedByPatterns = [
    'customers', 'trusted by', 'companies', 'brands', 'teams', 'logos',
    'our customers', 'used by', 'loved by', 'powered by', 'trusted'
  ];
  
  let logoCount = 0;
  let hasTrustedByText = false;
  
  // Find sections that likely contain customer logos
  const trustedBySelectors = [
    '.customers', '.customer-logos', '.trusted-by', '.trusted-by-section',
    '.companies', '.brands', '.clients', '.logo-grid', '.logo-strip',
    '[class*="customer"]', '[class*="trusted"]', '[class*="logo"]',
    '[id*="customer"]', '[id*="trusted"]'
  ];
  
  trustedBySelectors.forEach(selector => {
    const elements = $(selector);
    elements.each((_, el) => {
      const elementText = $(el).text().toLowerCase();
      const elementClasses = $(el).attr('class')?.toLowerCase() || '';
      
      // Check if this section matches trusted-by patterns
      const matchesPattern = trustedByPatterns.some(pattern => 
        elementText.includes(pattern) || elementClasses.includes(pattern)
      );
      
      if (matchesPattern || elementText.includes('trusted by') || elementText.includes('used by')) {
        hasTrustedByText = true;
        
        // Count images within this section as customer logos
        const images = $(el).find('img').length;
        logoCount += images;
      }
    });
  });
  
  // Also count images in common logo container patterns
  const logoContainers = $('.logo-grid, .logo-strip, .customer-logos, .brand-logos, .trusted-by, [class*="logo"][class*="grid"], [class*="logo"][class*="strip"]');
  logoContainers.each((_, el) => {
    const images = $(el).find('img').length;
    logoCount += images;
  });
  
  // Look for "Trusted by X,000+ companies" statements
  const trustedByCountMatch = bodyTextLower.match(/trusted by\s+([\d,]+)\+?\s*(companies|customers|users|teams)/i);
  if (trustedByCountMatch) {
    const countStr = trustedByCountMatch[1].replace(/,/g, '');
    const count = parseInt(countStr, 10);
    if (!isNaN(count) && count >= 10) {
      // If we see "Trusted by 10,000+ companies", set minimum logo count
      logoCount = Math.max(logoCount, 10);
      hasTrustedByText = true;
    }
  }
  
  // Check for "Trusted by" text patterns
  if (bodyTextLower.includes('trusted by') || bodyTextLower.includes('used by') || 
      bodyTextLower.includes('loved by') || bodyTextLower.includes('powered by')) {
    hasTrustedByText = true;
  }
  
  // Set hasCustomerLogoStrip if we have 5+ logos
  const hasLogoStrip = logoCount >= 5 || logoContainers.length > 0;
  
  features.authority.customerLogoCount = logoCount;
  features.authority.hasCustomerLogoStrip = hasLogoStrip;
  features.authority.hasTrustedBySection = hasTrustedByText || hasLogoStrip;

  // B. Testimonials
  const testimonialSelectors = [
    '.testimonial', '.testimonials', '.review', '.reviews', '.quote', '.quotes',
    '[class*="testimonial"]', '[class*="review"]', '[id*="testimonial"]',
    '.customer-story', '.success-story', '.case-study'
  ];
  
  let testimonialCount = 0;
  let hasNamedCustomerStories = false;
  
  testimonialSelectors.forEach(selector => {
    const elements = $(selector);
    elements.each((_, el) => {
      testimonialCount++;
      
      // Check if testimonial contains a customer name + quote (named customer story)
      const elementText = $(el).text();
      const hasName = /(?:^|\s)([A-Z][a-z]+ [A-Z][a-z]+|[A-Z][a-z]+ [A-Z]\.)/.test(elementText);
      const hasQuote = elementText.includes('"') || elementText.includes('"') || 
                       $(el).find('.quote, blockquote, q').length > 0;
      
      if (hasName && hasQuote) {
        hasNamedCustomerStories = true;
      }
    });
  });
  
  // Check for text patterns that indicate testimonials
  const testimonialTextPatterns = [
    'what our customers say', 'customer testimonial', 'client testimonial',
    'customer stories', 'success stories', 'what customers are saying'
  ];
  
  testimonialTextPatterns.forEach(pattern => {
    if (bodyTextLower.includes(pattern)) {
      testimonialCount = Math.max(testimonialCount, 1);
    }
  });
  
  features.authority.testimonialCount = testimonialCount;
  features.authority.hasNamedCustomerStories = hasNamedCustomerStories;

  // C. Case studies / customer stories (already handled in content section, but enhance here)
  // Check if case study links exist but count is still 0
  if (features.content.hasCaseStudiesSection && features.content.caseStudyCount === 0) {
    // If we detected case study links but can't see individual studies, set conservative default
    features.content.caseStudyCount = 10;
  }

  // D. Awards, press & review badges
  // Awards
  const awardSelectors = [
    '.award', '.awards', '.badge', '.badges',
    '[class*="award"]', '[class*="badge"]',
    '[id*="award"]'
  ];
  
  let hasAwards = false;
  awardSelectors.forEach(selector => {
    if ($(selector).length > 0) {
      hasAwards = true;
    }
  });
  
  // Check for award-related text
  const awardTextPatterns = [
    'award', 'awards', 'recognized by', 'featured in', 'certified',
    'best of', 'top', 'leader', 'leader in'
  ];
  
  awardTextPatterns.forEach(pattern => {
    if (bodyTextLower.includes(pattern)) {
      hasAwards = true;
    }
  });
  
  features.authority.hasAwardsOrBadges = hasAwards;

  // Press logos
  const pressPatterns = [
    'press', 'as seen in', 'featured in', 'media', 'news', 'publications',
    'forbes', 'techcrunch', 'wired', 'the wall street journal', 'wsj',
    'bloomberg', 'reuters', 'cnbc', 'business insider'
  ];
  
  let hasPress = false;
  pressPatterns.forEach(pattern => {
    if (bodyTextLower.includes(pattern)) {
      hasPress = true;
    }
  });
  
  // Look for press logo images
  const pressLogoSelectors = [
    '[class*="press"]', '[class*="media"]', '[class*="news"]',
    '[src*="forbes"]', '[src*="techcrunch"]', '[src*="wired"]',
    '[alt*="press"]', '[alt*="media"]'
  ];
  
  pressLogoSelectors.forEach(selector => {
    if ($(selector).length > 0) {
      hasPress = true;
    }
  });
  
  features.authority.hasPressLogos = hasPress;

  // G2/review badges
  const reviewPlatformPatterns = [
    'g2', 'capterra', 'trustpilot', 'trust radius', 'gartner', 'forrester',
    'software advice', 'getapp', 'softwareworld', 'financesonline'
  ];
  
  let hasReviewBadges = false;
  reviewPlatformPatterns.forEach(pattern => {
    if (bodyTextLower.includes(pattern)) {
      hasReviewBadges = true;
    }
  });
  
  // Look for review badge images/elements
  const reviewBadgeSelectors = [
    '[class*="g2"]', '[class*="capterra"]', '[class*="review-badge"]',
    '[src*="g2"]', '[src*="capterra"]', '[src*="trustpilot"]',
    '[alt*="g2"]', '[alt*="capterra"]', '[alt*="trustpilot"]',
    '[id*="g2"]', '[id*="capterra"]'
  ];
  
  reviewBadgeSelectors.forEach(selector => {
    if ($(selector).length > 0) {
      hasReviewBadges = true;
    }
  });
  
  features.authority.hasG2OrReviewBadges = hasReviewBadges;

  // ============================================
  // UX & CONVERSION SIGNALS
  // ============================================

  // CTA detection patterns - expanded list
  const ctaVerbs = [
    'get started',
    'get started free',
    'try it free',
    'try for free',
    'get a demo',
    'request a demo',
    'book a demo',
    'book a call',
    'talk to sales',
    'start free',
    'start trial',
    'start your trial',
    'sign up',
    'contact sales',
    'contact us',
    'get your free demo',
    'request demo',
    'schedule demo',
    'signup',
    'register',
    'get demo',
    'free trial',
    'learn more',
    'get in touch',
  ];

  // Count primary CTAs (buttons and links with CTA verbs)
  let primaryCtaCount = 0;
  let ctaButtonCount = 0;
  let hasSignupOrDemoCTA = false;
  let heroCtaPresent = false;
  const heroCtaLabels: string[] = [];
  let navCtaPresent = false;
  let stickyCtaPresent = false;

  // Identify hero section
  const heroSection = $('.hero, .hero-section, [class*="hero"], header, .header').first();
  
  // Identify primary navigation
  const primaryNav = $('header nav, nav[role="navigation"], .navbar, .nav, .main-nav, .primary-nav, header').first();
  
  // Identify sticky/fixed elements
  const stickySelectors = $('[class*="sticky"], [class*="fixed"], [style*="position: fixed"], [style*="position:sticky"]');

  $('a, button').each((_, el) => {
    const $el = $(el);
    const text = $el.text().toLowerCase().trim();
    const originalText = $el.text().trim();
    const href = $el.attr('href') || '';
    const isButton = $el.is('button') || $el.hasClass('button') || $el.hasClass('btn');
    
    // Check if text matches CTA patterns
    const matchesCta = ctaVerbs.some(verb => text.includes(verb)) ||
      href.includes('demo') || href.includes('signup') || href.includes('trial') ||
      href.includes('contact') || href.includes('sales');

    if (matchesCta) {
      ctaButtonCount++;
      
      // Check if it's in hero section
      const isInHero = heroSection.length > 0 && heroSection.find($el).length > 0;
      // Check if it's in primary nav
      const isInNav = primaryNav.length > 0 && primaryNav.find($el).length > 0;
      // Check if it's sticky/fixed
      const isSticky = $el.closest('[class*="sticky"], [class*="fixed"]').length > 0 ||
        $el.css('position') === 'fixed' || $el.css('position') === 'sticky';
      
      if (isInHero) {
        heroCtaPresent = true;
        // Add unique CTA label (up to 3)
        if (heroCtaLabels.length < 3 && originalText && !heroCtaLabels.includes(originalText)) {
          heroCtaLabels.push(originalText);
        }
      }
      
      if (isInNav) {
        navCtaPresent = true;
      }
      
      if (isSticky) {
        stickyCtaPresent = true;
      }
      
      // Primary CTA is usually short and in hero/nav/sticky
      if (isButton || (text.length < 30 && (isInHero || isInNav || isSticky))) {
        primaryCtaCount++;
      }
      
      if (text.includes('demo') || text.includes('sign up') || text.includes('get started')) {
        hasSignupOrDemoCTA = true;
      }
    }
  });

  features.ux.primaryCtaCount = primaryCtaCount;
  features.ux.heroCtaPresent = heroCtaPresent;
  features.ux.heroCtaLabels = heroCtaLabels;
  features.ux.navCtaPresent = navCtaPresent;
  features.ux.stickyCtaPresent = stickyCtaPresent;
  features.conversions.ctaButtonCount = ctaButtonCount;
  features.conversions.hasSignupOrDemoCTA = hasSignupOrDemoCTA;
  features.conversions.hasFreeTrialOrGetStarted = ctaVerbs.some(verb => 
    bodyText.includes(verb)
  );

  // Check for above-the-fold CTA (in hero section or first viewport)
  const heroHasCTA = heroSection.find('a, button').length > 0;
  features.ux.hasAboveTheFoldCTA = heroHasCTA || heroCtaPresent || primaryCtaCount > 0;

  // Hero headline detection
  let heroHeadline = $('.hero h1, .hero-section h1, header h1, [class*="hero"] h1').first();
  if (heroHeadline.length === 0) {
    // Fallback to first h1
    heroHeadline = $('h1').first();
  }
  const headlineText = heroHeadline.text().trim();
  features.ux.heroHeadlineTextLength = headlineText.length;
  features.ux.heroHasSubheadline = $('.hero h2, .hero-section h2, [class*="hero"] h2, header h2').length > 0 ||
    heroHeadline.next('h2, p').length > 0;

  // Form detection
  const formCount = $('form').length;
  features.conversions.formCount = formCount;
  features.conversions.hasNewsletterOrLeadMagnet = formCount > 0 ||
    bodyText.includes('newsletter') || bodyText.includes('subscribe') || bodyText.includes('download');

  // Contact/demo entry detection
  features.ux.hasClearContactOrDemoEntry = hasSignupOrDemoCTA ||
    $('a[href*="contact"], a[href*="demo"], a[href*="sales"]').length > 0;

  // ============================================
  // BRANDING SIGNALS (Basic)
  // ============================================

  // Logo detection
  features.branding.hasLogoInHeader = $('header img, header .logo, .header img, .header .logo').length > 0;
  features.branding.hasLogoInFooter = $('footer img, footer .logo, .footer img, .footer .logo').length > 0;

  // Structured nav detection (has multiple nav items)
  features.branding.hasStructuredNav = uniqueNavItems.length >= 5;

  // ============================================
  // SEO SIGNALS (Basic)
  // ============================================

  features.seo.hasMetaTitle = $('title').length > 0 && $('title').text().trim().length > 0;
  features.seo.hasMetaDescription = $('meta[name="description"]').length > 0;
  features.seo.h1Count = $('h1').length;
  features.seo.hasMultipleH1s = $('h1').length > 1;
  features.seo.internalLinkCount = $('a[href^="/"], a[href^="./"]').length;
  features.seo.hasCanonicalTag = $('link[rel="canonical"]').length > 0;
  features.seo.hasLangAttribute = $('html[lang]').length > 0;
  features.seo.hasOpenGraphTags = $('meta[property^="og:"]').length > 0;

  // ============================================
  // TECHNICAL SIGNALS (Basic)
  // ============================================

  features.technical.hasResponsiveMetaViewport = $('meta[name="viewport"]').length > 0;
  features.technical.usesHttps = input.websiteUrl.startsWith('https://');

  // Debug logging (dev mode only)
  if (process.env.NODE_ENV !== 'production') {
    console.info('[extractSiteFeatures]', input.websiteUrl, {
      navItems: features.navigation.navItemLabels,
      blogPostCount: features.content.blogPostCount,
      caseStudyCount: features.content.caseStudyCount,
      customerLogoCount: features.authority.customerLogoCount,
      testimonialCount: features.authority.testimonialCount,
      primaryCtaCount: features.ux.primaryCtaCount,
      ctaButtonCount: features.conversions.ctaButtonCount,
    });
    
    console.info('[features.cta]', {
      primaryCtaCount: features.ux.primaryCtaCount,
      ctaButtonCount: features.conversions.ctaButtonCount,
      heroCtaPresent: features.ux.heroCtaPresent,
      heroCtaLabels: features.ux.heroCtaLabels,
      navCtaPresent: features.ux.navCtaPresent,
      stickyCtaPresent: features.ux.stickyCtaPresent,
    });
    
    // Detailed content signal logging
    console.info('[extractSiteFeatures:content]', input.websiteUrl, {
      hasBlog: features.content.hasBlog,
      blogPostCount: features.content.blogPostCount,
      hasResourcesHub: features.content.hasResourcesHub,
      hasCaseStudiesSection: features.content.hasCaseStudiesSection,
      caseStudyCount: features.content.caseStudyCount,
      hasDocsOrGuides: features.content.hasDocsOrGuides,
      hasPricingPage: features.content.hasPricingPage,
      hasAboutPage: features.content.hasAboutPage,
    });
    
    // Detailed authority signal logging
    console.info('[extractSiteFeatures:social]', input.websiteUrl, {
      hasLinkedIn: features.social.hasLinkedIn,
      hasFacebook: features.social.hasFacebook,
      hasInstagram: features.social.hasInstagram,
      linkedinUrls: features.social.linkedinUrls,
      facebookUrls: features.social.facebookUrls,
      instagramUrls: features.social.instagramUrls,
    });
    
    console.info('[extractSiteFeatures:authority]', input.websiteUrl, {
      customerLogoCount: features.authority.customerLogoCount,
      hasCustomerLogoStrip: features.authority.hasCustomerLogoStrip,
      testimonialCount: features.authority.testimonialCount,
      hasNamedCustomerStories: features.authority.hasNamedCustomerStories,
      hasTrustedBySection: features.authority.hasTrustedBySection,
      hasAwardsOrBadges: features.authority.hasAwardsOrBadges,
      hasPressLogos: features.authority.hasPressLogos,
      hasG2OrReviewBadges: features.authority.hasG2OrReviewBadges,
      caseStudyCount: features.content.caseStudyCount,
    });
  }

  return features;
}

