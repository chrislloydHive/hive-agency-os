// components/competition/useCompetitionV3.ts
// React hook for fetching Competition Lab V3 data

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CompetitionRunV3Response } from '@/lib/competition-v3/ui-types';

interface UseCompetitionV3Result {
  data: CompetitionRunV3Response | null;
  isLoading: boolean;
  isRunning: boolean;
  error: string | null;
  runError: string | null;
  refetch: () => Promise<void>;
  runDiscovery: () => Promise<void>;
}

export function useCompetitionV3(companyId: string): UseCompetitionV3Result {
  const [data, setData] = useState<CompetitionRunV3Response | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  // Fetch latest data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/os/companies/${companyId}/competition/latest`);
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || 'Failed to fetch competition data');
      }

      if (json.success && json.run) {
        setData(json.run);
      } else {
        setData(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  // Run discovery
  const runDiscovery = useCallback(async () => {
    setIsRunning(true);
    setRunError(null);

    try {
      const response = await fetch(`/api/os/companies/${companyId}/competition/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error || 'Competition analysis failed');
      }

      // Refetch data after successful run
      await fetchData();
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsRunning(false);
    }
  }, [companyId, fetchData]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    isRunning,
    error,
    runError,
    refetch: fetchData,
    runDiscovery,
  };
}
