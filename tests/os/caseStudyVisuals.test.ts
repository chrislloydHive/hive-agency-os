// tests/os/caseStudyVisuals.test.ts
// Tests for case study visuals and client logo functionality

import { describe, it, expect } from 'vitest';
import {
  extractCaseStudyMediaFromUrl,
  createVisualFromUrl,
  extractYouTubeId,
  extractVimeoId,
  getYouTubeThumbnailUrl,
  getVimeoThumbnailUrl,
  detectVisualType,
  isValidMediaUrl,
} from '@/lib/os/caseStudies/extractMedia';
import { CaseStudyVisualSchema, CaseStudyClientLogoSchema } from '@/lib/types/firmBrain';

// ============================================================================
// Tests: YouTube URL extraction
// ============================================================================

describe('extractYouTubeId', () => {
  it('extracts ID from standard watch URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts ID from short URL', () => {
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts ID from embed URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts ID from shorts URL', () => {
    expect(extractYouTubeId('https://youtube.com/shorts/abc123XYZ_0')).toBe('abc123XYZ_0');
  });

  it('returns null for non-YouTube URL', () => {
    expect(extractYouTubeId('https://vimeo.com/123456789')).toBeNull();
    expect(extractYouTubeId('https://example.com/video.mp4')).toBeNull();
  });
});

// ============================================================================
// Tests: Vimeo URL extraction
// ============================================================================

describe('extractVimeoId', () => {
  it('extracts ID from standard Vimeo URL', () => {
    expect(extractVimeoId('https://vimeo.com/123456789')).toBe('123456789');
  });

  it('extracts ID from player URL', () => {
    expect(extractVimeoId('https://player.vimeo.com/video/123456789')).toBe('123456789');
  });

  it('returns null for non-Vimeo URL', () => {
    expect(extractVimeoId('https://youtube.com/watch?v=abc123')).toBeNull();
    expect(extractVimeoId('https://example.com/video.mp4')).toBeNull();
  });
});

// ============================================================================
// Tests: Thumbnail URL generation
// ============================================================================

describe('getYouTubeThumbnailUrl', () => {
  it('generates thumbnail URL with default quality', () => {
    const url = getYouTubeThumbnailUrl('dQw4w9WgXcQ');
    expect(url).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  });

  it('generates thumbnail URL with specified quality', () => {
    expect(getYouTubeThumbnailUrl('abc123', 'max')).toBe('https://img.youtube.com/vi/abc123/maxresdefault.jpg');
    expect(getYouTubeThumbnailUrl('abc123', 'default')).toBe('https://img.youtube.com/vi/abc123/default.jpg');
  });
});

describe('getVimeoThumbnailUrl', () => {
  it('generates Vimeo thumbnail URL', () => {
    const url = getVimeoThumbnailUrl('123456789');
    expect(url).toContain('123456789');
  });
});

// ============================================================================
// Tests: extractCaseStudyMediaFromUrl
// ============================================================================

describe('extractCaseStudyMediaFromUrl', () => {
  it('extracts YouTube video info', () => {
    const result = extractCaseStudyMediaFromUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(result.mediaType).toBe('video');
    expect(result.platform).toBe('youtube');
    expect(result.linkUrl).toContain('youtube.com');
    expect(result.thumbnailUrl).toContain('img.youtube.com');
  });

  it('extracts Vimeo video info', () => {
    const result = extractCaseStudyMediaFromUrl('https://vimeo.com/123456789');
    expect(result.mediaType).toBe('video');
    expect(result.platform).toBe('vimeo');
    expect(result.linkUrl).toContain('vimeo.com');
  });

  it('detects direct video files', () => {
    const result = extractCaseStudyMediaFromUrl('https://example.com/video.mp4');
    expect(result.mediaType).toBe('video');
    expect(result.platform).toBe('direct');
  });

  it('defaults to image for other URLs', () => {
    const result = extractCaseStudyMediaFromUrl('https://example.com/image.jpg');
    expect(result.mediaType).toBe('image');
    expect(result.platform).toBe('direct');
  });

  it('defaults to image for unknown URLs', () => {
    const result = extractCaseStudyMediaFromUrl('https://example.com/page');
    expect(result.mediaType).toBe('image');
  });
});

// ============================================================================
// Tests: createVisualFromUrl
// ============================================================================

describe('createVisualFromUrl', () => {
  it('creates a visual object from image URL', () => {
    const visual = createVisualFromUrl('https://example.com/image.jpg', {
      title: 'Test Image',
      type: 'hero',
    });
    expect(visual.mediaType).toBe('image');
    expect(visual.type).toBe('hero');
    expect(visual.title).toBe('Test Image');
    expect(visual.assetUrl).toBe('https://example.com/image.jpg');
  });

  it('creates a visual object from YouTube URL', () => {
    const visual = createVisualFromUrl('https://youtube.com/watch?v=abc123XYZ_0');
    expect(visual.mediaType).toBe('video');
    expect(visual.linkUrl).toContain('youtube.com');
    expect(visual.thumbnailUrl).toContain('img.youtube.com');
  });

  it('uses default values when not specified', () => {
    const visual = createVisualFromUrl('https://example.com/image.png');
    expect(visual.type).toBe('campaign');
    expect(visual.order).toBe(0);
    expect(visual.visibility).toBe('internal');
  });
});

