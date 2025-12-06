'use client';

// app/c/[companyId]/brain/map/FilterPanel.tsx
// Strategic Map 2.0 Filter Panel
//
// Macro-level filters for:
// - Domain
// - Completeness (Full/Partial/Empty)
// - Source (Human/AI/Mixed)
// - Criticality (High/Medium/Low)
// - Confidence
// - Has Insights
// - Dependencies

import { useState } from 'react';
import {
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  User,
  Bot,
  Sparkles,
  AlertCircle,
  Lightbulb,
  Link2,
} from 'lucide-react';
import {
  useStrategicMap,
  type MapFilters,
} from './StrategicMapContext';
import {
  DOMAIN_COLORS,
  DOMAIN_LABELS,
  type StrategicMapNodeDomain,
  getActiveDomains,
} from '@/lib/contextGraph/strategicMap';

// ============================================================================
// Filter Section Component
// ============================================================================

interface FilterSectionProps {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  isOpen?: boolean;
  onToggle?: () => void;
}

function FilterSection({ title, icon: Icon, children, isOpen = true, onToggle }: FilterSectionProps) {
  return (
    <div className="border-b border-slate-800/50 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs font-medium text-slate-400">{title}</span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
        )}
      </button>
      {isOpen && (
        <div className="px-3.5 pb-3">
          {children}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Filter Chip Component
// ============================================================================

interface FilterChipProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  color?: string;
  icon?: React.ReactNode;
}

function FilterChip({ label, isActive, onClick, color, icon }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
        isActive
          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
          : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-300 border border-transparent'
      }`}
    >
      {color && (
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
      )}
      {icon}
      {label}
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function FilterPanel() {
  const {
    filters,
    setFilters,
    resetFilters,
    mapGraph,
    nodeInsights,
  } = useStrategicMap();

  const [expandedSections, setExpandedSections] = useState({
    domain: true,
    completeness: true,
    source: true,
    criticality: false,
    confidence: false,
    insights: false,
    dependencies: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const activeDomains = getActiveDomains(mapGraph.nodes);

  // Count nodes by different criteria for display
  const counts = {
    full: mapGraph.nodes.filter(n => n.completeness === 'full').length,
    partial: mapGraph.nodes.filter(n => n.completeness === 'partial').length,
    empty: mapGraph.nodes.filter(n => n.completeness === 'empty').length,
    human: mapGraph.nodes.filter(n => n.provenanceKind === 'human').length,
    ai: mapGraph.nodes.filter(n => n.provenanceKind === 'ai').length,
    mixed: mapGraph.nodes.filter(n => n.provenanceKind === 'mixed').length,
    highCrit: mapGraph.nodes.filter(n => n.criticality === 'high').length,
    medCrit: mapGraph.nodes.filter(n => n.criticality === 'medium').length,
    lowCrit: mapGraph.nodes.filter(n => n.criticality === 'low').length,
    hasInsights: mapGraph.nodes.filter(n => (nodeInsights[n.id]?.length || n.insightCount) > 0).length,
    highDeps: mapGraph.nodes.filter(n => n.dependencyCount >= 3).length,
  };

  const updateFilter = <K extends keyof MapFilters>(key: K, value: MapFilters[K]) => {
    setFilters({ ...filters, [key]: value });
  };

  // Check if any filters are active
  const hasActiveFilters = Object.values(filters).some(v => v !== 'all');

  return (
    <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-medium text-slate-300">Filters</span>
        </div>
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-slate-500 hover:text-slate-400 hover:bg-slate-800/50 rounded"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        )}
      </div>

      {/* Filter Sections */}
      <div>
        {/* Domain Filter */}
        <FilterSection
          title="Domain"
          icon={Filter}
          isOpen={expandedSections.domain}
          onToggle={() => toggleSection('domain')}
        >
          <div className="space-y-1">
            <FilterChip
              label="All"
              isActive={filters.domain === 'all'}
              onClick={() => updateFilter('domain', 'all')}
            />
            {(Object.entries(DOMAIN_LABELS) as [StrategicMapNodeDomain, string][]).map(([domain, label]) => {
              const isActive = activeDomains.includes(domain);
              const count = mapGraph.nodes.filter(n => n.domain === domain).length;
              return (
                <FilterChip
                  key={domain}
                  label={`${label} (${count})`}
                  isActive={filters.domain === domain}
                  onClick={() => isActive && updateFilter('domain', domain)}
                  color={DOMAIN_COLORS[domain]}
                />
              );
            })}
          </div>
        </FilterSection>

        {/* Completeness Filter */}
        <FilterSection
          title="Completeness"
          icon={AlertCircle}
          isOpen={expandedSections.completeness}
          onToggle={() => toggleSection('completeness')}
        >
          <div className="flex flex-wrap gap-1">
            <FilterChip
              label="All"
              isActive={filters.completeness === 'all'}
              onClick={() => updateFilter('completeness', 'all')}
            />
            <FilterChip
              label={`Full (${counts.full})`}
              isActive={filters.completeness === 'full'}
              onClick={() => updateFilter('completeness', 'full')}
              icon={<span className="w-2 h-2 rounded-full bg-emerald-400" />}
            />
            <FilterChip
              label={`Partial (${counts.partial})`}
              isActive={filters.completeness === 'partial'}
              onClick={() => updateFilter('completeness', 'partial')}
              icon={<span className="w-2 h-2 rounded-full bg-amber-400" />}
            />
            <FilterChip
              label={`Empty (${counts.empty})`}
              isActive={filters.completeness === 'empty'}
              onClick={() => updateFilter('completeness', 'empty')}
              icon={<span className="w-2 h-2 rounded-full bg-red-400" />}
            />
          </div>
        </FilterSection>

        {/* Source Filter */}
        <FilterSection
          title="Source"
          icon={User}
          isOpen={expandedSections.source}
          onToggle={() => toggleSection('source')}
        >
          <div className="flex flex-wrap gap-1">
            <FilterChip
              label="All"
              isActive={filters.source === 'all'}
              onClick={() => updateFilter('source', 'all')}
            />
            <FilterChip
              label={`Human (${counts.human})`}
              isActive={filters.source === 'human'}
              onClick={() => updateFilter('source', 'human')}
              icon={<User className="w-3 h-3 text-emerald-400" />}
            />
            <FilterChip
              label={`AI (${counts.ai})`}
              isActive={filters.source === 'ai'}
              onClick={() => updateFilter('source', 'ai')}
              icon={<Sparkles className="w-3 h-3 text-violet-400" />}
            />
            <FilterChip
              label={`Mixed (${counts.mixed})`}
              isActive={filters.source === 'mixed'}
              onClick={() => updateFilter('source', 'mixed')}
              icon={<Bot className="w-3 h-3 text-amber-400" />}
            />
          </div>
        </FilterSection>

        {/* Criticality Filter */}
        <FilterSection
          title="Criticality"
          icon={AlertCircle}
          isOpen={expandedSections.criticality}
          onToggle={() => toggleSection('criticality')}
        >
          <div className="flex flex-wrap gap-1">
            <FilterChip
              label="All"
              isActive={filters.criticality === 'all'}
              onClick={() => updateFilter('criticality', 'all')}
            />
            <FilterChip
              label={`High (${counts.highCrit})`}
              isActive={filters.criticality === 'high'}
              onClick={() => updateFilter('criticality', 'high')}
            />
            <FilterChip
              label={`Medium (${counts.medCrit})`}
              isActive={filters.criticality === 'medium'}
              onClick={() => updateFilter('criticality', 'medium')}
            />
            <FilterChip
              label={`Low (${counts.lowCrit})`}
              isActive={filters.criticality === 'low'}
              onClick={() => updateFilter('criticality', 'low')}
            />
          </div>
        </FilterSection>

        {/* Confidence Filter */}
        <FilterSection
          title="Confidence"
          icon={AlertCircle}
          isOpen={expandedSections.confidence}
          onToggle={() => toggleSection('confidence')}
        >
          <div className="flex flex-wrap gap-1">
            <FilterChip
              label="All"
              isActive={filters.confidence === 'all'}
              onClick={() => updateFilter('confidence', 'all')}
            />
            <FilterChip
              label="High (>80%)"
              isActive={filters.confidence === 'high'}
              onClick={() => updateFilter('confidence', 'high')}
            />
            <FilterChip
              label="Medium (50-80%)"
              isActive={filters.confidence === 'medium'}
              onClick={() => updateFilter('confidence', 'medium')}
            />
            <FilterChip
              label="Low (<50%)"
              isActive={filters.confidence === 'low'}
              onClick={() => updateFilter('confidence', 'low')}
            />
          </div>
        </FilterSection>

        {/* Insights Filter */}
        <FilterSection
          title="Insights"
          icon={Lightbulb}
          isOpen={expandedSections.insights}
          onToggle={() => toggleSection('insights')}
        >
          <div className="flex flex-wrap gap-1">
            <FilterChip
              label="All"
              isActive={filters.hasInsights === 'all'}
              onClick={() => updateFilter('hasInsights', 'all')}
            />
            <FilterChip
              label={`Has Insights (${counts.hasInsights})`}
              isActive={filters.hasInsights === 'yes'}
              onClick={() => updateFilter('hasInsights', 'yes')}
            />
            <FilterChip
              label="No Insights"
              isActive={filters.hasInsights === 'no'}
              onClick={() => updateFilter('hasInsights', 'no')}
            />
          </div>
        </FilterSection>

        {/* Dependencies Filter */}
        <FilterSection
          title="Dependencies"
          icon={Link2}
          isOpen={expandedSections.dependencies}
          onToggle={() => toggleSection('dependencies')}
        >
          <div className="flex flex-wrap gap-1">
            <FilterChip
              label="All"
              isActive={filters.dependencies === 'all'}
              onClick={() => updateFilter('dependencies', 'all')}
            />
            <FilterChip
              label={`High (3+) (${counts.highDeps})`}
              isActive={filters.dependencies === 'high'}
              onClick={() => updateFilter('dependencies', 'high')}
            />
            <FilterChip
              label="Low (<3)"
              isActive={filters.dependencies === 'low'}
              onClick={() => updateFilter('dependencies', 'low')}
            />
          </div>
        </FilterSection>
      </div>
    </div>
  );
}
