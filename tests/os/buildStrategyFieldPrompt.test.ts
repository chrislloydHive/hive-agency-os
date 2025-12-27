// tests/os/buildStrategyFieldPrompt.test.ts
// Unit tests for Strategy Field Prompt Builder

import { describe, it, expect } from 'vitest';
import {
  buildStrategyFieldPrompt,
  createSnapshotFromFields,
  getGeneratedUsingSummary,
  type ConfirmedContextSnapshot,
} from '@/lib/os/ai/buildStrategyFieldPrompt';
import { getContract } from '@/lib/os/ai/strategyFieldContracts';
import type { ContextFieldV4 } from '@/lib/types/contextField';

// ============================================================================
// Test Fixtures
// ============================================================================

function makeField(
  key: string,
  value: unknown,
  status: 'confirmed' | 'proposed' | 'rejected' = 'confirmed'
): ContextFieldV4 {
  const [domain] = key.split('.');
  return {
    key,
    domain,
    value,
    status,
    source: 'user',
    confidence: 0.9,
    updatedAt: new Date().toISOString(),
  };
}

function makeSnapshot(
  fields: Record<string, unknown>
): ConfirmedContextSnapshot {
  return { fields };
}

const FULL_CONTEXT_SNAPSHOT = makeSnapshot({
  'audience.icpDescription': 'Mid-market SaaS companies with 50-200 employees seeking marketing automation',
  'audience.primaryAudience': 'B2B marketing leaders',
  'brand.positioning': 'The simplest marketing automation platform for growing SaaS teams',
  'productOffer.differentiators': ['No-code setup', 'Native CRM integration', '24/7 support'],
  'productOffer.valueProposition': 'Automate your marketing in hours, not weeks',
  'identity.businessModel': 'B2B SaaS subscription',
  'competition.primaryCompetitors': [
    { name: 'HubSpot', strength: 'Brand recognition' },
    { name: 'Marketo', strength: 'Enterprise features' },
  ],
  'competitive.positionSummary': 'Positioned as simpler alternative to enterprise solutions',
  'operationalConstraints.budgetCapsFloors': { min: 5000, max: 50000 },
  'operationalConstraints.resourceConstraints': 'Small marketing team (2-3 people)',
  'brand.toneOfVoice': 'Professional but approachable',
  'audience.painPoints': ['Complex onboarding', 'Lack of support', 'Hidden fees'],
});

const MINIMAL_CONTEXT_SNAPSHOT = makeSnapshot({
  'audience.icpDescription': 'Small business owners',
});

// ============================================================================
// Contract Retrieval Tests
// ============================================================================

describe('getContract', () => {
  it('returns valueProp contract', () => {
    const contract = getContract('valueProp');
    expect(contract.id).toBe('valueProp');
    expect(contract.label).toBe('Value Proposition');
    expect(contract.primaryInputs).toContain('audience.icpDescription');
  });

  it('returns positioning contract', () => {
    const contract = getContract('positioning');
    expect(contract.id).toBe('positioning');
    expect(contract.label).toBe('Positioning Statement');
  });

  it('throws for unknown field key', () => {
    expect(() => getContract('unknown' as any)).toThrow('No contract found');
  });
});

// ============================================================================
// Prompt Building Tests
// ============================================================================

