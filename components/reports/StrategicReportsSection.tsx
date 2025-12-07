'use client';

// components/reports/StrategicReportsSection.tsx
// Strategic Reports Section - Annual Plan + QBR cards
//
// Part of the redesigned Reports hub. Shows the two "big artifact" reports
// that can be generated for strategic/stakeholder purposes.

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

      // Navigate to the report page
      router.push(`/c/${companyId}/reports/${type}`);
      router.refresh();
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setGeneratingType(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div>
        <h2 className="text-sm font-semibold text-slate-100">Strategic Reports</h2>
        <p className="text-xs text-muted-foreground">
          High-level plans and narrative summaries you can share with stakeholders.
        </p>
      </div>

      {/* Report Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Annual Plan Card */}
        <ReportCard
          type="annual"
          latest={latestAnnual}
          companyId={companyId}
          isGenerating={generatingType === 'annual'}
          onGenerate={() => handleGenerate('annual')}
        />

        {/* QBR Card */}
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
// Report Card Component
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

  const colorMap = {
    emerald: {
      icon: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      button: 'from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400',
    },
    cyan: {
      icon: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/30',
      button: 'from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400',
    },
  };
  const colorClasses = colorMap[config.color as keyof typeof colorMap] || colorMap.emerald;

  const currentPeriod = type === 'annual' ? getCurrentYear() : getCurrentQuarter();
  const formattedPeriod = formatPeriod(currentPeriod, type);

  return (
    <div className={`rounded-xl border ${colorClasses.border} ${colorClasses.bg} p-6`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-slate-800/50">
            <Icon className={`w-5 h-5 ${colorClasses.icon}`} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-100">{config.name}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{formattedPeriod}</p>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-slate-300 mb-4">{config.description}</p>

      {/* Latest Report Info */}
      {latest ? (
        <div className="mb-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Clock className="w-3 h-3" />
            <span>Last generated</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-200">
              {new Date(latest.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded ${
              latest.status === 'finalized'
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-amber-500/20 text-amber-400'
            }`}>
              {latest.status === 'finalized' ? 'Finalized' : 'Draft'}
            </span>
          </div>
        </div>
      ) : (
        <div className="mb-4 p-3 rounded-lg bg-slate-800/30 border border-slate-700/30">
          <p className="text-xs text-slate-500 text-center">No report generated yet</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {latest ? (
          <>
            <Link
              href={`/c/${companyId}/reports/${type}`}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              <Eye className="w-4 h-4" />
              View Latest
            </Link>
            <button
              onClick={onGenerate}
              disabled={isGenerating}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-gradient-to-r ${colorClasses.button} text-white transition-colors disabled:opacity-50`}
            >
              {isGenerating ? (
                <>
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Regenerate
                </>
              )}
            </button>
          </>
        ) : (
          <button
            onClick={onGenerate}
            disabled={isGenerating}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r ${colorClasses.button} text-white shadow-lg transition-colors disabled:opacity-50`}
          >
            {isGenerating ? (
              <>
                <Sparkles className="w-4 h-4 animate-pulse" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate {config.name}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
