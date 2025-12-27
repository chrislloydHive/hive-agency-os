// tests/artifacts/artifact-inputs.test.ts
// Tests for artifact input building and hashing

import { describe, it, expect } from 'vitest';
import {
  buildArtifactInputs,
  hashInputs,
  detectTacticChannels,
} from '@/lib/os/artifacts/buildInputs';
import type { ContextGraph } from '@/lib/types/contextGraph';
import type { Strategy } from '@/lib/types/strategy';
import type { ArtifactSourceInput } from '@/lib/os/artifacts/buildInputs';

// Mock data helpers
function createMockContextGraph(overrides: Partial<ContextGraph> = {}): ContextGraph {
  return {
    brand: {
      positioning: { value: 'Premium B2B solution', status: 'confirmed' },
    },
    audience: {
      primaryAudience: { value: 'Enterprise decision makers', status: 'confirmed' },
      icpDescription: { value: 'CTOs at mid-market SaaS companies', status: 'confirmed' },
    },
    productOffer: {
      valueProposition: { value: 'Save 50% on cloud costs', status: 'confirmed' },
    },
    ...overrides,
  } as ContextGraph;
}

function createMockStrategy(overrides: Partial<Strategy> = {}): Strategy {
  return {
    id: 'test-strategy-1',
    goalStatement: 'Increase ARR by 40% through targeted enterprise acquisition',
    strategyFrame: 'growth',
    objectives: [
      { id: 'obj-1', text: 'Increase qualified leads', status: 'active', metric: 'MQLs', target: '500/month' },
      { id: 'obj-2', text: 'Improve conversion rate', status: 'active', metric: 'CVR', target: '5%' },
    ],
    pillars: [
      { id: 'bet-1', name: 'Account-based marketing', status: 'accepted' },
    ],
    plays: [
      { id: 'tactic-1', title: 'LinkedIn ABM campaigns', status: 'active', channels: ['media', 'social'] },
      { id: 'tactic-2', title: 'Content hub launch', status: 'active', channels: ['content'] },
      { id: 'tactic-3', title: 'SEO optimization', status: 'proposed', channels: ['seo'] },
      { id: 'tactic-4', title: 'Paused tactic', status: 'paused', channels: ['media'] },
    ],
    ...overrides,
  } as Strategy;
}

describe('buildArtifactInputs', () => {
  it('builds context from strategy source', () => {
    const source: ArtifactSourceInput = {
      sourceType: 'strategy',
      sourceId: 'test-strategy-1',
    };

    const result = buildArtifactInputs({
      source,
      companyName: 'Test Company',
      context: createMockContextGraph(),
      strategy: createMockStrategy(),
    });

    expect(result.companyName).toBe('Test Company');
    expect(result.goalStatement).toBe('Increase ARR by 40% through targeted enterprise acquisition');
    expect(result.positioning).toBe('Premium B2B solution');
    expect(result.valueProposition).toBe('Save 50% on cloud costs');
    expect(result.primaryAudience).toBe('Enterprise decision makers');
    expect(result.icpDescription).toBe('CTOs at mid-market SaaS companies');
  });

  it('extracts active objectives', () => {
    const source: ArtifactSourceInput = { sourceType: 'strategy', sourceId: 'test' };
    const result = buildArtifactInputs({
      source,
      companyName: 'Test',
      context: null,
      strategy: createMockStrategy(),
    });

    expect(result.objectives.length).toBe(2);
    expect(result.objectives[0].text).toBe('Increase qualified leads');
    expect(result.objectives[0].metric).toBe('MQLs');
    expect(result.objectives[0].target).toBe('500/month');
  });

  it('extracts active and proposed tactics', () => {
    const source: ArtifactSourceInput = { sourceType: 'strategy', sourceId: 'test' };
    const result = buildArtifactInputs({
      source,
      companyName: 'Test',
      context: null,
      strategy: createMockStrategy(),
    });

    // Should include active and proposed, not paused
    expect(result.tactics.length).toBe(3);
    expect(result.tactics.some(t => t.title === 'LinkedIn ABM campaigns')).toBe(true);
    expect(result.tactics.some(t => t.title === 'SEO optimization')).toBe(true);
    expect(result.tactics.some(t => t.title === 'Paused tactic')).toBe(false);
  });

  it('filters tactics by includedTacticIds', () => {
    const source: ArtifactSourceInput = {
      sourceType: 'strategy',
      sourceId: 'test',
      includedTacticIds: ['tactic-1', 'tactic-3'],
    };

    const result = buildArtifactInputs({
      source,
      companyName: 'Test',
      context: null,
      strategy: createMockStrategy(),
    });

    // Should only include the specified tactics that are active/proposed
    expect(result.tactics.length).toBe(2);
    expect(result.tactics.some(t => t.title === 'LinkedIn ABM campaigns')).toBe(true);
    expect(result.tactics.some(t => t.title === 'SEO optimization')).toBe(true);
    expect(result.tactics.some(t => t.title === 'Content hub launch')).toBe(false);
  });

  it('includes promptHint when provided', () => {
    const source: ArtifactSourceInput = { sourceType: 'strategy', sourceId: 'test' };
    const result = buildArtifactInputs({
      source,
      companyName: 'Test',
      context: null,
      strategy: null,
      promptHint: 'Focus on enterprise segment',
    });

    expect(result.promptHint).toBe('Focus on enterprise segment');
  });

  it('handles null context gracefully', () => {
    const source: ArtifactSourceInput = { sourceType: 'strategy', sourceId: 'test' };
    const result = buildArtifactInputs({
      source,
      companyName: 'Test',
      context: null,
      strategy: createMockStrategy(),
    });

    expect(result.positioning).toBeUndefined();
    expect(result.valueProposition).toBeUndefined();
    expect(result.primaryAudience).toBeUndefined();
  });

  it('handles null strategy gracefully', () => {
    const source: ArtifactSourceInput = { sourceType: 'strategy', sourceId: 'test' };
    const result = buildArtifactInputs({
      source,
      companyName: 'Test',
      context: createMockContextGraph(),
      strategy: null,
    });

    expect(result.goalStatement).toBeUndefined();
    expect(result.objectives).toEqual([]);
    expect(result.tactics).toEqual([]);
  });
});

