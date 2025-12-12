// tests/context/aiRouteInvariants.test.ts
// AI Route Invariant Tests
//
// Ensures that AI endpoints follow the "AI Proposes, Humans Decide" doctrine:
// - AI endpoints return proposals, not auto-applied changes
// - requiresUserApproval flag is always set
// - No direct canonical updates in AI routes

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT_DIR = path.resolve(__dirname, '../..');

// ============================================================================
// AI Route Definitions
// ============================================================================

interface AiRouteSpec {
  /** Path to the route file relative to ROOT_DIR */
  path: string;
  /** Description of the route */
  description: string;
  /** Expected behavior patterns */
  mustHave: string[];
  /** Forbidden patterns */
  mustNotHave: string[];
}

const AI_ROUTES: AiRouteSpec[] = [
  {
    path: 'app/api/os/context/ai-assist/route.ts',
    description: 'AI Context Assist - generates context suggestions',
    mustHave: [
      'requiresUserApproval: true',
      'computeProposalForAI',
    ],
    mustNotHave: [
      'updateCompanyContext(',
      'saveContextGraph(',
      'updateContextDirect(',
    ],
  },
  {
    path: 'app/api/os/strategy/ai-propose/route.ts',
    description: 'AI Strategy Proposal - generates strategy suggestions',
    mustHave: [
      // Strategy routes return proposals
    ],
    mustNotHave: [
      'saveStrategy(',
      'updateStrategy(',
    ],
  },
];

// ============================================================================
// Test Helpers
// ============================================================================

function getRouteContent(routePath: string): string | null {
  const fullPath = path.join(ROOT_DIR, routePath);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  return fs.readFileSync(fullPath, 'utf-8');
}

function containsPattern(content: string, pattern: string): boolean {
  // Handle both exact matches and regex-like patterns
  if (pattern.includes('(')) {
    // Escape the parenthesis for regex
    const escaped = pattern.replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    return new RegExp(escaped).test(content);
  }
  return content.includes(pattern);
}

function findPatternOccurrences(content: string, pattern: string): { line: number; text: string }[] {
  const lines = content.split('\n');
  const occurrences: { line: number; text: string }[] = [];

  const escaped = pattern.replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const regex = new RegExp(escaped);

  lines.forEach((line, index) => {
    if (regex.test(line) && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
      occurrences.push({ line: index + 1, text: line.trim() });
    }
  });

  return occurrences;
}

// ============================================================================
// Tests
// ============================================================================

describe('AI Route Invariants: Proposal Flow Compliance', () => {

  for (const route of AI_ROUTES) {
    describe(`${route.description} (${route.path})`, () => {
      const content = getRouteContent(route.path);

      if (content === null) {
        it.skip(`route file does not exist: ${route.path}`, () => {});
        return;
      }

      for (const mustHave of route.mustHave) {
        it(`MUST have: ${mustHave}`, () => {
          const hasPattern = containsPattern(content, mustHave);
          expect(hasPattern, `Route should contain: ${mustHave}`).toBe(true);
        });
      }

      for (const mustNotHave of route.mustNotHave) {
        it(`MUST NOT have: ${mustNotHave}`, () => {
          const occurrences = findPatternOccurrences(content, mustNotHave);

          if (occurrences.length > 0) {
            const message = [
              `Route contains forbidden pattern: ${mustNotHave}`,
              '',
              'Occurrences:',
              ...occurrences.map(o => `  Line ${o.line}: ${o.text}`),
              '',
              'AI routes must use proposal flow, not direct updates.',
            ].join('\n');

            expect(occurrences, message).toEqual([]);
          }
        });
      }
    });
  }
});

