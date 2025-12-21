// tests/diagnostics/moduleResult.test.ts
// Tests for Lab ModuleResult Contract
//
// Verifies:
// 1. SEO Lab failure still writes moduleResult (no blank field)
// 2. Content Lab with missing blog produces completed_shallow + low confidence

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildFailedModuleResult,
  buildCompletedModuleResult,
  buildShallowModuleResult,
  shouldBeShallowContentResult,
  detectModuleErrorCode,
  validateModuleResult,
  hasMinimumEvidence,
  isCompletedResult,
  isShallowResult,
  isFailedResult,
  hasUsableData,
  type ModuleResult,
} from '@/lib/os/diagnostics/moduleResult';

// ============================================================================
// buildFailedModuleResult Tests
// ============================================================================

describe('buildFailedModuleResult', () => {
  it('should build a failed moduleResult with all required fields', () => {
    const result = buildFailedModuleResult(
      'seoLab',
      'example.com',
      'https://example.com/',
      'Connection refused',
      'URL_UNREACHABLE',
      '2024-01-01T00:00:00.000Z'
    );

    expect(result.module).toBe('seoLab');
    expect(result.status).toBe('failed');
    expect(result.inputUrl).toBe('example.com');
    expect(result.normalizedUrl).toBe('https://example.com/');
    expect(result.score).toBeNull();
    expect(result.summary).toContain('failed');
    expect(result.dataConfidence.level).toBe('low');
    expect(result.dataConfidence.score).toBe(0);
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe('URL_UNREACHABLE');
    expect(result.error?.retryable).toBe(true);
    expect(result.startedAt).toBe('2024-01-01T00:00:00.000Z');
    expect(result.completedAt).toBeDefined();
  });

  it('should handle Error objects', () => {
    const error = new Error('Something went wrong');
    const result = buildFailedModuleResult(
      'contentLab',
      'test.com',
      null,
      error,
      'UNKNOWN'
    );

    expect(result.error?.message).toBe('Something went wrong');
  });

  it('should mark INVALID_URL as non-retryable', () => {
    const result = buildFailedModuleResult(
      'seoLab',
      'not-a-url',
      null,
      'Invalid URL format',
      'INVALID_URL'
    );

    expect(result.error?.retryable).toBe(false);
  });

  it('should never produce undefined rawJson fields', () => {
    const result = buildFailedModuleResult(
      'seoLab',
      'example.com',
      null,
      'Test error'
    );

    // All required fields should be present
    expect(result.module).toBeDefined();
    expect(result.status).toBeDefined();
    expect(result.startedAt).toBeDefined();
    expect(result.completedAt).toBeDefined();
    expect(result.inputUrl).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.dataConfidence).toBeDefined();

    // Can be serialized to JSON without undefined values
    const json = JSON.stringify(result);
    expect(json).not.toContain('undefined');
  });
});

// ============================================================================
// SEO Lab Failure Writes ModuleResult Tests
// ============================================================================

describe('SEO Lab failure writes moduleResult', () => {
  it('should produce a non-blank moduleResult on engine failure', () => {
    // Simulate SEO Lab engine failure
    const result = buildFailedModuleResult(
      'seoLab',
      'crateandbarrel.com',
      'https://crateandbarrel.com/',
      'Heavy worker v4 timed out',
      'TIMEOUT'
    );

    // Verify rawJson would not be blank
    expect(result).not.toBeNull();
    expect(result).not.toBeUndefined();
    expect(Object.keys(result).length).toBeGreaterThan(0);

    // Verify essential fields for Airtable display
    expect(result.module).toBe('seoLab');
    expect(result.status).toBe('failed');
    expect(result.summary).toBeTruthy();
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe('TIMEOUT');
  });

  it('should include URL provenance even on failure', () => {
    const result = buildFailedModuleResult(
      'seoLab',
      'bare-domain.com',
      'https://bare-domain.com/',
      'Crawl failed',
      'CRAWL_FAILED'
    );

    expect(result.inputUrl).toBe('bare-domain.com');
    expect(result.normalizedUrl).toBe('https://bare-domain.com/');
  });

  it('should handle null normalizedUrl (invalid URL case)', () => {
    const result = buildFailedModuleResult(
      'seoLab',
      '/just/a/path',
      null,
      'URL is a path without a domain',
      'INVALID_URL'
    );

    expect(result.inputUrl).toBe('/just/a/path');
    expect(result.normalizedUrl).toBeNull();
    expect(result.status).toBe('failed');
  });
});

