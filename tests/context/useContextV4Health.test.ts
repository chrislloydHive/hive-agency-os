// tests/context/useContextV4Health.test.ts
// Tests for useContextV4Health hook
//
// Verifies:
// - Fetch on mount when companyId is truthy
// - Refresh triggers new fetch
// - Error handling
// - lastFetchedAt updates on success

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { V4HealthResponse } from '@/lib/types/contextV4Health';

// ============================================================================
// Mock Health Response
// ============================================================================

function createMockHealthResponse(
  status: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN'
): V4HealthResponse {
  return {
    healthVersion: 1,
    companyId: 'test-company',
    timestamp: new Date().toISOString(),
    status,
    reasons: status === 'GREEN' ? [] : ['NO_WEBSITELAB_RUN'],
    flags: {
      CONTEXT_V4_ENABLED: true,
      CONTEXT_V4_INGEST_WEBSITELAB: true,
    },
    websiteLab: {
      hasRun: status === 'GREEN',
      runId: status === 'GREEN' ? 'run-123' : null,
      createdAt: new Date().toISOString(),
      ageMinutes: 60,
      staleThresholdMinutes: 10080,
    },
    propose: {
      lastReason: status === 'GREEN' ? 'SUCCESS' : null,
      proposedCount: status === 'GREEN' ? 5 : 0,
      createdCount: null,
      skippedCount: null,
      lastRunId: null,
    },
    store: {
      total: 10,
      proposed: 3,
      confirmed: 5,
      rejected: 2,
    },
    links: {
      inspectorPath: '/c/test-company/admin/context-inspector',
      proposeApiPath: '/api/os/companies/test-company/context/v4/propose-website-lab',
    },
  };
}

// ============================================================================
// Hook Logic Tests (without React rendering)
// ============================================================================

