'use client';

// components/os/CompanyAiMemoryTab.tsx
// Client Brain / AI Memory tab component for Company Detail page
//
// Displays a chronological feed of AI-generated insights and context
// stored for this company, enabling transparency into the AI memory layer.

import { useState, useEffect, useCallback } from 'react';
import type { CompanyAiContextEntry } from '@/lib/airtable/companyAiContext';

interface CompanyAiMemoryTabProps {
  companyId: string;
  companyName: string;
}

// Type badge styling
const TYPE_STYLES: Record<string, string> = {
  'GAP IA': 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  'GAP Full': 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  'Work Item': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  'Analytics Insight': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  'Manual Note': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  Strategy: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  Other: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
};

// Source badge styling
const SOURCE_STYLES: Record<string, string> = {
  AI: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  User: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  System: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
};

// Format date for display
function formatDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Unknown date';
  }
}

export function CompanyAiMemoryTab({
  companyId,
  companyName,
}: CompanyAiMemoryTabProps) {
  const [entries, setEntries] = useState<CompanyAiContextEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  // Fetch entries on mount
  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/ai-memory?limit=50`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch AI memory');
      }

      const data = await response.json();

      if (!data.ok) {
        throw new Error(data.error || 'Unknown error');
      }

      setEntries(data.entries || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load AI memory');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Toggle entry expansion
  const toggleExpanded = (entryId: string) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  // Check if content is long enough to need truncation
  const shouldTruncate = (content: string) => content.length > 300;

  // Get truncated content
  const getTruncatedContent = (content: string) => {
    if (content.length <= 300) return content;
    return content.slice(0, 300).trim() + '...';
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-100">
              Client Brain
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              AI-generated insights and context for {companyName}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-100">
              Client Brain
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              AI-generated insights and context for {companyName}
            </p>
          </div>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-red-400">{error}</p>
          <button
            onClick={fetchEntries}
            className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (entries.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-100">
              Client Brain
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              AI-generated insights and context for {companyName}
            </p>
          </div>
        </div>
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-12 text-center">
          <svg
            className="w-16 h-16 mx-auto text-slate-600 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-slate-300 mb-2">
            No AI Memory Yet
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            As you use AI features like Work Item guides, Analytics insights,
            and GAP assessments, the system will build up context about this
            company to provide smarter, more personalized recommendations over
            time.
          </p>
        </div>
      </div>
    );
  }

  // Entries list
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Client Brain</h2>
          <p className="text-sm text-slate-400 mt-1">
            {entries.length} AI-generated insight{entries.length !== 1 ? 's' : ''}{' '}
            for {companyName}
          </p>
        </div>
        <button
          onClick={fetchEntries}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </button>
      </div>

      {/* Entries Feed */}
      <div className="space-y-4">
        {entries.map((entry) => {
          const isExpanded = expandedEntries.has(entry.id);
          const needsTruncation = shouldTruncate(entry.content);
          const displayContent =
            isExpanded || !needsTruncation
              ? entry.content
              : getTruncatedContent(entry.content);

          return (
            <div
              key={entry.id}
              className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition-colors"
            >
              {/* Entry Header */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Type Badge */}
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                      TYPE_STYLES[entry.type] || TYPE_STYLES.Other
                    }`}
                  >
                    {entry.type}
                  </span>

                  {/* Source Badge */}
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                      SOURCE_STYLES[entry.source] || SOURCE_STYLES.System
                    }`}
                  >
                    {entry.source}
                  </span>

                  {/* Tags */}
                  {entry.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-700/50 text-slate-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Date */}
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  {formatDate(entry.createdAt)}
                </span>
              </div>

              {/* Content */}
              <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                {displayContent}
              </div>

              {/* Show More/Less Button */}
              {needsTruncation && (
                <button
                  onClick={() => toggleExpanded(entry.id)}
                  className="mt-2 text-xs text-amber-500 hover:text-amber-400 transition-colors"
                >
                  {isExpanded ? 'Show less' : 'Show more'}
                </button>
              )}

              {/* Related Entity Link */}
              {entry.relatedEntityId && (
                <div className="mt-3 pt-3 border-t border-slate-800">
                  <span className="text-xs text-slate-500">
                    Related: {entry.relatedEntityId}
                  </span>
                </div>
              )}

              {/* Created By */}
              {entry.createdBy && (
                <div className="mt-2">
                  <span className="text-xs text-slate-600">
                    Created by: {entry.createdBy}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
