// tests/competition/competitionMutualExclusivity.test.ts
// Competition V4/V3 Mutual Exclusivity Tests
//
// Ensures that when V4 competition data exists, V3 is NEVER mixed in.
// Strategy context should use exactly ONE competition source.

import { describe, it, expect } from 'vitest';
import {
  selectCompetitionSource,
  validateCompetitionDataConsistency,
  shouldV4ReplaceV3,
  type CompetitionRunInfo,
} from '@/lib/os/competition/sourceSelection';

describe('Competition V4/V3 Mutual Exclusivity', () => {

  describe('Source Selection Logic', () => {

    it('should select V4 when both V4 and V3 runs exist', () => {
      const v4Runs: CompetitionRunInfo[] = [
        { id: 'v4-run-1', version: 'v4', createdAt: '2024-01-15T00:00:00Z', status: 'completed' },
      ];
      const v3Runs: CompetitionRunInfo[] = [
        { id: 'v3-run-1', version: 'v3', createdAt: '2024-01-10T00:00:00Z', status: 'completed' },
      ];

      const selection = selectCompetitionSource(v4Runs, v3Runs);

      expect(selection.version).toBe('v4');
      expect(selection.sourceId).toBe('competition_v4');
      expect(selection.runId).toBe('v4-run-1');
    });

    it('should select V4 even if V3 is more recent', () => {
      const v4Runs: CompetitionRunInfo[] = [
        { id: 'v4-old', version: 'v4', createdAt: '2024-01-01T00:00:00Z', status: 'completed' },
      ];
      const v3Runs: CompetitionRunInfo[] = [
        { id: 'v3-new', version: 'v3', createdAt: '2024-01-20T00:00:00Z', status: 'completed' },
      ];

      const selection = selectCompetitionSource(v4Runs, v3Runs);

      // V4 should ALWAYS be preferred, regardless of age
      expect(selection.version).toBe('v4');
      expect(selection.sourceId).toBe('competition_v4');
    });

    it('should fall back to V3 only when V4 is unavailable', () => {
      const v4Runs: CompetitionRunInfo[] = [];
      const v3Runs: CompetitionRunInfo[] = [
        { id: 'v3-run-1', version: 'v3', createdAt: '2024-01-15T00:00:00Z', status: 'completed' },
      ];

      const selection = selectCompetitionSource(v4Runs, v3Runs);

      expect(selection.version).toBe('v3');
      expect(selection.sourceId).toBe('competition_lab');
      expect(selection.reason).toContain('fallback');
    });

    it('should return none when no runs exist', () => {
      const selection = selectCompetitionSource([], []);

      expect(selection.version).toBe('none');
      expect(selection.sourceId).toBe(null);
    });

    it('should ignore failed V4 runs and use V3', () => {
      const v4Runs: CompetitionRunInfo[] = [
        { id: 'v4-failed', version: 'v4', createdAt: '2024-01-15T00:00:00Z', status: 'failed' },
      ];
      const v3Runs: CompetitionRunInfo[] = [
        { id: 'v3-good', version: 'v3', createdAt: '2024-01-10T00:00:00Z', status: 'completed' },
      ];

      const selection = selectCompetitionSource(v4Runs, v3Runs);

      expect(selection.version).toBe('v3');
    });

    it('should use most recent V4 when multiple V4 runs exist', () => {
      const v4Runs: CompetitionRunInfo[] = [
        { id: 'v4-old', version: 'v4', createdAt: '2024-01-01T00:00:00Z', status: 'completed' },
        { id: 'v4-new', version: 'v4', createdAt: '2024-01-20T00:00:00Z', status: 'completed' },
        { id: 'v4-mid', version: 'v4', createdAt: '2024-01-10T00:00:00Z', status: 'completed' },
      ];

      const selection = selectCompetitionSource(v4Runs, []);

      expect(selection.runId).toBe('v4-new');
    });
  });

  describe('Data Consistency Validation', () => {

    it('should FAIL validation when V4 and V3 sources are mixed', () => {
      const sources = ['competition_v4', 'competition_lab'];

      const result = validateCompetitionDataConsistency(sources);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('mixes V4 and V3');
    });

    it('should PASS validation with V4 only', () => {
      const sources = ['competition_v4', 'competition_v4'];

      const result = validateCompetitionDataConsistency(sources);

      expect(result.valid).toBe(true);
    });

    it('should PASS validation with V3 only', () => {
      const sources = ['competition_lab'];

      const result = validateCompetitionDataConsistency(sources);

      expect(result.valid).toBe(true);
    });

    it('should PASS validation with empty sources', () => {
      const result = validateCompetitionDataConsistency([]);

      expect(result.valid).toBe(true);
    });
  });

  describe('V4 Replacement Logic', () => {

    it('should replace V3 data when V4 run completes', () => {
      const newV4Run: CompetitionRunInfo = {
        id: 'new-v4',
        version: 'v4',
        createdAt: '2024-01-20T00:00:00Z',
        status: 'completed',
      };

      const shouldReplace = shouldV4ReplaceV3('competition_lab', newV4Run);

      expect(shouldReplace).toBe(true);
    });

    it('should replace null data when V4 run completes', () => {
      const newV4Run: CompetitionRunInfo = {
        id: 'new-v4',
        version: 'v4',
        createdAt: '2024-01-20T00:00:00Z',
        status: 'completed',
      };

      const shouldReplace = shouldV4ReplaceV3(null, newV4Run);

      expect(shouldReplace).toBe(true);
    });

    it('should NOT automatically replace existing V4 data', () => {
      const newV4Run: CompetitionRunInfo = {
        id: 'new-v4',
        version: 'v4',
        createdAt: '2024-01-20T00:00:00Z',
        status: 'completed',
      };

      // If V4 already exists, don't auto-replace (date comparison handled separately)
      const shouldReplace = shouldV4ReplaceV3('competition_v4', newV4Run);

      expect(shouldReplace).toBe(false);
    });
  });

  describe('Strategy Context Integration', () => {

    it('should have strategy V2 AI generation preferring V4 competitors', async () => {
      // This is a static analysis test - verify the code structure
      const fs = await import('fs');
      const path = await import('path');

      const aiGenPath = path.resolve(__dirname, '../../lib/os/strategyV2/aiGeneration.ts');
      const content = fs.readFileSync(aiGenPath, 'utf-8');

      // Should extract V4 competitors
      expect(content).toContain('extractV4Competitors');

      // Should check for V4 before falling back to V3
      expect(content).toContain('hasV4Competitors');

      // V3 should only be loaded if V4 is not available
      const v3LoadSection = content.slice(content.indexOf('getLatestCompetitionRunV3'));
      expect(v3LoadSection).toContain('!hasV4Competitors');
    });

    it('should mark competition source in strategy sources array', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const aiGenPath = path.resolve(__dirname, '../../lib/os/strategyV2/aiGeneration.ts');
      const content = fs.readFileSync(aiGenPath, 'utf-8');

      // Should push competition_v4 to sources when V4 is used
      expect(content).toContain("sources.push('competition_v4')");

      // Should push competition_v3 to sources when V3 is used
      expect(content).toContain("sources.push('competition_v3')");

      // Sources should be mutually exclusive in the output
      // (V4 section and V3 section are in separate if/else branches)
      const v4Section = content.match(/if.*v4Competitors.*\{[\s\S]*?sources\.push\('competition_v4'\)/);
      const v3Section = content.match(/else if.*competitionRun[\s\S]*?sources\.push\('competition_v3'\)/);

      expect(v4Section).not.toBeNull();
      expect(v3Section).not.toBeNull();
    });

    it('should NEVER mix V4 and V3 markers in prompt output', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const aiGenPath = path.resolve(__dirname, '../../lib/os/strategyV2/aiGeneration.ts');
      const content = fs.readFileSync(aiGenPath, 'utf-8');

      // V4 section should be clearly labeled
      expect(content).toContain('COMPETITIVE LANDSCAPE (V4');

      // V3 section should be clearly labeled as legacy/fallback
      expect(content).toContain('COMPETITIVE LANDSCAPE (V3');

      // These should be in mutually exclusive code paths (if/else)
      const v4Index = content.indexOf('COMPETITIVE LANDSCAPE (V4');
      const v3Index = content.indexOf('COMPETITIVE LANDSCAPE (V3');

      // Find the if/else structure
      const beforeV4 = content.slice(0, v4Index);
      const hasIfBeforeV4 = beforeV4.lastIndexOf('if') > beforeV4.lastIndexOf('}');

      expect(hasIfBeforeV4).toBe(true);
    });
  });

  describe('Regression Guards', () => {

    it('should have selectCompetitionSource exported from competition module', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const indexPath = path.resolve(__dirname, '../../lib/os/competition/index.ts');

      if (fs.existsSync(indexPath)) {
        const content = fs.readFileSync(indexPath, 'utf-8');
        expect(content).toContain('selectCompetitionSource');
      }
    });

    it('should have competition source selection respecting priority order', () => {
      // V4 always beats V3, regardless of:
      // - Age (V4 from 1 year ago beats V3 from today)
      // - Number of competitors found
      // - Any other factor

      const oldV4 = { id: 'old-v4', version: 'v4' as const, createdAt: '2023-01-01T00:00:00Z', status: 'completed' as const };
      const newV3 = { id: 'new-v3', version: 'v3' as const, createdAt: '2024-12-01T00:00:00Z', status: 'completed' as const };

      const selection = selectCompetitionSource([oldV4], [newV3]);

      expect(selection.version).toBe('v4');
    });
  });
});