// ============================================================================
// Content Lab completed_shallow Tests
// ============================================================================

describe('shouldBeShallowContentResult', () => {
  it('should mark result as shallow when no blog detected', () => {
    const check = shouldBeShallowContentResult({
      hasBlog: false,
      articleCount: 0,
      contentUrls: ['https://example.com/'],
    });

    expect(check.isShallow).toBe(true);
    expect(check.reason).toBeDefined();
    expect(check.missingData).toContain('No blog section detected');
    expect(check.missingData).toContain('No articles or content pages found');
  });

  it('should mark result as shallow when only homepage scanned', () => {
    const check = shouldBeShallowContentResult({
      hasBlog: true,
      articleCount: 5,
      contentUrls: ['https://example.com/'], // Only 1 URL = homepage only
    });

    expect(check.isShallow).toBe(true);
    expect(check.missingData).toContain('Only homepage scanned (no internal crawl)');
  });

  it('should NOT mark as shallow when blog and multiple pages exist', () => {
    const check = shouldBeShallowContentResult({
      hasBlog: true,
      articleCount: 10,
      contentUrls: [
        'https://example.com/',
        'https://example.com/blog',
        'https://example.com/blog/article-1',
        'https://example.com/blog/article-2',
      ],
    });

    expect(check.isShallow).toBe(false);
    expect(check.reason).toBeUndefined();
    expect(check.missingData).toBeUndefined();
  });

  it('should handle empty contentUrls array', () => {
    const check = shouldBeShallowContentResult({
      hasBlog: false,
      articleCount: 0,
      contentUrls: [],
    });

    expect(check.isShallow).toBe(true);
  });

  it('should handle undefined contentUrls', () => {
    const check = shouldBeShallowContentResult({
      hasBlog: false,
      articleCount: 0,
      contentUrls: undefined,
    });

    expect(check.isShallow).toBe(true);
  });
});

describe('buildShallowModuleResult', () => {
  it('should produce completed_shallow status with low confidence', () => {
    const result = buildShallowModuleResult(
      'contentLab',
      'example.com',
      'https://example.com/',
      35, // Low score
      'Content analysis limited to homepage only.',
      'No blog section detected',
      ['No blog section detected', 'No articles or content pages found'],
      { dimensions: [], issues: [] },
      '2024-01-01T00:00:00.000Z'
    );

    expect(result.status).toBe('completed_shallow');
    expect(result.score).toBe(35);
    expect(result.dataConfidence.level).toBe('low');
    expect(result.dataConfidence.score).toBe(30);
    expect(result.shallowReason).toBe('No blog section detected');
    expect(result.missingData).toContain('No articles or content pages found');
  });

  it('should include URL provenance in shallow results', () => {
    const result = buildShallowModuleResult(
      'contentLab',
      'bare-domain.com',
      'https://bare-domain.com/',
      25,
      'Limited content analysis',
      'Only homepage scanned',
      ['Only homepage scanned'],
      {}
    );

    expect(result.inputUrl).toBe('bare-domain.com');
    expect(result.normalizedUrl).toBe('https://bare-domain.com/');
  });
});

describe('Content Lab produces completed_shallow for missing blog', () => {
  it('should produce completed_shallow with low dataConfidence when no blog detected', () => {
    // Simulate Content Lab analysis with no blog
    const analysisResult = {
      hasBlog: false,
      articleCount: 0,
      contentUrls: ['https://example.com/'],
    };

    const shallowCheck = shouldBeShallowContentResult(analysisResult);
    expect(shallowCheck.isShallow).toBe(true);

    // Build the shallow module result
    const result = buildShallowModuleResult(
      'contentLab',
      'example.com',
      'https://example.com/',
      20, // Low score due to no content
      'No content engine detected. This is a homepage-only analysis.',
      shallowCheck.reason!,
      shallowCheck.missingData!,
      {
        dimensions: [
          { key: 'inventory', score: 10, status: 'weak' },
          { key: 'quality', score: null, status: 'not_evaluated' },
        ],
      }
    );

    // Verify it's marked as shallow, not completed
    expect(result.status).toBe('completed_shallow');
    expect(result.status).not.toBe('completed');

    // Verify low confidence
    expect(result.dataConfidence.level).toBe('low');
    expect(result.dataConfidence.score).toBeLessThanOrEqual(30);

    // Verify reason is informative (not claiming definitive truth)
    expect(result.shallowReason).toBeDefined();
    expect(result.missingData).toContain('No blog section detected');
    expect(result.summary).not.toContain('comprehensive');
  });

  it('should NOT claim certainty about content absence', () => {
    const result = buildShallowModuleResult(
      'contentLab',
      'example.com',
      'https://example.com/',
      15,
      'Limited signals available.',
      'Only homepage analyzed',
      ['No blog detected', 'No internal pages crawled'],
      {}
    );

    // Summary should be hedged, not definitive
    expect(result.shallowReason).not.toContain('definitely');
    expect(result.shallowReason).not.toContain('certainly');
    expect(result.shallowReason).not.toContain('proven');

    // dataConfidence should be low
    expect(result.dataConfidence.level).toBe('low');
  });
});

