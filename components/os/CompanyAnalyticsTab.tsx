'use client';

// components/os/CompanyAnalyticsTab.tsx
// Analytics tab for company detail page - unified analytics using v2 service
//
// This component is a thin UI layer that:
// 1. Fetches a single CompanyAnalyticsSnapshot via the unified v2 API
// 2. Shares that snapshot across its subtabs (Overview, Charts, Traffic, Search)
// 3. Displays DMA/GAP funnels alongside GA4 + GSC metrics
// 4. No longer makes ad-hoc GA4 or GSC calls directly

import { useState, useEffect } from 'react';
import { useCompanyAnalytics, type AnalyticsDateRangePreset } from '@/hooks/useCompanyAnalytics';
import {
  AnalyticsOverviewSection,
  AnalyticsChartsSection,
  AnalyticsTrafficSection,
  AnalyticsSearchSection,
  AnalyticsFunnelSection,
} from '@/components/analytics/company';
import { BlueprintChartsView } from '@/components/analytics/BlueprintChartsView';
import { BlueprintPanel } from '@/components/os/blueprint';
import type { AnalyticsBlueprint } from '@/lib/analytics/blueprintTypes';

interface CompanyAnalyticsTabProps {
  companyId: string;
  companyName: string;
  ga4PropertyId?: string | null;
  searchConsoleSiteUrl?: string | null;
  analyticsBlueprint?: AnalyticsBlueprint | null;
}

type ActiveSection = 'overview' | 'charts' | 'traffic' | 'search' | 'funnel' | 'blueprint';

