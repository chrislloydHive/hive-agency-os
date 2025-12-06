'use client';

// app/c/[companyId]/brain/context/explorer/ContextExplorerClient.tsx
// Context Graph Explorer 2.0 - Main Client Component
//
// Power-user inspector view with:
// - Left sidebar: Tree navigation by domain/field
// - Main panel: Field details, provenance, history, usage

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  ChevronRight,
  ChevronDown,
  Filter,
  X,
  ArrowLeft,
  Database,
  Activity,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  User,
  Bot,
  RefreshCw,
} from 'lucide-react';
import type { GraphFieldUi, ContextDomainId } from '@/lib/contextGraph/uiHelpers';
import { CONTEXT_DOMAIN_META } from '@/lib/contextGraph/uiHelpers';
import type { ContextHealthScore } from '@/lib/contextGraph/health';
import { FieldTreeSidebar } from './FieldTreeSidebar';
import { FieldDetailPanel } from './FieldDetailPanel';
import { ExplorerSearchResults } from './ExplorerSearchResults';

// ============================================================================
// Types
// ============================================================================

export interface ExplorerInsight {
  id: string;
  title: string;
  severity?: string;
  category: string;
  contextPaths?: string[];
}

export interface ExplorerSnapshot {
  id: string;
  label: string;
  createdAt: string;
  reason?: string;
}

interface ContextExplorerClientProps {
  companyId: string;
  companyName: string;
  fields: GraphFieldUi[];
  fieldsByDomain: Record<string, GraphFieldUi[]>;
  healthScore: ContextHealthScore;
  needsRefreshPaths: string[];
  snapshots: ExplorerSnapshot[];
  insights: ExplorerInsight[];
  initialFieldPath?: string;
  initialDomain?: string;
  initialSearch?: string;
}

// ============================================================================
// Filter Types
// ============================================================================

type SourceFilter = 'all' | 'human' | 'ai' | 'mixed' | 'fcb' | 'labs' | 'gap' | 'setup';
type CompletenessFilter = 'all' | 'full' | 'partial' | 'empty';

interface ExplorerFilters {
  source: SourceFilter;
  completeness: CompletenessFilter;
  changedSinceSnapshot: string | null;
}

// ============================================================================
// Main Component
// ============================================================================

