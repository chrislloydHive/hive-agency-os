import { describe, it, expect } from 'vitest';
import {
  muxThumbnailUrl,
  muxGridPosterUrls,
  muxCarouselPosterUrls,
  muxPortalPosterWarmUrls,
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
});
