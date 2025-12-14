// components/context-map/ContextMapListView.tsx
// Searchable, sortable table view for Context nodes

'use client';

import { useState, useMemo, useCallback } from 'react';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Check, CheckCheck, Sparkles, User, TestTube, FileInput, Filter, ChevronDown, X, Trash2, Plus, Loader2 } from 'lucide-react';
import type { HydratedContextNode } from '@/lib/contextGraph/nodes';
import type { MapFilters, ZoneId } from './types';
import type { SortConfig } from '@/lib/contextMap';
import { getShortLabel, truncateValue, formatRelativeTime, SOURCE_LABELS, ZONE_DEFINITIONS, DOMAIN_TO_ZONE } from './constants';
import { searchNodes, sortNodes, filterNodes } from '@/lib/contextMap';

// Local filter state for table-specific filtering
interface TableFilters {
  zone: ZoneId | 'all';
  status: 'all' | 'confirmed' | 'proposed';
  source: 'all' | 'user' | 'ai' | 'lab' | 'import';
  minConfidence: number;
}

interface ContextMapListViewProps {
  nodes: HydratedContextNode[];
  filters: MapFilters;
  onNodeClick: (node: HydratedContextNode) => void;
  selectedNode: HydratedContextNode | null;
  /** Accept a proposal (for proposed nodes) */
  onAcceptProposal?: (proposalId: string, batchId: string) => Promise<void>;
  /** Reject a proposal (for proposed nodes) */
  onRejectProposal?: (proposalId: string, batchId: string) => Promise<void>;
  /** Delete a confirmed node's value */
  onDeleteNode?: (nodeKey: string) => Promise<void>;
  /** Add a new context node (AI or manual) */
  onAddNode?: (zoneId: string, mode: 'ai' | 'manual') => void;
  /** Zone currently loading AI suggestions */
  loadingZoneId?: string | null;
}

type SortField = 'label' | 'value' | 'status' | 'source' | 'confidence' | 'lastUpdated' | 'zone';

const DEFAULT_TABLE_FILTERS: TableFilters = {
  zone: 'all',
  status: 'all',
  source: 'all',
  minConfidence: 0,
};

