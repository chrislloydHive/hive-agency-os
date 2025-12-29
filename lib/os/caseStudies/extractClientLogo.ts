/**
 * Client Logo Extraction Module
 *
 * Extracts client logos from Framer-based case study pages using a
 * scored-candidate approach to reliably identify the actual client logo
 * (not Hive branding, thumbnails, or UI elements).
 */

import * as cheerio from 'cheerio';

// ============================================================================
// Types
// ============================================================================

export interface LogoCandidate {
  id: string;
  type: 'img' | 'svg' | 'background';
  url: string | null;
  svgMarkup: string | null;
  alt: string | null;
  title: string | null;
  ariaLabel: string | null;
  width: number | null;
  height: number | null;
  aspectRatio: number | null;
  location: 'nav' | 'header' | 'footer' | 'hero' | 'content' | 'unknown';
  containerContext: string;
  score: number;
  scoreReasons: string[];
}

export interface LogoExtractionResult {
  success: boolean;
  candidate: LogoCandidate | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  allCandidates: LogoCandidate[];
  needsManualOverride: boolean;
  reason: string;
}

export interface ExtractionOptions {
  clientName: string;
  clientTokens: string[];
  minimumScore?: number;
  debug?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

// Known client tokens for matching
export const CLIENT_TOKEN_MAP: Record<string, string[]> = {
  'moe': ['moe', 'mutual', 'enumclaw', 'mutualofenumclaw'],
  'fctg': ['fctg', 'forest', 'forestcity', 'tradinggroup', 'forestcitytradinggroup'],
  'microsoft': ['microsoft', 'msft', 'ms'],
  'optum': ['optum', 'unitedhealth'],
  'reviver': ['reviver', 'revivertech'],
  'portagebank': ['portage', 'portagebank', 'bank'],
};

// Hive branding tokens to reject
const HIVE_BRAND_TOKENS = [
  'hive',
  'hiveadagency',
  'hive-agency',
  'hivead',
  'hive-os',
  'hiveos',
];

// Social/UI icon patterns to reject
const ICON_PATTERNS = [
  /facebook/i,
  /twitter/i,
  /linkedin/i,
  /instagram/i,
  /youtube/i,
  /tiktok/i,
  /arrow/i,
  /chevron/i,
  /menu/i,
  /hamburger/i,
  /close/i,
  /search/i,
  /play/i,
  /pause/i,
  /x-icon/i,
  /icon-/i,
  /-icon\./i,
];

// ============================================================================
// Utilities
// ============================================================================

function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function containsAnyToken(text: string, tokens: string[]): boolean {
  const textTokens = tokenize(text);
  const textJoined = textTokens.join('');

  for (const token of tokens) {
    if (textTokens.includes(token) || textJoined.includes(token)) {
      return true;
    }
  }
  return false;
}

function containsHiveBranding(text: string): boolean {
  return containsAnyToken(text, HIVE_BRAND_TOKENS);
}

function isIconPattern(text: string): boolean {
  return ICON_PATTERNS.some(pattern => pattern.test(text));
}

function extractFilename(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    const filename = path.split('/').pop() || '';
    return filename.split('?')[0];
  } catch {
    return url;
  }
}

function calculateAspectRatio(width: number | null, height: number | null): number | null {
  if (!width || !height || height === 0) return null;
  return width / height;
}

function isLogoLikeAspectRatio(aspectRatio: number | null): boolean {
  if (!aspectRatio) return false;
  // Logo-like: wide (2:1 to 8:1) or square-ish mark (0.8:1 to 1.2:1)
  return (aspectRatio >= 2 && aspectRatio <= 8) ||
         (aspectRatio >= 0.8 && aspectRatio <= 1.2);
}

function isLogoLikeDimensions(width: number | null, height: number | null): boolean {
  if (!width || !height) return false;
  // Logo-like: height 24-160px, width 60-500px
  return height >= 24 && height <= 160 && width >= 60 && width <= 500;
}

function isUIIcon(width: number | null, height: number | null): boolean {
  if (!width || !height) return false;
  return width < 24 || height < 24;
}

// ============================================================================
// Location Detection
// ============================================================================

