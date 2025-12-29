// components/competition/CenterCompetitionPanel.tsx
// Competition Lab v2 - Center Column
//
// Three views:
// - Map: Force-directed bubble map with competitors
// - List: Sortable table of competitors
// - Compare: Side-by-side comparison (us vs selected)

'use client';

import { useState, useMemo } from 'react';
import type { ScoredCompetitor } from '@/lib/competition/types';
import { getRoleColor, getBrandScaleLabel } from '@/lib/competition/hooks';
import type { CompanyContext } from './LeftContextPanel';

// ============================================================================
// Types
// ============================================================================

type ViewTab = 'map' | 'list' | 'compare';
type SortKey = 'name' | 'role' | 'overallScore' | 'offerSimilarity' | 'audienceSimilarity' | 'threatLevel';
type SortDir = 'asc' | 'desc';

interface Props {
  companyName: string;
  companyContext: CompanyContext;
  competitors: ScoredCompetitor[];
  selectedCompetitorId: string | null;
  onSelectCompetitor: (id: string | null) => void;
  onPromoteCompetitor: (id: string) => void;
  onRemoveCompetitor: (id: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export function CenterCompetitionPanel({
  companyName,
  companyContext,
  competitors,
  selectedCompetitorId,
  onSelectCompetitor,
  onPromoteCompetitor,
  onRemoveCompetitor,
}: Props) {
  const [activeTab, setActiveTab] = useState<ViewTab>('map');
  const [sortKey, setSortKey] = useState<SortKey>('overallScore');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Sort competitors for list view
  const sortedCompetitors = useMemo(() => {
    const sorted = [...competitors].sort((a, b) => {
      let aVal: string | number | null;
      let bVal: string | number | null;

      switch (sortKey) {
        case 'name':
          aVal = a.competitorName.toLowerCase();
          bVal = b.competitorName.toLowerCase();
          break;
        case 'role': {
          const roleOrder = { core: 0, secondary: 1, alternative: 2 };
          aVal = roleOrder[a.role] ?? 3;
          bVal = roleOrder[b.role] ?? 3;
          break;
        }
        case 'threatLevel':
          aVal = a.threatLevel ?? 0;
          bVal = b.threatLevel ?? 0;
          break;
        default:
          aVal = a[sortKey] ?? 0;
          bVal = b[sortKey] ?? 0;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return sorted;
  }, [competitors, sortKey, sortDir]);

  // Get selected competitor
  const selectedCompetitor = competitors.find((c) => c.id === selectedCompetitorId) || null;

  // Handle sort column click
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const tabs: { id: ViewTab; label: string }[] = [
    { id: 'map', label: 'Map' },
    { id: 'list', label: 'List' },
    { id: 'compare', label: 'Compare' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Tab Navigation */}
      <div className="flex items-center justify-between border-b border-slate-800 mb-4">
        <div className="flex gap-1">
          {tabs.map((tab) => (
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
          {competitors.length} competitor{competitors.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'map' && (
          <MapView
            companyName={companyName}
            competitors={competitors}
            selectedCompetitorId={selectedCompetitorId}
            onSelectCompetitor={onSelectCompetitor}
          />
        )}
        {activeTab === 'list' && (
          <ListView
            competitors={sortedCompetitors}
            selectedCompetitorId={selectedCompetitorId}
            onSelectCompetitor={onSelectCompetitor}
            onPromoteCompetitor={onPromoteCompetitor}
            onRemoveCompetitor={onRemoveCompetitor}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
          />
        )}
        {activeTab === 'compare' && (
          <CompareView
            companyName={companyName}
            companyContext={companyContext}
            selectedCompetitor={selectedCompetitor}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Map View
// ============================================================================

function MapView({
  companyName,
  competitors,
  selectedCompetitorId,
  onSelectCompetitor,
}: {
  companyName: string;
  competitors: ScoredCompetitor[];
  selectedCompetitorId: string | null;
  onSelectCompetitor: (id: string | null) => void;
}) {
  if (competitors.length === 0) {
    return (
      <div className="h-full flex items-center justify-center px-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <p className="text-slate-300 text-sm font-medium mb-2">No competitors discovered yet</p>
          <p className="text-slate-500 text-xs leading-relaxed">
            Competition Discovery analyzes your market landscape using AI and first-party context
            (ICP, industry, geo, offers, positioning) to identify core competitors, secondary competitors,
            and alternatives. Run your first discovery to populate the map.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-square max-w-2xl mx-auto rounded-lg border border-slate-700 bg-slate-900/80">
      {/* Grid lines */}
      <div className="absolute inset-0">
        <div className="absolute w-px h-full left-1/2 bg-slate-700" />
        <div className="absolute h-px w-full top-1/2 bg-slate-700" />
        <div className="absolute w-px h-full left-1/4 bg-slate-800/50" />
        <div className="absolute w-px h-full left-3/4 bg-slate-800/50" />
        <div className="absolute h-px w-full top-1/4 bg-slate-800/50" />
        <div className="absolute h-px w-full top-3/4 bg-slate-800/50" />
      </div>

      {/* Competitor bubbles */}
      {competitors.map((comp) => {
        const x = comp.offerSimilarity;
        const y = 100 - comp.audienceSimilarity;
        const size = Math.max(28, Math.min(60, comp.overallScore / 2 + 14));
        const isSelected = comp.id === selectedCompetitorId;
        const colors = getRoleColor(comp.role);

        return (
          <div
            key={comp.id}
            className="absolute group cursor-pointer"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: isSelected ? 10 : 1,
            }}
            onClick={() => onSelectCompetitor(comp.id)}
          >
            <div
              className={`rounded-full ${colors.bg} border-2 ${
                isSelected ? 'border-white ring-2 ring-white/30' : 'border-white/50'
              } flex items-center justify-center text-white text-xs font-bold shadow-lg transition-transform hover:scale-110`}
              style={{ width: size, height: size }}
            >
              {comp.competitorName.slice(0, 2).toUpperCase()}
            </div>

            {/* Hover tooltip */}
            <div className="absolute left-1/2 -translate-x-1/2 -top-24 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 p-3 rounded-lg text-xs text-slate-200 whitespace-nowrap z-20 shadow-xl border border-slate-700 pointer-events-none">
              <p className="font-semibold text-white">{comp.competitorName}</p>
              {comp.competitorDomain && <p className="text-slate-400">{comp.competitorDomain}</p>}
              <div className="mt-2 space-y-1">
                <p>Overall: <span className="text-amber-400">{comp.overallScore}%</span></p>
                <p>Offer: <span className="text-blue-400">{comp.offerSimilarity}%</span></p>
                <p>Audience: <span className="text-emerald-400">{comp.audienceSimilarity}%</span></p>
                {comp.threatLevel !== null && (
                  <p>Threat: <span className={comp.threatLevel >= 60 ? 'text-red-400' : 'text-slate-400'}>{comp.threatLevel}</span></p>
                )}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-700">
                <span className={`px-2 py-0.5 rounded text-xs ${colors.bg}/20 ${colors.text}`}>
                  {comp.role}
                </span>
                {comp.provenance?.humanOverride && (
                  <span className="ml-1 px-2 py-0.5 rounded text-xs bg-cyan-500/20 text-cyan-400">
                    Manual
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Center: "YOU" marker */}
      <div
        className="absolute group"
        style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 5 }}
      >
        <div className="w-12 h-12 rounded-full bg-emerald-500 border-3 border-white flex items-center justify-center text-white text-xs font-bold shadow-lg">
          YOU
        </div>
      </div>

      {/* Axis labels */}
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs text-slate-500">
        Offer Similarity &rarr;
      </div>
      <div className="absolute -left-1 top-1/2 -translate-y-1/2 -rotate-90 text-xs text-slate-500 whitespace-nowrap origin-center">
        Audience Similarity &rarr;
      </div>

      {/* Quadrant labels */}
      <div className="absolute top-2 left-2 text-[10px] text-slate-600">Different Offer, Same Audience</div>
      <div className="absolute top-2 right-2 text-[10px] text-slate-600 text-right">Core Competition</div>
      <div className="absolute bottom-2 left-2 text-[10px] text-slate-600">Different Market</div>
      <div className="absolute bottom-2 right-2 text-[10px] text-slate-600 text-right">Same Offer, Different Audience</div>

      {/* Legend */}
      <div className="absolute -bottom-12 left-0 right-0 flex items-center justify-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-white" />
          <span className="text-slate-400">{companyName}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-red-500" />
          <span className="text-slate-400">Core</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-amber-500" />
          <span className="text-slate-400">Secondary</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-slate-500" />
          <span className="text-slate-400">Alternative</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// List View
// ============================================================================

function ListView({
  competitors,
  selectedCompetitorId,
  onSelectCompetitor,
  onPromoteCompetitor,
  onRemoveCompetitor,
  sortKey,
  sortDir,
  onSort,
}: {
  competitors: ScoredCompetitor[];
  selectedCompetitorId: string | null;
  onSelectCompetitor: (id: string | null) => void;
  onPromoteCompetitor: (id: string) => void;
  onRemoveCompetitor: (id: string) => void;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const SortHeader = ({ label, sortKeyVal }: { label: string; sortKeyVal: SortKey }) => (
    <th
      className="px-3 py-2 text-left text-xs font-medium text-slate-400 cursor-pointer hover:text-slate-300 select-none"
      onClick={() => onSort(sortKeyVal)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortKey === sortKeyVal && (
          <span className="text-amber-400">{sortDir === 'asc' ? '↑' : '↓'}</span>
        )}
      </div>
    </th>
  );

  if (competitors.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-slate-400 text-sm">No competitors to display</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-800 overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-900">
          <tr>
            <SortHeader label="Name" sortKeyVal="name" />
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Domain</th>
            <SortHeader label="Role" sortKeyVal="role" />
            <SortHeader label="Score" sortKeyVal="overallScore" />
            <SortHeader label="Offer" sortKeyVal="offerSimilarity" />
            <SortHeader label="Audience" sortKeyVal="audienceSimilarity" />
            <SortHeader label="Threat" sortKeyVal="threatLevel" />
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {competitors.map((comp) => {
            const isSelected = comp.id === selectedCompetitorId;
            const colors = getRoleColor(comp.role);

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
                    <span className="text-sm font-medium text-slate-200">{comp.competitorName}</span>
                    {comp.provenance?.humanOverride && (
                      <span className="px-1 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-400">
                        Manual
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-slate-400">{comp.competitorDomain || '-'}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${colors.bg}/20 ${colors.text}`}>
                    {comp.role}
                  </span>
                </td>
                <td className="px-3 py-2 text-sm text-amber-400 font-medium">{comp.overallScore}%</td>
                <td className="px-3 py-2 text-sm text-blue-400">{comp.offerSimilarity}%</td>
                <td className="px-3 py-2 text-sm text-emerald-400">{comp.audienceSimilarity}%</td>
                <td className="px-3 py-2">
                  {comp.threatLevel !== null ? (
                    <span className={`text-sm font-medium ${comp.threatLevel >= 60 ? 'text-red-400' : 'text-slate-400'}`}>
                      {comp.threatLevel}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">-</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {comp.role !== 'core' && (
                      <button
                        onClick={() => onPromoteCompetitor(comp.id)}
                        className="p-1 rounded text-slate-400 hover:text-emerald-400 hover:bg-slate-700 transition-colors"
                        title="Promote to Core"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => onRemoveCompetitor(comp.id)}
                      className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors"
                      title="Remove"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    {comp.competitorDomain && (
                      <a
                        href={`https://${comp.competitorDomain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded text-slate-400 hover:text-blue-400 hover:bg-slate-700 transition-colors"
                        title="Open site"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                  </div>
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
// Compare View
// ============================================================================

function CompareView({
  companyName,
  companyContext,
  selectedCompetitor,
}: {
  companyName: string;
  companyContext: CompanyContext;
  selectedCompetitor: ScoredCompetitor | null;
}) {
  if (!selectedCompetitor) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <p className="text-slate-400 text-sm">Select a competitor to compare</p>
          <p className="text-slate-500 text-xs mt-1">Click on a competitor in the Map or List view</p>
        </div>
      </div>
    );
  }

  const enriched = selectedCompetitor.enrichedData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-200">Us vs. {selectedCompetitor.competitorName}</h3>
        <span className={`px-2 py-1 rounded text-xs ${getRoleColor(selectedCompetitor.role).bg}/20 ${getRoleColor(selectedCompetitor.role).text}`}>
          {selectedCompetitor.role}
        </span>
      </div>

      {/* Comparison Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Our Column */}
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
          <h4 className="text-sm font-medium text-emerald-400 mb-4 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            {companyName}
          </h4>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-slate-500">Positioning</p>
              <p className="text-slate-300">{companyContext.industry || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Target Audience</p>
              <p className="text-slate-300 line-clamp-2">{companyContext.icpDescription || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Geographic Focus</p>
              <p className="text-slate-300">{companyContext.geographicFootprint || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Primary Offers</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {companyContext.primaryOffers.length > 0 ? (
                  companyContext.primaryOffers.map((offer, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded bg-slate-800 text-xs text-slate-400">
                      {offer}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400">Not specified</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Competitor Column */}
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <h4 className="text-sm font-medium text-red-400 mb-4 flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${getRoleColor(selectedCompetitor.role).bg}`} />
            {selectedCompetitor.competitorName}
          </h4>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-slate-500">Positioning</p>
              <p className="text-slate-300">{enriched?.positioning || enriched?.category || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Target Audience</p>
              <p className="text-slate-300 line-clamp-2">{enriched?.targetAudience || enriched?.icpDescription || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Geographic Focus</p>
              <p className="text-slate-300">{enriched?.geographicFocus || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Primary Offers</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {enriched?.primaryOffers && enriched.primaryOffers.length > 0 ? (
                  enriched.primaryOffers.map((offer, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded bg-slate-800 text-xs text-slate-400">
                      {offer}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400">Unknown</span>
                )}
              </div>
            </div>
            {enriched?.pricingTier && (
              <div>
                <p className="text-xs text-slate-500">Pricing Tier</p>
                <p className="text-slate-300 capitalize">{enriched.pricingTier}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scores Comparison */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
        <h4 className="text-sm font-medium text-slate-300 mb-4">Similarity Scores</h4>
        <div className="grid grid-cols-4 gap-4">
          <ScoreBar label="Overall" value={selectedCompetitor.overallScore} color="amber" />
          <ScoreBar label="Offer" value={selectedCompetitor.offerSimilarity} color="blue" />
          <ScoreBar label="Audience" value={selectedCompetitor.audienceSimilarity} color="emerald" />
          <ScoreBar label="Geo" value={selectedCompetitor.geoOverlap} color="purple" />
        </div>
      </div>

      {/* AI Analysis */}
      {selectedCompetitor.howTheyDiffer && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <h4 className="text-sm font-medium text-slate-300 mb-2">How We Differ</h4>
          <p className="text-sm text-slate-400">{selectedCompetitor.howTheyDiffer}</p>
        </div>
      )}

      {/* Threat Analysis */}
      {selectedCompetitor.threatLevel !== null && (
        <div className={`rounded-lg border p-4 ${
          selectedCompetitor.threatLevel >= 60
            ? 'border-red-500/30 bg-red-500/5'
            : 'border-slate-800 bg-slate-900/50'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-slate-300">Threat Assessment</h4>
            <span className={`text-lg font-bold ${
              selectedCompetitor.threatLevel >= 60 ? 'text-red-400' : 'text-slate-400'
            }`}>
              {selectedCompetitor.threatLevel}/100
            </span>
          </div>
          {selectedCompetitor.threatDrivers.length > 0 && (
            <ul className="text-xs text-slate-400 space-y-1">
              {selectedCompetitor.threatDrivers.map((driver, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">•</span>
                  {driver}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Score Bar Component
// ============================================================================

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClasses = {
    amber: 'bg-amber-500',
    blue: 'bg-blue-500',
    emerald: 'bg-emerald-500',
    purple: 'bg-purple-500',
    red: 'bg-red-500',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-500">{label}</span>
        <span className="text-xs font-medium text-slate-300">{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`h-full rounded-full ${colorClasses[color as keyof typeof colorClasses] || 'bg-slate-500'}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
