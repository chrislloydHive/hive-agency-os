// components/competition/CompetitionLabDataView.tsx
// Competition Lab V4 - Data View (UI Redesign)
//
// Layout structure:
// 1. Summary Strip - Compact type counts + avg threat
// 2. Analysis Section - Map + Snapshot Panel side by side
// 3. Detailed Sections - Competitor List + Full Insights (both collapsible)

'use client';

import { useState, useCallback, useMemo } from 'react';
import { PositioningMapV3 } from './PositioningMapV3';
import { CompetitorCardV3 } from './CompetitorCardV3';
import { CompetitionSnapshotPanel } from './CompetitionSnapshotPanel';
import { LandscapeInsightsPanel } from './LandscapeInsightsPanel';
import type {
  CompetitionCompetitor,
  CompetitionRunV3Response,
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
  data: CompetitionRunV3Response | null;
  isLoading: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function CompetitionLabDataView({ companyId, companyName, data, isLoading }: Props) {
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<CompetitorType[]>([
    'direct', 'partial', 'fractional', 'platform', 'internal',
  ]);
  const [showCompetitorList, setShowCompetitorList] = useState(true);
  const [showFullInsights, setShowFullInsights] = useState(false);

  // Filter competitors by type
  const filteredCompetitors = useMemo(() => {
    if (!data?.competitors) return [];
    return data.competitors.filter(c => typeFilter.includes(c.type));
  }, [data?.competitors, typeFilter]);

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

  if (!data) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-12 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 text-sm">No data available</p>
          <p className="text-slate-500 text-xs mt-1">Run an analysis to see competitor data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ================================================================== */}
      {/* Layer 1: Summary Strip */}
      {/* ================================================================== */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {/* Type breakdown chips */}
        {(['direct', 'partial', 'fractional', 'platform', 'internal'] as const).map(type => {
          const count = data.summary.byType[type] || 0;
          const isActive = typeFilter.includes(type);
          const colors = TYPE_COLORS[type];

          return (
            <button
              key={type}
              onClick={() => toggleTypeFilter(type)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all text-xs whitespace-nowrap ${
                isActive
                  ? `${colors.bg}/20 border-current ${colors.text}`
                  : 'bg-slate-900/50 border-slate-800 text-slate-500 opacity-60'
              }`}
            >
              <span className="font-bold">{count}</span>
              <span className="capitalize">{TYPE_LABELS[type]}</span>
            </button>
          );
        })}

        {/* Divider */}
        <div className="w-px h-5 bg-slate-700 mx-1" />

        {/* Avg threat */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/50 border border-slate-800 text-xs whitespace-nowrap">
          <span className={`font-bold ${data.summary.avgThreatScore >= 60 ? 'text-red-400' : 'text-slate-400'}`}>
            {data.summary.avgThreatScore}
          </span>
          <span className="text-slate-500">Avg Threat</span>
        </div>

        {/* Total */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/50 border border-slate-800 text-xs whitespace-nowrap">
          <span className="font-bold text-slate-300">{filteredCompetitors.length}</span>
          <span className="text-slate-500">Showing</span>
        </div>
      </div>

      {/* ================================================================== */}
      {/* Layer 2: Analysis Section (Map + Snapshot) */}
      {/* ================================================================== */}
      <div className="grid grid-cols-[1fr,320px] gap-4">
        {/* Left: Positioning Map */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4 aspect-square max-h-[600px]">
          <PositioningMapV3
            companyName={companyName}
            competitors={filteredCompetitors}
            selectedCompetitorId={selectedCompetitorId}
            onSelectCompetitor={setSelectedCompetitorId}
          />
        </div>

        {/* Right: Snapshot or Selected Competitor */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4 overflow-auto">
          {selectedCompetitor ? (
            <CompetitorCardV3
              competitor={selectedCompetitor}
              onClose={() => setSelectedCompetitorId(null)}
            />
          ) : data?.insights ? (
            <CompetitionSnapshotPanel
              insights={data.insights}
              competitors={filteredCompetitors}
              onSelectCompetitor={setSelectedCompetitorId}
            />
          ) : (
            <EmptySnapshotState />
          )}
        </div>
      </div>

      {/* ================================================================== */}
      {/* Layer 3a: Competitor List (Collapsible) */}
      {/* ================================================================== */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/30 overflow-hidden">
        <button
          onClick={() => setShowCompetitorList(!showCompetitorList)}
          className="w-full flex items-center justify-between p-3 hover:bg-slate-800/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span className="text-sm font-medium text-slate-200">Competitor List</span>
            <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-400">
              {filteredCompetitors.length}
            </span>
          </div>
          <svg
            className={`w-4 h-4 text-slate-500 transition-transform ${showCompetitorList ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showCompetitorList && (
          <div className="border-t border-slate-800">
            <CompetitorListV3
              competitors={filteredCompetitors}
              selectedCompetitorId={selectedCompetitorId}
              onSelectCompetitor={setSelectedCompetitorId}
            />
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* Layer 3b: Full Strategic Insights (Collapsible) */}
      {/* ================================================================== */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/30 overflow-hidden">
        <button
          onClick={() => setShowFullInsights(!showFullInsights)}
          className="w-full flex items-center justify-between p-3 hover:bg-slate-800/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span className="text-sm font-medium text-slate-200">Full Strategic Insights</span>
            {data?.insights && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-[10px] text-amber-400">
                {data.insights.keyRisks.length + data.insights.keyOpportunities.length} items
              </span>
            )}
          </div>
          <svg
            className={`w-4 h-4 text-slate-500 transition-transform ${showFullInsights ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showFullInsights && data?.insights && (
          <div className="border-t border-slate-800 p-4">
            <LandscapeInsightsPanel insights={data.insights} />
          </div>
        )}
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
        case 'type':
          const typeOrder = { direct: 0, partial: 1, fractional: 2, platform: 3, internal: 4, irrelevant: 5 };
          aVal = typeOrder[a.type];
          bVal = typeOrder[b.type];
          break;
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
      <div className="py-8 flex items-center justify-center">
        <p className="text-slate-400 text-sm">No competitors to display</p>
      </div>
    );
  }

  const SortHeader = ({ label, sortKeyVal }: { label: string; sortKeyVal: typeof sortKey }) => (
    <th
      className="px-3 py-2 text-left text-[10px] font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-400 select-none"
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
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-900/50 sticky top-0">
          <tr>
            <SortHeader label="Name" sortKeyVal="name" />
            <th className="px-3 py-2 text-left text-[10px] font-medium text-slate-500 uppercase tracking-wider">Domain</th>
            <SortHeader label="Type" sortKeyVal="type" />
            <SortHeader label="ICP Fit" sortKeyVal="icpFit" />
            <SortHeader label="Value Fit" sortKeyVal="valueModelFit" />
            <SortHeader label="Threat" sortKeyVal="threat" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {sortedCompetitors.map(comp => {
            const isSelected = comp.id === selectedCompetitorId;
            const colors = TYPE_COLORS[comp.type];

            return (
              <tr
                key={comp.id}
                className={`cursor-pointer transition-colors ${
                  isSelected ? 'bg-amber-500/10' : 'hover:bg-slate-800/30'
                }`}
                onClick={() => onSelectCompetitor(comp.id)}
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${colors.bg}`} />
                    <span className="text-xs font-medium text-slate-200">{comp.name}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-[10px] text-slate-500">{comp.domain || '-'}</td>
                <td className="px-3 py-2">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] ${colors.bg}/20 ${colors.text}`}>
                    {TYPE_LABELS[comp.type]}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-emerald-400">{comp.coordinates.icpFit}%</td>
                <td className="px-3 py-2 text-xs text-blue-400">{comp.coordinates.valueModelFit}%</td>
                <td className="px-3 py-2">
                  <span className={`text-xs font-medium ${comp.scores.threat >= 60 ? 'text-red-400' : 'text-slate-400'}`}>
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
// Empty Snapshot State
// ============================================================================

function EmptySnapshotState() {
  return (
    <div className="h-full flex items-center justify-center px-4">
      <div className="text-center max-w-xs">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-800 flex items-center justify-center">
          <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>
        <p className="text-slate-300 text-sm font-medium mb-1">Select a competitor</p>
        <p className="text-slate-500 text-xs leading-relaxed">
          Click on a competitor in the map to see details
        </p>
      </div>
    </div>
  );
}
