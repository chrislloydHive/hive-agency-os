// tests/context/trustRegression.test.ts
// Trust Regression Tests
//
// Verifies that AI and Lab sources CANNOT overwrite human-confirmed data.
// These tests are critical for maintaining trust in the system.

import { describe, it, expect } from 'vitest';
import {
  canSourceOverwrite,
  isHumanSource,
  HUMAN_SOURCES,
  getSourcePriorityForDomain,
} from '@/lib/contextGraph/sourcePriority';
import type { ProvenanceTag } from '@/lib/contextGraph/types';

describe('Trust Regression: Human Override Protection', () => {
  // Helper to create a provenance tag
  function createProvenance(
    source: string,
    confidence: number = 0.9
  ): ProvenanceTag {
    return {
      source,
      confidence,
      updatedAt: new Date().toISOString(),
      validForDays: 90,
    };
  }

  describe('Human Source Identification', () => {
    it('should identify all human sources correctly', () => {
      expect(isHumanSource('user')).toBe(true);
      expect(isHumanSource('manual')).toBe(true);
      expect(isHumanSource('qbr')).toBe(true);
      expect(isHumanSource('strategy')).toBe(true);
    });

    it('should NOT identify AI/lab sources as human', () => {
      expect(isHumanSource('brain')).toBe(false);
      expect(isHumanSource('inferred')).toBe(false);
      expect(isHumanSource('website_lab')).toBe(false);
      expect(isHumanSource('brand_lab')).toBe(false);
      expect(isHumanSource('competition_v4')).toBe(false);
      expect(isHumanSource('gap_ia')).toBe(false);
    });

    it('should have exactly 4 human sources', () => {
      expect(HUMAN_SOURCES.size).toBe(4);
    });
  });

  describe('AI Cannot Overwrite Human Data', () => {
    const humanSources = ['user', 'manual', 'qbr', 'strategy'];
    const aiSources = ['brain', 'inferred', 'fcb'];
    const labSources = [
      'website_lab',
      'brand_lab',
      'audience_lab',
      'competition_v4',
      'gap_ia',
      'gap_full',
      'gap_heavy',
    ];
    const domains = [
      'identity',
      'brand',
      'audience',
      'competitive',
      'objectives',
    ] as const;

    for (const humanSource of humanSources) {
      for (const aiSource of aiSources) {
        it(`AI (${aiSource}) CANNOT overwrite human (${humanSource}) in any domain`, () => {
          for (const domain of domains) {
            const humanProvenance = [createProvenance(humanSource)];

            const result = canSourceOverwrite(
              domain,
              humanProvenance,
              aiSource,
              1.0 // Even with perfect confidence
            );

            expect(result.canOverwrite).toBe(false);
            expect(result.reason).toBe('human_override');
          }
        });
      }

      for (const labSource of labSources) {
        it(`Lab (${labSource}) CANNOT overwrite human (${humanSource}) in any domain`, () => {
          for (const domain of domains) {
            const humanProvenance = [createProvenance(humanSource)];

            const result = canSourceOverwrite(
              domain,
              humanProvenance,
              labSource,
              1.0 // Even with perfect confidence
            );

            expect(result.canOverwrite).toBe(false);
            expect(result.reason).toBe('human_override');
          }
        });
      }
    }
  });

  describe('Human CAN Overwrite Anything', () => {
    const aiSources = ['brain', 'inferred', 'website_lab', 'competition_v4'];

    for (const aiSource of aiSources) {
      it(`Human (user) CAN overwrite AI (${aiSource})`, () => {
        const aiProvenance = [createProvenance(aiSource)];

        const result = canSourceOverwrite('brand', aiProvenance, 'user', 0.5);

        expect(result.canOverwrite).toBe(true);
        expect(result.reason).toBe('human_override');
      });
    }

    it('Human CAN overwrite another human source', () => {
      const existingProvenance = [createProvenance('qbr')];

      const result = canSourceOverwrite(
        'identity',
        existingProvenance,
        'user',
        0.8
      );

      expect(result.canOverwrite).toBe(true);
      expect(result.reason).toBe('human_override');
    });
  });

  describe('Competition V4 > V3 Priority', () => {
    it('V4 should have higher priority than V3 in competitive domain', () => {
      const v4Priority = getSourcePriorityForDomain(
        'competitive',
        'competition_v4'
      );
      const v3Priority = getSourcePriorityForDomain(
        'competitive',
        'competition_lab'
      );

      expect(v4Priority).toBeGreaterThan(v3Priority);
    });

    it('V4 CAN overwrite V3 data', () => {
      const v3Provenance = [createProvenance('competition_lab')];

      const result = canSourceOverwrite(
        'competitive',
        v3Provenance,
        'competition_v4',
        0.8
      );

      expect(result.canOverwrite).toBe(true);
      expect(result.reason).toBe('higher_priority');
    });

    it('V3 CANNOT overwrite V4 data', () => {
      const v4Provenance = [createProvenance('competition_v4')];

      const result = canSourceOverwrite(
        'competitive',
        v4Provenance,
        'competition_lab',
        0.8
      );

      expect(result.canOverwrite).toBe(false);
      expect(result.reason).toBe('lower_priority');
    });

    it('Human CAN overwrite V4 data', () => {
      const v4Provenance = [createProvenance('competition_v4')];

      const result = canSourceOverwrite(
        'competitive',
        v4Provenance,
        'user',
        0.8
      );

      expect(result.canOverwrite).toBe(true);
      expect(result.reason).toBe('human_override');
    });
  });

  describe('Empty Provenance Edge Cases', () => {
    it('Any source can write to empty field', () => {
      const result = canSourceOverwrite('brand', [], 'brain', 0.5);

      expect(result.canOverwrite).toBe(true);
    });

    it('Human can write to empty field', () => {
      const result = canSourceOverwrite('brand', [], 'user', 0.5);

      expect(result.canOverwrite).toBe(true);
    });
  });

  describe('Priority Score Invariants', () => {
    it('Human sources should have MAX priority', () => {
      const userPriority = getSourcePriorityForDomain('brand', 'user');
      const labPriority = getSourcePriorityForDomain('brand', 'brand_lab');

      expect(userPriority).toBe(Number.MAX_SAFE_INTEGER);
      expect(labPriority).toBeLessThan(Number.MAX_SAFE_INTEGER);
    });

    it('Unknown sources should have lowest priority', () => {
      const unknownPriority = getSourcePriorityForDomain(
        'brand',
        'totally_unknown_source'
      );

      expect(unknownPriority).toBe(0);
    });
  });
});

