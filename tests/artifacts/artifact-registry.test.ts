// tests/artifacts/artifact-registry.test.ts
// Tests for artifact type registry and helpers

import { describe, it, expect } from 'vitest';
import {
  getArtifactType,
  getAllArtifactTypes,
  getArtifactTypesForSource,
  getArtifactTypesByCategory,
  isValidArtifactType,
  getRecommendedArtifactTypes,
  GeneratedArtifactOutputSchema,
  ARTIFACT_TYPES,
} from '@/lib/os/artifacts/registry';

describe('Artifact Registry', () => {
  describe('getArtifactType', () => {
    it('returns artifact type definition by ID', () => {
      const creativeBrief = getArtifactType('creative_brief');
      expect(creativeBrief).not.toBeNull();
      expect(creativeBrief?.id).toBe('creative_brief');
      expect(creativeBrief?.label).toBe('Creative Brief');
    });

    it('returns null for unknown type', () => {
      expect(getArtifactType('nonexistent')).toBeNull();
    });
  });

  describe('getAllArtifactTypes', () => {
    it('returns all artifact types', () => {
      const types = getAllArtifactTypes();
      expect(types.length).toBeGreaterThan(0);
      expect(types.some(t => t.id === 'creative_brief')).toBe(true);
      expect(types.some(t => t.id === 'media_brief')).toBe(true);
    });
  });

  describe('getArtifactTypesForSource', () => {
    it('returns types that support strategy source', () => {
      const types = getArtifactTypesForSource('strategy');
      expect(types.length).toBeGreaterThan(0);
      expect(types.every(t => t.supportedSources.includes('strategy'))).toBe(true);
    });

    it('returns types that support plan:media source', () => {
      const types = getArtifactTypesForSource('plan:media');
      expect(types.length).toBeGreaterThan(0);
      expect(types.every(t => t.supportedSources.includes('plan:media'))).toBe(true);
      // Media brief should support plan:media
      expect(types.some(t => t.id === 'media_brief')).toBe(true);
    });

    it('returns types that support plan:content source', () => {
      const types = getArtifactTypesForSource('plan:content');
      expect(types.length).toBeGreaterThan(0);
      expect(types.some(t => t.id === 'content_brief')).toBe(true);
    });
  });

  describe('getArtifactTypesByCategory', () => {
    it('returns types in brief category', () => {
      const briefs = getArtifactTypesByCategory('brief');
      expect(briefs.length).toBeGreaterThan(0);
      expect(briefs.every(t => t.category === 'brief')).toBe(true);
      expect(briefs.some(t => t.id === 'creative_brief')).toBe(true);
    });

    it('returns types in summary category', () => {
      const summaries = getArtifactTypesByCategory('summary');
      expect(summaries.length).toBeGreaterThan(0);
      expect(summaries.every(t => t.category === 'summary')).toBe(true);
    });

    it('returns types in playbook category', () => {
      const playbooks = getArtifactTypesByCategory('playbook');
      expect(playbooks.length).toBeGreaterThan(0);
      expect(playbooks.some(t => t.id === 'execution_playbook')).toBe(true);
    });
  });

  describe('isValidArtifactType', () => {
    it('returns true for valid types', () => {
      expect(isValidArtifactType('creative_brief')).toBe(true);
      expect(isValidArtifactType('media_brief')).toBe(true);
      expect(isValidArtifactType('strategy_summary')).toBe(true);
    });

    it('returns false for invalid types', () => {
      expect(isValidArtifactType('nonexistent')).toBe(false);
      expect(isValidArtifactType('')).toBe(false);
    });
  });

  describe('getRecommendedArtifactTypes', () => {
    it('always recommends strategy_summary', () => {
      const recommended = getRecommendedArtifactTypes({});
      expect(recommended.some(t => t.id === 'strategy_summary')).toBe(true);
    });

    it('recommends media_brief when hasMediaTactics', () => {
      const recommended = getRecommendedArtifactTypes({ hasMediaTactics: true });
      expect(recommended.some(t => t.id === 'media_brief')).toBe(true);
      expect(recommended.some(t => t.id === 'campaign_brief')).toBe(true);
    });

    it('recommends content_brief when hasContentTactics', () => {
      const recommended = getRecommendedArtifactTypes({ hasContentTactics: true });
      expect(recommended.some(t => t.id === 'content_brief')).toBe(true);
    });

    it('recommends seo_brief when hasSeoTactics', () => {
      const recommended = getRecommendedArtifactTypes({ hasSeoTactics: true });
      expect(recommended.some(t => t.id === 'seo_brief')).toBe(true);
    });

    it('recommends experiment_roadmap when hasExperiments', () => {
      const recommended = getRecommendedArtifactTypes({ hasExperiments: true });
      expect(recommended.some(t => t.id === 'experiment_roadmap')).toBe(true);
    });

    it('always recommends creative_brief', () => {
      const recommended = getRecommendedArtifactTypes({});
      expect(recommended.some(t => t.id === 'creative_brief')).toBe(true);
    });
  });
});

