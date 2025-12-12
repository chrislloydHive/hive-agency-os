// app/c/[companyId]/documents/page.tsx
// Documents Page
//
// Lists briefs and generated documents with ability to create new ones.

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { getBriefsForCompany } from '@/lib/os/documents';
import { getActiveStrategy } from '@/lib/os/strategy';
import { DocumentsClient } from './DocumentsClient';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function DocumentsPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch all required data in parallel
  const [company, briefs, strategy] = await Promise.all([
    getCompanyById(companyId),
    getBriefsForCompany(companyId),
    getActiveStrategy(companyId),
  ]);

  if (!company) {
    return notFound();
  }

  return (
    <div className="space-y-6">
      <DocumentsClient
        companyId={companyId}
        companyName={company.name}
        initialBriefs={briefs}
        hasStrategy={!!strategy}
      />
    </div>
  );
}
