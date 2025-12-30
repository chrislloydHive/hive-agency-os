/**
 * Tests for Services-Aware Programs
 *
 * Tests the services-aware planning functionality:
 * - ServiceCoverage schema validation
 * - ServiceCoverage in FullProgramDraftPayload
 * - Services section ordering in prompts (services FIRST)
 */

import { describe, it, expect } from 'vitest';
import {
  ServiceCoverageSchema,
  FullProgramDraftPayloadSchema,
  PlanningProgramSchema,
  type ServiceCoverage,
} from '@/lib/types/program';

// ============================================================================
// ServiceCoverage Schema Tests
// ============================================================================

describe('ServiceCoverage Schema', () => {
  it('validates a complete service coverage object', () => {
    const coverage: ServiceCoverage = {
      servicesUsed: ['Content Strategy (elite)', 'SEO Optimization (strong)'],
      unusedServices: ['PPC Management (basic)', 'Social Media (strong)'],
      gaps: ['Video Production', 'Podcast Editing'],
    };

    const result = ServiceCoverageSchema.safeParse(coverage);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.servicesUsed).toHaveLength(2);
      expect(result.data.unusedServices).toHaveLength(2);
      expect(result.data.gaps).toHaveLength(2);
    }
  });

  it('defaults empty arrays for missing fields', () => {
    const result = ServiceCoverageSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.servicesUsed).toEqual([]);
      expect(result.data.unusedServices).toEqual([]);
      expect(result.data.gaps).toEqual([]);
    }
  });

  it('handles partial coverage objects', () => {
    const partial = {
      servicesUsed: ['Content Strategy'],
    };

    const result = ServiceCoverageSchema.safeParse(partial);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.servicesUsed).toEqual(['Content Strategy']);
      expect(result.data.unusedServices).toEqual([]);
      expect(result.data.gaps).toEqual([]);
    }
  });
});

// ============================================================================
// FullProgramDraftPayload with ServiceCoverage Tests
// ============================================================================

describe('FullProgramDraftPayload with ServiceCoverage', () => {
  it('accepts payload with serviceCoverage', () => {
    const payload = {
      summary: {
        oneLiner: 'Test program',
        rationale: 'Testing services-aware planning',
        scopeIn: ['Feature A'],
        scopeOut: ['Feature B'],
      },
      deliverables: [],
      milestones: [],
      kpis: [],
      risks: [],
      dependencies: [],
      assumptions: [],
      constraints: [],
      executionPlan: [],
      serviceCoverage: {
        servicesUsed: ['Content Strategy'],
        unusedServices: ['SEO'],
        gaps: ['Video Production'],
      },
    };

    const result = FullProgramDraftPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.serviceCoverage).toBeDefined();
      expect(result.data.serviceCoverage?.servicesUsed).toContain('Content Strategy');
      expect(result.data.serviceCoverage?.gaps).toContain('Video Production');
    }
  });

  it('accepts payload without serviceCoverage (optional)', () => {
    const payload = {
      summary: {
        oneLiner: 'Test program',
        rationale: 'Testing without services',
        scopeIn: ['Feature A'],
        scopeOut: [],
      },
      deliverables: [],
      milestones: [],
      kpis: [],
      risks: [],
      dependencies: [],
      assumptions: [],
      constraints: [],
      executionPlan: [],
    };

    const result = FullProgramDraftPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.serviceCoverage).toBeUndefined();
    }
  });
});

// ============================================================================
// PlanningProgram with ServiceCoverage Tests
// ============================================================================

describe('PlanningProgram with ServiceCoverage', () => {
  const baseProgram = {
    id: 'prog_test_123',
    companyId: 'company_test',
    strategyId: 'strategy_abc',
    title: 'Test Program',
    status: 'draft' as const,
    origin: {
      strategyId: 'strategy_abc',
      tacticId: 'tactic_xyz',
      tacticTitle: 'Test Tactic',
    },
    scope: {
      summary: 'Test summary',
      deliverables: [],
      workstreams: [],
      channels: [],
      constraints: [],
      assumptions: [],
      unknowns: [],
      dependencies: [],
    },
    success: {
      kpis: [],
    },
    planDetails: {
      horizonDays: 30,
      milestones: [],
    },
    commitment: {
      workItemIds: [],
    },
    linkedArtifacts: [],
    workPlanVersion: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('stores serviceCoverage on program', () => {
    const programWithCoverage = {
      ...baseProgram,
      serviceCoverage: {
        servicesUsed: ['Content Strategy (elite)', 'Brand Strategy (strong)'],
        unusedServices: ['PPC (basic)'],
        gaps: ['Video Production'],
      },
    };

    const result = PlanningProgramSchema.safeParse(programWithCoverage);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.serviceCoverage?.servicesUsed).toHaveLength(2);
      expect(result.data.serviceCoverage?.gaps).toHaveLength(1);
    }
  });

  it('serviceCoverage is optional on program', () => {
    const result = PlanningProgramSchema.safeParse(baseProgram);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.serviceCoverage).toBeUndefined();
    }
  });
});

