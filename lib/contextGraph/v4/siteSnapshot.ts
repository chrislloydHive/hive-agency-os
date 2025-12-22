// lib/contextGraph/v4/siteSnapshot.ts
// Website Text Snapshot for Evidence Grounding
//
// Provides a lightweight text snapshot of a company's website
// that can be used to ground proposals in actual content.
//
// SOURCES (in order of preference):
// 1. Existing WebsiteLab rawEvidence (already parsed HTML)
// 2. Existing BrandLab site content
// 3. Fresh fetch if nothing available (limited pages)

import { truncateQuote, type EvidenceAnchor } from '@/lib/types/contextField';

// ============================================================================
// Types
// ============================================================================

/**
 * A page within the site snapshot
 */
export interface SnapshotPage {
  /** Page URL */
  url: string;
  /** Page title */
  title: string;
  /** Extracted text content (truncated to ~6k chars) */
  text: string;
  /** Page type classification */
  pageType?: 'homepage' | 'pricing' | 'customers' | 'solutions' | 'about' | 'other';
}

/**
 * Complete site snapshot for evidence grounding
 */
export interface SiteSnapshot {
  /** Homepage text content */
  homepageText: string;
  /** Key pages beyond homepage */
  keyPages: SnapshotPage[];
  /** When this snapshot was created */
  createdAt: string;
  /** Source of the snapshot data */
  source: 'websiteLab' | 'brandLab' | 'fresh' | 'unavailable';
  /** Company URL */
  companyUrl: string;
  /** True if diagnostic failed (403, blocked, etc.) */
  isErrorState?: boolean;
  /** Error message if applicable */
  errorMessage?: string;
}

/**
 * WebsiteLab result structure (partial - what we need)
 */
interface WebsiteLabResultPartial {
  siteGraph?: {
    pages?: Array<{
      url?: string;
      path?: string;
      evidenceV3?: {
        title?: string;
        rawText?: string;
        heroText?: string;
        headlines?: string[];
        bodySnippets?: string[];
      };
    }>;
  };
  status?: 'success' | 'error' | 'blocked';
  errorMessage?: string;
}

/**
 * BrandLab result structure (partial - what we need)
 */
