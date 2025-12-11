'use client';

// app/c/[companyId]/brain/context/components/ContextCoverageView.tsx
// Coverage View - Cluster Circles Overview
//
// The bubble map showing what Hive knows and where the gaps are:
// - Left sidebar: domain list with health percentages
// - Main canvas: circle layout grouped by domain
// - Node colors by status (healthy=green, lowConfidence=yellow, conflict=red, etc.)
// - Node size by importance
// - Click to open Field Inspector

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { CoverageGraph, CoverageNode, CoverageDomainSummary } from '@/lib/os/context';
import type { DomainName } from '@/lib/contextGraph/companyContextGraph';

// ============================================================================
// Types
// ============================================================================

interface ContextCoverageViewProps {
  companyId: string;
  coverageData?: CoverageGraph | null;
  /** Callback when a node is selected */
  onSelectNode?: (nodeId: string) => void;
  /** Currently selected node ID */
  selectedNodeId?: string | null;
  /** Filter to specific domain */
  selectedDomain?: DomainName | null;
  /** Callback when domain filter changes */
  onDomainChange?: (domain: DomainName | null) => void;
}

// ============================================================================
// Status Colors
// ============================================================================

const STATUS_COLORS: Record<CoverageNode['status'], string> = {
  healthy: 'bg-emerald-500',
  lowConfidence: 'bg-amber-500',
  conflict: 'bg-red-500',
  missing: 'bg-slate-600',
  stale: 'bg-orange-500',
};

const STATUS_BORDER_COLORS: Record<CoverageNode['status'], string> = {
  healthy: 'border-emerald-400',
  lowConfidence: 'border-amber-400',
  conflict: 'border-red-400',
  missing: 'border-slate-500 border-dashed',
  stale: 'border-orange-400',
};

const STATUS_LABELS: Record<CoverageNode['status'], string> = {
  healthy: 'Healthy',
  lowConfidence: 'Low Confidence',
  conflict: 'Conflict',
  missing: 'Missing',
  stale: 'Stale',
};

// Domain colors for clustering (aligned with Hive OS design system)
const DOMAIN_COLORS: Record<string, string> = {
  identity: '#3b82f6',       // blue - Who the company is
  brand: '#f59e0b',          // amber - Positioning & narrative
  audience: '#ec4899',       // pink - Who it serves
  objectives: '#f97316',     // orange - Business goals
  website: '#10b981',        // emerald - Web presence
  seo: '#06b6d4',            // cyan - Search optimization
  content: '#6366f1',        // indigo - Content strategy
  competitive: '#ef4444',    // red - Market competition
  social: '#f43f5e',         // rose - Social channels
  digitalInfra: '#14b8a6',   // teal - Tech infrastructure
  performanceMedia: '#ef4444', // red - Demand generation
  ops: '#78716c',            // stone - Operations
  budgetOps: '#84cc16',      // lime - Budget management
  creative: '#d946ef',       // fuchsia - Creative assets
  historical: '#64748b',     // slate - Past data
  productOffer: '#8b5cf6',   // purple - Products & offers
  operationalConstraints: '#a3a3a3', // neutral - Constraints
  storeRisk: '#dc2626',      // red - Risk factors
  historyRefs: '#9ca3af',    // gray - References
  channels: '#22c55e',       // green - Distribution channels
};

// Domain descriptions for context
const DOMAIN_DESCRIPTIONS: Record<string, string> = {
  identity: 'Who the company is, where it operates, and what space it plays in.',
  brand: 'Positioning, narrative, and differentiation.',
  audience: 'Who it serves, their needs, and key segments.',
  objectives: 'Business goals, KPIs, and success metrics.',
  website: 'Web presence, structure, and technical setup.',
  seo: 'Search optimization, keywords, and rankings.',
  content: 'Content pillars, formats, and publishing strategy.',
  competitive: 'Market competitors, positioning, and differentiation.',
  social: 'Social media presence and engagement.',
  digitalInfra: 'Technology stack, integrations, and infrastructure.',
  performanceMedia: 'How demand is generated and captured.',
  ops: 'Systems, tools, workflows, and constraints.',
  budgetOps: 'Budget allocation and financial operations.',
  creative: 'Creative assets, guidelines, and production.',
  historical: 'Past campaigns, performance data, and learnings.',
  productOffer: 'Core products, services, and value propositions.',
  operationalConstraints: 'Limitations, compliance, and requirements.',
  storeRisk: 'Risk factors and mitigation strategies.',
  historyRefs: 'Historical references and documentation.',
  channels: 'Where the brand shows up: web, social, stores, marketplaces.',
};

// ============================================================================
// Domain Sidebar Component
// ============================================================================

interface DomainSidebarProps {
  domains: CoverageDomainSummary[];
  selectedDomain: DomainName | null;
  onSelectDomain: (domain: DomainName | null) => void;
}

