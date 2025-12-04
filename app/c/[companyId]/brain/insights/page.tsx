// app/c/[companyId]/brain/insights/page.tsx
// Brain Insights - AI-generated strategic insights (placeholder)

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { Sparkles } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface PageProps {
  params: Promise<{ companyId: string }>;
}

// ============================================================================
// Metadata
// ============================================================================

export const metadata: Metadata = {
  title: 'Brain - Insights',
};

// ============================================================================
// Page Component
// ============================================================================

export default async function BrainInsightsPage({ params }: PageProps) {
  const { companyId } = await params;

  // Load company info
  const company = await getCompanyById(companyId);
  if (!company) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Coming Soon Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8">
        <div className="flex flex-col items-center text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center mb-6">
            <Sparkles className="w-8 h-8 text-purple-400" />
          </div>

          <h2 className="text-xl font-semibold text-slate-100 mb-3">
            AI Insights Coming Soon
          </h2>

          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            Brain Insights will analyze your company's context graph to surface strategic opportunities,
            identify patterns across performance data, and generate actionable recommendations.
          </p>

          <div className="w-full space-y-3">
            <InsightPreview
              title="Growth Opportunities"
              description="AI-identified gaps between current performance and potential"
              icon="trending-up"
            />
            <InsightPreview
              title="Competitive Signals"
              description="Market movements and competitor activity analysis"
              icon="radar"
            />
            <InsightPreview
              title="Strategic Recommendations"
              description="Prioritized actions based on context and goals"
              icon="target"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function InsightPreview({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: 'trending-up' | 'radar' | 'target';
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 text-left">
      <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center flex-shrink-0">
        {icon === 'trending-up' && (
          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        )}
        {icon === 'radar' && (
          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        )}
        {icon === 'target' && (
          <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        )}
      </div>
      <div>
        <div className="text-sm font-medium text-slate-200">{title}</div>
        <div className="text-xs text-slate-500">{description}</div>
      </div>
    </div>
  );
}