describe('Trust Regression: Doctrine Compliance', () => {
  describe('AI Proposes, Humans Decide', () => {
    it('should block all AI sources from overwriting human data', () => {
      // This is the core trust invariant
      const humanProvenance = [
        {
          source: 'user',
          confidence: 0.9,
          updatedAt: new Date().toISOString(),
          validForDays: 90,
        },
      ];

      // Try every possible automated source
      const automatedSources = [
        'brain',
        'inferred',
        'fcb',
        'website_lab',
        'brand_lab',
        'audience_lab',
        'media_lab',
        'seo_lab',
        'content_lab',
        'competition_v4',
        'competition_lab',
        'gap_ia',
        'gap_full',
        'gap_heavy',
        'analytics_ga4',
        'external_enrichment',
      ];

      for (const source of automatedSources) {
        const result = canSourceOverwrite('brand', humanProvenance, source, 1.0);
        expect(result.canOverwrite).toBe(false);
        if (result.canOverwrite) {
          throw new Error(
            `TRUST VIOLATION: ${source} was able to overwrite human data!`
          );
        }
      }
    });
  });
});

// ============================================================================
// FORBIDDEN PATTERN GUARDRAIL (Pure Node.js - No Shell)
// ============================================================================
// This test scans the codebase to detect any AI-to-canonical write paths
// that bypass the proposal flow. If this test fails, someone has introduced
// a trust violation that must be fixed before merging.

