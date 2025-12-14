// tests/hiveBrain/mergePrecedence.test.ts
// Tests for Hive Brain merge precedence
//
// Validates that:
// 1. Company values override Hive Brain defaults
// 2. Hive Brain fills in missing company values
// 3. Empty arrays in company don't block Hive Brain

import { describe, it, expect } from 'vitest';
import {
  mergeWithHiveBrain,
  getValueSource,
  HIVE_GLOBAL_ID,
  HIVE_GLOBAL_NAME,
  isValidHiveBrainSource,
  HIVE_BRAIN_DOMAINS,
} from '@/lib/contextGraph/globalGraph';
import { createEmptyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';

// ============================================================================
// Test Fixtures
// ============================================================================

function makeCompanyGraph(overrides: Partial<{ brand: object; objectives: object }> = {}): CompanyContextGraph {
  const graph = createEmptyContextGraph('test-company-123', 'Test Company');

  // Apply overrides
  if (overrides.brand) {
    graph.brand = { ...graph.brand, ...overrides.brand };
  }
  if (overrides.objectives) {
    graph.objectives = { ...graph.objectives, ...overrides.objectives };
  }

  return graph;
}

function makeHiveGraph(overrides: Partial<{ brand: object; objectives: object }> = {}): CompanyContextGraph {
  const graph = createEmptyContextGraph(HIVE_GLOBAL_ID, HIVE_GLOBAL_NAME);

  // Apply overrides
  if (overrides.brand) {
    graph.brand = { ...graph.brand, ...overrides.brand };
  }
  if (overrides.objectives) {
    graph.objectives = { ...graph.objectives, ...overrides.objectives };
  }

  return graph;
}

function makeWithMeta<T>(value: T, source: string = 'manual'): { value: T; provenance: { source: string; confidence: number; updatedAt: string }[] } {
  return {
    value,
    provenance: [{
      source,
      confidence: 100,
      updatedAt: new Date().toISOString(),
    }],
  };
}

// ============================================================================
// Tests: Merge Precedence
// ============================================================================

describe('mergeWithHiveBrain', () => {
  describe('company values override hive defaults', () => {
    it('uses company value when company has data', () => {
      const companyGraph = makeCompanyGraph({
        brand: {
          positioning: makeWithMeta('Company-specific positioning'),
        },
      });

      const hiveGraph = makeHiveGraph({
        brand: {
          positioning: makeWithMeta('Hive default positioning'),
        },
      });

      const merged = mergeWithHiveBrain(companyGraph, hiveGraph);

      expect((merged.brand as any).positioning.value).toBe('Company-specific positioning');
    });

    it('keeps company value even when hive has better data', () => {
      const companyGraph = makeCompanyGraph({
        brand: {
          toneOfVoice: makeWithMeta('Brief tone'),
        },
      });

      const hiveGraph = makeHiveGraph({
        brand: {
          toneOfVoice: makeWithMeta('Detailed professional tone with specifics'),
        },
      });

      const merged = mergeWithHiveBrain(companyGraph, hiveGraph);

      expect((merged.brand as any).toneOfVoice.value).toBe('Brief tone');
    });
  });

  describe('hive fills missing company values', () => {
    it('uses hive value when company has no data', () => {
      const companyGraph = makeCompanyGraph({
        brand: {
          positioning: { value: null, provenance: [] },
        },
      });

      const hiveGraph = makeHiveGraph({
        brand: {
          positioning: makeWithMeta('Hive default positioning'),
        },
      });

      const merged = mergeWithHiveBrain(companyGraph, hiveGraph);

      expect((merged.brand as any).positioning.value).toBe('Hive default positioning');
    });

    it('uses hive value when company has empty array', () => {
      const companyGraph = makeCompanyGraph({
        objectives: {
          kpiLabels: { value: [], provenance: [] },
        },
      });

      const hiveGraph = makeHiveGraph({
        objectives: {
          kpiLabels: makeWithMeta(['Leads', 'Revenue', 'ROAS']),
        },
      });

      const merged = mergeWithHiveBrain(companyGraph, hiveGraph);

      expect((merged.objectives as any).kpiLabels.value).toEqual(['Leads', 'Revenue', 'ROAS']);
    });

    it('uses hive value when company field is undefined', () => {
      const companyGraph = makeCompanyGraph();
      // Don't set any brand values

      const hiveGraph = makeHiveGraph({
        brand: {
          brandPersonality: makeWithMeta('Confident and approachable'),
        },
      });

      const merged = mergeWithHiveBrain(companyGraph, hiveGraph);

      expect((merged.brand as any).brandPersonality.value).toBe('Confident and approachable');
    });
  });

  describe('preserves company identity', () => {
    it('keeps company ID and name', () => {
      const companyGraph = makeCompanyGraph();
      const hiveGraph = makeHiveGraph();

      const merged = mergeWithHiveBrain(companyGraph, hiveGraph);

      expect(merged.companyId).toBe('test-company-123');
      expect(merged.companyName).toBe('Test Company');
    });

    it('keeps company metadata', () => {
      const companyGraph = makeCompanyGraph();
      companyGraph.meta.completenessScore = 75;

      const hiveGraph = makeHiveGraph();

      const merged = mergeWithHiveBrain(companyGraph, hiveGraph);

      expect(merged.meta.completenessScore).toBe(75);
    });
  });

  describe('only merges hive brain domains', () => {
    it('does not merge non-hive-brain domains', () => {
      const companyGraph = makeCompanyGraph();
      const hiveGraph = makeHiveGraph();

      // Set a value in a non-Hive Brain domain
      (hiveGraph.website as any).siteHealth = makeWithMeta('Good');

      const merged = mergeWithHiveBrain(companyGraph, hiveGraph);

      // Website is not a Hive Brain domain, so it should not be merged
      expect((merged.website as any).siteHealth?.value).not.toBe('Good');
    });
  });
});

// ============================================================================
// Tests: Value Source Detection
// ============================================================================

describe('getValueSource', () => {
  it('returns "company" when company has value', () => {
    const companyGraph = makeCompanyGraph({
      brand: {
        positioning: makeWithMeta('Company positioning', 'user'),
      },
    });

    const hiveGraph = makeHiveGraph({
      brand: {
        positioning: makeWithMeta('Hive positioning'),
      },
    });

    const source = getValueSource(companyGraph, hiveGraph, 'brand', 'positioning');

    expect(source.source).toBe('company');
    expect(source.isHumanConfirmed).toBe(true);
  });

  it('returns "hive" when only hive has value', () => {
    const companyGraph = makeCompanyGraph({
      brand: {
        positioning: { value: null, provenance: [] },
      },
    });

    const hiveGraph = makeHiveGraph({
      brand: {
        positioning: makeWithMeta('Hive positioning'),
      },
    });

    const source = getValueSource(companyGraph, hiveGraph, 'brand', 'positioning');

    expect(source.source).toBe('hive');
    expect(source.isHumanConfirmed).toBe(true); // Hive is always human-confirmed
  });

  it('returns "none" when neither has value', () => {
    const companyGraph = makeCompanyGraph();
    const hiveGraph = makeHiveGraph();

    const source = getValueSource(companyGraph, hiveGraph, 'brand', 'positioning');

    expect(source.source).toBe('none');
    expect(source.isHumanConfirmed).toBe(false);
  });

  it('returns "company" with isHumanConfirmed=false for AI sources', () => {
    const companyGraph = makeCompanyGraph({
      brand: {
        positioning: makeWithMeta('AI positioning', 'ai_baseline'),
      },
    });

    const source = getValueSource(companyGraph, null, 'brand', 'positioning');

    expect(source.source).toBe('company');
    expect(source.isHumanConfirmed).toBe(false);
  });
});

// ============================================================================
// Tests: Source Validation
// ============================================================================

describe('isValidHiveBrainSource', () => {
  it('accepts "manual" source', () => {
    expect(isValidHiveBrainSource('manual')).toBe(true);
  });

  it('accepts "user" source', () => {
    expect(isValidHiveBrainSource('user')).toBe(true);
  });

  it('accepts "brain" source', () => {
    expect(isValidHiveBrainSource('brain')).toBe(true);
  });

  it('rejects "ai" source', () => {
    expect(isValidHiveBrainSource('ai')).toBe(false);
  });

  it('rejects "fcb" source', () => {
    expect(isValidHiveBrainSource('fcb')).toBe(false);
  });

  it('rejects "gap_ia" source', () => {
    expect(isValidHiveBrainSource('gap_ia')).toBe(false);
  });
});

// ============================================================================
// Tests: Domain Configuration
// ============================================================================

describe('HIVE_BRAIN_DOMAINS', () => {
  it('includes expected domains', () => {
    expect(HIVE_BRAIN_DOMAINS).toContain('brand');
    expect(HIVE_BRAIN_DOMAINS).toContain('objectives');
    expect(HIVE_BRAIN_DOMAINS).toContain('operationalConstraints');
    expect(HIVE_BRAIN_DOMAINS).toContain('ops');
    expect(HIVE_BRAIN_DOMAINS).toContain('creative');
    expect(HIVE_BRAIN_DOMAINS).toContain('performanceMedia');
  });

  it('has exactly 6 domains in v1', () => {
    expect(HIVE_BRAIN_DOMAINS).toHaveLength(6);
  });
});

// ============================================================================
// Tests: Constants
// ============================================================================

describe('Hive Brain Constants', () => {
  it('has correct global ID', () => {
    expect(HIVE_GLOBAL_ID).toBe('HIVE_GLOBAL');
  });

  it('has correct global name', () => {
    expect(HIVE_GLOBAL_NAME).toBe('Hive Brain');
  });
});
