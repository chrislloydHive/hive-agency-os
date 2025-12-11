'use client';

// app/c/[companyId]/brain/context/components/ContextFormView.tsx
// Form View - Structured Field Editor
//
// The form-based editor for context fields:
// - Fields grouped by domain
// - Inline editing with validation
// - Completeness indicators
// - Field cards with provenance

import { useState, useMemo, useCallback } from 'react';
import type { GraphFieldUi, ContextDomainId } from '@/lib/contextGraph/uiHelpers';
import { CONTEXT_DOMAIN_META } from '@/lib/contextGraph/uiHelpers';
import { DOMAIN_NAMES, type DomainName } from '@/lib/contextGraph/companyContextGraph';
import { FieldCard } from './FieldCard';
import { DomainSummaryPanel } from './DomainSummaryPanel';
import { AutoCompleteBanner } from './AutoCompleteBanner';

// ============================================================================
// Types
// ============================================================================

interface ContextFormViewProps {
  companyId: string;
  companyName: string;
  fields: GraphFieldUi[];
  /** Filter to specific domain (null = all domains) */
  selectedDomain: DomainName | null;
  /** Callback when domain filter changes */
  onDomainChange?: (domain: DomainName | null) => void;
  /** Callback when a field is selected */
  onSelectField?: (fieldPath: string) => void;
  /** Currently selected field path */
  selectedFieldPath?: string | null;
  /** Coverage percentage for auto-complete banner */
  coveragePercent?: number;
  /** Callback when a field value is saved */
  onFieldSave?: (fieldPath: string, value: unknown) => Promise<void>;
  /** Issues/warnings for fields */
  fieldIssues?: Map<string, Array<{ type: 'warning' | 'error'; message: string }>>;
}

// ============================================================================
// Domain Sidebar Component
// ============================================================================

interface DomainNavProps {
  fields: GraphFieldUi[];
  selectedDomain: DomainName | null;
  onSelectDomain: (domain: DomainName | null) => void;
}

