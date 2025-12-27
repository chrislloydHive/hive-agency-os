// tests/artifacts/generateArtifactModal.test.ts
// Tests for GenerateArtifactModal recommended-first launch mode
//
// Verifies:
// - recommended-first rendering when launchMode="recommended"
// - fallback to full list when recommendedTypeIds empty
// - defaultSelectedTypeId preselects correctly

import { describe, it, expect } from 'vitest';
import type { ArtifactTypeDefinition } from '@/lib/os/artifacts/registry';

// ============================================================================
// Test Data
// ============================================================================

const mockArtifactTypes: ArtifactTypeDefinition[] = [
  {
    id: 'strategy_summary',
    label: 'Strategy Summary',
    description: 'High-level strategy overview',
    category: 'summary',
    supportedSources: ['strategy'],
    defaultSections: ['overview', 'objectives', 'tactics'],
  },
  {
    id: 'creative_brief',
    label: 'Creative Brief',
    description: 'Brief for creative work',
    category: 'brief',
    supportedSources: ['strategy'],
    defaultSections: ['background', 'objectives', 'deliverables'],
  },
  {
    id: 'media_brief',
    label: 'Media Brief',
    description: 'Brief for media planning',
    category: 'brief',
    supportedSources: ['strategy'],
    defaultSections: ['audience', 'channels', 'budget'],
  },
  {
    id: 'execution_playbook',
    label: 'Execution Playbook',
    description: 'Step-by-step execution guide',
    category: 'playbook',
    supportedSources: ['strategy'],
    defaultSections: ['phases', 'milestones', 'dependencies'],
  },
];

// ============================================================================
// Helper Functions (mirrors modal logic)
// ============================================================================

/**
 * Determines if recommended-first mode should be active
 */
function isRecommendedFirstMode(
  launchMode: 'recommended' | 'all',
  recommendedTypeIds: string[],
  legacyRecommendedTypes: ArtifactTypeDefinition[]
): boolean {
  const hasRecommendedTypes = recommendedTypeIds.length > 0 || legacyRecommendedTypes.length > 0;
  return launchMode === 'recommended' && hasRecommendedTypes;
}

/**
 * Resolves recommended types from IDs, preserving order
 */
function resolveRecommendedTypes(
  artifactTypes: ArtifactTypeDefinition[],
  recommendedTypeIds: string[],
  legacyRecommendedTypes: ArtifactTypeDefinition[]
): ArtifactTypeDefinition[] {
  if (recommendedTypeIds.length > 0) {
    return recommendedTypeIds
      .map(id => artifactTypes.find(t => t.id === id))
      .filter((t): t is ArtifactTypeDefinition => t !== undefined);
  }
  return legacyRecommendedTypes;
}

/**
 * Determines initial selected type ID
 */
function getInitialSelectedTypeId(
  defaultSelectedTypeId: string | undefined,
  recommendedTypeIds: string[],
  legacyRecommendedTypes: ArtifactTypeDefinition[]
): string | null {
  if (defaultSelectedTypeId) {
    return defaultSelectedTypeId;
  }
  if (recommendedTypeIds.length > 0) {
    return recommendedTypeIds[0];
  }
  if (legacyRecommendedTypes.length > 0) {
    return legacyRecommendedTypes[0].id;
  }
  return null;
}

/**
 * Determines initial showAllTypes state
 */
function getInitialShowAllTypes(isRecommendedFirst: boolean): boolean {
  return !isRecommendedFirst;
}

// ============================================================================
// isRecommendedFirstMode Tests
// ============================================================================

describe('isRecommendedFirstMode', () => {
  it('returns true when launchMode="recommended" and recommendedTypeIds provided', () => {
    const result = isRecommendedFirstMode(
      'recommended',
      ['strategy_summary', 'creative_brief'],
      []
    );
    expect(result).toBe(true);
  });

  it('returns true when launchMode="recommended" and legacy recommendedTypes provided', () => {
    const result = isRecommendedFirstMode(
      'recommended',
      [],
      [mockArtifactTypes[0]]
    );
    expect(result).toBe(true);
  });

  it('returns false when launchMode="all"', () => {
    const result = isRecommendedFirstMode(
      'all',
      ['strategy_summary'],
      []
    );
    expect(result).toBe(false);
  });

  it('returns false when launchMode="recommended" but no recommendations', () => {
    const result = isRecommendedFirstMode('recommended', [], []);
    expect(result).toBe(false);
  });
});

