// tests/strategy/businessDefinitionGuardrail.test.ts
// Tests for Business Definition Guardrail functionality
//
// Covers:
// - BUSINESS_DEFINITION_KEYS constant
// - businessDefinitionMissing computed correctly in prompt builder
// - BUSINESS_DEFINITION_MISSING_RULE injection
// - Contract flags: requireBusinessDefinition, neutralIfMissingBusinessDefinition

import { describe, it, expect } from 'vitest';
import {
  BUSINESS_DEFINITION_KEYS,
  BUSINESS_DEFINITION_MISSING_RULE,
  getContract,
} from '@/lib/os/ai/strategyFieldContracts';
import {
  buildStrategyFieldPrompt,
  createSnapshotFromFields,
  type ConfirmedContextSnapshot,
} from '@/lib/os/ai/buildStrategyFieldPrompt';
import type { ContextFieldV4 } from '@/lib/types/contextField';

// ============================================================================
// Test Helpers
// ============================================================================

function createEmptySnapshot(): ConfirmedContextSnapshot {
  return {
    fields: {},
    raw: [],
  };
}

function createPartialBusinessDefinitionSnapshot(): ConfirmedContextSnapshot {
  // Only has ICP, missing other business definition fields
  const fields: ContextFieldV4[] = [
    {
      key: 'audience.icpDescription',
      domain: 'audience',
      value: 'Personal trainers looking to grow their client base',
      status: 'confirmed',
      source: 'user',
      updatedAt: new Date().toISOString(),
      confidence: 1.0,
    },
  ];
  return createSnapshotFromFields(fields);
}

function createCompleteBusinessDefinitionSnapshot(): ConfirmedContextSnapshot {
  const fields: ContextFieldV4[] = [
    {
      key: 'audience.icpDescription',
      domain: 'audience',
      value: 'Personal trainers looking to grow their client base',
      status: 'confirmed',
      source: 'user',
      updatedAt: new Date().toISOString(),
      confidence: 1.0,
    },
    {
      key: 'brand.positioning',
      domain: 'brand',
      value: 'The go-to marketplace for fitness professionals',
      status: 'confirmed',
      source: 'user',
      updatedAt: new Date().toISOString(),
      confidence: 1.0,
    },
    {
      key: 'brand.differentiators',
      domain: 'brand',
      value: 'Focus on certified trainers, verified reviews',
      status: 'confirmed',
      source: 'user',
      updatedAt: new Date().toISOString(),
      confidence: 1.0,
    },
    {
      key: 'identity.businessModel',
      domain: 'identity',
      value: 'Commission-based trainer marketplace',
      status: 'confirmed',
      source: 'user',
      updatedAt: new Date().toISOString(),
      confidence: 1.0,
    },
  ];
  return createSnapshotFromFields(fields);
}

// ============================================================================
// BUSINESS_DEFINITION_KEYS Constant Tests
// ============================================================================

describe('BUSINESS_DEFINITION_KEYS Constant', () => {
  it('should include all required business definition keys', () => {
    expect(BUSINESS_DEFINITION_KEYS).toContain('audience.icpDescription');
    expect(BUSINESS_DEFINITION_KEYS).toContain('brand.positioning');
    expect(BUSINESS_DEFINITION_KEYS).toContain('brand.differentiators');
    expect(BUSINESS_DEFINITION_KEYS).toContain('identity.businessModel');
  });

  it('should have exactly 4 business definition keys', () => {
    expect(BUSINESS_DEFINITION_KEYS).toHaveLength(4);
  });
});

// ============================================================================
// BUSINESS_DEFINITION_MISSING_RULE Constant Tests
// ============================================================================

describe('BUSINESS_DEFINITION_MISSING_RULE Constant', () => {
  it('should include CRO prohibition', () => {
    expect(BUSINESS_DEFINITION_MISSING_RULE).toContain('CRO');
    expect(BUSINESS_DEFINITION_MISSING_RULE).toContain('conversion rate optimization');
  });

  it('should include website analytics prohibition', () => {
    expect(BUSINESS_DEFINITION_MISSING_RULE).toContain('scroll depth');
    expect(BUSINESS_DEFINITION_MISSING_RULE).toContain('bounce rate');
  });

  it('should include neutral template format', () => {
    expect(BUSINESS_DEFINITION_MISSING_RULE).toContain('We help [audience] to [outcome]');
  });

  it('should include good examples', () => {
    expect(BUSINESS_DEFINITION_MISSING_RULE).toContain('We help small businesses grow their customer base');
    expect(BUSINESS_DEFINITION_MISSING_RULE).toContain('We help fitness trainers connect with clients');
  });

  it('should include bad examples', () => {
    expect(BUSINESS_DEFINITION_MISSING_RULE).toContain('Our platform optimizes your conversion funnel');
    expect(BUSINESS_DEFINITION_MISSING_RULE).toContain('Track user behavior and improve bounce rates');
  });
});

// ============================================================================
// Contract Flags Tests
// ============================================================================

