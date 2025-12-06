'use client';

// app/c/[companyId]/brain/insights/InsightsFilters.tsx
// Client component for filtering and refreshing insights

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Filter,
  X,
  ChevronDown,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import type { InsightStatus, InsightSeverity, InsightCategory } from '@/lib/types/clientBrain';

interface InsightsFiltersProps {
  companyId: string;
  showOnlyRefresh?: boolean;
}

const STATUS_OPTIONS: { value: InsightStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
];

const SEVERITY_OPTIONS: { value: InsightSeverity | 'all'; label: string }[] = [
  { value: 'all', label: 'All Severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const CATEGORY_OPTIONS: { value: InsightCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All Categories' },
  { value: 'growth_opportunity', label: 'Growth' },
  { value: 'conversion', label: 'Conversion' },
  { value: 'competitive', label: 'Competitive' },
  { value: 'audience', label: 'Audience' },
  { value: 'brand', label: 'Brand' },
  { value: 'website', label: 'Website' },
  { value: 'seo', label: 'SEO' },
  { value: 'content', label: 'Content' },
  { value: 'media', label: 'Media' },
  { value: 'demand', label: 'Demand' },
  { value: 'ops', label: 'Operations' },
  { value: 'kpi_risk', label: 'KPI Risk' },
];

export function InsightsFilters({ companyId, showOnlyRefresh = false }: InsightsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<{ created: number; skipped: number } | null>(null);

  // Debug: log when component mounts
  console.log('[InsightsFilters] Component rendered:', { companyId, showOnlyRefresh });

  const currentStatus = searchParams.get('status') || 'all';
  const currentSeverity = searchParams.get('severity') || 'all';
  const currentCategory = searchParams.get('category') || 'all';

  const hasActiveFilters = currentStatus !== 'all' || currentSeverity !== 'all' || currentCategory !== 'all';

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`/c/${companyId}/brain/insights?${params.toString()}`);
  };

  const clearFilters = () => {
    router.push(`/c/${companyId}/brain/insights`);
  };

  const handleRefresh = async () => {
    console.log('[InsightsFilters] handleRefresh called for company:', companyId);
    setIsRefreshing(true);
    setRefreshResult(null);

    try {
      console.log('[InsightsFilters] Calling refresh API...');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

      const response = await fetch(
        `/api/os/client-brain/${companyId}/insights/refresh`,
        {
          method: 'POST',
          signal: controller.signal,
        }
      ).finally(() => clearTimeout(timeoutId));

      console.log('[InsightsFilters] API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Refresh failed:', response.status, errorData);
        throw new Error(errorData.error || 'Failed to refresh insights');
      }

      const data = await response.json();
      console.log('[InsightsRefresh] Response:', data);

      // Log any errors from the extraction process
      if (data.errors && data.errors.length > 0) {
        console.warn('[InsightsRefresh] Extraction errors:', data.errors);
      }

      setRefreshResult({ created: data.insightsCreated, skipped: data.insightsSkipped });

      // Refresh the page to show new insights
      router.refresh();

      // Clear result after 5 seconds
      setTimeout(() => setRefreshResult(null), 5000);
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Refresh button component - shared between modes
  const refreshButton = (
    <div className="flex items-center gap-2">
      {refreshResult && (
        <span className="text-xs text-emerald-400">
          +{refreshResult.created} new insight{refreshResult.created !== 1 ? 's' : ''}
        </span>
      )}
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600 hover:text-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isRefreshing ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Extracting insights...</span>
          </>
        ) : (
          <>
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Extract from Diagnostics</span>
          </>
        )}
      </button>
    </div>
  );

  // Show only refresh button (for empty state)
  if (showOnlyRefresh) {
    return (
      <div className="flex justify-end">
        {refreshButton}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Filter className="w-3.5 h-3.5" />
          <span>Filters:</span>
        </div>

        {/* Status Filter */}
        <FilterDropdown
          label="Status"
          value={currentStatus}
          options={STATUS_OPTIONS}
          onChange={(value) => updateFilter('status', value)}
        />

        {/* Severity Filter */}
        <FilterDropdown
          label="Severity"
          value={currentSeverity}
          options={SEVERITY_OPTIONS}
          onChange={(value) => updateFilter('severity', value)}
        />

        {/* Category Filter */}
        <FilterDropdown
          label="Category"
          value={currentCategory}
          options={CATEGORY_OPTIONS}
          onChange={(value) => updateFilter('category', value)}
        />

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-3 h-3" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Refresh Button */}
      {refreshButton}
    </div>
  );
}

// ============================================================================
// Filter Dropdown Component
// ============================================================================

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((o) => o.value === value) || options[0];
  const isFiltered = value !== 'all';

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
          isFiltered
            ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
            : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
        }`}
      >
        <span>{selectedOption.label}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute left-0 top-full mt-1 z-20 w-40 rounded-lg border border-slate-700 bg-slate-800 shadow-xl py-1 max-h-64 overflow-auto">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-1.5 text-left text-xs hover:bg-slate-700/50 transition-colors ${
                  option.value === value
                    ? 'text-slate-200 bg-slate-700/30'
                    : 'text-slate-400'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
