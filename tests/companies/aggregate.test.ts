// tests/companies/aggregate.test.ts
// Unit tests for company aggregation logic
//
// Tests health derivation, high intent detection, and duplicate detection

import { describe, it, expect } from 'vitest';
import {
  deriveHealthStatus,
  deriveHighIntent,
  hasNoBaseline,
  detectDuplicates,
} from '@/lib/os/companies/aggregate';
import { normalizeDomainForDedup } from '@/lib/os/companies/types';
import type { CompanyStage, GapRunType } from '@/lib/os/companies/types';

// ============================================================================
// Health Derivation Tests
// ============================================================================

describe('deriveHealthStatus', () => {
  describe('score-based health', () => {
    it('returns Good for score >= 75', () => {
      const result = deriveHealthStatus(80, 0, 'Client');
      expect(result.health).toBe('Good');
      expect(result.reasons[0]).toContain('Strong GAP score');
    });

    it('returns Good for score exactly 75', () => {
      const result = deriveHealthStatus(75, 0, 'Client');
      expect(result.health).toBe('Good');
    });

    it('returns Okay for score 55-74', () => {
      const result = deriveHealthStatus(60, 0, 'Client');
      expect(result.health).toBe('Okay');
      expect(result.reasons[0]).toContain('Moderate GAP score');
    });

    it('returns Okay for score exactly 55', () => {
      const result = deriveHealthStatus(55, 0, 'Client');
      expect(result.health).toBe('Okay');
    });

    it('returns AtRisk for score < 55', () => {
      const result = deriveHealthStatus(40, 0, 'Client');
      expect(result.health).toBe('AtRisk');
      expect(result.reasons[0]).toContain('Low GAP score');
    });

    it('returns AtRisk for score exactly 54', () => {
      const result = deriveHealthStatus(54, 0, 'Client');
      expect(result.health).toBe('AtRisk');
    });
  });

  describe('overdue work health', () => {
    it('returns AtRisk if no score but has overdue work', () => {
      const result = deriveHealthStatus(null, 3, 'Client');
      expect(result.health).toBe('AtRisk');
      expect(result.reasons[0]).toContain('overdue work');
    });

    it('prioritizes score over overdue work', () => {
      // High score should still be Good even with overdue work
      const result = deriveHealthStatus(80, 5, 'Client');
      expect(result.health).toBe('Good');
    });
  });

  describe('unknown health', () => {
    it('returns Unknown if no score and no overdue work', () => {
      const result = deriveHealthStatus(null, 0, 'Client');
      expect(result.health).toBe('Unknown');
      expect(result.reasons[0]).toContain('No GAP assessment');
    });
  });

  describe('stage-based health', () => {
    it('returns Unknown for Internal stage', () => {
      const result = deriveHealthStatus(80, 0, 'Internal');
      expect(result.health).toBe('Unknown');
      expect(result.reasons[0]).toContain('not tracked');
    });

    it('returns Unknown for Dormant stage', () => {
      const result = deriveHealthStatus(80, 0, 'Dormant');
      expect(result.health).toBe('Unknown');
    });

    it('returns Unknown for Lost stage', () => {
      const result = deriveHealthStatus(80, 0, 'Lost');
      expect(result.health).toBe('Unknown');
    });

    it('evaluates health for Prospect stage', () => {
      const result = deriveHealthStatus(70, 0, 'Prospect');
      expect(result.health).toBe('Okay');
    });
  });
});

// ============================================================================
// High Intent Tests
// ============================================================================