// ============================================================================
// detectModuleErrorCode Tests
// ============================================================================

describe('detectModuleErrorCode', () => {
  it('should detect INVALID_URL', () => {
    expect(detectModuleErrorCode('invalid url format')).toBe('INVALID_URL');
    expect(detectModuleErrorCode('INVALID_URL: missing scheme')).toBe('INVALID_URL');
  });

  it('should detect URL_UNREACHABLE', () => {
    expect(detectModuleErrorCode('ENOTFOUND: could not resolve')).toBe('URL_UNREACHABLE');
    expect(detectModuleErrorCode('ECONNREFUSED at port 443')).toBe('URL_UNREACHABLE');
    expect(detectModuleErrorCode('Host unreachable')).toBe('URL_UNREACHABLE');
  });

  it('should detect URL_BLOCKED', () => {
    expect(detectModuleErrorCode('403 Forbidden')).toBe('URL_BLOCKED');
    expect(detectModuleErrorCode('Access blocked by robots.txt')).toBe('URL_BLOCKED');
  });

  it('should detect TIMEOUT', () => {
    expect(detectModuleErrorCode('Request timed out after 30s')).toBe('TIMEOUT');
    expect(detectModuleErrorCode('Timeout waiting for response')).toBe('TIMEOUT');
  });

  it('should detect CRAWL_FAILED', () => {
    expect(detectModuleErrorCode('Crawl failed: no pages found')).toBe('CRAWL_FAILED');
  });

  it('should return UNKNOWN for unrecognized errors', () => {
    expect(detectModuleErrorCode('Something weird happened')).toBe('UNKNOWN');
    expect(detectModuleErrorCode('')).toBe('UNKNOWN');
  });
});

// ============================================================================
// validateModuleResult Tests
// ============================================================================

describe('validateModuleResult', () => {
  it('should downgrade to completed_shallow if no evidence', () => {
    const result: ModuleResult = {
      module: 'seoLab',
      status: 'completed',
      startedAt: '2024-01-01T00:00:00.000Z',
      completedAt: '2024-01-01T00:01:00.000Z',
      inputUrl: 'example.com',
      normalizedUrl: 'https://example.com/',
      score: 50,
      summary: 'Test',
      dataConfidence: { score: 70, level: 'medium', reason: 'Test' },
      rawEvidence: {}, // Empty evidence
    };

    const validated = validateModuleResult(result);

    expect(validated.status).toBe('completed_shallow');
    expect(validated.shallowReason).toContain('Insufficient evidence');
    expect(validated.dataConfidence.level).toBe('low');
  });

  it('should keep completed status if evidence is sufficient', () => {
    const result: ModuleResult = {
      module: 'seoLab',
      status: 'completed',
      startedAt: '2024-01-01T00:00:00.000Z',
      completedAt: '2024-01-01T00:01:00.000Z',
      inputUrl: 'example.com',
      normalizedUrl: 'https://example.com/',
      score: 75,
      summary: 'Good SEO',
      dataConfidence: { score: 80, level: 'high', reason: 'Sufficient data' },
      rawEvidence: {
        subscores: [{ label: 'Technical', score: 80 }],
        issues: [{ id: '1', title: 'Test issue' }],
      },
    };

    const validated = validateModuleResult(result);

    expect(validated.status).toBe('completed');
  });

  it('should not modify failed results', () => {
    const result: ModuleResult = {
      module: 'seoLab',
      status: 'failed',
      startedAt: '2024-01-01T00:00:00.000Z',
      completedAt: '2024-01-01T00:01:00.000Z',
      inputUrl: 'example.com',
      normalizedUrl: null,
      score: null,
      summary: 'Failed',
      dataConfidence: { score: 0, level: 'low', reason: 'Failed' },
      error: { code: 'TIMEOUT', message: 'Timed out', retryable: true },
    };

    const validated = validateModuleResult(result);

    expect(validated.status).toBe('failed');
  });
});