function detectLocation(
  $element: ReturnType<cheerio.CheerioAPI>,
  $: cheerio.CheerioAPI
): 'nav' | 'header' | 'footer' | 'hero' | 'content' | 'unknown' {
  // Check ancestors for location hints
  const ancestors = $element.parents().toArray();

  for (const ancestor of ancestors) {
    const $ancestor = $(ancestor);
    const tagName = ancestor.tagName?.toLowerCase() || '';
    const className = ($ancestor.attr('class') || '').toLowerCase();
    const id = ($ancestor.attr('id') || '').toLowerCase();
    const role = ($ancestor.attr('role') || '').toLowerCase();

    // Direct tag matches
    if (tagName === 'nav' || tagName === 'header') return 'nav';
    if (tagName === 'footer') return 'footer';

    // Class/ID hints
    if (className.includes('nav') || id.includes('nav') || role === 'navigation') return 'nav';
    if (className.includes('header') || id.includes('header') || role === 'banner') return 'nav';
    if (className.includes('footer') || id.includes('footer') || role === 'contentinfo') return 'footer';
    if (className.includes('hero') || id.includes('hero')) return 'hero';

    // Framer-specific: Check for sticky positioning (nav)
    const style = $ancestor.attr('style') || '';
    if (style.includes('position:sticky') || style.includes('position: sticky')) {
      return 'nav';
    }
  }

  // Check position in document
  const $main = $('main');
  if ($main.length > 0) {
    // If inside main, it's content
    if ($element.closest('main').length > 0) {
      // Check if it's one of the first sections
      const firstSection = $main.children().first();
      // Use contains() to check if element is within firstSection
      if (firstSection.length > 0 && $.contains(firstSection.get(0) as never, $element.get(0) as never)) {
        return 'hero';
      }
      return 'content';
    }
  }

  return 'unknown';
}

function getContainerContext($element: ReturnType<cheerio.CheerioAPI>, $: cheerio.CheerioAPI): string {
  const parent = $element.parent();
  const grandparent = parent.parent();

  const tagNames: string[] = [];
  if (parent.length) tagNames.push(parent.prop('tagName')?.toLowerCase() || '');
  if (grandparent.length) tagNames.push(grandparent.prop('tagName')?.toLowerCase() || '');

  const classes = [
    $element.attr('class') || '',
    parent.attr('class') || '',
    grandparent.attr('class') || '',
  ].filter(Boolean).join(' ').substring(0, 100);

  return `${tagNames.join('>')} .${classes}`;
}

// ============================================================================
// Candidate Extraction
// ============================================================================

function extractImageCandidates(
  $: cheerio.CheerioAPI,
  baseUrl: string
): LogoCandidate[] {
  const candidates: LogoCandidate[] = [];
  let index = 0;

  $('img').each((_, el) => {
    const $img = $(el);
    let src = $img.attr('src');
    const srcset = $img.attr('srcset');
    const alt = $img.attr('alt') || null;
    const widthAttr = $img.attr('width');
    const heightAttr = $img.attr('height');

    // Get highest resolution from srcset
    if (srcset) {
      const sources = srcset.split(',').map(s => {
        const parts = s.trim().split(/\s+/);
        const url = parts[0];
        const descriptor = parts[1] || '1x';
        const multiplier = parseFloat(descriptor) || 1;
        return { url, multiplier };
      });
      const sorted = sources.sort((a, b) => b.multiplier - a.multiplier);
      if (sorted[0]) src = sorted[0].url;
    }

    if (!src) return;

    // Resolve URL
    try {
      src = new URL(src, baseUrl).href;
    } catch {
      return;
    }

    // Parse dimensions
    const width = widthAttr ? parseInt(widthAttr) : null;
    const height = heightAttr ? parseInt(heightAttr) : null;
    const aspectRatio = calculateAspectRatio(width, height);

    candidates.push({
      id: `img-${index++}`,
      type: 'img',
      url: src,
      svgMarkup: null,
      alt,
      title: null,
      ariaLabel: $img.attr('aria-label') || null,
      width,
      height,
      aspectRatio,
      location: detectLocation($img, $),
      containerContext: getContainerContext($img, $),
      score: 0,
      scoreReasons: [],
    });
  });

  return candidates;
}