export function ContextMapListView({
  nodes,
  filters,
  onNodeClick,
  selectedNode,
  onAcceptProposal,
  onRejectProposal,
  onDeleteNode,
  onAddNode,
  loadingZoneId,
}: ContextMapListViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'confidence',
    direction: 'desc',
  });
  const [tableFilters, setTableFilters] = useState<TableFilters>(DEFAULT_TABLE_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (tableFilters.zone !== 'all') count++;
    if (tableFilters.status !== 'all') count++;
    if (tableFilters.source !== 'all') count++;
    if (tableFilters.minConfidence > 0) count++;
    return count;
  }, [tableFilters]);

  // Reset all filters
  const resetFilters = useCallback(() => {
    setTableFilters(DEFAULT_TABLE_FILTERS);
  }, []);

  // Filter and search nodes
  const filteredNodes = useMemo(() => {
    let result = filterNodes(nodes, filters);

    // Apply table-specific filters
    if (tableFilters.zone !== 'all') {
      result = result.filter(node => {
        const domain = node.key.split('.')[0];
        const nodeZone = DOMAIN_TO_ZONE[domain] || 'overflow';
        return nodeZone === tableFilters.zone;
      });
    }

    if (tableFilters.status !== 'all') {
      result = result.filter(node => {
        const isProposed = node.status === 'proposed' || !!node.pendingProposal;
        return tableFilters.status === 'proposed' ? isProposed : !isProposed;
      });
    }

    if (tableFilters.source !== 'all') {
      result = result.filter(node => node.source === tableFilters.source);
    }

    if (tableFilters.minConfidence > 0) {
      result = result.filter(node => node.confidence >= tableFilters.minConfidence / 100);
    }

    if (searchQuery.trim()) {
      result = searchNodes(result, searchQuery);
    }
    return sortNodes(result, sortConfig);
  }, [nodes, filters, searchQuery, sortConfig, tableFilters]);

  // Handle sort
  const handleSort = (field: SortField) => {
    setSortConfig((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  // Sort icon
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortConfig.field !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-500" />;
    }
    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-cyan-400" />
    ) : (
      <ArrowDown className="w-3 h-3 text-cyan-400" />
    );
  };

  // Source icon
  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'ai':
        return <Sparkles className="w-3.5 h-3.5 text-purple-400" />;
      case 'user':
        return <User className="w-3.5 h-3.5 text-cyan-400" />;
      case 'lab':
        return <TestTube className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <FileInput className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  // Get zone for a node
  const getZone = (node: HydratedContextNode) => {
    const domain = node.key.split('.')[0];
    const zoneId = DOMAIN_TO_ZONE[domain] || 'overflow';
    const zone = ZONE_DEFINITIONS.find(z => z.id === zoneId);
    return zone?.label || 'Other';
  };

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Search and Filter Bar */}
      <div className="px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search fields..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          {/* Filter Toggle Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              activeFilterCount > 0
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-600'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-cyan-500 text-slate-900 rounded-full">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          {/* Add Context Button (with zone dropdown) */}
          {onAddNode && (
            <div className="relative">
              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                disabled={!!loadingZoneId}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors bg-cyan-500/20 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/30 disabled:opacity-50"
              >
                {loadingZoneId ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Add Context
                <ChevronDown className={`w-3 h-3 transition-transform ${showAddMenu ? 'rotate-180' : ''}`} />
              </button>

              {/* Zone Dropdown */}
              {showAddMenu && (
                <div className="absolute right-0 top-full mt-1 z-10 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-xl">
                  <div className="px-3 py-2 border-b border-slate-700">
                    <span className="text-xs font-medium text-slate-400">Add AI-suggested context for:</span>
                  </div>
                  <div className="py-1 max-h-64 overflow-y-auto">
                    {ZONE_DEFINITIONS.map(zone => (
                      <button
                        key={zone.id}
                        onClick={() => {
                          onAddNode(zone.id, 'ai');
                          setShowAddMenu(false);
                        }}
                        disabled={loadingZoneId === zone.id}
                        className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700/50 flex items-center gap-2 disabled:opacity-50"
                      >
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: zone.color }}
                        />
                        <span>{zone.label}</span>
                        {loadingZoneId === zone.id && (
                          <Loader2 className="w-3 h-3 animate-spin ml-auto" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filter Dropdowns */}
        {showFilters && (
          <div className="mt-3 p-3 bg-slate-900/50 border border-slate-700 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-400">Filter by</span>
              {activeFilterCount > 0 && (
                <button
                  onClick={resetFilters}
                  className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Clear all
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Zone Filter */}
              <div>
                <label className="block text-[10px] font-medium text-slate-500 mb-1">Zone</label>
                <select
                  value={tableFilters.zone}
                  onChange={(e) => setTableFilters(prev => ({ ...prev, zone: e.target.value as ZoneId | 'all' }))}
                  className="w-full px-2 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="all">All Zones</option>
                  {ZONE_DEFINITIONS.map(zone => (
                    <option key={zone.id} value={zone.id}>{zone.label}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-[10px] font-medium text-slate-500 mb-1">Status</label>
                <select
                  value={tableFilters.status}
                  onChange={(e) => setTableFilters(prev => ({ ...prev, status: e.target.value as TableFilters['status'] }))}
                  className="w-full px-2 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="all">All Status</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="proposed">Proposed</option>
                </select>
              </div>

              {/* Source Filter */}
              <div>
                <label className="block text-[10px] font-medium text-slate-500 mb-1">Source</label>
                <select
                  value={tableFilters.source}
                  onChange={(e) => setTableFilters(prev => ({ ...prev, source: e.target.value as TableFilters['source'] }))}
                  className="w-full px-2 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="all">All Sources</option>
                  <option value="user">User</option>
                  <option value="ai">AI</option>
                  <option value="lab">Lab</option>
                  <option value="import">Import</option>
                </select>
              </div>

              {/* Confidence Filter */}
              <div>
                <label className="block text-[10px] font-medium text-slate-500 mb-1">
                  Min Confidence: {tableFilters.minConfidence}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  value={tableFilters.minConfidence}
                  onChange={(e) => setTableFilters(prev => ({ ...prev, minConfidence: parseInt(e.target.value) }))}
                  className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-cyan-500"
                />
              </div>
            </div>
          </div>
        )}

        <div className="mt-2 text-xs text-slate-500">
          {filteredNodes.length} of {nodes.length} fields
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-900 border-b border-slate-800">
            <tr>
              <th className="text-left px-4 py-2">
                <button
                  onClick={() => handleSort('label')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-200"
                >
                  Field <SortIcon field="label" />
                </button>
              </th>
              <th className="text-left px-4 py-2">
                <button
                  onClick={() => handleSort('value')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-200"
                >
                  Value <SortIcon field="value" />
                </button>
              </th>
              <th className="text-left px-4 py-2">
                <button
                  onClick={() => handleSort('zone')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-200"
                >
                  Zone <SortIcon field="zone" />
                </button>
              </th>
              <th className="text-center px-4 py-2">
                <button
                  onClick={() => handleSort('status')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-200"
                >
                  Status <SortIcon field="status" />
                </button>
              </th>
              <th className="text-center px-4 py-2">
                <button
                  onClick={() => handleSort('source')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-200"
                >
                  Source <SortIcon field="source" />
                </button>
              </th>
              <th className="text-right px-4 py-2">
                <button
                  onClick={() => handleSort('confidence')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-200"
                >
                  Confidence <SortIcon field="confidence" />
                </button>
              </th>
              <th className="text-right px-4 py-2">
                <button
                  onClick={() => handleSort('lastUpdated')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-200"
                >
                  Updated <SortIcon field="lastUpdated" />
                </button>
              </th>
              {/* Actions column - only show if handlers provided */}
              {(onAcceptProposal || onRejectProposal || onDeleteNode) && (
                <th className="text-center px-4 py-2">
                  <span className="text-xs font-medium text-slate-400">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {filteredNodes.map((node) => {
              const isSelected = selectedNode?.key === node.key;
              const isProposed = node.status === 'proposed' || !!node.pendingProposal;
              const label = getShortLabel(node.key);
              const valuePreview = truncateValue(node.value, 60);
              const confidencePercent = Math.round(node.confidence * 100);

              return (
                <tr
                  key={node.key}
                  onClick={() => onNodeClick(node)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-cyan-500/10'
                      : 'hover:bg-slate-800/50'
                  }`}
                >
                  {/* Field */}
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-slate-200">{label}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{node.key}</div>
                  </td>

                  {/* Value */}
                  <td className="px-4 py-2.5">
                    <div className="text-slate-300 max-w-xs truncate">
                      {valuePreview || <span className="text-slate-500 italic">(empty)</span>}
                    </div>
                  </td>

                  {/* Zone */}
                  <td className="px-4 py-2.5">
                    <span className="text-xs text-slate-400">{getZone(node)}</span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-2.5 text-center">
                    {isProposed ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        <Sparkles className="w-2.5 h-2.5" />
                        Proposed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <Check className="w-2.5 h-2.5" />
                        Confirmed
                      </span>
                    )}
                  </td>

                  {/* Source */}
                  <td className="px-4 py-2.5 text-center">
                    <div className="inline-flex items-center gap-1" title={SOURCE_LABELS[node.source]}>
                      {getSourceIcon(node.source)}
                    </div>
                  </td>

                  {/* Confidence */}
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-12 h-1.5 bg-slate-700 rounded-full">
                        <div
                          className={`h-full rounded-full ${
                            node.confidence > 0.7 ? 'bg-emerald-500' : node.confidence > 0.4 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${confidencePercent}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400 w-8">{confidencePercent}%</span>
                    </div>
                  </td>

                  {/* Updated */}
                  <td className="px-4 py-2.5 text-right">
                    <span className="text-xs text-slate-500">
                      {formatRelativeTime(node.lastUpdated)}
                    </span>
                  </td>

                  {/* Actions */}
                  {(onAcceptProposal || onRejectProposal || onDeleteNode) && (
                    <td className="px-4 py-2.5 text-center">
                      {isProposed && node.pendingProposal && node.proposalBatchId ? (
                        <div className="inline-flex items-center gap-1">
                          {onAcceptProposal && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onAcceptProposal(node.pendingProposal!.id, node.proposalBatchId!);
                              }}
                              className="p-1 text-emerald-400 hover:bg-emerald-500/20 rounded transition-colors"
                              title="Accept proposal"
                            >
                              <CheckCheck className="w-4 h-4" />
                            </button>
                          )}
                          {onRejectProposal && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onRejectProposal(node.pendingProposal!.id, node.proposalBatchId!);
                              }}
                              className="p-1 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                              title="Reject proposal"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ) : !isProposed && onDeleteNode && node.value !== null && node.value !== undefined ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete the value for "${getShortLabel(node.key)}"?`)) {
                              onDeleteNode(node.key);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                          title="Delete value"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Empty state */}
        {filteredNodes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Search className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">No fields match your search</p>
          </div>
        )}
      </div>
    </div>
  );
}
