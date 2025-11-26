'use client';

// ClientBrainPageClient.tsx
// Client Brain UI - Strategic insights storage and work generation

import { useState, useCallback } from 'react';
import type { ClientInsight, InsightCategory, InsightSeverity } from '@/lib/types/clientBrain';
import {
  getInsightSourceLabel,
  getInsightSeverityColor,
  getInsightCategoryColor,
} from '@/lib/types/clientBrain';
import type { DiagnosticRun } from '@/lib/os/diagnostics/runs';

// ============================================================================
// Types
// ============================================================================

interface ClientBrainPageClientProps {
  companyId: string;
  companyName: string;
  initialInsights: ClientInsight[];
  diagnosticRuns: DiagnosticRun[];
}

// ============================================================================
// Component
// ============================================================================

export function ClientBrainPageClient({
  companyId,
  companyName,
  initialInsights,
  diagnosticRuns,
}: ClientBrainPageClientProps) {
  const [insights, setInsights] = useState<ClientInsight[]>(initialInsights);
  const [selectedCategory, setSelectedCategory] = useState<InsightCategory | 'all'>('all');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractingRunId, setExtractingRunId] = useState<string | null>(null);
  const [generatingWorkFor, setGeneratingWorkFor] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Toast helper
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  // Filter insights by category
  const filteredInsights = selectedCategory === 'all'
    ? insights
    : insights.filter((i) => i.category === selectedCategory);

  // Group insights by category for display
  const categories: InsightCategory[] = [
    'brand', 'content', 'seo', 'website', 'analytics',
    'demand', 'ops', 'competitive', 'structural', 'product', 'other'
  ];

  // Count by category
  const categoryCounts = categories.reduce((acc, cat) => {
    acc[cat] = insights.filter((i) => i.category === cat).length;
    return acc;
  }, {} as Record<InsightCategory, number>);

  // Extract insights from a diagnostic run
  const extractInsights = async (runId: string, toolId: string) => {
    setIsExtracting(true);
    setExtractingRunId(runId);

    try {
      const response = await fetch(`/api/os/client-brain/${companyId}/extract-insights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId, runId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to extract insights');
      }

      // Add new insights to state
      setInsights((prev) => [...data.insights, ...prev]);
      showToast(`Extracted ${data.count} insights from ${data.source.toolName}`, 'success');
    } catch (error) {
      console.error('Error extracting insights:', error);
      showToast(error instanceof Error ? error.message : 'Failed to extract insights', 'error');
    } finally {
      setIsExtracting(false);
      setExtractingRunId(null);
    }
  };

  // Generate work items from an insight
  const generateWork = async (insight: ClientInsight) => {
    setGeneratingWorkFor(insight.id);

    try {
      const response = await fetch(
        `/api/os/client-brain/${companyId}/insights/${insight.id}/generate-work`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate work items');
      }

      // Update insight work count in state
      setInsights((prev) =>
        prev.map((i) =>
          i.id === insight.id
            ? { ...i, workItemCount: (i.workItemCount || 0) + data.count }
            : i
        )
      );

      showToast(`Created ${data.count} work items from insight`, 'success');
    } catch (error) {
      console.error('Error generating work:', error);
      showToast(error instanceof Error ? error.message : 'Failed to generate work', 'error');
    } finally {
      setGeneratingWorkFor(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 rounded-lg px-4 py-3 shadow-lg ${
            toast.type === 'success'
              ? 'bg-emerald-900/90 border border-emerald-700 text-emerald-100'
              : 'bg-red-900/90 border border-red-700 text-red-100'
          }`}
        >
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
      )}

      {/* Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-100">Client Brain</h1>
            <p className="mt-1 text-sm text-slate-400">
              Strategic memory and insights for {companyName}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Condition-based insights about the client. These are durable observations, not tasks.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Total Insights</p>
            <p className="text-3xl font-bold text-amber-400">{insights.length}</p>
          </div>
        </div>

        {/* Extract from Diagnostics */}
        {diagnosticRuns.length > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
              Extract Insights from Diagnostic Runs
            </p>
            <div className="flex flex-wrap gap-2">
              {diagnosticRuns.slice(0, 6).map((run) => (
                <button
                  key={run.id}
                  onClick={() => extractInsights(run.id, run.toolId)}
                  disabled={isExtracting}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    extractingRunId === run.id
                      ? 'bg-amber-600 text-white cursor-wait'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {extractingRunId === run.id ? (
                    <span className="flex items-center gap-1.5">
                      <Spinner />
                      Extracting...
                    </span>
                  ) : (
                    <>Extract from {run.toolId}</>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-colors"
          >
            + Add Insight
          </button>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            selectedCategory === 'all'
              ? 'bg-amber-500 text-slate-900'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          All ({insights.length})
        </button>
        {categories.filter((c) => categoryCounts[c] > 0).map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              selectedCategory === category
                ? 'bg-amber-500 text-slate-900'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {category} ({categoryCounts[category]})
          </button>
        ))}
      </div>

      {/* Insights Grid */}
      {filteredInsights.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-12 text-center">
          <p className="text-slate-400">No insights yet</p>
          <p className="text-sm text-slate-500 mt-2">
            Extract insights from diagnostic runs or add them manually.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredInsights.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onGenerateWork={() => generateWork(insight)}
              isGenerating={generatingWorkFor === insight.id}
            />
          ))}
        </div>
      )}

      {/* Add Insight Modal */}
      {showAddModal && (
        <AddInsightModal
          companyId={companyId}
          onClose={() => setShowAddModal(false)}
          onCreated={(newInsight) => {
            setInsights((prev) => [newInsight, ...prev]);
            setShowAddModal(false);
            showToast('Insight added', 'success');
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

function Spinner() {
  return (
    <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

interface InsightCardProps {
  insight: ClientInsight;
  onGenerateWork: () => void;
  isGenerating: boolean;
}

function InsightCard({ insight, onGenerateWork, isGenerating }: InsightCardProps) {
  const sourceLabel = getInsightSourceLabel(insight.source);
  const severityColor = getInsightSeverityColor(insight.severity);
  const categoryColor = getInsightCategoryColor(insight.category);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 hover:border-slate-700 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-200 leading-tight">
            {insight.title}
          </h3>
          <p className="text-xs text-slate-500 mt-1">{sourceLabel}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${severityColor}`}>
            {insight.severity}
          </span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-medium border capitalize ${categoryColor}`}>
            {insight.category}
          </span>
        </div>
      </div>

      {/* Body */}
      <p className="text-xs text-slate-400 leading-relaxed mb-4 line-clamp-3">
        {insight.body}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-800">
        <div className="text-[10px] text-slate-500">
          {insight.workItemCount ? (
            <span className="text-blue-400">{insight.workItemCount} work items</span>
          ) : (
            <span>No work items yet</span>
          )}
        </div>
        <button
          onClick={onGenerateWork}
          disabled={isGenerating}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
            isGenerating
              ? 'bg-blue-900/50 text-blue-300 cursor-wait'
              : 'bg-blue-600 text-white hover:bg-blue-500'
          }`}
        >
          {isGenerating ? (
            <span className="flex items-center gap-1.5">
              <Spinner />
              Generating...
            </span>
          ) : (
            'Generate Work'
          )}
        </button>
      </div>
    </div>
  );
}

interface AddInsightModalProps {
  companyId: string;
  onClose: () => void;
  onCreated: (insight: ClientInsight) => void;
}

function AddInsightModal({ companyId, onClose, onCreated }: AddInsightModalProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<InsightCategory>('other');
  const [severity, setSeverity] = useState<InsightSeverity>('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/os/client-brain/${companyId}/insights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, category, severity }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create insight');
      }

      onCreated(data.insight);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create insight');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories: InsightCategory[] = [
    'brand', 'content', 'seo', 'website', 'analytics',
    'demand', 'ops', 'competitive', 'structural', 'product', 'other'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-slate-100">Add Insight</h2>
          <p className="text-xs text-slate-500 mt-1">
            Describe a durable condition about the client (not a task).
            <br />
            Example: &quot;Homepage lacks a clear CTA&quot;, &quot;No pricing page exists&quot;
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Insight Title (condition-based, not a task)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Homepage lacks a clear value proposition"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Details & Supporting Evidence
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Explain why this is true and provide context..."
              rows={4}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as InsightCategory)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                {categories.map((c) => (
                  <option key={c} value={c} className="capitalize">
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Severity
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as InsightSeverity)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title || !body}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isSubmitting || !title || !body
                  ? 'bg-amber-700 text-amber-200 cursor-not-allowed'
                  : 'bg-amber-500 text-slate-900 hover:bg-amber-400'
              }`}
            >
              {isSubmitting ? 'Adding...' : 'Add Insight'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
