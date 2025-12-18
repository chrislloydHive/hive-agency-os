// app/c/[companyId]/briefs/page.tsx
// List all briefs for a company

import { getBriefsForCompany } from '@/lib/airtable/briefs';
import { getCompanyById } from '@/lib/airtable/companies';
import Link from 'next/link';
import { ArrowLeft, FileText, Lock, Plus } from 'lucide-react';
import {
  BRIEF_STATUS_LABELS,
  BRIEF_STATUS_COLORS,
  BRIEF_TYPE_LABELS,
} from '@/lib/types/brief';

export default async function BriefsListPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;

  const [company, briefs] = await Promise.all([
    getCompanyById(companyId),
    getBriefsForCompany(companyId),
  ]);

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href={`/c/${companyId}`}
              className="p-1 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-white">Briefs</h1>
              <p className="text-sm text-slate-400">{company?.name || 'Company'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        {briefs.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-slate-500" />
            </div>
            <h2 className="text-lg font-medium text-white mb-2">No briefs yet</h2>
            <p className="text-slate-400 mb-6 max-w-md mx-auto">
              Briefs are generated from approved strategy and GAP analysis.
              Complete your context gathering and strategy to generate your first brief.
            </p>
            <Link
              href={`/c/${companyId}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Start Strategy
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {briefs.map((brief) => (
              <Link
                key={brief.id}
                href={`/c/${companyId}/briefs/${brief.id}`}
                className="block p-4 bg-slate-800/50 hover:bg-slate-800 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-medium truncate">{brief.title}</h3>
                      {brief.isLocked && <Lock className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />}
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-slate-400">{BRIEF_TYPE_LABELS[brief.type]}</span>
                      <span className={`px-2 py-0.5 text-xs rounded ${BRIEF_STATUS_COLORS[brief.status]}`}>
                        {BRIEF_STATUS_LABELS[brief.status]}
                      </span>
                    </div>
                    {brief.core.objective && (
                      <p className="mt-2 text-sm text-slate-500 line-clamp-2">
                        {brief.core.objective}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 ml-4 flex-shrink-0">
                    {new Date(brief.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
