'use client';

// app/c/[companyId]/reports/qbr-lite/QbrLiteClient.tsx
// QBR Lite Client Component

import { useState } from 'react';
import { ArrowLeft, Calendar, Loader2, RefreshCw, FileText, Target, TrendingUp, TrendingDown, AlertCircle, Lightbulb } from 'lucide-react';
import Link from 'next/link';
import type { QbrLiteReport } from '@/lib/types/reports';

interface Props {
  companyId: string;
  companyName: string;
  quarter: number;
  year: number;
}

export function QbrLiteClient({ companyId, companyName, quarter, year }: Props) {
  const [report, setReport] = useState<QbrLiteReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const periodLabel = `Q${quarter} ${year}`;

  const generateReport = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/os/reports/qbr-lite/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, quarter, year }),
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

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-red-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-emerald-500/20 border-emerald-500/30';
    if (score >= 60) return 'bg-amber-500/20 border-amber-500/30';
    return 'bg-red-500/20 border-red-500/30';
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
            <h1 className="text-2xl font-semibold text-white">QBR Lite</h1>
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
              Generate QBR
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
          <h3 className="text-lg font-medium text-white mb-2">No QBR Generated</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Generate a quarterly business review for {periodLabel}. This lightweight QBR
            includes performance scoring, wins, challenges, and recommendations.
          </p>
          <button
            onClick={generateReport}
            className="px-6 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-medium transition-colors"
          >
            Generate QBR
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && !report && (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-12 text-center">
          <Loader2 className="w-12 h-12 text-sky-400 mx-auto mb-4 animate-spin" />
          <h3 className="text-lg font-medium text-white mb-2">Generating QBR</h3>
          <p className="text-slate-400">
            Analyzing quarterly data and generating insights...
          </p>
        </div>
      )}

      {/* Report Content */}
      {report && (
        <div className="space-y-6">
          {/* Overall Score Card */}
          <div className={`border rounded-xl p-6 ${getScoreBg(report.overallScore)}`}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">Quarterly Performance</h2>
                <p className="text-slate-400">{periodLabel} Review</p>
              </div>
              <div className="text-right">
                <div className={`text-5xl font-bold ${getScoreColor(report.overallScore)}`}>
                  {report.overallScore}
                </div>
                <div className="text-sm text-slate-400 mt-1">Overall Score</div>
              </div>
            </div>
          </div>

          {/* Executive Summary */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Executive Summary</h2>
            <p className="text-slate-300 leading-relaxed">{report.summary}</p>
          </div>

          {/* Score Breakdown */}
          {report.scoreBreakdown && report.scoreBreakdown.length > 0 && (
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-sky-400" />
                Performance by Area
              </h2>
              <div className="space-y-4">
                {report.scoreBreakdown.map((item, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-300">{item.area}</span>
                      <span className={`font-semibold ${getScoreColor(item.score)}`}>
                        {item.score}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          item.score >= 80 ? 'bg-emerald-500' :
                          item.score >= 60 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${item.score}%` }}
                      />
                    </div>
                    {item.notes && (
                      <p className="text-sm text-slate-500 mt-1">{item.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Two Column: Wins & Challenges */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Wins */}
            {report.wins && report.wins.length > 0 && (
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  Wins
                </h2>
                <ul className="space-y-3">
                  {report.wins.map((win, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-2 flex-shrink-0" />
                      <span className="text-slate-300">{win}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Challenges */}
            {report.challenges && report.challenges.length > 0 && (
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-amber-400" />
                  Challenges
                </h2>
                <ul className="space-y-3">
                  {report.challenges.map((challenge, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-2 flex-shrink-0" />
                      <span className="text-slate-300">{challenge}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Opportunities */}
          {report.opportunities && report.opportunities.length > 0 && (
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-sky-400" />
                Opportunities
              </h2>
              <ul className="space-y-3">
                {report.opportunities.map((opp, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 bg-sky-400 rounded-full mt-2 flex-shrink-0" />
                    <span className="text-slate-300">{opp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {report.recommendations && report.recommendations.length > 0 && (
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-violet-400" />
                Recommendations
              </h2>
              <div className="space-y-4">
                {report.recommendations.map((rec, i) => (
                  <div key={i} className="bg-slate-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                        rec.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                        rec.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-slate-600/50 text-slate-400'
                      }`}>
                        {rec.priority} priority
                      </span>
                    </div>
                    <p className="text-slate-300">{rec.text}</p>
                  </div>
                ))}
              </div>
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