// ============================================================================
// Tests: detectVisualType
// ============================================================================

describe('detectVisualType', () => {
  it('detects hero images', () => {
    expect(detectVisualType('https://example.com/hero-image.jpg')).toBe('hero');
    expect(detectVisualType('https://example.com/cover-photo.png')).toBe('hero');
    expect(detectVisualType('https://example.com/header.webp')).toBe('hero');
  });

  it('detects before/after images', () => {
    expect(detectVisualType('https://example.com/before-after.jpg')).toBe('before_after');
    expect(detectVisualType('https://example.com/comparison.png')).toBe('before_after');
  });

  it('detects process images', () => {
    expect(detectVisualType('https://example.com/process-shot.jpg')).toBe('process');
    expect(detectVisualType('https://example.com/behind-the-scenes.png')).toBe('process');
    expect(detectVisualType('https://example.com/workflow.jpg')).toBe('process');
  });

  it('detects detail images', () => {
    expect(detectVisualType('https://example.com/detail-view.jpg')).toBe('detail');
    expect(detectVisualType('https://example.com/closeup.png')).toBe('detail');
    expect(detectVisualType('https://example.com/zoom-in.jpg')).toBe('detail');
  });

  it('defaults to campaign for generic URLs', () => {
    expect(detectVisualType('https://example.com/image.jpg')).toBe('campaign');
    expect(detectVisualType('https://example.com/product.png')).toBe('campaign');
  });
});

// ============================================================================
// Tests: isValidMediaUrl
// ============================================================================

describe('isValidMediaUrl', () => {
  it('validates YouTube URLs', () => {
    expect(isValidMediaUrl('https://youtube.com/watch?v=abc123')).toBe(true);
    expect(isValidMediaUrl('https://youtu.be/abc123')).toBe(true);
  });

  it('validates Vimeo URLs', () => {
    expect(isValidMediaUrl('https://vimeo.com/123456789')).toBe(true);
  });

  it('validates image URLs', () => {
    expect(isValidMediaUrl('https://example.com/image.jpg')).toBe(true);
    expect(isValidMediaUrl('https://example.com/image.png')).toBe(true);
    expect(isValidMediaUrl('https://example.com/image.webp')).toBe(true);
  });

  it('validates video URLs', () => {
    expect(isValidMediaUrl('https://example.com/video.mp4')).toBe(true);
    expect(isValidMediaUrl('https://example.com/video.webm')).toBe(true);
  });

  it('accepts HTTPS URLs', () => {
    expect(isValidMediaUrl('https://example.com/media')).toBe(true);
  });

  it('rejects invalid URLs', () => {
    expect(isValidMediaUrl('not-a-url')).toBe(false);
    expect(isValidMediaUrl('ftp://example.com/file')).toBe(false);
  });
});

// ============================================================================
// Tests: Zod Schema Validation
// ============================================================================

describe('CaseStudyVisualSchema', () => {
  it('validates a complete visual object', () => {
    const visual = {
      id: 'visual-1',
      type: 'hero',
      mediaType: 'image',
      title: 'Hero Image',
      caption: 'Main campaign visual',
      assetUrl: 'https://example.com/hero.jpg',
      order: 0,
      visibility: 'public',
    };
    const result = CaseStudyVisualSchema.safeParse(visual);
    expect(result.success).toBe(true);
  });

  it('validates a video visual with link', () => {
    const visual = {
      id: 'visual-2',
      type: 'campaign',
      mediaType: 'video',
      assetUrl: 'https://example.com/thumb.jpg',
      linkUrl: 'https://youtube.com/watch?v=abc123',
      thumbnailUrl: 'https://img.youtube.com/vi/abc123/hqdefault.jpg',
      order: 1,
      visibility: 'internal',
    };
    const result = CaseStudyVisualSchema.safeParse(visual);
    expect(result.success).toBe(true);
  });

  it('requires assetUrl', () => {
    const visual = {
      id: 'visual-3',
      type: 'campaign',
      mediaType: 'image',
    };
    const result = CaseStudyVisualSchema.safeParse(visual);
    expect(result.success).toBe(false);
  });

  it('validates visibility values', () => {
    const visual = {
      id: 'visual-4',
      type: 'detail',
      mediaType: 'image',
      assetUrl: 'https://example.com/detail.jpg',
      visibility: 'internal',
    };
    const result = CaseStudyVisualSchema.safeParse(visual);
    expect(result.success).toBe(true);
  });
});

describe('CaseStudyClientLogoSchema', () => {
  it('validates a complete logo object', () => {
    const logo = {
      assetUrl: 'https://example.com/logo.svg',
      alt: 'Company Logo',
      visibility: 'public',
    };
    const result = CaseStudyClientLogoSchema.safeParse(logo);
    expect(result.success).toBe(true);
  });

  it('validates logo with all optional fields', () => {
    const logo = {
      assetUrl: 'https://example.com/logo.svg',
      fallbackUrl: 'https://example.com/logo.png',
      alt: 'Company Logo',
      theme: 'dark',
      variant: 'full',
      visibility: 'internal',
    };
    const result = CaseStudyClientLogoSchema.safeParse(logo);
    expect(result.success).toBe(true);
  });

  it('requires assetUrl and alt', () => {
    const logo = {
      visibility: 'public',
    };
    const result = CaseStudyClientLogoSchema.safeParse(logo);
    expect(result.success).toBe(false);
  });
});
