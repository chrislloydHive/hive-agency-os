import { describe, it, expect, vi, beforeEach } from 'vitest';

import { muxPortalPosterWarmUrls } from '@/lib/review/muxThumbnail';
import { warmMuxThumbnailCache } from '@/lib/review/warmMuxThumbnail';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('warmMuxThumbnailCache', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true });
  });

  it('fetches every portal poster variant and awaits completion', async () => {
    const urls = muxPortalPosterWarmUrls('pb_test');
    const result = await warmMuxThumbnailCache('pb_test');

    expect(mockFetch).toHaveBeenCalledTimes(urls.length);
    for (const url of urls) {
      expect(mockFetch).toHaveBeenCalledWith(url, expect.objectContaining({ method: 'GET' }));
    }
    expect(result).toEqual({ urls: urls.length, ok: urls.length, failed: 0 });
  });

  it('returns counts when some requests fail without throwing', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue({ ok: true });

    const result = await warmMuxThumbnailCache('pb_test');
    expect(result.failed).toBeGreaterThanOrEqual(1);
    expect(result.ok).toBeGreaterThanOrEqual(1);
  });
});
