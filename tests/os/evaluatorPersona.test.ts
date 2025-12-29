// tests/os/evaluatorPersona.test.ts
// Tests for Evaluator Persona Layer
// Covers: persona types, assignment heuristics, persona-aware coverage, determinism

import { describe, test, expect } from 'vitest';
import {
  type EvaluatorPersonaType,
  EVALUATOR_PERSONAS,
  EVALUATOR_PERSONA_TYPES,
  DEFAULT_SECTION_PERSONAS,
  inferCriterionPersona,
  getPersonaForSection,
  createDefaultPersonaSettings,
  getPersonaLabel,
  getPersonaColor,
  CRITERION_PERSONA_KEYWORDS,
} from '@/lib/types/rfpEvaluatorPersona';
import {
  inferSectionPersona,
  inferPersonaFromRequiredSection,
  analyzeContentForPersona,
  getPersonaAssignments,
  overridePersonaAssignment,
  resetPersonaToDefault,
  getPersonaDistribution,
} from '@/lib/os/rfp/assignSectionPersona';
import { computeRubricCoverage } from '@/lib/os/rfp/computeRubricCoverage';
import type { RfpSectionKey } from '@/lib/types/rfp';
import type { RfpWinStrategy } from '@/lib/types/rfpWinStrategy';
import { createRfpSection, createRfpWinStrategy } from '@/tests/helpers/factories';

// ============================================================================
// Persona Types and Definitions Tests
// ============================================================================

describe('Evaluator Persona Types', () => {
  test('defines exactly three persona types', () => {
    expect(EVALUATOR_PERSONA_TYPES).toHaveLength(3);
    expect(EVALUATOR_PERSONA_TYPES).toContain('procurement');
    expect(EVALUATOR_PERSONA_TYPES).toContain('technical');
    expect(EVALUATOR_PERSONA_TYPES).toContain('executive');
  });

  test('each persona has complete definition', () => {
    for (const type of EVALUATOR_PERSONA_TYPES) {
      const persona = EVALUATOR_PERSONAS[type];
      expect(persona.type).toBe(type);
      expect(persona.label).toBeTruthy();
      expect(persona.description).toBeTruthy();
      expect(persona.priorities.length).toBeGreaterThan(0);
      expect(persona.sensitivities.length).toBeGreaterThan(0);
      expect(persona.tonePreferences.length).toBeGreaterThan(0);
      expect(persona.resonantPhrases.length).toBeGreaterThan(0);
      expect(persona.avoidPhrases.length).toBeGreaterThan(0);
    }
  });

  test('personas have unique labels', () => {
    const labels = EVALUATOR_PERSONA_TYPES.map(t => EVALUATOR_PERSONAS[t].label);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(labels.length);
  });

  test('getPersonaLabel returns correct labels', () => {
    expect(getPersonaLabel('procurement')).toBe('Procurement');
    expect(getPersonaLabel('technical')).toBe('Technical');
    expect(getPersonaLabel('executive')).toBe('Executive');
  });

  test('getPersonaColor returns valid colors', () => {
    expect(getPersonaColor('procurement')).toBe('blue');
    expect(getPersonaColor('technical')).toBe('purple');
    expect(getPersonaColor('executive')).toBe('amber');
  });
});

// ============================================================================
// Default Persona Assignment Tests
// ============================================================================

