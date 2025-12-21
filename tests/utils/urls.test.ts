// tests/utils/urls.test.ts
// Tests for URL normalization utilities

import { describe, it, expect } from 'vitest';
import {
  normalizeWebsiteUrl,
  tryNormalizeWebsiteUrl,
  extractHostname,
  isValidWebsiteUrl,
} from '@/lib/utils/urls';

// ============================================================================
// normalizeWebsiteUrl Tests
// ============================================================================

describe('normalizeWebsiteUrl', () => {
  describe('Bare domains (most common case)', () => {
    it('should normalize crateandbarrel.com to https://crateandbarrel.com/', () => {
      const result = normalizeWebsiteUrl('crateandbarrel.com');
      expect(result).toBe('https://crateandbarrel.com/');
    });

    it('should normalize example.com to https://example.com/', () => {
      const result = normalizeWebsiteUrl('example.com');
      expect(result).toBe('https://example.com/');
    });

    it('should normalize subdomain.example.com', () => {
      const result = normalizeWebsiteUrl('www.example.com');
      expect(result).toBe('https://www.example.com/');
    });

    it('should preserve path in bare domain', () => {
      const result = normalizeWebsiteUrl('example.com/path/to/page');
      expect(result).toBe('https://example.com/path/to/page');
    });
  });

  describe('Already-schemed URLs', () => {
    it('should keep https URLs unchanged', () => {
      const result = normalizeWebsiteUrl('https://example.com');
      expect(result).toBe('https://example.com/');
    });

    it('should upgrade http to https', () => {
      const result = normalizeWebsiteUrl('http://example.com');
      expect(result).toBe('https://example.com/');
    });

    it('should upgrade HTTP (case insensitive) to https', () => {
      const result = normalizeWebsiteUrl('HTTP://example.com');
      expect(result).toBe('https://example.com/');
    });

    it('should preserve query string', () => {
      const result = normalizeWebsiteUrl('https://example.com/page?foo=bar');
      expect(result).toBe('https://example.com/page?foo=bar');
    });

    it('should preserve hash', () => {
      const result = normalizeWebsiteUrl('https://example.com/page#section');
      expect(result).toBe('https://example.com/page#section');
    });
  });

  describe('Edge cases', () => {
    it('should handle protocol-relative URLs', () => {
      const result = normalizeWebsiteUrl('//example.com');
      expect(result).toBe('https://example.com/');
    });

    it('should handle whitespace', () => {
      const result = normalizeWebsiteUrl('  example.com  ');
      expect(result).toBe('https://example.com/');
    });

    it('should throw for empty string', () => {
      expect(() => normalizeWebsiteUrl('')).toThrow();
    });

    it('should throw for null/undefined', () => {
      expect(() => normalizeWebsiteUrl(null as unknown as string)).toThrow();
      expect(() => normalizeWebsiteUrl(undefined as unknown as string)).toThrow();
    });

    it('should throw for paths without domain', () => {
      expect(() => normalizeWebsiteUrl('/path/only')).toThrow();
    });
  });
});

// ============================================================================
// tryNormalizeWebsiteUrl Tests
// ============================================================================

describe('tryNormalizeWebsiteUrl', () => {
  it('should return ok: true for valid URLs', () => {
    const result = tryNormalizeWebsiteUrl('crateandbarrel.com');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url).toBe('https://crateandbarrel.com/');
    }
  });

  it('should return ok: false for empty string', () => {
    const result = tryNormalizeWebsiteUrl('');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('empty');
    }
  });

  it('should return ok: false for garbage input', () => {
    const result = tryNormalizeWebsiteUrl('not a url at all!!!');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeDefined();
    }
  });

  it('should return ok: false for path-only input', () => {
    const result = tryNormalizeWebsiteUrl('/just/a/path');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('path without a domain');
    }
  });

  it('should return ok: false for single word (no TLD)', () => {
    const result = tryNormalizeWebsiteUrl('localhost');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('hostname');
    }
  });
});

// ============================================================================
// extractHostname Tests
// ============================================================================

describe('extractHostname', () => {
  it('should extract hostname from bare domain', () => {
    expect(extractHostname('crateandbarrel.com')).toBe('crateandbarrel.com');
  });

  it('should extract hostname from full URL', () => {
    expect(extractHostname('https://www.example.com/path')).toBe('www.example.com');
  });

  it('should return null for invalid input', () => {
    expect(extractHostname('')).toBeNull();
    expect(extractHostname('not a url')).toBeNull();
  });
});

// ============================================================================
// isValidWebsiteUrl Tests
// ============================================================================

describe('isValidWebsiteUrl', () => {
  it('should return true for valid URLs', () => {
    expect(isValidWebsiteUrl('crateandbarrel.com')).toBe(true);
    expect(isValidWebsiteUrl('https://example.com')).toBe(true);
    expect(isValidWebsiteUrl('http://example.com/path')).toBe(true);
  });

  it('should return false for invalid URLs', () => {
    expect(isValidWebsiteUrl('')).toBe(false);
    expect(isValidWebsiteUrl('not-a-url')).toBe(false);
    expect(isValidWebsiteUrl('/path/only')).toBe(false);
  });
});
