// lib/os/globalContext/index.ts
// OS Global Context - Main Entry Point
//
// This module provides access to the Hive OS operating doctrine.
// The doctrine is code-defined and immutable - AI cannot modify it.

import type { OSGlobalContext, VersionedOSContext } from './types';
import { HIVE_DOCTRINE } from './hiveDoctrine';

// Re-export types
export * from './types';

// ============================================================================
// Version Information
// ============================================================================

/**
 * Current doctrine version
 * Follows semver: major.minor.patch
 * - Major: Breaking changes to doctrine structure
 * - Minor: New rules or principles added
 * - Patch: Clarifications or corrections
 */
const DOCTRINE_VERSION = '1.0.0';

/**
 * When this doctrine version was defined
 */
const DOCTRINE_DEFINED_AT = '2024-01-15T00:00:00Z';

// ============================================================================
// Main API
// ============================================================================

/**
 * Get the OS Global Context (Hive doctrine)
 *
 * This is the ONLY way to access the operating doctrine.
 * Returns a versioned wrapper containing the immutable doctrine.
 *
 * @example
 * ```ts
 * const { version, doctrine } = getOSGlobalContext();
 *
 * // Access operating principles
 * doctrine.operatingPrinciples.forEach(p => {
 *   console.log(p.name, p.aiImplication);
 * });
 *
 * // Check forbidden patterns
 * doctrine.forbiddenPatterns.forEach(fp => {
 *   if (fp.category === 'language') {
 *     console.log('Avoid:', fp.pattern);
 *   }
 * });
 * ```
 */
export function getOSGlobalContext(): VersionedOSContext {
  return {
    version: DOCTRINE_VERSION,
    definedAt: DOCTRINE_DEFINED_AT,
    doctrine: HIVE_DOCTRINE,
  };
}

/**
 * Get just the doctrine content (without version wrapper)
 * Convenience function for when version info isn't needed
 */
export function getDoctrine(): OSGlobalContext {
  return HIVE_DOCTRINE;
}

/**
 * Get the current doctrine version
 */
export function getDoctrineVersion(): string {
  return DOCTRINE_VERSION;
}

// ============================================================================
// Lookup Helpers
// ============================================================================

/**
 * Get a specific operating principle by ID
 */
export function getOperatingPrinciple(id: string) {
  return HIVE_DOCTRINE.operatingPrinciples.find(p => p.id === id);
}

/**
 * Get a term definition
 */
export function getTermDefinition(term: string) {
  return HIVE_DOCTRINE.terminology.find(
    t => t.term.toLowerCase() === term.toLowerCase()
  );
}

/**
 * Get a tone rule by ID
 */
export function getToneRule(id: string) {
  return HIVE_DOCTRINE.toneRules.find(r => r.id === id);
}

/**
 * Get forbidden patterns by category
 */
export function getForbiddenPatternsByCategory(
  category: 'language' | 'content' | 'behavior' | 'structure'
) {
  return HIVE_DOCTRINE.forbiddenPatterns.filter(p => p.category === category);
}

/**
 * Get source selection rule for a domain
 */
export function getSourceSelectionRule(domain: string) {
  return HIVE_DOCTRINE.sourceSelectionRules.find(r => r.domain === domain);
}

// ============================================================================
// Prompt Building Helpers
// ============================================================================

/**
 * Build a system prompt section with operating principles
 * For use in AI prompt assembly
 */
