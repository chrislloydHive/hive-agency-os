'use client';

// components/os/WorkDetailPanel.tsx
// Slide-in detail panel for work items with source attribution and AI guide

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import type { WorkItem } from '@/lib/types/work';
import {
  WORK_PRIORITY_CONFIG,
  WORK_CATEGORY_CONFIG,
  WORK_EFFORT_CONFIG,
  areaToCategory,
  severityToPriority,
  getSourceLabel,
  isAnalyticsSource,
  isToolRunSource,
  type WorkPriority,
  type WorkCategory,
  type WorkSource,
} from '@/lib/types/work';

// ============================================================================
// Types
// ============================================================================

interface WorkDetailPanelProps {
  item: WorkItem;
  onClose: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-';
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

function getSourceIcon(source: WorkSource | undefined): string {
  if (!source) return '';
  switch (source.sourceType) {
    case 'analytics_metric':
      return '📊';
    case 'gap_insight':
      return '🎯';
    case 'diagnostics':
      return '🔍';
    case 'tool_run':
      return '🛠️';
    case 'priority':
      return '⚡';
    case 'plan_initiative':
      return '📋';
    default:
      return '✏️';
  }
}

/**
 * Get friendly tool label from slug
 */
function getToolLabel(toolSlug: string): string {
  const labels: Record<string, string> = {
    'gap-snapshot': 'GAP IA',
    'gapSnapshot': 'GAP IA',
    'gap-plan': 'GAP Plan',
    'gapPlan': 'GAP Plan',
    'gap-heavy': 'GAP Heavy',
    'gapHeavy': 'GAP Heavy',
    'website-lab': 'Website Lab',
    'websiteLab': 'Website Lab',
    'brand-lab': 'Brand Lab',
    'brandLab': 'Brand Lab',
    'content-lab': 'Content Lab',
    'contentLab': 'Content Lab',
    'seo-lab': 'SEO Lab',
    'seoLab': 'SEO Lab',
    'demand-lab': 'Demand Lab',
    'demandLab': 'Demand Lab',
    'ops-lab': 'Ops Lab',
    'opsLab': 'Ops Lab',
  };
  return labels[toolSlug] || toolSlug;
}

// ============================================================================
// Main Component
// ============================================================================

export function WorkDetailPanel({ item, onClose }: WorkDetailPanelProps) {
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [aiContent, setAiContent] = useState<string | null>(item.aiAdditionalInfo || null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Derive PM fields
  const priority = item.priority || severityToPriority(item.severity);
  const category = item.category || areaToCategory(item.area);
  const priorityConfig = WORK_PRIORITY_CONFIG[priority];
  const categoryConfig = WORK_CATEGORY_CONFIG[category];

  // Generate AI guide
  const handleGenerateAiGuide = async () => {
    setIsLoadingAi(true);
    setAiError(null);

    try {
      const response = await fetch('/api/work/additional-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workItemId: item.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate guide');
      }

      setAiContent(data.markdown);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoadingAi(false);
    }
  };

  return (
    <div className="w-[450px] flex-shrink-0 border-l border-slate-800 bg-slate-900/90 backdrop-blur-sm">
      <div className="sticky top-0 h-screen overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
            Work Item Details
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Title & Priority */}
          <div>
            <div className="flex items-start gap-2 mb-2">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                  priorityConfig.color === 'red'
                    ? 'bg-red-500/20 text-red-300'
                    : priorityConfig.color === 'orange'
                    ? 'bg-orange-500/20 text-orange-300'
                    : priorityConfig.color === 'yellow'
                    ? 'bg-amber-500/20 text-amber-200'
                    : 'bg-slate-500/20 text-slate-300'
                }`}
              >
                {priority}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-700/30 px-2 py-0.5 text-xs text-slate-400">
                <span>{categoryConfig.icon}</span>
                <span>{categoryConfig.label}</span>
              </span>
            </div>
            <h3 className="text-lg font-semibold text-slate-100">{item.title}</h3>
          </div>

          {/* Source Attribution */}
          {item.source && (
            <div className="rounded-lg border border-slate-700/50 bg-slate-800/50 p-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-lg">{getSourceIcon(item.source)}</span>
                <div className="flex-1">
                  <p className="text-slate-300 font-medium">
                    Source: {getSourceLabel(item.source)}
                  </p>
                  {isAnalyticsSource(item.source) && (
                    <p className="text-slate-500 mt-0.5">
                      Created from {item.source.metricGroup} metric insight
                    </p>
                  )}
                  {isToolRunSource(item.source) && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <p className="text-slate-500">
                        Generated from {getToolLabel(item.source.toolSlug)} report
                      </p>
                      <Link
                        href={`/c/${item.source.companyId}/diagnostics/${item.source.toolSlug}/${item.source.toolRunId}`}
                        className="inline-flex items-center gap-1 text-amber-500 hover:text-amber-400 font-medium"
                      >
                        View Report
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500 mb-1">Status</p>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  item.status === 'In Progress'
                    ? 'bg-blue-500/10 text-blue-400'
                    : item.status === 'Done'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-slate-500/10 text-slate-400'
                }`}
              >
                {item.status}
              </span>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-1">Due Date</p>
              <p className="text-sm text-slate-200">{formatDate(item.dueDate)}</p>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-1">Owner</p>
              <p className="text-sm text-slate-200">{item.ownerName || '-'}</p>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-1">Company</p>
              {item.companyId ? (
                <Link
                  href={`/c/${item.companyId}`}
                  className="text-sm text-amber-500 hover:text-amber-400"
                >
                  {item.companyName || 'View'}
                </Link>
              ) : (
                <p className="text-sm text-slate-400">-</p>
              )}
            </div>

            {item.effort && (
              <div>
                <p className="text-xs text-slate-500 mb-1">Effort</p>
                <span className="inline-flex items-center rounded-full bg-slate-700/40 px-2 py-0.5 text-xs text-slate-300">
                  {item.effort}
                </span>
              </div>
            )}

            {item.impact && (
              <div>
                <p className="text-xs text-slate-500 mb-1">Impact</p>
                <span className="inline-flex items-center rounded-full bg-slate-700/40 px-2 py-0.5 text-xs text-slate-300 capitalize">
                  {item.impact}
                </span>
              </div>
            )}
          </div>

          {/* Notes */}
          {item.notes && (
            <div>
              <p className="text-xs text-slate-500 mb-2">Notes</p>
              <p className="text-sm text-slate-300 whitespace-pre-wrap">{item.notes}</p>
            </div>
          )}

          {/* AI Implementation Guide */}
          <div className="border-t border-slate-800 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-300">
                Implementation Guide
              </h4>
              {!aiContent && (
                <button
                  onClick={handleGenerateAiGuide}
                  disabled={isLoadingAi}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoadingAi ? 'Generating...' : 'Generate with AI'}
                </button>
              )}
            </div>

            {aiError && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-400 mb-3">
                {aiError}
              </div>
            )}

            {isLoadingAi && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Generating implementation guide...</span>
              </div>
            )}

            {aiContent && (
              <div className="prose prose-sm prose-invert max-w-none">
                <div className="rounded-lg bg-slate-800/50 p-4 text-sm">
                  <ReactMarkdown
                    components={{
                      h1: ({ children }) => (
                        <h1 className="text-base font-bold text-slate-100 mb-2 mt-4 first:mt-0">
                          {children}
                        </h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="text-sm font-semibold text-slate-200 mb-2 mt-3">
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-sm font-medium text-slate-300 mb-1 mt-2">
                          {children}
                        </h3>
                      ),
                      p: ({ children }) => (
                        <p className="text-slate-400 mb-2 leading-relaxed">{children}</p>
                      ),
                      ul: ({ children }) => (
                        <ul className="list-disc list-inside text-slate-400 mb-2 space-y-1">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="list-decimal list-inside text-slate-400 mb-2 space-y-1">
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => (
                        <li className="text-slate-400">{children}</li>
                      ),
                      strong: ({ children }) => (
                        <strong className="text-slate-200 font-semibold">{children}</strong>
                      ),
                      code: ({ children }) => (
                        <code className="bg-slate-700 px-1 py-0.5 rounded text-amber-400 text-xs">
                          {children}
                        </code>
                      ),
                    }}
                  >
                    {aiContent}
                  </ReactMarkdown>
                </div>

                <button
                  onClick={handleGenerateAiGuide}
                  disabled={isLoadingAi}
                  className="mt-3 text-xs text-slate-500 hover:text-slate-400"
                >
                  Regenerate guide
                </button>
              </div>
            )}

            {!aiContent && !isLoadingAi && (
              <p className="text-xs text-slate-500">
                Click "Generate with AI" to create a step-by-step implementation guide for this work item.
              </p>
            )}
          </div>

          {/* Timestamps */}
          <div className="border-t border-slate-800 pt-4 text-xs text-slate-500">
            <p>Created: {formatDate(item.createdAt)}</p>
            {item.lastTouchedAt && (
              <p>Last updated: {formatDate(item.lastTouchedAt)}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkDetailPanel;
