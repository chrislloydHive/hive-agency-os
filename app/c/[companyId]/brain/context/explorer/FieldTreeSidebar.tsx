'use client';

// app/c/[companyId]/brain/context/explorer/FieldTreeSidebar.tsx
// Left sidebar with tree/grouped list of fields

import { memo, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Circle,
  Lightbulb,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import type { GraphFieldUi, ContextDomainId } from '@/lib/contextGraph/uiHelpers';
import { CONTEXT_DOMAIN_META } from '@/lib/contextGraph/uiHelpers';
import type { ExplorerInsight } from './ContextExplorerClient';

// ============================================================================
// Types
// ============================================================================

interface FieldTreeSidebarProps {
  fieldsByDomain: Record<string, GraphFieldUi[]>;
  allFieldsByDomain: Record<string, GraphFieldUi[]>;
  expandedDomains: Set<string>;
  selectedFieldPath: string | null;
  needsRefreshPaths: Set<string>;
  insights: ExplorerInsight[];
  onToggleDomain: (domain: string) => void;
  onSelectField: (path: string) => void;
}

// ============================================================================
// Domain Colors
// ============================================================================

const DOMAIN_COLORS: Record<string, string> = {
  identity: '#f59e0b',
  brand: '#8b5cf6',
  audience: '#ec4899',
  productOffer: '#10b981',
  competitive: '#ef4444',
  website: '#3b82f6',
  content: '#6366f1',
  seo: '#14b8a6',
  performanceMedia: '#f97316',
  creative: '#a855f7',
  objectives: '#06b6d4',
  ops: '#64748b',
  digitalInfra: '#475569',
  budgetOps: '#84cc16',
  historical: '#78716c',
  operationalConstraints: '#94a3b8',
  storeRisk: '#fbbf24',
  historyRefs: '#9ca3af',
};

// ============================================================================
// Helper Functions
// ============================================================================

function getFieldCompleteness(field: GraphFieldUi): 'full' | 'partial' | 'empty' {
  if (!field.value || field.value === '') return 'empty';
  return 'full';
}

function getCompletenessColor(completeness: 'full' | 'partial' | 'empty'): string {
  switch (completeness) {
    case 'full':
      return 'text-emerald-400';
    case 'partial':
      return 'text-amber-400';
    case 'empty':
      return 'text-slate-600';
  }
}

// ============================================================================
// Domain Section Component
// ============================================================================

interface DomainSectionProps {
  domain: string;
  fields: GraphFieldUi[];
  totalFieldCount: number;
  isExpanded: boolean;
  selectedFieldPath: string | null;
  needsRefreshPaths: Set<string>;
  insightCountByField: Map<string, number>;
  onToggle: () => void;
  onSelectField: (path: string) => void;
}

const DomainSection = memo(function DomainSection({
  domain,
  fields,
  totalFieldCount,
  isExpanded,
  selectedFieldPath,
  needsRefreshPaths,
  insightCountByField,
  onToggle,
  onSelectField,
}: DomainSectionProps) {
  const meta = CONTEXT_DOMAIN_META[domain as ContextDomainId];
  const domainColor = DOMAIN_COLORS[domain] || '#64748b';

  // Calculate domain stats
  const populatedCount = fields.filter(f => f.value !== null && f.value !== '').length;
  const staleCount = fields.filter(f => needsRefreshPaths.has(f.path)).length;
  const insightCount = fields.reduce((sum, f) => sum + (insightCountByField.get(f.path) || 0), 0);

  // Group fields by sub-path (e.g., brand.positioning → positioning)
  const fieldGroups = useMemo(() => {
    const groups: Record<string, GraphFieldUi[]> = {};
    for (const field of fields) {
      const parts = field.path.split('.');
      if (parts.length > 2) {
        // Nested field - group by second part
        const groupKey = parts[1];
        if (!groups[groupKey]) {
          groups[groupKey] = [];
        }
        groups[groupKey].push(field);
      } else {
        // Direct field
        const groupKey = '__direct__';
        if (!groups[groupKey]) {
          groups[groupKey] = [];
        }
        groups[groupKey].push(field);
      }
    }
    return groups;
  }, [fields]);

  return (
    <div className="border-b border-slate-800/50 last:border-b-0">
      {/* Domain Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-slate-800/30 transition-colors group"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-500" />
        )}

        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: domainColor }}
        />

        <span className="text-sm font-medium text-slate-200 flex-1 text-left truncate">
          {meta?.label || domain}
        </span>

        {/* Stats badges */}
        <div className="flex items-center gap-1.5">
          {insightCount > 0 && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400">
              <Lightbulb className="w-3 h-3" />
              {insightCount}
            </span>
          )}
          {staleCount > 0 && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-orange-500/20 text-orange-400">
              <RefreshCw className="w-3 h-3" />
              {staleCount}
            </span>
          )}
          <span className="text-[10px] text-slate-500">
            {populatedCount}/{totalFieldCount}
          </span>
        </div>
      </button>

      {/* Fields List */}
      {isExpanded && (
        <div className="pb-1">
          {/* Direct fields first */}
          {fieldGroups['__direct__']?.map(field => (
            <FieldRow
              key={field.path}
              field={field}
              isSelected={selectedFieldPath === field.path}
              needsRefresh={needsRefreshPaths.has(field.path)}
              insightCount={insightCountByField.get(field.path) || 0}
              onSelect={() => onSelectField(field.path)}
              indent={1}
            />
          ))}

          {/* Grouped fields */}
          {Object.entries(fieldGroups)
            .filter(([key]) => key !== '__direct__')
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([groupName, groupFields]) => (
              <div key={groupName}>
                <div className="px-4 py-1 pl-10">
                  <span className="text-[10px] text-slate-600 uppercase tracking-wider">
                    {formatGroupName(groupName)}
                  </span>
                </div>
                {groupFields.map(field => (
                  <FieldRow
                    key={field.path}
                    field={field}
                    isSelected={selectedFieldPath === field.path}
                    needsRefresh={needsRefreshPaths.has(field.path)}
                    insightCount={insightCountByField.get(field.path) || 0}
                    onSelect={() => onSelectField(field.path)}
                    indent={2}
                  />
                ))}
              </div>
            ))}
        </div>
      )}
    </div>
  );
});

