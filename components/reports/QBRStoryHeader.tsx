'use client';

// components/reports/QBRStoryHeader.tsx
// QBR Story View Header - Breadcrumb, title, subtitle with health-based messaging, action buttons

import Link from 'next/link';
import { ArrowLeft, RefreshCw, Sparkles, Download, Clock, BookOpen } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface QBRStoryHeaderProps {
  companyId: string;
  companyName: string;
  periodLabel: string;
  healthScore: number;
  generatedAt?: string;
  aiGenerated?: boolean;
  generating?: boolean;
  onRegenerate?: () => void;
  hasNarrative?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

function getHealthSubtitle(score: number): string {
  if (score < 50) {
    return 'Needs attention \u2013 focus on key risks.';
  }
  if (score < 70) {
    return 'Mixed performance \u2013 progress with notable gaps.';
  }
  return 'Strong quarter \u2013 refine and scale what\u2019s working.';
}

function getHealthStatusLabel(score: number): { label: string; color: string } {
  if (score >= 80) {
    return { label: 'Strong', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
  }
  if (score >= 60) {
    return { label: 'On track', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' };
  }
  if (score >= 40) {
    return { label: 'Needs focus', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
  }
  return { label: 'At risk', color: 'text-red-400 bg-red-500/10 border-red-500/30' };
}

// ============================================================================
// Main Component
// ============================================================================

export function QBRStoryHeader({
  companyId,
  companyName,
  periodLabel,
  healthScore,
  generatedAt,
  aiGenerated,
  generating,
  onRegenerate,
  hasNarrative,
}: QBRStoryHeaderProps) {
  const subtitle = getHealthSubtitle(healthScore);
  const status = getHealthStatusLabel(healthScore);

  return (
    <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-5 md:p-6 relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-cyan-500/5 pointer-events-none" />

      <div className="relative flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        {/* Left: Breadcrumb + Title */}
        <div className="space-y-3">
          {/* Breadcrumb */}
          <Link
            href={`/c/${companyId}/reports`}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Reports
          </Link>

          {/* Title row with tag */}
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-semibold text-slate-100">
              Quarterly Business Review \u2013 {periodLabel}
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/30">
              Story View
            </span>
          </div>

          {/* Subtitle */}
          <div className="flex items-center gap-3">
            <p className="text-sm text-slate-400">{companyName}</p>
            <span className="text-slate-700">\u2022</span>
            <p className="text-sm text-slate-400">{subtitle}</p>
            {hasNarrative && (
              <>
                <span className="text-slate-700">\u2022</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${status.color}`}>
                  {status.label}
                </span>
              </>
            )}
          </div>

          {/* Metadata */}
          {generatedAt && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              <span>Generated: {new Date(generatedAt).toLocaleDateString()}</span>
              {aiGenerated && (
                <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 text-[10px] font-medium">
                  AI
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Export button (placeholder) */}
          <button
            disabled
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-slate-700 text-slate-400 opacity-50 cursor-not-allowed"
            title="Export coming soon"
          >
            <Download className="w-4 h-4" />
            Export
          </button>

          {/* Regenerate button */}
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white transition-colors disabled:opacity-50"
            >
              {generating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : hasNarrative ? (
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
          )}
        </div>
      </div>
    </div>
  );
}
