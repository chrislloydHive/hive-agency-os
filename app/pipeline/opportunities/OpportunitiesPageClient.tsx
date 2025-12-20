'use client';

// app/pipeline/opportunities/OpportunitiesPageClient.tsx
// Wrapper component that integrates ForecastSection with OpportunitiesBoardClient
// Enables click-to-filter by forecast bucket

import { useState, useMemo, useCallback } from 'react';
import type { CompanyRecord } from '@/lib/airtable/companies';
import type { OpportunityItem, ForecastBucket } from '@/lib/types/pipeline';
import { getForecastBucketLabel } from '@/lib/types/pipeline';
import { ForecastSection } from '@/components/pipeline/ForecastSection';
import { OpportunitiesBoardClient } from './OpportunitiesBoardClient';

interface OpportunitiesPageClientProps {
  opportunities: OpportunityItem[];
  companies: CompanyRecord[];
}

export function OpportunitiesPageClient({
  opportunities,
  companies,
}: OpportunitiesPageClientProps) {
  // Filter state: null = show all, otherwise filter to bucket's opportunity IDs
  const [selectedBucket, setSelectedBucket] = useState<ForecastBucket | null>(null);
  const [selectedOpportunityIds, setSelectedOpportunityIds] = useState<Set<string> | null>(null);

  // Handle bucket click from ForecastSection
  const handleBucketClick = useCallback(
    (bucket: ForecastBucket, opportunityIds: string[]) => {
      if (selectedBucket === bucket) {
        // Toggle off - clear filter
        setSelectedBucket(null);
        setSelectedOpportunityIds(null);
      } else {
        // Apply filter
        setSelectedBucket(bucket);
        setSelectedOpportunityIds(new Set(opportunityIds));
      }
    },
    [selectedBucket]
  );

  // Clear filter
  const handleClearFilter = useCallback(() => {
    setSelectedBucket(null);
    setSelectedOpportunityIds(null);
  }, []);

  // Filter opportunities based on selected bucket
  const filteredOpportunities = useMemo(() => {
    if (!selectedOpportunityIds) {
      // No filter - show all except dormant (dormant shown separately in board)
      return opportunities;
    }
    // Filter to only show opportunities in the selected bucket
    return opportunities.filter((opp) => selectedOpportunityIds.has(opp.id));
  }, [opportunities, selectedOpportunityIds]);

  return (
    <div className="space-y-6">
      {/* Forecast Section with click-to-filter */}
      <ForecastSection onBucketClick={handleBucketClick} />

      {/* Active Filter Indicator */}
      {selectedBucket && (
        <div className="flex items-center justify-between bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">Showing:</span>
            <span className="font-medium text-amber-400">
              {getForecastBucketLabel(selectedBucket)}
            </span>
            <span className="text-slate-500">
              ({filteredOpportunities.length} opportunities)
            </span>
          </div>
          <button
            onClick={handleClearFilter}
            className="text-xs px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
          >
            Clear filter
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
