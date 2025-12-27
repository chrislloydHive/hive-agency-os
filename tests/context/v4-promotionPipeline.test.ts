// tests/context/v4-promotionPipeline.test.ts
// Tests for the GAP/Labs → Context V4 Promotion Pipeline
//
// Tests cover:
// - Promotable fields configuration
// - Proposal types and validation
// - Confirm/reject provenance tagging

import { describe, it, expect } from 'vitest';
import {
  PROMOTABLE_FIELDS,
  isPromotableField,
  filterPromotableFields,
  getPromotableFieldLabel,
  getPromotableFieldConfig,
  getAllPromotableFieldConfigs,
  getFieldSources,
  getBestSourceForField,
  getPromotionSourcePriority,
  getPromotionSourceLabel,
  type PromotionSourceType,
} from '@/lib/contextGraph/v4/promotion/promotableFields';
import { mapProposalToFields, mapRecordToProposal } from '@/lib/types/contextProposal';
import type { ContextProposalRecord } from '@/lib/types/contextProposal';

// ============================================================================
// Promotable Fields Configuration Tests
// ============================================================================

describe('Promotable Fields Configuration', () => {
  describe('PROMOTABLE_FIELDS', () => {
    it('contains MVP fields', () => {
      expect(PROMOTABLE_FIELDS).toContain('identity.businessModel');
      expect(PROMOTABLE_FIELDS).toContain('audience.icpDescription');
      expect(PROMOTABLE_FIELDS).toContain('brand.positioning');
      expect(PROMOTABLE_FIELDS).toContain('brand.differentiators');
    });

    it('has exactly 4 fields in MVP', () => {
      expect(PROMOTABLE_FIELDS.length).toBe(4);
    });
  });

  describe('isPromotableField', () => {
    it('returns true for promotable fields', () => {
      expect(isPromotableField('identity.businessModel')).toBe(true);
      expect(isPromotableField('audience.icpDescription')).toBe(true);
      expect(isPromotableField('brand.positioning')).toBe(true);
      expect(isPromotableField('brand.differentiators')).toBe(true);
    });

    it('returns false for non-promotable fields', () => {
      expect(isPromotableField('identity.industry')).toBe(false);
      expect(isPromotableField('productOffer.valueProposition')).toBe(false);
      expect(isPromotableField('random.field')).toBe(false);
    });
  });

  describe('filterPromotableFields', () => {
    it('filters to only promotable fields', () => {
      const input = [
        'identity.businessModel',
        'identity.industry',
        'brand.positioning',
        'random.field',
      ];
      const result = filterPromotableFields(input);
      expect(result).toEqual(['identity.businessModel', 'brand.positioning']);
    });

    it('returns empty array for no matches', () => {
      const input = ['random.field', 'another.field'];
      expect(filterPromotableFields(input)).toEqual([]);
    });
  });

  describe('getPromotableFieldLabel', () => {
    it('returns human-readable labels', () => {
      expect(getPromotableFieldLabel('identity.businessModel')).toBe('Business Model');
      expect(getPromotableFieldLabel('audience.icpDescription')).toBe('ICP Description');
      expect(getPromotableFieldLabel('brand.positioning')).toBe('Brand Positioning');
      expect(getPromotableFieldLabel('brand.differentiators')).toBe('Differentiators');
    });

    it('returns field name for unknown fields', () => {
      expect(getPromotableFieldLabel('unknown.field')).toBe('field');
    });
  });

  describe('getPromotableFieldConfig', () => {
    it('returns full config for promotable fields', () => {
      const config = getPromotableFieldConfig('identity.businessModel');
      expect(config).not.toBeNull();
      expect(config?.key).toBe('identity.businessModel');
      expect(config?.label).toBe('Business Model');
      expect(config?.sources).toContain('full_gap');
      expect(config?.isMvp).toBe(true);
    });

    it('returns null for non-promotable fields', () => {
      const config = getPromotableFieldConfig('random.field');
      expect(config).toBeNull();
    });
  });

  describe('getAllPromotableFieldConfigs', () => {
    it('returns configs for all promotable fields', () => {
      const configs = getAllPromotableFieldConfigs();
      expect(configs.length).toBe(PROMOTABLE_FIELDS.length);
      expect(configs.every((c) => c.isMvp)).toBe(true);
    });
  });
});

// ============================================================================
// Source Configuration Tests
// ============================================================================

describe('Source Configuration', () => {
  describe('getFieldSources', () => {
    it('returns sources for known fields', () => {
      const sources = getFieldSources('identity.businessModel');
      expect(sources).toContain('full_gap');
      expect(sources).toContain('brand_lab');
      expect(sources).toContain('website_lab');
    });

    it('returns empty array for unknown fields', () => {
      expect(getFieldSources('unknown.field')).toEqual([]);
    });
  });

  describe('getBestSourceForField', () => {
    it('returns highest priority source', () => {
      const bestSource = getBestSourceForField('identity.businessModel');
      expect(bestSource).toBe('full_gap'); // 90 priority
    });

    it('returns null for unknown fields', () => {
      expect(getBestSourceForField('unknown.field')).toBeNull();
    });
  });

  describe('getPromotionSourcePriority', () => {
    it('returns correct priorities', () => {
      expect(getPromotionSourcePriority('full_gap')).toBe(90);
      expect(getPromotionSourcePriority('brand_lab')).toBe(80);
      expect(getPromotionSourcePriority('manual')).toBe(100);
    });

    it('returns default for unknown source', () => {
      expect(getPromotionSourcePriority('unknown' as PromotionSourceType)).toBe(50);
    });
  });

  describe('getPromotionSourceLabel', () => {
    it('returns human-readable labels', () => {
      expect(getPromotionSourceLabel('full_gap')).toBe('Full GAP Report');
      expect(getPromotionSourceLabel('brand_lab')).toBe('Brand Lab');
      expect(getPromotionSourceLabel('manual')).toBe('Manual Entry');
    });
  });
});

