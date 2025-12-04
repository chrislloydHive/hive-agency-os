'use client';

// app/c/[companyId]/context-graph/components/FieldTable.tsx
// Field table showing all fields in a domain with status and actions

import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import type { NeedsRefreshReport } from '@/lib/contextGraph/needsRefresh';
import type { ProvenanceTag } from '@/lib/contextGraph/types';

interface FlattenedField {
  path: string;
  fieldName: string;
  value: unknown;
  provenance: ProvenanceTag[];
  valueType: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null';
}

interface FieldTableProps {
  domainId: string;
  graph: CompanyContextGraph;
  refreshReport: NeedsRefreshReport | null;
  onEdit: (path: string, value: unknown, provenance: unknown[]) => void;
  onClear: (path: string) => void;
  onViewHistory: (path: string, provenance: unknown[]) => void;
  isLoading: boolean;
}

/**
 * Flatten a domain object into a list of leaf fields
 */
function flattenDomain(domainId: string, domain: unknown): FlattenedField[] {
  const fields: FlattenedField[] = [];

  function walk(obj: unknown, path: string[], depth: number = 0) {
    if (depth > 10) return; // Prevent infinite recursion

    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      const record = obj as Record<string, unknown>;

      // Check if this is a WithMeta object (has value and provenance)
      if ('value' in record && 'provenance' in record) {
        const value = record.value;
        const provenance = (record.provenance as ProvenanceTag[]) || [];

        let valueType: FlattenedField['valueType'] = 'null';
        if (value === null || value === undefined) {
          valueType = 'null';
        } else if (Array.isArray(value)) {
          valueType = 'array';
        } else if (typeof value === 'string') {
          valueType = 'string';
        } else if (typeof value === 'number') {
          valueType = 'number';
        } else if (typeof value === 'boolean') {
          valueType = 'boolean';
        } else if (typeof value === 'object') {
          valueType = 'object';
        }

        fields.push({
          path: path.join('.'),
          fieldName: path[path.length - 1] || '',
          value,
          provenance,
          valueType,
        });
      } else {
        // Recurse into nested objects
        for (const [key, val] of Object.entries(record)) {
          walk(val, [...path, key], depth + 1);
        }
      }
    }
  }

  walk(domain, [domainId]);
  return fields;
}

/**
 * Format a value for display
 */
function formatValue(value: unknown, valueType: string): string {
  if (value === null || value === undefined) {
    return '—';
  }

  if (valueType === 'array') {
    const arr = value as unknown[];
    if (arr.length === 0) return '[]';
    if (arr.length <= 3) {
      return arr.map(v => typeof v === 'string' ? `"${v}"` : String(v)).join(', ');
    }
    return `[${arr.length} items]`;
  }

  if (valueType === 'object') {
    return JSON.stringify(value).slice(0, 50) + '...';
  }

  if (valueType === 'string') {
    const str = value as string;
    if (str.length > 80) {
      return str.slice(0, 80) + '...';
    }
    return str;
  }

  return String(value);
}

/**
 * Get status based on freshness and value
 */
function getFieldStatus(
  field: FlattenedField,
  refreshReport: NeedsRefreshReport | null
): { status: 'ok' | 'stale' | 'missing'; label: string } {
  // Check if value is missing
  if (field.value === null || field.value === undefined ||
      (Array.isArray(field.value) && field.value.length === 0)) {
    return { status: 'missing', label: 'Missing' };
  }

  // Check refresh report for staleness
  if (refreshReport) {
    const isStale = refreshReport.topPriorityFields.some(f =>
      `${f.domain}.${f.field}` === field.path
    );
    if (isStale) {
      return { status: 'stale', label: 'Stale' };
    }
  }

  return { status: 'ok', label: 'OK' };
}

/**
 * Format relative time
 */
function formatRelativeTime(dateStr: string | undefined): string {
  if (!dateStr) return 'Never';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  } catch {
    return 'Unknown';
  }
}

/**
 * Format source name
 */
function formatSource(source: string | undefined): string {
  if (!source) return 'Unknown';
  return source
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export function FieldTable({
  domainId,
  graph,
  refreshReport,
  onEdit,
  onClear,
  onViewHistory,
  isLoading,
}: FieldTableProps) {
  const domain = graph[domainId as keyof CompanyContextGraph];
  const fields = flattenDomain(domainId, domain);

  if (fields.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
        <p className="text-slate-500">No fields in this domain</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-800">
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Field
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Value
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide w-24">
              Status
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Source
            </th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide w-32">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {fields.map((field) => {
            const { status, label } = getFieldStatus(field, refreshReport);
            const latestProvenance = field.provenance[0];
            const isEditable = field.valueType !== 'object';

            return (
              <tr key={field.path} className="hover:bg-slate-800/50 transition-colors">
                {/* Field Name */}
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-200">
                      {field.fieldName}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {field.path}
                    </span>
                  </div>
                </td>

                {/* Value */}
                <td className="px-4 py-3">
                  <span className={`text-sm ${
                    field.value === null || field.value === undefined
                      ? 'text-slate-500 italic'
                      : 'text-slate-300'
                  }`}>
                    {formatValue(field.value, field.valueType)}
                  </span>
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                    status === 'ok'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : status === 'stale'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {label}
                  </span>
                </td>

                {/* Source */}
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="text-sm text-slate-300">
                      {formatSource(latestProvenance?.source)}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatRelativeTime(latestProvenance?.updatedAt)}
                    </span>
                  </div>
                </td>

                {/* Actions */}
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {isEditable && (
                      <button
                        onClick={() => onEdit(field.path, field.value, field.provenance)}
                        disabled={isLoading}
                        className="px-2 py-1 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 rounded transition-colors disabled:opacity-50"
                      >
                        Edit
                      </button>
                    )}
                    {field.value !== null && field.value !== undefined && (
                      <button
                        onClick={() => onClear(field.path)}
                        disabled={isLoading}
                        className="px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50"
                      >
                        Clear
                      </button>
                    )}
                    {field.provenance.length > 0 && (
                      <button
                        onClick={() => onViewHistory(field.path, field.provenance)}
                        className="px-2 py-1 text-xs text-slate-400 hover:text-slate-300 hover:bg-slate-700 rounded transition-colors"
                      >
                        History
                      </button>
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