interface BrandLabResultPartial {
  siteContent?: {
    url?: string;
    title?: string;
    heroText?: string;
    headlines?: string[];
    bodySnippets?: string[];
  };
  status?: 'success' | 'error' | 'blocked';
  errorMessage?: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Maximum characters per page text */
const MAX_PAGE_TEXT_LENGTH = 6000;

/** Maximum number of pages to include */
const MAX_PAGES = 5;

/** Key page paths to look for */
const KEY_PAGE_PATHS = ['/pricing', '/customers', '/solutions', '/about', '/features', '/product'];

// ============================================================================
// Snapshot Extraction
// ============================================================================

/**
 * Get a site snapshot for evidence grounding
 *
 * Attempts to extract from existing lab results first,
 * avoiding new HTTP requests when possible.
 *
 * @param companyUrl - Company website URL
 * @param websiteLabResult - Existing WebsiteLab result if available
 * @param brandLabResult - Existing BrandLab result if available
 * @returns Site snapshot with text content
 */
export function getSiteSnapshotForCompany(
  companyUrl: string,
  websiteLabResult?: WebsiteLabResultPartial | null,
  brandLabResult?: BrandLabResultPartial | null
): SiteSnapshot {
  // Check for error states first
  if (websiteLabResult?.status === 'error' || websiteLabResult?.status === 'blocked') {
    return {
      homepageText: '',
      keyPages: [],
      createdAt: new Date().toISOString(),
      source: 'unavailable',
      companyUrl,
      isErrorState: true,
      errorMessage: websiteLabResult.errorMessage || 'Website diagnostic failed',
    };
  }

  if (brandLabResult?.status === 'error') {
    return {
      homepageText: '',
      keyPages: [],
      createdAt: new Date().toISOString(),
      source: 'unavailable',
      companyUrl,
      isErrorState: true,
      errorMessage: brandLabResult.errorMessage || 'Brand diagnostic failed',
    };
  }

  // Try WebsiteLab first (richest data)
  if (websiteLabResult?.siteGraph?.pages?.length) {
    return extractFromWebsiteLab(companyUrl, websiteLabResult);
  }

  // Try BrandLab next
  if (brandLabResult?.siteContent) {
    return extractFromBrandLab(companyUrl, brandLabResult);
  }

  // No data available
  return {
    homepageText: '',
    keyPages: [],
    createdAt: new Date().toISOString(),
    source: 'unavailable',
    companyUrl,
    isErrorState: false,
    errorMessage: 'No website data available',
  };
}

/**
 * Extract snapshot from WebsiteLab result
 */
function extractFromWebsiteLab(
  companyUrl: string,
  result: WebsiteLabResultPartial
): SiteSnapshot {
  const pages = result.siteGraph?.pages || [];
  const keyPages: SnapshotPage[] = [];
  let homepageText = '';

  for (const page of pages) {
    if (!page.evidenceV3) continue;

    const text = buildPageText(page.evidenceV3);
    const truncatedText = truncateText(text, MAX_PAGE_TEXT_LENGTH);
    const path = page.path || '';

    // Identify page type
    const pageType = classifyPageType(path);

    // Homepage
    if (path === '/' || path === '' || page.url === companyUrl) {
      homepageText = truncatedText;
    }

    // Key pages
    if (pageType !== 'other' && keyPages.length < MAX_PAGES) {
      keyPages.push({
        url: page.url || '',
        title: page.evidenceV3.title || '',
        text: truncatedText,
        pageType,
      });
    }
  }

  return {
    homepageText,
    keyPages,
    createdAt: new Date().toISOString(),
    source: 'websiteLab',
    companyUrl,
  };
}

/**
 * Extract snapshot from BrandLab result
 */
function extractFromBrandLab(
  companyUrl: string,
  result: BrandLabResultPartial
): SiteSnapshot {
  const content = result.siteContent;
  if (!content) {
    return {
      homepageText: '',
      keyPages: [],
      createdAt: new Date().toISOString(),
      source: 'brandLab',
      companyUrl,
    };
  }

  const text = buildPageText({
    title: content.title,
    heroText: content.heroText,
    headlines: content.headlines,
    bodySnippets: content.bodySnippets,
  });

  return {
    homepageText: truncateText(text, MAX_PAGE_TEXT_LENGTH),
    keyPages: [],
    createdAt: new Date().toISOString(),
    source: 'brandLab',
    companyUrl,
  };
}

/**
 * Build page text from extracted elements
 */
function buildPageText(evidence: {
  title?: string;
  rawText?: string;
  heroText?: string;
  headlines?: string[];
  bodySnippets?: string[];
}): string {
  const parts: string[] = [];

  if (evidence.title) {
    parts.push(`Title: ${evidence.title}`);
  }
  if (evidence.heroText) {
    parts.push(`Hero: ${evidence.heroText}`);
  }
  if (evidence.headlines?.length) {
    parts.push(`Headlines: ${evidence.headlines.join(' | ')}`);
  }
  if (evidence.bodySnippets?.length) {
    parts.push(...evidence.bodySnippets);
  }
  if (evidence.rawText && parts.length < 3) {
    // Use raw text as fallback if we don't have much structured content
    parts.push(evidence.rawText);
  }

  return parts.join('\n\n');
}

/**
 * Classify page type from path
 */
function classifyPageType(path: string): SnapshotPage['pageType'] {
  const lower = path.toLowerCase();
  if (lower === '/' || lower === '') return 'homepage';
  if (lower.includes('pricing') || lower.includes('plans')) return 'pricing';
  if (lower.includes('customer') || lower.includes('case-stud')) return 'customers';
  if (lower.includes('solution') || lower.includes('use-case')) return 'solutions';
  if (lower.includes('about') || lower.includes('company')) return 'about';
  return 'other';
}

/**
 * Truncate text to max length
 */
function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

// ============================================================================
// Evidence Extraction
// ============================================================================

/**
 * Extract evidence anchors from a site snapshot for a given value
 *
 * Searches the snapshot for quotes that support the proposed value.
 *
 * @param snapshot - Site snapshot to search
 * @param proposedValue - The value being proposed
 * @param maxAnchors - Maximum anchors to return (default 3)
 * @returns Array of evidence anchors
 */
export function extractEvidenceAnchors(
  snapshot: SiteSnapshot,
  proposedValue: string,
  maxAnchors: number = 3
): EvidenceAnchor[] {
  if (!proposedValue || snapshot.isErrorState) {
    return [];
  }

  const anchors: EvidenceAnchor[] = [];
  const valueWords = extractKeywords(proposedValue);

  // Search homepage
  if (snapshot.homepageText) {
    const quotes = findRelevantQuotes(snapshot.homepageText, valueWords);
    for (const quote of quotes.slice(0, maxAnchors)) {
      anchors.push({
        url: snapshot.companyUrl,
        pageTitle: 'Homepage',
        quote: truncateQuote(quote),
      });
    }
  }

  // Search key pages
  for (const page of snapshot.keyPages) {
    if (anchors.length >= maxAnchors) break;

    const quotes = findRelevantQuotes(page.text, valueWords);
    for (const quote of quotes) {
      if (anchors.length >= maxAnchors) break;
      anchors.push({
        url: page.url,
        pageTitle: page.title || page.pageType || 'Page',
        quote: truncateQuote(quote),
      });
    }
  }

  return anchors;
}

/**
 * Extract meaningful keywords from a value
 */
function extractKeywords(value: string): string[] {
  // Remove common words and extract meaningful terms
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'can', 'that', 'which',
    'who', 'whom', 'this', 'these', 'those', 'it', 'its', 'they', 'them',
  ]);

  const words = value.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  return [...new Set(words)];
}

/**
 * Find relevant quotes from text that match keywords
 */
function findRelevantQuotes(text: string, keywords: string[]): string[] {
  if (!text || keywords.length === 0) return [];

  const quotes: string[] = [];
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    const matchCount = keywords.filter(kw => lower.includes(kw)).length;

    // Require at least 2 keyword matches for relevance
    if (matchCount >= 2 && sentence.length <= 200) {
      quotes.push(sentence);
    }
  }

  // Sort by relevance (more keyword matches first)
  return quotes.sort((a, b) => {
    const aMatches = keywords.filter(kw => a.toLowerCase().includes(kw)).length;
    const bMatches = keywords.filter(kw => b.toLowerCase().includes(kw)).length;
    return bMatches - aMatches;
  });
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Check if a snapshot has usable content
 */
export function hasUsableContent(snapshot: SiteSnapshot): boolean {
  return !snapshot.isErrorState && (
    snapshot.homepageText.length > 100 ||
    snapshot.keyPages.some(p => p.text.length > 100)
  );
}

/**
 * Check if proposals should be blocked due to error state
 */
export function shouldBlockProposals(snapshot: SiteSnapshot): boolean {
  return snapshot.isErrorState === true;
}

// ============================================================================
// Exports for Testing
// ============================================================================

export const _testing = {
  MAX_PAGE_TEXT_LENGTH,
  MAX_PAGES,
  KEY_PAGE_PATHS,
  extractKeywords,
  findRelevantQuotes,
  buildPageText,
  classifyPageType,
  truncateText,
};
