'use client';

// app/pipeline/opportunities/OpportunitiesPageClient.tsx
// Wrapper component that integrates Forecast + Alerts with OpportunitiesBoardClient
// Enables click-to-filter by forecast bucket and/or alert type
// When both filters active, shows intersection of opportunity IDs

import { useState, useMemo, useCallback } from 'react';
import type { CompanyRecord } from '@/lib/airtable/companies';
import type {
  OpportunityItem,
  ForecastBucket,
  PipelineAlertType,
} from '@/lib/types/pipeline';
import { getForecastBucketLabel, getAlertLabel } from '@/lib/types/pipeline';
import { ForecastSection } from '@/components/pipeline/ForecastSection';
import { PipelineAlertsSection } from '@/components/pipeline/PipelineAlertsSection';
import { OpportunitiesBoardClient } from './OpportunitiesBoardClient';

interface OpportunitiesPageClientProps {
  opportunities: OpportunityItem[];
  companies: CompanyRecord[];
}

export function OpportunitiesPageClient({
  opportunities,
  companies,
}: OpportunitiesPageClientProps) {
  // Forecast filter state
  const [selectedBucket, setSelectedBucket] = useState<ForecastBucket | null>(null);
  const [forecastFilterIds, setForecastFilterIds] = useState<string[] | null>(null);

  // Alert filter state
  const [selectedAlert, setSelectedAlert] = useState<PipelineAlertType | null>(null);
  const [alertFilterIds, setAlertFilterIds] = useState<string[] | null>(null);

  // Handle bucket click from ForecastSection
  const handleBucketClick = useCallback(
    (bucket: ForecastBucket, opportunityIds: string[]) => {
      if (selectedBucket === bucket) {
        // Toggle off - clear forecast filter
        setSelectedBucket(null);
        setForecastFilterIds(null);
      } else {
        // Apply forecast filter
        setSelectedBucket(bucket);
        setForecastFilterIds(opportunityIds);
      }
    },
    [selectedBucket]
  );

  // Handle alert click from PipelineAlertsSection
  const handleAlertClick = useCallback(
    (alertType: PipelineAlertType, opportunityIds: string[]) => {
      if (selectedAlert === alertType) {
        // Toggle off - clear alert filter
        setSelectedAlert(null);
        setAlertFilterIds(null);
      } else {
        // Apply alert filter
        setSelectedAlert(alertType);
        setAlertFilterIds(opportunityIds);
      }
    },
    [selectedAlert]
  );

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setSelectedBucket(null);
    setForecastFilterIds(null);
    setSelectedAlert(null);
    setAlertFilterIds(null);
  }, []);

  // Check if any filter is active
  const hasActiveFilter = selectedBucket !== null || selectedAlert !== null;

  // Build filter description
  const getFilterDescription = () => {
    const parts: string[] = [];
    if (selectedBucket) parts.push(getForecastBucketLabel(selectedBucket));
    if (selectedAlert) parts.push(getAlertLabel(selectedAlert));
    return parts.join(' + ');
  };

  // Calculate effective filter IDs (intersection if both filters active)
  const effectiveFilterIds = useMemo(() => {
    if (!forecastFilterIds && !alertFilterIds) return null;
    if (forecastFilterIds && alertFilterIds) {
      // Intersection of both filters
      const forecastSet = new Set(forecastFilterIds);
      return alertFilterIds.filter((id) => forecastSet.has(id));
    }
    // Only one filter active
    return forecastFilterIds || alertFilterIds;
  }, [forecastFilterIds, alertFilterIds]);

  // Filter opportunities based on active filters
  const filteredOpportunities = useMemo(() => {
    if (!effectiveFilterIds) {
      return opportunities;
    }
    const filterSet = new Set(effectiveFilterIds);
    return opportunities.filter((opp) => filterSet.has(opp.id));
  }, [opportunities, effectiveFilterIds]);

  return (
    <div className="space-y-6">
      {/* Pipeline Alerts */}
      <PipelineAlertsSection
        selectedAlert={selectedAlert}
        onAlertClick={handleAlertClick}
      />

      {/* Forecast Section with click-to-filter */}
      <ForecastSection
        selectedBucket={selectedBucket}
        onBucketClick={handleBucketClick}
      />

      {/* Active Filter Indicator */}
      {hasActiveFilter && (
        <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-amber-400">Filter:</span>
            <span className="font-medium text-slate-200">
              {getFilterDescription()}
            </span>
            <span className="text-slate-500">
              ({filteredOpportunities.length} opportunities)
            </span>
          </div>
          <button
            onClick={handleClearFilters}
            className="text-xs px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Opportunities Board */}
      <OpportunitiesBoardClient
        opportunities={filteredOpportunities}
        companies={companies}
        showNewOpportunityButton
      />
    </div>
  );
}