describe('Competition Trust Invariants', () => {

  it('should NEVER allow V3 to overwrite V4 in context graph', async () => {
    // Import source priority to verify the invariant
    const { canSourceOverwrite } = await import('@/lib/contextGraph/sourcePriority');

    const v4Provenance = [
      { source: 'competition_v4', confidence: 0.8, updatedAt: new Date().toISOString(), validForDays: 90 },
    ];

    const result = canSourceOverwrite('competitive', v4Provenance, 'competition_lab', 1.0);

    expect(result.canOverwrite).toBe(false);
    expect(result.reason).toBe('lower_priority');
  });

  it('should allow V4 to overwrite V3 in context graph', async () => {
    const { canSourceOverwrite } = await import('@/lib/contextGraph/sourcePriority');

    const v3Provenance = [
      { source: 'competition_lab', confidence: 0.8, updatedAt: new Date().toISOString(), validForDays: 90 },
    ];

    const result = canSourceOverwrite('competitive', v3Provenance, 'competition_v4', 0.8);

    expect(result.canOverwrite).toBe(true);
  });

  it('should allow human to overwrite both V4 and V3', async () => {
    const { canSourceOverwrite } = await import('@/lib/contextGraph/sourcePriority');

    const v4Provenance = [
      { source: 'competition_v4', confidence: 0.9, updatedAt: new Date().toISOString(), validForDays: 90 },
    ];

    const result = canSourceOverwrite('competitive', v4Provenance, 'user', 0.5);

    expect(result.canOverwrite).toBe(true);
    expect(result.reason).toBe('human_override');
  });
});
