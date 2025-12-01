'use client';

// components/os/funnel/FunnelAIPanel.tsx
// AI insights panel for funnel views with caching and work item creation

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { FunnelDataset } from '@/lib/os/analytics/funnelTypes';
import type { FunnelInsights, FunnelKeyInsight } from '@/lib/ai/funnelInsights';
import { generateQuickInsights } from '@/lib/ai/funnelInsights';
import {
  getCachedInsights,
  setCachedInsights,
  invalidateInsightsCache,
  type InsightsCacheContext,
} from '@/lib/ai/insightsCache';

export interface FunnelAIPanelProps {
  dataset: FunnelDataset;
  cacheContext: InsightsCacheContext;
  cacheKey: string;
  companyName?: string;
  /** Company ID for work item creation (required for company funnel context) */
  companyId?: string;
  /** API endpoint to fetch insights */
  apiEndpoint?: string;
  /** Show work item creation buttons */
  showWorkItemButtons?: boolean;
  /** Show experiment creation buttons */
  showExperimentButtons?: boolean;
  /** Custom onCreateWorkItem handler */
  onCreateWorkItem?: (title: string, description: string, type: string) => Promise<void>;
  /** Custom onCreateExperiment handler */
  onCreateExperiment?: (name: string, hypothesis: string, successMetric: string) => Promise<void>;
}

