'use client';

// components/reports/StrategicReportsSection.tsx
// Strategic Reports Section - Annual Plan + QBR cards
//
// Part of the redesigned Reports hub. Shows the two "big artifact" reports
// with a clean, compact card design wrapped in a parent card.

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Calendar, BarChart3, Sparkles, Eye } from 'lucide-react';
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
    <div className="rounded-xl border border-border/60 bg-card/60 p-4 md:p-5 space-y-3">
      {/* Section Header */}
      <div>
        <h2 className="text-sm font-semibold text-slate-100">Strategic Reports</h2>
        <p className="text-[11px] text-muted-foreground">
          Long-term plans and quarterly narratives.
        </p>
      </div>

      {/* Report Cards Grid */}
      <div className="grid gap-3 md:grid-cols-2">
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
// Report Card Component - Compact Utility Design
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

  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3 md:p-4 space-y-2">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="text-xs font-semibold text-slate-100">{config.name}</div>
            <div className="text-[11px] text-muted-foreground">{formattedPeriod}</div>
          </div>
        </div>
        {latest && (
          <div className="text-[11px] text-muted-foreground">
            Last generated{' '}
            {new Date(latest.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
        )}
      </div>

      {/* Description */}
      <p className="text-[11px] text-muted-foreground">
        {config.description}
      </p>

      {/* Status line for no report */}
      {!latest && (
        <p className="text-[11px] text-muted-foreground">Not generated yet</p>
      )}

      {/* CTA Button */}
      {latest ? (
        <div className="flex gap-2 mt-2">
          <Link
            href={`/c/${companyId}/reports/${type}`}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 md:h-9 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            View
          </Link>
          <button
            onClick={onGenerate}
            disabled={isGenerating}
            className="flex items-center justify-center gap-1.5 h-8 md:h-9 px-3 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isGenerating ? 'animate-pulse' : ''}`} />
            {isGenerating ? 'Generating...' : 'Regenerate'}
          </button>
        </div>
      ) : (
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className="mt-2 w-full flex items-center justify-center gap-1.5 h-8 md:h-9 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors disabled:opacity-50"
        >
          <Sparkles className={`w-3.5 h-3.5 ${isGenerating ? 'animate-pulse' : ''}`} />
          {isGenerating ? 'Generating...' : `Generate ${config.name}`}
        </button>
      )}
    </div>
  );
}
