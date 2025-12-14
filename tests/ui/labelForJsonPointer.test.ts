// tests/ui/labelForJsonPointer.test.ts
// Tests for JSON Pointer → Friendly Label mapping

import { describe, it, expect } from 'vitest';
import {
  labelForJsonPointer,
  labelForPointer,
  parseJsonPointer,
  getDomainFromPointer,
  getFieldFromPointer,
  toTitleCase,
  getDomainLabel,
  groupByDomain,
} from '@/lib/contextGraph/paths/labelForJsonPointer';

describe('labelForJsonPointer', () => {
  describe('parseJsonPointer', () => {
    it('parses empty pointer', () => {
      expect(parseJsonPointer('')).toEqual([]);
      expect(parseJsonPointer('/')).toEqual([]);
    });

    it('parses single segment', () => {
      expect(parseJsonPointer('/identity')).toEqual(['identity']);
    });

    it('parses multiple segments', () => {
      expect(parseJsonPointer('/identity/businessModel/value')).toEqual([
        'identity',
        'businessModel',
        'value',
      ]);
    });

    it('handles array indices', () => {
      expect(parseJsonPointer('/strategyPillars/0/decision')).toEqual([
        'strategyPillars',
        '0',
        'decision',
      ]);
    });
  });

  describe('getDomainFromPointer', () => {
    it('extracts domain from pointer', () => {
      expect(getDomainFromPointer('/identity/businessModel/value')).toBe('identity');
      expect(getDomainFromPointer('/audience/coreSegments')).toBe('audience');
      expect(getDomainFromPointer('/brand')).toBe('brand');
    });

    it('returns null for empty pointer', () => {
      expect(getDomainFromPointer('')).toBe(null);
      expect(getDomainFromPointer('/')).toBe(null);
    });
  });

  describe('getFieldFromPointer', () => {
    it('extracts field from pointer', () => {
      expect(getFieldFromPointer('/identity/businessModel/value')).toBe('businessModel');
      expect(getFieldFromPointer('/audience/coreSegments')).toBe('coreSegments');
    });

    it('skips metadata segments', () => {
      expect(getFieldFromPointer('/identity/businessModel/provenance')).toBe('businessModel');
      expect(getFieldFromPointer('/brand/positioning/updatedAt')).toBe('positioning');
    });

    it('handles array indices', () => {
      expect(getFieldFromPointer('/strategyPillars/0/decision')).toBe('decision');
    });

    it('returns null for domain-only pointer', () => {
      expect(getFieldFromPointer('/identity')).toBe(null);
    });
  });

  describe('toTitleCase', () => {
    it('converts camelCase to title case', () => {
      expect(toTitleCase('businessModel')).toBe('Business Model');
      expect(toTitleCase('primaryAudience')).toBe('Primary Audience');
      expect(toTitleCase('icpDescription')).toBe('Icp Description');
    });

    it('converts snake_case to title case', () => {
      expect(toTitleCase('business_model')).toBe('Business Model');
      expect(toTitleCase('primary_audience')).toBe('Primary Audience');
    });

    it('handles single words', () => {
      expect(toTitleCase('industry')).toBe('Industry');
      expect(toTitleCase('brand')).toBe('Brand');
    });
  });

  describe('getDomainLabel', () => {
    it('returns predefined labels for known domains', () => {
      expect(getDomainLabel('identity')).toBe('Identity');
      expect(getDomainLabel('audience')).toBe('Audience');
      expect(getDomainLabel('brand')).toBe('Brand');
      expect(getDomainLabel('productOffer')).toBe('Product/Offer');
      expect(getDomainLabel('operationalConstraints')).toBe('Operational Constraints');
    });

    it('falls back to title case for unknown domains', () => {
      expect(getDomainLabel('unknownDomain')).toBe('Unknown Domain');
      expect(getDomainLabel('customField')).toBe('Custom Field');
    });
  });

  describe('labelForJsonPointer - common pointers', () => {
    // Test at least 10 common pointers as required
    const testCases: Array<{ pointer: string; expectedFull: string; expectedField: string }> = [
      {
        pointer: '/identity/businessModel/value',
        expectedFull: 'Identity → Business Model',
        expectedField: 'Business Model',
      },
      {
        pointer: '/identity/industry',
        expectedFull: 'Identity → Industry',
        expectedField: 'Industry',
      },
      {
        pointer: '/audience/primaryAudience/value',
        expectedFull: 'Audience → Primary Audience',
        expectedField: 'Primary Audience',
      },
      {
        pointer: '/audience/coreSegments',
        expectedFull: 'Audience → Core Segments',
        expectedField: 'Core Segments',
      },
      {
        pointer: '/brand/positioning/value',
        expectedFull: 'Brand → Brand Positioning',
        expectedField: 'Brand Positioning',
      },
      {
        pointer: '/brand/valueProps',
        expectedFull: 'Brand → Value Propositions',
        expectedField: 'Value Propositions',
      },
      {
        pointer: '/objectives/primaryObjective/value',
        expectedFull: 'Objectives → Primary Objective',
        expectedField: 'Primary Objective',
      },
      {
        pointer: '/productOffer/primaryProducts',
        expectedFull: 'Product/Offer → Primary Products',
        expectedField: 'Primary Products',
      },
      {
        pointer: '/competitive/competitors',
        expectedFull: 'Competitive → Competitors',
        expectedField: 'Competitors',
      },
      {
        pointer: '/website/websiteScore/value',
        expectedFull: 'Website → Website Score',
        expectedField: 'Website Score',
      },
      {
        pointer: '/creative/messaging',
        expectedFull: 'Creative → Messaging Architecture',
        expectedField: 'Messaging Architecture',
      },
      {
        pointer: '/operationalConstraints/maxBudget/value',
        expectedFull: 'Operational Constraints → Max Budget',
        expectedField: 'Max Budget',
      },
    ];

    testCases.forEach(({ pointer, expectedFull, expectedField }) => {
      it(`converts "${pointer}" to "${expectedFull}"`, () => {
        const result = labelForJsonPointer(pointer);
        expect(result.fullLabel).toBe(expectedFull);
        expect(result.fieldLabel).toBe(expectedField);
      });
    });
  });

  describe('labelForJsonPointer - edge cases', () => {
    it('handles root pointer', () => {
      const result = labelForJsonPointer('');
      expect(result.fullLabel).toBe('Root');
      expect(result.domain).toBe('');
    });

    it('handles domain-only pointer', () => {
      const result = labelForJsonPointer('/identity');
      expect(result.fullLabel).toBe('Identity');
      expect(result.domainLabel).toBe('Identity');
      expect(result.fieldLabel).toBe('');
    });

    it('handles array index pointers', () => {
      const result = labelForJsonPointer('/strategyPillars/0/decision');
      expect(result.fullLabel).toBe('Strategy Pillars → Decision');
      expect(result.domain).toBe('strategyPillars');
    });

    it('indicates when field is from registry', () => {
      // Known field from registry
      const known = labelForJsonPointer('/identity/businessModel');
      expect(known.fromRegistry).toBe(true);

      // Unknown field
      const unknown = labelForJsonPointer('/unknownDomain/unknownField');
      expect(unknown.fromRegistry).toBe(false);
    });
  });

  describe('labelForPointer (convenience)', () => {
    it('returns just the full label string', () => {
      expect(labelForPointer('/identity/businessModel/value')).toBe(
        'Identity → Business Model'
      );
    });
  });

  describe('groupByDomain', () => {
    it('groups items by domain', () => {
      const items = [
        { path: '/identity/businessModel', value: 'SaaS' },
        { path: '/identity/industry', value: 'Tech' },
        { path: '/audience/primaryAudience', value: 'SMBs' },
        { path: '/brand/positioning', value: 'Premium' },
      ];

      const grouped = groupByDomain(items);

      expect(grouped.size).toBe(3);
      expect(grouped.get('identity')?.items.length).toBe(2);
      expect(grouped.get('audience')?.items.length).toBe(1);
      expect(grouped.get('brand')?.items.length).toBe(1);

      expect(grouped.get('identity')?.label).toBe('Identity');
      expect(grouped.get('audience')?.label).toBe('Audience');
    });

    it('handles empty array', () => {
      const grouped = groupByDomain([]);
      expect(grouped.size).toBe(0);
    });
  });
});
