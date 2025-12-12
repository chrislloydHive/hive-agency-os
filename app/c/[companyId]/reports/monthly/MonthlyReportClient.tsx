'use client';

// app/c/[companyId]/reports/monthly/MonthlyReportClient.tsx
// Monthly Report Client Component

import { useState } from 'react';
import { ArrowLeft, Calendar, Loader2, RefreshCw, FileText, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import type { MonthlyReport } from '@/lib/types/reports';

interface Props {
  companyId: string;
  companyName: string;
  month: number;
  year: number;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function MonthlyReportClient({ companyId, companyName, month, year }: Props) {
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthName = MONTH_NAMES[month - 1] || 'Unknown';
  const periodLabel = `${monthName} ${year}`;

  const generateReport = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/os/reports/monthly/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, month, year }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate report');
      }

      const data = await response.json();
      setReport(data.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href={`/c/${companyId}/reports`}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-white">Monthly Report</h1>
            <p className="text-slate-400 flex items-center gap-2 mt-1">
              <Calendar className="w-4 h-4" />
              {periodLabel} • {companyName}
            </p>
          </div>
        </div>

        <button
          onClick={generateReport}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:bg-slate-700 text-white rounded-lg font-medium transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : report ? (
            <>
              <RefreshCw className="w-4 h-4" />
              Regenerate
            </>
          ) : (
            <>
              <FileText className="w-4 h-4" />
              Generate Report
            </>
          )}
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 mb-6">
          {error}
        </div>
      )}

      {/* Empty State */}
      {!report && !loading && !error && (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-12 text-center">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No Report Generated</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Generate a monthly summary report for {periodLabel}. This will include
            work completed, key metrics, and AI-generated highlights.
          </p>
          <button
            onClick={generateReport}
            className="px-6 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-medium transition-colors"
          >
            Generate Report
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && !report && (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-12 text-center">
          <Loader2 className="w-12 h-12 text-sky-400 mx-auto mb-4 animate-spin" />
          <h3 className="text-lg font-medium text-white mb-2">Generating Report</h3>
          <p className="text-slate-400">
            Analyzing data and generating insights...
          </p>
        </div>
      )}

      {/* Report Content */}
      {report && (
        <div className="space-y-6">
          {/* Executive Summary */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Executive Summary</h2>
            <p className="text-slate-300 leading-relaxed">{report.summary}</p>
          </div>

          {/* Key Metrics */}
          {report.metrics && report.metrics.length > 0 && (
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-sky-400" />
                Key Metrics
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {report.metrics.map((metric, i) => (
                  <div key={i} className="bg-slate-800/50 rounded-lg p-4">
                    <div className="text-sm text-slate-400 mb-1">{metric.label}</div>
                    <div className="text-2xl font-semibold text-white">{metric.value}</div>
                    {metric.change && (
                      <div className={`text-sm mt-1 ${
                        metric.change.startsWith('+') ? 'text-emerald-400' :
                        metric.change.startsWith('-') ? 'text-red-400' : 'text-slate-400'
                      }`}>
                        {metric.change}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Highlights */}
          {report.highlights && report.highlights.length > 0 && (
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                Highlights
              </h2>
              <ul className="space-y-3">
                {report.highlights.map((highlight, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-2 flex-shrink-0" />
                    <span className="text-slate-300">{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Concerns */}
          {report.concerns && report.concerns.length > 0 && (
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                Areas of Concern
              </h2>
              <ul className="space-y-3">
                {report.concerns.map((concern, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-2 flex-shrink-0" />
                    <span className="text-slate-300">{concern}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Work Summary */}
          {report.workSummary && (
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Work Summary</h2>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-slate-800/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-semibold text-emerald-400">
                    {report.workSummary.completed}
                  </div>
                  <div className="text-sm text-slate-400">Completed</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-semibold text-sky-400">
                    {report.workSummary.inProgress}
                  </div>
                  <div className="text-sm text-slate-400">In Progress</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-semibold text-slate-400">
                    {report.workSummary.planned}
                  </div>
                  <div className="text-sm text-slate-400">Planned</div>
                </div>
              </div>
              {report.workSummary.keyDeliverables && report.workSummary.keyDeliverables.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-2">Key Deliverables</h3>
                  <ul className="space-y-2">
                    {report.workSummary.keyDeliverables.map((deliverable, i) => (
                      <li key={i} className="flex items-center gap-2 text-slate-300">
                        <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        {deliverable}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Generated timestamp */}
          <div className="text-center text-sm text-slate-500">
            Generated {new Date(report.generatedAt).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}