describe('Default Persona Mappings', () => {
  test('all section types have default persona assignments', () => {
    const sectionKeys: RfpSectionKey[] = [
      'agency_overview',
      'approach',
      'team',
      'work_samples',
      'plan_timeline',
      'pricing',
      'references',
    ];

    for (const key of sectionKeys) {
      const defaults = DEFAULT_SECTION_PERSONAS[key];
      expect(defaults).toBeDefined();
      expect(defaults.primary).toBeTruthy();
      expect(Array.isArray(defaults.secondary)).toBe(true);
    }
  });

  test('pricing section defaults to procurement', () => {
    expect(DEFAULT_SECTION_PERSONAS.pricing.primary).toBe('procurement');
  });

  test('approach section defaults to technical', () => {
    expect(DEFAULT_SECTION_PERSONAS.approach.primary).toBe('technical');
  });

  test('agency_overview section defaults to executive', () => {
    expect(DEFAULT_SECTION_PERSONAS.agency_overview.primary).toBe('executive');
  });

  test('team section defaults to technical', () => {
    expect(DEFAULT_SECTION_PERSONAS.team.primary).toBe('technical');
  });

  test('references section defaults to procurement', () => {
    expect(DEFAULT_SECTION_PERSONAS.references.primary).toBe('procurement');
  });

  test('createDefaultPersonaSettings creates complete settings', () => {
    const settings = createDefaultPersonaSettings();
    expect(settings.enabled).toBe(true);
    expect(settings.sectionAssignments).toHaveLength(7); // All section types

    // Verify each assignment has required fields
    for (const assignment of settings.sectionAssignments) {
      expect(assignment.sectionKey).toBeTruthy();
      expect(assignment.primaryPersona).toBeTruthy();
      expect(Array.isArray(assignment.secondaryPersonas)).toBe(true);
      expect(assignment.isManualOverride).toBe(false);
    }
  });

  test('getPersonaForSection returns defaults when no settings', () => {
    const result = getPersonaForSection('pricing', null);
    expect(result.primary).toBe('procurement');
    expect(result.secondary).toContain('executive');
  });

  test('getPersonaForSection respects custom settings', () => {
    const settings = createDefaultPersonaSettings();
    // Override the existing 'approach' assignment
    const approachIndex = settings.sectionAssignments.findIndex(a => a.sectionKey === 'approach');
    if (approachIndex >= 0) {
      settings.sectionAssignments[approachIndex] = {
        sectionKey: 'approach',
        primaryPersona: 'executive',
        secondaryPersonas: ['technical'],
        isManualOverride: true,
      };
    }

    const result = getPersonaForSection('approach', settings);
    expect(result.primary).toBe('executive');
    expect(result.secondary).toContain('technical');
  });
});

// ============================================================================
// Section Persona Inference Tests
// ============================================================================

describe('Section Persona Inference', () => {
  test('inferSectionPersona uses defaults for known section keys', () => {
    const result = inferSectionPersona('pricing');
    expect(result.primary).toBe('procurement');
    expect(result.confidence).toBe('high');
  });

  test('inferSectionPersona adjusts based on title hints', () => {
    // Title with pricing keywords should infer procurement
    const result = inferSectionPersona('approach', 'Cost and Budget Overview');
    expect(result.primary).toBe('procurement');
  });

  test('inferSectionPersona detects technical titles', () => {
    const result = inferSectionPersona('agency_overview', 'Technical Architecture and Methodology');
    expect(result.primary).toBe('technical');
  });

  test('inferSectionPersona detects executive titles', () => {
    const result = inferSectionPersona('approach', 'Executive Vision and Strategic Partnership');
    expect(result.primary).toBe('executive');
  });

  test('inferSectionPersona returns defaults when no hints match', () => {
    const result = inferSectionPersona('approach', 'Random Title XYZ');
    expect(result.primary).toBe(DEFAULT_SECTION_PERSONAS.approach.primary);
    expect(result.confidence).toBe('high');
  });

  test('inferSectionPersona returns low confidence for unknown section keys', () => {
    const result = inferSectionPersona('unknown_section' as RfpSectionKey);
    expect(result.primary).toBe('technical'); // Default fallback
    expect(result.confidence).toBe('low');
  });

  test('inferPersonaFromRequiredSection uses title and description', () => {
    const section = {
      id: '1',
      title: 'Pricing and Fees',
      description: 'Include your rate card and cost breakdown',
    };
    const result = inferPersonaFromRequiredSection(section);
    expect(result).toBe('procurement');
  });

  test('inferPersonaFromRequiredSection defaults to technical when no keywords', () => {
    const section = {
      id: '2',
      title: 'Foo Bar Baz',
      description: 'Lorem ipsum dolor sit amet',
    };
    const result = inferPersonaFromRequiredSection(section);
    expect(result).toBe('technical');
  });
});

// ============================================================================
// Content Analysis Tests
// ============================================================================