function extractSvgCandidates(
  $: cheerio.CheerioAPI
): LogoCandidate[] {
  const candidates: LogoCandidate[] = [];
  let index = 0;

  $('svg').each((_, el) => {
    const $svg = $(el);

    // Skip tiny icons
    const widthAttr = $svg.attr('width');
    const heightAttr = $svg.attr('height');
    const width = widthAttr ? parseInt(widthAttr) : null;
    const height = heightAttr ? parseInt(heightAttr) : null;

    if (width && height && (width < 20 || height < 20)) return;

    // Get identifying info
    const title = $svg.find('title').first().text() || null;
    const ariaLabel = $svg.attr('aria-label') || null;
    const dataTestId = $svg.attr('data-testid') || null;
    const id = $svg.attr('id') || null;

    // Get full markup for potential export
    const svgMarkup = $.html($svg);

    candidates.push({
      id: `svg-${index++}`,
      type: 'svg',
      url: null,
      svgMarkup,
      alt: title || id || dataTestId,
      title,
      ariaLabel,
      width,
      height,
      aspectRatio: calculateAspectRatio(width, height),
      location: detectLocation($svg, $),
      containerContext: getContainerContext($svg, $),
      score: 0,
      scoreReasons: [],
    });
  });

  return candidates;
}

function extractBackgroundCandidates(
  $: cheerio.CheerioAPI,
  baseUrl: string
): LogoCandidate[] {
  const candidates: LogoCandidate[] = [];
  let index = 0;

  $('[style*="background"]').each((_, el) => {
    const $el = $(el);
    const style = $el.attr('style') || '';

    const urlMatch = style.match(/url\(['"]?([^'")\s]+)['"]?\)/);
    if (!urlMatch || !urlMatch[1]) return;

    let url = urlMatch[1];
    try {
      url = new URL(url, baseUrl).href;
    } catch {
      return;
    }

    candidates.push({
      id: `bg-${index++}`,
      type: 'background',
      url,
      svgMarkup: null,
      alt: null,
      title: null,
      ariaLabel: $el.attr('aria-label') || null,
      width: null,
      height: null,
      aspectRatio: null,
      location: detectLocation($el, $),
      containerContext: getContainerContext($el, $),
      score: 0,
      scoreReasons: [],
    });
  });

  return candidates;
}

// ============================================================================
// Scoring
// ============================================================================

function scoreCandidate(
  candidate: LogoCandidate,
  options: ExtractionOptions
): LogoCandidate {
  let score = 0;
  const reasons: string[] = [];

  const searchableText = [
    candidate.alt || '',
    candidate.title || '',
    candidate.ariaLabel || '',
    candidate.url ? extractFilename(candidate.url) : '',
  ].join(' ').toLowerCase();

  // =========================================================================
  // POSITIVE SIGNALS
  // =========================================================================

  // +40 if candidate is in hero/first content section (not nav/footer)
  if (candidate.location === 'hero' || candidate.location === 'content') {
    score += 40;
    reasons.push('+40 in hero/content area');
  }

  // +25 if alt/aria/title includes client name token
  if (containsAnyToken(searchableText, options.clientTokens)) {
    score += 25;
    reasons.push('+25 contains client token');
  }

  // +15 if filename contains client token
  if (candidate.url) {
    const filename = extractFilename(candidate.url);
    if (containsAnyToken(filename, options.clientTokens)) {
      score += 15;
      reasons.push('+15 filename contains client token');
    }
  }

  // +10 if aspect ratio is logo-like
  if (isLogoLikeAspectRatio(candidate.aspectRatio)) {
    score += 10;
    reasons.push('+10 logo-like aspect ratio');
  }

  // +10 if dimensions suggest logo
  if (isLogoLikeDimensions(candidate.width, candidate.height)) {
    score += 10;
    reasons.push('+10 logo-like dimensions');
  }

  // +5 for SVG (scalable, likely a logo)
  if (candidate.type === 'svg') {
    score += 5;
    reasons.push('+5 SVG format');
  }

  // +10 if text includes "logo" or "wordmark"
  if (searchableText.includes('logo') || searchableText.includes('wordmark') ||
      searchableText.includes('brand-mark') || searchableText.includes('brandmark')) {
    score += 10;
    reasons.push('+10 explicit logo/wordmark indicator');
  }

  // =========================================================================
  // NEGATIVE SIGNALS
  // =========================================================================

  // -60 if in nav/footer/header
  if (candidate.location === 'nav' || candidate.location === 'footer') {
    score -= 60;
    reasons.push('-60 in nav/footer region');
  }

  // -80 if matches Hive branding
  if (containsHiveBranding(searchableText)) {
    score -= 80;
    reasons.push('-80 Hive branding detected');
  }
  if (candidate.url && containsHiveBranding(candidate.url)) {
    score -= 80;
    reasons.push('-80 Hive branding in URL');
  }

  // -30 if looks like UI icon
  if (isUIIcon(candidate.width, candidate.height)) {
    score -= 30;
    reasons.push('-30 UI icon size');
  }

  // -30 if matches icon patterns
  if (isIconPattern(searchableText)) {
    score -= 30;
    reasons.push('-30 icon pattern match');
  }
  if (candidate.url && isIconPattern(candidate.url)) {
    score -= 30;
    reasons.push('-30 icon pattern in URL');
  }

  // -100 if contains BOTH Hive AND client token (overlay/composite image)
  if (containsHiveBranding(searchableText) &&
      containsAnyToken(searchableText, options.clientTokens)) {
    score -= 100;
    reasons.push('-100 Hive+Client combo (likely overlay)');
  }

  // -20 for background images (less reliable)
  if (candidate.type === 'background') {
    score -= 20;
    reasons.push('-20 background image (less reliable)');
  }

  // -50 if very large (likely hero image, not logo)
  if (candidate.width && candidate.height) {
    if (candidate.width > 800 || candidate.height > 400) {
      score -= 50;
      reasons.push('-50 large dimensions (hero image)');
    }
  }

  return {
    ...candidate,
    score,
    scoreReasons: reasons,
  };
}

