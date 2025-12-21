// tests/airtable/selectCoercion.test.ts
// Unit tests for Client Insights single-select coercion helpers
//
// These helpers prevent Airtable 422 errors by mapping AI outputs to exact allowlist values.

import { describe, it, expect } from 'vitest';
import {
  coerceInsightCategory,
  coerceInsightSeverity,
  coerceInsightSourceType,
} from '@/lib/airtable/selectCoercion';

// ============================================================================
// Category Coercion
// ============================================================================

describe('coerceInsightCategory', () => {
  describe('direct matches', () => {
    it('should pass through valid categories unchanged', () => {
      expect(coerceInsightCategory('brand')).toBe('brand');
      expect(coerceInsightCategory('content')).toBe('content');
      expect(coerceInsightCategory('seo')).toBe('seo');
      expect(coerceInsightCategory('website')).toBe('website');
      expect(coerceInsightCategory('analytics')).toBe('analytics');
      expect(coerceInsightCategory('demand')).toBe('demand');
      expect(coerceInsightCategory('ops')).toBe('ops');
      expect(coerceInsightCategory('competitive')).toBe('competitive');
      expect(coerceInsightCategory('structural')).toBe('structural');
      expect(coerceInsightCategory('product')).toBe('product');
      expect(coerceInsightCategory('other')).toBe('other');
    });

    it('should normalize case', () => {
      expect(coerceInsightCategory('BRAND')).toBe('brand');
      expect(coerceInsightCategory('Brand')).toBe('brand');
      expect(coerceInsightCategory('SEO')).toBe('seo');
    });

    it('should trim whitespace', () => {
      expect(coerceInsightCategory('  brand  ')).toBe('brand');
      expect(coerceInsightCategory('\tcontent\n')).toBe('content');
    });
  });

  describe('audience mapping (key requirement)', () => {
    it('should map "audience" to "brand" (no audience option in Airtable)', () => {
      expect(coerceInsightCategory('audience')).toBe('brand');
    });

    it('should map audience variants to brand', () => {
      expect(coerceInsightCategory('audiencefit')).toBe('brand');
      expect(coerceInsightCategory('audience_fit')).toBe('brand');
      expect(coerceInsightCategory('icp')).toBe('brand');
      expect(coerceInsightCategory('targeting')).toBe('brand');
      expect(coerceInsightCategory('persona')).toBe('brand');
    });
  });

  describe('brand synonyms', () => {
    it('should map "Messaging" → "brand"', () => {
      expect(coerceInsightCategory('Messaging')).toBe('brand');
      expect(coerceInsightCategory('messaging')).toBe('brand');
    });

    it('should map positioning → brand', () => {
      expect(coerceInsightCategory('positioning')).toBe('brand');
    });

    it('should map trust → brand', () => {
      expect(coerceInsightCategory('trust')).toBe('brand');
    });

    it('should map visual/identity → brand', () => {
      expect(coerceInsightCategory('visual')).toBe('brand');
      expect(coerceInsightCategory('identity')).toBe('brand');
    });
  });

  describe('competitive synonyms', () => {
    it('should map competition → competitive', () => {
      expect(coerceInsightCategory('competition')).toBe('competitive');
      expect(coerceInsightCategory('competitors')).toBe('competitive');
      expect(coerceInsightCategory('competitor')).toBe('competitive');
    });
  });

  describe('demand synonyms', () => {
    it('should map conversion/funnel → demand', () => {
      expect(coerceInsightCategory('conversion')).toBe('demand');
      expect(coerceInsightCategory('funnel')).toBe('demand');
    });

    it('should map media/paid → demand', () => {
      expect(coerceInsightCategory('media')).toBe('demand');
      expect(coerceInsightCategory('paid_search')).toBe('demand');
    });
  });

  describe('unknown values', () => {
    it('should return "other" for unknown categories', () => {
      expect(coerceInsightCategory('unknown')).toBe('other');
      expect(coerceInsightCategory('random')).toBe('other');
      expect(coerceInsightCategory('xyz123')).toBe('other');
    });

    it('should return "other" for empty/null/undefined', () => {
      expect(coerceInsightCategory('')).toBe('other');
      expect(coerceInsightCategory(null)).toBe('other');
      expect(coerceInsightCategory(undefined)).toBe('other');
    });
  });
});

// ============================================================================
// Severity Coercion
// ============================================================================

