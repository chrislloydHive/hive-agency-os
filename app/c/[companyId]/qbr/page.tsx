// app/c/[companyId]/qbr/page.tsx
// Quarterly Business Review Mode - Server Component

import { Suspense } from 'react';
import { getCompanyById } from '@/lib/airtable/companies';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { QBRClient } from './QBRClient';

interface QBRPageProps {
  params: Promise<{ companyId: string }>;
}

export default async function QBRPage({ params }: QBRPageProps) {
  const { companyId } = await params;

  // Load company data
  const company = await getCompanyById(companyId);
  if (!company) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl font-semibold text-slate-300">Company Not Found</h1>
        <p className="text-slate-500 mt-2">Unable to load company data</p>
      </div>
    );
  }

  // Load context graph
  const graph = await loadContextGraph(companyId);

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <div className="text-slate-400">Loading QBR...</div>
        </div>
      }
    >
      <QBRClient
        companyId={companyId}
        companyName={company.name}
        initialGraph={graph}
      />
    </Suspense>
  );
}
