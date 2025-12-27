// app/c/[companyId]/deliver/page.tsx
// Deliver Phase - Create deliverables from confirmed decisions
//
// Phase 3 of the workflow: Generate client-ready documents
// - Strategy Document
// - RFP Response Bundle
// - Other artifacts

import { Suspense } from 'react';
import { getCompanyById } from '@/lib/airtable/companies';
import { DeliverClient } from './DeliverClient';

export const dynamic = 'force-dynamic';

interface DeliverPageProps {
  params: Promise<{ companyId: string }>;
}

export default async function DeliverPage({ params }: DeliverPageProps) {
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
      <DeliverClient companyId={companyId} companyName={company.name} />
    </Suspense>
  );
}
