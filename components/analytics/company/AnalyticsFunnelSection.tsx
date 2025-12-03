'use client';

// components/analytics/company/AnalyticsFunnelSection.tsx
// ============================================================================
// Company Funnel View - Client-specific funnels (not Hive DMA/GAP funnels)
// ============================================================================
//
// This component displays marketing funnels for a company using their GA4 data.
// It uses the StandardFunnelPanel component for consistent visual styling.
//
// NOTE: This component NO LONGER shows DMA/GAP funnels (those are Hive-specific
// internal product funnels). Instead, it shows the company's own marketing funnels
// based on their GA4 event data.

import type { CompanyAnalyticsSnapshot } from '@/lib/analytics/types';
import { ClientFunnelsPanel } from '@/components/analytics/ClientFunnelsPanel';

interface AnalyticsFunnelSectionProps {
  snapshot: CompanyAnalyticsSnapshot | null;
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
  companyId?: string;
  companyName?: string;
}

export function AnalyticsFunnelSection({
  snapshot,
  isLoading,
  error,
  onRetry,
  companyId,
  companyName,
}: AnalyticsFunnelSectionProps) {
  // Format date range label
  const dateRangeLabel = snapshot?.range
    ? `${new Date(snapshot.range.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(snapshot.range.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : undefined;

  // Error state
  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
        <p className="text-red-400">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  return (
    <ClientFunnelsPanel
      snapshot={snapshot}
      companyId={companyId || ''}
      companyName={companyName || 'Company'}
      isLoading={isLoading}
      dateRangeLabel={dateRangeLabel}
    />
  );
}