describe('buildStrategyFieldPrompt', () => {
  it('builds prompt for valueProp with full context', () => {
    const result = buildStrategyFieldPrompt({
      fieldKey: 'valueProp',
      contextSnapshot: FULL_CONTEXT_SNAPSHOT,
    });

    // Check structure
    expect(result.systemPrompt).toBeTruthy();
    expect(result.userPrompt).toBeTruthy();
    expect(result.contract.id).toBe('valueProp');
    expect(result.variantCount).toBe(3);

    // Check user prompt contains primary inputs
    expect(result.userPrompt).toContain('ICP Description');
    expect(result.userPrompt).toContain('Mid-market SaaS companies');
    expect(result.userPrompt).toContain('Brand Positioning');
    expect(result.userPrompt).toContain('simplest marketing automation');
  });

  it('includes constraint values in prompt', () => {
    const result = buildStrategyFieldPrompt({
      fieldKey: 'valueProp',
      contextSnapshot: FULL_CONTEXT_SNAPSHOT,
    });

    expect(result.userPrompt).toContain('MUST NOT Violate');
    expect(result.userPrompt).toContain('Budget Constraints');
  });

  it('includes exclusions in prompt', () => {
    const result = buildStrategyFieldPrompt({
      fieldKey: 'valueProp',
      contextSnapshot: FULL_CONTEXT_SNAPSHOT,
    });

    expect(result.userPrompt).toContain('Do NOT Use These Phrases');
    expect(result.userPrompt).toContain('enterprise-grade');
    expect(result.userPrompt).toContain('AI-powered');
    expect(result.userPrompt).toContain('cutting-edge');
  });

  it('includes style guidance', () => {
    const result = buildStrategyFieldPrompt({
      fieldKey: 'valueProp',
      contextSnapshot: FULL_CONTEXT_SNAPSHOT,
    });

    expect(result.userPrompt).toContain('Style Guidance');
    expect(result.userPrompt).toContain('plainspoken');
  });

  it('reports correct used and missing keys', () => {
    const result = buildStrategyFieldPrompt({
      fieldKey: 'valueProp',
      contextSnapshot: FULL_CONTEXT_SNAPSHOT,
    });

    // Should have found these primary inputs
    expect(result.generatedUsing.usedPrimaryKeys).toContain('audience.icpDescription');
    expect(result.generatedUsing.usedPrimaryKeys).toContain('brand.positioning');
    expect(result.generatedUsing.usedPrimaryKeys).toContain('productOffer.differentiators');
    expect(result.generatedUsing.usedPrimaryKeys).toContain('identity.businessModel');

    // Should have found these constraints
    expect(result.generatedUsing.usedConstraintKeys).toContain('operationalConstraints.budgetCapsFloors');
    expect(result.generatedUsing.usedConstraintKeys).toContain('operationalConstraints.resourceConstraints');

    // Labels should be human-readable
    expect(result.generatedUsing.primaryLabels).toContain('ICP Description');
    expect(result.generatedUsing.constraintLabels).toContain('Budget Constraints');
  });

  it('reports missing primary inputs correctly', () => {
    const result = buildStrategyFieldPrompt({
      fieldKey: 'valueProp',
      contextSnapshot: MINIMAL_CONTEXT_SNAPSHOT,
    });

    // Should report missing keys
    expect(result.generatedUsing.missingPrimaryKeys).toContain('brand.positioning');
    expect(result.generatedUsing.missingPrimaryKeys).toContain('productOffer.differentiators');
    expect(result.generatedUsing.missingPrimaryKeys).toContain('identity.businessModel');

    // icpDescription should be found
    expect(result.generatedUsing.usedPrimaryKeys).toContain('audience.icpDescription');
    expect(result.generatedUsing.missingPrimaryKeys).not.toContain('audience.icpDescription');
  });

  it('handles currentValue for improvement mode', () => {
    const result = buildStrategyFieldPrompt({
      fieldKey: 'valueProp',
      contextSnapshot: FULL_CONTEXT_SNAPSHOT,
      currentValue: 'We help businesses grow faster with automation.',
    });

    expect(result.userPrompt).toContain('Current Value');
    expect(result.userPrompt).toContain('We help businesses grow faster');
    expect(result.userPrompt).toContain('Maintain the core intent');
  });

  it('respects variant count override', () => {
    const result = buildStrategyFieldPrompt({
      fieldKey: 'valueProp',
      contextSnapshot: FULL_CONTEXT_SNAPSHOT,
      variantCount: 5,
    });

    expect(result.variantCount).toBe(5);
    expect(result.userPrompt).toContain('5 alternative');
  });

  it('includes company name when provided', () => {
    const result = buildStrategyFieldPrompt({
      fieldKey: 'valueProp',
      contextSnapshot: FULL_CONTEXT_SNAPSHOT,
      companyName: 'Acme Corp',
    });

    expect(result.userPrompt).toContain('for Acme Corp');
  });

  it('formats array values correctly', () => {
    const result = buildStrategyFieldPrompt({
      fieldKey: 'valueProp',
      contextSnapshot: FULL_CONTEXT_SNAPSHOT,
    });

    // Differentiators is an array
    expect(result.userPrompt).toContain('No-code setup');
    expect(result.userPrompt).toContain('Native CRM integration');
  });

  it('formats competitor objects correctly', () => {
    const result = buildStrategyFieldPrompt({
      fieldKey: 'positioning',
      contextSnapshot: FULL_CONTEXT_SNAPSHOT,
    });

    // Competitors are objects with names
    expect(result.userPrompt).toContain('HubSpot');
    expect(result.userPrompt).toContain('Marketo');
  });

  it('handles missing values with [unknown] placeholder', () => {
    const result = buildStrategyFieldPrompt({
      fieldKey: 'valueProp',
      contextSnapshot: MINIMAL_CONTEXT_SNAPSHOT,
    });

    // Missing values should show as [unknown]
    expect(result.userPrompt).toContain('[unknown]');
  });
});