export function ContextExplorerClient({
  companyId,
  companyName,
  fields,
  fieldsByDomain,
  healthScore,
  needsRefreshPaths,
  snapshots,
  insights,
  initialFieldPath,
  initialDomain,
  initialSearch,
}: ContextExplorerClientProps) {
  // State
  const [selectedFieldPath, setSelectedFieldPath] = useState<string | null>(initialFieldPath || null);
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (initialDomain) {
      initial.add(initialDomain);
    } else if (initialFieldPath) {
      const domain = initialFieldPath.split('.')[0];
      initial.add(domain);
    }
    return initial;
  });
  const [searchQuery, setSearchQuery] = useState(initialSearch || '');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [filters, setFilters] = useState<ExplorerFilters>({
    source: 'all',
    completeness: 'all',
    changedSinceSnapshot: null,
  });
  const [showFilters, setShowFilters] = useState(false);

  // Get selected field
  const selectedField = useMemo(() => {
    if (!selectedFieldPath) return null;
    return fields.find(f => f.path === selectedFieldPath) || null;
  }, [fields, selectedFieldPath]);

  // Get insights for selected field
  const fieldInsights = useMemo(() => {
    if (!selectedFieldPath) return [];
    return insights.filter(i =>
      i.contextPaths?.some(p => p === selectedFieldPath || selectedFieldPath.startsWith(p + '.'))
    );
  }, [insights, selectedFieldPath]);

  // Filter fields based on search and filters
  const filteredFields = useMemo(() => {
    let result = [...fields];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(f =>
        f.label.toLowerCase().includes(query) ||
        f.path.toLowerCase().includes(query) ||
        f.domain.toLowerCase().includes(query) ||
        (f.value && f.value.toLowerCase().includes(query))
      );
    }

    // Source filter
    if (filters.source !== 'all') {
      result = result.filter(f => {
        if (!f.provenance || f.provenance.length === 0) return false;
        const source = f.provenance[0]?.source || '';
        switch (filters.source) {
          case 'human':
            return source === 'manual' || source === 'user';
          case 'ai':
            return source.includes('lab') || source === 'gap_ia';
          case 'mixed':
            return f.provenance.length > 1;
          case 'fcb':
            return source === 'fcb';
          case 'labs':
            return source.includes('lab');
          case 'gap':
            return source.startsWith('gap');
          case 'setup':
            return source === 'setup_wizard';
          default:
            return true;
        }
      });
    }

    // Completeness filter
    if (filters.completeness !== 'all') {
      result = result.filter(f => {
        const hasValue = f.value !== null && f.value !== '';
        switch (filters.completeness) {
          case 'full':
            return hasValue;
          case 'partial':
            return hasValue && needsRefreshPaths.includes(f.path);
          case 'empty':
            return !hasValue;
          default:
            return true;
        }
      });
    }

    return result;
  }, [fields, searchQuery, filters, needsRefreshPaths]);

  // Group filtered fields by domain
  const filteredFieldsByDomain = useMemo(() => {
    const grouped: Record<string, GraphFieldUi[]> = {};
    for (const field of filteredFields) {
      if (!grouped[field.domain]) {
        grouped[field.domain] = [];
      }
      grouped[field.domain].push(field);
    }
    return grouped;
  }, [filteredFields]);

  // Toggle domain expansion
  const toggleDomain = useCallback((domain: string) => {
    setExpandedDomains(prev => {
      const next = new Set(prev);
      if (next.has(domain)) {
        next.delete(domain);
      } else {
        next.add(domain);
      }
      return next;
    });
  }, []);

  // Select field handler
  const handleSelectField = useCallback((path: string) => {
    setSelectedFieldPath(path);
    // Expand the domain if not expanded
    const domain = path.split('.')[0];
    setExpandedDomains(prev => {
      if (prev.has(domain)) return prev;
      return new Set([...prev, domain]);
    });
    // Update URL without navigation
    const url = new URL(window.location.href);
    url.searchParams.set('field', path);
    window.history.replaceState({}, '', url.toString());
  }, []);

  // Handle search result click
  const handleSearchResultClick = useCallback((field: GraphFieldUi) => {
    handleSelectField(field.path);
    setSearchQuery('');
    setIsSearchFocused(false);
  }, [handleSelectField]);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  // Check if any filters are active
  const hasActiveFilters = filters.source !== 'all' ||
    filters.completeness !== 'all' ||
    filters.changedSinceSnapshot !== null;

  // Reset filters
  const resetFilters = useCallback(() => {
    setFilters({
      source: 'all',
      completeness: 'all',
      changedSinceSnapshot: null,
    });
  }, []);

  // Stats
  const stats = useMemo(() => {
    const total = fields.length;
    const populated = fields.filter(f => f.value !== null && f.value !== '').length;
    const stale = needsRefreshPaths.length;
    return { total, populated, stale };
  }, [fields, needsRefreshPaths]);

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <Link
            href={`/c/${companyId}/brain/context`}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Context</span>
          </Link>
          <div className="w-px h-6 bg-slate-700" />
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-amber-400" />
            <h1 className="text-lg font-semibold text-slate-100">Context Explorer</h1>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Fields:</span>
            <span className="text-slate-300 font-medium">{stats.populated}/{stats.total}</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-400" />
            <span className="text-slate-500">Health:</span>
            <span className={`font-bold ${
              healthScore.overallScore >= 70 ? 'text-emerald-400' :
              healthScore.overallScore >= 40 ? 'text-amber-400' : 'text-red-400'
            }`}>
              {healthScore.overallScore}%
            </span>
          </div>
          {stats.stale > 0 && (
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-amber-400" />
              <span className="text-amber-400 font-medium">{stats.stale} stale</span>
            </div>
          )}
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div className="px-6 py-3 border-b border-slate-800/50 bg-slate-900/50">
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              placeholder="Search fields by label, path, domain, or value..."
              className="w-full pl-10 pr-10 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-500 hover:text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Search Results Dropdown */}
            {isSearchFocused && searchQuery && filteredFields.length > 0 && (
              <ExplorerSearchResults
                results={filteredFields.slice(0, 10)}
                onSelect={handleSearchResultClick}
                needsRefreshPaths={new Set(needsRefreshPaths)}
              />
            )}
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              hasActiveFilters
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
            {hasActiveFilters && (
              <span className="px-1.5 py-0.5 text-[10px] bg-amber-500/30 rounded">
                Active
              </span>
            )}
          </button>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-800/50">
            {/* Source Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Source:</span>
              <select
                value={filters.source}
                onChange={(e) => setFilters(prev => ({ ...prev, source: e.target.value as SourceFilter }))}
                className="px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-slate-300 focus:outline-none focus:border-amber-500/50"
              >
                <option value="all">All</option>
                <option value="human">Human</option>
                <option value="ai">AI</option>
                <option value="fcb">FCB</option>
                <option value="labs">Labs</option>
                <option value="gap">GAP</option>
                <option value="setup">Setup</option>
              </select>
            </div>

            {/* Completeness Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Completeness:</span>
              <select
                value={filters.completeness}
                onChange={(e) => setFilters(prev => ({ ...prev, completeness: e.target.value as CompletenessFilter }))}
                className="px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-slate-300 focus:outline-none focus:border-amber-500/50"
              >
                <option value="all">All</option>
                <option value="full">Has Value</option>
                <option value="partial">Needs Refresh</option>
                <option value="empty">Empty</option>
              </select>
            </div>

            {/* Changed Since */}
            {snapshots.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Changed since:</span>
                <select
                  value={filters.changedSinceSnapshot || ''}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    changedSinceSnapshot: e.target.value || null
                  }))}
                  className="px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-slate-300 focus:outline-none focus:border-amber-500/50"
                >
                  <option value="">Any time</option>
                  {snapshots.slice(0, 10).map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
            )}

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="ml-auto text-xs text-slate-500 hover:text-slate-400"
              >
                Reset filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Field Tree */}
        <FieldTreeSidebar
          fieldsByDomain={filteredFieldsByDomain}
          allFieldsByDomain={fieldsByDomain}
          expandedDomains={expandedDomains}
          selectedFieldPath={selectedFieldPath}
          needsRefreshPaths={new Set(needsRefreshPaths)}
          insights={insights}
          onToggleDomain={toggleDomain}
          onSelectField={handleSelectField}
        />

        {/* Main Panel */}
        <div className="flex-1 overflow-y-auto">
          {selectedField ? (
            <FieldDetailPanel
              field={selectedField}
              companyId={companyId}
              needsRefresh={needsRefreshPaths.includes(selectedField.path)}
              insights={fieldInsights}
              snapshots={snapshots}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <Database className="w-12 h-12 text-slate-700 mb-4" />
              <h2 className="text-lg font-medium text-slate-400 mb-2">
                Select a field to inspect
              </h2>
              <p className="text-sm text-slate-500 max-w-md">
                Browse the field tree on the left or use the search bar to find specific fields.
                You can view values, provenance history, and see where each field is used.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