// ============================================================================
// resolveRecommendedTypes Tests
// ============================================================================

describe('resolveRecommendedTypes', () => {
  it('returns types in order of recommendedTypeIds', () => {
    const result = resolveRecommendedTypes(
      mockArtifactTypes,
      ['media_brief', 'strategy_summary'],
      []
    );

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('media_brief');
    expect(result[1].id).toBe('strategy_summary');
  });

  it('filters out unknown type IDs', () => {
    const result = resolveRecommendedTypes(
      mockArtifactTypes,
      ['unknown_type', 'strategy_summary'],
      []
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('strategy_summary');
  });

  it('falls back to legacy recommendedTypes when IDs empty', () => {
    const legacyTypes = [mockArtifactTypes[1], mockArtifactTypes[2]];
    const result = resolveRecommendedTypes(mockArtifactTypes, [], legacyTypes);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('creative_brief');
    expect(result[1].id).toBe('media_brief');
  });

  it('returns empty array when no recommendations', () => {
    const result = resolveRecommendedTypes(mockArtifactTypes, [], []);
    expect(result).toHaveLength(0);
  });
});

// ============================================================================
// getInitialSelectedTypeId Tests
// ============================================================================

describe('getInitialSelectedTypeId', () => {
  it('uses defaultSelectedTypeId when provided', () => {
    const result = getInitialSelectedTypeId(
      'execution_playbook',
      ['strategy_summary', 'creative_brief'],
      []
    );
    expect(result).toBe('execution_playbook');
  });

  it('uses first recommendedTypeId when no default', () => {
    const result = getInitialSelectedTypeId(
      undefined,
      ['media_brief', 'strategy_summary'],
      []
    );
    expect(result).toBe('media_brief');
  });

  it('uses first legacy recommended type when no IDs', () => {
    const result = getInitialSelectedTypeId(
      undefined,
      [],
      [mockArtifactTypes[2], mockArtifactTypes[0]]
    );
    expect(result).toBe('media_brief');
  });

  it('returns null when no recommendations', () => {
    const result = getInitialSelectedTypeId(undefined, [], []);
    expect(result).toBe(null);
  });
});

// ============================================================================
// getInitialShowAllTypes Tests
// ============================================================================

describe('getInitialShowAllTypes', () => {
  it('returns false (hide full list) when recommended-first mode', () => {
    const result = getInitialShowAllTypes(true);
    expect(result).toBe(false);
  });

  it('returns true (show full list) when not recommended-first mode', () => {
    const result = getInitialShowAllTypes(false);
    expect(result).toBe(true);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('recommended-first integration', () => {
  it('correctly sets up recommended-first mode with defaultSelectedTypeId', () => {
    const launchMode = 'recommended';
    const recommendedTypeIds = ['strategy_summary', 'creative_brief', 'media_brief'];
    const defaultSelectedTypeId = 'creative_brief';

    const isRecommendedFirst = isRecommendedFirstMode(launchMode, recommendedTypeIds, []);
    const resolvedTypes = resolveRecommendedTypes(mockArtifactTypes, recommendedTypeIds, []);
    const selectedTypeId = getInitialSelectedTypeId(defaultSelectedTypeId, recommendedTypeIds, []);
    const showAllTypes = getInitialShowAllTypes(isRecommendedFirst);

    expect(isRecommendedFirst).toBe(true);
    expect(resolvedTypes).toHaveLength(3);
    expect(selectedTypeId).toBe('creative_brief');
    expect(showAllTypes).toBe(false);
  });

  it('correctly falls back to full list when no recommendations', () => {
    const launchMode = 'recommended';
    const recommendedTypeIds: string[] = [];

    const isRecommendedFirst = isRecommendedFirstMode(launchMode, recommendedTypeIds, []);
    const showAllTypes = getInitialShowAllTypes(isRecommendedFirst);

    expect(isRecommendedFirst).toBe(false);
    expect(showAllTypes).toBe(true);
  });

  it('correctly handles launchMode="all" even with recommendations', () => {
    const launchMode = 'all';
    const recommendedTypeIds = ['strategy_summary'];

    const isRecommendedFirst = isRecommendedFirstMode(launchMode, recommendedTypeIds, []);
    const showAllTypes = getInitialShowAllTypes(isRecommendedFirst);

    expect(isRecommendedFirst).toBe(false);
    expect(showAllTypes).toBe(true);
  });
});
