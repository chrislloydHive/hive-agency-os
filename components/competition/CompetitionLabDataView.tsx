// components/competition/CompetitionLabDataView.tsx
// Competition Lab V3.5 - Data View (Analyst Mode)
//
// Layout structure:
// 1. Controls Strip - Filters + Summary chips
// 2. Sub-tabs - Positioning Map / Competitor Table
// 3. Main Content - Map or Table + Detail drawer on right
// 4. Collapsible Sections - Full Insights

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
  GeoScope,
} from '@/lib/competition-v3/ui-types';
import {
  GEO_SCOPE_COLORS,
  GEO_SCOPE_LABELS,
} from '@/lib/competition-v3/ui-types';
import {
  getUiTypeModelForContext,
  getTypeTailwindClasses,
  getTypeLabel,
  getTypeBadgeLabel,
  getTypeHexColor,
  mapTypeForContext,
  type UiCompetitorTypeKey,
  type BusinessModelCategory,
  type VerticalCategory,
} from '@/lib/competition-v3/uiTypeModel';

// ============================================================================
// Types
// ============================================================================

interface Props {
  companyId: string;
  companyName: string;
  data: CompetitionRunV3Response | null;
  isLoading: boolean;
  // Vertical-aware context
  businessModelCategory?: BusinessModelCategory | null;
  verticalCategory?: VerticalCategory | string | null;
}

type DataViewTab = 'map' | 'table';
type GeoFilter = 'all' | GeoScope;

// ============================================================================
// Component
// ============================================================================