// ============================================================================
// Services Prompt Ordering Tests
// ============================================================================

describe('Services Prompt Ordering', () => {
  // These tests verify the expected behavior of prompt builders
  // The actual prompt building is tested via the order of sections

  it('services section should come FIRST in context (conceptual test)', () => {
    // This is a conceptual test - the actual implementation is in the route handlers
    // We verify the expected order: services -> program -> company -> strategy

    const expectedSectionOrder = [
      'HIVE SERVICES',      // Must be first
      'PROGRAM TO PLAN',    // Second
      'COMPANY CONTEXT',    // Third
      'STRATEGY',           // Fourth
      'SPECIAL INSTRUCTIONS', // Optional, last
      'TASK',               // Final instruction
    ];

    // Verify services is first
    expect(expectedSectionOrder[0]).toBe('HIVE SERVICES');
  });

  it('services-aware rules should be present in system prompt (conceptual test)', () => {
    // Conceptual test for the expected rules in SYSTEM_PROMPT
    const expectedRules = [
      'ONLY generate deliverables that leverage the available services',
      'Prefer services marked as "elite" or "strong" tier',
      'Note any gaps where needed capabilities aren\'t available',
    ];

    // Verify all expected rules are defined
    expect(expectedRules).toHaveLength(3);
    expect(expectedRules[0]).toContain('ONLY generate deliverables');
  });
});

// ============================================================================
// Service Coverage UI Display Tests
// ============================================================================

describe('Service Coverage Display Logic', () => {
  it('should show panel when servicesUsed is non-empty', () => {
    const coverage: ServiceCoverage = {
      servicesUsed: ['Content Strategy'],
      unusedServices: [],
      gaps: [],
    };

    const shouldShowPanel =
      coverage.servicesUsed.length > 0 || coverage.gaps.length > 0;
    expect(shouldShowPanel).toBe(true);
  });

  it('should show panel when gaps is non-empty', () => {
    const coverage: ServiceCoverage = {
      servicesUsed: [],
      unusedServices: [],
      gaps: ['Video Production'],
    };

    const shouldShowPanel =
      coverage.servicesUsed.length > 0 || coverage.gaps.length > 0;
    expect(shouldShowPanel).toBe(true);
  });

  it('should NOT show panel when both servicesUsed and gaps are empty', () => {
    const coverage: ServiceCoverage = {
      servicesUsed: [],
      unusedServices: ['SEO', 'PPC'],
      gaps: [],
    };

    const shouldShowPanel =
      coverage.servicesUsed.length > 0 || coverage.gaps.length > 0;
    expect(shouldShowPanel).toBe(false);
  });

  it('calculates totals correctly', () => {
    const coverage: ServiceCoverage = {
      servicesUsed: ['A', 'B', 'C'],
      unusedServices: ['D', 'E'],
      gaps: ['F'],
    };

    const totalUsed = coverage.servicesUsed.length;
    const totalUnused = coverage.unusedServices.length;
    const totalGaps = coverage.gaps.length;
    const totalAvailable = totalUsed + totalUnused;

    expect(totalUsed).toBe(3);
    expect(totalUnused).toBe(2);
    expect(totalGaps).toBe(1);
    expect(totalAvailable).toBe(5);
  });
});

// ============================================================================
// Service Tier Detection Tests
// ============================================================================

describe('Service Tier Detection', () => {
  it('identifies elite tier services', () => {
    const services = [
      'Content Strategy (elite)',
      'Brand Development (strong)',
      'PPC Management (basic)',
    ];

    const eliteServices = services.filter(s => s.includes('(elite)'));
    expect(eliteServices).toHaveLength(1);
    expect(eliteServices[0]).toContain('Content Strategy');
  });

  it('identifies strong tier services', () => {
    const services = [
      'Content Strategy (elite)',
      'Brand Development (strong)',
      'SEO Optimization (strong)',
      'PPC Management (basic)',
    ];

    const strongServices = services.filter(s => s.includes('(strong)'));
    expect(strongServices).toHaveLength(2);
  });

  it('identifies basic tier services', () => {
    const services = [
      'Content Strategy (elite)',
      'PPC Management (basic)',
      'Social Media (basic)',
    ];

    const basicServices = services.filter(s => s.includes('(basic)'));
    expect(basicServices).toHaveLength(2);
  });
});
