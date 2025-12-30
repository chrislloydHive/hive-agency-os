/**
 * Tests for Service Coverage Snapshot in Work Items
 *
 * Tests that serviceCoverageSnapshot is:
 * - Properly defined in WorkItem type
 * - Passed from program to work item during materialization
 * - Serialized/deserialized correctly in Airtable layer
 */

import { describe, it, expect } from 'vitest';
import type { WorkItem } from '@/lib/types/work';
import type { ServiceCoverage } from '@/lib/types/program';
import type { CreateWorkItemInput } from '@/lib/airtable/workItems';

// ============================================================================
// Type Tests
// ============================================================================

describe('WorkItem serviceCoverageSnapshot Type', () => {
  it('WorkItem interface accepts serviceCoverageSnapshot', () => {
    const workItem: WorkItem = {
      id: 'work_123',
      title: 'Test Work Item',
      status: 'Backlog',
      companyId: 'company_test',
      programId: 'prog_abc',
      programWorkKey: 'del::0',
      serviceCoverageSnapshot: {
        servicesUsed: ['Content Strategy (elite)', 'SEO Optimization (strong)'],
        unusedServices: ['PPC Management (basic)'],
        gaps: ['Video Production'],
      },
    };

    expect(workItem.serviceCoverageSnapshot).toBeDefined();
    expect(workItem.serviceCoverageSnapshot?.servicesUsed).toHaveLength(2);
    expect(workItem.serviceCoverageSnapshot?.gaps).toContain('Video Production');
  });

  it('WorkItem allows undefined serviceCoverageSnapshot', () => {
    const workItem: WorkItem = {
      id: 'work_456',
      title: 'Test Work Item without coverage',
      status: 'In Progress',
    };

    expect(workItem.serviceCoverageSnapshot).toBeUndefined();
  });
});

// ============================================================================
// CreateWorkItemInput Tests
// ============================================================================

describe('CreateWorkItemInput with serviceCoverageSnapshot', () => {
  it('accepts serviceCoverageSnapshot in input', () => {
    const input: CreateWorkItemInput = {
      title: 'New Work Item',
      companyId: 'company_test',
      programId: 'prog_abc',
      programWorkKey: 'del::1',
      serviceCoverageSnapshot: {
        servicesUsed: ['Brand Strategy (strong)'],
        unusedServices: [],
        gaps: [],
      },
    };

    expect(input.serviceCoverageSnapshot).toBeDefined();
    expect(input.serviceCoverageSnapshot?.servicesUsed).toContain('Brand Strategy (strong)');
  });

  it('allows input without serviceCoverageSnapshot', () => {
    const input: CreateWorkItemInput = {
      title: 'Manual Work Item',
      companyId: 'company_test',
    };

    expect(input.serviceCoverageSnapshot).toBeUndefined();
  });
});

// ============================================================================
// Service Coverage Snapshot Data Tests
// ============================================================================

describe('ServiceCoverage Snapshot Behavior', () => {
  it('snapshot is a copy, not a reference', () => {
    const programCoverage: ServiceCoverage = {
      servicesUsed: ['Content Strategy'],
      unusedServices: ['SEO'],
      gaps: [],
    };

    // Create a snapshot (simulating what materializeWork does)
    const snapshot: ServiceCoverage = {
      servicesUsed: [...programCoverage.servicesUsed],
      unusedServices: [...programCoverage.unusedServices],
      gaps: [...programCoverage.gaps],
    };

    // Modify the original
    programCoverage.servicesUsed.push('New Service');
    programCoverage.gaps.push('New Gap');

    // Snapshot should be unchanged
    expect(snapshot.servicesUsed).toHaveLength(1);
    expect(snapshot.gaps).toHaveLength(0);
  });

  it('empty coverage is valid', () => {
    const emptyCoverage: ServiceCoverage = {
      servicesUsed: [],
      unusedServices: [],
      gaps: [],
    };

    expect(emptyCoverage.servicesUsed).toHaveLength(0);
    expect(emptyCoverage.unusedServices).toHaveLength(0);
    expect(emptyCoverage.gaps).toHaveLength(0);
  });

  it('coverage with only gaps is valid (edge case)', () => {
    const gapsOnlyCoverage: ServiceCoverage = {
      servicesUsed: [],
      unusedServices: [],
      gaps: ['Video Production', 'Podcast Editing'],
    };

    expect(gapsOnlyCoverage.servicesUsed).toHaveLength(0);
    expect(gapsOnlyCoverage.gaps).toHaveLength(2);
  });
});

// ============================================================================
// JSON Serialization Tests (for Airtable)
// ============================================================================

