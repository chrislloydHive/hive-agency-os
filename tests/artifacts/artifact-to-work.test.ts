// tests/artifacts/artifact-to-work.test.ts
// Tests for artifact → work item conversion

import { describe, it, expect } from 'vitest';
import {
  normalizeForKey,
  generateArtifactWorkKey,
  hashWorkKey,
  generateSectionWorkKey,
  generateFreeformWorkKey,
} from '@/lib/os/artifacts/convert/workKeyGenerator';
import {
  validateArtifactForConversion,
  extractWorkKeys,
} from '@/lib/os/artifacts/convert/artifactToWorkItems';
import { isArtifactSource } from '@/lib/types/work';
import type { Artifact } from '@/lib/types/artifact';

// ============================================================================
// Work Key Generator Tests
// ============================================================================

describe('workKeyGenerator', () => {
  describe('normalizeForKey', () => {
    it('converts to lowercase', () => {
      expect(normalizeForKey('Hello World')).toBe('hello_world');
    });

    it('replaces spaces with underscores', () => {
      expect(normalizeForKey('hello world test')).toBe('hello_world_test');
    });

    it('removes special characters', () => {
      expect(normalizeForKey('hello@world#test!')).toBe('helloworldtest');
    });

    it('collapses multiple underscores', () => {
      expect(normalizeForKey('hello   world')).toBe('hello_world');
    });

    it('trims leading and trailing underscores', () => {
      expect(normalizeForKey('  hello world  ')).toBe('hello_world');
    });

    it('truncates long strings to 50 characters', () => {
      const longString = 'a'.repeat(100);
      expect(normalizeForKey(longString).length).toBe(50);
    });

    it('handles empty strings', () => {
      expect(normalizeForKey('')).toBe('');
    });
  });

  describe('generateArtifactWorkKey', () => {
    it('generates key without section ID', () => {
      const key = generateArtifactWorkKey('comp123', 'art456', undefined, 'Create homepage banner');
      expect(key).toBe('comp123:art456:create_homepage_banner');
    });

    it('generates key with section ID', () => {
      const key = generateArtifactWorkKey('comp123', 'art456', 'sec789', 'Create homepage banner');
      expect(key).toBe('comp123:art456:sec789:create_homepage_banner');
    });

    it('normalizes the title', () => {
      const key = generateArtifactWorkKey('comp123', 'art456', undefined, 'Create Homepage Banner!!!');
      expect(key).toBe('comp123:art456:create_homepage_banner');
    });
  });

  describe('hashWorkKey', () => {
    it('generates consistent hash for same input', () => {
      const hash1 = hashWorkKey('comp123:art456:create_banner');
      const hash2 = hashWorkKey('comp123:art456:create_banner');
      expect(hash1).toBe(hash2);
    });

    it('generates different hashes for different inputs', () => {
      const hash1 = hashWorkKey('comp123:art456:create_banner');
      const hash2 = hashWorkKey('comp123:art456:update_banner');
      expect(hash1).not.toBe(hash2);
    });

    it('returns 16 character hex string', () => {
      const hash = hashWorkKey('test_key');
      expect(hash).toMatch(/^[a-f0-9]{16}$/);
    });
  });

  describe('generateSectionWorkKey', () => {
    it('generates key for section-based work item', () => {
      const key = generateSectionWorkKey('comp123', 'art456', 'sec789', 0);
      expect(key).toBe('comp123:art456:sec789:item_0');
    });

    it('generates different keys for different item indices', () => {
      const key1 = generateSectionWorkKey('comp123', 'art456', 'sec789', 0);
      const key2 = generateSectionWorkKey('comp123', 'art456', 'sec789', 1);
      expect(key1).not.toBe(key2);
    });
  });

  describe('generateFreeformWorkKey', () => {
    it('generates key for AI-extracted work item', () => {
      const key = generateFreeformWorkKey('comp123', 'art456', 'Implement tracking pixels', 0);
      expect(key).toBe('comp123:art456:freeform:0_implement_tracking_pixels');
    });

    it('includes both index and title for uniqueness', () => {
      const key = generateFreeformWorkKey('comp123', 'art456', 'Test Task', 5);
      expect(key).toContain('5_test_task');
    });
  });
});

// ============================================================================
// Artifact Validation Tests
// ============================================================================

