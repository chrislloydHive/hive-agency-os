import { describe, it, expect } from 'vitest';
import {
  muxThumbnailUrl,
  muxGridPosterUrls,
  muxCarouselPosterUrls,
  muxPortalPosterWarmUrls,
  muxAnimatedPreviewUrls,
  muxPortalPosterUrls,
  muxPortalPosterDisplayUrls,
  muxProgressiveMp4Url,
  reviewTacticPrefersAnimatedMuxPreview,
  MUX_PORTAL_GRID_POSTER,
} from '@/lib/review/muxThumbnail';

describe('muxThumbnailUrl', () => {
  it('defaults to primary grid poster params', () => {
    expect(muxThumbnailUrl('pb_abc')).toBe(
      'https://image.mux.com/pb_abc/thumbnail.jpg?width=640&height=360&fit_mode=smartcrop&time=1.5',
    );
  });

  it('muxGridPosterUrls first entry matches default muxThumbnailUrl', () => {
    const urls = muxGridPosterUrls('pb_abc');
    expect(urls[0]).toBe(muxThumbnailUrl('pb_abc'));
    expect(urls[0]).toContain(`time=${MUX_PORTAL_GRID_POSTER.time}`);
  });

  it('muxPortalPosterWarmUrls includes grid, carousel, and aspect fallbacks', () => {
    const warm = muxPortalPosterWarmUrls('pb_abc', '16:9');
    const grid = muxGridPosterUrls('pb_abc');
    const carousel = muxCarouselPosterUrls('pb_abc');
    expect(warm.length).toBeGreaterThan(new Set([...grid, ...carousel]).size);
    for (const url of [...grid, ...carousel]) {
      expect(warm).toContain(url);
    }
  });

  it('muxProgressiveMp4Url points at stream.mux.com renditions', () => {
    expect(muxProgressiveMp4Url('pb_abc')).toBe('https://stream.mux.com/pb_abc/low.mp4');
    expect(muxProgressiveMp4Url('pb_abc', 'medium')).toBe('https://stream.mux.com/pb_abc/medium.mp4');
  });

  it('muxAnimatedPreviewUrls prefers webp then gif and clamps width', () => {
    const urls = muxAnimatedPreviewUrls('pb_abc', { width: 960 });
    expect(urls[0]).toContain('/animated.webp?');
    expect(urls[0]).toContain('width=640');
    expect(urls[0]).toContain('fps=8');
    expect(urls[0]).toContain('start=1');
    expect(urls[0]).toContain('end=4');
    expect(urls[1]).toContain('/animated.gif?');
  });

  it('muxPortalPosterUrls leads with animated when requested', () => {
    const urls = muxPortalPosterUrls('pb_abc', 'grid', { animated: true });
    expect(urls[0]).toContain('/animated.webp?');
    expect(urls).toContain(muxThumbnailUrl('pb_abc'));
  });

  it('static display URLs lead with a full-frame poster, not a 16:9 crop', () => {
    const urls = muxPortalPosterDisplayUrls('pb_abc', 'grid', '9:16');
    expect(urls[0]).toContain('fit_mode=preserve');
    expect(urls[0]).toContain('time=1.5');
    expect(urls.some((u) => u.includes('fit_mode=smartcrop'))).toBe(true);
    expect(urls.some((u) => u.includes('/animated.'))).toBe(false);
  });

  it('reviewTacticPrefersAnimatedMuxPreview is Display-only', () => {
    expect(reviewTacticPrefersAnimatedMuxPreview('Display')).toBe(true);
    expect(reviewTacticPrefersAnimatedMuxPreview('display')).toBe(true);
    expect(reviewTacticPrefersAnimatedMuxPreview('Video')).toBe(false);
    expect(reviewTacticPrefersAnimatedMuxPreview('Social')).toBe(false);
  });
});
