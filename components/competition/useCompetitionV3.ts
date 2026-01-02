// components/competition/useCompetitionV3.ts
// React hook for fetching Competition Lab data (V4 preferred, V3 fallback)

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CompetitionRunV3Response } from '@/lib/competition-v3/ui-types';
import type { CompetitiveModalityType, CustomerComparisonMode } from '@/lib/competition-v4/types';

export interface DiscoveryOptions {
  competitiveModality?: CompetitiveModalityType;
  customerComparisonModes?: CustomerComparisonMode[];
  hasInstallation?: boolean;
  geographicScope?: 'local' | 'regional' | 'national';
}

interface UseCompetitionV3Result {
  data: CompetitionRunV3Response | null;
  isLoading: boolean;
  isRunning: boolean;
  error: string | null;
  runError: string | null;
  refetch: () => Promise<void>;
  runDiscovery: (options?: DiscoveryOptions) => Promise<void>;
}

export function useCompetitionV3(companyId: string): UseCompetitionV3Result {
  const [data, setData] = useState<CompetitionRunV3Response | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  // Fetch latest data - V4 first, then V3 fallback
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Try V4 first
      let response = await fetch(`/api/os/companies/${companyId}/competition/latest-v4`);
      let json = await response.json();

      if (response.ok && json.success && json.run) {
        // Adapt V4 data to V3 response shape for UI compatibility
        const v4 = json.run;
        const validated = v4.competitors?.validated || [];

        const run: CompetitionRunV3Response = {
          runId: v4.runId,
          companyId: v4.companyId,
          status: v4.execution?.status === 'completed' ? 'completed' : 'failed',
          createdAt: v4.execution?.startedAt || new Date().toISOString(),
          completedAt: v4.execution?.completedAt || undefined,
          competitors: validated.map((c: any, idx: number) => {
            // Derive positioning coordinates from V4 data:
            // X-axis (valueModelFit): Use confidence as proxy for value model similarity
            // Y-axis (icpFit): Derive from competitor type
            const typeNorm = (c.type || 'direct').toLowerCase();
            const confidence = c.confidence || 50;

            // ICP fit based on type (with slight spread using index)
            const spread = ((idx % 5) - 2) * 5; // -10 to +10 spread
            let icpFit: number;
            if (typeNorm === 'direct') {
              icpFit = Math.min(95, Math.max(60, 75 + spread + (confidence - 50) * 0.3));
            } else if (typeNorm === 'indirect') {
              icpFit = Math.min(65, Math.max(35, 50 + spread));
            } else {
              // Adjacent
              icpFit = Math.min(40, Math.max(10, 25 + spread));
            }

            // Value model fit: confidence-based with spread
            const valueModelFit = Math.min(95, Math.max(20, confidence + spread));

            return {
              id: `${v4.runId}-${idx}`,
              name: c.name,
              domain: c.domain,
              type: typeNorm,
              summary: c.reason || '',
              coordinates: { valueModelFit, icpFit },
              scores: {
                icp: Math.round(icpFit),
                businessModel: confidence,
                services: confidence,
                valueModel: Math.round(valueModelFit),
                aiOrientation: 50,
                geography: 50,
                threat: confidence,
                relevance: confidence,
              },
              classification: { confidence: confidence / 100 },
            };
          }),
          insights: {
            landscapeSummary:
              v4.summary?.competitive_positioning ||
              `Analyzed ${validated.length} competitors in the ${v4.category?.category_name || 'market'} space.`,
            categoryBreakdown: v4.category?.category_description || '',
            keyRisks: v4.summary?.competitive_risks || [],
            keyOpportunities: v4.summary?.key_differentiation_axes || [],
            recommendedMoves: { now: [], next: [], later: [] },
          },
          summary: {
            totalCandidates: validated.length,
            totalCompetitors: validated.length,
            byType: {
              direct: validated.filter((c: any) => c.type?.toLowerCase() === 'direct').length,
              partial: validated.filter(
                (c: any) => c.type?.toLowerCase() === 'indirect' || c.type?.toLowerCase() === 'adjacent'
              ).length,
              fractional: 0,
              platform: 0,
              internal: 0,
            },
            avgThreatScore:
              validated.length > 0
                ? Math.round(validated.reduce((sum: number, c: any) => sum + (c.confidence || 50), 0) / validated.length)
                : 50,
          },
          queryContext: {
            businessModelCategory: v4.category?.category_name || null,
            verticalCategory: v4.category?.category_name || null,
          },
        };
        setData(run);
        return;
      }

      // Fallback to V3
      response = await fetch(`/api/os/companies/${companyId}/competition/latest`);
      json = await response.json();

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

  // Run discovery - use V4 with optional modality options
  const runDiscovery = useCallback(async (options?: DiscoveryOptions) => {
    setIsRunning(true);
    setRunError(null);

    try {
      const response = await fetch(`/api/os/companies/${companyId}/competition/run-v4`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options || {}),
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
