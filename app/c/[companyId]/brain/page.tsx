// app/c/[companyId]/brain/page.tsx
// ============================================================================
// Company Brain Page - AI-Generated Company Intelligence
// ============================================================================
//
// This page aggregates all company data and generates an AI-powered narrative
// that serves as the company's institutional memory and strategic summary.

import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getCompanyBrainData } from '@/lib/brain/getCompanyBrainData';
import {
  generateCompanyBrainNarrative,
  generateFallbackNarrative,
} from '@/lib/brain/generateCompanyBrainNarrative';
import { CompanyBrainPage } from '@/components/os/CompanyBrainPage';
import { Brain } from 'lucide-react';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export const dynamic = 'force-dynamic';

// Loading skeleton for the brain page
function BrainLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-slate-800 rounded-xl">
            <div className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="h-6 w-48 bg-slate-800 rounded mb-2" />
            <div className="h-4 w-64 bg-slate-800/60 rounded" />
          </div>
        </div>
      </div>

      {/* Two Column Layout Skeleton */}
      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-6">
          <div className="space-y-4">
            <div className="h-4 bg-slate-800 rounded w-3/4" />
            <div className="h-4 bg-slate-800 rounded w-full" />
            <div className="h-4 bg-slate-800 rounded w-5/6" />
            <div className="h-4 bg-slate-800 rounded w-2/3" />
          </div>
        </div>
        <div className="space-y-6">
          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 h-48" />
          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 h-32" />
        </div>
      </div>
    </div>
  );
}

// Error display component
function BrainErrorDisplay({
  error,
  companyName,
}: {
  error: string;
  companyName: string;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl">
            <Brain className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">Company Brain</h1>
            <p className="mt-1 text-sm text-slate-400">
              Strategic memory for {companyName}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
        <Brain className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-red-300 mb-2">
          Failed to Generate Brain
        </h2>
        <p className="text-sm text-red-200/70 max-w-md mx-auto mb-4">
          {error}
        </p>
        <p className="text-xs text-slate-500">
          Try refreshing the page or running diagnostic labs to gather more data.
        </p>
      </div>
    </div>
  );
}

// Main brain content component
async function BrainContent({ companyId }: { companyId: string }) {
  try {
    // Fetch all company brain data
    const data = await getCompanyBrainData(companyId);

    // Generate AI narrative
    let narrative;
    try {
      narrative = await generateCompanyBrainNarrative(data);
    } catch (aiError) {
      console.error('[BrainPage] AI generation failed, using fallback:', aiError);
      // Use fallback narrative if AI fails
      narrative = generateFallbackNarrative(data);
    }

    return (
      <CompanyBrainPage
        companyId={companyId}
        data={data}
        narrative={narrative}
      />
    );
  } catch (error) {
    console.error('[BrainPage] Failed to load brain data:', error);

    // Handle company not found
    if (error instanceof Error && error.message.includes('not found')) {
      return notFound();
    }

    return (
      <BrainErrorDisplay
        error={error instanceof Error ? error.message : 'Unknown error occurred'}
        companyName="Unknown Company"
      />
    );
  }
}

export default async function BrainPage({ params }: PageProps) {
  const { companyId } = await params;

  return (
    <Suspense fallback={<BrainLoadingSkeleton />}>
      <BrainContent companyId={companyId} />
    </Suspense>
  );
}
