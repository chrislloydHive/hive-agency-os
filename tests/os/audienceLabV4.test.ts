// tests/os/audienceLabV4.test.ts
// Tests for Audience Lab V4 hardening: score parsing, segments, Context V4 integration

import { describe, it, expect } from 'vitest';
import { resolveAudienceScore, audienceLabNormalizedSchema } from '@/lib/os/diagnostics/audience/schema';

describe('Audience Lab Score Resolution', () => {
  it('uses model score when valid (0-100)', () => {
    expect(resolveAudienceScore(65, [])).toBe(65);
    expect(resolveAudienceScore(0, [])).toBe(0);
    expect(resolveAudienceScore(100, [])).toBe(100);
    expect(resolveAudienceScore(42.7, [])).toBe(42.7);
  });

  it('clamps model score to 0-100 range', () => {
    expect(resolveAudienceScore(150, [])).toBe(100);
    expect(resolveAudienceScore(-20, [])).toBe(0);
  });

  it('returns deterministic fallback when model score is invalid', () => {
    // Base fallback is 75, minus 3 per issue (max 15 reduction), minimum 50
    expect(resolveAudienceScore(undefined, [])).toBe(75);
    expect(resolveAudienceScore(null, [])).toBe(75);
    expect(resolveAudienceScore('invalid', [])).toBe(75);
    expect(resolveAudienceScore(NaN, [])).toBe(75);
  });

  it('reduces fallback score based on issues', () => {
    const issues = ['Issue 1', 'Issue 2', 'Issue 3'];
    expect(resolveAudienceScore(undefined, issues)).toBe(66); // 75 - 9 = 66
  });

  it('caps issue reduction at 15 points', () => {
    const manyIssues = Array(10).fill('Issue');
    expect(resolveAudienceScore(undefined, manyIssues)).toBe(60); // 75 - 15 = 60
  });

  it('never goes below 50', () => {
    const manyIssues = Array(20).fill('Issue');
    expect(resolveAudienceScore(undefined, manyIssues)).toBe(60); // Still 60 due to max cap
  });

  it('never defaults to 100', () => {
    // This is the CRITICAL test - we must never default to 100
    expect(resolveAudienceScore(undefined, [])).not.toBe(100);
    expect(resolveAudienceScore(null, [])).not.toBe(100);
    expect(resolveAudienceScore('', [])).not.toBe(100);
  });
});

describe('Audience Lab Schema', () => {
  it('defines audienceSegments array in schema', () => {
    // Verify audienceSegments is part of the schema
    expect(audienceLabNormalizedSchema.shape).toHaveProperty('audienceSegments');
  });

  it('schema has required audience fields', () => {
    // Verify key audience fields exist
    expect(audienceLabNormalizedSchema.shape).toHaveProperty('audience');
    expect(audienceLabNormalizedSchema.shape).toHaveProperty('signals');
    expect(audienceLabNormalizedSchema.shape).toHaveProperty('score');
    expect(audienceLabNormalizedSchema.shape).toHaveProperty('issues');
    expect(audienceLabNormalizedSchema.shape).toHaveProperty('recommendations');
  });
});
