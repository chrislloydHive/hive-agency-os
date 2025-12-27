// app/c/[companyId]/decide/page.tsx
// Decide Phase - Confirm context and generate strategy
//
// Phase 2 of the workflow: Review discoveries and make decisions
// - Context: Confirm extracted fields from labs
// - Strategy: Generate strategy from confirmed context
// - AI Quality: Advanced quality signals (linked, not prominent)

import { Suspense } from 'react';
import { getCompanyById } from '@/lib/airtable/companies';
import { DecideClient } from './DecideClient';

export const dynamic = 'force-dynamic';

interface DecidePageProps {
  params: Promise<{ companyId: string }>;
}

export default async function DecidePage({ params }: DecidePageProps) {
  const { companyId } = await params;
  const company = await getCompanyById(companyId);

  if (!company) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-200 mb-2">Company not found</h2>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" />
        </div>
      }
    >
      <DecideClient companyId={companyId} companyName={company.name} />
    </Suspense>
  );
}
