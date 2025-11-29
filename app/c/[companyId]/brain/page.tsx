// app/c/[companyId]/brain/page.tsx
// Client Brain - Strategic memory for a company

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCompanyById } from '@/lib/airtable/companies';
import { getCompanyInsights, getCompanyDocuments, getInsightsSummary } from '@/lib/airtable/clientBrain';
import { ClientBrainInsightsPanel } from '@/components/os/ClientBrainInsightsPanel';
import { ClientBrainDocumentsPanel } from '@/components/os/ClientBrainDocumentsPanel';
import { Brain, Lightbulb, FileText, ArrowLeft } from 'lucide-react';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export const dynamic = 'force-dynamic';

export default async function ClientBrainPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch company
  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  // Fetch initial data for summary
  let insightsSummary;
  let documentsCount = 0;

  try {
    insightsSummary = await getInsightsSummary(companyId);
    const documents = await getCompanyDocuments(companyId, { limit: 1 });
    documentsCount = documents.length > 0 ? (await getCompanyDocuments(companyId)).length : 0;
  } catch (error) {
    console.warn('[ClientBrain] Failed to load summary:', error);
    insightsSummary = null;
  }

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        href={`/c/${companyId}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to {company.name}
      </Link>

      {/* Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl">
              <Brain className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">Brain</h1>
              <p className="mt-1 text-sm text-slate-400">
                Strategic memory and insights for {company.name}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-6">
            <div className="text-right">
              <div className="flex items-center justify-end gap-1.5 text-slate-400">
                <Lightbulb className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wide">Insights</span>
              </div>
              <p className="text-2xl font-bold tabular-nums text-slate-100">
                {insightsSummary?.total ?? 0}
              </p>
              {insightsSummary?.recentCount !== undefined && insightsSummary.recentCount > 0 && (
                <p className="text-xs text-emerald-400">
                  +{insightsSummary.recentCount} this week
                </p>
              )}
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-1.5 text-slate-400">
                <FileText className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wide">Documents</span>
              </div>
              <p className="text-2xl font-bold tabular-nums text-slate-100">
                {documentsCount}
              </p>
            </div>
          </div>
        </div>

        {/* Category breakdown */}
        {insightsSummary && insightsSummary.total > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-800">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">
              Insights by Category
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(insightsSummary.byCategory)
                .filter(([, count]) => count > 0)
                .sort(([, a], [, b]) => b - a)
                .map(([category, count]) => (
                  <span
                    key={category}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs"
                  >
                    <span className="text-slate-300 capitalize">{category}</span>
                    <span className="text-slate-500">{count}</span>
                  </span>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Two-column layout for Insights and Documents */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Insights Panel */}
        <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-6">
          <ClientBrainInsightsPanel companyId={companyId} companyName={company.name} />
        </div>

        {/* Documents Panel */}
        <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-6">
          <ClientBrainDocumentsPanel companyId={companyId} companyName={company.name} />
        </div>
      </div>
    </div>
  );
}
