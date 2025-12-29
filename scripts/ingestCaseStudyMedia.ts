#!/usr/bin/env npx tsx
/**
 * Case Study Media Ingestion Script
 *
 * Fetches case study pages from hiveadagency.com, extracts media assets,
 * uploads them to local storage, and generates patches for case study records.
 *
 * Logo Source Protection:
 *   - Logos with source='manual' are NEVER overwritten by auto-ingestion
 *   - Users can "Confirm" auto-ingested logos in the UI to mark them as manual
 *   - The --force flag overrides local file checks but respects manual logos
 *
 * Usage:
 *   pnpm ingest:case-study-media              # Full ingestion
 *   pnpm ingest:case-study-media --logos-only # Only extract/update logos
 *   pnpm ingest:case-study-media --force      # Overwrite existing local files
 *   pnpm ingest:case-study-media --debug      # Enable debug logging
 *   pnpm ingest:case-study-media --dry-run    # Show what would be done
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import * as cheerio from 'cheerio';
import * as crypto from 'crypto';
import {
  extractClientLogoFromPage,
  getClientTokens,
  type LogoExtractionResult,
} from '../lib/os/caseStudies/extractClientLogo';

// ============================================================================
// Types
// ============================================================================

interface CaseStudySource {
  url: string;
  internalCaseId: string;
  publicCaseId: string;
  clientName: string;
  slug: string;
}

interface ExtractedMedia {
  url: string;
  normalizedUrl: string;
  type: 'image' | 'video';
  isLogo: boolean;
  classification: 'hero' | 'campaign' | 'process' | 'detail' | 'logo';
  context: string;
  order: number;
  videoUrl?: string;
  posterUrl?: string;
}

interface UploadedAsset {
  originalUrl: string;
  uploadedUrl: string;
  localPath: string;
  filename: string;
}

interface CaseStudyPatch {
  caseId: string;
  clientLogo?: {
    assetUrl: string;
    fallbackUrl?: string;
    alt: string;
    theme?: 'light' | 'dark';
    variant?: 'full' | 'mark';
    visibility: 'public' | 'internal';
    source: 'auto' | 'manual';
  };
  visuals: Array<{
    id: string;
    type: 'hero' | 'campaign' | 'before_after' | 'process' | 'detail';
    mediaType: 'image' | 'video';
    title?: string;
    caption?: string;
    assetUrl: string;
    originalUrl?: string;
    linkUrl?: string;
    posterUrl?: string;
    order: number;
    visibility: 'public' | 'internal';
  }>;
}

interface LogoIngestionResult {
  caseId: string;
  clientName: string;
  slug: string;
  logoFound: boolean;
  logoUrl: string | null;
  logoType: 'img' | 'svg' | 'background' | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  score: number;
  scoreReasons: string[];
  needsManualOverride: boolean;
  uploadedUrl: string | null;
  error: string | null;
  skippedDueToManual: boolean; // True if existing logo has source='manual'
}

interface IngestionReport {
  caseId: string;
  clientName: string;
  logoFound: boolean;
  imagesCount: number;
  videosCount: number;
  uploadedCount: number;
  skipped: Array<{ url: string; reason: string }>;
}

interface CliOptions {
  logosOnly: boolean;
  force: boolean;
  debug: boolean;
  dryRun: boolean;
}

// ============================================================================
// Configuration
// ============================================================================

const CASE_STUDY_SOURCES: CaseStudySource[] = [
  {
    url: 'https://www.hiveadagency.com/moe-brand',
    internalCaseId: 'moe-brand-internal',
    publicCaseId: 'moe-brand-public',
    clientName: 'Mutual of Enumclaw',
    slug: 'moe-brand',
  },
  {
    url: 'https://www.hiveadagency.com/moe-content',
    internalCaseId: 'moe-content-internal',
    publicCaseId: 'moe-content-public',
    clientName: 'MOE',
    slug: 'moe-content',
  },
  {
    url: 'https://www.hiveadagency.com/moe-website',
    internalCaseId: 'moe-website-internal',
    publicCaseId: 'moe-website-public',
    clientName: 'Mutual of Enumclaw',
    slug: 'moe-website',
  },
  {
    url: 'https://www.hiveadagency.com/fctg',
    internalCaseId: 'fctg-brand-internal',
    publicCaseId: 'fctg-brand-public',
    clientName: 'FCTG',
    slug: 'fctg',
  },
  {
    url: 'https://www.hiveadagency.com/microsoft',
    internalCaseId: 'microsoft-brand-internal',
    publicCaseId: 'microsoft-brand-public',
    clientName: 'Microsoft',
    slug: 'microsoft',
  },
  {
    url: 'https://www.hiveadagency.com/optum',
    internalCaseId: 'optum-content-internal',
    publicCaseId: 'optum-content-public',
    clientName: 'Optum',
    slug: 'optum',
  },
  {
    url: 'https://www.hiveadagency.com/reviver',
    internalCaseId: 'reviver-brand-internal',
    publicCaseId: 'reviver-brand-public',
    clientName: 'Reviver',
    slug: 'reviver',
  },
  {
    url: 'https://www.hiveadagency.com/portagebank',
    internalCaseId: 'portagebank-brand-internal',
    publicCaseId: 'portagebank-brand-public',
    clientName: 'Portage Bank',
    slug: 'portagebank',
  },
];

const EXCLUDED_URL_PATTERNS = [
  /hive.*logo/i,
  /hiveadagency.*logo/i,
  /social.*icon/i,
  /facebook/i,
  /twitter/i,
  /linkedin.*icon/i,
  /instagram.*icon/i,
  /arrow/i,
  /chevron/i,
  /icon.*arrow/i,
  /menu/i,
  /hamburger/i,
  /close.*icon/i,
  /x-icon/i,
];

const PUBLIC_DIR = path.join(process.cwd(), 'public', 'case-studies');
const DATA_DIR = path.join(process.cwd(), 'data', 'case-studies');

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  return {
    logosOnly: args.includes('--logos-only'),
    force: args.includes('--force'),
    debug: args.includes('--debug'),
    dryRun: args.includes('--dry-run'),
  };
}

// ============================================================================
// Utilities
// ============================================================================

function log(
  message: string,
  level: 'info' | 'warn' | 'error' | 'success' | 'debug' = 'info',
  options?: CliOptions
): void {
  if (level === 'debug' && !options?.debug) return;

  const prefix = {
    info: '\x1b[36m[INFO]\x1b[0m',
    warn: '\x1b[33m[WARN]\x1b[0m',
    error: '\x1b[31m[ERROR]\x1b[0m',
    success: '\x1b[32m[OK]\x1b[0m',
    debug: '\x1b[35m[DEBUG]\x1b[0m',
  };
  console.log(`${prefix[level]} ${message}`);
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const params = new URLSearchParams(parsed.search);
    params.delete('scale-down-to');
    parsed.search = params.toString();
    return parsed.href;
  } catch {
    return url;
  }
}

function getHighestResUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete('scale-down-to');
    return parsed.href;
  } catch {
    return url;
  }
}

function hashUrl(url: string): string {
  return crypto.createHash('md5').update(url).digest('hex').substring(0, 8);
}

function getExtension(url: string): string {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const ext = path.extname(pathname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif'].includes(ext)) {
      return ext;
    }
    return '.png';
  } catch {
    return '.png';
  }
}

async function fetchUrl(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const request = protocol.get(
      url,
      { headers: { 'User-Agent': 'HiveAgencyOS/1.0' } },
      (response) => {
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          fetchUrl(response.headers.location).then(resolve).catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode} for ${url}`));
          return;
        }

        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      }
    );
    request.on('error', reject);
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

async function fetchHtml(url: string): Promise<string> {
  const buffer = await fetchUrl(url);
  return buffer.toString('utf-8');
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// ============================================================================
// Asset Upload
// ============================================================================

async function uploadAsset(
  url: string,
  slug: string,
  filename: string,
  options: CliOptions
): Promise<UploadedAsset> {
  const clientDir = path.join(PUBLIC_DIR, slug);
  ensureDir(clientDir);

  const localPath = path.join(clientDir, filename);
  const uploadedUrl = `/case-studies/${slug}/${filename}`;

  if (!options.dryRun) {
    log(`  Downloading: ${url.substring(0, 80)}...`, 'info', options);
    const buffer = await fetchUrl(url);
    fs.writeFileSync(localPath, buffer);
    log(`  Saved: ${localPath}`, 'success', options);
  } else {
    log(`  [DRY-RUN] Would download: ${url.substring(0, 80)}...`, 'debug', options);
  }

  return {
    originalUrl: url,
    uploadedUrl,
    localPath,
    filename,
  };
}

async function saveSvg(
  svgMarkup: string,
  slug: string,
  options: CliOptions
): Promise<{ svgUrl: string }> {
  const clientDir = path.join(PUBLIC_DIR, slug);
  ensureDir(clientDir);

  const svgPath = path.join(clientDir, 'client-logo.svg');
  const svgUrl = `/case-studies/${slug}/client-logo.svg`;

  if (!options.dryRun) {
    fs.writeFileSync(svgPath, svgMarkup);
    log(`  Saved SVG: ${svgPath}`, 'success', options);
  } else {
    log(`  [DRY-RUN] Would save SVG: ${svgPath}`, 'debug', options);
  }

  return { svgUrl };
}

// ============================================================================
// Logo-Only Ingestion (NEW IMPROVED APPROACH)
// ============================================================================

async function ingestClientLogo(
  source: CaseStudySource,
  options: CliOptions
): Promise<LogoIngestionResult> {
  const result: LogoIngestionResult = {
    caseId: source.internalCaseId,
    clientName: source.clientName,
    slug: source.slug,
    logoFound: false,
    logoUrl: null,
    logoType: null,
    confidence: 'none',
    score: 0,
    scoreReasons: [],
    needsManualOverride: true,
    uploadedUrl: null,
    error: null,
    skippedDueToManual: false,
  };

  try {
    log(`\nProcessing logo: ${source.clientName} (${source.url})`, 'info', options);

    // Check for existing manual override
    const manualLogoPath = path.join(PUBLIC_DIR, source.slug, 'client-logo-manual.png');
    const manualLogoSvgPath = path.join(PUBLIC_DIR, source.slug, 'client-logo-manual.svg');

    if ((fs.existsSync(manualLogoPath) || fs.existsSync(manualLogoSvgPath)) && !options.force) {
      const existingPath = fs.existsSync(manualLogoSvgPath) ? manualLogoSvgPath : manualLogoPath;
      const ext = path.extname(existingPath);
      log(`  Manual override exists at ${existingPath}, skipping (use --force to overwrite)`, 'warn', options);
      result.logoFound = true;
      result.uploadedUrl = `/case-studies/${source.slug}/client-logo-manual${ext}`;
      result.needsManualOverride = false;
      result.confidence = 'high';
      return result;
    }

    // Fetch page
    const html = await fetchHtml(source.url);
    log(`  Fetched page (${html.length} bytes)`, 'debug', options);

    // Extract logo using scored-candidate approach
    const clientTokens = getClientTokens(source.clientName);
    log(`  Client tokens: ${clientTokens.join(', ')}`, 'debug', options);

    const extraction: LogoExtractionResult = extractClientLogoFromPage(html, source.url, {
      clientName: source.clientName,
      clientTokens,
      minimumScore: 50,
      debug: options.debug,
    });

    if (options.debug) {
      log(`  Extraction: ${extraction.reason}`, 'debug', options);
    }

    if (!extraction.success || !extraction.candidate) {
      log(`  ✗ No reliable logo found: ${extraction.reason}`, 'warn', options);
      log(`    → NEEDS MANUAL OVERRIDE`, 'warn', options);
      return result;
    }

    const candidate = extraction.candidate;
    result.logoFound = true;
    result.logoType = candidate.type;
    result.confidence = extraction.confidence;
    result.score = candidate.score;
    result.scoreReasons = candidate.scoreReasons;
    result.needsManualOverride = extraction.needsManualOverride;

    // Log selection details
    const confidenceEmoji = extraction.confidence === 'high' ? '✓' :
                            extraction.confidence === 'medium' ? '~' : '⚠';
    log(`  ${confidenceEmoji} Selected: ${candidate.type} (score: ${candidate.score}, confidence: ${extraction.confidence})`, 'info', options);

    if (candidate.url) {
      log(`    URL: ${candidate.url.substring(0, 80)}...`, 'debug', options);
    }
    if (options.debug) {
      for (const reason of candidate.scoreReasons) {
        log(`      ${reason}`, 'debug', options);
      }
    }

    // Upload based on type
    if (candidate.type === 'svg' && candidate.svgMarkup) {
      const { svgUrl } = await saveSvg(candidate.svgMarkup, source.slug, options);
      result.uploadedUrl = svgUrl;
      result.logoUrl = svgUrl;
    } else if (candidate.url) {
      result.logoUrl = candidate.url;
      const ext = getExtension(candidate.url);
      const filename = `client-logo${ext}`;
      const uploaded = await uploadAsset(candidate.url, source.slug, filename, options);
      result.uploadedUrl = uploaded.uploadedUrl;
    }

    if (extraction.confidence === 'low') {
      log(`    ⚠ Low confidence - verify manually before using`, 'warn', options);
    }

    return result;
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    log(`  ✗ Error: ${result.error}`, 'error', options);
    return result;
  }
}

// ============================================================================
// Media Extraction (for visuals)
// ============================================================================

function extractImagesFromHtml(html: string, baseUrl: string): ExtractedMedia[] {
  const $ = cheerio.load(html);
  const extracted: ExtractedMedia[] = [];
  const seenUrls = new Set<string>();
  let order = 0;

  $('img').each((_, img) => {
    const $img = $(img);
    const src = $img.attr('src');
    const srcset = $img.attr('srcset');
    const alt = $img.attr('alt') || '';

    let url = src;
    if (srcset) {
      const sources = srcset.split(',').map((s) => {
        const parts = s.trim().split(/\s+/);
        return { url: parts[0], descriptor: parts[1] || '1x' };
      });
      const sorted = sources.sort((a, b) => {
        const aVal = parseFloat(a.descriptor) || 1;
        const bVal = parseFloat(b.descriptor) || 1;
        return bVal - aVal;
      });
      url = sorted[0]?.url || src;
    }

    if (!url) return;

    try {
      url = new URL(url, baseUrl).href;
    } catch {
      return;
    }

    const normalized = normalizeUrl(url);
    if (seenUrls.has(normalized)) return;
    seenUrls.add(normalized);

    if (shouldExclude(url, alt)) return;

    const classification = classifyImage(url, alt, order);
    extracted.push({
      url: getHighestResUrl(url),
      normalizedUrl: normalized,
      type: 'image',
      isLogo: classification === 'logo',
      classification,
      context: alt,
      order: order++,
    });
  });

  return extracted;
}

function extractVideosFromHtml(html: string, baseUrl: string): ExtractedMedia[] {
  const $ = cheerio.load(html);
  const extracted: ExtractedMedia[] = [];
  const seenUrls = new Set<string>();

  $('video').each((index, video) => {
    const $video = $(video);
    const src = $video.attr('src');
    const poster = $video.attr('poster');
    const source = $video.find('source').first();
    const videoSrc = src || source.attr('src');

    if (videoSrc) {
      try {
        const url = new URL(videoSrc, baseUrl).href;
        const normalized = normalizeUrl(url);
        if (!seenUrls.has(normalized)) {
          seenUrls.add(normalized);
          extracted.push({
            url,
            normalizedUrl: normalized,
            type: 'video',
            isLogo: false,
            classification: 'campaign',
            context: 'video element',
            order: index,
            posterUrl: poster ? new URL(poster, baseUrl).href : undefined,
          });
        }
      } catch {
        // Invalid URL
      }
    }
  });

  $('iframe').each((index, iframe) => {
    const src = $(iframe).attr('src');
    if (!src) return;

    const isYouTube = /youtube\.com|youtu\.be/.test(src);
    const isVimeo = /vimeo\.com/.test(src);

    if (isYouTube || isVimeo) {
      const normalized = normalizeUrl(src);
      if (!seenUrls.has(normalized)) {
        seenUrls.add(normalized);
        extracted.push({
          url: src,
          normalizedUrl: normalized,
          type: 'video',
          isLogo: false,
          classification: 'campaign',
          context: isYouTube ? 'YouTube embed' : 'Vimeo embed',
          order: index,
          videoUrl: src,
        });
      }
    }
  });

  return extracted;
}

function shouldExclude(url: string, alt: string): boolean {
  const combined = `${url} ${alt}`.toLowerCase();

  for (const pattern of EXCLUDED_URL_PATTERNS) {
    if (pattern.test(combined)) {
      return true;
    }
  }

  if (/\d+x\d+/.test(url)) {
    const match = url.match(/(\d+)x(\d+)/);
    if (match) {
      const width = parseInt(match[1]);
      const height = parseInt(match[2]);
      if (width < 50 || height < 50) {
        return true;
      }
    }
  }

  if (url.includes('.svg') && (url.includes('icon') || url.includes('arrow') || url.includes('chevron'))) {
    return true;
  }

  return false;
}

function classifyImage(url: string, alt: string, order: number): 'hero' | 'campaign' | 'process' | 'detail' | 'logo' {
  const combined = `${url} ${alt}`.toLowerCase();

  if (order === 0 || order === 1) {
    if (combined.includes('logo') || combined.includes('wordmark') || combined.includes('brand-mark')) {
      return 'logo';
    }
  }

  if (order <= 2 && !combined.includes('logo')) {
    return 'hero';
  }

  if (combined.includes('guide') || combined.includes('typography') ||
      combined.includes('system') || combined.includes('brand-') || combined.includes('style-')) {
    return 'process';
  }

  if (combined.includes('ooh') || combined.includes('billboard') ||
      combined.includes('signage') || combined.includes('social') ||
      combined.includes('ad-') || combined.includes('campaign')) {
    return 'campaign';
  }

  if (order < 5) {
    return 'campaign';
  }

  return 'detail';
}

// ============================================================================
// Full Case Study Ingestion
// ============================================================================

async function ingestCaseStudy(
  source: CaseStudySource,
  options: CliOptions,
  logoResult: LogoIngestionResult
): Promise<{
  patches: CaseStudyPatch[];
  report: IngestionReport;
}> {
  const report: IngestionReport = {
    caseId: source.internalCaseId,
    clientName: source.clientName,
    logoFound: logoResult.logoFound,
    imagesCount: 0,
    videosCount: 0,
    uploadedCount: 0,
    skipped: [],
  };

  try {
    const html = await fetchHtml(source.url);
    const images = extractImagesFromHtml(html, source.url);
    const videos = extractVideosFromHtml(html, source.url);

    // Exclude logo from visuals
    const visualImages = logoResult.logoUrl
      ? images.filter((img) => normalizeUrl(img.url) !== normalizeUrl(logoResult.logoUrl!))
      : images.filter((img) => img.classification !== 'logo');

    const uploadedAssets: Map<string, UploadedAsset> = new Map();
    let visualIndex = 1;

    for (const media of visualImages) {
      try {
        const ext = getExtension(media.url);
        const filename = `visual-${String(visualIndex).padStart(2, '0')}${ext}`;
        const uploaded = await uploadAsset(media.url, source.slug, filename, options);
        uploadedAssets.set(media.normalizedUrl, uploaded);
        report.uploadedCount++;
        report.imagesCount++;
        visualIndex++;
      } catch (err) {
        report.skipped.push({ url: media.url, reason: `Upload failed: ${err}` });
      }
    }

    for (const video of videos) {
      report.videosCount++;
      if (video.posterUrl) {
        try {
          const ext = getExtension(video.posterUrl);
          const filename = `video-poster-${String(visualIndex).padStart(2, '0')}${ext}`;
          const uploaded = await uploadAsset(video.posterUrl, source.slug, filename, options);
          uploadedAssets.set(normalizeUrl(video.posterUrl), uploaded);
          report.uploadedCount++;
        } catch (err) {
          report.skipped.push({ url: video.posterUrl, reason: `Upload failed: ${err}` });
        }
      }
      visualIndex++;
    }

    const patches: CaseStudyPatch[] = [];

    for (const caseId of [source.internalCaseId, source.publicCaseId]) {
      const visibility = caseId === source.publicCaseId ? 'public' : 'internal';

      const patch: CaseStudyPatch = {
        caseId,
        visuals: [],
      };

      if (logoResult.uploadedUrl) {
        patch.clientLogo = {
          assetUrl: logoResult.uploadedUrl,
          alt: `${source.clientName} logo`,
          theme: 'dark',
          variant: 'full',
          visibility: visibility as 'public' | 'internal',
          source: 'auto', // Auto-ingested - needs user confirmation
        };
      }

      let visualOrder = 0;
      for (const media of visualImages) {
        const uploaded = uploadedAssets.get(media.normalizedUrl);
        if (!uploaded) continue;

        patch.visuals.push({
          id: `${caseId}-${media.classification}-${hashUrl(media.url)}`,
          type: media.classification === 'logo' ? 'detail' : (media.classification as any),
          mediaType: 'image',
          assetUrl: uploaded.uploadedUrl,
          originalUrl: media.url,
          order: visualOrder++,
          visibility: visibility as 'public' | 'internal',
        });
      }

      for (const video of videos) {
        const posterUploaded = video.posterUrl
          ? uploadedAssets.get(normalizeUrl(video.posterUrl))
          : null;

        patch.visuals.push({
          id: `${caseId}-video-${hashUrl(video.url)}`,
          type: 'campaign',
          mediaType: 'video',
          assetUrl: posterUploaded?.uploadedUrl || video.posterUrl || '',
          originalUrl: video.url,
          linkUrl: video.videoUrl || video.url,
          posterUrl: posterUploaded?.uploadedUrl,
          order: visualOrder++,
          visibility: visibility as 'public' | 'internal',
        });
      }

      patches.push(patch);
    }

    return { patches, report };
  } catch (err) {
    log(`Failed to process ${source.clientName}: ${err}`, 'error', options);
    return { patches: [], report };
  }
}

// ============================================================================
// Report Output
// ============================================================================

function printLogoReport(results: LogoIngestionResult[], options: CliOptions): void {
  console.log('\n');
  log('=' .repeat(60));
  log('LOGO INGESTION REPORT');
  log('=' .repeat(60));

  const successful = results.filter((r) => r.logoFound && !r.needsManualOverride && !r.skippedDueToManual);
  const lowConfidence = results.filter((r) => r.logoFound && r.needsManualOverride && !r.skippedDueToManual);
  const notFound = results.filter((r) => !r.logoFound && !r.skippedDueToManual);
  const skipped = results.filter((r) => r.skippedDueToManual);
  const errors = results.filter((r) => r.error);

  console.log(`
Summary:
  ✓ High confidence: ${successful.length}
  ~ Low confidence:  ${lowConfidence.length}
  ✗ Not found:       ${notFound.length}
  ⊘ Skipped (manual): ${skipped.length}
  ⚠ Errors:          ${errors.length}
`);

  for (const result of results) {
    const status = result.error
      ? '✗'
      : result.skippedDueToManual
      ? '⊘'
      : !result.logoFound
      ? '○'
      : result.needsManualOverride
      ? '~'
      : '✓';

    console.log(`
${status} ${result.clientName} (${result.slug})
  Found: ${result.logoFound ? `Yes (${result.logoType})` : 'No'}
  Confidence: ${result.confidence}
  Score: ${result.score}
  Uploaded: ${result.uploadedUrl || 'N/A'}
  ${result.skippedDueToManual ? '⊘ SKIPPED - Manual logo exists (source=manual)' : ''}
  ${result.needsManualOverride && !result.skippedDueToManual ? '→ NEEDS MANUAL OVERRIDE' : ''}
  ${result.error ? `Error: ${result.error}` : ''}`);

    if (options.debug && result.scoreReasons.length > 0) {
      console.log('  Score reasons:');
      for (const reason of result.scoreReasons) {
        console.log(`    ${reason}`);
      }
    }
  }

  // Summary of actions needed
  if (notFound.length + lowConfidence.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('MANUAL OVERRIDES NEEDED:');
    console.log('='.repeat(60));
    console.log('\nPlace logo files in public/case-studies/<slug>/client-logo-manual.png');
    console.log('The following case studies need manual logo files:\n');
    for (const r of [...notFound, ...lowConfidence]) {
      console.log(`  - ${r.slug}/ → client-logo-manual.png (${r.clientName})`);
    }
  }
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const options = parseArgs();

  console.log('\n');
  log('=' .repeat(60));
  log(`CASE STUDY MEDIA INGESTION${options.logosOnly ? ' (LOGOS ONLY)' : ''}`);
  if (options.force) log('  --force: Will overwrite existing data');
  if (options.dryRun) log('  --dry-run: No files will be written');
  if (options.debug) log('  --debug: Verbose output enabled');
  log('=' .repeat(60));

  ensureDir(PUBLIC_DIR);
  ensureDir(DATA_DIR);

  // Always start with logo extraction
  const logoResults: LogoIngestionResult[] = [];

  for (const source of CASE_STUDY_SOURCES) {
    const result = await ingestClientLogo(source, options);
    logoResults.push(result);
  }

  // Save logo extraction report
  const logoReportPath = path.join(DATA_DIR, 'logo-extraction-report.json');
  if (!options.dryRun) {
    fs.writeFileSync(logoReportPath, JSON.stringify(logoResults, null, 2));
    log(`\nLogo report saved to: ${logoReportPath}`, 'success', options);
  }

  if (options.logosOnly) {
    // Logo-only mode - just print report and create patches
    printLogoReport(logoResults, options);

    // Generate logo-only patches
    const logoPatches: CaseStudyPatch[] = [];
    for (const result of logoResults) {
      if (result.uploadedUrl && !result.needsManualOverride) {
        const source = CASE_STUDY_SOURCES.find((s) => s.internalCaseId === result.caseId);
        if (source) {
          for (const caseId of [source.internalCaseId, source.publicCaseId]) {
            const visibility = caseId === source.publicCaseId ? 'public' : 'internal';
            logoPatches.push({
              caseId,
              clientLogo: {
                assetUrl: result.uploadedUrl,
                alt: `${result.clientName} logo`,
                theme: 'dark',
                variant: 'full',
                visibility: visibility as 'public' | 'internal',
                source: 'auto', // Auto-ingested - needs user confirmation
              },
              visuals: [],
            });
          }
        }
      }
    }

    const patchesPath = path.join(DATA_DIR, 'logo-patches.json');
    if (!options.dryRun) {
      fs.writeFileSync(patchesPath, JSON.stringify(logoPatches, null, 2));
      log(`Logo patches saved to: ${patchesPath}`, 'success', options);
    }
  } else {
    // Full ingestion
    const allPatches: CaseStudyPatch[] = [];
    const reports: IngestionReport[] = [];

    for (const source of CASE_STUDY_SOURCES) {
      log(`\n${'='.repeat(60)}`);
      log(`Processing visuals: ${source.clientName}`);
      log(`${'='.repeat(60)}`);

      const logoResult = logoResults.find((r) => r.caseId === source.internalCaseId)!;
      const { patches, report } = await ingestCaseStudy(source, options, logoResult);

      allPatches.push(...patches);
      reports.push(report);
    }

    // Write patches
    const patchesPath = path.join(DATA_DIR, 'case-study-media-patches.json');
    if (!options.dryRun) {
      fs.writeFileSync(patchesPath, JSON.stringify(allPatches, null, 2));
      log(`\nPatches saved to: ${patchesPath}`, 'success', options);
    }

    // Print combined report
    printLogoReport(logoResults, options);

    console.log('\n');
    log('=' .repeat(60));
    log('VISUAL INGESTION SUMMARY');
    log('=' .repeat(60));

    for (const report of reports) {
      console.log(`
${report.clientName}:
  Images: ${report.imagesCount}
  Videos: ${report.videosCount}
  Uploaded: ${report.uploadedCount}
  Skipped: ${report.skipped.length}`);
    }
  }

  console.log('\n');
  log('Ingestion complete!', 'success', options);
  log(`Assets saved to: ${PUBLIC_DIR}`);
  log(`Data saved to: ${DATA_DIR}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