describe('coerceInsightSeverity', () => {
  describe('direct matches', () => {
    it('should pass through valid severities unchanged', () => {
      expect(coerceInsightSeverity('low')).toBe('low');
      expect(coerceInsightSeverity('medium')).toBe('medium');
      expect(coerceInsightSeverity('high')).toBe('high');
      expect(coerceInsightSeverity('critical')).toBe('critical');
    });

    it('should normalize case', () => {
      expect(coerceInsightSeverity('LOW')).toBe('low');
      expect(coerceInsightSeverity('High')).toBe('high');
    });
  });

  describe('synonyms', () => {
    it('should map "moderate" → "medium"', () => {
      expect(coerceInsightSeverity('moderate')).toBe('medium');
    });

    it('should map minor → low', () => {
      expect(coerceInsightSeverity('minor')).toBe('low');
      expect(coerceInsightSeverity('minimal')).toBe('low');
    });

    it('should map major → high', () => {
      expect(coerceInsightSeverity('major')).toBe('high');
      expect(coerceInsightSeverity('significant')).toBe('high');
    });

    it('should map urgent → critical', () => {
      expect(coerceInsightSeverity('urgent')).toBe('critical');
      expect(coerceInsightSeverity('blocker')).toBe('critical');
    });
  });

  describe('unknown values', () => {
    it('should default to "medium" for unknown severities', () => {
      expect(coerceInsightSeverity('unknown')).toBe('medium');
      expect(coerceInsightSeverity('xyz')).toBe('medium');
    });

    it('should default to "medium" for empty/null/undefined', () => {
      expect(coerceInsightSeverity('')).toBe('medium');
      expect(coerceInsightSeverity(null)).toBe('medium');
      expect(coerceInsightSeverity(undefined)).toBe('medium');
    });
  });
});

// ============================================================================
// Source Type Coercion
// ============================================================================

describe('coerceInsightSourceType', () => {
  describe('direct matches', () => {
    it('should pass through valid source types unchanged', () => {
      expect(coerceInsightSourceType('tool_run')).toBe('tool_run');
      expect(coerceInsightSourceType('document')).toBe('document');
      expect(coerceInsightSourceType('manual')).toBe('manual');
    });
  });

  describe('synonyms', () => {
    it('should map "lab" → "tool_run"', () => {
      expect(coerceInsightSourceType('lab')).toBe('tool_run');
    });

    it('should map diagnostic/gap/run → tool_run', () => {
      expect(coerceInsightSourceType('diagnostic')).toBe('tool_run');
      expect(coerceInsightSourceType('gap')).toBe('tool_run');
      expect(coerceInsightSourceType('run')).toBe('tool_run');
    });

    it('should map brandlab/websitelab → tool_run', () => {
      expect(coerceInsightSourceType('brandlab')).toBe('tool_run');
      expect(coerceInsightSourceType('websitelab')).toBe('tool_run');
    });

    it('should map doc → document', () => {
      expect(coerceInsightSourceType('doc')).toBe('document');
      expect(coerceInsightSourceType('file')).toBe('document');
    });

    it('should map human → manual', () => {
      expect(coerceInsightSourceType('human')).toBe('manual');
      expect(coerceInsightSourceType('user')).toBe('manual');
    });
  });

  describe('unknown values', () => {
    it('should default to "tool_run" for unknown source types', () => {
      expect(coerceInsightSourceType('unknown')).toBe('tool_run');
      expect(coerceInsightSourceType('xyz')).toBe('tool_run');
    });

    it('should default to "tool_run" for empty/null/undefined', () => {
      expect(coerceInsightSourceType('')).toBe('tool_run');
      expect(coerceInsightSourceType(null)).toBe('tool_run');
      expect(coerceInsightSourceType(undefined)).toBe('tool_run');
    });
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle hyphenated values', () => {
    expect(coerceInsightCategory('paid-search')).toBe('demand');
    expect(coerceInsightCategory('audience-fit')).toBe('brand');
  });

  it('should handle space-separated values', () => {
    expect(coerceInsightCategory('paid search')).toBe('demand');
  });

  it('should handle non-string inputs gracefully', () => {
    expect(coerceInsightCategory(123 as unknown as string)).toBe('other');
    expect(coerceInsightCategory({} as unknown as string)).toBe('other');
    expect(coerceInsightCategory([] as unknown as string)).toBe('other');
  });
});
