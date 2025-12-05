'use client';

// app/c/[companyId]/brain/context/components/WhatAISeesView.tsx
// "What AI Sees" View for Context Graph
//
// Shows the AI-scoped view of company context as computed by Context Gateway
// Displays either as pretty JSON or grouped list format

import { useState, useEffect, useMemo } from 'react';
import type { ContextGatewayResult, ContextGatewaySection, ContextGatewayField } from '@/lib/contextGraph/contextGateway';

// ============================================================================
// Types
// ============================================================================

interface WhatAISeesViewProps {
  companyId: string;
  contextData?: ContextGatewayResult | null;
  isLoading?: boolean;
}

type ViewMode = 'grouped' | 'json' | 'prompt';

// ============================================================================
// Helper Functions
// ============================================================================

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'fresh':
      return 'text-emerald-400';
    case 'stale':
      return 'text-amber-400';
    case 'missing':
      return 'text-red-400';
    default:
      return 'text-slate-400';
  }
}

function formatValueForDisplay(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    return value.map(v => {
      if (typeof v === 'object' && v !== null) {
        if ('name' in v) return (v as { name: string }).name;
        if ('label' in v) return (v as { label: string }).label;
        return JSON.stringify(v);
      }
      return String(v);
    }).join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

function generatePromptText(data: ContextGatewayResult): string {
  const lines: string[] = [];

  if (data.companyName) {
    lines.push(`# Company: ${data.companyName}`);
    lines.push('');
  }

  for (const section of data.sections) {
    const populatedFields = section.fields.filter(f => f.status !== 'missing');
    if (populatedFields.length === 0) continue;

    lines.push(`[${section.label.toUpperCase()}]`);

    for (const field of populatedFields) {
      const value = formatValueForDisplay(field.value);
      if (value && value !== '—') {
        lines.push(`- ${field.label}: ${value}`);
      }
    }

    lines.push('');
  }

  return lines.join('\n').trim();
}

// ============================================================================
// Main Component
// ============================================================================

export function WhatAISeesView({
  companyId,
  contextData,
  isLoading: externalLoading,
}: WhatAISeesViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grouped');
  const [internalData, setInternalData] = useState<ContextGatewayResult | null>(null);
  const [internalLoading, setInternalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // If no external data provided, fetch it
  useEffect(() => {
    if (contextData !== undefined) {
      setInternalData(contextData);
      return;
    }

    async function fetchContext() {
      setInternalLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/os/companies/${companyId}/context-gateway?scope=full`);
        if (!response.ok) {
          throw new Error('Failed to fetch context');
        }
        const data = await response.json();
        setInternalData(data);
        // Auto-expand first 3 sections
        if (data.sections) {
          setExpandedSections(new Set(data.sections.slice(0, 3).map((s: ContextGatewaySection) => s.id)));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setInternalLoading(false);
      }
    }

    fetchContext();
  }, [companyId, contextData]);

  const data = contextData ?? internalData;
  const isLoading = externalLoading ?? internalLoading;

  const promptText = useMemo(() => {
    if (!data) return '';
    return generatePromptText(data);
  }, [data]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-8 h-8 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin mb-4" />
        <p className="text-sm text-slate-400">Loading AI context view...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-center">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-dashed border-slate-700 p-6 text-center">
        <p className="text-sm text-slate-500">No context data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span>{data.populatedFields}/{data.totalFields} fields</span>
          <span>{Math.round(data.averageConfidence * 100)}% avg confidence</span>
          <span>{Math.round(data.averageFreshness * 100)}% avg freshness</span>
        </div>
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5">
          {[
            { id: 'grouped', label: 'Grouped' },
            { id: 'prompt', label: 'Prompt' },
            { id: 'json', label: 'JSON' },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => setViewMode(mode.id as ViewMode)}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                viewMode === mode.id
                  ? 'bg-slate-700 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {viewMode === 'grouped' && (
        <div className="space-y-3">
          {data.sections.map((section) => {
            const isExpanded = expandedSections.has(section.id);
            const populatedFields = section.fields.filter(f => f.status !== 'missing');

            return (
              <div
                key={section.id}
                className="rounded-lg border border-slate-800 bg-slate-950/50 overflow-hidden"
              >
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between p-3 hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <svg
                      className={cn(
                        'w-4 h-4 text-slate-500 transition-transform',
                        isExpanded && 'rotate-90'
                      )}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="text-sm font-medium text-slate-200">{section.label}</span>
                    <span className="text-xs text-slate-500">
                      {populatedFields.length}/{section.fieldCount} fields
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">
                      {Math.round(section.averageConfidence * 100)}% conf
                    </span>
                    <span className="text-slate-500">
                      {Math.round(section.averageFreshness * 100)}% fresh
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-800 divide-y divide-slate-800">
                    {section.fields.map((field) => (
                      <div
                        key={field.path}
                        className={cn(
                          'px-4 py-2',
                          field.status === 'missing' && 'opacity-50'
                        )}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-300">{field.label}</span>
                              <span className={cn(
                                'text-[10px] px-1.5 py-0.5 rounded',
                                field.status === 'fresh' && 'bg-emerald-500/20 text-emerald-400',
                                field.status === 'stale' && 'bg-amber-500/20 text-amber-400',
                                field.status === 'missing' && 'bg-red-500/20 text-red-400'
                              )}>
                                {field.status}
                              </span>
                              {field.isHumanOverride && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                                  Human
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 mt-1 break-words">
                              {formatValueForDisplay(field.value)}
                            </div>
                          </div>
                          <div className="text-right text-[10px] text-slate-500 flex-shrink-0">
                            <div>{Math.round(field.confidence * 100)}%</div>
                            {field.source && <div className="capitalize">{field.source.replace(/_/g, ' ')}</div>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'prompt' && (
        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-500 uppercase tracking-wide">
              AI Prompt Format
            </span>
            <button
              onClick={() => navigator.clipboard.writeText(promptText)}
              className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              Copy to clipboard
            </button>
          </div>
          <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono overflow-x-auto">
            {promptText}
          </pre>
        </div>
      )}

      {viewMode === 'json' && (
        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-500 uppercase tracking-wide">
              Raw JSON
            </span>
            <button
              onClick={() => navigator.clipboard.writeText(JSON.stringify(data, null, 2))}
              className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              Copy to clipboard
            </button>
          </div>
          <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono overflow-x-auto max-h-[500px]">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}

      {/* Footer note */}
      <p className="text-xs text-slate-500 text-center">
        This view shows what AI features (Media Lab, Creative Lab, Strategic Plan, etc.) see when accessing company context.
        Fields with low confidence or freshness may be filtered out in some use cases.
      </p>
    </div>
  );
}

export default WhatAISeesView;