// ============================================================================
// Type Guard Tests
// ============================================================================

describe('Type guards', () => {
  const failedResult = buildFailedModuleResult('seoLab', 'test.com', null, 'Error');
  const completedResult: ModuleResult = {
    module: 'seoLab',
    status: 'completed',
    startedAt: '2024-01-01T00:00:00.000Z',
    completedAt: '2024-01-01T00:01:00.000Z',
    inputUrl: 'test.com',
    normalizedUrl: 'https://test.com/',
    score: 80,
    summary: 'Good',
    dataConfidence: { score: 80, level: 'high', reason: 'Good data' },
    rawEvidence: { issues: [] },
  };
  const shallowResult = buildShallowModuleResult(
    'contentLab',
    'test.com',
    'https://test.com/',
    30,
    'Shallow',
    'No data',
    ['No blog'],
    {}
  );

  it('isCompletedResult should identify completed results', () => {
    expect(isCompletedResult(completedResult)).toBe(true);
    expect(isCompletedResult(failedResult)).toBe(false);
    expect(isCompletedResult(shallowResult)).toBe(false);
  });

  it('isShallowResult should identify shallow results', () => {
    expect(isShallowResult(shallowResult)).toBe(true);
    expect(isShallowResult(completedResult)).toBe(false);
    expect(isShallowResult(failedResult)).toBe(false);
  });

  it('isFailedResult should identify failed results', () => {
    expect(isFailedResult(failedResult)).toBe(true);
    expect(isFailedResult(completedResult)).toBe(false);
    expect(isFailedResult(shallowResult)).toBe(false);
  });

  it('hasUsableData should return true for completed and shallow', () => {
    expect(hasUsableData(completedResult)).toBe(true);
    expect(hasUsableData(shallowResult)).toBe(true);
    expect(hasUsableData(failedResult)).toBe(false);
  });
});

// ============================================================================
// hasMinimumEvidence Tests
// ============================================================================

describe('hasMinimumEvidence', () => {
  it('should detect missing data source', () => {
    const result: ModuleResult = {
      module: 'seoLab',
      status: 'completed',
      startedAt: '2024-01-01T00:00:00.000Z',
      completedAt: '2024-01-01T00:01:00.000Z',
      inputUrl: 'test.com',
      normalizedUrl: 'https://test.com/',
      score: 50,
      summary: 'Test',
      dataConfidence: { score: 50, level: 'medium', reason: 'Test' },
      rawEvidence: undefined,
    };

    const evidence = hasMinimumEvidence(result);

    expect(evidence.hasDataSource).toBe(false);
    expect(evidence.hasFindings).toBe(false);
    expect(evidence.hasValidScore).toBe(true);
  });

  it('should detect present findings', () => {
    const result: ModuleResult = {
      module: 'seoLab',
      status: 'completed',
      startedAt: '2024-01-01T00:00:00.000Z',
      completedAt: '2024-01-01T00:01:00.000Z',
      inputUrl: 'test.com',
      normalizedUrl: 'https://test.com/',
      score: 75,
      summary: 'Test',
      dataConfidence: { score: 70, level: 'medium', reason: 'Test' },
      rawEvidence: {
        issues: [{ id: '1', title: 'Issue 1' }],
        subscores: [{ label: 'Technical', score: 80 }],
      },
    };

    const evidence = hasMinimumEvidence(result);

    expect(evidence.hasDataSource).toBe(true);
    expect(evidence.hasFindings).toBe(true);
    expect(evidence.hasValidScore).toBe(true);
  });

  it('should detect invalid scores', () => {
    const result: ModuleResult = {
      module: 'seoLab',
      status: 'completed',
      startedAt: '2024-01-01T00:00:00.000Z',
      completedAt: '2024-01-01T00:01:00.000Z',
      inputUrl: 'test.com',
      normalizedUrl: 'https://test.com/',
      score: null,
      summary: 'Test',
      dataConfidence: { score: 50, level: 'medium', reason: 'Test' },
      rawEvidence: { issues: [] },
    };

    const evidence = hasMinimumEvidence(result);

    expect(evidence.hasValidScore).toBe(false);
  });
});
