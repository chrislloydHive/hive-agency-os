'use client';

// components/reports/StrategicReportsSection.tsx
// Strategic Reports Section - Annual Plan + QBR hero cards
//
// Part of the redesigned Reports hub. Shows the two "big artifact" reports
// with a modern hero-style card design wrapped in a parent card.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, BarChart3 } from 'lucide-react';
import type { ReportListItem, ReportType } from '@/lib/reports/types';
import { REPORT_TYPE_CONFIG, formatPeriod, getCurrentYear, getCurrentQuarter } from '@/lib/reports/types';
import { ReportHeroCard } from './ReportHeroCard';

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
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (type: ReportType) => {
    setGeneratingType(type);
    setError(null);
    try {
      // QBR uses the new /qbr endpoint (Anthropic-based)
      // Annual uses the old /reports/generate endpoint (OpenAI-based)
      const endpoint = type === 'qbr'
        ? `/api/os/companies/${companyId}/qbr`
        : `/api/os/companies/${companyId}/reports/generate`;

      const body = type === 'qbr'
        ? { useAI: true }
        : { type };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Failed to generate ${type} report`);
      }

      router.push(`/c/${companyId}/reports/${type}`);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate report';
      console.error('Failed to generate report:', message);
      setError(message);
    } finally {
      setGeneratingType(null);
    }
  };

  const annualConfig = REPORT_TYPE_CONFIG['annual'];
  const qbrConfig = REPORT_TYPE_CONFIG['qbr'];
  const currentYear = getCurrentYear();
  const currentQuarter = getCurrentQuarter();

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/80 shadow-sm p-4 md:p-5 space-y-4">
      {/* Section Header */}
      <div>
        <h2 className="text-sm font-semibold text-slate-100">Strategic Reports</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Long-term plans and quarterly narratives.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Hero Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Annual Plan Card */}
        <ReportHeroCard
          icon={<CalendarClock className="w-5 h-5 text-emerald-400" />}
          eyebrow="Annual Plan"
          title={`${currentYear} Annual Plan`}
          description={annualConfig.description}
          badge={latestAnnual ? `Updated ${formatDate(latestAnnual.createdAt)}` : 'Not generated yet'}
          badgeVariant={latestAnnual ? 'success' : 'default'}
          ctaLabel={latestAnnual ? 'Regenerate' : 'Generate Annual Plan'}
          ctaVariant={latestAnnual ? 'secondary' : 'primary'}
          isLoading={generatingType === 'annual'}
          onCtaClick={() => handleGenerate('annual')}
          secondaryAction={latestAnnual ? {
            label: 'View',
            href: `/c/${companyId}/reports/annual`,
          } : undefined}
        />

        {/* QBR Card */}
        <ReportHeroCard
          icon={<BarChart3 className="w-5 h-5 text-cyan-400" />}
          eyebrow="Quarterly Business Review"
          title={`${formatPeriod(currentQuarter, 'qbr')} QBR`}
          description={qbrConfig.description}
          badge={latestQbr ? `Updated ${formatDate(latestQbr.createdAt)}` : 'Not generated yet'}
          badgeVariant={latestQbr ? 'success' : 'default'}
          ctaLabel={latestQbr ? 'Regenerate' : 'Generate QBR'}
          ctaVariant={latestQbr ? 'secondary' : 'primary'}
          isLoading={generatingType === 'qbr'}
          onCtaClick={() => handleGenerate('qbr')}
          secondaryAction={latestQbr ? {
            label: 'View',
            href: `/c/${companyId}/reports/qbr`,
          } : undefined}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Utilities
// ============================================================================

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}
