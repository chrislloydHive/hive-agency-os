'use client';

// app/c/[companyId]/media/qbr/MediaQbrClient.tsx
// Media QBR Generator Client Component
//
// Provides UI for generating and viewing Media QBR presentations.
// Includes AnalyticsQbrSection for consistent performance metrics display.

import { useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
  Copy,
  Download,
  ArrowLeft,
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { MediaQbrOutput } from '@/lib/types/mediaQbr';
import type { AnalyticsLabSnapshot } from '@/lib/analytics/analyticsTypes';
import { AnalyticsQbrSection } from '@/components/reports/blocks/AnalyticsQbrSection';

// ============================================================================
// Types
// ============================================================================

interface MediaQbrClientProps {
  companyId: string;
  companyName: string;
  hasMediaProgram: boolean;
  hasAnalytics: boolean;
  analyticsSnapshot?: AnalyticsLabSnapshot;
}

type GenerationStatus = 'idle' | 'loading' | 'success' | 'error';

// ============================================================================
// Main Component
// ============================================================================

export function MediaQbrClient({
  companyId,
  companyName,
  hasMediaProgram,
  hasAnalytics,
  analyticsSnapshot,
}: MediaQbrClientProps) {
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [qbr, setQbr] = useState<MediaQbrOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<'28d' | '90d'>('28d');
  const [copied, setCopied] = useState(false);
  const [showRawMarkdown, setShowRawMarkdown] = useState(false);

  async function handleGenerate() {
    setStatus('loading');
    setError(null);
    setQbr(null);

    try {
      const res = await fetch('/api/os/media/qbr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, range }),
      });

      const data = await res.json();

      if (!data.ok) {
        setStatus('error');
        setError(data.message || 'Failed to generate QBR.');
      } else {
        setStatus('success');
        setQbr(data.qbr);
      }
    } catch (err) {
      console.error('[MediaQbrClient] Error:', err);
      setStatus('error');
      setError('Network error. Please try again.');
    }
  }

  async function handleCopy() {
    if (!qbr?.slideMarkdown) return;

    try {
      await navigator.clipboard.writeText(qbr.slideMarkdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('[MediaQbrClient] Copy failed:', err);
    }
  }

  function handleDownload() {
    if (!qbr?.slideMarkdown) return;

    const blob = new Blob([qbr.slideMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${companyName.replace(/\s+/g, '_')}_Media_QBR_${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // No media program state
  if (!hasMediaProgram) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-300 mb-2">
            No Active Media Program
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            This company does not have an active media program with Hive.
            QBR generation requires an active media program with performance data.
          </p>
          <Link
            href={`/c/${companyId}/media`}
            className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Media Lab
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/c/${companyId}/media`}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-400 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Media Lab
          </Link>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            Media QBR Generator
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Generate a slide-ready quarterly business review using your media performance data.
          </p>
        </div>
      </div>

      {/* Generation Controls */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">Reporting Period:</span>
            <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
              <button
                onClick={() => setRange('28d')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  range === '28d'
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                Last 28 Days
              </button>
              <button
                onClick={() => setRange('90d')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  range === '90d'
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                Last 90 Days
              </button>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={status === 'loading'}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              status === 'loading'
                ? 'bg-slate-700 text-slate-400 cursor-wait'
                : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400'
            }`}
          >
            {status === 'loading' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating QBR...
              </>
            ) : qbr ? (
              <>
                <RefreshCw className="w-4 h-4" />
                Regenerate QBR
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate QBR
              </>
            )}
          </button>
        </div>

        {/* Analytics Warning */}
        {!hasAnalytics && (
          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-400/80">
                External analytics not connected. QBR will be generated with limited data.
                Connect GA4/GSC for more comprehensive insights.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Error State */}
      {status === 'error' && error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-red-400">Generation Failed</h3>
              <p className="text-xs text-red-400/80 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Success State - QBR Preview */}
      {status === 'success' && qbr && (
        <div className="space-y-4">
          {/* Actions Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <span className="text-sm text-emerald-400 font-medium">
                QBR Generated Successfully
              </span>
              <span className="text-xs text-slate-500">
                ({new Date(qbr.generatedAt).toLocaleString()})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-800 hover:text-slate-100 transition-colors"
              >
                {copied ? (
                  <>
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Markdown
                  </>
                )}
              </button>
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-800 hover:text-slate-100 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download .md
              </button>
            </div>
          </div>

          {/* QBR Preview Sections */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
            {/* Executive Summary */}
            <QbrSection title="Executive Summary">
              <p className="text-sm text-slate-300 whitespace-pre-wrap">
                {qbr.executiveSummary}
              </p>
            </QbrSection>

            {/* Performance Overview */}
            <QbrSection title="Media Program Performance">
              <p className="text-sm text-slate-300 whitespace-pre-wrap">
                {qbr.performanceOverview}
              </p>
            </QbrSection>

            {/* Channel Mix */}
            <QbrSection title="Channel Mix">
              <p className="text-sm text-slate-300 whitespace-pre-wrap">
                {qbr.channelMix}
              </p>
            </QbrSection>

            {/* Key Trends */}
            {qbr.keyTrends.length > 0 && (
              <QbrSection title="Key Trends">
                <ul className="space-y-1.5">
                  {qbr.keyTrends.map((trend, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="text-cyan-400 mt-0.5">•</span>
                      {trend}
                    </li>
                  ))}
                </ul>
              </QbrSection>
            )}

            {/* Top Campaigns */}
            {qbr.topCampaigns.length > 0 && (
              <QbrSection title="Top Performing Campaigns">
                <ul className="space-y-1.5">
                  {qbr.topCampaigns.map((campaign, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="text-emerald-400 mt-0.5">✓</span>
                      {campaign}
                    </li>
                  ))}
                </ul>
              </QbrSection>
            )}

            {/* Underperforming Campaigns */}
            {qbr.underperformingCampaigns.length > 0 && (
              <QbrSection title="Campaigns Needing Attention">
                <ul className="space-y-1.5">
                  {qbr.underperformingCampaigns.map((campaign, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="text-amber-400 mt-0.5">!</span>
                      {campaign}
                    </li>
                  ))}
                </ul>
              </QbrSection>
            )}
          </div>

          {/* Analytics & Performance Section */}
          {analyticsSnapshot && (
            <AnalyticsQbrSection
              snapshot={analyticsSnapshot}
              quarterLabel={range === '28d' ? 'Last 28 Days' : 'Last 90 Days'}
              variant="compact"
            />
          )}

          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
            {/* Issues & Opportunities */}
            {qbr.issuesAndOpportunities.length > 0 && (
              <QbrSection title="Issues & Opportunities">
                <ul className="space-y-1.5">
                  {qbr.issuesAndOpportunities.map((issue, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="text-orange-400 mt-0.5">→</span>
                      {issue}
                    </li>
                  ))}
                </ul>
              </QbrSection>
            )}

            {/* Recommended Actions */}
            {qbr.recommendedActions.length > 0 && (
              <QbrSection title="Recommended Actions">
                <ol className="space-y-1.5 list-decimal list-inside">
                  {qbr.recommendedActions.map((action, i) => (
                    <li key={i} className="text-sm text-slate-300">
                      {action}
                    </li>
                  ))}
                </ol>
              </QbrSection>
            )}

            {/* Next Quarter Focus */}
            {qbr.nextQuarterFocus.length > 0 && (
              <QbrSection title="Next Quarter Strategic Focus">
                <ol className="space-y-1.5 list-decimal list-inside">
                  {qbr.nextQuarterFocus.map((focus, i) => (
                    <li key={i} className="text-sm text-slate-300">
                      {focus}
                    </li>
                  ))}
                </ol>
              </QbrSection>
            )}
          </div>

          {/* Raw Markdown Toggle */}
          <div className="bg-slate-900/30 border border-slate-800/50 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowRawMarkdown(!showRawMarkdown)}
              className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors"
            >
              <span className="text-sm font-medium text-slate-400">Raw Markdown</span>
              {showRawMarkdown ? (
                <ChevronUp className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              )}
            </button>
            {showRawMarkdown && (
              <div className="px-5 py-4 border-t border-slate-800/50">
                <pre className="text-xs text-slate-400 whitespace-pre-wrap font-mono bg-slate-950 p-4 rounded-lg overflow-x-auto max-h-96 overflow-y-auto">
                  {qbr.slideMarkdown}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function QbrSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-slate-800 last:border-b-0">
      <div className="px-5 py-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">{title}</h3>
        {children}
      </div>
    </div>
  );
}

export default MediaQbrClient;
