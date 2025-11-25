'use client';

// components/analytics/BlueprintChartsView.tsx
// Chart-based analytics view driven by an Analytics Blueprint
//
// This component:
// 1. Shows a "Generate Blueprint" button if no blueprint exists
// 2. Displays chart-based metrics using the MetricCard component
// 3. Fetches data from the blueprint data API

import { useState, useEffect, useCallback } from 'react';
import { MetricCard } from './MetricCard';
import type { AnalyticsBlueprint, AnalyticsMetricData } from '@/lib/analytics/blueprintTypes';

// ============================================================================
// Props
// ============================================================================

interface BlueprintChartsViewProps {
  companyId: string;
  companyName: string;
  /** Pass existing blueprint from parent to avoid re-fetch */
  initialBlueprint?: AnalyticsBlueprint | null;
  /** Date range in days (7, 30, 90) */
  activeDays?: number;
  /** Callback when blueprint is generated */
  onBlueprintGenerated?: (blueprint: AnalyticsBlueprint) => void;
}

// ============================================================================
// Main Component
// ============================================================================

export function BlueprintChartsView({
  companyId,
  companyName,
  initialBlueprint,
  activeDays = 30,
  onBlueprintGenerated,
}: BlueprintChartsViewProps) {
  // Blueprint state
  const [blueprint, setBlueprint] = useState<AnalyticsBlueprint | null>(initialBlueprint || null);
  const [blueprintLoading, setBlueprintLoading] = useState(false);
  const [blueprintError, setBlueprintError] = useState<string | null>(null);

  // Data state
  const [primaryMetrics, setPrimaryMetrics] = useState<AnalyticsMetricData[]>([]);
  const [secondaryMetrics, setSecondaryMetrics] = useState<AnalyticsMetricData[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // Fetch blueprint if not provided
  useEffect(() => {
    if (!initialBlueprint && !blueprint) {
      fetchBlueprint();
    }
  }, [companyId]);

  // Fetch data when blueprint or date range changes
  useEffect(() => {
    if (blueprint) {
      fetchBlueprintData();
    }
  }, [blueprint, activeDays]);

  // ============================================================================
  // Fetch Functions
  // ============================================================================

  const fetchBlueprint = async () => {
    try {
      const response = await fetch(`/api/os/analytics/blueprint?companyId=${companyId}`);
      const data = await response.json();

      if (data.ok && data.blueprint) {
        setBlueprint(data.blueprint);
      }
    } catch (error) {
      console.error('Error fetching blueprint:', error);
    }
  };

  const generateBlueprint = async () => {
    setBlueprintLoading(true);
    setBlueprintError(null);

    try {
      const response = await fetch('/api/os/analytics/blueprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Failed to generate blueprint');
      }

      setBlueprint(data.blueprint);
      onBlueprintGenerated?.(data.blueprint);
    } catch (error) {
      console.error('Error generating blueprint:', error);
      setBlueprintError(error instanceof Error ? error.message : 'Failed to generate blueprint');
    } finally {
      setBlueprintLoading(false);
    }
  };

  const fetchBlueprintData = useCallback(async () => {
    if (!blueprint) return;

    setDataLoading(true);
    setDataError(null);

    try {
      const now = new Date();
      const endDate = now.toISOString().split('T')[0];
      const startDate = new Date(now.setDate(now.getDate() - activeDays)).toISOString().split('T')[0];

      const response = await fetch(
        `/api/os/analytics/blueprint/data?companyId=${companyId}&start=${startDate}&end=${endDate}`
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Failed to fetch analytics data');
      }

      setPrimaryMetrics(data.data.primaryMetrics || []);
      setSecondaryMetrics(data.data.secondaryMetrics || []);
    } catch (error) {
      console.error('Error fetching blueprint data:', error);
      setDataError(error instanceof Error ? error.message : 'Failed to load analytics data');
    } finally {
      setDataLoading(false);
    }
  }, [blueprint, activeDays, companyId]);

  // ============================================================================
  // Render: No Blueprint State
  // ============================================================================

  if (!blueprint && !blueprintLoading) {
    return (
      <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>

        <h3 className="text-lg font-semibold text-amber-100 mb-2">
          Analytics Blueprint
        </h3>
        <p className="text-sm text-amber-200/70 mb-6 max-w-md mx-auto">
          Generate an AI-powered analytics blueprint to see the most relevant metrics
          for {companyName} displayed as interactive charts.
        </p>

        {blueprintError && (
          <p className="text-red-400 text-sm mb-4">{blueprintError}</p>
        )}

        <button
          onClick={generateBlueprint}
          disabled={blueprintLoading}
          className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {blueprintLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating Blueprint...
            </span>
          ) : (
            'Generate Analytics Blueprint'
          )}
        </button>
      </div>
    );
  }

  // ============================================================================
  // Render: Blueprint Loading
  // ============================================================================

  if (blueprintLoading) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
        <p className="text-slate-400 mt-4">Generating Analytics Blueprint with AI...</p>
        <p className="text-slate-500 text-sm mt-2">This may take a few seconds</p>
      </div>
    );
  }

  // ============================================================================
  // Render: Blueprint View with Charts
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Blueprint Header */}
      {blueprint && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-slate-200 mb-1">
                Analytics Blueprint
              </h3>
              <p className="text-xs text-slate-400 mb-2">
                {blueprint.notesForStrategist}
              </p>
              <div className="flex flex-wrap gap-2">
                {blueprint.objectives.map((obj, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-2 py-1 bg-amber-500/10 text-amber-300 rounded-full"
                  >
                    {obj}
                  </span>
                ))}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Generated</p>
              <p className="text-xs text-slate-400">
                {new Date(blueprint.generatedAt).toLocaleDateString()}
              </p>
              <button
                onClick={generateBlueprint}
                disabled={blueprintLoading}
                className="mt-2 text-xs text-amber-400 hover:text-amber-300"
              >
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Data Loading State */}
      {dataLoading && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-8 text-center">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-amber-400" />
          <p className="text-slate-400 mt-3 text-sm">Loading analytics data...</p>
        </div>
      )}

      {/* Data Error State */}
      {dataError && !dataLoading && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
          <p className="text-red-400 text-sm">{dataError}</p>
          <button
            onClick={fetchBlueprintData}
            className="mt-3 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Primary Metrics */}
      {!dataLoading && primaryMetrics.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Primary Metrics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {primaryMetrics.map((metricData) => (
              <MetricCard key={metricData.metric.id} data={metricData} />
            ))}
          </div>
        </section>
      )}

      {/* Secondary Metrics */}
      {!dataLoading && secondaryMetrics.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-500"></span>
            Secondary Metrics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {secondaryMetrics.map((metricData) => (
              <MetricCard key={metricData.metric.id} data={metricData} />
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {!dataLoading && primaryMetrics.length === 0 && secondaryMetrics.length === 0 && blueprint && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center">
          <p className="text-slate-400">No data available for the selected date range.</p>
          <p className="text-slate-500 text-sm mt-2">
            Make sure GA4 and/or Search Console are properly connected.
          </p>
        </div>
      )}
    </div>
  );
}