function DomainNav({ fields, selectedDomain, onSelectDomain }: DomainNavProps) {
  // Count fields by domain
  const domainCounts = useMemo(() => {
    const counts = new Map<DomainName, { total: number; filled: number }>();
    for (const field of fields) {
      const domain = field.domain as DomainName;
      if (!counts.has(domain)) {
        counts.set(domain, { total: 0, filled: 0 });
      }
      const count = counts.get(domain)!;
      count.total++;
      if (field.value != null && field.value !== '') {
        count.filled++;
      }
    }
    return counts;
  }, [fields]);

  // Only show domains that have fields
  const activeDomains = DOMAIN_NAMES.filter(d => domainCounts.has(d));

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
          {activeDomains.map((domain) => {
            const meta = CONTEXT_DOMAIN_META[domain as ContextDomainId];
            const counts = domainCounts.get(domain);
            const isSelected = selectedDomain === domain;
            const completionPct = counts && counts.total > 0
              ? Math.round((counts.filled / counts.total) * 100)
              : 0;

            return (
              <button
                key={domain}
                onClick={() => onSelectDomain(domain)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                  isSelected
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <span className="truncate">{meta?.label || domain}</span>
                <span className={`text-xs tabular-nums ${
                  completionPct >= 75 ? 'text-emerald-400' :
                  completionPct >= 50 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {counts?.filled || 0}/{counts?.total || 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

// ============================================================================
// Field Section Component
// ============================================================================

interface FieldSectionProps {
  domain: DomainName;
  fields: GraphFieldUi[];
  selectedFieldPath: string | null;
  onSelectField: (path: string) => void;
  onFieldSave?: (path: string, value: unknown) => Promise<void>;
  companyId: string;
}

function FieldSection({
  domain,
  fields,
  selectedFieldPath,
  onSelectField,
  onFieldSave,
  companyId,
}: FieldSectionProps) {
  const meta = CONTEXT_DOMAIN_META[domain as ContextDomainId];
  const filledCount = fields.filter(f => f.value != null && f.value !== '').length;
  const completionPct = fields.length > 0 ? Math.round((filledCount / fields.length) * 100) : 0;

  return (
    <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
      {/* Section header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-white">{meta?.label || domain}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {filledCount} of {fields.length} fields completed
          </p>
        </div>
        <div className={`text-sm font-medium tabular-nums ${
          completionPct >= 75 ? 'text-emerald-400' :
          completionPct >= 50 ? 'text-amber-400' : 'text-red-400'
        }`}>
          {completionPct}%
        </div>
      </div>

      {/* Field cards */}
      <div className="p-4 space-y-3">
        {fields.map((field) => (
          <FieldCard
            key={field.path}
            field={field}
            isSelected={selectedFieldPath === field.path}
            onSelect={() => onSelectField(field.path)}
            companyId={companyId}
            onOpenProvenance={() => onSelectField(field.path)}
            onExplainField={() => onSelectField(field.path)}
            onSave={onFieldSave ? async (path, value) => {
              await onFieldSave(path, value);
              return { success: true };
            } : undefined}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Empty State Component
// ============================================================================

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-md mx-auto py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
          <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-white mb-2">
          Start by filling in core fields
        </h3>
        <p className="text-sm text-slate-400">
          Begin with identity, brand, and audience fields to establish the foundation.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ContextFormView({
  companyId,
  companyName,
  fields,
  selectedDomain,
  onDomainChange,
  onSelectField,
  selectedFieldPath = null,
  coveragePercent,
  onFieldSave,
  fieldIssues,
}: ContextFormViewProps) {
  const [localSelectedField, setLocalSelectedField] = useState<string | null>(selectedFieldPath);

  // Group fields by domain
  const fieldsByDomain = useMemo(() => {
    const map = new Map<DomainName, GraphFieldUi[]>();
    for (const field of fields) {
      const domain = field.domain as DomainName;
      if (!map.has(domain)) {
        map.set(domain, []);
      }
      map.get(domain)!.push(field);
    }
    return map;
  }, [fields]);

  // Filter fields by selected domain
  const displayFields = useMemo(() => {
    if (selectedDomain) {
      return fieldsByDomain.get(selectedDomain) || [];
    }
    return fields;
  }, [fields, fieldsByDomain, selectedDomain]);

  // Get display domains (only show domains with fields)
  const displayDomains = useMemo(() => {
    if (selectedDomain) {
      return [selectedDomain];
    }
    return Array.from(fieldsByDomain.keys());
  }, [fieldsByDomain, selectedDomain]);

  const handleSelectField = useCallback((path: string) => {
    setLocalSelectedField(path);
    onSelectField?.(path);
  }, [onSelectField]);

  const handleDomainChange = useCallback((domain: DomainName | null) => {
    onDomainChange?.(domain);
  }, [onDomainChange]);

  if (fields.length === 0) {
    return (
      <div className="flex h-full">
        <DomainNav
          fields={fields}
          selectedDomain={selectedDomain}
          onSelectDomain={handleDomainChange}
        />
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Domain navigation */}
      <DomainNav
        fields={fields}
        selectedDomain={selectedDomain}
        onSelectDomain={handleDomainChange}
      />

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Auto-complete banner */}
        {coveragePercent !== undefined && coveragePercent < 50 && (
          <AutoCompleteBanner
            companyId={companyId}
            coveragePercent={coveragePercent}
            threshold={50}
          />
        )}

        {/* Domain summary when viewing specific domain */}
        {selectedDomain && (
          <DomainSummaryPanel
            domainId={selectedDomain as ContextDomainId}
            fields={fieldsByDomain.get(selectedDomain) || []}
            issues={[]}
            companyId={companyId}
          />
        )}

        {/* Field sections */}
        {displayDomains.map((domain) => {
          const domainFields = fieldsByDomain.get(domain) || [];
          if (domainFields.length === 0) return null;

          return (
            <FieldSection
              key={domain}
              domain={domain}
              fields={domainFields}
              selectedFieldPath={localSelectedField}
              onSelectField={handleSelectField}
              onFieldSave={onFieldSave}
              companyId={companyId}
            />
          );
        })}
      </div>
    </div>
  );
}
