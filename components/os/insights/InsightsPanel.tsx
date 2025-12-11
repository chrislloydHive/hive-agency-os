'use client';

// components/os/insights/InsightsPanel.tsx
// Compact insights panel for the Overview page
// Shows top insights with links to full insights page

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Lightbulb,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import type {
  Insight,
  InsightSeverity,
} from '@/lib/os/insights/insightTypes.client';
import {
  getSeverityColorClasses,
  getTimeframeLabel,
} from '@/lib/os/insights/insightTypes.client';

interface InsightsPanelProps {
  companyId: string;
  maxItems?: number;
}

export function InsightsPanel({ companyId, maxItems = 3 }: InsightsPanelProps) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInsights() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/os/companies/${companyId}/insights?limit=${maxItems}`
        );
        const data = await response.json();

        if (data.success) {
          setInsights(data.data.insights || []);
        } else {
          setError(data.error || 'Failed to load insights');
        }
      } catch (err) {
        setError('Failed to connect to insights service');
        console.error('[InsightsPanel] Error:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchInsights();
  }, [companyId, maxItems]);

  const getSeverityIcon = (severity: InsightSeverity) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4" />;
      case 'warning':
        return <TrendingDown className="w-4 h-4" />;
      case 'positive':
        return <TrendingUp className="w-4 h-4" />;
      default:
        return <Lightbulb className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-medium text-zinc-300">AI Insights</h3>
        </div>
        <div className="flex items-center justify-center py-6">
          <RefreshCw className="w-5 h-5 text-zinc-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-medium text-zinc-300">AI Insights</h3>
        </div>
        <p className="text-sm text-zinc-500">{error}</p>
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-medium text-zinc-300">AI Insights</h3>
        </div>
        <p className="text-sm text-zinc-500">
          No insights available yet. Run a diagnostic to generate insights.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-medium text-zinc-300">AI Insights</h3>
        </div>
        <Link
          href={`/c/${companyId}/insights`}
          className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
        >
          View all
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="space-y-2">
        {insights.map((insight) => {
          const colors = getSeverityColorClasses(insight.severity);

          return (
            <div
              key={insight.id}
              className={`p-3 rounded-lg border ${colors.bg} ${colors.border}`}
            >
              <div className="flex items-start gap-2">
                <span className={colors.icon}>
                  {getSeverityIcon(insight.severity)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${colors.text}`}>
                    {insight.title}
                  </p>
                  <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                    {insight.message}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-zinc-500">
                      {getTimeframeLabel(insight.timeframe)}
                    </span>
                    {insight.recommendedActions.length > 0 && (
                      <>
                        <span className="text-zinc-600">•</span>
                        <Link
                          href={insight.recommendedActions[0].linkPath || `/c/${companyId}/findings`}
                          className="text-xs text-purple-400 hover:text-purple-300"
                        >
                          {insight.recommendedActions[0].title}
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default InsightsPanel;
