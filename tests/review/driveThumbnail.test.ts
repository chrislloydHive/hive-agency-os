import { describe, it, expect } from 'vitest';
import { driveThumbnailUrlAtSize } from '@/lib/review/driveThumbnail';
import {
  buildReviewFileProxyUrl,
  buildReviewFileThumbnailUrl,
} from '@/lib/review/reviewMediaDisplay';

describe('driveThumbnailUrlAtSize', () => {
  it('rewrites trailing =s220 to =s800', () => {
    expect(driveThumbnailUrlAtSize('https://lh3.googleusercontent.com/doc=abc=s220')).toBe(
      'https://lh3.googleusercontent.com/doc=abc=s800',
    );
  });

  it('appends =s800 when no size suffix exists', () => {
    expect(driveThumbnailUrlAtSize('https://lh3.googleusercontent.com/doc=abc')).toBe(
      'https://lh3.googleusercontent.com/doc=abc=s800',
    );
  });
});

describe('buildReviewFileThumbnailUrl', () => {
  it('includes thumb=1 and token on the files proxy path', () => {
    const url = buildReviewFileThumbnailUrl('file123', 'tok456', { crasRecordId: 'recABC' });
    expect(url).toContain('/api/review/files/file123?');
    expect(url).toContain('token=tok456');
    expect(url).toContain('thumb=1');
    expect(url).toContain('rid=recABC');
  });

  it('adds thumb=1 alongside the same auth params as the binary proxy', () => {
    const base = new URL(`https://example.com${buildReviewFileProxyUrl('file123', 'tok456', { crasRecordId: 'recABC' })}`);
    const thumb = new URL(`https://example.com${buildReviewFileThumbnailUrl('file123', 'tok456', { crasRecordId: 'recABC' })}`);
    expect(thumb.searchParams.get('token')).toBe(base.searchParams.get('token'));
    expect(thumb.searchParams.get('rid')).toBe(base.searchParams.get('rid'));
    expect(thumb.searchParams.get('thumb')).toBe('1');
  });
});
