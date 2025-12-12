'use client';

// components/labs/analytics/AnalyticsLabContainer.tsx
// Main container for Analytics Lab
//
// Manages data fetching, state, and coordinates all Analytics Lab panels.

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import type { AnalyticsLabResponse } from '@/lib/analytics/analyticsTypes';
import { AnalyticsOverview } from './AnalyticsOverview';
import { AnalyticsTrafficPanel } from './AnalyticsTrafficPanel';
import { AnalyticsOrganicPanel } from './AnalyticsOrganicPanel';
import { AnalyticsGbpPanel } from './AnalyticsGbpPanel';
import { AnalyticsMediaPanel } from './AnalyticsMediaPanel';
import { AnalyticsFindingsPanel } from './AnalyticsFindingsPanel';
import { AnalyticsEmptyState } from './AnalyticsEmptyState';

// ============================================================================
// Types
// ============================================================================

interface AnalyticsLabContainerProps {
  companyId: string;
  companyName: string;
}

type DateRange = '7d' | '28d' | '90d';

// ============================================================================
// Component
// ============================================================================

export function AnalyticsLabContainer({
  companyId,
  companyName,
}: AnalyticsLabContainerProps) {
  const [data, setData] = useState<AnalyticsLabResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('28d');

  // Fetch analytics data
  const fetchData = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const endpoint = refresh
        ? '/api/os/analytics/refresh'
        : '/api/os/analytics/get';

      const response = refresh
        ? await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companyId, range: dateRange }),
          })
        : await fetch(`${endpoint}?companyId=${companyId}&range=${dateRange}`);

      const result = await response.json();

      if (!result.ok) {
        throw new Error(result.error || 'Failed to fetch analytics');
      }

      setData(result.data);
    } catch (err) {
      console.error('[AnalyticsLabContainer] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [companyId, dateRange]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle refresh
  const handleRefresh = () => {
    fetchData(true);
  };

  // Handle date range change
  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range);
  };

  // Check if we have any data
  const hasAnyData = data?.snapshot && (
    data.snapshot.hasGa4 ||
    data.snapshot.hasGsc ||
    data.snapshot.hasGbp ||
    data.snapshot.hasMedia
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <AnalyticsLabHeader
          companyName={companyName}
          dateRange={dateRange}
          onDateRangeChange={handleDateRangeChange}
          onRefresh={handleRefresh}
          isRefreshing={false}
        />
        <div className="grid gap-6">
          <LoadingSkeleton />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LoadingSkeleton />
            <LoadingSkeleton />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <AnalyticsLabHeader
          companyName={companyName}
          dateRange={dateRange}
          onDateRangeChange={handleDateRangeChange}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
        <div className="p-8 bg-red-500/10 border border-red-500/30 rounded-xl text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-200 mb-2">Unable to load analytics</h3>
          <p className="text-sm text-slate-400 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Empty state - no analytics connected
  if (!hasAnyData) {
    return (
      <div className="space-y-6">
        <AnalyticsLabHeader
          companyName={companyName}
          dateRange={dateRange}
          onDateRangeChange={handleDateRangeChange}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
        <AnalyticsEmptyState companyId={companyId} variant="no_analytics" />
      </div>
    );
  }

  // Main content
  return (
    <div className="space-y-6">
      {/* Header */}
      <AnalyticsLabHeader
        companyName={companyName}
        dateRange={dateRange}
        onDateRangeChange={handleDateRangeChange}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        lastUpdated={data?.snapshot.updatedAt}
      />

      {/* Section 1: Overview */}
      <AnalyticsOverview
        snapshot={data.snapshot}
        narrative={data.narrative}
        isRefreshing={isRefreshing}
      />

      {/* Section 2: Channel & Performance Deep Dive */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Traffic Panel (GA4) */}
        {data.snapshot.hasGa4 && (
          <AnalyticsTrafficPanel
            snapshot={data.snapshot}
            trends={data.trends}
          />
        )}

        {/* Organic Panel (GSC) */}
        {data.snapshot.hasGsc && (
          <AnalyticsOrganicPanel
            snapshot={data.snapshot}
            trends={data.trends}
          />
        )}

        {/* GBP Panel */}
        {data.snapshot.hasGbp && (
          <AnalyticsGbpPanel
            snapshot={data.snapshot}
            trends={data.trends}
          />
        )}

        {/* Media Panel */}
        {data.snapshot.hasMedia && (
          <AnalyticsMediaPanel
            companyId={companyId}
            snapshot={data.snapshot}
            trends={data.trends}
          />
        )}
      </div>

      {/* Section 3: Findings & Next Actions */}
      <AnalyticsFindingsPanel
        companyId={companyId}
        findings={data.findings}
      />
    </div>
  );
}

// ============================================================================
// Header Component
// ============================================================================

interface AnalyticsLabHeaderProps {
  companyName: string;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  lastUpdated?: string;
}

function AnalyticsLabHeader({
  companyName,
  dateRange,
  onDateRangeChange,
  onRefresh,
  isRefreshing,
  lastUpdated,
}: AnalyticsLabHeaderProps) {
  const dateRangeOptions: { value: DateRange; label: string }[] = [
    { value: '7d', label: 'Last 7 days' },
    { value: '28d', label: 'Last 28 days' },
    { value: '90d', label: 'Last 90 days' },
  ];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Analytics Lab</h1>
        <p className="text-sm text-slate-500 mt-1">
          Performance insights for {companyName}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {/* Date Range Selector */}
        <div className="flex items-center gap-1 p-1 bg-slate-800/50 border border-slate-700 rounded-lg">
          {dateRangeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => onDateRangeChange(option.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                dateRange === option.value
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-300 hover:text-slate-100 hover:bg-slate-700/50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="text-sm">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Last Updated */}
      {lastUpdated && (
        <p className="text-xs text-slate-500 sm:absolute sm:right-6 sm:bottom-4">
          Last updated: {new Date(lastUpdated).toLocaleString()}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function LoadingSkeleton() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 animate-pulse">
      <div className="h-4 bg-slate-700 rounded w-1/4 mb-4" />
      <div className="h-8 bg-slate-700 rounded w-1/2 mb-6" />
      <div className="grid grid-cols-3 gap-4">
        <div className="h-20 bg-slate-800 rounded" />
        <div className="h-20 bg-slate-800 rounded" />
        <div className="h-20 bg-slate-800 rounded" />
      </div>
    </div>
  );
}
