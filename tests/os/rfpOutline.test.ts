// tests/os/rfpOutline.test.ts
// Tests for RFP outline generation from parsed requirements

import { describe, test, expect } from 'vitest';
import {
  generateOutlineFromRequirements,
  getSectionLabel,
  isStandardSectionKey,
  outlineToSectionData,
  getOutlineSummary,
  type GeneratedOutline,
} from '@/lib/os/rfp/generateOutline';
import type { ParsedRfpRequirements } from '@/lib/types/rfp';
import { RFP_SECTION_ORDER, RFP_SECTION_LABELS } from '@/lib/types/rfp';

describe('rfpOutline', () => {
  // Helper to create minimal requirements
  const createRequirements = (
    sections: Array<{ title: string; description?: string; pageLimit?: number }>
  ): ParsedRfpRequirements => ({
    deadline: null,
    submissionInstructions: [],
    complianceChecklist: [],
    evaluationCriteria: [],
    requiredResponseSections: sections,
    mustAnswerQuestions: [],
    wordLimit: null,
    pageLimit: null,
    parseConfidence: 'medium',
  });

  describe('generateOutlineFromRequirements', () => {
    test('maps standard section titles correctly', () => {
      const requirements = createRequirements([
        { title: 'Company Overview' },
        { title: 'Technical Approach' },
        { title: 'Project Team' },
      ]);

      const outline = generateOutlineFromRequirements(requirements);

      // Should map to standard keys
      const mappedKeys = outline.sections
        .filter((s) => s.isStandard && s.isRequired)
        .map((s) => s.sectionKey);

      expect(mappedKeys).toContain('agency_overview');
      expect(mappedKeys).toContain('approach');
      expect(mappedKeys).toContain('team');
    });

    test('creates custom sections for unmapped titles', () => {
      // Use titles that don't contain any standard section keywords
      // (avoid: plan, approach, team, pricing, references, work, case, etc.)
      const requirements = createRequirements([
        { title: 'Sustainability Commitments' },
        { title: 'Diversity and Inclusion Statement' },
      ]);

      const outline = generateOutlineFromRequirements(requirements);

      expect(outline.customSections).toHaveLength(2);
      expect(outline.customSections[0].sectionKey).toBeNull();
      expect(outline.customSections[0].customKey).toBe('sustainability_commitments');
      expect(outline.customSections[0].title).toBe('Sustainability Commitments');
    });

    test('preserves page/word limits from requirements', () => {
      const requirements = createRequirements([
        { title: 'Approach', pageLimit: 5, description: 'Describe approach' },
      ]);

      const outline = generateOutlineFromRequirements(requirements);
      const approachSection = outline.sections.find((s) => s.sectionKey === 'approach');

      expect(approachSection?.pageLimit).toBe(5);
      expect(approachSection?.description).toBe('Describe approach');
    });

    test('includes uncovered standard sections when includeStandardSections=true', () => {
      const requirements = createRequirements([
        { title: 'Pricing' },
      ]);

      const outline = generateOutlineFromRequirements(requirements, true);

      // Should have pricing from requirements + all other standard sections
      expect(outline.uncoveredStandardSections).toContain('agency_overview');
      expect(outline.uncoveredStandardSections).toContain('approach');
      expect(outline.uncoveredStandardSections).toContain('team');
      expect(outline.uncoveredStandardSections).not.toContain('pricing');
    });

    test('excludes uncovered sections when includeStandardSections=false', () => {
      const requirements = createRequirements([
        { title: 'Pricing' },
      ]);

      const outline = generateOutlineFromRequirements(requirements, false);

      expect(outline.sections).toHaveLength(1);
      expect(outline.sections[0].sectionKey).toBe('pricing');
    });

    test('handles empty requirements', () => {
      const requirements = createRequirements([]);

      const outline = generateOutlineFromRequirements(requirements, true);

      // Should have all standard sections as uncovered
      expect(outline.sections.length).toBe(RFP_SECTION_ORDER.length);
      expect(outline.uncoveredStandardSections.length).toBe(RFP_SECTION_ORDER.length);
      expect(outline.mappingConfidence).toBe('medium'); // No requirements = medium confidence
    });

    test('handles duplicate section mappings', () => {
      const requirements = createRequirements([
        { title: 'Company Overview' },
        { title: 'About Our Agency' }, // Also maps to agency_overview
      ]);

      const outline = generateOutlineFromRequirements(requirements);

      // Should only include agency_overview once
      const agencyOverviewSections = outline.sections.filter(
        (s) => s.sectionKey === 'agency_overview'
      );
      expect(agencyOverviewSections).toHaveLength(1);
    });

    test('maintains order based on input requirements', () => {
      const requirements = createRequirements([
        { title: 'Team' },
        { title: 'Approach' },
        { title: 'Pricing' },
      ]);

      const outline = generateOutlineFromRequirements(requirements, false);

      expect(outline.sections[0].sectionKey).toBe('team');
      expect(outline.sections[1].sectionKey).toBe('approach');
      expect(outline.sections[2].sectionKey).toBe('pricing');
      expect(outline.sections[0].order).toBe(0);
      expect(outline.sections[1].order).toBe(1);
      expect(outline.sections[2].order).toBe(2);
    });

    test('calculates high confidence when most sections map', () => {
      const requirements = createRequirements([
        { title: 'Agency Overview' },
        { title: 'Approach' },
        { title: 'Team' },
        { title: 'Work Samples' },
        { title: 'Timeline' },
      ]);

      const outline = generateOutlineFromRequirements(requirements);

      expect(outline.mappingConfidence).toBe('high'); // 5/5 = 100% mapped
    });

    test('calculates low confidence when few sections map', () => {
      const requirements = createRequirements([
        { title: 'Custom Section A' },
        { title: 'Custom Section B' },
        { title: 'Custom Section C' },
        { title: 'Approach' }, // Only one maps
      ]);

      const outline = generateOutlineFromRequirements(requirements);

      expect(outline.mappingConfidence).toBe('low'); // 1/4 = 25% mapped
    });
  });

  describe('section keyword matching', () => {
    test('matches agency_overview variations', () => {
      const variations = [
        'Company Overview',
        'Agency Overview',
        'About the Agency',
        'Firm Profile',
        'Organization Overview',
      ];

      for (const title of variations) {
        const requirements = createRequirements([{ title }]);
        const outline = generateOutlineFromRequirements(requirements, false);
        expect(outline.sections[0].sectionKey).toBe('agency_overview');
      }
    });

    test('matches approach variations', () => {
      const variations = [
        'Approach',
        'Methodology',
        'Proposed Solution',
        'Technical Approach',
        'Strategic Approach',
      ];

      for (const title of variations) {
        const requirements = createRequirements([{ title }]);
        const outline = generateOutlineFromRequirements(requirements, false);
        expect(outline.sections[0].sectionKey).toBe('approach');
      }
    });

    test('matches work_samples variations', () => {
      const variations = [
        'Work Samples',
        'Case Studies',
        'Portfolio',
        'Past Performance',
        'Relevant Experience',
      ];

      for (const title of variations) {
        const requirements = createRequirements([{ title }]);
        const outline = generateOutlineFromRequirements(requirements, false);
        expect(outline.sections[0].sectionKey).toBe('work_samples');
      }
    });

    test('matches pricing variations', () => {
      const variations = [
        'Pricing',
        'Cost Proposal',
        'Budget',
        'Fees',
        'Investment',
        'Rate Card',
      ];

      for (const title of variations) {
        const requirements = createRequirements([{ title }]);
        const outline = generateOutlineFromRequirements(requirements, false);
        expect(outline.sections[0].sectionKey).toBe('pricing');
      }
    });

    test('case insensitive matching', () => {
      const requirements = createRequirements([
        { title: 'COMPANY OVERVIEW' },
        { title: 'technical APPROACH' },
        { title: 'PrIcInG' },
      ]);

      const outline = generateOutlineFromRequirements(requirements, false);

      expect(outline.sections[0].sectionKey).toBe('agency_overview');
      expect(outline.sections[1].sectionKey).toBe('approach');
      expect(outline.sections[2].sectionKey).toBe('pricing');
    });
  });

  describe('getSectionLabel', () => {
    test('returns correct labels for standard keys', () => {
      expect(getSectionLabel('agency_overview')).toBe(RFP_SECTION_LABELS.agency_overview);
      expect(getSectionLabel('approach')).toBe(RFP_SECTION_LABELS.approach);
      expect(getSectionLabel('team')).toBe(RFP_SECTION_LABELS.team);
      expect(getSectionLabel('pricing')).toBe(RFP_SECTION_LABELS.pricing);
    });
  });

  describe('isStandardSectionKey', () => {
    test('returns true for standard keys', () => {
      for (const key of RFP_SECTION_ORDER) {
        expect(isStandardSectionKey(key)).toBe(true);
      }
    });

    test('returns false for non-standard keys', () => {
      expect(isStandardSectionKey('custom_section')).toBe(false);
      expect(isStandardSectionKey('')).toBe(false);
      expect(isStandardSectionKey('environmental_plan')).toBe(false);
    });
  });

  describe('outlineToSectionData', () => {
    test('converts standard sections to section data', () => {
      const requirements = createRequirements([
        { title: 'Approach' },
        { title: 'Team' },
      ]);

      const outline = generateOutlineFromRequirements(requirements, false);
      const sectionData = outlineToSectionData(outline, 'rfp-123');

      expect(sectionData).toHaveLength(2);
      expect(sectionData[0].rfpId).toBe('rfp-123');
      expect(sectionData[0].sectionKey).toBe('approach');
      expect(sectionData[0].status).toBe('empty');
    });

    test('excludes custom sections from section data', () => {
      const requirements = createRequirements([
        { title: 'Approach' },
        { title: 'Custom Environmental Section' },
      ]);

      const outline = generateOutlineFromRequirements(requirements, false);
      const sectionData = outlineToSectionData(outline, 'rfp-123');

      // Only approach should be included, not the custom section
      expect(sectionData).toHaveLength(1);
      expect(sectionData[0].sectionKey).toBe('approach');
    });
  });

  describe('getOutlineSummary', () => {
    test('summarizes outline correctly', () => {
      const requirements = createRequirements([
        { title: 'Approach' },
        { title: 'Team' },
        { title: 'Custom Section' },
      ]);

      const outline = generateOutlineFromRequirements(requirements, false);
      const summary = getOutlineSummary(outline);

      expect(summary).toContain('3 total sections');
      expect(summary).toContain('3 from RFP requirements');
      expect(summary).toContain('1 custom');
      expect(summary).toContain('medium confidence');
    });

    test('handles outline with no required sections', () => {
      const requirements = createRequirements([]);
      const outline = generateOutlineFromRequirements(requirements, true);
      const summary = getOutlineSummary(outline);

      expect(summary).toContain(`${RFP_SECTION_ORDER.length} total sections`);
      expect(summary).not.toContain('from RFP requirements');
    });
  });

  describe('deterministic behavior', () => {
    test('produces same output for same input', () => {
      const requirements = createRequirements([
        { title: 'Company Overview', pageLimit: 2 },
        { title: 'Technical Approach', description: 'Describe your approach' },
        { title: 'Custom Sustainability Section' },
      ]);

      const outline1 = generateOutlineFromRequirements(requirements, true);
      const outline2 = generateOutlineFromRequirements(requirements, true);

      expect(outline1.sections.length).toBe(outline2.sections.length);
      expect(outline1.customSections.length).toBe(outline2.customSections.length);
      expect(outline1.mappingConfidence).toBe(outline2.mappingConfidence);

      for (let i = 0; i < outline1.sections.length; i++) {
        expect(outline1.sections[i].sectionKey).toBe(outline2.sections[i].sectionKey);
        expect(outline1.sections[i].customKey).toBe(outline2.sections[i].customKey);
        expect(outline1.sections[i].order).toBe(outline2.sections[i].order);
      }
    });
  });
});