// ============================================================================
// Main Extraction Function
// ============================================================================

export function extractClientLogoFromPage(
  html: string,
  pageUrl: string,
  options: ExtractionOptions
): LogoExtractionResult {
  const $ = cheerio.load(html);
  const minimumScore = options.minimumScore ?? 60;

  // Build candidate set from all sources
  const candidates: LogoCandidate[] = [
    ...extractImageCandidates($, pageUrl),
    ...extractSvgCandidates($),
    ...extractBackgroundCandidates($, pageUrl),
  ];

  if (options.debug) {
    console.log(`[Logo] Found ${candidates.length} total candidates`);
  }

  // Score all candidates
  const scoredCandidates = candidates.map(c => scoreCandidate(c, options));

  // Sort by score descending
  scoredCandidates.sort((a, b) => b.score - a.score);

  if (options.debug) {
    console.log('[Logo] Top 5 candidates:');
    for (const c of scoredCandidates.slice(0, 5)) {
      console.log(`  ${c.id}: score=${c.score} ${c.type} ${c.url?.substring(0, 50) || c.alt || 'SVG'}`);
      for (const r of c.scoreReasons) {
        console.log(`    ${r}`);
      }
    }
  }

  // Select best candidate above threshold
  const bestCandidate = scoredCandidates.find(c => c.score >= minimumScore);

  if (!bestCandidate) {
    return {
      success: false,
      candidate: null,
      confidence: 'none',
      allCandidates: scoredCandidates,
      needsManualOverride: true,
      reason: `No candidate scored above ${minimumScore}. Best score: ${scoredCandidates[0]?.score ?? 0}`,
    };
  }

  // Determine confidence level
  let confidence: 'high' | 'medium' | 'low';
  if (bestCandidate.score >= 80) {
    confidence = 'high';
  } else if (bestCandidate.score >= 60) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return {
    success: true,
    candidate: bestCandidate,
    confidence,
    allCandidates: scoredCandidates,
    needsManualOverride: confidence === 'low',
    reason: `Selected ${bestCandidate.type} with score ${bestCandidate.score} (${confidence} confidence)`,
  };
}

// ============================================================================
// Utility: Get client tokens for a client name
// ============================================================================

export function getClientTokens(clientName: string): string[] {
  const nameLower = clientName.toLowerCase().replace(/\s+/g, '');

  // Check if we have predefined tokens
  for (const [key, tokens] of Object.entries(CLIENT_TOKEN_MAP)) {
    if (nameLower.includes(key) || tokens.some(t => nameLower.includes(t))) {
      return tokens;
    }
  }

  // Generate tokens from client name
  const generated = tokenize(clientName);
  generated.push(nameLower);

  return [...new Set(generated)];
}
