'use client';

// components/os/CompanyAnalyticsTab.tsx
// Analytics tab for company detail page - shows GA4 + Search Console data with unified AI insights

import { useState, useEffect } from 'react';
import type { GrowthAnalyticsSnapshot } from '@/lib/analytics/models';
import type {
  SearchConsoleSnapshot,
  SearchConsoleAIInsights,
} from '@/lib/os/searchConsole/types';
import type {
  CompanyAnalyticsInput,
  CompanyAnalyticsAiInsight,
  CompanyAnalyticsDateRangePreset,
  CompanyAnalyticsWorkSuggestion,
} from '@/lib/os/companies/analyticsTypes';
import { BlueprintChartsView } from '@/components/analytics/BlueprintChartsView';
import type { AnalyticsBlueprint } from '@/lib/analytics/blueprintTypes';

interface CompanyAnalyticsTabProps {
  companyId: string;
  companyName: string;
  ga4PropertyId?: string | null;
  searchConsoleSiteUrl?: string | null;
  analyticsBlueprint?: AnalyticsBlueprint | null;
}

export function CompanyAnalyticsTab({
  companyId,
  companyName,
  ga4PropertyId,
  searchConsoleSiteUrl,
  analyticsBlueprint,
}: CompanyAnalyticsTabProps) {
  // GA4 State
  const [snapshot, setSnapshot] = useState<GrowthAnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search Console State
  const [gscSnapshot, setGscSnapshot] = useState<SearchConsoleSnapshot | null>(null);
  const [gscLoading, setGscLoading] = useState(false);
  const [gscError, setGscError] = useState<string | null>(null);

  // Legacy Search-only AI Insights (kept for backward compat)
  const [searchInsights, setSearchInsights] = useState<SearchConsoleAIInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  // NEW: Unified Company AI Insights
  const [companyInsights, setCompanyInsights] = useState<CompanyAnalyticsAiInsight | null>(null);
  const [companyInput, setCompanyInput] = useState<CompanyAnalyticsInput | null>(null);
  const [companyInsightsLoading, setCompanyInsightsLoading] = useState(false);
  const [companyInsightsError, setCompanyInsightsError] = useState<string | null>(null);

  // UI State
  const [activeDays, setActiveDays] = useState(30);
  const [activeSection, setActiveSection] = useState<'overview' | 'charts' | 'traffic' | 'search'>('overview');

  // Work Item Creation State
  const [creatingWorkTitle, setCreatingWorkTitle] = useState<string | null>(null);
  const [createdWorkTitles, setCreatedWorkTitles] = useState<Set<string>>(new Set());
  const [workCreateError, setWorkCreateError] = useState<string | null>(null);

  const hasGa4 = !!ga4PropertyId;
  const hasCompanySearchConsole = !!searchConsoleSiteUrl;
  // Always try to fetch GSC data - API will use fallback if company doesn't have its own URL
  const hasSearchConsole = true;
  const hasAnyConnection = hasGa4 || hasCompanySearchConsole;

  // Convert activeDays to preset
  const getPreset = (days: number): CompanyAnalyticsDateRangePreset => {
    if (days === 7) return '7d';
    if (days === 90) return '90d';
    return '30d';
  };

  // Fetch unified company AI insights
  const fetchCompanyInsights = async (days: number) => {
    setCompanyInsightsLoading(true);
    setCompanyInsightsError(null);

    try {
      const preset = getPreset(days);
      const response = await fetch(
        `/api/os/companies/${companyId}/analytics/ai-insights?range=${preset}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch company insights');
      }

      const data = await response.json();
      if (data.ok) {
        setCompanyInsights(data.insights);
        setCompanyInput(data.input);
      } else {
        throw new Error(data.error || 'Failed to generate insights');
      }
    } catch (err) {
      console.error('Error fetching company insights:', err);
      setCompanyInsightsError(err instanceof Error ? err.message : 'Failed to load insights');
    } finally {
      setCompanyInsightsLoading(false);
    }
  };

  // Fetch GA4 analytics data
  const fetchAnalytics = async (days: number) => {
    if (!hasGa4) return;

    setLoading(true);
    setError(null);

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const start = startDate.toISOString().split('T')[0];
      const end = endDate.toISOString().split('T')[0];

      const response = await fetch(
        `/api/analytics/company/${companyId}?start=${start}&end=${end}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const data = await response.json();
      setSnapshot(data.snapshot);
    } catch (err) {
      console.error('Error fetching company analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Search Console data
  const fetchSearchConsoleData = async (days: number) => {
    if (!hasSearchConsole) return;

    setGscLoading(true);
    setGscError(null);

    try {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - 3); // GSC has 2-3 day delay
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - days);

      const start = startDate.toISOString().split('T')[0];
      const end = endDate.toISOString().split('T')[0];

      const response = await fetch(
        `/api/os/analytics/search-console/company/${companyId}?start=${start}&end=${end}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch Search Console data');
      }

      const data = await response.json();
      setGscSnapshot(data.snapshot);

      // Fetch AI insights for the snapshot
      fetchSearchInsights(data.snapshot);
    } catch (err) {
      console.error('Error fetching Search Console data:', err);
      setGscError(err instanceof Error ? err.message : 'Failed to load Search Console data');
    } finally {
      setGscLoading(false);
    }
  };

  // Fetch AI Search Insights
  const fetchSearchInsights = async (snapshot: SearchConsoleSnapshot) => {
    setInsightsLoading(true);

    try {
      const response = await fetch('/api/os/analytics/search-console/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate insights');
      }

      const data = await response.json();
      setSearchInsights(data.insights);
    } catch (err) {
      console.warn('Error fetching AI insights:', err);
    } finally {
      setInsightsLoading(false);
    }
  };

  useEffect(() => {
    // Always fetch company insights (it works with any available data)
    fetchCompanyInsights(activeDays);

    if (hasGa4) {
      fetchAnalytics(activeDays);
    }
    if (hasSearchConsole) {
      fetchSearchConsoleData(activeDays);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const handleRangeChange = (days: number) => {
    setActiveDays(days);
    fetchCompanyInsights(days);
    if (hasGa4) fetchAnalytics(days);
    if (hasSearchConsole) fetchSearchConsoleData(days);
  };

  // Handle creating a work item from a suggestion
  const handleCreateWorkFromSuggestion = async (suggestion: CompanyAnalyticsWorkSuggestion) => {
    if (creatingWorkTitle) return; // Already creating one

    setCreatingWorkTitle(suggestion.title);
    setWorkCreateError(null);

    try {
      const res = await fetch('/api/os/work/from-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          suggestion,
        }),
      });

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Failed to create work item');
      }

      // Mark as created
      setCreatedWorkTitles((prev) => new Set(prev).add(suggestion.title));
    } catch (err) {
      console.error('Error creating work item:', err);
      setWorkCreateError(err instanceof Error ? err.message : 'Failed to create work item');
    } finally {
      setCreatingWorkTitle(null);
    }
  };

  // No connections - show setup UI
  if (!hasAnyConnection) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <div className="text-center py-12">
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
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-slate-300 mb-2">
            Connect Analytics
          </h3>
          <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
            Connect this company's GA4 property or Search Console to see
            traffic, conversions, and SEO performance.
          </p>
          <p className="text-xs text-slate-600">
            Add GA4 Property ID or Search Console URL in the company settings.
          </p>
        </div>
      </div>
    );
  }

  // Helper to format date range for display
  const formatDateRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  return (
    <div className="space-y-6">
      {/* Header Meta */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Left: Company Name + Date Range + Data Sources */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-100">{companyName}</h2>
              <span className="text-sm text-slate-400">{formatDateRange(activeDays)}</span>
            </div>
            <div className="flex items-center gap-3">
              {hasGa4 && (
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  <span className="text-xs text-slate-400">GA4</span>
                </div>
              )}
              {hasSearchConsole && (
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                  <span className="text-xs text-slate-400">Search Console</span>
                </div>
              )}
              {!hasGa4 && (
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-slate-600 rounded-full" />
                  <span className="text-xs text-slate-500">GA4 not connected</span>
                </div>
              )}
              {!hasSearchConsole && (
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-slate-600 rounded-full" />
                  <span className="text-xs text-slate-500">GSC not connected</span>
                </div>
              )}
            </div>
          </div>
          {/* Right: Date Range Buttons */}
          <div className="flex items-center gap-2">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                onClick={() => handleRangeChange(days)}
                disabled={loading || gscLoading}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeDays === days
                    ? 'bg-amber-500 text-slate-900'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {days}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="border-b border-slate-800">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveSection('overview')}
            className={`py-2 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeSection === 'overview'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveSection('charts')}
            className={`py-2 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeSection === 'charts'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Charts
            {!analyticsBlueprint && (
              <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">NEW</span>
            )}
          </button>
          {hasGa4 && (
            <button
              onClick={() => setActiveSection('traffic')}
              className={`py-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeSection === 'traffic'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              Traffic
            </button>
          )}
          {hasSearchConsole && (
            <button
              onClick={() => setActiveSection('search')}
              className={`py-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeSection === 'search'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              Search
            </button>
          )}
        </nav>
      </div>

      {/* Overview Section - Unified AI Insights */}
      {activeSection === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - KPI Cards and Data Summary */}
          <div className="lg:col-span-2 space-y-6">
            {/* Loading State */}
            {companyInsightsLoading && (
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
                <p className="text-slate-400 mt-4">Analyzing {companyName}'s data...</p>
              </div>
            )}

            {/* Error State */}
            {companyInsightsError && !companyInsightsLoading && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
                <p className="text-red-400">{companyInsightsError}</p>
                <button
                  onClick={() => fetchCompanyInsights(activeDays)}
                  className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* KPI Cards Grid - Show from raw data OR from AI input */}
            {!companyInsightsLoading && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {/* GA4 Metrics */}
                {hasGa4 ? (
                  <>
                    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
                      <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Sessions</div>
                      <div className="text-2xl font-bold text-slate-100">
                        {loading ? (
                          <span className="inline-block w-16 h-7 bg-slate-700 rounded animate-pulse" />
                        ) : (
                          (companyInput?.ga4?.sessions ?? snapshot?.traffic.sessions)?.toLocaleString() ?? '—'
                        )}
                      </div>
                      <div className="text-xs text-emerald-400 mt-1">GA4 • {activeDays}d</div>
                    </div>
                    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
                      <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Users</div>
                      <div className="text-2xl font-bold text-slate-100">
                        {loading ? (
                          <span className="inline-block w-16 h-7 bg-slate-700 rounded animate-pulse" />
                        ) : (
                          (companyInput?.ga4?.users ?? snapshot?.traffic.users)?.toLocaleString() ?? '—'
                        )}
                      </div>
                      <div className="text-xs text-emerald-400 mt-1">GA4</div>
                    </div>
                  </>
                ) : (
                  <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 col-span-2">
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">GA4</div>
                    <div className="text-sm text-slate-400">Not connected</div>
                  </div>
                )}

                {/* Search Console Metrics */}
                {hasSearchConsole ? (
                  <>
                    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
                      <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Search Clicks</div>
                      <div className="text-2xl font-bold text-slate-100">
                        {gscLoading ? (
                          <span className="inline-block w-16 h-7 bg-slate-700 rounded animate-pulse" />
                        ) : (
                          (companyInput?.searchConsole?.clicks ?? gscSnapshot?.summary.clicks)?.toLocaleString() ?? '—'
                        )}
                      </div>
                      <div className="text-xs text-blue-400 mt-1">GSC • {activeDays}d</div>
                    </div>
                    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
                      <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Avg Position</div>
                      <div className="text-2xl font-bold text-slate-100">
                        {gscLoading ? (
                          <span className="inline-block w-12 h-7 bg-slate-700 rounded animate-pulse" />
                        ) : (
                          (companyInput?.searchConsole?.avgPosition ?? gscSnapshot?.summary.avgPosition)?.toFixed(1) ?? '—'
                        )}
                      </div>
                      <div className="text-xs text-blue-400 mt-1">
                        CTR: {gscLoading ? '...' : (
                          (companyInput?.searchConsole?.ctr ?? gscSnapshot?.summary.ctr) != null
                            ? ((companyInput?.searchConsole?.ctr ?? gscSnapshot?.summary.ctr)! * 100).toFixed(1) + '%'
                            : '—'
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 col-span-2">
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Search Console</div>
                    <div className="text-sm text-slate-400">Not connected</div>
                  </div>
                )}
              </div>
            )}

            {/* Work & GAP Summary - Only shown after AI runs */}
            {companyInput && !companyInsightsLoading && (
              <>
                {/* Work & GAP Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Work Summary */}
                  <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-3">Work Status</div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-2xl font-bold text-slate-100">
                          {companyInput.work.activeCount}
                        </div>
                        <div className="text-xs text-slate-400">Active</div>
                      </div>
                      <div>
                        <div className={`text-2xl font-bold ${companyInput.work.dueToday > 0 ? 'text-amber-400' : 'text-slate-100'}`}>
                          {companyInput.work.dueToday}
                        </div>
                        <div className="text-xs text-slate-400">Due Today</div>
                      </div>
                      <div>
                        <div className={`text-2xl font-bold ${companyInput.work.overdue > 0 ? 'text-red-400' : 'text-slate-100'}`}>
                          {companyInput.work.overdue}
                        </div>
                        <div className="text-xs text-slate-400">Overdue</div>
                      </div>
                    </div>
                  </div>

                  {/* GAP Summary with Nudges */}
                  <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-3">GAP & Diagnostics</div>
                    <div className="space-y-2">
                      {companyInput.gapDiagnostics.lastGapAssessmentAt ? (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-400">Last GAP</span>
                            <span className="text-sm text-slate-200">
                              {new Date(companyInput.gapDiagnostics.lastGapAssessmentAt).toLocaleDateString()}
                            </span>
                          </div>
                          {/* Check if GAP is stale (>90 days) */}
                          {(() => {
                            const daysSinceGap = Math.floor(
                              (Date.now() - new Date(companyInput.gapDiagnostics.lastGapAssessmentAt!).getTime()) /
                                (1000 * 60 * 60 * 24)
                            );
                            if (daysSinceGap > 90) {
                              return (
                                <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                                  <div className="text-xs text-amber-300 mb-1">
                                    GAP assessment is {daysSinceGap} days old
                                  </div>
                                  <a
                                    href={`/c/${companyId}/gap`}
                                    className="text-xs text-amber-400 hover:text-amber-300 underline"
                                  >
                                    Run new GAP assessment →
                                  </a>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </>
                      ) : (
                        <div className="p-2 bg-slate-800/50 border border-slate-700 rounded-lg">
                          <div className="text-sm text-slate-400 mb-1">No GAP assessment on record</div>
                          <a
                            href={`/c/${companyId}/gap`}
                            className="text-xs text-amber-400 hover:text-amber-300 underline"
                          >
                            Run initial GAP assessment →
                          </a>
                        </div>
                      )}
                      {companyInput.gapDiagnostics.lastGapScore !== undefined && companyInput.gapDiagnostics.lastGapScore !== null && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-400">Score</span>
                          <span className="text-sm text-amber-400 font-medium">
                            {companyInput.gapDiagnostics.lastGapScore}/100
                          </span>
                        </div>
                      )}
                      {companyInput.gapDiagnostics.recentDiagnosticsCount !== undefined && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-400">Diagnostics (30d)</span>
                          <span className="text-sm text-slate-200">
                            {companyInput.gapDiagnostics.recentDiagnosticsCount}
                          </span>
                        </div>
                      )}
                      {/* Nudge if no recent diagnostics */}
                      {(companyInput.gapDiagnostics.recentDiagnosticsCount === 0 || companyInput.gapDiagnostics.recentDiagnosticsCount === undefined) && (
                        <div className="mt-2 p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                          <div className="text-xs text-blue-300 mb-1">
                            No recent diagnostics run
                          </div>
                          <a
                            href={`/c/${companyId}/diagnostics`}
                            className="text-xs text-blue-400 hover:text-blue-300 underline"
                          >
                            Run diagnostics →
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Wins */}
                {companyInsights && companyInsights.quickWins.length > 0 && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-emerald-300 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Quick Wins
                    </h3>
                    <ul className="space-y-2">
                      {companyInsights.quickWins.slice(0, 4).map((win, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-emerald-100">
                          <span className="text-emerald-400 mt-0.5">•</span>
                          <span>{win}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Suggested Work Items */}
                {companyInsights && companyInsights.workSuggestions.length > 0 && (
                  <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-slate-800">
                      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                        Suggested Work Items
                      </h3>
                    </div>
                    <div className="divide-y divide-slate-800">
                      {companyInsights.workSuggestions.map((item, idx) => {
                        const isCreating = creatingWorkTitle === item.title;
                        const isCreated = createdWorkTitles.has(item.title);

                        return (
                          <div key={idx} className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  {item.recommendedPriority && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-600 text-slate-200 font-mono">
                                      #{item.recommendedPriority}
                                    </span>
                                  )}
                                  <span className={`text-xs px-2 py-0.5 rounded ${
                                    item.priority === 'high'
                                      ? 'bg-red-500/20 text-red-300'
                                      : item.priority === 'medium'
                                      ? 'bg-amber-500/20 text-amber-300'
                                      : 'bg-slate-500/20 text-slate-300'
                                  }`}>
                                    {item.priority}
                                  </span>
                                  <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                                    {item.area}
                                  </span>
                                  {item.impact && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                                      item.impact === 'high'
                                        ? 'bg-emerald-500/20 text-emerald-300'
                                        : item.impact === 'medium'
                                        ? 'bg-blue-500/20 text-blue-300'
                                        : 'bg-slate-500/20 text-slate-400'
                                    }`}>
                                      {item.impact} impact
                                    </span>
                                  )}
                                </div>
                                <div className="font-medium text-slate-200">{item.title}</div>
                                <div className="text-sm text-slate-400 mt-1">{item.description}</div>
                                {item.reason && (
                                  <div className="text-xs text-slate-500 mt-2 italic">
                                    Why: {item.reason}
                                  </div>
                                )}
                              </div>
                              <div className="flex-shrink-0">
                                {isCreated ? (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Added
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleCreateWorkFromSuggestion(item)}
                                    disabled={!!creatingWorkTitle}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                      isCreating
                                        ? 'bg-slate-700 text-slate-400 cursor-wait'
                                        : 'bg-amber-500 hover:bg-amber-400 text-slate-900'
                                    }`}
                                  >
                                    {isCreating ? 'Adding...' : 'Add as Work Item →'}
                                  </button>
                                )}
                              </div>
                            </div>
                            {workCreateError && creatingWorkTitle === null && idx === 0 && (
                              <div className="mt-2 text-xs text-red-400">{workCreateError}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Experiments */}
                {companyInsights && companyInsights.experiments.length > 0 && (
                  <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-slate-800">
                      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                        Experiments to Run
                      </h3>
                    </div>
                    <div className="divide-y divide-slate-800">
                      {companyInsights.experiments.map((exp, idx) => (
                        <div key={idx} className="p-4">
                          <div className="flex items-start gap-3">
                            {/* Experiment Number */}
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                              <span className="text-sm font-bold text-purple-300">{idx + 1}</span>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-purple-200">{exp.name}</span>
                                {exp.expectedImpact && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                                    exp.expectedImpact === 'high'
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : exp.expectedImpact === 'medium'
                                      ? 'bg-amber-500/20 text-amber-300'
                                      : 'bg-slate-500/20 text-slate-300'
                                  }`}>
                                    {exp.expectedImpact} impact
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-slate-400 mt-1">{exp.hypothesis}</div>
                              {exp.steps.length > 0 && (
                                <ol className="list-decimal list-inside text-sm text-slate-500 mt-2 space-y-1">
                                  {exp.steps.map((step, stepIdx) => (
                                    <li key={stepIdx}>{step}</li>
                                  ))}
                                </ol>
                              )}
                              <div className="text-xs text-purple-400 mt-2">
                                Success: {exp.successMetric}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* AI Insights Sidebar */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-6 sticky top-6">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.477.859h4z" />
                </svg>
                <h2 className="text-lg font-semibold text-amber-100">Hive OS Insight</h2>
              </div>

              {companyInsightsLoading && (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
                  <p className="text-amber-200 text-sm mt-3">Generating insights...</p>
                </div>
              )}

              {!companyInsightsLoading && !companyInsights && (
                <p className="text-sm text-amber-200/70">
                  Insights will appear once data is loaded.
                </p>
              )}

              {companyInsights && !companyInsightsLoading && (
                <div className="space-y-5">
                  {/* Summary */}
                  <div className="text-sm text-amber-100 leading-relaxed whitespace-pre-line">
                    {companyInsights.summary}
                  </div>

                  {/* Key Insights */}
                  {companyInsights.keyInsights.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-amber-100 mb-2">Key Insights</h3>
                      <div className="space-y-2">
                        {companyInsights.keyInsights.slice(0, 5).map((insight, idx) => (
                          <div
                            key={idx}
                            className={`border rounded p-3 ${
                              insight.type === 'traffic'
                                ? 'bg-emerald-500/10 border-emerald-500/30'
                                : insight.type === 'search'
                                ? 'bg-blue-500/10 border-blue-500/30'
                                : insight.type === 'conversion' || insight.type === 'funnel'
                                ? 'bg-purple-500/10 border-purple-500/30'
                                : insight.type === 'engagement'
                                ? 'bg-orange-500/10 border-orange-500/30'
                                : 'bg-slate-900/50 border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded ${
                                  insight.type === 'traffic'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : insight.type === 'search'
                                    ? 'bg-blue-500/20 text-blue-300'
                                    : insight.type === 'conversion' || insight.type === 'funnel'
                                    ? 'bg-purple-500/20 text-purple-300'
                                    : insight.type === 'engagement'
                                    ? 'bg-orange-500/20 text-orange-300'
                                    : 'bg-slate-500/20 text-slate-300'
                                }`}
                              >
                                {insight.type}
                              </span>
                              {insight.category && insight.category !== insight.type && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400">
                                  {insight.category}
                                </span>
                              )}
                            </div>
                            <div className="font-medium text-slate-200 text-sm">{insight.title}</div>
                            <div className="text-xs text-slate-400 mt-1">{insight.detail}</div>
                            {insight.evidence && (
                              <div className="text-xs text-slate-500 mt-1 italic">{insight.evidence}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Charts Section - Blueprint-driven analytics */}
      {activeSection === 'charts' && (
        <BlueprintChartsView
          companyId={companyId}
          companyName={companyName}
          initialBlueprint={analyticsBlueprint}
          activeDays={activeDays}
        />
      )}

      {/* Traffic Analytics Section (GA4) */}
      {activeSection === 'traffic' && hasGa4 && (
        <>
          {/* Loading State */}
          {loading && (
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
              <p className="text-slate-400 mt-4">Loading traffic analytics...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
              <p className="text-red-400">{error}</p>
              <button
                onClick={() => fetchAnalytics(activeDays)}
                className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
              >
                Try Again
              </button>
            </div>
          )}

          {/* GA4 Analytics Data */}
          {snapshot && !loading && (
            <>
              {/* Traffic Overview */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
                  Traffic Overview
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Users</div>
                    <div className="text-2xl font-bold text-slate-100">
                      {snapshot.traffic.users?.toLocaleString() ?? '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Sessions</div>
                    <div className="text-2xl font-bold text-slate-100">
                      {snapshot.traffic.sessions?.toLocaleString() ?? '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Pageviews</div>
                    <div className="text-2xl font-bold text-slate-100">
                      {snapshot.traffic.pageviews?.toLocaleString() ?? '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Avg Session</div>
                    <div className="text-2xl font-bold text-slate-100">
                      {snapshot.traffic.avgSessionDurationSeconds
                        ? `${Math.round(snapshot.traffic.avgSessionDurationSeconds)}s`
                        : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Bounce Rate</div>
                    <div className="text-2xl font-bold text-slate-100">
                      {snapshot.traffic.bounceRate
                        ? `${(snapshot.traffic.bounceRate * 100).toFixed(1)}%`
                        : '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Channels */}
              {snapshot.channels.length > 0 && (
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-slate-800">
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                      Traffic by Channel
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/50">
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Channel</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Sessions</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Users</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Conversions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {snapshot.channels.slice(0, 8).map((channel, idx) => (
                          <tr key={idx} className="border-b border-slate-800/50 last:border-0">
                            <td className="px-4 py-2 text-slate-200 font-medium">{channel.channel}</td>
                            <td className="px-4 py-2 text-right text-slate-300">{channel.sessions.toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-slate-300">{channel.users?.toLocaleString() ?? '—'}</td>
                            <td className="px-4 py-2 text-right text-slate-300">{channel.conversions?.toLocaleString() ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Top Landing Pages */}
              {snapshot.topLandingPages.length > 0 && (
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-slate-800">
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                      Top Landing Pages
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/50">
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Page</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Sessions</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Conversions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {snapshot.topLandingPages.slice(0, 8).map((page, idx) => (
                          <tr key={idx} className="border-b border-slate-800/50 last:border-0">
                            <td className="px-4 py-2 text-slate-200 font-mono text-xs truncate max-w-xs">{page.path}</td>
                            <td className="px-4 py-2 text-right text-slate-300">{page.sessions.toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-slate-300">{page.conversions?.toLocaleString() ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Search Analytics Section */}
      {activeSection === 'search' && hasSearchConsole && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Loading State */}
            {gscLoading && (
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
                <p className="text-slate-400 mt-4">Loading Search Console data...</p>
              </div>
            )}

            {/* Error State */}
            {gscError && !gscLoading && (
              <div className={`${gscError.includes('not configured') ? 'bg-slate-800/50 border-slate-700' : 'bg-red-500/10 border-red-500/30'} border rounded-xl p-6 text-center`}>
                <p className={gscError.includes('not configured') ? 'text-slate-400' : 'text-red-400'}>
                  {gscError.includes('not configured')
                    ? 'Search Console is not configured for this company.'
                    : gscError}
                </p>
                {gscError.includes('not configured') ? (
                  <p className="text-slate-500 text-sm mt-2">
                    Add a Search Console Site URL to the company record in Airtable to enable search analytics.
                  </p>
                ) : (
                  <button
                    onClick={() => fetchSearchConsoleData(activeDays)}
                    className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
                  >
                    Try Again
                  </button>
                )}
              </div>
            )}

            {/* Search Console Data */}
            {gscSnapshot && !gscLoading && (
              <>
                {/* Summary Metrics */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
                  <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
                    Search Performance
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Clicks</div>
                      <div className="text-2xl font-bold text-slate-100">
                        {gscSnapshot.summary.clicks.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Impressions</div>
                      <div className="text-2xl font-bold text-slate-100">
                        {gscSnapshot.summary.impressions.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Avg CTR</div>
                      <div className="text-2xl font-bold text-slate-100">
                        {(gscSnapshot.summary.ctr * 100).toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Avg Position</div>
                      <div className="text-2xl font-bold text-slate-100">
                        {gscSnapshot.summary.avgPosition?.toFixed(1) ?? '—'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top Queries */}
                {gscSnapshot.topQueries.length > 0 && (
                  <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-slate-800">
                      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                        Top Search Queries
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-800 bg-slate-900/50">
                            <th className="text-left px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Query</th>
                            <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Clicks</th>
                            <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Impressions</th>
                            <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">CTR</th>
                            <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Position</th>
                          </tr>
                        </thead>
                        <tbody>
                          {gscSnapshot.topQueries.slice(0, 15).map((query, idx) => (
                            <tr key={idx} className="border-b border-slate-800/50 last:border-0">
                              <td className="px-4 py-2 text-slate-200">{query.query}</td>
                              <td className="px-4 py-2 text-right text-slate-300">{query.clicks.toLocaleString()}</td>
                              <td className="px-4 py-2 text-right text-slate-300">{query.impressions.toLocaleString()}</td>
                              <td className="px-4 py-2 text-right text-slate-300">{(query.ctr * 100).toFixed(2)}%</td>
                              <td className="px-4 py-2 text-right text-slate-300">{query.avgPosition?.toFixed(1) ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Top Pages */}
                {gscSnapshot.topPages.length > 0 && (
                  <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-slate-800">
                      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                        Top Pages in Search
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-800 bg-slate-900/50">
                            <th className="text-left px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Page</th>
                            <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Clicks</th>
                            <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Impressions</th>
                            <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">CTR</th>
                            <th className="text-right px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Position</th>
                          </tr>
                        </thead>
                        <tbody>
                          {gscSnapshot.topPages.slice(0, 10).map((page, idx) => (
                            <tr key={idx} className="border-b border-slate-800/50 last:border-0">
                              <td className="px-4 py-2 text-slate-200 font-mono text-xs truncate max-w-xs">
                                {page.url.replace(/^https?:\/\/[^/]+/, '')}
                              </td>
                              <td className="px-4 py-2 text-right text-slate-300">{page.clicks.toLocaleString()}</td>
                              <td className="px-4 py-2 text-right text-slate-300">{page.impressions.toLocaleString()}</td>
                              <td className="px-4 py-2 text-right text-slate-300">{(page.ctr * 100).toFixed(2)}%</td>
                              <td className="px-4 py-2 text-right text-slate-300">{page.avgPosition?.toFixed(1) ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Device Breakdown */}
                {gscSnapshot.topDevices.length > 0 && (
                  <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
                      Performance by Device
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {gscSnapshot.topDevices.map((device, idx) => (
                        <div key={idx} className="bg-slate-800/50 rounded-lg p-4">
                          <div className="text-xs text-slate-500 mb-1">{device.device}</div>
                          <div className="text-lg font-bold text-slate-100">
                            {device.clicks.toLocaleString()} clicks
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            CTR: {(device.ctr * 100).toFixed(2)}% | Pos: {device.avgPosition?.toFixed(1) ?? '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* AI Insights Sidebar */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-6 sticky top-6">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.477.859h4z" />
                </svg>
                <h2 className="text-lg font-semibold text-amber-100">Search Insights</h2>
              </div>

              {insightsLoading && (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
                  <p className="text-amber-200 text-sm mt-3">Analyzing search data...</p>
                </div>
              )}

              {!insightsLoading && !searchInsights && !gscSnapshot && (
                <p className="text-sm text-amber-200/70">
                  Search insights will appear once Search Console data loads.
                </p>
              )}

              {searchInsights && !insightsLoading && (
                <div className="space-y-5">
                  {/* Summary */}
                  <div className="text-sm text-amber-100 leading-relaxed whitespace-pre-line">
                    {searchInsights.summary}
                  </div>

                  {/* Quick Wins */}
                  {searchInsights.quickWins.length > 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-amber-300 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 10V3L4 14h7v7l9-11h-7z"
                          />
                        </svg>
                        Quick Wins
                      </h3>
                      <ul className="space-y-2">
                        {searchInsights.quickWins.slice(0, 4).map((win, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-amber-100">
                            <span className="text-amber-400 mt-0.5">•</span>
                            <span>{win}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Key Insights */}
                  {searchInsights.keyInsights.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-amber-100 mb-2">Key Insights</h3>
                      <div className="space-y-2">
                        {searchInsights.keyInsights.slice(0, 4).map((insight, idx) => (
                          <div
                            key={idx}
                            className={`border rounded p-3 ${
                              insight.type === 'opportunity'
                                ? 'bg-emerald-500/10 border-emerald-500/30'
                                : insight.type === 'warning'
                                ? 'bg-red-500/10 border-red-500/30'
                                : 'bg-slate-900/50 border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded ${
                                  insight.type === 'opportunity'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : insight.type === 'warning'
                                    ? 'bg-red-500/20 text-red-300'
                                    : 'bg-slate-500/20 text-slate-300'
                                }`}
                              >
                                {insight.type}
                              </span>
                            </div>
                            <div className="font-medium text-slate-200 text-sm">{insight.title}</div>
                            <div className="text-xs text-slate-400 mt-1">{insight.detail}</div>
                            {insight.evidence && (
                              <div className="text-xs text-slate-500 mt-1 italic">{insight.evidence}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Experiments */}
                  {searchInsights.experiments.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-amber-100 mb-2">Experiments</h3>
                      <div className="space-y-2">
                        {searchInsights.experiments.slice(0, 2).map((exp, idx) => (
                          <div
                            key={idx}
                            className="bg-purple-500/10 border border-purple-500/30 rounded p-3"
                          >
                            <div className="font-medium text-purple-200 text-sm">{exp.name}</div>
                            <div className="text-xs text-purple-300/70 mt-1">{exp.hypothesis}</div>
                            <div className="text-xs text-purple-300/50 mt-1">
                              Success: {exp.successMetric}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search Console Not Configured Message */}
      {!hasSearchConsole && hasGa4 && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-1">
                Search Console Not Connected
              </h4>
              <p className="text-sm text-slate-500">
                Add the Search Console site URL in company settings to enable Search Analytics
                and AI-powered SEO insights for {companyName}.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
