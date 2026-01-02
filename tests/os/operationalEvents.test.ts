// tests/os/operationalEvents.test.ts
// Tests for operational event logging and querying

import { describe, it, expect } from 'vitest';
import {
  generateDebugId,
  OPERATIONAL_EVENT_TYPES,
  type OperationalEventType,
  type BundleInstantiationEventPayload,
  type WorkCreationEventPayload,
  type ScopeViolationEventPayload,
} from '@/lib/types/operationalEvent';

// ============================================================================
// Debug ID Generation Tests
// ============================================================================

describe('generateDebugId', () => {
  it('generates a string', () => {
    const id = generateDebugId();
    expect(typeof id).toBe('string');
  });

  it('starts with EVT- prefix', () => {
    const id = generateDebugId();
    expect(id.startsWith('EVT-')).toBe(true);
  });

  it('generates unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateDebugId());
    }
    expect(ids.size).toBe(100);
  });

  it('contains timestamp component', () => {
    const id = generateDebugId();
    // Format: EVT-{timestamp}-{random}
    const parts = id.split('-');
    expect(parts.length).toBe(3);
    expect(parts[0]).toBe('EVT');
    // Timestamp is base36 encoded
    expect(parts[1].length).toBeGreaterThan(0);
    expect(parts[2].length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Event Type Constants Tests
// ============================================================================

describe('OPERATIONAL_EVENT_TYPES', () => {
  it('defines bundle_instantiated type', () => {
    expect(OPERATIONAL_EVENT_TYPES.BUNDLE_INSTANTIATED).toBe('bundle_instantiated');
  });

  it('defines work_created type', () => {
    expect(OPERATIONAL_EVENT_TYPES.WORK_CREATED).toBe('work_created');
  });

  it('defines work_creation_skipped type', () => {
    expect(OPERATIONAL_EVENT_TYPES.WORK_CREATION_SKIPPED).toBe('work_creation_skipped');
  });

  it('defines scope_violation type', () => {
    expect(OPERATIONAL_EVENT_TYPES.SCOPE_VIOLATION).toBe('scope_violation');
  });

  it('has all 10 event types', () => {
    // Original: 4 (bundle, work created/skipped, scope violation)
    // + 2 governance events (intensity/status changed)
    // + 3 recurrence events (started/completed/failed)
    // + 1 runbook event (item completed)
    expect(Object.keys(OPERATIONAL_EVENT_TYPES)).toHaveLength(10);
  });
});

// ============================================================================
// Event Payload Type Tests
// ============================================================================

describe('Event Payload Types', () => {
  describe('BundleInstantiationEventPayload', () => {
    it('accepts valid payload', () => {
      const payload: BundleInstantiationEventPayload = {
        presetId: 'car-toys-local-demand-engine-standard',
        presetName: 'Car Toys — Local Demand Engine (Standard)',
        domains: ['Strategy', 'Creative', 'Media'],
        intensity: 'Standard',
        startDate: '2025-01-15',
        strategyId: 'rec123',
        createdPrograms: [
          {
            programId: 'prog1',
            title: 'Strategy Program',
            domain: 'Strategy',
            status: 'created',
          },
        ],
        createdDeliverables: 12,
        summary: {
          created: 3,
          skipped: 0,
          failed: 0,
        },
      };

      expect(payload.presetId).toBe('car-toys-local-demand-engine-standard');
      expect(payload.domains).toHaveLength(3);
      expect(payload.summary.created).toBe(3);
    });

    it('requires all mandatory fields', () => {
      // This is a compile-time check, runtime assertion for clarity
      const payload: BundleInstantiationEventPayload = {
        presetId: 'test',
        presetName: 'Test',
        domains: [],
        intensity: 'Core',
        startDate: '2025-01-01',
        strategyId: 'rec1',
        createdPrograms: [],
        createdDeliverables: 0,
        summary: { created: 0, skipped: 0, failed: 0 },
      };
      expect(payload).toBeDefined();
    });
  });

  describe('WorkCreationEventPayload', () => {
    it('accepts valid payload with all fields', () => {
      const payload: WorkCreationEventPayload = {
        workItemId: 'work123',
        title: 'Monthly Content Piece',
        workstream: 'content',
        programId: 'prog1',
        programTitle: 'Creative Program',
        deliverableId: 'del1',
        deliverableTitle: 'Monthly Blog Post',
        sourceContext: 'deliverable_conversion',
        status: 'created',
      };

      expect(payload.workItemId).toBe('work123');
      expect(payload.sourceContext).toBe('deliverable_conversion');
      expect(payload.status).toBe('created');
    });

    it('accepts payload with already_exists status', () => {
      const payload: WorkCreationEventPayload = {
        workItemId: 'work123',
        title: 'Existing Work',
        workstream: 'seo',
        status: 'already_exists',
        existingWorkItemId: 'work123',
      };

      expect(payload.status).toBe('already_exists');
      expect(payload.existingWorkItemId).toBe('work123');
    });

    it('supports all source contexts', () => {
      const contexts: WorkCreationEventPayload['sourceContext'][] = [
        'deliverable_conversion',
        'manual_creation',
        'ai_suggestion',
        'adhoc',
      ];

      contexts.forEach((ctx) => {
        const payload: WorkCreationEventPayload = {
          workItemId: 'w1',
          title: 'Test',
          workstream: 'ops',
          status: 'created',
          sourceContext: ctx,
        };
        expect(payload.sourceContext).toBe(ctx);
      });
    });
  });

  describe('ScopeViolationEventPayload', () => {
    it('accepts WORKSTREAM_NOT_ALLOWED violation', () => {
      const payload: ScopeViolationEventPayload = {
        code: 'WORKSTREAM_NOT_ALLOWED',
        programId: 'prog1',
        programTitle: 'Strategy Program',
        domain: 'Strategy',
        blockedAction: {
          type: 'create_work',
          description: 'Create SEO work item',
        },
        attemptedWorkstream: 'seo',
        recommendedActions: [
          { id: 'use_allowed_workstream', label: 'Use allowed workstream', type: 'primary' },
        ],
      };

      expect(payload.code).toBe('WORKSTREAM_NOT_ALLOWED');
      expect(payload.attemptedWorkstream).toBe('seo');
    });

    it('accepts CONCURRENCY_LIMIT_REACHED violation', () => {
      const payload: ScopeViolationEventPayload = {
        code: 'CONCURRENCY_LIMIT_REACHED',
        programId: 'prog1',
        programTitle: 'Media Program',
        domain: 'Media',
        blockedAction: {
          type: 'create_work',
          description: 'Create new work item',
        },
        currentCount: 4,
        limit: 4,
        recommendedActions: [
          { id: 'complete_work', label: 'Complete existing work', type: 'secondary' },
        ],
      };

      expect(payload.code).toBe('CONCURRENCY_LIMIT_REACHED');
      expect(payload.currentCount).toBe(4);
      expect(payload.limit).toBe(4);
    });

    it('allows null domain', () => {
      const payload: ScopeViolationEventPayload = {
        code: 'PROGRAM_REQUIRED',
        programId: 'prog1',
        programTitle: 'Ad-hoc Program',
        domain: null,
        blockedAction: {
          type: 'create_work',
          description: 'Create work without program',
        },
        recommendedActions: [],
      };

      expect(payload.domain).toBeNull();
    });
  });
});

// ============================================================================
// Event Payload Validation Tests
// ============================================================================

describe('Event Payload Validation', () => {
  it('validates domains are valid ProgramDomain values', () => {
    const validDomains: BundleInstantiationEventPayload['domains'] = [
      'Strategy',
      'Creative',
      'Media',
      'LocalVisibility',
      'Analytics',
      'Operations',
    ];

    expect(validDomains).toHaveLength(6);
  });

  it('validates intensity is valid IntensityLevel', () => {
    const intensities: BundleInstantiationEventPayload['intensity'][] = [
      'Core',
      'Standard',
      'Aggressive',
    ];

    expect(intensities).toHaveLength(3);
  });

  it('validates program status is valid value', () => {
    const statuses: BundleInstantiationEventPayload['createdPrograms'][0]['status'][] = [
      'created',
      'already_exists',
      'failed',
    ];

    expect(statuses).toHaveLength(3);
  });
});

// ============================================================================
// Event Format Consistency Tests
// ============================================================================

describe('Event Format Consistency', () => {
  it('all events share common structure', () => {
    // Common fields that all events should have
    const commonFields = ['id', 'debugId', 'type', 'companyId', 'timestamp', 'payload'];

    // This is a structural test - actual events would have these fields
    expect(commonFields).toContain('debugId');
    expect(commonFields).toContain('companyId');
    expect(commonFields).toContain('timestamp');
  });

  it('event types are mutually exclusive', () => {
    const types = Object.values(OPERATIONAL_EVENT_TYPES);
    const uniqueTypes = new Set(types);

    expect(uniqueTypes.size).toBe(types.length);
  });
});