// ============================================================================
// Positioning Contract Tests
// ============================================================================

describe('buildStrategyFieldPrompt for positioning', () => {
  it('builds prompt with correct structure', () => {
    const result = buildStrategyFieldPrompt({
      fieldKey: 'positioning',
      contextSnapshot: FULL_CONTEXT_SNAPSHOT,
    });

    expect(result.contract.id).toBe('positioning');
    expect(result.userPrompt).toContain('Positioning Statement');
    expect(result.userPrompt).toContain('For [target customer]');
  });

  it('includes competitor context', () => {
    const result = buildStrategyFieldPrompt({
      fieldKey: 'positioning',
      contextSnapshot: FULL_CONTEXT_SNAPSHOT,
    });

    expect(result.generatedUsing.usedPrimaryKeys).toContain('competition.primaryCompetitors');
    expect(result.userPrompt).toContain('Primary Competitors');
  });

  it('excludes positioning-specific banned phrases', () => {
    const result = buildStrategyFieldPrompt({
      fieldKey: 'positioning',
      contextSnapshot: FULL_CONTEXT_SNAPSHOT,
    });

    expect(result.userPrompt).toContain('#1');
    expect(result.userPrompt).toContain('market leader');
    expect(result.userPrompt).toContain('unparalleled');
  });
});

// ============================================================================
// Snapshot Creation Tests
// ============================================================================

describe('createSnapshotFromFields', () => {
  it('creates snapshot from confirmed fields only', () => {
    const fields: ContextFieldV4[] = [
      makeField('audience.icpDescription', 'Small business owners', 'confirmed'),
      makeField('brand.positioning', 'Ignored proposal', 'proposed'),
      makeField('identity.businessModel', 'Rejected', 'rejected'),
      makeField('productOffer.valueProposition', 'Our value prop', 'confirmed'),
    ];

    const snapshot = createSnapshotFromFields(fields);

    // Only confirmed fields should be included
    expect(snapshot.fields['audience.icpDescription']).toBe('Small business owners');
    expect(snapshot.fields['productOffer.valueProposition']).toBe('Our value prop');
    expect(snapshot.fields['brand.positioning']).toBeUndefined();
    expect(snapshot.fields['identity.businessModel']).toBeUndefined();

    // Raw fields should be preserved
    expect(snapshot.raw).toHaveLength(4);
  });

  it('handles empty field array', () => {
    const snapshot = createSnapshotFromFields([]);
    expect(Object.keys(snapshot.fields)).toHaveLength(0);
  });
});

// ============================================================================
// Summary Generation Tests
// ============================================================================