export function buildOperatingPrinciplesPrompt(): string {
  const lines = ['## Operating Principles', ''];

  for (const principle of HIVE_DOCTRINE.operatingPrinciples) {
    lines.push(`### ${principle.name}`);
    lines.push(principle.description);
    lines.push(`**AI Implication:** ${principle.aiImplication}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Build a system prompt section with forbidden patterns
 * For use in AI prompt assembly
 */
export function buildForbiddenPatternsPrompt(): string {
  const lines = ['## Forbidden Patterns', ''];

  const byCategory = {
    language: HIVE_DOCTRINE.forbiddenPatterns.filter(p => p.category === 'language'),
    content: HIVE_DOCTRINE.forbiddenPatterns.filter(p => p.category === 'content'),
    behavior: HIVE_DOCTRINE.forbiddenPatterns.filter(p => p.category === 'behavior'),
    structure: HIVE_DOCTRINE.forbiddenPatterns.filter(p => p.category === 'structure'),
  };

  for (const [category, patterns] of Object.entries(byCategory)) {
    if (patterns.length === 0) continue;

    lines.push(`### ${category.charAt(0).toUpperCase() + category.slice(1)} Patterns`);

    for (const pattern of patterns) {
      lines.push(`- **${pattern.pattern}**: ${pattern.reason}`);
      lines.push(`  - Instead: ${pattern.alternative}`);
      if (pattern.examples && pattern.examples.length > 0) {
        lines.push(`  - Examples to avoid: ${pattern.examples.slice(0, 3).join(', ')}`);
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Build a system prompt section with tone rules
 * For use in AI prompt assembly
 */
export function buildToneRulesPrompt(): string {
  const lines = ['## Tone & Style Rules', ''];

  for (const rule of HIVE_DOCTRINE.toneRules) {
    lines.push(`- **${rule.rule}**`);
    if (rule.avoid) {
      lines.push(`  - Avoid: ${rule.avoid}`);
    }
    if (rule.goodExample) {
      lines.push(`  - Good: "${rule.goodExample}"`);
    }
    if (rule.badExample) {
      lines.push(`  - Bad: "${rule.badExample}"`);
    }
  }

  return lines.join('\n');
}

/**
 * Build a system prompt section with confidence posture
 * For use in AI prompt assembly
 */
export function buildConfidencePosturePrompt(): string {
  const posture = HIVE_DOCTRINE.confidencePosture;

  return `## Data Confidence Posture

- **High Confidence:** ${posture.highConfidence}
- **Medium Confidence:** ${posture.mediumConfidence}
- **Low Confidence:** ${posture.lowConfidence}
- **Missing Data:** ${posture.missingData}
- **Assumptions:** ${posture.assumptions}`;
}

/**
 * Build a system prompt section with strategy doctrine
 * For use in strategy generation prompts
 */
export function buildStrategyDoctrinePrompt(): string {
  const sd = HIVE_DOCTRINE.strategyDoctrine;

  return `## Strategy Doctrine

**Core Definition:** ${sd.coreDefinition}

**Pillars Are Bets:** ${sd.pillarsAreBets}

**Choices Over Activities:** ${sd.choicesOverActivities}

**Tradeoffs Required:** ${sd.tradeoffsRequired}`;
}

/**
 * Build a complete doctrine prompt for system-level injection
 * Combines all doctrine sections into a single prompt block
 */
export function buildFullDoctrinePrompt(): string {
  return [
    '# Hive OS Operating Doctrine',
    `Version: ${DOCTRINE_VERSION}`,
    '',
    buildOperatingPrinciplesPrompt(),
    buildToneRulesPrompt(),
    buildForbiddenPatternsPrompt(),
    buildConfidencePosturePrompt(),
    buildStrategyDoctrinePrompt(),
  ].join('\n');
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Check if a text contains forbidden patterns
 * Returns matches found
 */
export function checkForForbiddenPatterns(
  text: string,
  categories?: Array<'language' | 'content' | 'behavior' | 'structure'>
): Array<{ pattern: ForbiddenPattern; matches: string[] }> {
  const results: Array<{ pattern: ForbiddenPattern; matches: string[] }> = [];

  const patterns = categories
    ? HIVE_DOCTRINE.forbiddenPatterns.filter(p => categories.includes(p.category))
    : HIVE_DOCTRINE.forbiddenPatterns;

  for (const pattern of patterns) {
    if (!pattern.examples) continue;

    const matches: string[] = [];
    const lowerText = text.toLowerCase();

    for (const example of pattern.examples) {
      if (lowerText.includes(example.toLowerCase())) {
        matches.push(example);
      }
    }

    if (matches.length > 0) {
      results.push({ pattern, matches });
    }
  }

  return results;
}

// Import types for the check function
import type { ForbiddenPattern } from './types';
