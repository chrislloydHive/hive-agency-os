'use client';

// components/os/OSIntelligenceDashboard.tsx
// Enhanced OS Intelligence Dashboard with AI-driven insights

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ScoreGauge,
  RiskClusterCard,
  OpportunityCard,
  SystemActionCard,
} from '@/components/intelligence';
import type {
  OSHealthSummary,
  SystemAIAnalysis,
  NextBestAction,
} from '@/lib/intelligence/types';

interface OSIntelligenceDashboardProps {
  initialData?: OSHealthSummary | null;
}

export function OSIntelligenceDashboard({ initialData }: OSIntelligenceDashboardProps) {
  const [data, setData] = useState<OSHealthSummary | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<SystemAIAnalysis | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // Fetch intelligence data
  useEffect(() => {
    if (initialData) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/os/intelligence');
        if (!response.ok) throw new Error('Failed to fetch intelligence data');
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [initialData]);

  // Generate fallback next best action if AI analysis not available
  const getNextBestAction = (): NextBestAction => {
    if (aiAnalysis?.nextBestAction) return aiAnalysis.nextBestAction;

    if (data?.risks?.[0]) {
      const topRisk = data.risks[0];
      return {
        title: `Address: ${topRisk.title}`,
        description: topRisk.description,
        priority: topRisk.severity === 'critical' ? 'critical' : 'high',
      };
    }

    return {
      title: 'Review workspace metrics',
      description: 'Check overall workspace health and identify areas for improvement.',
      priority: 'medium',
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mx-auto mb-4" />
          <p className="text-slate-400">Loading intelligence data...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
        <p className="text-red-400 font-medium">Error loading intelligence data</p>
        <p className="text-slate-400 text-sm mt-2">{error || 'Unknown error'}</p>
      </div>
    );
  }

  const { systemHealthScore, risks, opportunities, clusters, warnings, metrics } = data;

  return (
    <div className="space-y-8">
      {/* ================================================================== */}
      {/* Band 1: System Health + Next Best Action */}
      {/* ================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Health Score */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-100">System Health</h2>
            <span className="text-xs text-slate-500">
              {new Date(data.generatedAt).toLocaleTimeString()}
            </span>
          </div>
          <div className="flex items-center justify-center">
            <ScoreGauge score={systemHealthScore} size="lg" label="Health Score" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="text-center p-2 bg-slate-800/50 rounded-lg">
              <div className="text-lg font-bold text-slate-100">{metrics.totalCompanies}</div>
              <div className="text-xs text-slate-400">Companies</div>
            </div>
            <div className="text-center p-2 bg-slate-800/50 rounded-lg">
              <div className="text-lg font-bold text-red-400">{metrics.companiesAtRisk}</div>
              <div className="text-xs text-slate-400">At Risk</div>
            </div>
          </div>
        </div>

        {/* Next Best Action - spans 2 columns */}
        <div className="lg:col-span-2">
          <SystemActionCard action={getNextBestAction()} />

          {/* Executive Summary */}
          {aiAnalysis?.executiveSummary && (
            <div className="mt-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-medium text-slate-400 mb-2">Executive Summary</h3>
              <p className="text-slate-200">{aiAnalysis.executiveSummary}</p>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================== */}
      {/* Band 2: Key Metrics Grid */}
      {/* ================================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
        <MetricCard
          label="Diagnostics Coverage"
          value={`${metrics.diagnosticsCoverage.toFixed(0)}%`}
          subtext={`${metrics.companiesWithDiagnostics} / ${metrics.totalCompanies}`}
          trend={metrics.diagnosticsCoverage >= 50 ? 'good' : 'warning'}
        />
        <MetricCard
          label="Work Created"
          value={metrics.workCreated30d.toString()}
          subtext="Last 30 days"
        />
        <MetricCard
          label="Work Completed"
          value={metrics.workCompleted30d.toString()}
          subtext={`${metrics.workCompletionRate.toFixed(0)}% rate`}
          trend={metrics.workCompletionRate >= 50 ? 'good' : 'warning'}
        />
        <MetricCard
          label="Overdue Work"
          value={metrics.workOverdue.toString()}
          trend={metrics.workOverdue === 0 ? 'good' : 'bad'}
        />
        <MetricCard
          label="DMA Audits"
          value={metrics.dmaAuditsStarted30d.toString()}
          subtext={`${metrics.dmaCompletionRate.toFixed(0)}% completed`}
        />
        <MetricCard
          label="New Leads"
          value={metrics.newLeads30d.toString()}
          subtext="Last 30 days"
        />
      </div>

      {/* ================================================================== */}
      {/* Band 3: Warnings */}
      {/* ================================================================== */}
      {warnings.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <h3 className="font-semibold text-amber-200">System Warnings</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {warnings.map((warning, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 text-sm text-amber-100 bg-amber-500/10 rounded-lg px-3 py-2"
              >
                <span className="text-amber-400">!</span>
                {warning}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* Band 4: Risk Clusters */}
      {/* ================================================================== */}
      {risks.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-slate-100">Risk Clusters</h2>
            <Link
              href="/companies?filter=at-risk"
              className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
            >
              View all at-risk
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {risks.map((risk) => (
              <RiskClusterCard key={risk.id} {...risk} />
            ))}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* Band 5: Opportunities */}
      {/* ================================================================== */}
      {opportunities.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-slate-100">Opportunities</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {opportunities.map((opp) => (
              <OpportunityCard key={opp.id} {...opp} />
            ))}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* Band 6: OS Funnel 2.0 */}
      {/* ================================================================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-slate-100">OS Funnel</h2>
          <span className="text-xs text-slate-500">Last 30 days</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <FunnelStage
            label="New Companies"
            value={Object.values(metrics.companiesByStage).reduce((a, b) => a + b, 0) || metrics.totalCompanies}
            icon="building"
          />
          <FunnelStage
            label="Diagnostics Run"
            value={metrics.companiesWithDiagnostics}
            icon="chart"
            showArrow
          />
          <FunnelStage
            label="Plans Produced"
            value={metrics.companiesWithPlans}
            icon="document"
            showArrow
          />
          <FunnelStage
            label="Work Created"
            value={metrics.workCreated30d}
            icon="tasks"
            showArrow
          />
          <FunnelStage
            label="Work Completed"
            value={metrics.workCompleted30d}
            icon="check"
            showArrow
          />
          <FunnelStage
            label="Active Last Week"
            value={metrics.companiesActiveLastWeek}
            icon="activity"
            showArrow
          />
        </div>
      </div>

      {/* ================================================================== */}
      {/* Band 7: Clusters */}
      {/* ================================================================== */}
      {clusters.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-slate-100">Company Clusters</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {clusters.map((cluster) => (
              <div
                key={cluster.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/20">
                    <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-100">{cluster.clusterName}</h3>
                    <p className="text-sm text-slate-400 mt-1">{cluster.description}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {cluster.companyNames.slice(0, 4).map((name, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-2 py-0.5 bg-slate-800 text-slate-300 rounded"
                        >
                          {name}
                        </span>
                      ))}
                      {cluster.companyNames.length > 4 && (
                        <span className="text-xs text-slate-500">
                          +{cluster.companyNames.length - 4} more
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-purple-300 mt-2">{cluster.suggestedAction}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper Components

function MetricCard({
  label,
  value,
  subtext,
  trend,
}: {
  label: string;
  value: string;
  subtext?: string;
  trend?: 'good' | 'warning' | 'bad';
}) {
  const trendColors = {
    good: 'text-emerald-400',
    warning: 'text-amber-400',
    bad: 'text-red-400',
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${trend ? trendColors[trend] : 'text-slate-100'}`}>
        {value}
      </div>
      {subtext && <div className="text-xs text-slate-500 mt-1">{subtext}</div>}
    </div>
  );
}

function FunnelStage({
  label,
  value,
  icon,
  showArrow,
}: {
  label: string;
  value: number;
  icon: string;
  showArrow?: boolean;
}) {
  const icons: Record<string, React.ReactNode> = {
    building: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    chart: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    document: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    tasks: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    check: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    activity: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  };

  return (
    <div className="relative flex flex-col items-center">
      {showArrow && (
        <div className="absolute -left-2 top-1/2 -translate-y-1/2 text-slate-600 hidden sm:block">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}
      <div className="p-3 rounded-lg bg-slate-800 text-amber-400 mb-2">
        {icons[icon]}
      </div>
      <div className="text-2xl font-bold text-slate-100">{value}</div>
      <div className="text-xs text-slate-400 text-center mt-1">{label}</div>
    </div>
  );
}

export default OSIntelligenceDashboard;