export function CompetitionLabDataView({
  companyId,
  companyName,
  data,
  isLoading,
  businessModelCategory,
  verticalCategory,
}: Props) {
  // Get vertical-aware type model
  const typeModel = useMemo(
    () => getUiTypeModelForContext({ businessModelCategory, verticalCategory }),
    [businessModelCategory, verticalCategory]
  );

  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string | null>(null);
  const [hoveredCompetitorId, setHoveredCompetitorId] = useState<string | null>(null);
  const [activeViewTab, setActiveViewTab] = useState<DataViewTab>('map');
  // Initialize filter with allowed types from the model
  const [typeFilter, setTypeFilter] = useState<UiCompetitorTypeKey[]>(typeModel.allowedTypes);
  const [geoFilter, setGeoFilter] = useState<GeoFilter>('all');
  const [minThreat, setMinThreat] = useState(0);
  const [showFullInsights, setShowFullInsights] = useState(false);
  const [excludedDomains, setExcludedDomains] = useState<string[]>([]);

  // Handle mark invalid
  const handleMarkInvalid = useCallback(async (domain?: string | null) => {
    if (!domain) return;
    try {
      await fetch(`/api/os/companies/${companyId}/competition/mark-invalid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      });
      // Optimistically remove from UI
      setExcludedDomains(prev => Array.from(new Set([...prev, domain])));
      // Clear selection if the excluded competitor was selected
      if (selectedCompetitorId) {
        const selected = data?.competitors?.find(c => c.id === selectedCompetitorId);
        if (selected?.domain?.toLowerCase() === domain.toLowerCase()) {
          setSelectedCompetitorId(null);
        }
      }
    } catch (e) {
      console.error('Failed to mark invalid competitor', e);
    }
  }, [companyId, data?.competitors, selectedCompetitorId]);

  // Map context for type mapping
  const typeContext = useMemo(
    () => ({ businessModelCategory, verticalCategory }),
    [businessModelCategory, verticalCategory]
  );

  // Filter competitors by type, geo, threat, and excluded domains
  const filteredCompetitors = useMemo(() => {
    if (!data?.competitors) return [];
    const excluded = new Set(excludedDomains.map(d => d.toLowerCase()));
    return data.competitors.filter(c => {
      // Map the backend type to the appropriate UI type for this context
      const mappedType = mapTypeForContext(c.type, typeContext);
      if (!typeFilter.includes(mappedType)) return false;
      if (geoFilter !== 'all' && c.geoScope && c.geoScope !== geoFilter) return false;
      if (c.scores.threat < minThreat) return false;
      if (c.domain && excluded.has(c.domain.toLowerCase())) return false;
      return true;
    });
  }, [data?.competitors, typeFilter, geoFilter, minThreat, excludedDomains, typeContext]);

  // Get selected competitor
  const selectedCompetitor = useMemo(
    () => filteredCompetitors.find(c => c.id === selectedCompetitorId) || null,
    [filteredCompetitors, selectedCompetitorId]
  );

  // Calculate summary stats using mapped types
  const summaryStats = useMemo(() => {
    if (!filteredCompetitors.length) return null;
    const threats = filteredCompetitors.map(c => c.scores.threat).sort((a, b) => a - b);
    const avgThreat = Math.round(threats.reduce((a, b) => a + b, 0) / threats.length);
    const medianThreat = threats[Math.floor(threats.length / 2)];

    // Count by mapped type (context-aware)
    const byType: Record<UiCompetitorTypeKey, number> = {
      direct: 0,
      partial: 0,
      marketplace: 0,
      substitute: 0,
      internal: 0,
      fractional: 0,
      platform: 0,
    };
    for (const c of filteredCompetitors) {
      const mappedType = mapTypeForContext(c.type, typeContext);
      byType[mappedType]++;
    }

    return { avgThreat, medianThreat, byType };
  }, [filteredCompetitors, typeContext]);

  // Toggle type filter
  const toggleTypeFilter = useCallback((type: UiCompetitorTypeKey) => {
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
      {/* Layer 1: Controls + Summary Strip */}
      {/* ================================================================== */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-slate-900/50 border border-slate-800">
        {/* Type Filter - vertical-aware */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-500 uppercase mr-1">Type:</span>
          {typeModel.allowedTypes.map(type => {
            const isActive = typeFilter.includes(type);
            const colors = getTypeTailwindClasses(type);
            return (
              <button
                key={type}
                onClick={() => toggleTypeFilter(type)}
                className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                  isActive
                    ? `${colors.bg}/20 ${colors.text} border border-current/30`
                    : 'bg-slate-800/50 text-slate-500 border border-transparent hover:border-slate-700'
                }`}
                title={getTypeLabel(type)}
              >
                {getTypeBadgeLabel(type)}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-slate-700" />

        {/* Geo Filter */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-500 uppercase mr-1">Geo:</span>
          <select
            value={geoFilter}
            onChange={(e) => setGeoFilter(e.target.value as GeoFilter)}
            className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-slate-600"
          >
            <option value="all">All</option>
            <option value="local">Local</option>
            <option value="regional">Regional</option>
            <option value="national">National</option>
            <option value="online-only">Online Only</option>
          </select>
        </div>

        {/* Min Threat Slider */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 uppercase">Min Threat:</span>
          <input
            type="range"
            min="0"
            max="100"
            value={minThreat}
            onChange={(e) => setMinThreat(parseInt(e.target.value))}
            className="w-20 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
          <span className="text-xs text-slate-400 w-6 tabular-nums">{minThreat}</span>
        </div>

        {/* Divider */}
        <div className="flex-1" />

        {/* Summary Chips - vertical-aware */}
        {summaryStats && (
          <div className="flex items-center gap-2 text-[10px]">
            {/* Show counts only for types that have competitors */}
            {typeModel.allowedTypes.slice(0, 2).map(type => {
              const count = summaryStats.byType[type];
              if (count === 0) return null;
              const colors = getTypeTailwindClasses(type);
              return (
                <span
                  key={type}
                  className={`px-2 py-1 rounded ${colors.bg}/10 ${colors.text} border ${colors.bg}/20`}
                >
                  {getTypeBadgeLabel(type)}: {count}
                </span>
              );
            })}
            <span className="px-2 py-1 rounded bg-slate-800 text-slate-400">
              Avg: <span className={summaryStats.avgThreat >= 60 ? 'text-red-400' : ''}>{summaryStats.avgThreat}</span>
            </span>
            <span className="px-2 py-1 rounded bg-slate-800 text-slate-400">
              Median: {summaryStats.medianThreat}
            </span>
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* Layer 2: Sub-tabs (Map / Table) */}
      {/* ================================================================== */}
      <div className="flex items-center gap-1 border-b border-slate-800">
        <button
          onClick={() => setActiveViewTab('map')}
          className={`px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
            activeViewTab === 'map'
              ? 'text-amber-400 border-amber-400'
              : 'text-slate-400 border-transparent hover:text-slate-300'
          }`}
        >
          Positioning Map
        </button>
        <button
          onClick={() => setActiveViewTab('table')}
          className={`px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
            activeViewTab === 'table'
              ? 'text-slate-100 border-slate-400'
              : 'text-slate-400 border-transparent hover:text-slate-300'
          }`}
        >
          Competitor Table
        </button>
        <span className="ml-auto text-[10px] text-slate-500 pr-2">
          {filteredCompetitors.length} competitor{filteredCompetitors.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ================================================================== */}
      {/* Layer 3: Main Content (Map/Table + Detail Drawer) */}
      {/* ================================================================== */}
      <div className="grid grid-cols-[1fr,360px] gap-4">
        {/* Left: Map or Table */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/30 overflow-hidden">
          {activeViewTab === 'map' ? (
            <div className="p-4 h-[550px]">
              <PositioningMapV3
                companyName={companyName}
                competitors={filteredCompetitors}
                selectedCompetitorId={selectedCompetitorId}
                hoveredCompetitorId={hoveredCompetitorId}
                onSelectCompetitor={setSelectedCompetitorId}
                onHoverCompetitor={setHoveredCompetitorId}
                businessModelCategory={businessModelCategory}
                verticalCategory={verticalCategory}
              />
            </div>
          ) : (
            <div className="max-h-[550px] overflow-auto">
              <CompetitorTableV35
                competitors={filteredCompetitors}
                selectedCompetitorId={selectedCompetitorId}
                hoveredCompetitorId={hoveredCompetitorId}
                onSelectCompetitor={setSelectedCompetitorId}
                onHoverCompetitor={setHoveredCompetitorId}
                businessModelCategory={businessModelCategory}
                verticalCategory={verticalCategory}
              />
            </div>
          )}
        </div>

        {/* Right: Detail Drawer */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4 overflow-auto max-h-[550px]">
          {selectedCompetitor ? (
            <CompetitorCardV3
              competitor={selectedCompetitor}
              onClose={() => setSelectedCompetitorId(null)}
              onMarkInvalid={handleMarkInvalid}
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

      {/* Low Data Warning */}
      {filteredCompetitors.length > 0 && filteredCompetitors.length < 3 && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-300">Limited competitor data</p>
              <p className="text-xs text-amber-400/70 mt-1">
                Only {filteredCompetitors.length} competitor{filteredCompetitors.length !== 1 ? 's' : ''} found. Consider:
              </p>
              <ul className="text-xs text-amber-400/70 mt-2 space-y-1">
                <li>• Adding known competitors manually in Brain → Context → Competitive</li>
                <li>• Adjusting filters above to show more results</li>
                <li>• Re-running the analysis with updated company context</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* Layer 4: Full Strategic Insights (Collapsible) */}
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
// Competitor Table V3.5 (Enhanced with V3.5 fields)
// ============================================================================

function CompetitorTableV35({
  competitors,
  selectedCompetitorId,
  hoveredCompetitorId,
  onSelectCompetitor,
  onHoverCompetitor,
  businessModelCategory,
  verticalCategory,
}: {
  competitors: CompetitionCompetitor[];
  selectedCompetitorId: string | null;
  hoveredCompetitorId: string | null;
  onSelectCompetitor: (id: string | null) => void;
  onHoverCompetitor: (id: string | null) => void;
  businessModelCategory?: BusinessModelCategory | null;
  verticalCategory?: VerticalCategory | string | null;
}) {
  const [sortKey, setSortKey] = useState<'name' | 'type' | 'threat' | 'jtbd' | 'overlap' | 'signals' | 'geo'>('threat');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Context for type mapping
  const typeContext = { businessModelCategory, verticalCategory };

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
        case 'jtbd':
          aVal = a.signals?.jtbdMatches ?? 0;
          bVal = b.signals?.jtbdMatches ?? 0;
          break;
        case 'overlap':
          aVal = a.signals?.offerOverlapScore ?? 0;
          bVal = b.signals?.offerOverlapScore ?? 0;
          break;
        case 'signals':
          aVal = a.signals?.signalsVerified ?? 0;
          bVal = b.signals?.signalsVerified ?? 0;
          break;
        case 'geo':
          const geoOrder = { local: 0, regional: 1, national: 2, 'online-only': 3 };
          aVal = a.geoScope ? geoOrder[a.geoScope] : 4;
          bVal = b.geoScope ? geoOrder[b.geoScope] : 4;
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

  const SortHeader = ({ label, sortKeyVal, title }: { label: string; sortKeyVal: typeof sortKey; title?: string }) => (
    <th
      className="px-3 py-2 text-left text-[10px] font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-400 select-none whitespace-nowrap"
      onClick={() => handleSort(sortKeyVal)}
      title={title}
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
        <thead className="bg-slate-900/50 sticky top-0 z-10">
          <tr>
            <SortHeader label="Name" sortKeyVal="name" />
            <SortHeader label="Type" sortKeyVal="type" />
            <SortHeader label="Threat" sortKeyVal="threat" />
            <SortHeader label="JTBD" sortKeyVal="jtbd" title="Jobs-to-be-done match" />
            <SortHeader label="Overlap" sortKeyVal="overlap" title="Offer overlap score" />
            <SortHeader label="Signals" sortKeyVal="signals" title="Verified signals" />
            <SortHeader label="Geo" sortKeyVal="geo" title="Geographic scope" />
            <th className="px-3 py-2 text-left text-[10px] font-medium text-slate-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {sortedCompetitors.map(comp => {
            const isSelected = comp.id === selectedCompetitorId;
            const isHovered = comp.id === hoveredCompetitorId;
            // Map backend type to UI type for this context
            const mappedType = mapTypeForContext(comp.type, typeContext);
            const colors = getTypeTailwindClasses(mappedType);
            const geoColors = comp.geoScope ? GEO_SCOPE_COLORS[comp.geoScope] : null;

            return (
              <tr
                key={comp.id}
                className={`cursor-pointer transition-colors ${
                  isSelected ? 'bg-amber-500/10' : isHovered ? 'bg-slate-800/50' : 'hover:bg-slate-800/30'
                }`}
                onClick={() => onSelectCompetitor(comp.id)}
                onMouseEnter={() => onHoverCompetitor(comp.id)}
                onMouseLeave={() => onHoverCompetitor(null)}
              >
                {/* Name */}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${colors.bg}`} />
                    <div className="min-w-0">
                      <span className="text-xs font-medium text-slate-200 block truncate max-w-[150px]">{comp.name}</span>
                      {comp.domain && (
                        <span className="text-[10px] text-slate-500 block truncate max-w-[150px]">{comp.domain}</span>
                      )}
                    </div>
                  </div>
                </td>

                {/* Type - vertical-aware */}
                <td className="px-3 py-2">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] ${colors.bg}/20 ${colors.text}`}>
                    {getTypeBadgeLabel(mappedType)}
                  </span>
                </td>

                {/* Threat */}
                <td className="px-3 py-2">
                  <span className={`text-xs font-medium ${comp.scores.threat >= 60 ? 'text-red-400' : 'text-slate-400'}`}>
                    {comp.scores.threat}
                  </span>
                </td>

                {/* JTBD Match */}
                <td className="px-3 py-2 text-xs text-slate-400">
                  {comp.signals?.jtbdMatches != null
                    ? `${Math.round(comp.signals.jtbdMatches * 100)}%`
                    : '-'}
                </td>

                {/* Offer Overlap */}
                <td className="px-3 py-2 text-xs text-slate-400">
                  {comp.signals?.offerOverlapScore != null
                    ? `${Math.round(comp.signals.offerOverlapScore * 100)}%`
                    : '-'}
                </td>

                {/* Signals Verified */}
                <td className="px-3 py-2 text-xs text-slate-400">
                  {comp.signals?.signalsVerified != null
                    ? `${comp.signals.signalsVerified}/5`
                    : '-'}
                </td>

                {/* Geo Scope */}
                <td className="px-3 py-2">
                  {comp.geoScope && geoColors ? (
                    <span className={`px-1.5 py-0.5 rounded text-[9px] ${geoColors.bg}/20 ${geoColors.text}`}>
                      {GEO_SCOPE_LABELS[comp.geoScope]}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">-</span>
                  )}
                </td>

                {/* Actions */}
                <td className="px-3 py-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCompetitor(comp.id);
                    }}
                    className="text-[10px] text-slate-400 hover:text-amber-400 transition-colors"
                  >
                    View
                  </button>
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