// ============================================================================
// Field Row Component
// ============================================================================

interface FieldRowProps {
  field: GraphFieldUi;
  isSelected: boolean;
  needsRefresh: boolean;
  insightCount: number;
  onSelect: () => void;
  indent: number;
}

const FieldRow = memo(function FieldRow({
  field,
  isSelected,
  needsRefresh,
  insightCount,
  onSelect,
  indent,
}: FieldRowProps) {
  const completeness = getFieldCompleteness(field);
  const completenessColor = getCompletenessColor(completeness);

  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-2 px-4 py-1.5 text-left transition-colors ${
        isSelected
          ? 'bg-amber-500/15 border-l-2 border-amber-400'
          : 'hover:bg-slate-800/30 border-l-2 border-transparent'
      }`}
      style={{ paddingLeft: `${indent * 12 + 16}px` }}
    >
      <Circle className={`w-2 h-2 shrink-0 ${completenessColor}`} fill="currentColor" />

      <span className={`text-xs truncate flex-1 ${
        isSelected ? 'text-amber-200' : completeness === 'empty' ? 'text-slate-500' : 'text-slate-300'
      }`}>
        {field.label}
      </span>

      {/* Indicators */}
      <div className="flex items-center gap-1 shrink-0">
        {needsRefresh && (
          <RefreshCw className="w-3 h-3 text-orange-400" />
        )}
        {insightCount > 0 && (
          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-amber-500/20 text-[9px] text-amber-400 font-bold">
            {insightCount}
          </span>
        )}
      </div>
    </button>
  );
});

// ============================================================================
// Helper Functions
// ============================================================================

function formatGroupName(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/^\w/, c => c.toUpperCase())
    .trim();
}

// ============================================================================
// Main Component
// ============================================================================

export const FieldTreeSidebar = memo(function FieldTreeSidebar({
  fieldsByDomain,
  allFieldsByDomain,
  expandedDomains,
  selectedFieldPath,
  needsRefreshPaths,
  insights,
  onToggleDomain,
  onSelectField,
}: FieldTreeSidebarProps) {
  // Build insight count map by field path
  const insightCountByField = useMemo(() => {
    const map = new Map<string, number>();
    for (const insight of insights) {
      if (insight.contextPaths) {
        for (const path of insight.contextPaths) {
          map.set(path, (map.get(path) || 0) + 1);
        }
      }
    }
    return map;
  }, [insights]);

  // Get domain order (domains with fields first, sorted by populated count)
  const domainOrder = useMemo(() => {
    const domains = Object.keys(allFieldsByDomain);
    return domains.sort((a, b) => {
      const aFields = allFieldsByDomain[a] || [];
      const bFields = allFieldsByDomain[b] || [];
      const aPopulated = aFields.filter(f => f.value !== null && f.value !== '').length;
      const bPopulated = bFields.filter(f => f.value !== null && f.value !== '').length;
      // Sort by populated count descending, then by name
      if (bPopulated !== aPopulated) return bPopulated - aPopulated;
      return a.localeCompare(b);
    });
  }, [allFieldsByDomain]);

  return (
    <div className="w-80 shrink-0 border-r border-slate-800 bg-slate-900/50 overflow-y-auto">
      <div className="sticky top-0 z-10 px-4 py-2 bg-slate-900/90 backdrop-blur-sm border-b border-slate-800/50">
        <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          Field Tree
        </h2>
      </div>

      <div className="py-1">
        {domainOrder.map(domain => {
          const fields = fieldsByDomain[domain] || [];
          const allFields = allFieldsByDomain[domain] || [];

          // Skip domains with no fields in filtered view if we have active filters
          if (fields.length === 0 && Object.keys(fieldsByDomain).length < Object.keys(allFieldsByDomain).length) {
            return null;
          }

          return (
            <DomainSection
              key={domain}
              domain={domain}
              fields={fields.length > 0 ? fields : allFields}
              totalFieldCount={allFields.length}
              isExpanded={expandedDomains.has(domain)}
              selectedFieldPath={selectedFieldPath}
              needsRefreshPaths={needsRefreshPaths}
              insightCountByField={insightCountByField}
              onToggle={() => onToggleDomain(domain)}
              onSelectField={onSelectField}
            />
          );
        })}
      </div>
    </div>
  );
});
