import { describe, it, expect } from 'vitest';
import {
  isGmailThreadNotFoundError,
  isThreadGoneRefreshResponse,
  THREAD_GONE_CODE,
} from '@/lib/os/gmailThreadGone';

describe('gmailThreadGone', () => {
  it('detects Gmail not-found errors', () => {
    expect(isGmailThreadNotFoundError(new Error('Requested entity was not found'))).toBe(true);
    expect(isGmailThreadNotFoundError(new Error('404 Not Found'))).toBe(false);
  });

  it('recognizes new 410 thread_gone shape', () => {
    expect(
      isThreadGoneRefreshResponse(410, {
        code: THREAD_GONE_CODE,
        error: 'Could not load primary Gmail thread: Requested entity was not found.',
      }),
    ).toBe(true);
  });

  it('recognizes legacy 502 + diagnostic message', () => {
    expect(
      isThreadGoneRefreshResponse(502, {
        error:
          'Could not load primary Gmail thread: Requested entity was not found.',
      }),
    ).toBe(true);
  });

  it('rejects unrelated 502 errors', () => {
    expect(isThreadGoneRefreshResponse(502, { error: 'Claude timeout' })).toBe(false);
  });
});
