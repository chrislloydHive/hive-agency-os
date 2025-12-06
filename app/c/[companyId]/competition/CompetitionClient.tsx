// app/c/[companyId]/competition/CompetitionClient.tsx
// Competition Lab v2 - Main Client Component
//
// Three-column "competitive cockpit" layout:
// - Left (280px): Company context + filters
// - Center (flex-1): Competitor map/list/compare
// - Right (320px): Strategic impact panels

'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  LeftContextPanel,
  type CompanyContext,
  type CompetitionFilters,
} from '@/components/competition/LeftContextPanel';
import { CenterCompetitionPanel } from '@/components/competition/CenterCompetitionPanel';
import { RightImpactPanel } from '@/components/competition/RightImpactPanel';
import { useCompetitionRun, formatRunDate } from '@/lib/competition/hooks';
import type { CompetitorProfile } from '@/lib/contextGraph/domains/competitive';
import type { ScoredCompetitor } from '@/lib/competition/types';

// ============================================================================
// Types
// ============================================================================

interface Props {
  companyId: string;
  companyName: string;
  companyContext: CompanyContext;
  existingCompetitors: CompetitorProfile[];
}

// ============================================================================
// Component
// ============================================================================

export function CompetitionClient({
  companyId,
  companyName,
  companyContext,
  existingCompetitors,
}: Props) {
  const router = useRouter();

  // State
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string | null>(null);
  const [filters, setFilters] = useState<CompetitionFilters>({
    roles: ['core', 'secondary', 'alternative'],
    sources: ['ai', 'human'],
    geoScope: 'all',
    includeMarketplaces: true,
    includeInternational: false,
  });

  // Fetch competition data
  const {
    run,
    competitors: apiCompetitors,
    isLoading,
    isRunning,
    error,
    refresh,
    triggerRun,
    applyFeedback,
  } = useCompetitionRun(companyId);

  // Merge existing Context Graph competitors with API competitors
  const allCompetitors = useMemo((): ScoredCompetitor[] => {
    // If we have API competitors, use them (they're more complete)
    if (apiCompetitors.length > 0) {
      return apiCompetitors;
    }

    // Otherwise, convert Context Graph competitors to ScoredCompetitor format
    return existingCompetitors.map((cp, idx): ScoredCompetitor => ({
      id: `cg_${idx}`,
      competitorName: cp.name,
      competitorDomain: cp.domain,
      role: (cp.category as 'core' | 'secondary' | 'alternative') || 'secondary',
      overallScore: Math.round((cp.confidence || 0.5) * 100),
      offerSimilarity: 50, // Default
      audienceSimilarity: 50, // Default
      geoOverlap: 50, // Default
      priceTierOverlap: 50, // Default
      brandScale: null,
      enrichedData: {
        companyType: null,
        category: cp.category,
        summary: null,
        tagline: null,
        targetAudience: null,
        icpDescription: null,
        companySizeTarget: null,
        geographicFocus: null,
        headquartersLocation: null,
        serviceAreas: [],
        primaryOffers: cp.offers || [],
        uniqueFeatures: [],
        pricingTier: null,
        pricingModel: null,
        estimatedPriceRange: cp.pricingSummary,
        brandScale: null,
        estimatedEmployees: null,
        foundedYear: null,
        positioning: cp.positioning,
        valueProposition: null,
        differentiators: cp.strengths || [],
        weaknesses: cp.weaknesses || [],
        primaryChannels: [],
        socialProof: [],
      },
      provenance: {
        discoveredFrom: ['context_graph'],
        humanOverride: false,
        humanOverrideAt: null,
        removed: false,
        removedAt: null,
        removedReason: null,
        promoted: false,
        promotedAt: null,
      },
      createdAt: new Date().toISOString(),
      updatedAt: null,
      xPosition: cp.xPosition,
      yPosition: cp.yPosition,
      whyThisCompetitorMatters: null,
      howTheyDiffer: null,
      threatLevel: cp.threatLevel,
      threatDrivers: [],
    }));
  }, [apiCompetitors, existingCompetitors]);

  // Filter competitors based on filter state
  const filteredCompetitors = useMemo(() => {
    return allCompetitors.filter((c) => {
      // Filter by role
      if (!filters.roles.includes(c.role)) {
        return false;
      }

      // Filter by source
      const isHuman = c.provenance?.humanOverride || c.provenance?.discoveredFrom?.includes('human_provided');
      const isAI = !isHuman;
      if (!filters.sources.includes('ai') && isAI) return false;
      if (!filters.sources.includes('human') && isHuman) return false;

      // Filter by removed status
      if (c.provenance?.removed) return false;

      return true;
    });
  }, [allCompetitors, filters]);

  // Get selected competitor
  const selectedCompetitor = useMemo(
    () => filteredCompetitors.find((c) => c.id === selectedCompetitorId) || null,
    [filteredCompetitors, selectedCompetitorId]
  );

  // Handlers
  const handlePromoteCompetitor = useCallback((id: string) => {
    applyFeedback({ type: 'promote', competitorId: id, toRole: 'core' });
  }, [applyFeedback]);

  const handleRemoveCompetitor = useCallback((id: string) => {
    applyFeedback({ type: 'remove', competitorId: id });
  }, [applyFeedback]);

  const handleCreateWorkItems = useCallback((type: string) => {
    // TODO: Navigate to work creation with pre-filled competitive context
    console.log(`Creating ${type} work items from competitive intelligence`);
    router.push(`/c/${companyId}/work?source=competition&type=${type}`);
  }, [companyId, router]);

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between bg-slate-900/50 border border-slate-800 rounded-lg p-4">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Competition Lab</h2>
            <p className="text-xs text-slate-400">
              {run
                ? `Last run: ${formatRunDate(run.completedAt || run.startedAt)} • Model ${run.modelVersion}`
                : 'No competition analysis run yet'
              }
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Data Confidence */}
          {run && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Confidence:</span>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full ${
                      i < Math.ceil((run.dataConfidenceScore || 0) / 20)
                        ? 'bg-amber-500'
                        : 'bg-slate-700'
                    }`}
                  />
                ))}
                <span className="text-xs text-slate-400 ml-1">{run.dataConfidenceScore || 0}</span>
              </div>
            </div>
          )}

          {/* Run Button */}
          <button
            onClick={triggerRun}
            disabled={isRunning}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              isRunning
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white'
            }`}
          >
            {isRunning ? (
              <span className="flex items-center gap-2">
                <Spinner />
                Running...
              </span>
            ) : run ? (
              'Re-run Discovery'
            ) : (
              'Run Discovery'
            )}
          </button>

          {/* Refresh Button */}
          <button
            onClick={refresh}
            disabled={isLoading}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            title="Refresh"
          >
            <svg className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Three-Column Layout */}
      <div className="grid grid-cols-[280px,1fr,320px] gap-4" style={{ height: 'calc(100vh - 280px)' }}>
        {/* Left: Context & Filters */}
        <LeftContextPanel
          companyId={companyId}
          companyContext={companyContext}
          filters={filters}
          onFiltersChange={setFilters}
        />

        {/* Center: Competitor Map & List */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4 overflow-hidden">
          <CenterCompetitionPanel
            companyName={companyName}
            companyContext={companyContext}
            competitors={filteredCompetitors}
            selectedCompetitorId={selectedCompetitorId}
            onSelectCompetitor={setSelectedCompetitorId}
            onPromoteCompetitor={handlePromoteCompetitor}
            onRemoveCompetitor={handleRemoveCompetitor}
          />
        </div>

        {/* Right: Strategic Impact */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4 overflow-hidden">
          <RightImpactPanel
            selectedCompetitor={selectedCompetitor}
            competitors={filteredCompetitors}
            run={run}
            onCreateWorkItems={handleCreateWorkItems}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Spinner Component
// ============================================================================

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