describe('hashInputs', () => {
  it('generates consistent hash for same inputs', () => {
    const context = {
      companyName: 'Test',
      goalStatement: 'Goal',
      positioning: 'Position',
      primaryAudience: 'Audience',
      objectives: [{ text: 'Objective 1' }],
      tactics: [{ title: 'Tactic 1', status: 'active' }],
    };

    const hash1 = hashInputs(context as any);
    const hash2 = hashInputs(context as any);

    expect(hash1).toBe(hash2);
  });

  it('generates different hash for different inputs', () => {
    const context1 = {
      companyName: 'Test',
      goalStatement: 'Goal 1',
      objectives: [{ text: 'Objective 1' }],
      tactics: [{ title: 'Tactic 1', status: 'active' }],
    };

    const context2 = {
      companyName: 'Test',
      goalStatement: 'Goal 2', // Different goal
      objectives: [{ text: 'Objective 1' }],
      tactics: [{ title: 'Tactic 1', status: 'active' }],
    };

    const hash1 = hashInputs(context1 as any);
    const hash2 = hashInputs(context2 as any);

    expect(hash1).not.toBe(hash2);
  });

  it('returns 8-character hex hash', () => {
    const context = {
      companyName: 'Test',
      objectives: [],
      tactics: [],
    };

    const hash = hashInputs(context as any);
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('is insensitive to tactic order', () => {
    const context1 = {
      companyName: 'Test',
      objectives: [],
      tactics: [{ title: 'B', status: 'active' }, { title: 'A', status: 'active' }],
    };

    const context2 = {
      companyName: 'Test',
      objectives: [],
      tactics: [{ title: 'A', status: 'active' }, { title: 'B', status: 'active' }],
    };

    const hash1 = hashInputs(context1 as any);
    const hash2 = hashInputs(context2 as any);

    expect(hash1).toBe(hash2);
  });
});

describe('detectTacticChannels', () => {
  it('detects media tactics', () => {
    const strategy = createMockStrategy();
    const result = detectTacticChannels(strategy);
    expect(result.hasMediaTactics).toBe(true);
  });

  it('detects content tactics', () => {
    const strategy = createMockStrategy();
    const result = detectTacticChannels(strategy);
    expect(result.hasContentTactics).toBe(true);
  });

  it('detects SEO tactics', () => {
    const strategy = createMockStrategy();
    const result = detectTacticChannels(strategy);
    expect(result.hasSeoTactics).toBe(true);
  });

  it('detects experiments (proposed tactics)', () => {
    const strategy = createMockStrategy();
    const result = detectTacticChannels(strategy);
    expect(result.hasExperiments).toBe(true);
  });

  it('returns all false for null strategy', () => {
    const result = detectTacticChannels(null);
    expect(result.hasMediaTactics).toBe(false);
    expect(result.hasContentTactics).toBe(false);
    expect(result.hasSeoTactics).toBe(false);
    expect(result.hasExperiments).toBe(false);
  });

  it('returns all false for strategy with no plays', () => {
    const strategy = createMockStrategy({ plays: [] });
    const result = detectTacticChannels(strategy);
    expect(result.hasMediaTactics).toBe(false);
    expect(result.hasContentTactics).toBe(false);
    expect(result.hasSeoTactics).toBe(false);
    expect(result.hasExperiments).toBe(false);
  });

  it('ignores paused tactics', () => {
    const strategy = createMockStrategy({
      plays: [
        { id: '1', title: 'Paused media', status: 'paused', channels: ['media'] },
      ],
    });
    const result = detectTacticChannels(strategy);
    expect(result.hasMediaTactics).toBe(false);
  });
});
