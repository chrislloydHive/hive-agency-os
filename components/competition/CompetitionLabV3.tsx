// components/competition/CompetitionLabV3.tsx
// Competition Lab V3 - Main Client Component
//
// Features:
// - Positioning map with Value Model vs ICP axes
// - 6-category competitor classification
// - Threat/relevance scoring
// - Landscape insights and recommendations

'use client';

import { useState, useCallback, useMemo } from 'react';
import { PositioningMapV3 } from './PositioningMapV3';
import { CompetitorCardV3 } from './CompetitorCardV3';
import { LandscapeInsightsPanel } from './LandscapeInsightsPanel';
import { useCompetitionV3 } from './useCompetitionV3';
import type {
  CompetitionCompetitor,
  CompetitionInsights,
  CompetitorType,
} from '@/lib/competition-v3/ui-types';
import {
  TYPE_COLORS,
  TYPE_LABELS,
} from '@/lib/competition-v3/ui-types';

// ============================================================================
// Types
// ============================================================================

interface Props {
  companyId: string;
  companyName: string;
}

type ViewTab = 'map' | 'list';

// ============================================================================
// Component
// ============================================================================

export function CompetitionLabV3({ companyId, companyName }: Props) {
  const [activeTab, setActiveTab] = useState<ViewTab>('map');
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<CompetitorType[]>([
    'direct', 'partial', 'fractional', 'platform', 'internal',
  ]);
  const [excludedDomains, setExcludedDomains] = useState<string[]>([]);

  // Fetch V3 data
  const {
    data,
    isLoading,
    isRunning,
    error,
    runError,
    refetch,
    runDiscovery,
  } = useCompetitionV3(companyId);

  // Filter competitors by type
  const filteredCompetitors = useMemo(() => {
    if (!data?.competitors) return [];
    const excluded = new Set(excludedDomains.map(d => d.toLowerCase()));
    return data.competitors.filter(c =>
      typeFilter.includes(c.type) &&
      (!c.domain || !excluded.has(c.domain.toLowerCase()))
    );
  }, [data?.competitors, typeFilter, excludedDomains]);

  // Get selected competitor
  const selectedCompetitor = useMemo(
    () => filteredCompetitors.find(c => c.id === selectedCompetitorId) || null,
    [filteredCompetitors, selectedCompetitorId]
  );

  // Toggle type filter
  const toggleTypeFilter = useCallback((type: CompetitorType) => {
    setTypeFilter(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  }, []);

  const tabs: { id: ViewTab; label: string }[] = [
    { id: 'map', label: 'Positioning Map' },
    { id: 'list', label: 'Competitor List' },
  ];

  const handleMarkInvalid = useCallback(async (domain?: string | null) => {
    if (!domain) return;
    try {
      await fetch(`/api/os/companies/${companyId}/competition/mark-invalid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      });
      setExcludedDomains(prev => Array.from(new Set([...prev, domain])));
      if (selectedCompetitorId) {
        const selected = filteredCompetitors.find(c => c.id === selectedCompetitorId);
        if (selected?.domain?.toLowerCase() === domain.toLowerCase()) {
          setSelectedCompetitorId(null);
        }
      }
    } catch (e) {
      console.error('Failed to mark invalid competitor', e);
    }
  }, [companyId, filteredCompetitors, selectedCompetitorId]);

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between bg-slate-900/50 border border-slate-800 rounded-lg p-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Competition Lab</h2>
          <p className="text-xs text-slate-400">
            {data
              ? `${data.summary.totalCompetitors} competitors analyzed • Avg threat: ${data.summary.avgThreatScore}/100`
              : 'Discover and analyze your competitive landscape'
            }
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Run Button */}
          <button
            onClick={runDiscovery}
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
            ) : data ? (
              'Re-run Analysis'
            ) : (
              'Run Competition Analysis'
            )}
          </button>

          {/* Refresh Button */}
          <button
            onClick={refetch}
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
      {(error || runError) && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4 text-sm text-red-400">
          <div className="font-medium">{error ? 'Error loading data' : 'Run failed'}</div>
          <div className="mt-1">{error || runError}</div>
        </div>
      )}

      {/* Summary Row */}
      {data && (
        <div className="grid grid-cols-6 gap-3">
          {/* Type breakdown cards */}
          {(['direct', 'partial', 'fractional', 'platform', 'internal'] as const).map(type => {
            const count = data.summary.byType[type] || 0;
            const isActive = typeFilter.includes(type);
            const colors = TYPE_COLORS[type];

            return (
              <button
                key={type}
                onClick={() => toggleTypeFilter(type)}
                className={`p-3 rounded-lg border transition-all ${
                  isActive
                    ? `${colors.bg}/20 border-current`
                    : 'bg-slate-900/50 border-slate-800 opacity-50'
                } ${colors.text}`}
              >
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-xs capitalize">{TYPE_LABELS[type]}</div>
              </button>
            );
          })}

          {/* Avg threat score */}
          <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
            <div className={`text-2xl font-bold ${
              data.summary.avgThreatScore >= 60 ? 'text-red-400' : 'text-slate-300'
            }`}>
              {data.summary.avgThreatScore}
            </div>
            <div className="text-xs text-slate-500">Avg Threat</div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-[1fr,400px] gap-4" style={{ height: 'calc(100vh - 320px)' }}>
        {/* Left: Map/List */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4 overflow-hidden flex flex-col">
          {/* Tab Navigation */}
          <div className="flex items-center justify-between border-b border-slate-800 mb-4 pb-2">
            <div className="flex gap-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    activeTab === tab.id
                      ? 'text-amber-400 border-amber-400'
                      : 'text-slate-400 border-transparent hover:text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-500">
              {filteredCompetitors.length} competitor{filteredCompetitors.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto">
            {activeTab === 'map' ? (
              <PositioningMapV3
                companyName={companyName}
                competitors={filteredCompetitors}
                selectedCompetitorId={selectedCompetitorId}
                onSelectCompetitor={setSelectedCompetitorId}
              />
            ) : (
              <CompetitorListV3
                competitors={filteredCompetitors}
                selectedCompetitorId={selectedCompetitorId}
                onSelectCompetitor={setSelectedCompetitorId}
              />
            )}
          </div>
        </div>

        {/* Right: Insights or Selected Competitor */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4 overflow-auto">
          {selectedCompetitor ? (
            <CompetitorCardV3
              competitor={selectedCompetitor}
              onClose={() => setSelectedCompetitorId(null)}
              onMarkInvalid={handleMarkInvalid}
            />
          ) : data?.insights ? (
            <LandscapeInsightsPanel insights={data.insights} />
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Competitor List View
// ============================================================================

function CompetitorListV3({
  competitors,
  selectedCompetitorId,
  onSelectCompetitor,
}: {
  competitors: CompetitionCompetitor[];
  selectedCompetitorId: string | null;
  onSelectCompetitor: (id: string | null) => void;
}) {
  const [sortKey, setSortKey] = useState<'name' | 'type' | 'threat' | 'icpFit' | 'valueModelFit'>('threat');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sortedCompetitors = useMemo(() => {
    return [...competitors].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortKey) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'type': {
          const typeOrder = { direct: 0, partial: 1, fractional: 2, platform: 3, internal: 4, irrelevant: 5 };
          aVal = typeOrder[a.type];
          bVal = typeOrder[b.type];
          break;
        }
        case 'threat':
          aVal = a.scores.threat;
          bVal = b.scores.threat;
          break;
        case 'icpFit':
          aVal = a.coordinates.icpFit;
          bVal = b.coordinates.icpFit;
          break;
        case 'valueModelFit':
          aVal = a.coordinates.valueModelFit;
          bVal = b.coordinates.valueModelFit;
          break;
        default:
          aVal = 0;
          bVal = 0;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [competitors, sortKey, sortDir]);

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  if (competitors.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-slate-400 text-sm">No competitors to display</p>
      </div>
    );
  }

  const SortHeader = ({ label, sortKeyVal }: { label: string; sortKeyVal: typeof sortKey }) => (
    <th
      className="px-3 py-2 text-left text-xs font-medium text-slate-400 cursor-pointer hover:text-slate-300 select-none"
      onClick={() => handleSort(sortKeyVal)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortKey === sortKeyVal && (
          <span className="text-amber-400">{sortDir === 'asc' ? '↑' : '↓'}</span>
        )}
      </div>
    </th>
  );

  return (
    <div className="rounded-lg border border-slate-800 overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-900">
          <tr>
            <SortHeader label="Name" sortKeyVal="name" />
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Domain</th>
            <SortHeader label="Type" sortKeyVal="type" />
            <SortHeader label="ICP Fit" sortKeyVal="icpFit" />
            <SortHeader label="Value Fit" sortKeyVal="valueModelFit" />
            <SortHeader label="Threat" sortKeyVal="threat" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {sortedCompetitors.map(comp => {
            const isSelected = comp.id === selectedCompetitorId;
            const colors = TYPE_COLORS[comp.type];

            return (
              <tr
                key={comp.id}
                className={`cursor-pointer transition-colors ${
                  isSelected ? 'bg-amber-500/10' : 'hover:bg-slate-800/50'
                }`}
                onClick={() => onSelectCompetitor(comp.id)}
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${colors.bg}`} />
                    <span className="text-sm font-medium text-slate-200">{comp.name}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-slate-400">{comp.domain || '-'}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${colors.bg}/20 ${colors.text}`}>
                    {TYPE_LABELS[comp.type]}
                  </span>
                </td>
                <td className="px-3 py-2 text-sm text-emerald-400">{comp.coordinates.icpFit}%</td>
                <td className="px-3 py-2 text-sm text-blue-400">{comp.coordinates.valueModelFit}%</td>
                <td className="px-3 py-2">
                  <span className={`text-sm font-medium ${comp.scores.threat >= 60 ? 'text-red-400' : 'text-slate-400'}`}>
                    {comp.scores.threat}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center px-8">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
          <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>
        <p className="text-slate-300 text-sm font-medium mb-2">No data yet</p>
        <p className="text-slate-500 text-xs leading-relaxed">
          Run Competition Analysis to discover competitors, classify them by type,
          and generate strategic insights.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Spinner
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