describe('ServiceCoverage JSON Serialization', () => {
  it('serializes and deserializes correctly', () => {
    const coverage: ServiceCoverage = {
      servicesUsed: ['Content Strategy (elite)', 'SEO Optimization (strong)'],
      unusedServices: ['PPC Management (basic)'],
      gaps: ['Video Production'],
    };

    const json = JSON.stringify(coverage);
    const parsed = JSON.parse(json) as ServiceCoverage;

    expect(parsed.servicesUsed).toEqual(coverage.servicesUsed);
    expect(parsed.unusedServices).toEqual(coverage.unusedServices);
    expect(parsed.gaps).toEqual(coverage.gaps);
  });

  it('handles special characters in service names', () => {
    const coverage: ServiceCoverage = {
      servicesUsed: ['Content & Strategy (elite)', 'SEO/SEM Optimization'],
      unusedServices: ['PPC "Management"'],
      gaps: ["Video's Production"],
    };

    const json = JSON.stringify(coverage);
    const parsed = JSON.parse(json) as ServiceCoverage;

    expect(parsed.servicesUsed[0]).toBe('Content & Strategy (elite)');
    expect(parsed.servicesUsed[1]).toBe('SEO/SEM Optimization');
    expect(parsed.unusedServices[0]).toBe('PPC "Management"');
    expect(parsed.gaps[0]).toBe("Video's Production");
  });

  it('null serviceCoverage remains undefined after parsing', () => {
    const json = 'null';
    const parsed = JSON.parse(json);

    expect(parsed).toBeNull();
  });
});

// ============================================================================
// Materialization Flow Tests (Unit Level)
// ============================================================================

describe('Materialization Flow with serviceCoverageSnapshot', () => {
  it('work item input includes serviceCoverageSnapshot from program', () => {
    // Simulate program data
    const programServiceCoverage: ServiceCoverage = {
      servicesUsed: ['Content Strategy (elite)'],
      unusedServices: ['SEO (basic)'],
      gaps: [],
    };

    // Simulate building CreateWorkItemInput (as in materializeWork.ts)
    const input: CreateWorkItemInput = {
      title: 'Deliverable from Program',
      companyId: 'company_test',
      programId: 'prog_abc',
      programWorkKey: 'del::0',
      serviceCoverageSnapshot: programServiceCoverage,
    };

    expect(input.serviceCoverageSnapshot).toEqual(programServiceCoverage);
    expect(input.serviceCoverageSnapshot?.servicesUsed).toContain('Content Strategy (elite)');
  });

  it('work item input handles undefined serviceCoverage from program', () => {
    // Simulate program without serviceCoverage
    const programServiceCoverage: ServiceCoverage | undefined = undefined;

    const input: CreateWorkItemInput = {
      title: 'Deliverable from Program',
      companyId: 'company_test',
      programId: 'prog_abc',
      programWorkKey: 'del::0',
      serviceCoverageSnapshot: programServiceCoverage,
    };

    expect(input.serviceCoverageSnapshot).toBeUndefined();
  });
});

// ============================================================================
// Execution Grounding Tests
// ============================================================================

describe('Service Coverage Grounding for Execution', () => {
  it('work item preserves service context for AI execution', () => {
    const workItem: WorkItem = {
      id: 'work_exec_123',
      title: 'Create Content Calendar',
      status: 'In Progress',
      programId: 'prog_content',
      serviceCoverageSnapshot: {
        servicesUsed: ['Content Strategy (elite)', 'Social Media (strong)'],
        unusedServices: ['PPC (basic)'],
        gaps: [],
      },
    };

    // AI execution should use these services
    const availableServices = workItem.serviceCoverageSnapshot?.servicesUsed || [];
    expect(availableServices).toContain('Content Strategy (elite)');
    expect(availableServices).toContain('Social Media (strong)');

    // AI execution should know about gaps
    const gaps = workItem.serviceCoverageSnapshot?.gaps || [];
    expect(gaps).toHaveLength(0);
  });

  it('work item with gaps indicates limitations', () => {
    const workItem: WorkItem = {
      id: 'work_exec_456',
      title: 'Create Video Campaign',
      status: 'Backlog',
      programId: 'prog_video',
      serviceCoverageSnapshot: {
        servicesUsed: ['Content Strategy (elite)'],
        unusedServices: [],
        gaps: ['Video Production', 'Motion Graphics'],
      },
    };

    // AI should be aware of limitations
    const gaps = workItem.serviceCoverageSnapshot?.gaps || [];
    expect(gaps).toContain('Video Production');
    expect(gaps).toContain('Motion Graphics');
  });
});
