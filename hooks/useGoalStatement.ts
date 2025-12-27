'use client';

// hooks/useGoalStatement.ts
// Hook for fetching goalStatement from a strategy
//
// Features:
// - Fetches goalStatement by strategyId
// - Caches per strategyId to avoid redundant fetches
// - Returns loading/error states

import { useState, useEffect, useRef, useCallback } from 'react';

interface GoalStatementResult {
  goalStatement: string | null;
  loading: boolean;
  error: string | null;
}

// Simple in-memory cache (persists across hook instances within session)
const goalCache = new Map<string, { goalStatement: string | null; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute

export function useGoalStatement(
  companyId: string | null,
  strategyId: string | null
): GoalStatementResult {
  const [goalStatement, setGoalStatement] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef<string | null>(null);

  const fetchGoal = useCallback(async () => {
    if (!companyId || !strategyId) {
      setGoalStatement(null);
      setLoading(false);
      return;
    }

    const cacheKey = `${companyId}:${strategyId}`;

    // Check cache first
    const cached = goalCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setGoalStatement(cached.goalStatement);
      setLoading(false);
      return;
    }

    // Prevent duplicate fetches for same strategyId
    if (fetchedRef.current === cacheKey) {
      return;
    }
    fetchedRef.current = cacheKey;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/strategy/${strategyId}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch strategy');
      }

      const data = await response.json();
      const goal = data.strategy?.goalStatement || null;

      // Update cache
      goalCache.set(cacheKey, { goalStatement: goal, timestamp: Date.now() });

      setGoalStatement(goal);
    } catch (err) {
      console.error('[useGoalStatement] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setGoalStatement(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, strategyId]);

  useEffect(() => {
    fetchGoal();
  }, [fetchGoal]);

  return { goalStatement, loading, error };
}

/**
 * Invalidate cached goalStatement for a strategy
 * Call this when goalStatement is updated
 */
export function invalidateGoalCache(companyId: string, strategyId: string): void {
  const cacheKey = `${companyId}:${strategyId}`;
  goalCache.delete(cacheKey);
}
