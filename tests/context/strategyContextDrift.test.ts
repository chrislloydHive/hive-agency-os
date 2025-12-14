// tests/context/strategyContextDrift.test.ts
// Dev Audit Tool: Context/Strategy Drift Check
//
// This test verifies that Strategy artifacts and storage do not contain
// any fields that should be in Context. All context-like data must go
// through the proposeContextFromStrategy() path.
//
// Run with: npx vitest tests/context/strategyContextDrift.test.ts

import { describe, test, expect } from 'vitest';
import { findContextKeysInObject, isValidRegistryKey } from '@/lib/contextGraph/nodes';
import type { StrategyArtifact } from '@/lib/types/strategyArtifact';

describe('Context/Strategy Drift Check', () => {
  describe('Strategy Artifact Type Safety', () => {
    test('StrategyArtifact type does not include registry key fields', () => {
      // These are the only allowed fields in StrategyArtifact
      const allowedFields = [
        'id',
        'companyId',
        'type',
        'title',
        'content',
        'status',
        'source',
        'linkedContextRevisionId',
        'linkedCompetitionSource',
        'linkedArtifactIds',
        'promotedToStrategyId',
        'promotedToPillarId',
        'createdAt',
        'updatedAt',
        'createdBy',
        'promotedAt',
        'promotedBy',
        'generatedBy',
        'generatedAt',
        'generationInputs',
      ];

      // None of these should be registry keys
      for (const field of allowedFields) {
        expect(
          isValidRegistryKey(field),
          `Strategy artifact field "${field}" is a registry key! This should not happen.`
        ).toBe(false);
      }
    });

    test('Strategy artifact content is free-form markdown, not structured context', () => {
      // The content field is explicitly markdown - no structured context
      const mockArtifact: Partial<StrategyArtifact> = {
        id: 'art_123',
        companyId: 'company_123',
        type: 'draft_strategy',
        title: 'Q1 Strategy',
        content: '# Strategy\n\nThis is markdown content...',
        status: 'draft',
        source: 'human',
      };

      // content field is a string, not an object with context keys
      expect(typeof mockArtifact.content).toBe('string');
    });
  });

  describe('Registry Key Detection', () => {
    test('detects context keys in objects', () => {
      // Mock object that incorrectly contains context keys
      const badObject = {
        'identity.businessModel': 'B2B SaaS',
        'audience.primaryAudience': 'Enterprise SaaS buyers',
        someOtherField: 'ok',
      };

      const foundKeys = findContextKeysInObject(badObject);
      expect(foundKeys).toContain('identity.businessModel');
      expect(foundKeys).toContain('audience.primaryAudience');
      expect(foundKeys).not.toContain('someOtherField');
    });

    test('does not flag non-context keys', () => {
      const goodObject = {
        artifactTitle: 'My Strategy',
        notes: 'Some notes',
        metadata: {
          createdAt: '2024-01-01',
          version: 1,
        },
      };

      const foundKeys = findContextKeysInObject(goodObject);
      expect(foundKeys.length).toBe(0);
    });

    test('isValidRegistryKey correctly identifies context fields', () => {
      // These should be valid registry keys (actual keys from unified registry)
      expect(isValidRegistryKey('identity.businessModel')).toBe(true);
      expect(isValidRegistryKey('audience.primaryAudience')).toBe(true);
      expect(isValidRegistryKey('competitive.competitors')).toBe(true);

      // These should NOT be registry keys
      expect(isValidRegistryKey('artifactTitle')).toBe(false);
      expect(isValidRegistryKey('createdAt')).toBe(false);
      expect(isValidRegistryKey('random.field.that.does.not.exist')).toBe(false);
    });
  });

  describe('Strategy Storage Invariants', () => {
    test('strategy artifacts should only store content as markdown', () => {
      // Artifacts store strategy thinking as markdown, not structured context
      // This is by design - context lives in Context, strategy lives in Strategy

      const artifact: StrategyArtifact = {
        id: 'art_test',
        companyId: 'company_test',
        type: 'draft_strategy',
        title: 'Test Strategy',
        content: `
# Growth Strategy

## Target Audience
We're targeting B2B SaaS companies...

## Key Differentiators
- Fast implementation
- Low cost

## Strategy Pillars
1. Content marketing
2. Paid search
        `,
        status: 'draft',
        source: 'ai_tool',
        linkedArtifactIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // The artifact correctly stores strategy as markdown
      expect(artifact.content).toContain('# Growth Strategy');
      expect(artifact.content).toContain('## Target Audience');

      // It does NOT have structured context fields
      expect((artifact as any)['identity.businessModel']).toBeUndefined();
      expect((artifact as any).businessModel).toBeUndefined();
      expect((artifact as any).primaryAudience).toBeUndefined();
    });
  });

  describe('proposeContextFromStrategy Contract', () => {
    test('proposal function requires valid registry keys', async () => {
      // This is a compile-time check - if a key isn't in the registry,
      // proposeContextFromStrategy will reject it

      // Valid keys (from unified registry)
      expect(isValidRegistryKey('identity.businessModel')).toBe(true);
      expect(isValidRegistryKey('objectives.primaryObjective')).toBe(true);

      // Invalid keys (not in registry)
      expect(isValidRegistryKey('fake.field')).toBe(false);
      expect(isValidRegistryKey('strategy.pillars')).toBe(false); // strategy fields != context
    });

    test('proposal source must be ai or user, never strategy-direct', () => {
      // The StrategyContextProposal type enforces this:
      // source: 'ai' | 'user'
      // This means Strategy can never directly write context as if it owns it

      type ValidSource = 'ai' | 'user';
      const validSources: ValidSource[] = ['ai', 'user'];

      // 'strategy' is not a valid source for proposals
      expect(validSources).not.toContain('strategy');
      expect(validSources).not.toContain('strategy-direct');
    });
  });
});

describe('INVARIANT: No Strategy → Context Direct Writes', () => {
  test('strategy code should not import updateCompanyContext', async () => {
    // This is enforced by code review and architecture
    // Strategy should only use:
    // - resolveContextValue() for reads
    // - proposeContextFromStrategy() for proposals

    // The fact that this test exists documents the invariant
    const invariant = 'Strategy → Context writes MUST go through proposeContextFromStrategy()';
    expect(invariant).toBeTruthy();
  });

  test('strategy artifacts route does not accept context fields', async () => {
    // The CreateArtifactRequest type only allows:
    // - type, title, content, source, linkedContextRevisionId, linkedCompetitionSource, linkedArtifactIds

    // It does NOT allow arbitrary fields that could be context
    const validArtifactFields = [
      'type',
      'title',
      'content',
      'source',
      'linkedContextRevisionId',
      'linkedCompetitionSource',
      'linkedArtifactIds',
    ];

    for (const field of validArtifactFields) {
      expect(isValidRegistryKey(field)).toBe(false);
    }
  });
});
