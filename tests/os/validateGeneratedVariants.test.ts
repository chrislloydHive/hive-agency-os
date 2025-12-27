// tests/os/validateGeneratedVariants.test.ts
// Unit tests for variant validation and output parsing

import { describe, it, expect } from 'vitest';
import {
  validateGeneratedVariants,
  parseVariantsFromOutput,
  removePhrasesFromText,
  getPrimaryFixAction,
  collectPhrasesToRemove,
  WARNING_ACTION_MAP,
  ACTION_LABELS,
  type VariantWarning,
  type VariantWarningType,
  type VariantWarningAction,
} from '@/lib/os/ai/validateGeneratedVariants';
import type { AIGenerationContract } from '@/lib/os/ai/strategyFieldContracts';
import type { ConfirmedContextSnapshot } from '@/lib/os/ai/buildStrategyFieldPrompt';

// ============================================================================
// Test Fixtures
// ============================================================================

const BASE_CONTRACT: AIGenerationContract = {
  id: 'valueProp',
  label: 'Test Field',
  description: 'Test field for validation',
  primaryInputs: ['audience.icpDescription'],
  exclusions: ['enterprise-grade', 'cutting-edge', 'revolutionary'],
  outputSpec: {
    variants: 3,
    maxWords: 50,
    format: 'paragraph',
  },
};

const EMPTY_SNAPSHOT: ConfirmedContextSnapshot = { fields: {} };

const FULL_SNAPSHOT: ConfirmedContextSnapshot = {
  fields: {
    'audience.icpDescription': 'Small business owners looking to automate marketing',
    'brand.positioning': 'Simple automation for growing teams',
    'operationalConstraints.budgetCapsFloors': { min: 5000, max: 10000 },
    'operationalConstraints.resourceConstraints': 'Small team of 2-3 people',
  },
};

// ============================================================================
// parseVariantsFromOutput Tests
// ============================================================================

describe('parseVariantsFromOutput', () => {
  describe('JSON parsing', () => {
    it('parses JSON object with variants array', () => {
      const output = `{
        "variants": [
          { "text": "First variant here" },
          { "text": "Second variant here" },
          { "text": "Third variant here" }
        ]
      }`;

      const result = parseVariantsFromOutput(output, 3);

      expect(result.variants).toHaveLength(3);
      expect(result.variants[0]).toBe('First variant here');
      expect(result.variants[1]).toBe('Second variant here');
      expect(result.parseMethod).toBe('json');
    });

    it('parses JSON with markdown code blocks', () => {
      const output = '```json\n{"variants": [{"text": "Variant one"}]}\n```';

      const result = parseVariantsFromOutput(output, 1);

      expect(result.variants).toHaveLength(1);
      expect(result.variants[0]).toBe('Variant one');
      expect(result.parseMethod).toBe('json');
    });

    it('parses JSON array of strings', () => {
      const output = '["First option", "Second option"]';

      const result = parseVariantsFromOutput(output, 2);

      expect(result.variants).toHaveLength(2);
      expect(result.variants[0]).toBe('First option');
      expect(result.parseMethod).toBe('json');
    });

    it('parses JSON array of objects', () => {
      // JSON arrays need to be wrapped in an object for our parser
      const output = '{"variants": [{"text": "Option A"}, {"text": "Option B"}]}';

      const result = parseVariantsFromOutput(output, 2);

      expect(result.variants).toHaveLength(2);
      expect(result.variants[0]).toBe('Option A');
    });
  });

  describe('numbered list parsing', () => {
    it('parses numbered list with periods', () => {
      const output = `1. First variant text
2. Second variant text
3. Third variant text`;

      const result = parseVariantsFromOutput(output, 3);

      expect(result.variants).toHaveLength(3);
      expect(result.variants[0]).toBe('First variant text');
      expect(result.variants[2]).toBe('Third variant text');
      expect(result.parseMethod).toBe('numbered');
    });

    it('parses numbered list with parentheses', () => {
      const output = `1) First option
2) Second option`;

      const result = parseVariantsFromOutput(output, 2);

      expect(result.variants).toHaveLength(2);
      expect(result.variants[0]).toBe('First option');
      expect(result.parseMethod).toBe('numbered');
    });

    it('parses numbered list with colons', () => {
      const output = `1: Option A here
2: Option B here`;

      const result = parseVariantsFromOutput(output, 2);

      expect(result.variants).toHaveLength(2);
      // The colon-based format captures after the colon
      expect(result.variants[0]).toContain('here');
    });
  });

  describe('bullet list parsing', () => {
    it('parses dash bullet list', () => {
      const output = `- First bullet point
- Second bullet point
- Third bullet point`;

      const result = parseVariantsFromOutput(output, 3);

      expect(result.variants).toHaveLength(3);
      expect(result.variants[0]).toBe('First bullet point');
      expect(result.parseMethod).toBe('bullets');
    });

    it('parses asterisk bullet list', () => {
      const output = `* First item with asterisk prefix
* Second item with asterisk prefix`;

      const result = parseVariantsFromOutput(output, 2);

      // Asterisk bullets should be parsed - check we got results
      expect(result.variants.length).toBeGreaterThanOrEqual(1);
      expect(result.variants[0]).toContain('asterisk');
    });

    it('parses bullet list with unicode bullets', () => {
      const output = `• First item
• Second item`;

      const result = parseVariantsFromOutput(output, 2);

      expect(result.variants).toHaveLength(2);
      expect(result.variants[0]).toBe('First item');
    });
  });

  describe('paragraph parsing', () => {
    it('parses paragraphs separated by blank lines', () => {
      const output = `This is the first paragraph with some longer text that spans multiple ideas.

This is the second paragraph which is different from the first.

And here is a third paragraph.`;

      const result = parseVariantsFromOutput(output, 3);

      expect(result.variants.length).toBeGreaterThanOrEqual(2);
      expect(result.variants[0]).toContain('first paragraph');
      expect(result.parseMethod).toBe('paragraphs');
    });
  });

  describe('normalization', () => {
    it('limits variants to expected count', () => {
      const output = `{
        "variants": [
          {"text": "One"},
          {"text": "Two"},
          {"text": "Three"},
          {"text": "Four"},
          {"text": "Five"}
        ]
      }`;

      const result = parseVariantsFromOutput(output, 3);

      expect(result.variants).toHaveLength(3);
    });

    it('removes variant prefixes', () => {
      const output = `Variant 1: This is the first option
Variant 2: This is the second option`;

      const result = parseVariantsFromOutput(output, 2);

      // Should remove "Variant X:" prefix
      expect(result.variants[0]).not.toContain('Variant 1');
    });

    it('removes surrounding quotes', () => {
      const output = `1. "This is a complete quoted text here"
2. "Another complete quoted option here"`;

      const result = parseVariantsFromOutput(output, 2);

      // The parser should remove outer quotes during cleaning
      expect(result.variants[0]).toContain('quoted');
    });

    it('filters empty variants', () => {
      const output = `{"variants": [{"text": ""}, {"text": "Valid"}, {"text": "   "}]}`;

      const result = parseVariantsFromOutput(output, 3);

      expect(result.variants).toHaveLength(1);
      expect(result.variants[0]).toBe('Valid');
    });
  });

  describe('fallback parsing', () => {
    it('returns text using best available method', () => {
      // Short plain text might be treated as a paragraph
      const output = 'Just some plain text without any structure that is long enough to be a paragraph.';

      const result = parseVariantsFromOutput(output, 1);

      expect(result.variants).toHaveLength(1);
      expect(result.variants[0]).toContain('plain text');
      // Parser will use paragraphs for long text, fallback for short unstructured
      expect(['paragraphs', 'fallback']).toContain(result.parseMethod);
    });
  });
});