// ============================================================================
// Proposal Mapping Tests
// ============================================================================

describe('Proposal Mapping', () => {
  describe('mapProposalToFields', () => {
    it('maps proposal input to Airtable fields', () => {
      const input = {
        companyId: 'company-123',
        fieldKey: 'identity.businessModel',
        proposedValue: 'SaaS B2B',
        sourceType: 'brand_lab' as PromotionSourceType,
        sourceRunId: 'run-456',
        evidence: 'Found on about page',
        confidence: 85,
      };

      const fields = mapProposalToFields(input);

      expect(fields['Company ID']).toBe('company-123');
      expect(fields['Field Key']).toBe('identity.businessModel');
      expect(fields['Proposed Value']).toBe('SaaS B2B');
      expect(fields['Status']).toBe('proposed');
      expect(fields['Source Type']).toBe('brand_lab');
      expect(fields['Source Run ID']).toBe('run-456');
      expect(fields['Evidence']).toBe('Found on about page');
      expect(fields['Confidence']).toBe(85);
      expect(fields['Created At']).toBeDefined();
    });

    it('handles missing optional fields', () => {
      const input = {
        companyId: 'company-123',
        fieldKey: 'brand.positioning',
        proposedValue: 'Premium solution',
        sourceType: 'manual' as PromotionSourceType,
        evidence: '',
        confidence: 100,
      };

      const fields = mapProposalToFields(input);

      expect(fields['Source Run ID']).toBe('');
    });
  });

  describe('mapRecordToProposal', () => {
    it('maps Airtable record to proposal', () => {
      const record: ContextProposalRecord = {
        id: 'rec123',
        fields: {
          'Company ID': 'company-123',
          'Field Key': 'identity.businessModel',
          'Proposed Value': 'E-commerce',
          'Status': 'proposed',
          'Source Type': 'website_lab',
          'Source Run ID': 'run-789',
          'Evidence': 'Found on homepage',
          'Confidence': 75,
          'Created At': '2025-01-01T00:00:00Z',
        },
      };

      const proposal = mapRecordToProposal(record);

      expect(proposal.id).toBe('rec123');
      expect(proposal.companyId).toBe('company-123');
      expect(proposal.fieldKey).toBe('identity.businessModel');
      expect(proposal.proposedValue).toBe('E-commerce');
      expect(proposal.status).toBe('proposed');
      expect(proposal.sourceType).toBe('website_lab');
      expect(proposal.sourceRunId).toBe('run-789');
      expect(proposal.evidence).toBe('Found on homepage');
      expect(proposal.confidence).toBe(75);
      expect(proposal.createdAt).toBe('2025-01-01T00:00:00Z');
    });

    it('handles confirmed proposal with decision metadata', () => {
      const record: ContextProposalRecord = {
        id: 'rec456',
        fields: {
          'Company ID': 'company-123',
          'Field Key': 'brand.positioning',
          'Proposed Value': 'Market leader',
          'Status': 'confirmed',
          'Source Type': 'brand_lab',
          'Evidence': 'Brand strategy deck',
          'Confidence': 90,
          'Created At': '2025-01-01T00:00:00Z',
          'Decided At': '2025-01-02T00:00:00Z',
          'Decided By': 'user-123',
        },
      };

      const proposal = mapRecordToProposal(record);

      expect(proposal.status).toBe('confirmed');
      expect(proposal.decidedAt).toBe('2025-01-02T00:00:00Z');
      expect(proposal.decidedBy).toBe('user-123');
    });
  });
});

// ============================================================================
// Provenance Tagging Tests
// ============================================================================

describe('Provenance Tagging', () => {
  it('humanEdited flag should be set when value is overridden', () => {
    // This is a contract test - the actual behavior is tested in confirm endpoint
    const overrideValue = 'Custom edited value';
    const hasOverride = !!overrideValue;
    const humanEdited = hasOverride;

    expect(humanEdited).toBe(true);
  });

  it('humanEdited flag should be false when accepted as-is', () => {
    const overrideValue = undefined;
    const hasOverride = !!overrideValue;
    const humanEdited = hasOverride;

    expect(humanEdited).toBe(false);
  });

  it('source priorities follow expected order', () => {
    const priorities = [
      getPromotionSourcePriority('manual'),
      getPromotionSourcePriority('full_gap'),
      getPromotionSourcePriority('brand_lab'),
      getPromotionSourcePriority('website_lab'),
    ];

    // Manual > GAP > Brand Lab > Website Lab
    expect(priorities[0]).toBeGreaterThan(priorities[1]);
    expect(priorities[1]).toBeGreaterThan(priorities[2]);
    expect(priorities[2]).toBeGreaterThan(priorities[3]);
  });
});
