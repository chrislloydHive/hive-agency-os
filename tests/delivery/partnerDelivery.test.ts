import { describe, it, expect } from 'vitest';
import { isAbortError } from '@/lib/delivery/partnerDelivery';

describe('partnerDelivery', () => {
  describe('isAbortError', () => {
    it('returns true for Error with name AbortError', () => {
      const e = new Error('aborted');
      (e as Error & { name: string }).name = 'AbortError';
      expect(isAbortError(e)).toBe(true);
    });

    it('returns true for object with type "aborted"', () => {
      expect(isAbortError({ type: 'aborted' })).toBe(true);
    });

    it('returns true when message matches /aborted|AbortError/i', () => {
      expect(isAbortError(new Error('The user aborted a request'))).toBe(true);
      expect(isAbortError(new Error('AbortError'))).toBe(true);
    });

    it('returns false for other errors', () => {
      expect(isAbortError(new Error('Network error'))).toBe(false);
      expect(isAbortError(new Error('Airtable API error (422)'))).toBe(false);
      expect(isAbortError('string')).toBe(false);
      expect(isAbortError(null)).toBe(false);
    });
  });
});