describe('getGeneratedUsingSummary', () => {
  it('generates readable summary with primary inputs', () => {
    const summary = getGeneratedUsingSummary({
      usedPrimaryKeys: ['audience.icpDescription', 'brand.positioning'],
      usedConstraintKeys: [],
      missingPrimaryKeys: [],
      usedSecondaryKeys: [],
      primaryLabels: ['ICP Description', 'Brand Positioning'],
      usedFallbackKeys: [],
      fallbackLabels: [],
      constraintLabels: [],
      categorySafetyMode: false,
      missingCategorySafetyKeys: [],
      goalAlignmentActive: false,
      businessDefinitionMissing: false,
      missingBusinessDefinitionKeys: [],
    });

    expect(summary).toBe('Generated using: ICP Description + Brand Positioning');
  });

  it('includes constraints in summary', () => {
    const summary = getGeneratedUsingSummary({
      usedPrimaryKeys: ['audience.icpDescription'],
      usedConstraintKeys: ['operationalConstraints.budgetCapsFloors'],
      missingPrimaryKeys: [],
      usedSecondaryKeys: [],
      primaryLabels: ['ICP Description'],
      usedFallbackKeys: [],
      fallbackLabels: [],
      constraintLabels: ['Budget Constraints'],
      categorySafetyMode: false,
      missingCategorySafetyKeys: [],
      goalAlignmentActive: false,
      businessDefinitionMissing: false,
      missingBusinessDefinitionKeys: [],
    });

    expect(summary).toContain('ICP Description');
    expect(summary).toContain('Constraints: Budget Constraints');
  });

  it('handles empty usage gracefully', () => {
    const summary = getGeneratedUsingSummary({
      usedPrimaryKeys: [],
      usedConstraintKeys: [],
      missingPrimaryKeys: ['audience.icpDescription'],
      usedSecondaryKeys: [],
      primaryLabels: [],
      usedFallbackKeys: [],
      fallbackLabels: [],
      constraintLabels: [],
      categorySafetyMode: true,
      missingCategorySafetyKeys: ['audience.icpDescription'],
      goalAlignmentActive: false,
      businessDefinitionMissing: true,
      missingBusinessDefinitionKeys: ['audience.icpDescription'],
    });

    expect(summary).toBe('No confirmed context used');
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('edge cases', () => {
  it('handles null values in context', () => {
    const snapshot = makeSnapshot({
      'audience.icpDescription': null,
      'brand.positioning': 'Valid value',
    });

    const result = buildStrategyFieldPrompt({
      fieldKey: 'valueProp',
      contextSnapshot: snapshot,
    });

    // null should be treated as missing
    expect(result.generatedUsing.missingPrimaryKeys).toContain('audience.icpDescription');
    expect(result.userPrompt).toContain('[unknown]');
  });

  it('handles empty arrays in context', () => {
    const snapshot = makeSnapshot({
      'productOffer.differentiators': [],
      'audience.icpDescription': 'Valid ICP',
    });

    const result = buildStrategyFieldPrompt({
      fieldKey: 'valueProp',
      contextSnapshot: snapshot,
    });

    expect(result.userPrompt).toContain('[none specified]');
  });

  it('handles deeply nested objects', () => {
    const snapshot = makeSnapshot({
      'operationalConstraints.budgetCapsFloors': {
        min: 5000,
        max: 50000,
        currency: 'USD',
        period: 'monthly',
      },
      'audience.icpDescription': 'Valid ICP',
    });

    const result = buildStrategyFieldPrompt({
      fieldKey: 'valueProp',
      contextSnapshot: snapshot,
    });

    // Should stringify complex objects
    expect(result.userPrompt).toContain('5000');
    expect(result.userPrompt).toContain('50000');
  });

  it('system prompt requests JSON output', () => {
    const result = buildStrategyFieldPrompt({
      fieldKey: 'valueProp',
      contextSnapshot: FULL_CONTEXT_SNAPSHOT,
    });

    expect(result.systemPrompt).toContain('JSON');
    expect(result.systemPrompt).toContain('variants');
  });
});

// ============================================================================
// Contract Integrity Tests
// ============================================================================

// ============================================================================
// Category Safety Mode Tests
// ============================================================================

describe('category safety mode', () => {
  const TRAINRHUB_CONTEXT = makeSnapshot({
    'audience.primaryAudience': 'Personal trainers and fitness coaches',
    'audience.painPoints': ['Client retention', 'Scheduling complexity'],
    // Note: Missing icpDescription, positioning, differentiators, businessModel
  });

  const PARTIAL_CONTEXT = makeSnapshot({
    'audience.icpDescription': 'Fitness professionals building online coaching businesses',
    // Note: Missing positioning, differentiators, businessModel
  });

  it('activates category safety mode when strategic anchors are missing', () => {
    const result = buildStrategyFieldPrompt({
      fieldKey: 'valueProp',
      contextSnapshot: TRAINRHUB_CONTEXT,
    });

    expect(result.generatedUsing.categorySafetyMode).toBe(true);
    expect(result.generatedUsing.missingCategorySafetyKeys.length).toBeGreaterThan(0);
  });

  it('deactivates category safety mode when all anchors present', () => {
    const result = buildStrategyFieldPrompt({
      fieldKey: 'valueProp',
      contextSnapshot: FULL_CONTEXT_SNAPSHOT,
    });

    expect(result.generatedUsing.categorySafetyMode).toBe(false);
    expect(result.generatedUsing.missingCategorySafetyKeys).toHaveLength(0);
  });

  it('injects CATEGORY_SAFETY_RULE into prompt when mode is active', () => {
    const result = buildStrategyFieldPrompt({
      fieldKey: 'valueProp',
      contextSnapshot: TRAINRHUB_CONTEXT,
    });

    expect(result.userPrompt).toContain('CATEGORY SAFETY MODE');
    expect(result.userPrompt).toContain('Do NOT assume product features');
    expect(result.userPrompt).toContain('Do NOT imply diagnostics');
    expect(result.userPrompt).toContain('ONLY describe WHO the product is for');
  });

  it('does not inject CATEGORY_SAFETY_RULE when mode is inactive', () => {
    const result = buildStrategyFieldPrompt({
      fieldKey: 'valueProp',
      contextSnapshot: FULL_CONTEXT_SNAPSHOT,
    });

    expect(result.userPrompt).not.toContain('CATEGORY SAFETY MODE');
    expect(result.userPrompt).not.toContain('Do NOT assume product features');
  });

  it('reports missing ICP description in category safety keys', () => {
    const result = buildStrategyFieldPrompt({
      fieldKey: 'valueProp',
      contextSnapshot: makeSnapshot({
        'brand.positioning': 'Some positioning',
        'productOffer.differentiators': ['Differentiator'],
        'identity.businessModel': 'B2B SaaS',
        // Missing icpDescription
      }),
    });

    expect(result.generatedUsing.categorySafetyMode).toBe(true);
    expect(result.generatedUsing.missingCategorySafetyKeys).toContain('audience.icpDescription');
  });

  it('reports missing positioning in category safety keys', () => {
    const result = buildStrategyFieldPrompt({
      fieldKey: 'valueProp',
      contextSnapshot: makeSnapshot({
        'audience.icpDescription': 'Some ICP',
        'productOffer.differentiators': ['Differentiator'],
        'identity.businessModel': 'B2B SaaS',
        // Missing positioning
      }),
    });

    expect(result.generatedUsing.categorySafetyMode).toBe(true);
    expect(result.generatedUsing.missingCategorySafetyKeys).toContain('brand.positioning');
  });

  it('reports missing differentiators in category safety keys', () => {
    const result = buildStrategyFieldPrompt({
      fieldKey: 'valueProp',
      contextSnapshot: makeSnapshot({
        'audience.icpDescription': 'Some ICP',
        'brand.positioning': 'Some positioning',
        'identity.businessModel': 'B2B SaaS',
        // Missing differentiators
      }),
    });

    expect(result.generatedUsing.categorySafetyMode).toBe(true);
    expect(result.generatedUsing.missingCategorySafetyKeys).toContain('productOffer.differentiators');
  });

  it('reports missing business model in category safety keys', () => {
    const result = buildStrategyFieldPrompt({
      fieldKey: 'valueProp',
      contextSnapshot: makeSnapshot({
        'audience.icpDescription': 'Some ICP',
        'brand.positioning': 'Some positioning',
        'productOffer.differentiators': ['Differentiator'],
        // Missing businessModel
      }),
    });

    expect(result.generatedUsing.categorySafetyMode).toBe(true);
    expect(result.generatedUsing.missingCategorySafetyKeys).toContain('identity.businessModel');
  });

  it('TrainrHub-style context activates safety mode preventing tool-focused language', () => {
    // This is the specific scenario from the requirements
    const trainrHubResult = buildStrategyFieldPrompt({
      fieldKey: 'valueProp',
      contextSnapshot: TRAINRHUB_CONTEXT,
    });

    // Safety mode should be active
    expect(trainrHubResult.generatedUsing.categorySafetyMode).toBe(true);

    // Prompt should contain safety rules
    expect(trainrHubResult.userPrompt).toContain('analytics');
    expect(trainrHubResult.userPrompt).toContain('optimization');
    expect(trainrHubResult.userPrompt).toContain('CRO');

    // The prompt should tell the AI NOT to use these terms
    expect(trainrHubResult.userPrompt).toContain('Do NOT imply diagnostics');
  });
});

describe('contract integrity', () => {
  it('valueProp contract has required fields', () => {
    const contract = getContract('valueProp');

    expect(contract.primaryInputs.length).toBeGreaterThan(0);
    expect(contract.exclusions).toBeDefined();
    expect(contract.exclusions!.length).toBeGreaterThan(5);
    expect(contract.styleGuidance).toBeTruthy();
    expect(contract.outputSpec.variants).toBe(3);
    expect(contract.outputSpec.maxWords).toBeGreaterThan(0);
  });

  it('valueProp contract has category safety inputs', () => {
    const contract = getContract('valueProp');

    expect(contract.categorySafetyInputs).toBeDefined();
    expect(contract.categorySafetyInputs).toContain('audience.icpDescription');
    expect(contract.categorySafetyInputs).toContain('brand.positioning');
    expect(contract.categorySafetyInputs).toContain('productOffer.differentiators');
    expect(contract.categorySafetyInputs).toContain('identity.businessModel');
  });

  it('positioning contract has required fields', () => {
    const contract = getContract('positioning');

    expect(contract.primaryInputs.length).toBeGreaterThan(0);
    expect(contract.primaryInputs).toContain('audience.icpDescription');
    expect(contract.primaryInputs).toContain('competition.primaryCompetitors');
    expect(contract.exclusions).toBeDefined();
    expect(contract.styleGuidance).toContain('For [target customer]');
  });

  it('all contracts have valid output specs', () => {
    const fieldKeys = ['valueProp', 'positioning', 'audience'] as const;

    for (const key of fieldKeys) {
      const contract = getContract(key);
      expect(contract.outputSpec.variants).toBeGreaterThan(0);
      expect(contract.outputSpec.maxWords).toBeGreaterThan(0);
      expect(['paragraph', 'bullets']).toContain(contract.outputSpec.format);
    }
  });
});

describe('GAP fallback business definition', () => {
  it('injects GAP summary instead of neutral rule when business definition is missing', () => {
    const gapSummary = 'TrainrHub connects people with certified personal trainers for flexible sessions and programs.';

    const result = buildStrategyFieldPrompt({
      fieldKey: 'valueProp',
      contextSnapshot: { fields: {} },
      fallbackInputs: { 'gap.businessSummary': gapSummary },
    });

    expect(result.generatedUsing.usedFallbackKeys).toContain('gap.businessSummary');
    expect(result.userPrompt).toContain('GAP-derived business summary');
    expect(result.userPrompt).toContain('TrainrHub connects people');
    expect(result.userPrompt).not.toContain('BUSINESS DEFINITION MISSING (Neutral Mode Required)');
  });
});
