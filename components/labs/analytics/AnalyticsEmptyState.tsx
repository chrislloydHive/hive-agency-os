'use client';

// components/labs/analytics/AnalyticsEmptyState.tsx
// Empty state components for Analytics Lab

import Link from 'next/link';
import { BarChart3, Link2, AlertCircle, Plug } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface AnalyticsEmptyStateProps {
  companyId: string;
  variant: 'no_analytics' | 'partial' | 'error';
  connectedSources?: {
    ga4: boolean;
    gsc: boolean;
    gbp: boolean;
    media: boolean;
  };
  errorMessage?: string;
}

// ============================================================================
// Component
// ============================================================================

export function AnalyticsEmptyState({
  companyId,
  variant,
  connectedSources,
  errorMessage,
}: AnalyticsEmptyStateProps) {
  if (variant === 'error') {
    return <ErrorState errorMessage={errorMessage} />;
  }

  if (variant === 'partial' && connectedSources) {
    return (
      <PartialState
        companyId={companyId}
        connectedSources={connectedSources}
      />
    );
  }

  return <NoAnalyticsState companyId={companyId} />;
}

// ============================================================================
// No Analytics State
// ============================================================================

function NoAnalyticsState({ companyId }: { companyId: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
      <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
        <BarChart3 className="w-8 h-8 text-slate-400" />
      </div>

      <h3 className="text-lg font-semibold text-slate-200 mb-2">
        No analytics connected yet
      </h3>

      <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
        Connect your analytics sources to see performance insights, trends, and AI-powered recommendations.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
        <Link
          href={`/c/${companyId}/brain/setup?step=9`}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plug className="w-4 h-4" />
          Connect GA4 / Search Console
        </Link>

        <Link
          href={`/c/${companyId}/brain/context`}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg transition-colors"
        >
          <Link2 className="w-4 h-4" />
          Manage Integrations
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
        <IntegrationCard
          title="Google Analytics 4"
          description="Website traffic, conversions, and user behavior"
          icon="📊"
        />
        <IntegrationCard
          title="Search Console"
          description="Organic search performance and rankings"
          icon="🔍"
        />
        <IntegrationCard
          title="Google Business"
          description="Local search visibility and customer actions"
          icon="📍"
        />
      </div>
    </div>
  );
}

// ============================================================================
// Partial State
// ============================================================================

interface PartialStateProps {
  companyId: string;
  connectedSources: {
    ga4: boolean;
    gsc: boolean;
    gbp: boolean;
    media: boolean;
  };
}

function PartialState({ companyId, connectedSources }: PartialStateProps) {
  const connectedCount = Object.values(connectedSources).filter(Boolean).length;
  const totalSources = Object.keys(connectedSources).length;

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6">
      <div className="flex items-start gap-4">
        <div className="p-2 bg-amber-500/20 rounded-lg">
          <AlertCircle className="w-5 h-5 text-amber-400" />
        </div>

        <div className="flex-1">
          <h3 className="text-sm font-semibold text-slate-200 mb-1">
            Partial analytics coverage
          </h3>
          <p className="text-sm text-slate-400 mb-4">
            {connectedCount} of {totalSources} analytics sources are connected. Connect more sources for comprehensive insights.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <SourceStatus
              name="GA4"
              connected={connectedSources.ga4}
            />
            <SourceStatus
              name="Search Console"
              connected={connectedSources.gsc}
            />
            <SourceStatus
              name="Business Profile"
              connected={connectedSources.gbp}
            />
            <SourceStatus
              name="Media Program"
              connected={connectedSources.media}
            />
          </div>

          <Link
            href={`/c/${companyId}/brain/setup?step=9`}
            className="inline-flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors"
          >
            <Plug className="w-4 h-4" />
            Connect more sources
          </Link>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Error State
// ============================================================================

function ErrorState({ errorMessage }: { errorMessage?: string }) {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 text-center">
      <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="w-8 h-8 text-red-400" />
      </div>

      <h3 className="text-lg font-semibold text-slate-200 mb-2">
        Unable to refresh analytics data
      </h3>

      <p className="text-sm text-slate-400 max-w-md mx-auto mb-4">
        {errorMessage || 'There was an error fetching your analytics data. Please try again.'}
      </p>

      <p className="text-xs text-slate-500">
        If this problem persists, check your integration settings or contact support.
      </p>
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function IntegrationCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg text-left">
      <span className="text-2xl mb-2 block">{icon}</span>
      <h4 className="text-sm font-medium text-slate-200 mb-1">{title}</h4>
      <p className="text-xs text-slate-500">{description}</p>
    </div>
  );
}

function SourceStatus({
  name,
  connected,
}: {
  name: string;
  connected: boolean;
}) {
  return (
    <div className={`p-2 rounded-lg text-center ${
      connected
        ? 'bg-emerald-500/10 border border-emerald-500/30'
        : 'bg-slate-800/50 border border-slate-700/50'
    }`}>
      <div className={`w-2 h-2 rounded-full mx-auto mb-1 ${
        connected ? 'bg-emerald-400' : 'bg-slate-600'
      }`} />
      <span className={`text-xs ${connected ? 'text-emerald-400' : 'text-slate-500'}`}>
        {name}
      </span>
    </div>
  );
}
