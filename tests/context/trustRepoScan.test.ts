// tests/context/trustRepoScan.test.ts
// Advanced Repo Scan Tests for Trust System (Pure Node.js - No Shell)
//
// These tests scan the codebase to detect patterns that could bypass
// the trust model. They are designed to catch regressions before they
// reach production.

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT_DIR = path.resolve(__dirname, '../..');

// ============================================================================
// ALLOWLISTS
// ============================================================================

/**
 * Files allowed to use setField/setDomainFields with automated sources
 * These are governance infrastructure files that enforce rules internally
 */
const SETTER_ALLOWLIST = [
  // Core governance infrastructure
  'lib/contextGraph/governance/',
  'lib/contextGraph/importers/',
  'lib/os/writeContract/',
  'lib/os/contextV2/writeContractIntegration.ts',
  // Lab writers that use canSourceOverwrite internally
  'lib/contextGraph/websiteLabWriter.ts',
  'lib/contextGraph/mediaLabWriter.ts',
  'lib/contextGraph/brandLabWriter.ts',
  'lib/contextGraph/audienceLabWriter.ts',
  'lib/contextGraph/competitorWriter.ts',
  'lib/contextGraph/baseline.ts',
  // User-initiated endpoints (these use human sources)
  'app/api/context-graph/[companyId]/edit/',
  'app/api/os/context/update/',
  'app/api/setup/',
  // Tests and types
  'tests/',
  '.test.ts',
  'lib/types/',
  'lib/contextGraph/types.ts',
];

/**
 * Files allowed to use force: true
 * This is extremely limited - only explicit user actions
 */
const FORCE_ALLOWLIST = [
  // User explicitly forcing an update
  'app/api/context-graph/[companyId]/edit/',
  'app/api/os/context/force-update/',
  // User-initiated competitor marking (explicit user action)
  'app/api/os/companies/[companyId]/competition/mark-invalid/',
  'app/api/os/companies/[companyId]/competition/unmark-invalid/',
  // User-initiated company creation (force-runs labs for new company onboarding)
  'app/api/os/companies/create/',
  // V4 materialization: user-confirmed facts bypass priority (explicit user approval)
  'lib/contextGraph/materializeV4.ts',
  // Governance infrastructure (can force for emergency fixes)
  'lib/contextGraph/governance/pipeline.ts',
  // Tests
  'tests/',
  '.test.ts',
  // Type definitions
  'lib/types/',
];

/**
 * Files that are NOT AI routes but may reference updateContextDirect
 */
const UPDATE_DIRECT_ALLOWLIST = [
  // Write contract infrastructure
  'lib/os/contextV2/writeContractIntegration.ts',
  'lib/os/writeContract/',
  // User-initiated endpoints
  'app/api/context-graph/[companyId]/edit/',
  'app/api/os/context/update/',
  'app/api/setup/',
  // Tests
  'tests/',
  '.test.ts',
];

/**
 * Patterns that identify AI routes (should NEVER directly update)
 */
const AI_ROUTE_PATTERNS = [
  'app/api/os/context/ai',
  'app/api/os/strategy/ai',
  'app/api/os/context/generate',
  'app/api/os/strategy/generate',
  '/ai-assist/',
  '/ai-propose/',
];

/**
 * Canonical update functions that AI should NEVER call directly
 */
const CANONICAL_UPDATERS = [
  'updateCompanyContext(',
  'saveContextGraph(',
  'updateContextDirect(',
  'setField(',
  'setDomainFields(',
  'setFieldUntyped(',
  'setDomainFieldsWithResult(',
];

// ============================================================================
// Helper Functions (Pure Node.js - No Shell)
// ============================================================================

/**
 * Recursively get all TypeScript files in a directory
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
 * Read file content safely
 */