export function CompanyAnalyticsTab({
  companyId,
  companyName,
  ga4PropertyId,
  searchConsoleSiteUrl,
  analyticsBlueprint,
}: CompanyAnalyticsTabProps) {
  // UI state
  const [activeSection, setActiveSection] = useState<ActiveSection>('overview');
  const [dateRange, setDateRange] = useState<AnalyticsDateRangePreset>('30d');

  // Use the unified analytics hook
  const {
    snapshot,
    insights,
    isLoading,
    isLoadingInsights,
    error,
    insightsError,
    refresh,
    fetchInsights,
  } = useCompanyAnalytics(companyId, dateRange);

  // Fetch insights when overview is active and we have data
  useEffect(() => {
    if (activeSection === 'overview' && snapshot && !insights && !isLoadingInsights) {
      // Auto-fetch insights when viewing overview
      fetchInsights();
    }
  }, [activeSection, snapshot, insights, isLoadingInsights, fetchInsights]);

  // Derived connection states
  const hasGa4 = !!ga4PropertyId;
  const hasSearchConsole = !!searchConsoleSiteUrl;
  const hasAnyConnection = hasGa4 || hasSearchConsole;

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

  // Handle date range change
  const handleDateRangeChange = (range: AnalyticsDateRangePreset) => {
    setDateRange(range);
  };

  // Format date range for display
  const formatDateRangeDisplay = () => {
    if (!snapshot?.range) {
      return formatDateRangeFromPreset(dateRange);
    }
    const start = new Date(snapshot.range.startDate);
    const end = new Date(snapshot.range.endDate);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const activeDays = dateRange === '7d' ? 7 : dateRange === '90d' ? 90 : 30;

  return (
    <div className="space-y-6">
      {/* Header Meta */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Left: Company Name + Date Range + Data Sources */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-100">{companyName}</h2>
              <span className="text-sm text-slate-400">{formatDateRangeDisplay()}</span>
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
            {(['7d', '30d', '90d'] as AnalyticsDateRangePreset[]).map((range) => (
              <button
                key={range}
                onClick={() => handleDateRangeChange(range)}
                disabled={isLoading}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  dateRange === range
                    ? 'bg-amber-500 text-slate-900'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="border-b border-slate-800">
        <nav className="flex gap-4">
          <TabButton
            active={activeSection === 'overview'}
            onClick={() => setActiveSection('overview')}
          >
            Overview
          </TabButton>
          <TabButton
            active={activeSection === 'charts'}
            onClick={() => setActiveSection('charts')}
            icon={
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
            badge={!analyticsBlueprint ? 'NEW' : undefined}
          >
            Charts
          </TabButton>
          {hasGa4 && (
            <TabButton
              active={activeSection === 'traffic'}
              onClick={() => setActiveSection('traffic')}
            >
              Traffic
            </TabButton>
          )}
          {hasSearchConsole && (
            <TabButton
              active={activeSection === 'search'}
              onClick={() => setActiveSection('search')}
            >
              Search
            </TabButton>
          )}
          {hasGa4 && (
            <TabButton
              active={activeSection === 'funnel'}
              onClick={() => setActiveSection('funnel')}
              icon={
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              }
            >
              Funnel
            </TabButton>
          )}
          {hasGa4 && (
            <TabButton
              active={activeSection === 'blueprint'}
              onClick={() => setActiveSection('blueprint')}
              icon={
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
            >
              Blueprint
            </TabButton>
          )}
        </nav>
      </div>

      {/* Section Content */}
      {activeSection === 'overview' && (
        <AnalyticsOverviewSection
          snapshot={snapshot}
          insights={insights}
          isLoading={isLoading}
          isLoadingInsights={isLoadingInsights}
          error={error}
          onRetry={refresh}
          onFetchInsights={fetchInsights}
          companyId={companyId}
          onSectionChange={setActiveSection}
        />
      )}

      {activeSection === 'charts' && (
        analyticsBlueprint ? (
          <BlueprintChartsView
            companyId={companyId}
            companyName={companyName}
            initialBlueprint={analyticsBlueprint}
            activeDays={activeDays}
          />
        ) : (
          <AnalyticsChartsSection
            snapshot={snapshot}
            isLoading={isLoading}
            error={error}
            onRetry={refresh}
          />
        )
      )}

      {activeSection === 'traffic' && hasGa4 && (
        <AnalyticsTrafficSection
          snapshot={snapshot}
          isLoading={isLoading}
          error={error}
          onRetry={refresh}
        />
      )}

      {activeSection === 'search' && hasSearchConsole && (
        <AnalyticsSearchSection
          snapshot={snapshot}
          isLoading={isLoading}
          error={error}
          onRetry={refresh}
        />
      )}

      {activeSection === 'funnel' && hasGa4 && (
        <AnalyticsFunnelSection
          snapshot={snapshot}
          isLoading={isLoading}
          error={error}
          onRetry={refresh}
          companyId={companyId}
          companyName={companyName}
        />
      )}

      {activeSection === 'blueprint' && hasGa4 && (
        <BlueprintPanel
          sourceType="company"
          companyId={companyId}
          sourceName={companyName}
          period={dateRange === '7d' ? '7d' : dateRange === '90d' ? '90d' : '30d'}
          autoFetch={true}
          onCreateWorkItem={async (title, description, priority) => {
            // Create work item via company work API
            const response = await fetch('/api/os/work', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title,
                notes: description,
                companyId,
                area: 'Funnel',
                severity: priority === 'high' ? 'High' : priority === 'low' ? 'Low' : 'Medium',
                source: {
                  sourceType: 'funnel_insight',
                  funnelContext: 'company',
                  companyId,
                  companyName,
                  itemType: 'recommendation',
                },
              }),
            });
            if (!response.ok) {
              throw new Error('Failed to create work item');
            }
          }}
          onCreateExperiment={async (name, hypothesis, successMetric) => {
            // Create experiment
            const response = await fetch('/api/experiments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name,
                hypothesis,
                successMetric,
                status: 'Idea',
                area: 'Funnel',
                source: `${companyName} Blueprint`,
                sourceJson: {
                  sourceType: 'company_blueprint',
                  companyId,
                  companyName,
                },
              }),
            });
            const data = await response.json();
            if (!data.ok) {
              throw new Error(data.error || 'Failed to create experiment');
            }
          }}
        />
      )}

      {/* Search Console Not Configured Message (when only GA4 connected) */}
      {!hasSearchConsole && hasGa4 && activeSection === 'overview' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6 mt-6">
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

// Tab button component
function TabButton({
  active,
  onClick,
  children,
  icon,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`py-2 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
        active
          ? 'border-amber-500 text-amber-400'
          : 'border-transparent text-slate-400 hover:text-slate-300'
      }`}
    >
      {icon}
      {children}
      {badge && (
        <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">
          {badge}
        </span>
      )}
    </button>
  );
}

// Helper to format date range from preset
function formatDateRangeFromPreset(preset: AnalyticsDateRangePreset): string {
  const today = new Date();
  const end = new Date(today);
  const days = preset === '7d' ? 7 : preset === '90d' ? 90 : 30;
  const start = new Date(today);
  start.setDate(start.getDate() - days);

  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}
