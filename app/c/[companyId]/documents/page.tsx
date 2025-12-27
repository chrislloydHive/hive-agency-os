// app/c/[companyId]/documents/page.tsx
// Documents Page
//
// Lists all artifacts/deliverables for a company with:
// - Pinned primary document
// - Grouped by type
// - Staleness warnings and update actions

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { getArtifactsForCompany } from '@/lib/airtable/artifacts';
import { DocumentsClient } from './DocumentsClient';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function DocumentsPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch all required data in parallel
  const [company, artifacts] = await Promise.all([
    getCompanyById(companyId),
    getArtifactsForCompany(companyId).catch(() => []),
  ]);

  if (!company) {
    return notFound();
  }

  return (
    <div className="space-y-6">
      <DocumentsClient
        companyId={companyId}
        companyName={company.name}
        initialArtifacts={artifacts}
      />
    </div>
  );
}