describe('Artifact Output Schema', () => {
  describe('GeneratedArtifactOutputSchema', () => {
    it('validates structured output', () => {
      const structuredOutput = {
        title: 'Test Brief',
        summary: 'A test summary',
        generatedAt: new Date().toISOString(),
        format: 'structured',
        sections: [
          {
            id: 'overview',
            title: 'Overview',
            content: 'This is the overview',
            items: ['Item 1', 'Item 2'],
          },
        ],
      };

      const result = GeneratedArtifactOutputSchema.safeParse(structuredOutput);
      expect(result.success).toBe(true);
    });

    it('validates markdown output', () => {
      const markdownOutput = {
        title: 'Strategy Summary',
        summary: 'Executive summary',
        generatedAt: new Date().toISOString(),
        format: 'markdown',
        content: '# Strategy Summary\n\n## Overview\nThis is the overview.',
      };

      const result = GeneratedArtifactOutputSchema.safeParse(markdownOutput);
      expect(result.success).toBe(true);
    });

    it('validates hybrid output', () => {
      const hybridOutput = {
        title: 'Campaign Brief',
        summary: 'Campaign overview',
        generatedAt: new Date().toISOString(),
        format: 'hybrid',
        content: '# Campaign Overview\nThis campaign focuses on...',
        sections: [
          {
            id: 'channels',
            title: 'Channels',
            content: 'Social, Paid Search',
          },
        ],
      };

      const result = GeneratedArtifactOutputSchema.safeParse(hybridOutput);
      expect(result.success).toBe(true);
    });

    it('rejects invalid output missing required fields', () => {
      const invalidOutput = {
        title: 'Missing Fields',
        format: 'structured',
        // Missing generatedAt and sections
      };

      const result = GeneratedArtifactOutputSchema.safeParse(invalidOutput);
      expect(result.success).toBe(false);
    });

    it('rejects invalid format', () => {
      const invalidFormat = {
        title: 'Bad Format',
        generatedAt: new Date().toISOString(),
        format: 'invalid',
        content: 'Some content',
      };

      const result = GeneratedArtifactOutputSchema.safeParse(invalidFormat);
      expect(result.success).toBe(false);
    });
  });
});

describe('Artifact Type Definitions', () => {
  it('all types have required fields', () => {
    const types = Object.values(ARTIFACT_TYPES);
    for (const type of types) {
      expect(type.id).toBeDefined();
      expect(type.label).toBeDefined();
      expect(type.description).toBeDefined();
      expect(type.supportedSources).toBeDefined();
      expect(type.supportedSources.length).toBeGreaterThan(0);
      expect(type.outputFormat).toBeDefined();
      expect(type.category).toBeDefined();
    }
  });

  it('structured types have defaultSections', () => {
    const types = Object.values(ARTIFACT_TYPES).filter(t => t.outputFormat === 'structured');
    for (const type of types) {
      expect(type.defaultSections).toBeDefined();
      expect(type.defaultSections?.length).toBeGreaterThan(0);
    }
  });

  it('all types support at least one source', () => {
    const types = Object.values(ARTIFACT_TYPES);
    for (const type of types) {
      expect(type.supportedSources.length).toBeGreaterThan(0);
    }
  });

  it('all types have valid categories', () => {
    const validCategories = ['brief', 'plan', 'summary', 'playbook', 'report'];
    const types = Object.values(ARTIFACT_TYPES);
    for (const type of types) {
      expect(validCategories).toContain(type.category);
    }
  });
});