describe('valueProp Contract Flags', () => {
  it('should have requireBusinessDefinition=true', () => {
    const contract = getContract('valueProp');
    expect(contract.requireBusinessDefinition).toBe(true);
  });

  it('should have neutralIfMissingBusinessDefinition=true', () => {
    const contract = getContract('valueProp');
    expect(contract.neutralIfMissingBusinessDefinition).toBe(true);
  });

  it('should include CRO guardrail in styleGuidance', () => {
    const contract = getContract('valueProp');
    expect(contract.styleGuidance).toContain('CRO');
    expect(contract.styleGuidance).toContain('conversion rate optimization');
  });
});

// ============================================================================
// Prompt Builder businessDefinitionMissing Tests
// ============================================================================

describe('buildStrategyFieldPrompt businessDefinitionMissing', () => {
  it('should set businessDefinitionMissing=true when all business definition keys are missing', () => {
    const snapshot = createEmptySnapshot();
    const result = buildStrategyFieldPrompt({
      fieldKey: 'valueProp',
      contextSnapshot: snapshot,
    });

    expect(result.generatedUsing.businessDefinitionMissing).toBe(true);
  });

  it('should set businessDefinitionMissing=true when some business definition keys are missing', () => {
    const snapshot = createPartialBusinessDefinitionSnapshot();
    const result = buildStrategyFieldPrompt({
      fieldKey: 'valueProp',
      contextSnapshot: snapshot,
    });

    expect(result.generatedUsing.businessDefinitionMissing).toBe(true);
  });

  it('should set businessDefinitionMissing=false when all business definition keys are present', () => {
    const snapshot = createCompleteBusinessDefinitionSnapshot();
    const result = buildStrategyFieldPrompt({
      fieldKey: 'valueProp',
      contextSnapshot: snapshot,
    });

    expect(result.generatedUsing.businessDefinitionMissing).toBe(false);
  });

  it('should include missingBusinessDefinitionKeys in metadata', () => {
    const snapshot = createPartialBusinessDefinitionSnapshot();
    const result = buildStrategyFieldPrompt({
      fieldKey: 'valueProp',
      contextSnapshot: snapshot,
    });

    expect(result.generatedUsing.missingBusinessDefinitionKeys).toBeDefined();
    expect(result.generatedUsing.missingBusinessDefinitionKeys.length).toBeGreaterThan(0);
    expect(result.generatedUsing.missingBusinessDefinitionKeys).not.toContain('audience.icpDescription');
  });
});

// ============================================================================
// Prompt Builder Rule Injection Tests
// ============================================================================

describe('BUSINESS_DEFINITION_MISSING_RULE injection', () => {
  it('should inject BUSINESS_DEFINITION_MISSING_RULE when businessDefinitionMissing=true', () => {
    const snapshot = createEmptySnapshot();
    const result = buildStrategyFieldPrompt({
      fieldKey: 'valueProp',
      contextSnapshot: snapshot,
    });

    expect(result.userPrompt).toContain('BUSINESS DEFINITION MISSING');
    expect(result.userPrompt).toContain('We help [audience] to [outcome]');
  });

  it('should inject neutral format requirement when businessDefinitionMissing=true', () => {
    const snapshot = createEmptySnapshot();
    const result = buildStrategyFieldPrompt({
      fieldKey: 'valueProp',
      contextSnapshot: snapshot,
    });

    expect(result.userPrompt).toContain('REQUIRED OUTPUT FORMAT (Neutral Mode Active)');
    expect(result.userPrompt).toContain('All variants MUST follow this exact template format');
  });

  it('should NOT inject BUSINESS_DEFINITION_MISSING_RULE when all keys present', () => {
    const snapshot = createCompleteBusinessDefinitionSnapshot();
    const result = buildStrategyFieldPrompt({
      fieldKey: 'valueProp',
      contextSnapshot: snapshot,
    });

    expect(result.userPrompt).not.toContain('BUSINESS DEFINITION MISSING');
    expect(result.userPrompt).not.toContain('REQUIRED OUTPUT FORMAT (Neutral Mode Active)');
  });
});

// ============================================================================
// Contract without requireBusinessDefinition Tests
// ============================================================================

describe('Contracts without requireBusinessDefinition', () => {
  it('should not set businessDefinitionMissing for positioning contract', () => {
    const snapshot = createEmptySnapshot();
    const result = buildStrategyFieldPrompt({
      fieldKey: 'positioning',
      contextSnapshot: snapshot,
    });

    // positioning contract doesn't have requireBusinessDefinition=true
    expect(result.generatedUsing.businessDefinitionMissing).toBe(false);
  });

  it('should not inject rule for contracts without requireBusinessDefinition', () => {
    const snapshot = createEmptySnapshot();
    const result = buildStrategyFieldPrompt({
      fieldKey: 'positioning',
      contextSnapshot: snapshot,
    });

    expect(result.userPrompt).not.toContain('BUSINESS DEFINITION MISSING');
  });
});
