// app/c/[companyId]/decide/page.tsx
// Decide Phase Dashboard - Overview of Context & Strategy State
//
// Phase 2 landing page: Shows current status of Labs, Context, and Strategy.
// Users click into each section to make progress.

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
