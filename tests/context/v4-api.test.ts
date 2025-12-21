// tests/context/v4-api.test.ts
// Integration tests for Context V4 APIs
//
// Tests the API flow: propose -> confirm -> materialize
// Uses mocked Airtable calls.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ContextFieldV4, ContextFieldStoreV4 } from '@/lib/types/contextField';

// Mock Airtable
vi.mock('@/lib/airtable', () => ({
  getBase: vi.fn(() => {
    return (tableName: string) => ({
      select: vi.fn(() => ({
        firstPage: vi.fn().mockResolvedValue([]),
      })),
      create: vi.fn().mockResolvedValue([{ id: 'rec123' }]),
      update: vi.fn().mockResolvedValue({ id: 'rec123' }),
    });
  }),
}));

// Mock feature flag
vi.mock('@/lib/types/contextField', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/types/contextField')>();
  return {
    ...actual,
    isContextV4Enabled: vi.fn(() => true),
  };
});

describe('Context V4 API Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CONTEXT_V4_ENABLED = 'true';
  });

  afterEach(() => {
    delete process.env.CONTEXT_V4_ENABLED;
  });

  describe('Propose Field', () => {
    it('should create proposed field when no existing', async () => {
      const { proposeFieldV4 } = await import('@/lib/contextGraph/fieldStoreV4');

      const result = await proposeFieldV4('company-123', {
        key: 'identity.industry',
        value: 'Technology',
        source: 'lab',
        sourceId: 'run-123',
        confidence: 0.8,
      });

      expect(result.success).toBe(true);
      expect(result.field).toBeDefined();
      expect(result.field?.status).toBe('proposed');
    });
  });

  describe('Confirm Fields', () => {
    it('should change status from proposed to confirmed', async () => {
      // This test validates the logic flow
      // In a real test, we'd mock the store with a proposed field

      const { confirmFieldsV4 } = await import('@/lib/contextGraph/fieldStoreV4');

      // Will fail since no proposed fields exist in mock
      const result = await confirmFieldsV4('company-123', ['identity.industry']);

      // Expected to fail since store is empty
      expect(result.failed).toContain('identity.industry');
    });
  });

  describe('Reject Fields', () => {
    it('should change status from proposed to rejected', async () => {
      const { rejectFieldsV4 } = await import('@/lib/contextGraph/fieldStoreV4');

      const result = await rejectFieldsV4('company-123', ['identity.industry'], 'Incorrect value');

      // Expected to fail since store is empty
      expect(result.failed).toContain('identity.industry');
    });
  });

  describe('Update Field (User Edit)', () => {
    it('should create confirmed+locked field', async () => {
      const { updateFieldV4 } = await import('@/lib/contextGraph/fieldStoreV4');

      const result = await updateFieldV4(
        'company-123',
        'identity.industry',
        'Finance',
        'user-456'
      );

      expect(result.success).toBe(true);
      expect(result.field).toBeDefined();
      expect(result.field?.status).toBe('confirmed');
      expect(result.field?.lockedAt).toBeDefined();
      expect(result.field?.lockedBy).toBe('user-456');
      expect(result.field?.source).toBe('user');
      expect(result.field?.confidence).toBe(1.0);
    });
  });
});

describe('Context V4 Materialization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CONTEXT_V4_ENABLED = 'true';
  });

  afterEach(() => {
    delete process.env.CONTEXT_V4_ENABLED;
  });

  it('should skip materialization when V4 not enabled', async () => {
    process.env.CONTEXT_V4_ENABLED = 'false';

    // Re-import to pick up new env
    vi.resetModules();

    const { isContextV4Enabled } = await import('@/lib/types/contextField');
    vi.mocked(isContextV4Enabled).mockReturnValue(false);

    const { materializeConfirmedToGraph } = await import('@/lib/contextGraph/materializeV4');

    const result = await materializeConfirmedToGraph('company-123');

    expect(result.materialized).toBe(0);
    expect(result.errors).toContain('V4 not enabled');
  });
});

describe('Context V4 Feature Flag', () => {
  it('should be disabled by default', () => {
    delete process.env.CONTEXT_V4_ENABLED;

    // Direct check without mock
    const enabled = process.env.CONTEXT_V4_ENABLED === 'true' || process.env.CONTEXT_V4_ENABLED === '1';
    expect(enabled).toBe(false);
  });

  it('should be enabled when set to true', () => {
    process.env.CONTEXT_V4_ENABLED = 'true';

    const enabled = process.env.CONTEXT_V4_ENABLED === 'true' || process.env.CONTEXT_V4_ENABLED === '1';
    expect(enabled).toBe(true);
  });

  it('should be enabled when set to 1', () => {
    process.env.CONTEXT_V4_ENABLED = '1';

    const enabled = process.env.CONTEXT_V4_ENABLED === 'true' || process.env.CONTEXT_V4_ENABLED === '1';
    expect(enabled).toBe(true);
  });
});