describe('deriveHighIntent', () => {
  const now = new Date();

  function daysAgo(days: number): string {
    const date = new Date(now);
    date.setDate(date.getDate() - days);
    return date.toISOString();
  }

  describe('Full GAP in last 7 days', () => {
    it('returns high intent for Full GAP run today', () => {
      const runs = [{ type: 'FULL' as GapRunType, score: 70, createdAt: daysAgo(0) }];
      const result = deriveHighIntent(runs);
      expect(result.isHighIntent).toBe(true);
      expect(result.reasons).toContain('Full GAP run');
    });

    it('returns high intent for Full GAP 7 days ago', () => {
      const runs = [{ type: 'FULL' as GapRunType, score: 70, createdAt: daysAgo(7) }];
      const result = deriveHighIntent(runs);
      expect(result.isHighIntent).toBe(true);
    });

    it('returns NOT high intent for Full GAP 8 days ago', () => {
      const runs = [{ type: 'FULL' as GapRunType, score: 70, createdAt: daysAgo(8) }];
      const result = deriveHighIntent(runs);
      expect(result.isHighIntent).toBe(false);
    });
  });

  describe('2+ runs in 14 days', () => {
    it('returns high intent for 2 runs in 14 days', () => {
      const runs = [
        { type: 'IA' as GapRunType, score: 70, createdAt: daysAgo(0) },
        { type: 'IA' as GapRunType, score: 65, createdAt: daysAgo(10) },
      ];
      const result = deriveHighIntent(runs);
      expect(result.isHighIntent).toBe(true);
      expect(result.reasons[0]).toContain('2 runs');
    });

    it('returns high intent for 3 runs in 14 days', () => {
      const runs = [
        { type: 'IA' as GapRunType, score: 70, createdAt: daysAgo(0) },
        { type: 'IA' as GapRunType, score: 65, createdAt: daysAgo(5) },
        { type: 'IA' as GapRunType, score: 60, createdAt: daysAgo(10) },
      ];
      const result = deriveHighIntent(runs);
      expect(result.isHighIntent).toBe(true);
      expect(result.reasons[0]).toContain('3 runs');
    });

    it('returns NOT high intent for 2 runs where one is > 14 days', () => {
      const runs = [
        { type: 'IA' as GapRunType, score: 70, createdAt: daysAgo(0) },
        { type: 'IA' as GapRunType, score: 65, createdAt: daysAgo(20) },
      ];
      const result = deriveHighIntent(runs);
      expect(result.isHighIntent).toBe(false);
    });
  });

  describe('low score with recent run', () => {
    it('returns high intent for score < 55 within 7 days', () => {
      const runs = [{ type: 'IA' as GapRunType, score: 40, createdAt: daysAgo(3) }];
      const result = deriveHighIntent(runs);
      expect(result.isHighIntent).toBe(true);
      expect(result.reasons[0]).toContain('Low score');
    });

    it('returns NOT high intent for score >= 55 within 7 days', () => {
      const runs = [{ type: 'IA' as GapRunType, score: 55, createdAt: daysAgo(3) }];
      const result = deriveHighIntent(runs);
      expect(result.isHighIntent).toBe(false);
    });

    it('returns NOT high intent for score < 55 but > 7 days old', () => {
      const runs = [{ type: 'IA' as GapRunType, score: 40, createdAt: daysAgo(10) }];
      const result = deriveHighIntent(runs);
      expect(result.isHighIntent).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('returns NOT high intent for empty runs', () => {
      const result = deriveHighIntent([]);
      expect(result.isHighIntent).toBe(false);
      expect(result.reasons).toHaveLength(0);
    });

    it('Full GAP takes priority over multiple runs', () => {
      const runs = [
        { type: 'FULL' as GapRunType, score: 70, createdAt: daysAgo(3) },
        { type: 'IA' as GapRunType, score: 65, createdAt: daysAgo(5) },
      ];
      const result = deriveHighIntent(runs);
      expect(result.isHighIntent).toBe(true);
      expect(result.reasons).toContain('Full GAP run');
    });
  });
});

// ============================================================================
// No Baseline Tests
// ============================================================================

describe('hasNoBaseline', () => {
  it('returns true when no GAP runs and no diagnostics', () => {
    expect(hasNoBaseline(0, false)).toBe(true);
  });

  it('returns false when has GAP runs', () => {
    expect(hasNoBaseline(1, false)).toBe(false);
  });

  it('returns false when has diagnostics', () => {
    expect(hasNoBaseline(0, true)).toBe(false);
  });

  it('returns false when has both GAP runs and diagnostics', () => {
    expect(hasNoBaseline(2, true)).toBe(false);
  });
});

// ============================================================================
// Duplicate Detection Tests
// ============================================================================

describe('normalizeDomainForDedup', () => {
  it('removes https protocol', () => {
    expect(normalizeDomainForDedup('https://example.com')).toBe('example.com');
  });

  it('removes http protocol', () => {
    expect(normalizeDomainForDedup('http://example.com')).toBe('example.com');
  });

  it('removes www prefix', () => {
    expect(normalizeDomainForDedup('www.example.com')).toBe('example.com');
  });

  it('removes https and www together', () => {
    expect(normalizeDomainForDedup('https://www.example.com')).toBe('example.com');
  });

  it('removes trailing paths', () => {
    expect(normalizeDomainForDedup('example.com/page/subpage')).toBe('example.com');
  });

  it('removes port numbers', () => {
    expect(normalizeDomainForDedup('example.com:8080')).toBe('example.com');
  });

  it('lowercases domain', () => {
    expect(normalizeDomainForDedup('EXAMPLE.COM')).toBe('example.com');
  });

  it('handles complex URLs', () => {
    expect(normalizeDomainForDedup('https://www.EXAMPLE.COM:443/path?query=1')).toBe(
      'example.com'
    );
  });

  it('returns null for null input', () => {
    expect(normalizeDomainForDedup(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(normalizeDomainForDedup(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(normalizeDomainForDedup('')).toBeNull();
  });

  it('returns null for invalid domain (no dot)', () => {
    expect(normalizeDomainForDedup('localhost')).toBeNull();
  });
});

describe('detectDuplicates', () => {
  it('detects duplicate companies by normalized domain', () => {
    const companies = [
      { id: '1', domain: 'https://www.example.com' },
      { id: '2', domain: 'example.com' },
      { id: '3', domain: 'http://EXAMPLE.COM/path' },
      { id: '4', domain: 'different.com' },
    ];

    const duplicates = detectDuplicates(companies);

    expect(duplicates.size).toBe(1);
    expect(duplicates.has('example.com')).toBe(true);
    expect(duplicates.get('example.com')).toEqual(['1', '2', '3']);
  });

  it('returns empty map when no duplicates', () => {
    const companies = [
      { id: '1', domain: 'example1.com' },
      { id: '2', domain: 'example2.com' },
      { id: '3', domain: 'example3.com' },
    ];

    const duplicates = detectDuplicates(companies);

    expect(duplicates.size).toBe(0);
  });

  it('handles null domains', () => {
    const companies = [
      { id: '1', domain: null },
      { id: '2', domain: 'example.com' },
      { id: '3', domain: null },
    ];

    const duplicates = detectDuplicates(companies);

    expect(duplicates.size).toBe(0);
  });

  it('handles multiple duplicate groups', () => {
    const companies = [
      { id: '1', domain: 'example.com' },
      { id: '2', domain: 'www.example.com' },
      { id: '3', domain: 'test.com' },
      { id: '4', domain: 'https://test.com' },
    ];

    const duplicates = detectDuplicates(companies);

    expect(duplicates.size).toBe(2);
    expect(duplicates.get('example.com')).toEqual(['1', '2']);
    expect(duplicates.get('test.com')).toEqual(['3', '4']);
  });

  it('handles empty array', () => {
    const duplicates = detectDuplicates([]);
    expect(duplicates.size).toBe(0);
  });
});
