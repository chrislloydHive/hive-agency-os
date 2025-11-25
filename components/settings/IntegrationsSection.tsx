'use client';

// components/settings/IntegrationsSection.tsx
// Integrations section with live status and OAuth connect buttons

import { useState, useEffect } from 'react';

interface IntegrationStatus {
  connected: boolean;
  source: 'workspace' | 'env' | 'none';
  propertyId?: string;
  siteUrl?: string;
  connectedAt?: string | null;
  provider?: string | null;
}

interface IntegrationsStatus {
  ga4: IntegrationStatus;
  gsc: IntegrationStatus;
  airtable: IntegrationStatus;
  ai: IntegrationStatus & { provider?: string | null };
}

export function IntegrationsSection() {
  const [status, setStatus] = useState<IntegrationsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check URL params for OAuth results
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gscConnected = params.get('gsc_connected');
    const gscError = params.get('gsc_error');

    if (gscConnected) {
      // Clean URL and show success
      window.history.replaceState({}, '', '/settings');
    }

    if (gscError) {
      setError(`Google Search Console connection failed: ${gscError}`);
      window.history.replaceState({}, '', '/settings');
    }
  }, []);

  // Fetch integration status
  useEffect(() => {
    async function fetchStatus() {
      try {
        const response = await fetch('/api/integrations/status');
        if (!response.ok) throw new Error('Failed to fetch status');
        const data = await response.json();
        setStatus(data);
      } catch (err) {
        console.error('Error fetching integration status:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStatus();
  }, []);

  const handleConnectGsc = () => {
    // Redirect to GSC OAuth start
    window.location.href = '/api/integrations/gsc/oauth/start';
  };

  const renderStatus = (integration: IntegrationStatus, showDetails = false) => {
    if (loading) {
      return (
        <span className="px-2 py-1 bg-slate-700/50 text-slate-400 text-xs rounded font-medium animate-pulse">
          Checking...
        </span>
      );
    }

    if (integration.connected) {
      return (
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded font-medium">
            Connected
          </span>
          {showDetails && integration.source === 'env' && (
            <span className="text-xs text-slate-500">(via env)</span>
          )}
        </div>
      );
    }

    return (
      <span className="px-2 py-1 bg-slate-700/50 text-slate-400 text-xs rounded font-medium">
        Not Connected
      </span>
    );
  };

  return (
    <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-slate-100 mb-6">
        Integrations
      </h2>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-xs text-red-500 hover:text-red-400 mt-1"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="space-y-4">
        {/* Airtable */}
        <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <svg
                className="w-5 h-5 text-blue-400"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-200">
                Airtable
              </div>
              <div className="text-xs text-slate-500">
                Database for companies, work items, and reports
              </div>
            </div>
          </div>
          {renderStatus(status?.airtable || { connected: false, source: 'none' })}
        </div>

        {/* Google Analytics 4 */}
        <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
              <svg
                className="w-5 h-5 text-amber-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-200">
                Google Analytics 4
              </div>
              <div className="text-xs text-slate-500">
                Traffic and conversion tracking for Growth Analytics
                {status?.ga4?.propertyId && (
                  <span className="ml-1 text-slate-400">
                    ({status.ga4.propertyId.replace('properties/', '')})
                  </span>
                )}
              </div>
            </div>
          </div>
          {renderStatus(status?.ga4 || { connected: false, source: 'none' }, true)}
        </div>

        {/* Search Console */}
        <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <svg
                className="w-5 h-5 text-purple-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-200">
                Google Search Console
              </div>
              <div className="text-xs text-slate-500">
                SEO performance and search query data
                {status?.gsc?.siteUrl && (
                  <span className="ml-1 text-slate-400">
                    ({status.gsc.siteUrl})
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {renderStatus(status?.gsc || { connected: false, source: 'none' }, true)}
            {!loading && !status?.gsc?.connected && (
              <button
                onClick={handleConnectGsc}
                className="text-sm text-amber-400 hover:text-amber-300 font-medium"
              >
                Connect
              </button>
            )}
          </div>
        </div>

        {/* AI Provider */}
        <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <svg
                className="w-5 h-5 text-emerald-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-200">
                AI Provider
                {status?.ai?.provider && (
                  <span className="ml-1 text-slate-400 font-normal">
                    ({status.ai.provider})
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500">
                Powers GAP assessments and AI briefings
              </div>
            </div>
          </div>
          {renderStatus(status?.ai || { connected: false, source: 'none' })}
        </div>
      </div>
    </section>
  );
}
