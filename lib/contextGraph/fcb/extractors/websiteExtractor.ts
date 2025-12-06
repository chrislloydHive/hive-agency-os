// lib/contextGraph/fcb/extractors/websiteExtractor.ts
// Website Extractor for FCB
//
// Extracts website domain fields from website signals:
// - primaryCTA, keyPages
// - conversionGoals, mainNavigation
// - hasContactForm, hasLiveChat, hasBlog

import * as cheerio from 'cheerio';
import type { SignalBundle, ExtractorResult, ExtractedField, ExtractorDiagnostic } from '../types';

// ============================================================================
// Types
// ============================================================================

interface WebsiteExtraction {
  primaryCTA?: string;
  keyPages?: string[];
  conversionGoals?: string[];
  mainNavigation?: string[];
  hasContactForm: boolean;
  hasLiveChat: boolean;
  hasBlog: boolean;
}

// ============================================================================
// Extraction Helpers
// ============================================================================

/**
 * Extract navigation links from HTML
 */
function extractNavigation($: cheerio.CheerioAPI): string[] {
  const navLinks: string[] = [];

  // Look for nav elements
  $('nav a, header a, .navigation a, .nav a, #nav a').each((_, el) => {
    const text = $(el).text().trim();
    const href = $(el).attr('href');

    // Filter out empty, hash-only, or external links
    if (text && href && !href.startsWith('#') && !href.startsWith('http') && !href.startsWith('tel:') && !href.startsWith('mailto:')) {
      if (text.length < 50 && !navLinks.includes(text)) {
        navLinks.push(text);
      }
    }
  });

  return navLinks.slice(0, 10); // Limit to 10 items
}

/**
 * Extract primary CTA from page
 */
function extractPrimaryCTA($: cheerio.CheerioAPI): string | undefined {
  // Look for prominent CTA buttons
  const ctaSelectors = [
    '.cta a',
    '.hero a.button, .hero a.btn, .hero .cta',
    'a.btn-primary, a.button-primary',
    '[class*="cta"] a',
    'a[class*="primary"]',
  ];

  for (const selector of ctaSelectors) {
    const cta = $(selector).first().text().trim();
    if (cta && cta.length < 50) {
      return cta;
    }
  }

  // Fall back to common CTA patterns
  const commonCTAs = ['Get Started', 'Contact Us', 'Get a Quote', 'Schedule', 'Book', 'Request', 'Free'];
  for (const pattern of commonCTAs) {
    const found = $(`a:contains("${pattern}")`).first().text().trim();
    if (found && found.length < 50) {
      return found;
    }
  }

  return undefined;
}

/**
 * Check for contact form
 */
function hasContactForm($: cheerio.CheerioAPI): boolean {
  const formIndicators = [
    'form[action*="contact"]',
    'form[id*="contact"]',
    'form[class*="contact"]',
    '.contact-form',
    '#contact-form',
    'form input[type="email"]',
  ];

  for (const selector of formIndicators) {
    if ($(selector).length > 0) return true;
  }

  return false;
}

/**
 * Check for live chat
 */
function hasLiveChat($: cheerio.CheerioAPI, html: string): boolean {
  const chatIndicators = [
    // Script-based chat widgets
    'intercom',
    'drift',
    'zendesk',
    'hubspot',
    'crisp',
    'tidio',
    'livechat',
    'tawk',
    'freshchat',
  ];

  const lowerHtml = html.toLowerCase();
  return chatIndicators.some(chat => lowerHtml.includes(chat));
}

/**
 * Check for blog
 */
function hasBlog($: cheerio.CheerioAPI, html: string): boolean {
  const blogIndicators = [
    $('a[href*="/blog"]').length > 0,
    $('a[href*="/news"]').length > 0,
    $('a[href*="/articles"]').length > 0,
    $('a[href*="/insights"]').length > 0,
    $('a[href*="/resources"]').length > 0,
    $('nav a:contains("Blog")').length > 0,
    $('nav a:contains("News")').length > 0,
    html.includes('/blog') || html.includes('/news'),
  ];

  return blogIndicators.some(Boolean);
}

/**
 * Infer conversion goals from page structure
 */
