'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Lightbulb,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  Sparkles,
  Search,
  Globe,
  FileText,
  BarChart2,
  TrendingUp,
  Settings,
  Users,
  Layers,
  Package,
  Circle,
  ChevronDown,
  ChevronRight,
  Wrench,
  File,
  User,
} from 'lucide-react';
import type { ClientInsight, InsightCategory, InsightSeverity } from '@/lib/types/clientBrain';
import { INSIGHT_CATEGORY_CONFIG, INSIGHT_SEVERITY_CONFIG } from '@/lib/types/clientBrain';

interface ClientBrainInsightsPanelProps {
  companyId: string;
  companyName: string;
}

// Icon map for categories
const CATEGORY_ICONS: Record<InsightCategory, React.ComponentType<{ className?: string }>> = {
  brand: Sparkles,
  content: FileText,
  seo: Search,
  website: Globe,
  analytics: BarChart2,
  demand: TrendingUp,
  ops: Settings,
  competitive: Users,
  structural: Layers,
  product: Package,
  other: Circle,
};

// Source icons
const SOURCE_ICONS = {
  tool_run: Wrench,
  document: File,
  manual: User,
};

function getCategoryColorClass(category: InsightCategory): string {
  const colorMap: Record<string, string> = {
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    pink: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
    orange: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    red: 'bg-red-500/10 text-red-400 border-red-500/30',
    slate: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  };
  const color = INSIGHT_CATEGORY_CONFIG[category]?.color || 'slate';
  return colorMap[color] || colorMap.slate;
}

function getSeverityColorClass(severity: InsightSeverity): string {
  const colorMap: Record<InsightSeverity, string> = {
    low: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    medium: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    high: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    critical: 'bg-red-500/10 text-red-400 border-red-500/30',
  };
  return colorMap[severity] || colorMap.medium;
}