describe('validateArtifactForConversion', () => {
  const baseArtifact: Partial<Artifact> = {
    id: 'art123',
    companyId: 'comp456',
    title: 'Test Artifact',
    type: 'creative_brief',
    status: 'final',
    source: 'ai_generated',
    generatedContent: {
      sections: [
        { id: 'sec1', title: 'Overview', content: 'Test content' },
      ],
    },
    generatedFormat: 'structured',
    usage: {
      attachedWorkCount: 0,
      firstAttachedAt: null,
      lastAttachedAt: null,
      completedWorkCount: 0,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    googleFileId: null,
    googleFileType: null,
    googleFileUrl: null,
    googleModifiedAt: null,
  };

  it('validates final artifact successfully', () => {
    const result = validateArtifactForConversion(baseArtifact as Artifact);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('validates draft artifact with warning', () => {
    const draftArtifact = { ...baseArtifact, status: 'draft' } as Artifact;
    const result = validateArtifactForConversion(draftArtifact);
    expect(result.valid).toBe(true);
    expect(result.warning).toBeDefined();
    expect(result.warning).toContain('draft');
  });

  it('rejects archived artifact', () => {
    const archivedArtifact = { ...baseArtifact, status: 'archived' } as Artifact;
    const result = validateArtifactForConversion(archivedArtifact);
    expect(result.valid).toBe(false);
    expect(result.error?.toLowerCase()).toContain('archived');
  });

  it('rejects artifact without content', () => {
    const emptyArtifact = { ...baseArtifact, generatedContent: null, generatedMarkdown: null } as Artifact;
    const result = validateArtifactForConversion(emptyArtifact);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('generated content');
  });
});

// ============================================================================
// Extract Work Keys Tests
// ============================================================================

describe('extractWorkKeys', () => {
  it('extracts work keys from conversion result', () => {
    const result = {
      proposedWorkItems: [
        {
          title: 'Task 1',
          description: 'Description 1',
          area: 'Content' as const,
          severity: 'Medium' as const,
          priority: 'medium' as const,
          sectionId: 'sec1',
          sectionName: 'Section 1',
          source: {
            sourceType: 'artifact' as const,
            artifactId: 'art123',
            artifactType: 'creative_brief',
            artifactVersion: 'v1',
            sectionId: 'sec1',
            sectionName: 'Section 1',
            workKey: 'comp:art123:sec1:task_1',
            convertedAt: new Date().toISOString(),
          },
        },
        {
          title: 'Task 2',
          description: 'Description 2',
          area: 'Brand' as const,
          severity: 'High' as const,
          priority: 'high' as const,
          source: {
            sourceType: 'artifact' as const,
            artifactId: 'art123',
            artifactType: 'creative_brief',
            artifactVersion: 'v1',
            workKey: 'comp:art123:task_2',
            convertedAt: new Date().toISOString(),
          },
        },
      ],
      stats: {
        total: 2,
        fromSections: 1,
        fromAi: 1,
      },
    };

    const keys = extractWorkKeys(result);
    expect(keys).toHaveLength(2);
    expect(keys).toContain('comp:art123:sec1:task_1');
    expect(keys).toContain('comp:art123:task_2');
  });

  it('returns empty array for empty result', () => {
    const result = {
      proposedWorkItems: [],
      stats: { total: 0, fromSections: 0, fromAi: 0 },
    };

    const keys = extractWorkKeys(result);
    expect(keys).toHaveLength(0);
  });
});

// ============================================================================
// Work Source Type Guard Tests
// ============================================================================

describe('isArtifactSource', () => {
  it('returns true for artifact source', () => {
    const source = {
      sourceType: 'artifact',
      artifactId: 'art123',
      artifactType: 'creative_brief',
      artifactVersion: 'v1',
      workKey: 'comp:art123:task',
      convertedAt: new Date().toISOString(),
    };

    expect(isArtifactSource(source)).toBe(true);
  });

  it('returns false for other source types', () => {
    const sources = [
      { sourceType: 'tool_run', toolSlug: 'test' },
      { sourceType: 'strategy_play', strategyId: 'strat123' },
      { sourceType: 'heavy_plan', planId: 'plan123' },
      { sourceType: 'creative_brief', briefId: 'brief123' },
    ];

    for (const source of sources) {
      expect(isArtifactSource(source)).toBe(false);
    }
  });

  it('returns false for undefined or null', () => {
    expect(isArtifactSource(undefined)).toBe(false);
    expect(isArtifactSource(null)).toBe(false);
  });
});