describe('AI Route Invariants: Response Structure', () => {

  it('ai-assist route should return proposal object', () => {
    const content = getRouteContent('app/api/os/context/ai-assist/route.ts');
    if (!content) return;

    // Should return a JSON response with proposal
    expect(content).toContain('NextResponse.json');
    expect(content).toContain('proposal:');
  });

  it('ai-assist route should NOT auto-apply changes', () => {
    const content = getRouteContent('app/api/os/context/ai-assist/route.ts');
    if (!content) return;

    // Should NOT call any function that directly saves context
    const directSavePatterns = [
      /await\s+updateCompanyContext\(/,
      /await\s+saveContextGraph\(/,
      /await\s+updateContextDirect\(/,
      /\.save\(\)/,
    ];

    for (const pattern of directSavePatterns) {
      const matches = content.match(pattern);
      if (matches) {
        // Check if it's in a comment
        const lines = content.split('\n');
        const hasActiveMatch = matches.some(match => {
          const lineIndex = lines.findIndex(l => l.includes(match));
          if (lineIndex === -1) return false;
          const line = lines[lineIndex];
          return !line.trim().startsWith('//') && !line.trim().startsWith('*');
        });

        expect(hasActiveMatch, `Found auto-apply pattern: ${pattern}`).toBe(false);
      }
    }
  });
});

describe('AI Route Invariants: Canonical Updater Imports', () => {

  const DANGEROUS_IMPORTS = [
    'updateCompanyContext',
    'saveContextGraph',
    'updateContextDirect',
    'setField',
    'setDomainFields',
  ];

  it('ai-assist should not import dangerous canonical updaters', () => {
    const content = getRouteContent('app/api/os/context/ai-assist/route.ts');
    if (!content) return;

    for (const importName of DANGEROUS_IMPORTS) {
      // Check if imported
      const importRegex = new RegExp(`import.*\\b${importName}\\b.*from`);
      const isImported = importRegex.test(content);

      if (isImported) {
        // If imported, check if it's actually called (not just available)
        const callRegex = new RegExp(`(?<!import.*)\\b${importName}\\s*\\(`, 'gm');
        const isCalled = callRegex.test(content);

        expect(isCalled, `${importName} is imported AND called in ai-assist route`).toBe(false);
      }
    }
  });

  it('ai-assist should import proposal flow functions', () => {
    const content = getRouteContent('app/api/os/context/ai-assist/route.ts');
    if (!content) return;

    // Should import from writeContract
    expect(content).toContain('computeProposalForAI');
  });
});

describe('AI Route Invariants: Static Guard Analysis', () => {

  it('should detect if ai-assist imports have changed dangerously', () => {
    const content = getRouteContent('app/api/os/context/ai-assist/route.ts');
    if (!content) return;

    // Extract all imports
    const importLines = content.split('\n').filter(line =>
      line.trim().startsWith('import') || line.includes(' from ')
    );

    // Flag if any import is from os/context without writeContract
    const contextImports = importLines.filter(line =>
      line.includes('@/lib/os/context') && !line.includes('writeContract')
    );

    // Context imports should not include update functions
    for (const line of contextImports) {
      expect(line).not.toContain('updateCompanyContext');
      expect(line).not.toContain('saveCompanyContext');
    }
  });

  it('should have proposal flow at end of handler', () => {
    const content = getRouteContent('app/api/os/context/ai-assist/route.ts');
    if (!content) return;

    // Find the successful response (not error response)
    // Look for the response that returns proposal data
    const hasProposalResponse = content.includes('requiresUserApproval: true');

    // The response should include requiresUserApproval somewhere in success path
    expect(hasProposalResponse).toBe(true);
  });
});

describe('AI Route Invariants: Doctrine Comments', () => {

  it('ai-assist should have doctrine comment explaining proposal flow', () => {
    const content = getRouteContent('app/api/os/context/ai-assist/route.ts');
    if (!content) return;

    // Should have a comment about the doctrine
    const hasDoctrineComment =
      content.includes('AI Proposes, Humans Decide') ||
      content.includes('DOCTRINE:') ||
      content.includes('proposal flow');

    expect(hasDoctrineComment).toBe(true);
  });
});

describe('AI Route Invariants: Proposal Flag Enforcement', () => {

  /**
   * Critical AI routes that MUST have requiresUserApproval: true
   * Note: Some older routes like ai-propose naturally return proposals without the flag
   * but don't save directly - we check the critical ones explicitly.
   */
  it('should have requiresUserApproval: true in context AI routes', () => {
    // Critical routes that must have the flag
    const criticalRoutes = [
      'app/api/os/context/ai-assist/route.ts',
    ];

    for (const routePath of criticalRoutes) {
      const content = getRouteContent(routePath);
      if (!content) continue;

      // This route MUST have the flag
      expect(content, `${routePath} should have requiresUserApproval: true`).toContain('requiresUserApproval: true');
    }
  });

  /**
   * Strategy ai-propose is a legacy route that returns proposals but doesn't
   * have the explicit flag. We verify it does NOT save directly instead.
   */
  it('should have ai-propose returning proposal without direct save', () => {
    const content = getRouteContent('app/api/os/strategy/ai-propose/route.ts');
    if (!content) return;

    // Should return a proposal object
    expect(content).toContain('proposal');

    // Should NOT save strategy directly
    expect(content).not.toContain('saveStrategy(');
    expect(content).not.toContain('createStrategy(');
    expect(content).not.toContain('updateStrategy(');
  });
});

describe('AI Route Invariants: No Silent Auto-Apply', () => {

  /**
   * Detect patterns that might silently auto-apply AI suggestions
   */
  it('should NOT have conditional auto-apply logic', () => {
    const content = getRouteContent('app/api/os/context/ai-assist/route.ts');
    if (!content) return;

    // Patterns that suggest conditional auto-apply
    const autoApplyPatterns = [
      /if\s*\(.*autoApply/i,
      /if\s*\(.*auto_apply/i,
      /shouldAutoApply/i,
      /autoSave\s*[=:]/i,
      /applyImmediately/i,
    ];

    for (const pattern of autoApplyPatterns) {
      const hasPattern = pattern.test(content);
      expect(hasPattern, `Found potential auto-apply pattern: ${pattern}`).toBe(false);
    }
  });

  /**
   * Detect if the route might apply changes based on a flag
   */
  it('should NOT have apply parameter in request body handling', () => {
    const content = getRouteContent('app/api/os/context/ai-assist/route.ts');
    if (!content) return;

    // Check the request body destructuring
    const bodyMatch = content.match(/const\s*\{([^}]+)\}\s*=\s*(?:await\s+)?(?:body|request\.json\(\))/);

    if (bodyMatch) {
      const destructuredFields = bodyMatch[1];

      // Should NOT have apply, autoApply, or similar
      expect(destructuredFields).not.toMatch(/\bapply\b/i);
      expect(destructuredFields).not.toMatch(/\bautoApply\b/i);
      expect(destructuredFields).not.toMatch(/\bshouldApply\b/i);
    }
  });
});