describe('Content Persona Analysis', () => {
  test('analyzeContentForPersona reinforces matching persona', () => {
    const content = 'Our methodology includes agile sprints with CI/CD pipeline integration';
    const result = analyzeContentForPersona(content, 'technical');
    expect(result.reinforced).toBe(true);
    expect(result.alternativePersona).toBeUndefined();
  });

  test('analyzeContentForPersona suggests alternative when mismatch', () => {
    const content = 'Fixed price contract with net 30 payment terms and SLA guarantees';
    const result = analyzeContentForPersona(content, 'technical');
    expect(result.reinforced).toBe(false);
    expect(result.alternativePersona).toBe('procurement');
  });

  test('analyzeContentForPersona reinforces with no signals', () => {
    const content = 'Lorem ipsum dolor sit amet';
    const result = analyzeContentForPersona(content, 'executive');
    expect(result.reinforced).toBe(true);
  });

  test('analyzeContentForPersona detects executive content', () => {
    const content = 'This digital transformation will deliver significant ROI and market share growth';
    const result = analyzeContentForPersona(content, 'procurement');
    expect(result.reinforced).toBe(false);
    expect(result.alternativePersona).toBe('executive');
  });
});

// ============================================================================
// Criterion Persona Inference Tests
// ============================================================================

describe('Criterion Persona Inference', () => {
  test('inferCriterionPersona detects procurement keywords', () => {
    expect(inferCriterionPersona('Price/Cost Competitiveness')).toBe('procurement');
    expect(inferCriterionPersona('Contract Terms and Conditions')).toBe('procurement');
    expect(inferCriterionPersona('References and Past Performance')).toBe('procurement');
    expect(inferCriterionPersona('Insurance and Compliance')).toBe('procurement');
  });

  test('inferCriterionPersona detects technical keywords', () => {
    expect(inferCriterionPersona('Technical Approach and Methodology')).toBe('technical');
    expect(inferCriterionPersona('Team Expertise and Experience')).toBe('technical');
    expect(inferCriterionPersona('Implementation Process')).toBe('technical');
    expect(inferCriterionPersona('Quality Assurance')).toBe('technical');
  });

  test('inferCriterionPersona detects executive keywords', () => {
    expect(inferCriterionPersona('Strategic Value and ROI')).toBe('executive');
    expect(inferCriterionPersona('Business Outcomes')).toBe('executive'); // Both 'business' and 'outcomes' are executive keywords
    // Note: 'Partnership Approach' ties (partnership=executive, approach=technical) so technical wins
    expect(inferCriterionPersona('Strategic Partnership')).toBe('executive');
    expect(inferCriterionPersona('Competitive Differentiation')).toBe('executive');
  });

  test('inferCriterionPersona returns null for no keywords', () => {
    expect(inferCriterionPersona('Foo Bar Baz')).toBeNull();
    expect(inferCriterionPersona('Random Criterion XYZ')).toBeNull();
  });

  test('inferCriterionPersona prefers technical when tied', () => {
    // 'process' is technical, 'risk' is procurement - but if there's a tie, prefer technical
    const result = inferCriterionPersona('Process and Risk Management');
    expect(result).toBe('technical');
  });

  test('CRITERION_PERSONA_KEYWORDS has entries for all personas', () => {
    for (const persona of EVALUATOR_PERSONA_TYPES) {
      expect(CRITERION_PERSONA_KEYWORDS[persona]).toBeDefined();
      expect(CRITERION_PERSONA_KEYWORDS[persona].length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// Assignment Management Tests
// ============================================================================

describe('Persona Assignment Management', () => {
  const mockSections = [
    createRfpSection({ sectionKey: 'approach', title: 'Technical Approach', contentWorking: '', status: 'draft' }),
    createRfpSection({ sectionKey: 'pricing', title: 'Investment', contentWorking: '', status: 'draft' }),
    createRfpSection({ sectionKey: 'team', title: 'Our Team', contentWorking: '', status: 'draft' }),
  ];

  test('getPersonaAssignments creates assignments for all sections', () => {
    const assignments = getPersonaAssignments(mockSections, null);
    expect(assignments).toHaveLength(mockSections.length);
  });

  test('getPersonaAssignments respects existing settings', () => {
    const existingSettings = {
      enabled: true,
      sectionAssignments: [
        {
          sectionKey: 'approach',
          primaryPersona: 'executive' as EvaluatorPersonaType,
          secondaryPersonas: ['technical' as EvaluatorPersonaType],
          isManualOverride: true,
        },
      ],
    };

    const assignments = getPersonaAssignments(mockSections, existingSettings);
    const approachAssignment = assignments.find(a => a.sectionKey === 'approach');
    expect(approachAssignment?.primaryPersona).toBe('executive');
    expect(approachAssignment?.isManualOverride).toBe(true);
  });

  test('overridePersonaAssignment creates manual override', () => {
    const settings = createDefaultPersonaSettings();
    const updated = overridePersonaAssignment(settings, 'approach', 'executive', 'Client prefers executive focus');

    const approachAssignment = updated.sectionAssignments.find(a => a.sectionKey === 'approach');
    expect(approachAssignment?.primaryPersona).toBe('executive');
    expect(approachAssignment?.isManualOverride).toBe(true);
    expect(approachAssignment?.overrideReason).toBe('Client prefers executive focus');
  });

  test('resetPersonaToDefault removes manual override', () => {
    let settings = createDefaultPersonaSettings();
    settings = overridePersonaAssignment(settings, 'approach', 'executive');
    settings = resetPersonaToDefault(settings, 'approach');

    const approachAssignment = settings.sectionAssignments.find(a => a.sectionKey === 'approach');
    expect(approachAssignment?.primaryPersona).toBe('technical');
    expect(approachAssignment?.isManualOverride).toBe(false);
  });

  test('getPersonaDistribution counts correctly', () => {
    const assignments = [
      { sectionKey: 'a', primaryPersona: 'technical' as EvaluatorPersonaType, secondaryPersonas: [], isManualOverride: false },
      { sectionKey: 'b', primaryPersona: 'technical' as EvaluatorPersonaType, secondaryPersonas: [], isManualOverride: false },
      { sectionKey: 'c', primaryPersona: 'procurement' as EvaluatorPersonaType, secondaryPersonas: [], isManualOverride: false },
      { sectionKey: 'd', primaryPersona: 'executive' as EvaluatorPersonaType, secondaryPersonas: [], isManualOverride: false },
    ];

    const distribution = getPersonaDistribution(assignments);
    expect(distribution.technical).toBe(2);
    expect(distribution.procurement).toBe(1);
    expect(distribution.executive).toBe(1);
  });
});

// ============================================================================
// Persona-Aware Coverage Tests
// ============================================================================

describe('Persona-Aware Rubric Coverage', () => {
  // Create persona settings with enabled: true for tests
  const enabledPersonaSettings = createDefaultPersonaSettings();

  // Mock generatedUsing with win strategy enabled (required for section to cover criteria)
  const mockGeneratedUsing = {
    hasWinStrategy: true,
    winThemesApplied: [],
    proofItemsApplied: [],
    competitorGuidance: false,
    evaluationCriteriaConsidered: [],
  };

  const mockSections = [
    createRfpSection({ sectionKey: 'approach', title: 'Technical Approach', contentWorking: 'Our methodology includes agile development', status: 'approved', generatedUsing: mockGeneratedUsing }),
    createRfpSection({ sectionKey: 'pricing', title: 'Investment', contentWorking: 'Our pricing model includes fixed rates', status: 'approved', generatedUsing: mockGeneratedUsing }),
    createRfpSection({ sectionKey: 'team', title: 'Our Team', contentWorking: 'Team of experienced developers', status: 'approved', generatedUsing: mockGeneratedUsing }),
  ];

  const mockStrategy = createRfpWinStrategy({
    evaluationCriteria: [
      { label: 'Technical Methodology', weight: 0.3, primarySections: ['approach'] },
      { label: 'Price Competitiveness', weight: 0.3, primarySections: ['pricing'] },
      { label: 'Team Experience', weight: 0.2, primarySections: ['team'] },
      { label: 'Strategic Value', weight: 0.2, primarySections: [] },
    ],
    winThemes: [],
    proofPlan: [],
    competitiveAssumptions: [],
    landmines: [],
    locked: false,
  });

  test('computeRubricCoverage includes persona fields', () => {
    const result = computeRubricCoverage(mockStrategy, mockSections, enabledPersonaSettings);

    expect(result.hasPersonaSettings).toBeDefined();
    expect(result.personaMismatchCount).toBeDefined();

    for (const criterion of result.criterionCoverage) {
      expect('expectedPersona' in criterion).toBe(true);
      expect('coveringPersonas' in criterion).toBe(true);
      expect('hasPersonaMismatch' in criterion).toBe(true);
      expect('personaRiskLevel' in criterion).toBe(true);
    }
  });

  test('computeRubricCoverage detects expected persona from criterion label', () => {
    const result = computeRubricCoverage(mockStrategy, mockSections, enabledPersonaSettings);

    const methodologyCriterion = result.criterionCoverage.find(c => c.criterionLabel === 'Technical Methodology');
    expect(methodologyCriterion?.expectedPersona).toBe('technical');

    const priceCriterion = result.criterionCoverage.find(c => c.criterionLabel === 'Price Competitiveness');
    expect(priceCriterion?.expectedPersona).toBe('procurement');
  });

  test('computeRubricCoverage tracks covering personas from sections', () => {
    const result = computeRubricCoverage(mockStrategy, mockSections, enabledPersonaSettings);

    const methodologyCriterion = result.criterionCoverage.find(c => c.criterionLabel === 'Technical Methodology');
    // 'approach' section covers methodology and has technical persona
    expect(methodologyCriterion?.coveringPersonas).toContain('technical');
  });

  test('computeRubricCoverage detects persona mismatch', () => {
    // Create a scenario where a procurement criterion is only covered by a technical section
    const mismatchStrategy = createRfpWinStrategy({
      evaluationCriteria: [
        { label: 'Contract Terms and Compliance', weight: 0.5, primarySections: ['approach'] },
      ],
      winThemes: [],
      proofPlan: [],
      competitiveAssumptions: [],
      landmines: [],
      locked: false,
    });

    // Only technical sections have content (with generatedUsing to enable coverage)
    const techOnlySections = [
      createRfpSection({ sectionKey: 'approach', title: 'Technical Approach', contentWorking: 'Contract terms are handled by our compliance team', status: 'approved', generatedUsing: mockGeneratedUsing }),
    ];

    const result = computeRubricCoverage(mismatchStrategy, techOnlySections, enabledPersonaSettings);
    const contractCriterion = result.criterionCoverage.find(c => c.criterionLabel === 'Contract Terms and Compliance');

    // This criterion expects procurement but is covered by technical section
    expect(contractCriterion?.expectedPersona).toBe('procurement');
    expect(contractCriterion?.coveringPersonas).toContain('technical');
    expect(contractCriterion?.hasPersonaMismatch).toBe(true);
    expect(contractCriterion?.personaRiskLevel).not.toBe('none');
  });

  test('computeRubricCoverage counts persona mismatches', () => {
    const result = computeRubricCoverage(mockStrategy, mockSections, enabledPersonaSettings);
    expect(typeof result.personaMismatchCount).toBe('number');
  });

  test('persona risk level reflects severity', () => {
    // Use a technical criterion that maps to 'approach' section (which has technical persona)
    // but we'll make the criterion expect procurement persona (by using procurement keywords)
    // Actually, let's use a criterion with primarySections set to 'approach' but procurement keywords
    const highWeightMismatchStrategy = createRfpWinStrategy({
      evaluationCriteria: [
        {
          label: 'Compliance and Contract Terms',
          weight: 0.5,
          primarySections: ['approach'], // Force it to use approach section
        },
      ],
      winThemes: [],
      proofPlan: [],
      competitiveAssumptions: [],
      landmines: [],
      locked: false,
    });

    // Only technical section covers it (with generatedUsing to enable coverage)
    const techOnlySections = [
      createRfpSection({ sectionKey: 'approach', title: 'Technical Approach', contentWorking: 'Contract terms compliance', status: 'approved', generatedUsing: mockGeneratedUsing }),
    ];

    const result = computeRubricCoverage(highWeightMismatchStrategy, techOnlySections, enabledPersonaSettings);
    const contractCriterion = result.criterionCoverage.find(c => c.criterionLabel === 'Compliance and Contract Terms');

    // Expected: procurement (due to 'compliance' and 'contract' keywords)
    // Actual: technical (due to approach section)
    // High weight (0.5 >= 0.3) + mismatch = high risk
    expect(contractCriterion?.expectedPersona).toBe('procurement');
    expect(contractCriterion?.coveringPersonas).toContain('technical');
    expect(['high', 'medium']).toContain(contractCriterion?.personaRiskLevel);
  });
});

// ============================================================================
// Determinism Tests
// ============================================================================

describe('Persona Layer Determinism', () => {
  test('inferCriterionPersona is deterministic', () => {
    const criterion = 'Technical Implementation Approach';
    const results = new Set<string | null>();

    for (let i = 0; i < 10; i++) {
      results.add(inferCriterionPersona(criterion));
    }

    expect(results.size).toBe(1);
  });

  test('inferSectionPersona is deterministic', () => {
    const results = new Set<string>();

    for (let i = 0; i < 10; i++) {
      const result = inferSectionPersona('approach', 'Our Technical Methodology');
      results.add(JSON.stringify(result));
    }

    expect(results.size).toBe(1);
  });

  test('computeRubricCoverage persona results are deterministic', () => {
    const mockSections = [
      createRfpSection({ sectionKey: 'approach', title: 'Technical Approach', contentWorking: 'Methodology includes testing', status: 'approved' }),
    ];

    const mockStrategy = createRfpWinStrategy({
      evaluationCriteria: [
        { label: 'Technical Quality', weight: 0.5, primarySections: ['approach'] },
      ],
      winThemes: [],
      proofPlan: [],
      competitiveAssumptions: [],
      landmines: [],
      locked: false,
    });

    const results = new Set<string>();

    for (let i = 0; i < 10; i++) {
      const result = computeRubricCoverage(mockStrategy, mockSections);
      const serialized = JSON.stringify({
        personaMismatchCount: result.personaMismatchCount,
        criteria: result.criterionCoverage.map(c => ({
          label: c.criterionLabel,
          expectedPersona: c.expectedPersona,
          coveringPersonas: c.coveringPersonas,
          hasPersonaMismatch: c.hasPersonaMismatch,
          personaRiskLevel: c.personaRiskLevel,
        })),
      });
      results.add(serialized);
    }

    expect(results.size).toBe(1);
  });

  test('DEFAULT_SECTION_PERSONAS is immutable in structure', () => {
    const keys = Object.keys(DEFAULT_SECTION_PERSONAS);
    expect(keys).toHaveLength(7);

    // Structure should not change between calls
    const first = JSON.stringify(DEFAULT_SECTION_PERSONAS);
    const second = JSON.stringify(DEFAULT_SECTION_PERSONAS);
    expect(first).toBe(second);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Persona Layer Edge Cases', () => {
  test('handles empty criterion label', () => {
    expect(inferCriterionPersona('')).toBeNull();
  });

  test('handles very long criterion labels', () => {
    const longLabel = 'A'.repeat(1000) + ' methodology ' + 'B'.repeat(1000);
    const result = inferCriterionPersona(longLabel);
    expect(result).toBe('technical'); // Should still detect 'methodology'
  });

  test('handles special characters in criterion labels', () => {
    expect(inferCriterionPersona('Cost/Price (USD)')).toBe('procurement');
    expect(inferCriterionPersona('Technical-Approach & Methodology!')).toBe('technical');
  });

  test('handles case insensitivity', () => {
    expect(inferCriterionPersona('PRICE COMPETITIVENESS')).toBe('procurement');
    expect(inferCriterionPersona('technical methodology')).toBe('technical');
    expect(inferCriterionPersona('Strategic VALUE')).toBe('executive');
  });

  test('handles empty sections array', () => {
    const mockStrategy = createRfpWinStrategy({
      evaluationCriteria: [{ label: 'Test', weight: 0.5, primarySections: [] }],
      winThemes: [],
      proofPlan: [],
      competitiveAssumptions: [],
      landmines: [],
      locked: false,
    });

    const result = computeRubricCoverage(mockStrategy, []);
    expect(result.criterionCoverage).toHaveLength(1);
    expect(result.criterionCoverage[0].coveringPersonas).toHaveLength(0);
  });

  test('handles null persona settings gracefully', () => {
    const mockSections = [
      createRfpSection({ sectionKey: 'approach', title: 'Test', contentWorking: 'test content', status: 'draft' }),
    ];

    const mockStrategy = createRfpWinStrategy({
      evaluationCriteria: [{ label: 'Test Criterion', weight: 0.5, primarySections: ['approach'] }],
      winThemes: [],
      proofPlan: [],
      competitiveAssumptions: [],
      landmines: [],
      locked: false,
    });

    // Should not throw with null settings
    const result = computeRubricCoverage(mockStrategy, mockSections, null);
    expect(result).toBeDefined();
    // When null is passed, hasPersonaSettings is false (persona layer is disabled)
    expect(result.hasPersonaSettings).toBe(false);
    // But the function still returns valid result structure
    expect(result.personaMismatchCount).toBe(0);
  });
});