export function ClientBrainInsightsPanel({ companyId, companyName }: ClientBrainInsightsPanelProps) {
  const [insights, setInsights] = useState<ClientInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<InsightCategory | 'all'>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formCategory, setFormCategory] = useState<InsightCategory>('other');
  const [formSeverity, setFormSeverity] = useState<InsightSeverity>('medium');
  const [formSubmitting, setFormSubmitting] = useState(false);

  const fetchInsights = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ companyId });
      if (categoryFilter !== 'all') {
        params.set('category', categoryFilter);
      }

      const response = await fetch(`/api/client-brain/insights?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch insights');
      }

      setInsights(data.insights || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  }, [companyId, categoryFilter]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const handleAddInsight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formBody.trim()) return;

    try {
      setFormSubmitting(true);
      const response = await fetch('/api/client-brain/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          title: formTitle.trim(),
          body: formBody.trim(),
          category: formCategory,
          severity: formSeverity,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create insight');
      }

      // Add to list and reset form
      setInsights((prev) => [data.insight, ...prev]);
      setFormTitle('');
      setFormBody('');
      setFormCategory('other');
      setFormSeverity('medium');
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add insight');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteInsight = async (insightId: string) => {
    if (!confirm('Are you sure you want to delete this insight?')) return;

    try {
      setDeletingId(insightId);
      const response = await fetch(`/api/client-brain/insights/${insightId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete insight');
      }

      setInsights((prev) => prev.filter((i) => i.id !== insightId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete insight');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const getSourceLabel = (insight: ClientInsight) => {
    switch (insight.source.type) {
      case 'tool_run':
        return `From ${insight.source.toolSlug}`;
      case 'document':
        return 'From document';
      case 'manual':
        return insight.source.createdBy ? `By ${insight.source.createdBy}` : 'Manual';
      default:
        return 'Unknown source';
    }
  };

  // Check if insight is a diagnostic summary (from tool runs)
  const isDiagnosticSummary = (insight: ClientInsight) => {
    return insight.source.type === 'tool_run' && insight.title.includes('Diagnostic Summary');
  };

  // Group insights by category for summary
  const categoryGroups = insights.reduce((acc, insight) => {
    const cat = insight.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(insight);
    return acc;
  }, {} as Record<InsightCategory, ClientInsight[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <Lightbulb className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Client Insights</h2>
            <p className="text-sm text-slate-400">
              Strategic knowledge for {companyName}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Insight
        </button>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div>
            <p className="text-sm text-red-200">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-xs text-red-400 hover:text-red-300 mt-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Add Insight Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddInsight}
          className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-4"
        >
          <div className="text-sm font-medium text-slate-200 mb-2">Add Manual Insight</div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Title</label>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Brief, actionable title..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Body</label>
            <textarea
              value={formBody}
              onChange={(e) => setFormBody(e.target.value)}
              placeholder="Detailed insight with context and evidence..."
              rows={4}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 resize-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Category</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as InsightCategory)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-amber-500"
              >
                {Object.entries(INSIGHT_CATEGORY_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Severity</label>
              <select
                value={formSeverity}
                onChange={(e) => setFormSeverity(e.target.value as InsightSeverity)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-amber-500"
              >
                {Object.entries(INSIGHT_SEVERITY_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-lg disabled:opacity-50"
            >
              {formSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Insight
            </button>
          </div>
        </form>
      )}

      {/* Category Filter Chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            categoryFilter === 'all'
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600'
          }`}
        >
          All ({insights.length})
        </button>
        {Object.entries(categoryGroups).map(([category, catInsights]) => {
          const config = INSIGHT_CATEGORY_CONFIG[category as InsightCategory];
          return (
            <button
              key={category}
              onClick={() => setCategoryFilter(category as InsightCategory)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                categoryFilter === category
                  ? getCategoryColorClass(category as InsightCategory)
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600'
              }`}
            >
              {config?.label || category} ({catInsights.length})
            </button>
          );
        })}
      </div>

      {/* Insights List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
        </div>
      ) : insights.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-xl">
          <Lightbulb className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No insights yet</p>
          <p className="text-xs text-slate-500 mt-1">
            Run diagnostics or add manual insights to build strategic knowledge
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {insights.map((insight) => {
            const CategoryIcon = CATEGORY_ICONS[insight.category] || Circle;
            const SourceIcon = SOURCE_ICONS[insight.source.type] || Circle;
            const isExpanded = expandedId === insight.id;
            const isDeleting = deletingId === insight.id;
            const isFromDiagnostic = isDiagnosticSummary(insight);

            return (
              <div
                key={insight.id}
                className={`bg-slate-900 border rounded-xl overflow-hidden ${
                  isFromDiagnostic
                    ? 'border-blue-500/30 ring-1 ring-blue-500/10'
                    : 'border-slate-800'
                }`}
              >
                {/* Header Row */}
                <div
                  className="flex items-start gap-3 p-4 cursor-pointer hover:bg-slate-800/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : insight.id)}
                >
                  {/* Expand Icon */}
                  <div className="pt-0.5">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    )}
                  </div>

                  {/* Category Icon */}
                  <div
                    className={`p-2 rounded-lg border flex-shrink-0 ${getCategoryColorClass(
                      insight.category
                    )}`}
                  >
                    <CategoryIcon className="w-4 h-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="text-sm font-medium text-slate-100 line-clamp-2">
                          {insight.title}
                        </h3>
                        {isFromDiagnostic && (
                          <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            AI Summary
                          </span>
                        )}
                      </div>
                      {insight.severity && (
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded border flex-shrink-0 ${getSeverityColorClass(
                            insight.severity
                          )}`}
                        >
                          {INSIGHT_SEVERITY_CONFIG[insight.severity]?.label}
                        </span>
                      )}
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <SourceIcon className="w-3 h-3" />
                        {getSourceLabel(insight)}
                      </span>
                      <span>{formatDate(insight.createdAt)}</span>
                    </div>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteInsight(insight.id);
                    }}
                    disabled={isDeleting}
                    className="p-2 text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    {isDeleting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Expanded Body */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 pl-14">
                    <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-lg text-sm text-slate-300 whitespace-pre-wrap">
                      {insight.body}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ClientBrainInsightsPanel;