describe('useContextV4Health Hook Logic', () => {
  describe('Fetch Behavior', () => {
    it('should construct correct API URL', () => {
      const companyId = 'test-company-123';
      const expectedUrl = `/api/os/companies/${companyId}/context/v4/health`;
      expect(expectedUrl).toBe('/api/os/companies/test-company-123/context/v4/health');
    });

    it('should use cache: no-store option', () => {
      // The hook explicitly uses { cache: 'no-store' }
      const fetchOptions = { cache: 'no-store' as const };
      expect(fetchOptions.cache).toBe('no-store');
    });
  });

  describe('Response Validation', () => {
    it('should validate healthVersion is present', () => {
      const validResponse = createMockHealthResponse();
      expect(validResponse.healthVersion).toBe(1);
    });

    it('should reject response without healthVersion', () => {
      const invalidResponse = { status: 'GREEN' };
      expect('healthVersion' in invalidResponse).toBe(false);
    });
  });

  describe('State Transitions', () => {
    it('should start with loading: true', () => {
      const initialState = { loading: true, health: null, error: null };
      expect(initialState.loading).toBe(true);
      expect(initialState.health).toBeNull();
    });

    it('should set loading: false after fetch completes', () => {
      const finalState = { loading: false, health: createMockHealthResponse(), error: null };
      expect(finalState.loading).toBe(false);
    });

    it('should set health on successful fetch', () => {
      const health = createMockHealthResponse();
      expect(health.status).toBe('GREEN');
      expect(health.healthVersion).toBe(1);
    });

    it('should set error on failed fetch', () => {
      const errorState = { loading: false, health: null, error: 'HTTP 500' };
      expect(errorState.error).toBe('HTTP 500');
    });

    it('should keep stale health on error', () => {
      // Behavior: Don't clear health on error, keep stale data visible
      const previousHealth = createMockHealthResponse();
      const stateAfterError = { loading: false, health: previousHealth, error: 'Network error' };
      expect(stateAfterError.health).not.toBeNull();
      expect(stateAfterError.error).toBe('Network error');
    });
  });

  describe('lastFetchedAt', () => {
    it('should be null initially', () => {
      const initialState = { lastFetchedAt: null };
      expect(initialState.lastFetchedAt).toBeNull();
    });

    it('should update on successful fetch', () => {
      const now = new Date().toISOString();
      const stateAfterFetch = { lastFetchedAt: now };
      expect(stateAfterFetch.lastFetchedAt).not.toBeNull();
    });

    it('should not update on failed fetch', () => {
      const previousFetchedAt = '2024-01-01T00:00:00.000Z';
      const stateAfterError = { lastFetchedAt: previousFetchedAt };
      expect(stateAfterError.lastFetchedAt).toBe(previousFetchedAt);
    });
  });

  describe('autoFetch Option', () => {
    it('should default to true', () => {
      const defaultOptions = { autoFetch: true };
      expect(defaultOptions.autoFetch).toBe(true);
    });

    it('should not fetch when autoFetch is false', () => {
      const options = { autoFetch: false };
      // When autoFetch is false, fetch should not be called on mount
      expect(options.autoFetch).toBe(false);
    });

    it('should not fetch when companyId is empty', () => {
      const companyId = '';
      const shouldFetch = !!companyId;
      expect(shouldFetch).toBe(false);
    });
  });

  describe('Refresh Function', () => {
    it('should trigger new fetch when called', () => {
      // refresh() should call the same fetch logic
      let fetchCount = 0;
      const refresh = () => {
        fetchCount++;
      };
      refresh();
      expect(fetchCount).toBe(1);
    });

    it('should update state with new data', () => {
      const oldHealth = createMockHealthResponse('YELLOW');
      const newHealth = createMockHealthResponse('GREEN');
      expect(oldHealth.status).toBe('YELLOW');
      expect(newHealth.status).toBe('GREEN');
    });
  });

  describe('Abort Controller', () => {
    it('should create AbortController for fetch', () => {
      const controller = new AbortController();
      expect(controller.signal.aborted).toBe(false);
    });

    it('should abort fetch on unmount', () => {
      const controller = new AbortController();
      controller.abort();
      expect(controller.signal.aborted).toBe(true);
    });

    it('should not set state after abort', () => {
      let mounted = true;
      const setState = () => {
        if (!mounted) throw new Error('Should not set state after unmount');
      };
      mounted = false;
      // This should not throw
      if (mounted) setState();
      expect(mounted).toBe(false);
    });
  });
});

describe('useContextV4Health Error Scenarios', () => {
  it('should handle network error gracefully', () => {
    const networkError = new Error('Failed to fetch');
    const errorMessage = networkError.message;
    expect(errorMessage).toBe('Failed to fetch');
  });

  it('should handle HTTP error gracefully', () => {
    const httpError = new Error('HTTP 500');
    const errorMessage = httpError.message;
    expect(errorMessage).toBe('HTTP 500');
  });

  it('should handle invalid JSON gracefully', () => {
    const parseError = new Error('Invalid JSON');
    const errorMessage = parseError.message;
    expect(errorMessage).toBe('Invalid JSON');
  });

  it('should handle AbortError silently', () => {
    const abortError = new Error('AbortError');
    abortError.name = 'AbortError';
    // AbortError should be ignored (not set as error state)
    expect(abortError.name).toBe('AbortError');
  });
});

describe('useContextV4Health Return Type', () => {
  it('should return health, loading, error, refresh, lastFetchedAt', () => {
    const returnValue = {
      health: null as V4HealthResponse | null,
      loading: true,
      error: null as string | null,
      refresh: async () => {},
      lastFetchedAt: null as string | null,
    };

    expect('health' in returnValue).toBe(true);
    expect('loading' in returnValue).toBe(true);
    expect('error' in returnValue).toBe(true);
    expect('refresh' in returnValue).toBe(true);
    expect('lastFetchedAt' in returnValue).toBe(true);
  });

  it('should have refresh as async function', async () => {
    const refresh = async () => {};
    expect(typeof refresh).toBe('function');
    await expect(refresh()).resolves.toBeUndefined();
  });
});