function DomainSidebar({ domains, selectedDomain, onSelectDomain }: DomainSidebarProps) {
  // Sort domains by completeness (lowest first to highlight issues)
  const sortedDomains = useMemo(() =>
    [...domains].sort((a, b) => a.completeness - b.completeness),
    [domains]
  );

  return (
    <aside className="w-56 shrink-0 border-r border-slate-800 overflow-y-auto">
      <div className="p-4">
        <h3 className="text-sm font-medium text-slate-400 mb-3">Domains</h3>

        <button
          onClick={() => onSelectDomain(null)}
          className={`w-full text-left px-3 py-2 rounded-lg mb-2 text-sm transition-colors ${
            selectedDomain === null
              ? 'bg-slate-800 text-white'
              : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
          }`}
        >
          All Domains
        </button>

        <div className="space-y-1">
          {sortedDomains.map((domain) => {
            const isSelected = selectedDomain === domain.domain;
            const completionPct = Math.round(domain.completeness * 100);
            const hasIssues = domain.criticalIssues > 0;

            return (
              <button
                key={domain.domain}
                onClick={() => onSelectDomain(domain.domain)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                  isSelected
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: DOMAIN_COLORS[domain.domain] || '#666' }}
                  />
                  <span className="truncate">{domain.label}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {hasIssues && (
                    <span className="text-xs text-red-400">{domain.criticalIssues}</span>
                  )}
                  <span className={`text-xs tabular-nums ${
                    completionPct >= 75 ? 'text-emerald-400' :
                    completionPct >= 50 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {completionPct}%
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

// ============================================================================
// Node Bubble Component
// ============================================================================

interface NodeBubbleProps {
  node: CoverageNode;
  isSelected: boolean;
  onClick: () => void;
}

function NodeBubble({ node, isSelected, onClick }: NodeBubbleProps) {
  // Size based on importance (1-5)
  const size = 24 + (node.importance * 8);

  return (
    <button
      onClick={onClick}
      className={`
        group relative rounded-full transition-all duration-200
        border-2 flex items-center justify-center
        hover:scale-110 hover:z-10
        ${STATUS_BORDER_COLORS[node.status]}
        ${isSelected ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900' : ''}
        ${node.isGhost ? 'opacity-50' : ''}
      `}
      style={{
        width: size,
        height: size,
        backgroundColor: node.isGhost
          ? 'transparent'
          : `${DOMAIN_COLORS[node.domain]}30`,
      }}
      title={`${node.label}\n${STATUS_LABELS[node.status]} · ${Math.round(node.confidence * 100)}% confidence`}
    >
      {/* Status indicator dot */}
      <div
        className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[node.status]}`}
      />

      {/* Hover tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 shadow-lg">
        <div className="font-medium">{node.label}</div>
        <div className="text-slate-400">
          {STATUS_LABELS[node.status]} · {Math.round(node.confidence * 100)}%
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// Cluster Grid Component
// ============================================================================

interface ClusterGridProps {
  nodes: CoverageNode[];
  domains: CoverageDomainSummary[];
  selectedDomain: DomainName | null;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

function ClusterGrid({ nodes, domains, selectedDomain, selectedNodeId, onSelectNode }: ClusterGridProps) {
  // Group nodes by domain
  const nodesByDomain = useMemo(() => {
    const map = new Map<DomainName, CoverageNode[]>();
    for (const node of nodes) {
      if (!map.has(node.domain)) {
        map.set(node.domain, []);
      }
      map.get(node.domain)!.push(node);
    }
    return map;
  }, [nodes]);

  // Filter domains if one is selected
  const displayDomains = useMemo(() => {
    if (selectedDomain) {
      return domains.filter(d => d.domain === selectedDomain);
    }
    // Sort by most issues first, then by completeness (lowest first)
    return [...domains].sort((a, b) => {
      if (b.criticalIssues !== a.criticalIssues) {
        return b.criticalIssues - a.criticalIssues;
      }
      return a.completeness - b.completeness;
    });
  }, [domains, selectedDomain]);

  if (nodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">
            We don't know much about this company yet
          </h3>
          <p className="text-sm text-slate-400 mb-4">
            Run diagnostics or Autocomplete to initialize context.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      {/* Responsive grid: 1 col mobile, 2 col tablet, 3 col desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayDomains.map((domain) => {
          const domainNodes = nodesByDomain.get(domain.domain) || [];
          if (domainNodes.length === 0) return null;

          const completionPct = Math.round(domain.completeness * 100);
          const description = DOMAIN_DESCRIPTIONS[domain.domain] || '';

          return (
            <div
              key={domain.domain}
              className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden hover:border-slate-700 transition-colors"
            >
              {/* Domain header with color accent */}
              <div
                className="h-1"
                style={{ backgroundColor: DOMAIN_COLORS[domain.domain] || '#666' }}
              />

              <div className="p-4">
                {/* Domain title and completeness */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: DOMAIN_COLORS[domain.domain] }}
                    />
                    <h4 className="text-sm font-medium text-white">{domain.label}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    {domain.criticalIssues > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-red-500/20 text-red-400">
                        {domain.criticalIssues} issue{domain.criticalIssues > 1 ? 's' : ''}
                      </span>
                    )}
                    <span className={`text-sm font-semibold tabular-nums ${
                      completionPct >= 75 ? 'text-emerald-400' :
                      completionPct >= 50 ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {completionPct}%
                    </span>
                  </div>
                </div>

                {/* Domain description */}
                {description && (
                  <p className="text-xs text-slate-500 mb-3 line-clamp-2">
                    {description}
                  </p>
                )}

                {/* Progress bar */}
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full transition-all ${
                      completionPct >= 75 ? 'bg-emerald-500' :
                      completionPct >= 50 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${completionPct}%` }}
                  />
                </div>

                {/* Node bubbles */}
                <div className="flex flex-wrap gap-1.5">
                  {domainNodes.slice(0, 12).map((node) => (
                    <NodeBubble
                      key={node.id}
                      node={node}
                      isSelected={selectedNodeId === node.id}
                      onClick={() => onSelectNode(node.id)}
                    />
                  ))}
                  {domainNodes.length > 12 && (
                    <span className="text-xs text-slate-500 self-center ml-1">
                      +{domainNodes.length - 12} more
                    </span>
                  )}
                </div>

                {/* Stats row */}
                <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
                  <span>{domain.populatedFields}/{domain.totalFields} fields</span>
                  <span className={`${
                    domain.fresh >= 0.75 ? 'text-emerald-400' :
                    domain.fresh >= 0.50 ? 'text-amber-400' : 'text-slate-500'
                  }`}>
                    {Math.round(domain.fresh * 100)}% fresh
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Legend Component
// ============================================================================

function CoverageLegend() {
  const statuses: Array<{ status: CoverageNode['status']; label: string }> = [
    { status: 'healthy', label: 'Healthy' },
    { status: 'stale', label: 'Stale' },
    { status: 'lowConfidence', label: 'Low Confidence' },
    { status: 'conflict', label: 'Conflict' },
    { status: 'missing', label: 'Missing' },
  ];

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-slate-900/50 border-t border-slate-800">
      <span className="text-xs text-slate-500">Legend:</span>
      {statuses.map(({ status, label }) => (
        <div key={status} className="flex items-center gap-1.5">
          <div className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[status]}`} />
          <span className="text-xs text-slate-400">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ContextCoverageView({
  companyId,
  coverageData,
  onSelectNode,
  selectedNodeId = null,
  selectedDomain = null,
  onDomainChange,
}: ContextCoverageViewProps) {
  // Local state for loading
  const [isLoading, setIsLoading] = useState(!coverageData);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CoverageGraph | null>(coverageData || null);

  // Fetch coverage data if not provided
  useEffect(() => {
    if (coverageData) {
      setData(coverageData);
      setIsLoading(false);
      return;
    }

    async function fetchData() {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/os/companies/${companyId}/context/graph`);
        if (!response.ok) {
          throw new Error('Failed to load coverage data');
        }
        const result = await response.json();
        // Transform API response to CoverageGraph format if needed
        if (result.success && result.snapshot) {
          // Use existing snapshot data
          setData({
            nodes: result.snapshot.nodes.map((n: Record<string, unknown>) => ({
              id: n.id as string,
              label: n.label as string,
              domain: n.domain as DomainName,
              status: (n.status as string) === 'ok' ? 'healthy' :
                      (n.status as string) === 'low_confidence' ? 'lowConfidence' :
                      (n.status as string) || 'missing',
              confidence: typeof n.confidence === 'number' ? n.confidence / 100 : 0.8,
              freshness: typeof n.freshness === 'number' ? n.freshness / 100 : 0.9,
              importance: typeof n.importance === 'number' ? n.importance : 3,
              value: n.value as string | null,
              isGhost: n.status === 'missing',
            })),
            domains: [],
            overallHealth: {
              overallScore: result.snapshot.summary?.averageConfidence || 0,
              completenessScore: 0,
              freshnessScore: result.snapshot.summary?.averageFreshness || 0,
              consistencyScore: 100,
              confidenceScore: result.snapshot.summary?.averageConfidence || 0,
              conflictCount: result.snapshot.summary?.byStatus?.conflicted || 0,
              staleFieldCount: result.snapshot.summary?.byStatus?.stale || 0,
              missingCriticalCount: result.snapshot.summary?.byStatus?.missing || 0,
              checkedAt: new Date().toISOString(),
            },
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [companyId, coverageData]);

  const handleSelectNode = useCallback((nodeId: string) => {
    onSelectNode?.(nodeId);
  }, [onSelectNode]);

  const handleDomainChange = useCallback((domain: DomainName | null) => {
    onDomainChange?.(domain);
  }, [onDomainChange]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-400">Loading coverage data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-red-400">
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-1 overflow-hidden">
        {/* Domain sidebar */}
        <DomainSidebar
          domains={data?.domains || []}
          selectedDomain={selectedDomain}
          onSelectDomain={handleDomainChange}
        />

        {/* Main cluster grid */}
        <ClusterGrid
          nodes={data?.nodes || []}
          domains={data?.domains || []}
          selectedDomain={selectedDomain}
          selectedNodeId={selectedNodeId}
          onSelectNode={handleSelectNode}
        />
      </div>

      {/* Legend */}
      <CoverageLegend />
    </div>
  );
}
