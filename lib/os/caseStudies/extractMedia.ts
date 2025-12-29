// lib/os/caseStudies/extractMedia.ts
// Utility to extract media information from URLs for case study visuals

import type { CaseStudyVisual, CaseStudyMediaType, CaseStudyVisualType } from '@/lib/types/firmBrain';

/**
 * Extracted media information from a URL
 */
export interface ExtractedMediaInfo {
  mediaType: CaseStudyMediaType;
  assetUrl: string;
  thumbnailUrl?: string;
  linkUrl?: string;
  title?: string;
  platform?: 'youtube' | 'vimeo' | 'direct';
}

/**
 * YouTube URL patterns
 */
const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
];

/**
 * Vimeo URL patterns
 */
const VIMEO_PATTERNS = [
  /vimeo\.com\/(\d+)/,
  /player\.vimeo\.com\/video\/(\d+)/,
];

/**
 * Image file extension patterns
 */
const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg|avif)$/i;

/**
 * Video file extension patterns
 */
const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|avi|mkv)$/i;

/**
 * Extract YouTube video ID from URL
 */
export function extractYouTubeId(url: string): string | null {
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Extract Vimeo video ID from URL
 */
export function extractVimeoId(url: string): string | null {
  for (const pattern of VIMEO_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Get YouTube thumbnail URL from video ID
 */
export function getYouTubeThumbnailUrl(videoId: string, quality: 'default' | 'medium' | 'high' | 'max' = 'high'): string {
  const qualityMap = {
    default: 'default',
    medium: 'mqdefault',
    high: 'hqdefault',
    max: 'maxresdefault',
  };
  return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
}

/**
 * Get Vimeo thumbnail URL from video ID
 * Note: Vimeo requires an API call for reliable thumbnails, this returns a placeholder
 */
export function getVimeoThumbnailUrl(videoId: string): string {
  // Vimeo doesn't have a simple thumbnail URL pattern
  // In production, you'd fetch from their API
  return `https://vumbnail.com/${videoId}.jpg`;
}

/**
 * Extract media information from a URL
 */
export function extractCaseStudyMediaFromUrl(url: string): ExtractedMediaInfo {
  // Check for YouTube
  const youtubeId = extractYouTubeId(url);
  if (youtubeId) {
    return {
      mediaType: 'video',
      assetUrl: getYouTubeThumbnailUrl(youtubeId),
      thumbnailUrl: getYouTubeThumbnailUrl(youtubeId),
      linkUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
      platform: 'youtube',
    };
  }

  // Check for Vimeo
  const vimeoId = extractVimeoId(url);
  if (vimeoId) {
    return {
      mediaType: 'video',
      assetUrl: getVimeoThumbnailUrl(vimeoId),
      thumbnailUrl: getVimeoThumbnailUrl(vimeoId),
      linkUrl: `https://vimeo.com/${vimeoId}`,
      platform: 'vimeo',
    };
  }

  // Check for direct video file
  if (VIDEO_EXTENSIONS.test(url)) {
    return {
      mediaType: 'video',
      assetUrl: url,
      linkUrl: url,
      platform: 'direct',
    };
  }

  // Default to image
  return {
    mediaType: 'image',
    assetUrl: url,
    platform: 'direct',
  };
}

/**
 * Create a case study visual from a URL
 */
export function createVisualFromUrl(
  url: string,
  options: {
    type?: CaseStudyVisualType;
    title?: string;
    caption?: string;
    order?: number;
    visibility?: 'public' | 'internal';
  } = {}
): Omit<CaseStudyVisual, 'id'> {
  const mediaInfo = extractCaseStudyMediaFromUrl(url);

  return {
    type: options.type || 'campaign',
    mediaType: mediaInfo.mediaType,
    title: options.title || mediaInfo.title,
    caption: options.caption,
    assetUrl: mediaInfo.assetUrl,
    linkUrl: mediaInfo.linkUrl,
    thumbnailUrl: mediaInfo.thumbnailUrl,
    order: options.order || 0,
    visibility: options.visibility || 'internal',
  };
}

/**
 * Detect the likely visual type from a URL or filename
 */
export function detectVisualType(url: string): CaseStudyVisualType {
  const lowercaseUrl = url.toLowerCase();

  if (lowercaseUrl.includes('hero') || lowercaseUrl.includes('cover') || lowercaseUrl.includes('header')) {
    return 'hero';
  }
  if (lowercaseUrl.includes('before') || lowercaseUrl.includes('after') || lowercaseUrl.includes('comparison')) {
    return 'before_after';
  }
  if (lowercaseUrl.includes('process') || lowercaseUrl.includes('workflow') || lowercaseUrl.includes('behind')) {
    return 'process';
  }
  if (lowercaseUrl.includes('detail') || lowercaseUrl.includes('closeup') || lowercaseUrl.includes('zoom')) {
    return 'detail';
  }

  // Default to campaign
  return 'campaign';
}

/**
 * Check if a URL is a valid media URL
 */
export function isValidMediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    // Check for known video platforms
    if (extractYouTubeId(url) || extractVimeoId(url)) {
      return true;
    }

    // Check for media file extensions
    if (IMAGE_EXTENSIONS.test(url) || VIDEO_EXTENSIONS.test(url)) {
      return true;
    }

    // Accept other URLs as potentially valid images
    return true;
  } catch {
    return false;
  }
}