import * as fs from 'fs';
import * as path from 'path';

describe('Trust Guardrail: Forbidden AI Write Patterns', () => {
  const ROOT_DIR = path.resolve(__dirname, '../..');

  // Files that are ALLOWED to use these patterns (proposal flow, tests, types)
  const ALLOWLIST = [
    // Proposal flow infrastructure
    'lib/os/writeContract/',
    'lib/contextGraph/governance/governedLabWriter.ts',
    'lib/contextGraph/governance/pipeline.ts',
    'lib/os/contextV2/writeContractIntegration.ts',
    // User-initiated write endpoints
    'app/api/context-graph/[companyId]/edit/route.ts',
    'app/api/os/context/update/route.ts',
    'app/api/setup/',
    // Lab writers (use canSourceOverwrite internally)
    'lib/contextGraph/importers/',
    'lib/contextGraph/websiteLabWriter.ts',
    'lib/contextGraph/mediaLabWriter.ts',
    'lib/contextGraph/brandLabWriter.ts',
    // Test files
    'tests/',
    '.test.ts',
    // Type definitions
    'lib/types/',
    'lib/contextGraph/types.ts',
    'lib/contextGraph/sourcePriority.ts',
    // QBR narrative blocks (presentation layer, not context graph writes)
    'lib/qbr/',
    // Story components (presentation layer)
    'components/story/',
  ];

  /**
   * Recursively get all TypeScript files in a directory (pure Node.js)
   */
  function getTypeScriptFiles(dir: string, files: string[] = []): string[] {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          // Skip node_modules and .next
          if (entry.name !== 'node_modules' && entry.name !== '.next') {
            getTypeScriptFiles(fullPath, files);
          }
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          files.push(fullPath);
        }
      }
    } catch {
      // Ignore permission errors
    }
    return files;
  }

  /**
   * Search for a pattern in file content and return matches with line numbers
   */
  function searchInFile(filePath: string, pattern: RegExp): { line: number; content: string }[] {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const matches: { line: number; content: string }[] = [];

      lines.forEach((line, index) => {
        if (pattern.test(line)) {
          matches.push({ line: index + 1, content: line.trim() });
        }
      });

      return matches;
    } catch {
      return [];
    }
  }

  /**
   * Check if a file path is in the allowlist
   */
  function isAllowlisted(filePath: string): boolean {
    const relativePath = filePath.replace(ROOT_DIR + '/', '');
    return ALLOWLIST.some(allowed => relativePath.includes(allowed));
  }

  /**
   * Read file content safely
   */
  function readFileSafe(filePath: string): string {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch {
      return '';
    }
  }

  describe('Direct AI provenance writes', () => {
    it('should NOT have direct writes with AI-ish sources outside proposal flow', { timeout: 60000 }, () => {
      const violations: string[] = [];

      // Pattern to find source: 'ai' or source: "ai"
      const aiSourcePattern = /source:\s*['"]ai['"]/;

      const files = getTypeScriptFiles(ROOT_DIR);

      for (const file of files) {
        if (isAllowlisted(file)) continue;

        const content = readFileSafe(file);
        if (!content) continue;

        // Check if file has AI source pattern
        if (aiSourcePattern.test(content)) {
          // Further check: is it in a context-writing context?
          const isContextWrite =
            content.includes('updateCompanyContext') ||
            content.includes('saveContextGraph') ||
            content.includes('setField') ||
            content.includes('setDomainFields');

          if (isContextWrite) {
            const relativePath = file.replace(ROOT_DIR + '/', '');
            const matches = searchInFile(file, aiSourcePattern);
            for (const match of matches) {
              violations.push(`${relativePath}:${match.line} - ${match.content}`);
            }
          }
        }
      }

      if (violations.length > 0) {
        const message = [
          '',
          '🚨 TRUST VIOLATION DETECTED: Direct AI writes to canonical context!',
          '',
          'The following code paths write AI-sourced data without going through',
          'the proposal flow. This violates the "AI Proposes, Humans Decide" doctrine.',
          '',
          'Violations:',
          ...violations.map((v) => `  - ${v}`),
          '',
          'To fix:',
          '1. Replace direct writes with computeProposalForAI() / generateContextProposal()',
          '2. Return proposal for user approval instead of auto-applying',
          '3. If this is intentional, add the file to ALLOWLIST in this test',
          '',
        ].join('\n');

        expect(violations).toEqual([]);
        throw new Error(message);
      }
    });

    it('should NOT have updateContextDirect calls in AI routes', { timeout: 60000 }, () => {
      const aiRoutePatterns = [
        'app/api/os/context/ai',
        'app/api/os/strategy/ai',
        'lib/os/context',
        'lib/os/strategy',
      ];

      const violations: string[] = [];

      const files = getTypeScriptFiles(ROOT_DIR);

      for (const file of files) {
        const relativePath = file.replace(ROOT_DIR + '/', '').toLowerCase();

        // Check if this is an AI-related file
        const isAiFile = aiRoutePatterns.some(p => relativePath.includes(p.toLowerCase()));
        if (!isAiFile) continue;

        // Also check if filename contains 'ai'
        const isAiRoute = relativePath.includes('/ai') || relativePath.includes('ai-');
        if (!isAiRoute) continue;

        const content = readFileSafe(file);
        if (!content) continue;

        // Check for updateContextDirect
        if (content.includes('updateContextDirect')) {
          const matches = searchInFile(file, /updateContextDirect/);
          for (const match of matches) {
            violations.push(`${relativePath}:${match.line} - ${match.content}`);
          }
        }
      }

      if (violations.length > 0) {
        const message = [
          '',
          '🚨 TRUST VIOLATION: updateContextDirect() called in AI route!',
          '',
          'AI routes must use proposal flow, not direct writes.',
          '',
          'Violations:',
          ...violations.map((v) => `  - ${v}`),
          '',
        ].join('\n');

        expect(violations).toEqual([]);
        throw new Error(message);
      }
    });
  });

  describe('Protected module integrity', () => {
    it('should have HUMAN_SOURCES defined correctly in sourcePriority.ts', () => {
      const filePath = path.join(ROOT_DIR, 'lib/contextGraph/sourcePriority.ts');
      const fileContent = readFileSafe(filePath);

      // Verify HUMAN_SOURCES is exported and contains expected sources
      expect(fileContent).toContain('HUMAN_SOURCES');
      expect(fileContent).toContain("'user'");
      expect(fileContent).toContain("'manual'");
      expect(fileContent).toContain("'qbr'");
      expect(fileContent).toContain("'strategy'");
    });

    it('should have canSourceOverwrite checking human override FIRST', () => {
      const filePath = path.join(ROOT_DIR, 'lib/contextGraph/sourcePriority.ts');
      const fileContent = readFileSafe(filePath);

      // Find the canSourceOverwrite function and verify human check comes first
      const functionStart = fileContent.indexOf('function canSourceOverwrite');
      expect(functionStart).toBeGreaterThan(-1);

      const functionContent = fileContent.slice(functionStart, functionStart + 2000);

      // Verify human override check happens before priority comparison
      const humanOverrideIndex = functionContent.indexOf('existingIsHuman && !newIsHuman');
      const priorityCompareIndex = functionContent.indexOf('getSourcePriorityForDomain(domain, existingSource)');

      expect(humanOverrideIndex).toBeGreaterThan(-1);
      expect(priorityCompareIndex).toBeGreaterThan(-1);
      expect(humanOverrideIndex).toBeLessThan(priorityCompareIndex);
    });
  });

  describe('Proposal flow enforcement', () => {
    it('should have computeProposalForAI exported from writeContract', () => {
      const filePath = path.join(ROOT_DIR, 'lib/os/writeContract/index.ts');
      const content = readFileSafe(filePath);

      expect(content).toContain('computeProposalForAI');
    });

    // Note: generateContextProposal test moved to tests/wip/
    // (depends on contextV2 module which is not yet implemented)
  });
});