function readFileSafe(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

function isInAllowlist(filePath: string, allowlist: string[]): boolean {
  const relativePath = filePath.replace(ROOT_DIR + '/', '');
  return allowlist.some(allowed => relativePath.includes(allowed));
}

function isAiRoute(filePath: string): boolean {
  const relativePath = filePath.replace(ROOT_DIR + '/', '').toLowerCase();
  return AI_ROUTE_PATTERNS.some(pattern => relativePath.includes(pattern.toLowerCase()));
}

// ============================================================================
// Tests
// ============================================================================

describe('Trust Repo Scan: Forbidden Pattern Detection', () => {

  describe('Setter functions with automated sources', () => {
    const AUTOMATED_SOURCES = [
      'ai', 'brain', 'inferred', 'fcb',
      'website_lab', 'brand_lab', 'audience_lab', 'media_lab',
      'seo_lab', 'content_lab', 'competition_v4', 'competition_lab',
      'gap_ia', 'gap_full', 'gap_heavy', 'analytics_ga4', 'external_enrichment',
    ];

    it('should NOT have setField/setDomainFields with automated sources outside allowlist', { timeout: 60000 }, () => {
      const violations: string[] = [];

      // Get all TypeScript files
      const files = getTypeScriptFiles(ROOT_DIR);

      // Setter patterns to look for
      const setterPatterns = [
        /setField\s*\(/,
        /setDomainFields\s*\(/,
        /setFieldUntyped\s*\(/,
        /setDomainFieldsWithResult\s*\(/,
      ];

      for (const file of files) {
        if (isInAllowlist(file, SETTER_ALLOWLIST)) continue;

        const content = readFileSafe(file);
        if (!content) continue;

        // Check for setter patterns
        for (const pattern of setterPatterns) {
          if (!pattern.test(content)) continue;

          const matches = searchInFile(file, pattern);

          for (const match of matches) {
            // Get context around the match (10 lines before, 15 lines after)
            const lines = content.split('\n');
            const startLine = Math.max(0, match.line - 6);
            const endLine = Math.min(lines.length - 1, match.line + 14);
            const context = lines.slice(startLine, endLine).join('\n');

            // Check if automated source is being used
            for (const source of AUTOMATED_SOURCES) {
              const sourcePattern = new RegExp(`source:\\s*['"]${source}['"]`);
              if (sourcePattern.test(context)) {
                const relativePath = file.replace(ROOT_DIR + '/', '');
                violations.push(`${relativePath}:${match.line} - ${pattern.source} with source: '${source}'`);
                break;
              }
            }
          }
        }
      }

      if (violations.length > 0) {
        const message = [
          '',
          '🚨 TRUST VIOLATION: Setter functions used with automated sources!',
          '',
          'The following locations use setField/setDomainFields with AI/lab sources',
          'outside of allowlisted governance infrastructure.',
          '',
          'This could allow AI to bypass the proposal flow.',
          '',
          'Violations:',
          ...violations.map(v => `  - ${v}`),
          '',
          'To fix:',
          '1. Use computeProposalForAI() or governedLabWrite() instead',
          '2. Or add file to SETTER_ALLOWLIST if this is governance infra',
          '',
        ].join('\n');

        expect(violations, message).toEqual([]);
      }
    });
  });

  describe('force: true usage', () => {
    it('should NOT use force: true outside explicitly allowlisted files', { timeout: 60000 }, () => {
      const violations: string[] = [];

      const files = getTypeScriptFiles(ROOT_DIR);

      for (const file of files) {
        if (isInAllowlist(file, FORCE_ALLOWLIST)) continue;

        const content = readFileSafe(file);
        if (!content) continue;

        const matches = searchInFile(file, /force:\s*true/);

        // Filter to only context-related force usages
        for (const match of matches) {
          // Check context around the match to see if it's context-graph related
          const lines = content.split('\n');
          const startLine = Math.max(0, match.line - 11);
          const endLine = Math.min(lines.length - 1, match.line + 4);
          const context = lines.slice(startLine, endLine).join('\n').toLowerCase();

          // Only flag if it appears to be related to context/graph operations
          if (
            context.includes('contextgraph') ||
            context.includes('setfield') ||
            context.includes('updatecontext') ||
            context.includes('provenance') ||
            context.includes('cansourceoverwrite')
          ) {
            const relativePath = file.replace(ROOT_DIR + '/', '');
            violations.push(`${relativePath}:${match.line} - ${match.content}`);
          }
        }
      }

      if (violations.length > 0) {
        const message = [
          '',
          '🚨 TRUST VIOLATION: force: true used outside allowlisted files!',
          '',
          'Using force: true bypasses source priority checks.',
          'This is only allowed in explicit user-initiated endpoints.',
          '',
          'Violations:',
          ...violations.map(v => `  - ${v}`),
          '',
          'To fix:',
          '1. Remove force: true and use proper source priority',
          '2. Or add file to FORCE_ALLOWLIST if truly user-initiated',
          '',
        ].join('\n');

        expect(violations, message).toEqual([]);
      }
    });
  });

  describe('AI routes and canonical updaters', () => {
    it('should NOT have canonical updaters in AI routes', { timeout: 60000 }, () => {
      const violations: string[] = [];

      const files = getTypeScriptFiles(ROOT_DIR);

      for (const file of files) {
        // Only check AI routes
        if (!isAiRoute(file)) continue;

        const content = readFileSafe(file);
        if (!content) continue;

        for (const updater of CANONICAL_UPDATERS) {
          // Check if this updater is called (not just imported or in comments)
          const escapedUpdater = updater.replace('(', '\\(');
          const pattern = new RegExp(`^(?!.*\\/\\/).*${escapedUpdater}`, 'gm');
          const matches = content.match(pattern);

          if (matches && matches.length > 0) {
            // Additional check: is it inside computeProposalForAI or similar?
            const isInsideProposal = /computeProposalForAI|generateContextProposal|governedLabWrite/.test(content);

            // Check if the updater is being CALLED (not just referenced as a type or import)
            const isActualCall = matches.some(m => {
              // Filter out import statements and type references
              return !m.includes('import') && !m.includes('type ') && !m.includes(': typeof');
            });

            if (isActualCall && !isInsideProposal) {
              const relativePath = file.replace(ROOT_DIR + '/', '');
              violations.push(`${relativePath} - calls ${updater}`);
            }
          }
        }
      }

      if (violations.length > 0) {
        const message = [
          '',
          '🚨 TRUST VIOLATION: AI route calls canonical updater directly!',
          '',
          'AI routes must use proposal flow, not direct updates.',
          '',
          'Violations:',
          ...violations.map(v => `  - ${v}`),
          '',
          'To fix:',
          '1. Use computeProposalForAI() instead of direct updates',
          '2. Return proposal for user approval',
          '3. Set requiresUserApproval: true in response',
          '',
        ].join('\n');

        expect(violations, message).toEqual([]);
      }
    });

    it('should have AI-assist route returning requiresUserApproval: true', { timeout: 30000 }, () => {
      const aiAssistPath = path.join(ROOT_DIR, 'app/api/os/context/ai-assist/route.ts');

      if (!fs.existsSync(aiAssistPath)) {
        // File doesn't exist - that's fine, skip test
        return;
      }

      const content = readFileSafe(aiAssistPath);

      // Check for requiresUserApproval: true
      expect(content).toContain('requiresUserApproval: true');

      // Check for computeProposalForAI usage
      expect(content).toContain('computeProposalForAI');

      // Check it does NOT contain direct updateCompanyContext with source: 'ai'
      const hasDirectAiUpdate = /updateCompanyContext[\s\S]*?\([^)]*source:\s*['"]ai['"]/.test(content);
      expect(hasDirectAiUpdate).toBe(false);
    });
  });

  describe('Import safety', () => {
    it('should NOT import canonical updaters in AI route files', { timeout: 60000 }, () => {
      const violations: string[] = [];

      // Specifically dangerous imports for AI routes
      const dangerousImports = [
        'updateCompanyContext',
        'saveContextGraph',
        'updateContextDirect',
      ];

      const files = getTypeScriptFiles(ROOT_DIR);

      for (const file of files) {
        if (!isAiRoute(file)) continue;

        const content = readFileSafe(file);
        if (!content) continue;

        for (const importName of dangerousImports) {
          // Check if imported AND used (not just available)
          const importPattern = new RegExp(`import.*\\b${importName}\\b.*from`, 'g');
          const usagePattern = new RegExp(`(?<!import.*)\\b${importName}\\s*\\(`, 'gm');

          if (importPattern.test(content) && usagePattern.test(content)) {
            const relativePath = file.replace(ROOT_DIR + '/', '');
            violations.push(`${relativePath} - imports and uses ${importName}`);
          }
        }
      }

      if (violations.length > 0) {
        const message = [
          '',
          '🚨 TRUST VIOLATION: AI route imports and uses dangerous function!',
          '',
          'AI routes should use proposal flow infrastructure only.',
          '',
          'Violations:',
          ...violations.map(v => `  - ${v}`),
          '',
        ].join('\n');

        expect(violations, message).toEqual([]);
      }
    });
  });
});

describe('Trust Repo Scan: Source Priority Integrity', () => {

  it('should have HUMAN_SOURCES containing exactly user, manual, qbr, strategy', () => {
    const sourcePriorityPath = path.join(ROOT_DIR, 'lib/contextGraph/sourcePriority.ts');
    const content = readFileSafe(sourcePriorityPath);

    // Extract HUMAN_SOURCES definition
    expect(content).toContain("'user'");
    expect(content).toContain("'manual'");
    expect(content).toContain("'qbr'");
    expect(content).toContain("'strategy'");
    expect(content).toContain('HUMAN_SOURCES');
  });

  it('should have canSourceOverwrite checking human override before priority', () => {
    const sourcePriorityPath = path.join(ROOT_DIR, 'lib/contextGraph/sourcePriority.ts');
    const content = readFileSafe(sourcePriorityPath);

    // Find the function
    const functionStart = content.indexOf('function canSourceOverwrite');
    expect(functionStart).toBeGreaterThan(-1);

    const functionContent = content.slice(functionStart, functionStart + 3000);

    // Human check must come before priority comparison
    const humanCheckIndex = functionContent.indexOf('existingIsHuman');
    const priorityIndex = functionContent.indexOf('getSourcePriorityForDomain');

    expect(humanCheckIndex).toBeGreaterThan(-1);
    expect(priorityIndex).toBeGreaterThan(-1);
    expect(humanCheckIndex).toBeLessThan(priorityIndex);
  });

  it('should NOT have any new human source additions without test update', () => {
    const sourcePriorityPath = path.join(ROOT_DIR, 'lib/contextGraph/sourcePriority.ts');
    const content = readFileSafe(sourcePriorityPath);

    // Count human sources in the Set definition
    const humanSourcesMatch = content.match(/new Set\(\[[^\]]+\]\)/);
    if (humanSourcesMatch) {
      const setContent = humanSourcesMatch[0];
      const sources = setContent.match(/'[^']+'/g) || [];

      // Should be exactly 4 human sources
      expect(sources.length).toBe(4);
      expect(sources).toContain("'user'");
      expect(sources).toContain("'manual'");
      expect(sources).toContain("'qbr'");
      expect(sources).toContain("'strategy'");
    }
  });
});
