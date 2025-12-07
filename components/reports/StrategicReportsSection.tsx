'use client';

// components/reports/StrategicReportsSection.tsx
// Strategic Reports Section - Annual Plan + QBR cards
//
// Part of the redesigned Reports hub. Shows the two "big artifact" reports
// with a clean, compact card design.

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Calendar, BarChart3, Sparkles, Eye, Clock } from 'lucide-react';
import type { ReportListItem, ReportType } from '@/lib/reports/types';
import { REPORT_TYPE_CONFIG, formatPeriod, getCurrentYear, getCurrentQuarter } from '@/lib/reports/types';

// ============================================================================
// Types
// ============================================================================

export interface StrategicReportsSectionProps {
  companyId: string;
  latestAnnual: ReportListItem | null;
  latestQbr: ReportListItem | null;
}

// ============================================================================
// Main Component
// ============================================================================

export function StrategicReportsSection({
  companyId,
  latestAnnual,
  latestQbr,
}: StrategicReportsSectionProps) {
  const router = useRouter();
  const [generatingType, setGeneratingType] = useState<ReportType | null>(null);

  const handleGenerate = async (type: ReportType) => {
    setGeneratingType(type);
    try {
      const response = await fetch(`/api/os/companies/${companyId}/reports/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      router.push(`/c/${companyId}/reports/${type}`);
      router.refresh();
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setGeneratingType(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div>
        <h2 className="text-sm font-semibold text-slate-100">Strategic Reports</h2>
        <p className="text-xs text-muted-foreground">
          Long-term plans and quarterly narratives.
        </p>
      </div>

      {/* Report Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <ReportCard
          type="annual"
          latest={latestAnnual}
          companyId={companyId}
          isGenerating={generatingType === 'annual'}
          onGenerate={() => handleGenerate('annual')}
        />
        <ReportCard
          type="qbr"
          latest={latestQbr}
          companyId={companyId}
          isGenerating={generatingType === 'qbr'}
          onGenerate={() => handleGenerate('qbr')}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Report Card Component - Compact Design
// ============================================================================

interface ReportCardProps {
  type: ReportType;
  latest: ReportListItem | null;
  companyId: string;
  isGenerating: boolean;
  onGenerate: () => void;
}

function ReportCard({
  type,
  latest,
  companyId,
  isGenerating,
  onGenerate,
}: ReportCardProps) {
  const config = REPORT_TYPE_CONFIG[type];
  const Icon = type === 'annual' ? Calendar : BarChart3;

  const currentPeriod = type === 'annual' ? getCurrentYear() : getCurrentQuarter();
  const formattedPeriod = formatPeriod(currentPeriod, type);

  // Color scheme based on type
  const iconColor = type === 'annual' ? 'text-emerald-400' : 'text-cyan-400';
  const buttonGradient = type === 'annual'
    ? 'from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400'
    : 'from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400';

  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-4">
      {/* Header Row */}
      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 rounded-lg bg-slate-800/50">
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-100">{config.name}</h3>
          <p className="text-xs text-slate-400">{formattedPeriod}</p>
        </div>
      </div>

      {/* Status Row */}
      <div className="mb-4">
        {latest ? (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Clock className="w-3 h-3" />
            <span>
              Last generated:{' '}
              {new Date(latest.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium ${
              latest.status === 'finalized'
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-amber-500/20 text-amber-400'
            }`}>
              {latest.status === 'finalized' ? 'Final' : 'Draft'}
            </span>
          </div>
        ) : (
          <p className="text-xs text-slate-500">Not generated yet</p>
        )}
      </div>

      {/* CTA Button - Full Width */}
      {latest ? (
        <div className="flex gap-2">
          <Link
            href={`/c/${companyId}/reports/${type}`}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            View
          </Link>
          <button
            onClick={onGenerate}
            disabled={isGenerating}
            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-gradient-to-r ${buttonGradient} text-white transition-colors disabled:opacity-50`}
          >
            {isGenerating ? (
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {isGenerating ? 'Generating...' : 'Regenerate'}
          </button>
        </div>
      ) : (
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r ${buttonGradient} text-white transition-colors disabled:opacity-50`}
        >
          {isGenerating ? (
            <>
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              Generate {config.name}
            </>
          )}
        </button>
      )}
    </div>
  );
}
