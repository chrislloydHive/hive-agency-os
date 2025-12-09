'use client';

// app/c/[companyId]/reports/qbr/QBRReportClient.tsx
// QBR Report Client - View and generate quarterly business reviews

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BarChart3, Sparkles, RefreshCw, ArrowLeft, FileText, Clock, ClipboardList } from 'lucide-react';
import type { CompanyReport } from '@/lib/reports/types';
import { ReportRenderer } from '@/components/reports/ReportRenderer';

interface Props {
  companyId: string;
  companyName: string;
  period: string;
  existingReport: CompanyReport | null;
}

export function QBRReportClient({
  companyId,
  companyName,
  period,
  existingReport,
}: Props) {
  const router = useRouter();
  const [report, setReport] = useState<CompanyReport | null>(existingReport);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch(`/api/os/companies/${companyId}/reports/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'qbr', period }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate report');
      }

      const data = await response.json();
      setReport(data.report);
      router.refresh();
    } catch (err) {
      console.error('Failed to generate QBR:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/c/${companyId}/reports`}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <BarChart3 className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-100">
                  Quarterly Business Review - {period}
                </h1>
                <p className="text-sm text-slate-400">{companyName}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {report && (
            <div className="flex items-center gap-2 text-xs text-slate-400 mr-4">
              <Clock className="w-3.5 h-3.5" />
              Last updated: {new Date(report.meta.updatedAt).toLocaleDateString()}
            </div>
          )}
          <Link
            href={`/c/${companyId}/work`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
          >
            <ClipboardList className="w-4 h-4" />
            View Work
          </Link>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white transition-colors disabled:opacity-50"
          >
            {generating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : report ? (
              <>
                <RefreshCw className="w-4 h-4" />
                Regenerate
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate QBR
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/10">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Content */}
      {report ? (
        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-6">
          <ReportRenderer report={report} />
        </div>
      ) : !generating ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-12 flex flex-col items-center justify-center text-center">
          <div className="p-4 rounded-full bg-slate-800 mb-4">
            <FileText className="w-8 h-8 text-slate-500" />
          </div>
          <h2 className="text-lg font-semibold text-slate-200 mb-2">
            No QBR for {period}
          </h2>
          <p className="text-sm text-slate-400 mb-6 max-w-md">
            Generate an AI-powered quarterly business review that includes performance summary,
            key wins and challenges, strategic insights, and recommended next moves.
          </p>
          <button
            onClick={handleGenerate}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white shadow-lg shadow-blue-500/25 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Generate QBR
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-12 flex flex-col items-center justify-center">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mb-4" />
          <p className="text-sm text-slate-300">Generating your quarterly business review...</p>
          <p className="text-xs text-slate-500 mt-1">This may take a minute.</p>
        </div>
      )}
    </div>
  );
}