export function FunnelAIPanel({
  dataset,
  cacheContext,
  cacheKey,
  companyName,
  companyId,
  apiEndpoint = '/api/os/funnel/insights',
  showWorkItemButtons = true,
  showExperimentButtons = true,
  onCreateWorkItem,
  onCreateExperiment,
}: FunnelAIPanelProps) {
  const [insights, setInsights] = useState<FunnelInsights | null>(null);
  const [quickInsights, setQuickInsights] = useState<FunnelKeyInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingItem, setCreatingItem] = useState<string | null>(null);
  const [successItem, setSuccessItem] = useState<string | null>(null);

  // Generate quick insights immediately
  useEffect(() => {
    if (dataset) {
      const quick = generateQuickInsights(dataset);
      setQuickInsights(quick);
    }
  }, [dataset]);

  // Check cache on mount
  useEffect(() => {
    const cached = getCachedInsights<FunnelInsights>(cacheContext, cacheKey);
    if (cached) {
      setInsights(cached);
    }
  }, [cacheContext, cacheKey]);

  // Fetch AI insights
  const fetchInsights = useCallback(async () => {
    // Check cache first
    const cached = getCachedInsights<FunnelInsights>(cacheContext, cacheKey);
    if (cached) {
      setInsights(cached);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataset,
          companyName,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate insights');
      }

      const data = await response.json();
      setInsights(data.insights);

      // Cache the result
      setCachedInsights(cacheContext, cacheKey, data.insights, 24);
    } catch (err) {
      console.error('Error fetching funnel insights:', err);
      setError(err instanceof Error ? err.message : 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  }, [dataset, companyName, cacheContext, cacheKey, apiEndpoint]);

  // Refresh insights (clear cache)
  const handleRefresh = useCallback(() => {
    invalidateInsightsCache(cacheContext, cacheKey);
    setInsights(null);
    fetchInsights();
  }, [cacheContext, cacheKey, fetchInsights]);

  // Create work item
  const handleCreateWorkItem = async (title: string, description: string, type: string) => {
    const itemKey = `${type}-${title.slice(0, 20)}`;
    setCreatingItem(itemKey);
    setSuccessItem(null);

    try {
      if (onCreateWorkItem) {
        await onCreateWorkItem(title, description, type);
      } else {
        // Use the unified funnel work item API
        const response = await fetch('/api/os/funnel/work-item', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.slice(0, 100),
            description,
            itemType: type as 'quick_win' | 'experiment' | 'recommendation',
            priority: 'medium',
            dateRange: `${dataset.range.startDate} to ${dataset.range.endDate}`,
            funnelContext: dataset.context,
            companyId: companyId || dataset.contextId,
            companyName,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to create work item');
        }
      }

      setSuccessItem(itemKey);
      setTimeout(() => setSuccessItem(null), 3000);
    } catch (err) {
      console.error('Error creating work item:', err);
      alert('Failed to create work item');
    } finally {
      setCreatingItem(null);
    }
  };

  // Create experiment
  const handleCreateExperiment = async (name: string, hypothesis: string, successMetric: string) => {
    const itemKey = `experiment-${name.slice(0, 20)}`;
    setCreatingItem(itemKey);
    setSuccessItem(null);

    try {
      if (onCreateExperiment) {
        await onCreateExperiment(name, hypothesis, successMetric);
      } else {
        // Default API call with company context
        const response = await fetch('/api/experiments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            hypothesis,
            successMetric,
            companyId: companyId || dataset.contextId,
            status: 'Idea',
            area: 'Funnel',
            source: `${dataset.context.charAt(0).toUpperCase() + dataset.context.slice(1)} Funnel AI`,
            sourceJson: {
              funnelContext: dataset.context,
              companyId: companyId || dataset.contextId,
              companyName,
              dateRange: `${dataset.range.startDate} to ${dataset.range.endDate}`,
              sourceType: 'funnel_insight',
            },
          }),
        });

        const data = await response.json();
        if (!data.ok) {
          throw new Error(data.error || 'Failed to create experiment');
        }
      }

      setSuccessItem(itemKey);
      setTimeout(() => setSuccessItem(null), 3000);
    } catch (err) {
      console.error('Error creating experiment:', err);
      alert('Failed to create experiment');
    } finally {
      setCreatingItem(null);
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-lg p-4 sm:p-6 lg:sticky lg:top-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.477.859h4z" />
          </svg>
          <h2 className="text-lg font-semibold text-blue-100">AI Insights</h2>
        </div>
        {insights && (
          <button
            onClick={handleRefresh}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            title="Refresh insights"
          >
            Refresh
          </button>
        )}
      </div>
      <p className="text-xs text-blue-300/70 mb-4">
        AI-powered analysis | Cached 24h
      </p>

      {/* Loading state */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
          <p className="text-blue-200 text-sm mt-3">Analyzing funnel data...</p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="bg-red-500/10 border border-red-500/30 rounded p-4">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={fetchInsights}
            className="mt-2 text-xs text-red-300 hover:text-red-200"
          >
            Try again
          </button>
        </div>
      )}

      {/* Quick insights (shown immediately) */}
      {!insights && !loading && quickInsights.length > 0 && (
        <div className="space-y-4">
          <div className="text-sm text-blue-100 mb-2">Quick Analysis</div>
          {quickInsights.map((insight, idx) => (
            <div
              key={idx}
              className={`bg-slate-900/50 border rounded p-3 ${
                insight.type === 'positive'
                  ? 'border-emerald-500/30'
                  : insight.type === 'warning'
                  ? 'border-amber-500/30'
                  : 'border-slate-700'
              }`}
            >
              <div className="flex items-start gap-2">
                {insight.type === 'positive' && <span className="text-emerald-400 mt-0.5">+</span>}
                {insight.type === 'warning' && <span className="text-amber-400 mt-0.5">!</span>}
                {insight.type === 'neutral' && <span className="text-blue-400 mt-0.5">-</span>}
                <div>
                  <div className="font-medium text-slate-200 text-sm">{insight.title}</div>
                  <div className="text-xs text-slate-400 mt-1">{insight.detail}</div>
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={fetchInsights}
            className="w-full mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white font-medium rounded-lg transition-colors text-sm"
          >
            Get Full AI Analysis
          </button>
        </div>
      )}

      {/* Full AI insights */}
      {insights && !loading && (
        <div className="space-y-5">
          {/* Summary */}
          <div className="text-sm text-blue-100 leading-relaxed">{insights.summary}</div>

          {/* Headline Metrics */}
          {insights.headlineMetrics.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {insights.headlineMetrics.map((metric, idx) => (
                <div key={idx} className="bg-slate-900/50 rounded p-2 text-center overflow-hidden">
                  <div className="text-xs text-slate-500 truncate">{metric.label}</div>
                  <div className="text-sm font-semibold text-slate-200 flex items-center justify-center gap-1 truncate">
                    <span className="truncate">{metric.value}</span>
                    {metric.trend === 'up' && <span className="text-emerald-400 flex-shrink-0">+</span>}
                    {metric.trend === 'down' && <span className="text-red-400 flex-shrink-0">-</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Key Insights */}
          {insights.keyInsights.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-blue-100 mb-2">Key Insights</h3>
              <div className="space-y-3">
                {insights.keyInsights.map((insight, idx) => (
                  <div
                    key={idx}
                    className={`bg-slate-900/50 border rounded p-3 ${
                      insight.type === 'positive'
                        ? 'border-emerald-500/30'
                        : insight.type === 'warning'
                        ? 'border-amber-500/30'
                        : 'border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {insight.type === 'positive' && <span className="text-emerald-400 mt-0.5">+</span>}
                      {insight.type === 'warning' && <span className="text-amber-400 mt-0.5">!</span>}
                      {insight.type === 'neutral' && <span className="text-blue-400 mt-0.5">-</span>}
                      <div>
                        <div className="font-medium text-slate-200 text-sm">{insight.title}</div>
                        <div className="text-xs text-slate-400 mt-1">{insight.detail}</div>
                        <div className="text-xs text-slate-500 italic mt-1">{insight.evidence}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Wins */}
          {insights.quickWins.length > 0 && showWorkItemButtons && (
            <div>
              <h3 className="text-sm font-semibold text-blue-100 mb-2">Quick Wins</h3>
              <ul className="space-y-2">
                {insights.quickWins.map((win, idx) => {
                  const itemKey = `quick_win-${win.slice(0, 20)}`;
                  const isCreating = creatingItem === itemKey;
                  const isSuccess = successItem === itemKey;
                  return (
                    <li key={idx} className="flex items-start gap-2 text-sm text-blue-200">
                      <span className="text-emerald-400 mt-0.5 flex-shrink-0">*</span>
                      <div className="flex-1 min-w-0">
                        <span className="break-words">{win}</span>
                        <button
                          onClick={() => handleCreateWorkItem(win.slice(0, 80), win, 'quick_win')}
                          disabled={isCreating}
                          className={`mt-1.5 text-xs px-2 py-0.5 rounded transition-colors block ${
                            isSuccess
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : isCreating
                              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                              : 'bg-blue-500/10 text-blue-300 hover:bg-blue-500/20'
                          }`}
                        >
                          {isSuccess ? 'Created!' : isCreating ? 'Creating...' : '+ Work Item'}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Experiments */}
          {insights.experiments.length > 0 && showExperimentButtons && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-blue-100">Experiments</h3>
                <Link
                  href="/experiments"
                  className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                >
                  View All
                </Link>
              </div>
              <div className="space-y-2">
                {insights.experiments.map((exp, idx) => {
                  const itemKey = `experiment-${exp.name.slice(0, 20)}`;
                  const isCreating = creatingItem === itemKey;
                  const isSuccess = successItem === itemKey;
                  return (
                    <div key={idx} className="bg-slate-900/50 border border-slate-700 rounded p-3 overflow-hidden">
                      <div className="font-medium text-slate-200 text-sm break-words">{exp.name}</div>
                      <div className="text-xs text-slate-400 mt-1 break-words">{exp.hypothesis}</div>
                      <div className="text-xs text-purple-400 mt-1 break-words">
                        Measure: {exp.successMetric}
                      </div>
                      <button
                        onClick={() => handleCreateExperiment(exp.name, exp.hypothesis, exp.successMetric)}
                        disabled={isCreating}
                        className={`mt-2 text-xs px-2 py-0.5 rounded transition-colors ${
                          isSuccess
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : isCreating
                            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                            : 'bg-purple-500/10 text-purple-300 hover:bg-purple-500/20'
                        }`}
                      >
                        {isSuccess ? 'Created!' : isCreating ? 'Creating...' : '+ Add Experiment'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Generated timestamp */}
          <div className="text-xs text-slate-500 pt-2 border-t border-blue-500/20">
            Generated: {new Date(insights.generatedAt).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}