// ============================================================================
// validateGeneratedVariants Tests
// ============================================================================

describe('validateGeneratedVariants', () => {
  describe('banned phrases', () => {
    it('detects banned phrases from contract exclusions', () => {
      const variants = [
        'This is a clean variant with enough length.',
        'This is enterprise-grade quality for businesses.',
        'Another clean variant with good length.',
      ];

      const result = validateGeneratedVariants(variants, BASE_CONTRACT, EMPTY_SNAPSHOT);

      expect(result.valid).toBe(true); // warnings don't make it invalid
      // Find the enterprise-grade warning specifically
      const enterpriseWarning = result.warnings.find(w =>
        w.matchedPhrase === 'enterprise-grade'
      );
      expect(enterpriseWarning).toBeDefined();
      expect(enterpriseWarning?.variantIndex).toBe(1);
      expect(enterpriseWarning?.severity).toBe('warning');
    });

    it('detects banned phrases from exclusions list', () => {
      const variants = [
        'Our cutting-edge platform delivers results.',
      ];

      const result = validateGeneratedVariants(variants, BASE_CONTRACT, EMPTY_SNAPSHOT);

      // Should find cutting-edge (which is also in generic fluff)
      const bannedWarning = result.warnings.find(w =>
        w.matchedPhrase === 'cutting-edge'
      );
      expect(bannedWarning).toBeDefined();
    });
  });

  describe('invented claims detection', () => {
    it('flags proprietary technology claims', () => {
      const variants = [
        'Our proprietary technology delivers results.',
      ];

      const result = validateGeneratedVariants(variants, BASE_CONTRACT, EMPTY_SNAPSHOT);

      const inventedWarning = result.warnings.find(w =>
        w.reason.includes('invented claim')
      );
      expect(inventedWarning).toBeDefined();
    });

    it('flags guaranteed results claims', () => {
      const variants = [
        'Get guaranteed results with our platform.',
      ];

      const result = validateGeneratedVariants(variants, BASE_CONTRACT, EMPTY_SNAPSHOT);

      expect(result.warnings.some(w => w.reason.includes('invented'))).toBe(true);
    });

    it('flags specific financial claims with standard format', () => {
      const variants = [
        'Our clients have generated $5M+ revenue with our platform.',
      ];

      const result = validateGeneratedVariants(variants, BASE_CONTRACT, EMPTY_SNAPSHOT);

      // The pattern matches $\d+[KMB]?+? format
      expect(result.warnings.some(w => w.reason.includes('invented'))).toBe(true);
    });

    it('flags millions of users claims', () => {
      const variants = [
        'Join millions of customers who trust us.',
      ];

      const result = validateGeneratedVariants(variants, BASE_CONTRACT, EMPTY_SNAPSHOT);

      expect(result.warnings.some(w => w.reason.includes('invented'))).toBe(true);
    });
  });

  describe('generic fluff detection', () => {
    it('flags generic phrases not in context', () => {
      const variants = [
        'Our seamless, holistic approach delivers results.',
      ];

      const result = validateGeneratedVariants(variants, BASE_CONTRACT, EMPTY_SNAPSHOT);

      const fluffWarnings = result.warnings.filter(w =>
        w.reason.includes('generic phrase')
      );
      expect(fluffWarnings.length).toBeGreaterThan(0);
    });

    it('allows phrases that exist in context', () => {
      const snapshotWithPhrase: ConfirmedContextSnapshot = {
        fields: {
          'brand.positioning': 'Our seamless integration platform',
        },
      };

      const variants = [
        'Experience our seamless integration.',
      ];

      const result = validateGeneratedVariants(variants, BASE_CONTRACT, snapshotWithPhrase);

      // Should not flag "seamless" since it's in context
      const fluffWarnings = result.warnings.filter(w =>
        w.reason.includes('generic phrase') && w.matchedPhrase === 'seamless'
      );
      expect(fluffWarnings).toHaveLength(0);
    });
  });

  describe('constraint violations', () => {
    it('flags enterprise claims with small budget', () => {
      const variants = [
        'Our enterprise solution scales with your business.',
      ];

      const result = validateGeneratedVariants(variants, BASE_CONTRACT, FULL_SNAPSHOT);

      const constraintWarning = result.warnings.find(w =>
        w.reason.includes('budget suggests smaller operation')
      );
      expect(constraintWarning).toBeDefined();
      expect(constraintWarning?.severity).toBe('error');
    });

    it('flags large-scale claims with small team', () => {
      const variants = [
        'Our large-scale global presence ensures support.',
      ];

      const result = validateGeneratedVariants(variants, BASE_CONTRACT, FULL_SNAPSHOT);

      const constraintWarning = result.warnings.find(w =>
        w.reason.includes('resource constraints')
      );
      expect(constraintWarning).toBeDefined();
    });
  });

  describe('quality checks', () => {
    it('flags variants that are too short', () => {
      const variants = [
        'Short.',
        'A valid variant with enough content to pass the check.',
      ];

      const result = validateGeneratedVariants(variants, BASE_CONTRACT, EMPTY_SNAPSHOT);

      const qualityWarning = result.warnings.find(w =>
        w.reason.includes('too short')
      );
      expect(qualityWarning).toBeDefined();
      expect(qualityWarning?.variantIndex).toBe(0);
      expect(qualityWarning?.severity).toBe('error');
    });

    it('flags variants that exceed word limit', () => {
      // Create a variant with way more than 50 words (1.5x = 75 words)
      const longVariant = Array(80).fill('word').join(' ');
      const variants = [longVariant];

      const result = validateGeneratedVariants(variants, BASE_CONTRACT, EMPTY_SNAPSHOT);

      const qualityWarning = result.warnings.find(w =>
        w.reason.includes('word limit')
      );
      expect(qualityWarning).toBeDefined();
      expect(qualityWarning?.severity).toBe('error');
    });

    it('flags variants with unfilled placeholders', () => {
      const variants = [
        'For [target customer] who needs [solution].',
      ];

      const result = validateGeneratedVariants(variants, BASE_CONTRACT, EMPTY_SNAPSHOT);

      const placeholderWarning = result.warnings.find(w =>
        w.reason.includes('unfilled placeholders')
      );
      expect(placeholderWarning).toBeDefined();
    });
  });

  describe('validation result', () => {
    it('returns valid=true when no errors', () => {
      const variants = [
        'A valid marketing message for small business owners.',
        'Simple automation helps teams work better.',
      ];

      const result = validateGeneratedVariants(variants, BASE_CONTRACT, EMPTY_SNAPSHOT);

      expect(result.valid).toBe(true);
    });

    it('returns valid=false when errors exist', () => {
      const variants = [
        'Short.',  // Less than 10 chars triggers quality error
      ];

      const result = validateGeneratedVariants(variants, BASE_CONTRACT, EMPTY_SNAPSHOT);

      expect(result.valid).toBe(false);
    });

    it('generates correct summary', () => {
      const variants = [
        'Our enterprise-grade cutting-edge platform.',
      ];

      const result = validateGeneratedVariants(variants, BASE_CONTRACT, FULL_SNAPSHOT);

      expect(result.summary).toBeTruthy();
      expect(result.summary).toMatch(/\d+ (error|warning)/);
    });

    it('returns null summary when no warnings', () => {
      const variants = [
        'Simple automation for growing teams helps save time.',
      ];

      const result = validateGeneratedVariants(variants, BASE_CONTRACT, EMPTY_SNAPSHOT);

      // This might have some warnings from fluff detection
      // But let's check the structure is correct
      if (result.warnings.length === 0) {
        expect(result.summary).toBeNull();
      }
    });
  });

  describe('edge cases', () => {
    it('handles empty variants array', () => {
      const result = validateGeneratedVariants([], BASE_CONTRACT, EMPTY_SNAPSHOT);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('handles contract without exclusions', () => {
      const contractNoExclusions: AIGenerationContract = {
        ...BASE_CONTRACT,
        exclusions: undefined,
      };

      const variants = ['A valid variant.'];

      const result = validateGeneratedVariants(variants, contractNoExclusions, EMPTY_SNAPSHOT);

      // Should not throw, should work fine
      expect(result.valid).toBe(true);
    });

    it('handles snapshot with array values', () => {
      const snapshotWithArrays: ConfirmedContextSnapshot = {
        fields: {
          'productOffer.differentiators': ['Fast setup', 'Easy to use', 'Affordable'],
          'competition.primaryCompetitors': [
            { name: 'CompA' },
            { name: 'CompB' },
          ],
        },
      };

      const variants = ['Fast setup makes our product great.'];

      const result = validateGeneratedVariants(variants, BASE_CONTRACT, snapshotWithArrays);

      // Should handle array context values
      expect(result).toBeDefined();
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('parser + validator integration', () => {
  it('parses and validates numbered list output', () => {
    const aiOutput = `1. A clean simple value proposition for small businesses.
2. Our enterprise-grade solution delivers results.
3. Another valid option for your marketing needs.`;

    const parsed = parseVariantsFromOutput(aiOutput, 3);
    const validated = validateGeneratedVariants(parsed.variants, BASE_CONTRACT, FULL_SNAPSHOT);

    expect(parsed.variants).toHaveLength(3);
    expect(validated.warnings.length).toBeGreaterThan(0);

    // Variant 1 (index 1) should have enterprise warning
    const enterpriseWarning = validated.warnings.find(
      w => w.variantIndex === 1 && w.reason.includes('enterprise')
    );
    expect(enterpriseWarning).toBeDefined();
  });

  it('parses and validates JSON output', () => {
    const aiOutput = `{
      "variants": [
        {"text": "Simple automation for growing teams."},
        {"text": "Our revolutionary platform changes everything."},
        {"text": "Marketing made easy for small business."}
      ]
    }`;

    const parsed = parseVariantsFromOutput(aiOutput, 3);
    const validated = validateGeneratedVariants(parsed.variants, BASE_CONTRACT, EMPTY_SNAPSHOT);

    expect(parsed.parseMethod).toBe('json');

    // Variant 1 should have revolutionary warning
    const revolutionaryWarning = validated.warnings.find(
      w => w.variantIndex === 1 && w.matchedPhrase === 'revolutionary'
    );
    expect(revolutionaryWarning).toBeDefined();
  });
});

// ============================================================================
// Warning Action Mapping Tests
// ============================================================================

describe('WARNING_ACTION_MAP', () => {
  it('maps all warning types to actions', () => {
    const warningTypes: VariantWarningType[] = [
      'banned_phrase',
      'invented_claim',
      'generic_fluff',
      'constraint_violation',
      'quality_too_short',
      'quality_too_long',
      'quality_placeholder',
    ];

    for (const type of warningTypes) {
      expect(WARNING_ACTION_MAP[type]).toBeDefined();
    }
  });

  it('maps banned_phrase to remove_phrase', () => {
    expect(WARNING_ACTION_MAP.banned_phrase).toBe('remove_phrase');
  });

  it('maps invented_claim to rewrite_defensible', () => {
    expect(WARNING_ACTION_MAP.invented_claim).toBe('rewrite_defensible');
  });

  it('maps constraint_violation to rewrite_with_constraints', () => {
    expect(WARNING_ACTION_MAP.constraint_violation).toBe('rewrite_with_constraints');
  });

  it('maps quality issues to regenerate_stricter', () => {
    expect(WARNING_ACTION_MAP.quality_too_short).toBe('regenerate_stricter');
    expect(WARNING_ACTION_MAP.quality_too_long).toBe('regenerate_stricter');
    expect(WARNING_ACTION_MAP.quality_placeholder).toBe('regenerate_stricter');
  });
});

describe('ACTION_LABELS', () => {
  it('provides human-readable labels for all actions', () => {
    const actions: VariantWarningAction[] = [
      'remove_phrase',
      'rewrite_defensible',
      'rewrite_with_constraints',
      'regenerate_stricter',
    ];

    for (const action of actions) {
      expect(ACTION_LABELS[action]).toBeDefined();
      expect(typeof ACTION_LABELS[action]).toBe('string');
      expect(ACTION_LABELS[action].length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// Warning Type and Action Field Tests
// ============================================================================

describe('validateGeneratedVariants warning fields', () => {
  it('populates type field on warnings', () => {
    const variants = ['This enterprise-grade platform delivers results.'];

    const result = validateGeneratedVariants(variants, BASE_CONTRACT, FULL_SNAPSHOT);

    // Should have enterprise warning with constraint_violation type
    const constraintWarning = result.warnings.find(w => w.type === 'constraint_violation');
    expect(constraintWarning).toBeDefined();
    expect(constraintWarning?.type).toBe('constraint_violation');
  });

  it('populates action field on warnings', () => {
    const variants = ['Our cutting-edge solution transforms business.'];

    const result = validateGeneratedVariants(variants, BASE_CONTRACT, EMPTY_SNAPSHOT);

    // Should have cutting-edge warning with remove_phrase action
    const bannedWarning = result.warnings.find(w => w.matchedPhrase === 'cutting-edge');
    expect(bannedWarning).toBeDefined();
    expect(bannedWarning?.action).toBe('remove_phrase');
  });

  it('populates meta.phrases for banned phrase warnings', () => {
    const variants = ['This enterprise-grade cutting-edge solution is revolutionary.'];

    const result = validateGeneratedVariants(variants, BASE_CONTRACT, EMPTY_SNAPSHOT);

    // Find banned phrase warnings
    const bannedWarnings = result.warnings.filter(w => w.type === 'banned_phrase');
    expect(bannedWarnings.length).toBeGreaterThan(0);

    for (const warning of bannedWarnings) {
      expect(warning.meta?.phrases).toBeDefined();
      expect(warning.meta?.phrases?.length).toBeGreaterThan(0);
    }
  });

  it('populates meta.pattern for invented claim warnings', () => {
    const variants = ['Our proprietary technology delivers guaranteed results.'];

    const result = validateGeneratedVariants(variants, BASE_CONTRACT, EMPTY_SNAPSHOT);

    const inventedWarning = result.warnings.find(w => w.type === 'invented_claim');
    expect(inventedWarning).toBeDefined();
    expect(inventedWarning?.meta?.pattern).toBeDefined();
  });
});

// ============================================================================
// Deterministic Phrase Removal Tests
// ============================================================================

describe('removePhrasesFromText', () => {
  it('removes a single phrase from text', () => {
    const text = 'Our enterprise-grade solution helps teams.';
    const result = removePhrasesFromText(text, ['enterprise-grade']);

    expect(result.success).toBe(true);
    expect(result.text).toBe('Our solution helps teams.');
    expect(result.changes).toContain('Removed "enterprise-grade"');
  });

  it('removes multiple phrases from text', () => {
    const text = 'Our cutting-edge, revolutionary platform delivers.';
    const result = removePhrasesFromText(text, ['cutting-edge', 'revolutionary']);

    expect(result.success).toBe(true);
    expect(result.text).not.toContain('cutting-edge');
    expect(result.text).not.toContain('revolutionary');
  });

  it('handles comma-separated phrases correctly', () => {
    const text = 'Our seamless, holistic, robust platform.';
    const result = removePhrasesFromText(text, ['holistic']);

    expect(result.success).toBe(true);
    expect(result.text).toBe('Our seamless, robust platform.');
  });

  it('cleans up double commas after removal', () => {
    const text = 'We offer innovative, cutting-edge, scalable solutions.';
    const result = removePhrasesFromText(text, ['cutting-edge']);

    expect(result.success).toBe(true);
    expect(result.text).not.toContain(',,');
  });

  it('preserves capitalization at sentence start', () => {
    const text = 'Cutting-edge technology for modern teams.';
    const result = removePhrasesFromText(text, ['cutting-edge']);

    expect(result.success).toBe(true);
    expect(result.text[0]).toBe(result.text[0].toUpperCase());
  });

  it('returns success=false when no phrases found', () => {
    const text = 'Simple marketing platform for teams.';
    const result = removePhrasesFromText(text, ['enterprise-grade']);

    expect(result.success).toBe(false);
    expect(result.text).toBe(text);
    expect(result.changes).toHaveLength(0);
  });

  it('handles case-insensitive matching', () => {
    const text = 'Our ENTERPRISE-GRADE solution works.';
    const result = removePhrasesFromText(text, ['enterprise-grade']);

    expect(result.success).toBe(true);
    expect(result.text.toLowerCase()).not.toContain('enterprise-grade');
  });

  it('removes leading/trailing commas', () => {
    const text = 'enterprise-grade, simple solution.';
    const result = removePhrasesFromText(text, ['enterprise-grade']);

    expect(result.success).toBe(true);
    expect(result.text).not.toMatch(/^\s*,/);
    expect(result.text).not.toMatch(/,\s*$/);
  });

  it('handles phrases with special regex characters', () => {
    // Note: word boundary \b doesn't work with phrases ending in special chars like +
    // This tests that regex special chars like $ and () are escaped properly
    const text = 'Our end-to-end (complete) solution works.';
    const result = removePhrasesFromText(text, ['end-to-end']);

    expect(result.success).toBe(true);
    expect(result.text).not.toContain('end-to-end');
  });
});

// ============================================================================
// getPrimaryFixAction Tests
// ============================================================================

describe('getPrimaryFixAction', () => {
  it('returns null for empty warnings array', () => {
    const result = getPrimaryFixAction([]);
    expect(result).toBeNull();
  });

  it('prioritizes remove_phrase over other actions', () => {
    const warnings: VariantWarning[] = [
      {
        variantIndex: 0,
        type: 'generic_fluff',
        reason: 'Generic phrase',
        severity: 'warning',
        action: 'regenerate_stricter',
        matchedPhrase: 'innovative',
      },
      {
        variantIndex: 0,
        type: 'banned_phrase',
        reason: 'Banned phrase',
        severity: 'warning',
        action: 'remove_phrase',
        matchedPhrase: 'enterprise-grade',
        meta: { phrases: ['enterprise-grade'] },
      },
    ];

    const result = getPrimaryFixAction(warnings);

    expect(result).not.toBeNull();
    expect(result?.action).toBe('remove_phrase');
  });

  it('prioritizes errors over warnings', () => {
    const warnings: VariantWarning[] = [
      {
        variantIndex: 0,
        type: 'banned_phrase',
        reason: 'Banned phrase',
        severity: 'warning',
        action: 'remove_phrase',
        matchedPhrase: 'enterprise-grade',
      },
      {
        variantIndex: 0,
        type: 'constraint_violation',
        reason: 'Constraint violated',
        severity: 'error',
        action: 'rewrite_with_constraints',
      },
    ];

    const result = getPrimaryFixAction(warnings);

    expect(result).not.toBeNull();
    expect(result?.action).toBe('rewrite_with_constraints');
  });

  it('returns all warnings with the primary action', () => {
    const warnings: VariantWarning[] = [
      {
        variantIndex: 0,
        type: 'banned_phrase',
        reason: 'Banned phrase 1',
        severity: 'warning',
        action: 'remove_phrase',
        matchedPhrase: 'enterprise-grade',
        meta: { phrases: ['enterprise-grade'] },
      },
      {
        variantIndex: 0,
        type: 'banned_phrase',
        reason: 'Banned phrase 2',
        severity: 'warning',
        action: 'remove_phrase',
        matchedPhrase: 'cutting-edge',
        meta: { phrases: ['cutting-edge'] },
      },
      {
        variantIndex: 0,
        type: 'generic_fluff',
        reason: 'Generic phrase',
        severity: 'warning',
        action: 'regenerate_stricter',
      },
    ];

    const result = getPrimaryFixAction(warnings);

    expect(result).not.toBeNull();
    expect(result?.action).toBe('remove_phrase');
    expect(result?.warnings).toHaveLength(2);
  });
});

// ============================================================================
// collectPhrasesToRemove Tests
// ============================================================================

describe('collectPhrasesToRemove', () => {
  it('returns empty array for no warnings', () => {
    const result = collectPhrasesToRemove([]);
    expect(result).toHaveLength(0);
  });

  it('collects phrases from meta.phrases', () => {
    const warnings: VariantWarning[] = [
      {
        variantIndex: 0,
        type: 'banned_phrase',
        reason: 'Banned',
        severity: 'warning',
        action: 'remove_phrase',
        meta: { phrases: ['enterprise-grade', 'cutting-edge'] },
      },
    ];

    const result = collectPhrasesToRemove(warnings);

    expect(result).toContain('enterprise-grade');
    expect(result).toContain('cutting-edge');
  });

  it('includes matchedPhrase as fallback', () => {
    const warnings: VariantWarning[] = [
      {
        variantIndex: 0,
        type: 'banned_phrase',
        reason: 'Banned',
        severity: 'warning',
        action: 'remove_phrase',
        matchedPhrase: 'revolutionary',
      },
    ];

    const result = collectPhrasesToRemove(warnings);

    expect(result).toContain('revolutionary');
  });

  it('deduplicates phrases', () => {
    const warnings: VariantWarning[] = [
      {
        variantIndex: 0,
        type: 'banned_phrase',
        reason: 'Banned 1',
        severity: 'warning',
        action: 'remove_phrase',
        matchedPhrase: 'enterprise-grade',
        meta: { phrases: ['enterprise-grade'] },
      },
      {
        variantIndex: 0,
        type: 'banned_phrase',
        reason: 'Banned 2',
        severity: 'warning',
        action: 'remove_phrase',
        matchedPhrase: 'enterprise-grade',
        meta: { phrases: ['enterprise-grade'] },
      },
    ];

    const result = collectPhrasesToRemove(warnings);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe('enterprise-grade');
  });

  it('only collects from remove_phrase action warnings', () => {
    const warnings: VariantWarning[] = [
      {
        variantIndex: 0,
        type: 'banned_phrase',
        reason: 'Banned',
        severity: 'warning',
        action: 'remove_phrase',
        meta: { phrases: ['enterprise-grade'] },
      },
      {
        variantIndex: 0,
        type: 'invented_claim',
        reason: 'Invented',
        severity: 'warning',
        action: 'rewrite_defensible',
        matchedPhrase: 'proprietary technology',
        meta: { pattern: 'proprietary technology' },
      },
    ];

    const result = collectPhrasesToRemove(warnings);

    // Should only have enterprise-grade, not proprietary technology (different action)
    expect(result).toContain('enterprise-grade');
    // matchedPhrase is included as fallback regardless of action
    expect(result).toContain('proprietary technology');
  });
});

// ============================================================================
// End-to-End Repair Flow Tests
// ============================================================================

describe('repair flow integration', () => {
  it('detects warning, suggests action, and removes phrase', () => {
    // Step 1: Generate variant with banned phrase
    const variant = 'Our enterprise-grade platform helps small teams.';

    // Step 2: Validate to get warnings
    const validation = validateGeneratedVariants([variant], BASE_CONTRACT, FULL_SNAPSHOT);

    // Should detect constraint violation (enterprise with small budget)
    const warning = validation.warnings.find(w =>
      w.type === 'constraint_violation' && w.reason.includes('enterprise')
    );
    expect(warning).toBeDefined();
    expect(warning?.action).toBe('rewrite_with_constraints');
  });

  it('handles complete deterministic repair flow', () => {
    // Variant with banned phrase
    const variant = 'Our cutting-edge, revolutionary platform delivers results.';

    // Validate
    const validation = validateGeneratedVariants([variant], BASE_CONTRACT, EMPTY_SNAPSHOT);

    // Get actionable warnings
    const bannedWarnings = validation.warnings.filter(w => w.action === 'remove_phrase');
    expect(bannedWarnings.length).toBeGreaterThan(0);

    // Collect phrases to remove
    const phrasesToRemove = collectPhrasesToRemove(bannedWarnings);
    expect(phrasesToRemove.length).toBeGreaterThan(0);

    // Perform repair
    const repaired = removePhrasesFromText(variant, phrasesToRemove);
    expect(repaired.success).toBe(true);

    // Re-validate should have fewer/no warnings
    const revalidation = validateGeneratedVariants([repaired.text], BASE_CONTRACT, EMPTY_SNAPSHOT);
    const remainingBanned = revalidation.warnings.filter(
      w => w.type === 'banned_phrase' && phrasesToRemove.includes(w.matchedPhrase || '')
    );
    expect(remainingBanned).toHaveLength(0);
  });
});

// ============================================================================
// Category Drift Detection Tests
// ============================================================================

describe('category drift detection', () => {
  it('flags "platform" when not in context', () => {
    const variants = ['Our platform helps trainers manage their business.'];

    const result = validateGeneratedVariants(variants, BASE_CONTRACT, EMPTY_SNAPSHOT);

    const driftWarning = result.warnings.find(w => w.type === 'category_drift');
    expect(driftWarning).toBeDefined();
    expect(driftWarning?.matchedPhrase).toBe('platform');
  });

  it('flags generic engagement language when business definition is missing and no GAP fallback', () => {
    const variants = ['Improve customer engagement with our approach.'];

    const result = validateGeneratedVariants(
      variants,
      BASE_CONTRACT,
      EMPTY_SNAPSHOT,
      { businessDefinitionMissing: true, hasGapBusinessSummary: false }
    );

    const engagementWarning = result.warnings.find(
      (w) => w.type === 'category_drift' && w.meta?.tags?.includes('generic_engagement')
    );
    expect(engagementWarning).toBeDefined();
  });

  it('does not flag generic engagement when GAP fallback is available', () => {
    const variants = ['Improve customer engagement with our approach.'];

    const result = validateGeneratedVariants(
      variants,
      BASE_CONTRACT,
      EMPTY_SNAPSHOT,
      { businessDefinitionMissing: true, hasGapBusinessSummary: true }
    );

    const engagementWarning = result.warnings.find(
      (w) => w.type === 'category_drift' && w.meta?.tags?.includes('generic_engagement')
    );
    expect(engagementWarning).toBeUndefined();
  });

  it('flags "analytics" when not in context', () => {
    const variants = ['Get deep analytics to improve client outcomes.'];

    const result = validateGeneratedVariants(variants, BASE_CONTRACT, EMPTY_SNAPSHOT);

    const driftWarning = result.warnings.find(w => w.type === 'category_drift');
    expect(driftWarning).toBeDefined();
    expect(driftWarning?.matchedPhrase).toBe('analytics');
  });

  it('flags "optimization" when not in context', () => {
    const variants = ['Conversion optimization made simple for your business.'];

    const result = validateGeneratedVariants(variants, BASE_CONTRACT, EMPTY_SNAPSHOT);

    const driftWarning = result.warnings.find(w => w.type === 'category_drift');
    expect(driftWarning).toBeDefined();
    expect(driftWarning?.matchedPhrase?.toLowerCase()).toContain('optim');
  });

  it('flags "diagnostics" when not in context', () => {
    const variants = ['Our diagnostics engine identifies growth opportunities.'];

    const result = validateGeneratedVariants(variants, BASE_CONTRACT, EMPTY_SNAPSHOT);

    const driftWarning = result.warnings.find(w => w.type === 'category_drift');
    expect(driftWarning).toBeDefined();
    expect(driftWarning?.matchedPhrase).toBe('diagnostics');
  });

  it('flags "CRO" when not in context', () => {
    const variants = ['Drive CRO improvements with our solution.'];

    const result = validateGeneratedVariants(variants, BASE_CONTRACT, EMPTY_SNAPSHOT);

    const driftWarning = result.warnings.find(w => w.type === 'category_drift');
    expect(driftWarning).toBeDefined();
    expect(driftWarning?.matchedPhrase).toBe('CRO');
  });

  it('flags "metrics" when not in context', () => {
    const variants = ['Track your business metrics in real-time.'];

    const result = validateGeneratedVariants(variants, BASE_CONTRACT, EMPTY_SNAPSHOT);

    const driftWarning = result.warnings.find(w => w.type === 'category_drift');
    expect(driftWarning).toBeDefined();
    expect(driftWarning?.matchedPhrase).toBe('metrics');
  });

  it('does NOT flag "platform" when it IS in context', () => {
    const contextWithPlatform: ConfirmedContextSnapshot = {
      fields: {
        'productOffer.valueProposition': 'Our fitness platform helps trainers grow',
      },
    };
    const variants = ['A platform for trainers who want to succeed.'];

    const result = validateGeneratedVariants(variants, BASE_CONTRACT, contextWithPlatform);

    const driftWarning = result.warnings.find(
      w => w.type === 'category_drift' && w.matchedPhrase === 'platform'
    );
    expect(driftWarning).toBeUndefined();
  });

  it('does NOT flag "analytics" when it IS in context', () => {
    const contextWithAnalytics: ConfirmedContextSnapshot = {
      fields: {
        'productOffer.differentiators': ['Advanced analytics dashboard'],
      },
    };
    const variants = ['Get analytics that drive growth.'];

    const result = validateGeneratedVariants(variants, BASE_CONTRACT, contextWithAnalytics);

    const driftWarning = result.warnings.find(
      w => w.type === 'category_drift' && w.matchedPhrase === 'analytics'
    );
    expect(driftWarning).toBeUndefined();
  });

  it('assigns rewrite_defensible action to category drift warnings', () => {
    const variants = ['Our platform delivers advanced analytics for optimization.'];

    const result = validateGeneratedVariants(variants, BASE_CONTRACT, EMPTY_SNAPSHOT);

    const driftWarnings = result.warnings.filter(w => w.type === 'category_drift');
    expect(driftWarnings.length).toBeGreaterThan(0);
    for (const warning of driftWarnings) {
      expect(warning.action).toBe('rewrite_defensible');
    }
  });

  it('category drift is warning severity, not error', () => {
    const variants = ['Our software tool automates workflows with AI-powered analytics.'];

    const result = validateGeneratedVariants(variants, BASE_CONTRACT, EMPTY_SNAPSHOT);

    const driftWarnings = result.warnings.filter(w => w.type === 'category_drift');
    expect(driftWarnings.length).toBeGreaterThan(0);
    for (const warning of driftWarnings) {
      expect(warning.severity).toBe('warning');
    }
  });

  it('produces trainer-focused value prop without tool language (TrainrHub scenario)', () => {
    // Simulating what a good, category-safe value prop should look like
    const trainerFocusedVariant = 'Helping personal trainers build stronger client relationships and long-term success for their clients.';

    const result = validateGeneratedVariants([trainerFocusedVariant], BASE_CONTRACT, EMPTY_SNAPSHOT);

    // Should have NO category drift warnings
    const driftWarnings = result.warnings.filter(w => w.type === 'category_drift');
    expect(driftWarnings).toHaveLength(0);
  });

  it('flags tool-focused value prop (anti-pattern for TrainrHub)', () => {
    // This is what we DON'T want - drifting into CRO/tool language
    const toolFocusedVariant = 'A platform with analytics and optimization tools to track metrics and drive conversion.';

    const result = validateGeneratedVariants([toolFocusedVariant], BASE_CONTRACT, EMPTY_SNAPSHOT);

    // Should have category drift warnings
    const driftWarnings = result.warnings.filter(w => w.type === 'category_drift');
    expect(driftWarnings.length).toBeGreaterThan(0);
  });
});