function inferConversionGoals($: cheerio.CheerioAPI): string[] {
  const goals: string[] = [];

  // Contact form = lead generation
  if (hasContactForm($)) {
    goals.push('Lead capture');
  }

  // Phone number prominently displayed
  if ($('a[href^="tel:"]').length > 0) {
    goals.push('Phone calls');
  }

  // Scheduling/booking
  if ($('a[href*="schedule"], a[href*="book"], a[href*="calendly"]').length > 0) {
    goals.push('Appointment booking');
  }

  // E-commerce indicators
  if ($('[class*="cart"], [class*="shop"], a[href*="/shop"]').length > 0) {
    goals.push('Product sales');
  }

  // Quote/estimate requests
  if ($('a:contains("Quote"), a:contains("Estimate"), form[action*="quote"]').length > 0) {
    goals.push('Quote requests');
  }

  // Newsletter
  if ($('input[name*="email"][type="email"]').length > 0 && $('form').length > 0) {
    if (!goals.includes('Lead capture')) {
      goals.push('Email signups');
    }
  }

  return goals.length > 0 ? goals : ['Lead generation']; // Default assumption
}

// ============================================================================
// Main Extractor
// ============================================================================

export async function extractWebsite(signals: SignalBundle): Promise<ExtractorResult> {
  const fields: ExtractedField[] = [];
  const diagnostics: ExtractorDiagnostic[] = [];

  try {
    const $ = cheerio.load(signals.homepage.html);

    // Extract navigation
    const mainNavigation = extractNavigation($);
    if (mainNavigation.length > 0) {
      fields.push({
        path: 'website.mainNavigation',
        value: mainNavigation,
        confidence: 0.9,
        reasoning: 'Extracted from nav/header elements',
      });
    }

    // Extract primary CTA
    const primaryCTA = extractPrimaryCTA($);
    if (primaryCTA) {
      fields.push({
        path: 'website.primaryCTA',
        value: primaryCTA,
        confidence: 0.75,
        reasoning: 'Extracted from prominent button/link',
      });
    }

    // Key pages (from navigation + discovered pages)
    const keyPages: string[] = [];
    if (signals.aboutPage) keyPages.push('About');
    if (signals.servicesPage) keyPages.push('Services');
    if (signals.pricingPage) keyPages.push('Pricing');
    if (signals.contactPage) keyPages.push('Contact');

    // Add from navigation if we found any
    mainNavigation.forEach(nav => {
      if (!keyPages.includes(nav) && keyPages.length < 8) {
        keyPages.push(nav);
      }
    });

    if (keyPages.length > 0) {
      fields.push({
        path: 'website.keyPages',
        value: keyPages,
        confidence: 0.85,
        reasoning: 'Discovered from navigation and page crawling',
      });
    }

    // Conversion goals
    const conversionGoals = inferConversionGoals($);
    fields.push({
      path: 'website.conversionGoals',
      value: conversionGoals,
      confidence: 0.7,
      reasoning: 'Inferred from page elements and CTAs',
    });

    // Boolean features
    const hasForm = hasContactForm($);
    fields.push({
      path: 'website.hasContactForm',
      value: hasForm,
      confidence: 0.95,
      reasoning: hasForm ? 'Contact form detected' : 'No contact form found',
    });

    const hasChat = hasLiveChat($, signals.homepage.html);
    fields.push({
      path: 'website.hasLiveChat',
      value: hasChat,
      confidence: 0.9,
      reasoning: hasChat ? 'Chat widget detected' : 'No chat widget found',
    });

    const blogPresent = hasBlog($, signals.homepage.html);
    fields.push({
      path: 'website.hasBlog',
      value: blogPresent,
      confidence: 0.85,
      reasoning: blogPresent ? 'Blog/news section detected' : 'No blog detected',
    });

    diagnostics.push({
      code: 'EXTRACTION_SUCCESS',
      message: `Extracted ${fields.length} website fields`,
      severity: 'info',
    });
  } catch (error) {
    diagnostics.push({
      code: 'EXTRACTION_ERROR',
      message: `Website extraction failed: ${error instanceof Error ? error.message : 'Unknown'}`,
      severity: 'error',
    });
  }

  return { fields, diagnostics, source: 'fcb' };
}
