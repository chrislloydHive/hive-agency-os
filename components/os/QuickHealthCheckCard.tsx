'use client';

// components/os/QuickHealthCheckCard.tsx
// Quick Health Check card for the Company Overview header
//
// Displays overall health status with primary issue and recommended next step.
// Runs a lightweight health check that refreshes scores, trends, and alerts.

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { QuickHealthCheckResult, QuickHealthStatus } from '@/lib/os/companies/healthCheck';

// ============================================================================
// Types
// ============================================================================

interface QuickHealthCheckCardProps {
  companyId: string;
  companyName: string;
  lastHealthCheck?: QuickHealthCheckResult | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getStatusStyles(status: QuickHealthStatus): {
  bg: string;
  text: string;
  border: string;
  iconBg: string;
} {
  switch (status) {
    case 'healthy':
      return {
        bg: 'bg-emerald-500/20',
        text: 'text-emerald-300',
        border: 'border-emerald-500/30',
        iconBg: 'bg-emerald-500/20',
      };
    case 'watching':
      return {
        bg: 'bg-amber-500/20',
        text: 'text-amber-300',
        border: 'border-amber-500/30',
        iconBg: 'bg-amber-500/20',
      };
    case 'at_risk':
      return {
        bg: 'bg-red-500/20',
        text: 'text-red-300',
        border: 'border-red-500/30',
        iconBg: 'bg-red-500/20',
      };
  }
}

function getStatusLabel(status: QuickHealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'Healthy';
    case 'watching':
      return 'Watching';
    case 'at_risk':
      return 'At Risk';
  }
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

// ============================================================================
// Component
// ============================================================================

export default function QuickHealthCheckCard({
  companyId,
  companyName,
  lastHealthCheck,
}: QuickHealthCheckCardProps) {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<QuickHealthCheckResult | null>(lastHealthCheck ?? null);
  const [error, setError] = useState<string | null>(null);

  const handleRunHealthCheck = useCallback(async () => {
    setIsRunning(true);
    setError(null);

    try {
      const response = await fetch(`/api/os/companies/${companyId}/health-check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reuseRecentGapSnapshot: false, // Force fresh check when manually triggered
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Health check failed');
      }

      setResult(data.result);

      // Refresh the page to update all server components (Strategic Snapshot, Trends, Alerts)
      router.refresh();
    } catch (err) {
      console.error('[QuickHealthCheck] Error:', err);
      setError(err instanceof Error ? err.message : 'Health check failed');
    } finally {
      setIsRunning(false);
    }
  }, [companyId, router]);

  const statusStyles = result ? getStatusStyles(result.status) : null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      {/* Header with Title and Status Pill */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-slate-100">
              Quick Health Check
            </h3>
            {result && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusStyles?.bg} ${statusStyles?.text} ${statusStyles?.border}`}
              >
                {getStatusLabel(result.status)}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Lightweight snapshot across GAP, website, analytics, and alerts
          </p>
        </div>

        {/* Status Icon */}
        {result && (
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${statusStyles?.iconBg}`}
          >
            {result.status === 'healthy' && (
              <svg
                className={`w-5 h-5 ${statusStyles?.text}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
            {result.status === 'watching' && (
              <svg
                className={`w-5 h-5 ${statusStyles?.text}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            )}
            {result.status === 'at_risk' && (
              <svg
                className={`w-5 h-5 ${statusStyles?.text}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            )}
          </div>
        )}
      </div>

      {/* Primary Issue & Next Step */}
      {result && (result.primaryIssue || result.recommendedNextStep) && (
        <div className="mb-3 p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
          {result.primaryIssue && (
            <p className="text-xs text-slate-200 mb-1">
              <span className="text-slate-400">Main issue:</span>{' '}
              <span className="font-medium">{result.primaryIssue}</span>
            </p>
          )}
          {result.recommendedNextStep && (
            <p className="text-xs text-slate-400">
              <span className="text-slate-500">Next step:</span>{' '}
              {result.recommendedNextStep}
            </p>
          )}
        </div>
      )}

      {/* Metadata: Score, Alerts, Last Run */}
      {result && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mb-3">
          {result.overallScore !== null && (
            <span>
              Score:{' '}
              <span
                className={`font-medium ${
                  result.overallScore >= 70
                    ? 'text-emerald-400'
                    : result.overallScore >= 50
                    ? 'text-amber-400'
                    : 'text-red-400'
                }`}
              >
                {result.overallScore}
              </span>
            </span>
          )}
          <span>
            Alerts:{' '}
            <span
              className={`font-medium ${
                result.criticalAlertsCount > 0
                  ? 'text-red-400'
                  : result.alertsCount > 0
                  ? 'text-amber-400'
                  : 'text-slate-300'
              }`}
            >
              {result.alertsCount}
            </span>
            {result.criticalAlertsCount > 0 && (
              <span className="text-red-400 ml-0.5">
                ({result.criticalAlertsCount} critical)
              </span>
            )}
          </span>
          <span className="text-slate-500">
            Last run: {formatRelativeTime(result.createdAt)}
          </span>
        </div>
      )}

      {/* Running State */}
      {isRunning && (
        <div className="mb-3 flex items-center gap-2 p-2 rounded-lg bg-slate-800/50">
          <svg
            className="animate-spin h-4 w-4 text-blue-400"
            fill="none"
            viewBox="0 0 24 24"
          >
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
          <span className="text-xs text-blue-400">
            Checking health...
          </span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="mb-3 flex items-start gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <svg
            className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-xs text-red-400 flex-1">{error}</p>
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={handleRunHealthCheck}
        disabled={isRunning}
        className="w-full inline-flex items-center justify-center px-3 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isRunning ? (
          <>
            <svg
              className="animate-spin -ml-0.5 mr-2 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
            >
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
            Checking...
          </>
        ) : result ? (
          <>
            <svg
              className="w-4 h-4 mr-1.5"
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
            Refresh Check
          </>
        ) : (
          <>
            <svg
              className="w-4 h-4 mr-1.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Run Health Check
          </>
        )}
      </button>
    </div>
  );
}
